<?php

class ChoreTemplate
{
    private static array $validFrequencies = ['daily', 'weekly', 'biweekly', 'monthly'];

    public static function getByUser(PDO $db, int $userId): array
    {
        $stmt = $db->prepare(
            'SELECT ct.*, k.name as assigned_kid_name
             FROM chore_templates ct
             LEFT JOIN kids k ON k.id = ct.assigned_kid_id
             WHERE ct.user_id = :user_id
             ORDER BY ct.created_at DESC'
        );
        $stmt->execute(['user_id' => $userId]);
        return $stmt->fetchAll();
    }

    public static function getById(PDO $db, int $id): array|false
    {
        $stmt = $db->prepare(
            'SELECT ct.*, k.name as assigned_kid_name
             FROM chore_templates ct
             LEFT JOIN kids k ON k.id = ct.assigned_kid_id
             WHERE ct.id = :id'
        );
        $stmt->execute(['id' => $id]);
        return $stmt->fetch();
    }

    public static function create(
        PDO $db,
        int $userId,
        string $title,
        string $description,
        ?float $amount,
        ?string $frequency,
        ?int $dayOfWeek,
        ?int $dayOfMonth,
        ?int $assignedKidId,
        string $startDate,
        ?string $endDate
    ): int {
        if ($frequency !== null && !in_array($frequency, self::$validFrequencies)) {
            throw new InvalidArgumentException('Invalid frequency');
        }

        $stmt = $db->prepare(
            'INSERT INTO chore_templates (user_id, title, description, amount, frequency, day_of_week, day_of_month, assigned_kid_id, start_date, end_date, is_active, created_at, updated_at)
             VALUES (:user_id, :title, :description, :amount, :frequency, :day_of_week, :day_of_month, :assigned_kid_id, :start_date, :end_date, 1, :created_at, :updated_at)'
        );
        $now = date('Y-m-d H:i:s');
        $stmt->execute([
            'user_id'         => $userId,
            'title'           => $title,
            'description'     => $description,
            'amount'          => $amount,
            'frequency'       => $frequency,
            'day_of_week'     => $dayOfWeek,
            'day_of_month'    => $dayOfMonth,
            'assigned_kid_id' => $assignedKidId,
            'start_date'      => $startDate,
            'end_date'        => $endDate,
            'created_at'      => $now,
            'updated_at'      => $now,
        ]);
        return (int) $db->lastInsertId();
    }

    public static function update(PDO $db, int $id, array $data): void
    {
        if (isset($data['frequency']) && $data['frequency'] !== null && !in_array($data['frequency'], self::$validFrequencies)) {
            throw new InvalidArgumentException('Invalid frequency');
        }

        $fields = [];
        $params = ['id' => $id];

        foreach (['title', 'description', 'amount', 'frequency', 'day_of_week', 'day_of_month', 'assigned_kid_id', 'start_date', 'end_date', 'is_active'] as $field) {
            if (array_key_exists($field, $data)) {
                $fields[] = "{$field} = :{$field}";
                $params[$field] = $data[$field];
            }
        }

        if (empty($fields)) {
            return;
        }

        $fields[] = 'updated_at = :updated_at';
        $params['updated_at'] = date('Y-m-d H:i:s');

        $fieldsSql = implode(', ', $fields);
        $stmt = $db->prepare("UPDATE chore_templates SET {$fieldsSql} WHERE id = :id");
        $stmt->execute($params);
    }

    public static function delete(PDO $db, int $id): void
    {
        // Delete future instances
        $stmt = $db->prepare("DELETE FROM chore_instances WHERE chore_template_id = :id AND status IN ('pending', 'future')");
        $stmt->execute(['id' => $id]);

        $stmt = $db->prepare('DELETE FROM chore_templates WHERE id = :id');
        $stmt->execute(['id' => $id]);
    }

