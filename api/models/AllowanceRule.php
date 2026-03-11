<?php

class AllowanceRule
{
    public static function getByKid(PDO $db, int $kidId): array|false
    {
        $stmt = $db->prepare('SELECT * FROM allowance_rules WHERE kid_id = :kid_id');
        $stmt->execute(['kid_id' => $kidId]);
        return $stmt->fetch();
    }

    public static function createOrUpdate(
        PDO $db,
        int $kidId,
        float $amount,
        string $frequency,
        ?int $dayOfWeek = null,
        ?int $dayOfMonth = null
    ): int {
        $existing = self::getByKid($db, $kidId);
        $now = date('Y-m-d H:i:s');
        $nextDue = self::calculateNextDue($frequency, $dayOfWeek, $dayOfMonth);

        if ($existing) {
            $stmt = $db->prepare(
                'UPDATE allowance_rules SET amount = :amount, frequency = :frequency,
                 day_of_week = :day_of_week, day_of_month = :day_of_month, next_due = :next_due,
                 is_active = 1, updated_at = :updated_at WHERE kid_id = :kid_id'
            );
            $stmt->execute([
                'amount'       => $amount,
                'frequency'    => $frequency,
                'day_of_week'  => $dayOfWeek,
                'day_of_month' => $dayOfMonth,
                'next_due'     => $nextDue,
                'updated_at'   => $now,
                'kid_id'       => $kidId,
            ]);
            return $existing['id'];
        }

        $stmt = $db->prepare(
            'INSERT INTO allowance_rules (kid_id, amount, frequency, day_of_week, day_of_month, next_due, is_active, created_at, updated_at)
             VALUES (:kid_id, :amount, :frequency, :day_of_week, :day_of_month, :next_due, 1, :created_at, :updated_at)'
        );
        $stmt->execute([
            'kid_id'       => $kidId,
            'amount'       => $amount,
            'frequency'    => $frequency,
            'day_of_week'  => $dayOfWeek,
            'day_of_month' => $dayOfMonth,
            'next_due'     => $nextDue,
            'created_at'   => $now,
            'updated_at'   => $now,
        ]);
        return (int) $db->lastInsertId();
    }

    public static function delete(PDO $db, int $kidId): void
    {
        $stmt = $db->prepare('DELETE FROM allowance_rules WHERE kid_id = :kid_id');
        $stmt->execute(['kid_id' => $kidId]);
    }

    public static function getDueRules(PDO $db, string $today): array
    {
        $stmt = $db->prepare(
            'SELECT ar.*, k.user_id, k.name as kid_name FROM allowance_rules ar
             JOIN kids k ON k.id = ar.kid_id
             WHERE ar.is_active = 1 AND ar.next_due <= :today'
        );
        $stmt->execute(['today' => $today]);
        return $stmt->fetchAll();
    }

    public static function advanceNextDue(PDO $db, int $id, string $frequency, ?int $dayOfWeek, ?int $dayOfMonth): void
    {
        $nextDue = self::calculateNextDue($frequency, $dayOfWeek, $dayOfMonth);
        $stmt = $db->prepare('UPDATE allowance_rules SET next_due = :next_due, updated_at = :updated_at WHERE id = :id');
        $stmt->execute([
            'next_due'   => $nextDue,
            'updated_at' => date('Y-m-d H:i:s'),
            'id'         => $id,
        ]);
    }

    private static function calculateNextDue(string $frequency, ?int $dayOfWeek, ?int $dayOfMonth): string
    {
        $today = new \DateTime();

        switch ($frequency) {
            case 'weekly':
                $targetDay = $dayOfWeek ?? 0; // 0 = Sunday
                $currentDay = (int) $today->format('w');
                $daysUntil = ($targetDay - $currentDay + 7) % 7;
                if ($daysUntil === 0) {
                    $daysUntil = 7;
                }
                $today->modify("+{$daysUntil} days");
                break;

            case 'biweekly':
                $targetDay = $dayOfWeek ?? 0;
                $currentDay = (int) $today->format('w');
                $daysUntil = ($targetDay - $currentDay + 7) % 7;
                if ($daysUntil === 0) {
                    $daysUntil = 14;
                }
                $today->modify("+{$daysUntil} days");
                break;

            case 'monthly':
                $targetDay = $dayOfMonth ?? 1;
                $currentDay = (int) $today->format('j');
                if ($currentDay >= $targetDay) {
                    $today->modify('first day of next month');
                }
                $lastDay = (int) $today->format('t');
                $day = min($targetDay, $lastDay);
                $today->setDate((int) $today->format('Y'), (int) $today->format('m'), $day);
                break;
        }

        return $today->format('Y-m-d');
    }
}
