<?php

class RecurringTransaction
{
    private static array $validFrequencies = ['weekly', 'biweekly', 'monthly'];

    public static function getByKid(PDO $db, int $kidId): array
    {
        $stmt = $db->prepare('SELECT * FROM recurring_transactions WHERE kid_id = :kid_id ORDER BY created_at DESC');
        $stmt->execute(['kid_id' => $kidId]);
        return $stmt->fetchAll();
    }

    public static function getActiveByKid(PDO $db, int $kidId): array
    {
        $stmt = $db->prepare('SELECT * FROM recurring_transactions WHERE kid_id = :kid_id AND is_active = 1');
        $stmt->execute(['kid_id' => $kidId]);
        return $stmt->fetchAll();
    }

    public static function getById(PDO $db, int $id): array|false
    {
        $stmt = $db->prepare('SELECT * FROM recurring_transactions WHERE id = :id');
        $stmt->execute(['id' => $id]);
        return $stmt->fetch();
    }

    public static function create(
        PDO $db,
        int $kidId,
        string $type,
        string $category,
        float $amount,
        string $description,
        string $frequency,
        ?int $dayOfWeek,
        ?int $dayOfMonth,
        string $startDate,
        ?string $endDate = null
    ): int {
        if (!in_array($frequency, self::$validFrequencies)) {
            throw new InvalidArgumentException('Invalid frequency');
        }

        $stmt = $db->prepare(
            'INSERT INTO recurring_transactions (kid_id, type, category, amount, description, frequency, day_of_week, day_of_month, start_date, end_date, is_active, created_at, updated_at)
             VALUES (:kid_id, :type, :category, :amount, :description, :frequency, :day_of_week, :day_of_month, :start_date, :end_date, 1, :created_at, :updated_at)'
        );
        $now = date('Y-m-d H:i:s');
        $stmt->execute([
            'kid_id'       => $kidId,
            'type'         => $type,
            'category'     => $category,
            'amount'       => abs($amount),
            'description'  => $description,
            'frequency'    => $frequency,
            'day_of_week'  => $dayOfWeek,
            'day_of_month' => $dayOfMonth,
            'start_date'   => $startDate,
            'end_date'     => $endDate,
            'created_at'   => $now,
            'updated_at'   => $now,
        ]);
        return (int) $db->lastInsertId();
    }

    public static function update(
        PDO $db,
        int $id,
        string $type,
        string $category,
        float $amount,
        string $description,
        string $frequency,
        ?int $dayOfWeek,
        ?int $dayOfMonth,
        ?string $endDate,
        bool $isActive
    ): void {
        if (!in_array($frequency, self::$validFrequencies)) {
            throw new InvalidArgumentException('Invalid frequency');
        }

        $stmt = $db->prepare(
            'UPDATE recurring_transactions SET type = :type, category = :category, amount = :amount,
             description = :description, frequency = :frequency, day_of_week = :day_of_week,
             day_of_month = :day_of_month, end_date = :end_date, is_active = :is_active,
             updated_at = :updated_at WHERE id = :id'
        );
        $stmt->execute([
            'type'         => $type,
            'category'     => $category,
            'amount'       => abs($amount),
            'description'  => $description,
            'frequency'    => $frequency,
            'day_of_week'  => $dayOfWeek,
            'day_of_month' => $dayOfMonth,
            'end_date'     => $endDate,
            'is_active'    => $isActive ? 1 : 0,
            'updated_at'   => date('Y-m-d H:i:s'),
            'id'           => $id,
        ]);
    }

    public static function delete(PDO $db, int $id): void
    {
        $stmt = $db->prepare('DELETE FROM recurring_transactions WHERE id = :id');
        $stmt->execute(['id' => $id]);
    }