    /**
     * Generate chore instances for a user's templates.
     * Similar to RecurringTransaction::generateForKid().
     */
    public static function generateForUser(PDO $db, int $userId): int
    {
        $today = date('Y-m-d');

        // Mark missed: past due_date + still pending
        $stmt = $db->prepare(
            "UPDATE chore_instances SET status = 'missed'
             WHERE chore_template_id IN (SELECT id FROM chore_templates WHERE user_id = :user_id)
             AND status = 'pending' AND due_date < :today"
        );
        $stmt->execute(['user_id' => $userId, 'today' => $today]);

        $templates = self::getActiveTemplates($db, $userId);
        $generated = 0;

        foreach ($templates as $tpl) {
            // Deactivate expired templates
            if ($tpl['end_date'] && $tpl['end_date'] < $today) {
                $db->prepare('UPDATE chore_templates SET is_active = 0, updated_at = :now WHERE id = :id')
                    ->execute(['now' => date('Y-m-d H:i:s'), 'id' => $tpl['id']]);
                continue;
            }

            if ($tpl['frequency'] === null) {
                // One-time chore: single instance at start_date
                if (!self::instanceExistsForDate($db, (int) $tpl['id'], $tpl['start_date'])) {
                    ChoreInstance::createOneTime(
                        $db,
                        $tpl['assigned_kid_id'] ? (int) $tpl['assigned_kid_id'] : null,
                        $tpl['title'],
                        $tpl['description'],
                        $tpl['amount'] !== null ? (float) $tpl['amount'] : null,
                        $tpl['start_date'],
                        (int) $tpl['id']
                    );
                    $generated++;
                }
                // Deactivate one-time template after generating
                $db->prepare('UPDATE chore_templates SET is_active = 0, updated_at = :now WHERE id = :id')
                    ->execute(['now' => date('Y-m-d H:i:s'), 'id' => $tpl['id']]);
                continue;
            }

            // For recurring: generate up through today + the next upcoming date only.
            // Use a far-out end to find the next future date, then cap there.
            $farEnd = date('Y-m-d', strtotime('+1 year'));
            $effectiveEnd = $tpl['end_date'] ? min($tpl['end_date'], $farEnd) : $farEnd;

            if ($tpl['frequency'] === 'daily') {
                $allDates = self::generateDailyDates($tpl['start_date'], $effectiveEnd);
            } else {
                $allDates = RecurringTransaction::generateDates(
                    $tpl['frequency'],
                    $tpl['day_of_week'] !== null ? (int) $tpl['day_of_week'] : null,
                    $tpl['day_of_month'] !== null ? (int) $tpl['day_of_month'] : null,
                    $tpl['start_date'],
                    $effectiveEnd
                );
            }

            // Keep dates up through today, plus the first date after today
            $dates = [];
            $foundNext = false;
            foreach ($allDates as $date) {
                if ($date <= $today) {
                    $dates[] = $date;
                } elseif (!$foundNext) {
                    $dates[] = $date;
                    $foundNext = true;
                } else {
                    break;
                }
            }

            foreach ($dates as $date) {
                if (self::instanceExistsForDate($db, (int) $tpl['id'], $date)) {
                    continue;
                }

                ChoreInstance::createOneTime(
                    $db,
                    $tpl['assigned_kid_id'] ? (int) $tpl['assigned_kid_id'] : null,
                    $tpl['title'],
                    $tpl['description'],
                    $tpl['amount'] !== null ? (float) $tpl['amount'] : null,
                    $date,
                    (int) $tpl['id']
                );
                $generated++;
            }
        }

        return $generated;
    }

    private static function getActiveTemplates(PDO $db, int $userId): array
    {
        $stmt = $db->prepare('SELECT * FROM chore_templates WHERE user_id = :user_id AND is_active = 1');
        $stmt->execute(['user_id' => $userId]);
        return $stmt->fetchAll();
    }

    private static function instanceExistsForDate(PDO $db, int $templateId, string $date): bool
    {
        $stmt = $db->prepare(
            "SELECT COUNT(*) FROM chore_instances
             WHERE chore_template_id = :tid AND due_date = :date"
        );
        $stmt->execute(['tid' => $templateId, 'date' => $date]);
        return (int) $stmt->fetchColumn() > 0;
    }

    private static function generateDailyDates(string $startDate, string $endDate): array
    {
        $dates = [];
        $current = new \DateTime($startDate);
        $end = new \DateTime($endDate);

        while ($current <= $end) {
            $dates[] = $current->format('Y-m-d');
            $current->modify('+1 day');
        }

        return $dates;
    }
}
