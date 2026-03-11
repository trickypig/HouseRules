<?php

class SavingsGoal
{
    public static function getByKid(PDO $db, int $kidId): array
    {
        $stmt = $db->prepare('SELECT * FROM savings_goals WHERE kid_id = :kid_id ORDER BY is_completed, created_at DESC');
        $stmt->execute(['kid_id' => $kidId]);
        return $stmt->fetchAll();
    }

    public static function getById(PDO $db, int $id): array|false
    {
        $stmt = $db->prepare('SELECT * FROM savings_goals WHERE id = :id');
        $stmt->execute(['id' => $id]);
        return $stmt->fetch();
    }

    public static function create(PDO $db, int $kidId, string $name, ?float $targetAmount = null): int
    {
        $stmt = $db->prepare(
            'INSERT INTO savings_goals (kid_id, name, target_amount, created_at, updated_at)
             VALUES (:kid_id, :name, :target_amount, :created_at, :updated_at)'
        );
        $now = date('Y-m-d H:i:s');
        $stmt->execute([
            'kid_id'        => $kidId,
            'name'          => $name,
            'target_amount' => $targetAmount,
            'created_at'    => $now,
            'updated_at'    => $now,
        ]);
        return (int) $db->lastInsertId();
    }

    public static function update(PDO $db, int $id, string $name, ?float $targetAmount): void
    {
        $stmt = $db->prepare(
            'UPDATE savings_goals SET name = :name, target_amount = :target_amount, updated_at = :updated_at WHERE id = :id'
        );
        $stmt->execute([
            'name'          => $name,
            'target_amount' => $targetAmount,
            'updated_at'    => date('Y-m-d H:i:s'),
            'id'            => $id,
        ]);
    }

    public static function delete(PDO $db, int $id): void
    {
        $stmt = $db->prepare('DELETE FROM savings_goals WHERE id = :id');
        $stmt->execute(['id' => $id]);
    }

    public static function adjustAmount(PDO $db, int $id, float $delta): void
    {
        $goal = self::getById($db, $id);
        if (!$goal) {
            return;
        }

        $newAmount = max(0, (float) $goal['current_amount'] + $delta);
        $isCompleted = ($goal['target_amount'] !== null && $newAmount >= (float) $goal['target_amount']) ? 1 : 0;
        $completedAt = ($isCompleted && !$goal['is_completed']) ? date('Y-m-d H:i:s') : $goal['completed_at'];

        $stmt = $db->prepare(
            'UPDATE savings_goals SET current_amount = :current_amount, is_completed = :is_completed,
             completed_at = :completed_at, updated_at = :updated_at WHERE id = :id'
        );
        $stmt->execute([
            'current_amount' => $newAmount,
            'is_completed'   => $isCompleted,
            'completed_at'   => $completedAt,
            'updated_at'     => date('Y-m-d H:i:s'),
            'id'             => $id,
        ]);
    }
}