    /**
     * Generate transaction instances for a kid from all active recurring rules.
     * Generates from start_date up to today + 1 month, skipping already-existing ones.
     * Also promotes 'future' transactions whose date has arrived to 'pending'.
     */
    public static function generateForKid(PDO $db, int $kidId): int
    {
        $today = date('Y-m-d');
        $futureLimit = date('Y-m-d', strtotime('+1 month'));

        // Promote future → pending for dates that have arrived
        $stmt = $db->prepare(
            "UPDATE transactions SET status = 'pending'
             WHERE kid_id = :kid_id AND status = 'future' AND transaction_date <= :today"
        );
        $stmt->execute(['kid_id' => $kidId, 'today' => $today]);

        $rules = self::getActiveByKid($db, $kidId);
        $generated = 0;

        foreach ($rules as $rule) {
            // Deactivate expired rules
            if ($rule['end_date'] && $rule['end_date'] < $today) {
                $db->prepare('UPDATE recurring_transactions SET is_active = 0, updated_at = :now WHERE id = :id')
                    ->execute(['now' => date('Y-m-d H:i:s'), 'id' => $rule['id']]);
                continue;
            }

            $effectiveEnd = $rule['end_date'] ? min($rule['end_date'], $futureLimit) : $futureLimit;

            $dates = self::generateDates(
                $rule['frequency'],
                $rule['day_of_week'] !== null ? (int) $rule['day_of_week'] : null,
                $rule['day_of_month'] !== null ? (int) $rule['day_of_month'] : null,
                $rule['start_date'],
                $effectiveEnd
            );

            foreach ($dates as $date) {
                if (self::transactionExistsForDate($db, (int) $rule['id'], $date)) {
                    continue;
                }

                $status = ($date > $today) ? 'future' : 'pending';

                Transaction::create(
                    $db,
                    $kidId,
                    $rule['type'],
                    $rule['category'],
                    (float) $rule['amount'],
                    $rule['description'],
                    $date,
                    $status,
                    (int) $rule['id']
                );
                $generated++;
            }
        }

        return $generated;
    }

    private static function transactionExistsForDate(PDO $db, int $recurringId, string $date): bool
    {
        $stmt = $db->prepare(
            "SELECT COUNT(*) FROM transactions
             WHERE recurring_transaction_id = :rid AND transaction_date = :date AND status != 'cancelled'"
        );
        $stmt->execute(['rid' => $recurringId, 'date' => $date]);
        return (int) $stmt->fetchColumn() > 0;
    }

    /**
     * Generate an array of date strings based on frequency rules.
     */
    public static function generateDates(
        string $frequency,
        ?int $dayOfWeek,
        ?int $dayOfMonth,
        string $startDate,
        string $endDate
    ): array {
        $dates = [];
        $start = new \DateTime($startDate);
        $end = new \DateTime($endDate);

        switch ($frequency) {
            case 'weekly':
                $current = clone $start;
                $targetDay = $dayOfWeek ?? (int) $current->format('w');
                $currentDay = (int) $current->format('w');
                $diff = ($targetDay - $currentDay + 7) % 7;
                if ($diff > 0) {
                    $current->modify("+{$diff} days");
                }
                while ($current <= $end) {
                    if ($current >= $start) {
                        $dates[] = $current->format('Y-m-d');
                    }
                    $current->modify('+7 days');
                }
                break;

            case 'biweekly':
                $current = clone $start;
                $targetDay = $dayOfWeek ?? (int) $current->format('w');
                $currentDay = (int) $current->format('w');
                $diff = ($targetDay - $currentDay + 7) % 7;
                if ($diff > 0) {
                    $current->modify("+{$diff} days");
                }
                while ($current <= $end) {
                    if ($current >= $start) {
                        $dates[] = $current->format('Y-m-d');
                    }
                    $current->modify('+14 days');
                }
                break;

            case 'monthly':
                $targetDay = $dayOfMonth ?? (int) $start->format('j');
                $year = (int) $start->format('Y');
                $month = (int) $start->format('m');

                if ((int) $start->format('j') > $targetDay) {
                    $month++;
                    if ($month > 12) {
                        $month = 1;
                        $year++;
                    }
                }

                while (true) {
                    $daysInMonth = (int) (new \DateTime("{$year}-{$month}-01"))->format('t');
                    $day = min($targetDay, $daysInMonth);
                    $current = new \DateTime("{$year}-{$month}-{$day}");

                    if ($current > $end) {
                        break;
                    }
                    if ($current >= $start) {
                        $dates[] = $current->format('Y-m-d');
                    }

                    $month++;
                    if ($month > 12) {
                        $month = 1;
                        $year++;
                    }
                }
                break;
        }

        return $dates;
    }
}
