<?php

class Kid
{
    public static function getByUser(PDO $db, int $userId): array
    {
        $stmt = $db->prepare('SELECT * FROM kids WHERE user_id = :user_id ORDER BY sort_order, name');
        $stmt->execute(['user_id' => $userId]);
        return $stmt->fetchAll();
    }

    public static function getById(PDO $db, int $id): array|false
    {
        $stmt = $db->prepare('SELECT * FROM kids WHERE id = :id');
        $stmt->execute(['id' => $id]);
        return $stmt->fetch();
    }

    public static function create(PDO $db, int $userId, string $name, string $color = '#4A90D9', string $avatar = ''): int
    {
        $stmt = $db->prepare(
            'INSERT INTO kids (user_id, name, color, avatar, created_at, updated_at)
             VALUES (:user_id, :name, :color, :avatar, :created_at, :updated_at)'
        );
        $now = date('Y-m-d H:i:s');
        $stmt->execute([
            'user_id'    => $userId,
            'name'       => $name,
            'color'      => $color,
            'avatar'     => $avatar,
            'created_at' => $now,
            'updated_at' => $now,
        ]);
        return (int) $db->lastInsertId();
    }

    public static function update(PDO $db, int $id, string $name, string $color, string $avatar): void
    {
        $stmt = $db->prepare(
            'UPDATE kids SET name = :name, color = :color, avatar = :avatar, updated_at = :updated_at WHERE id = :id'
        );
        $stmt->execute([
            'name'       => $name,
            'color'      => $color,
            'avatar'     => $avatar,
            'updated_at' => date('Y-m-d H:i:s'),
            'id'         => $id,
        ]);
    }

    public static function delete(PDO $db, int $id): void
    {
        $stmt = $db->prepare('DELETE FROM kids WHERE id = :id');
        $stmt->execute(['id' => $id]);
    }

    public static function getBalance(PDO $db, int $kidId): float
    {
        $stmt = $db->prepare(
            "SELECT COALESCE(SUM(CASE WHEN type = 'credit' THEN amount ELSE -amount END), 0) as balance
             FROM transactions WHERE kid_id = :kid_id"
        );
        $stmt->execute(['kid_id' => $kidId]);
        return (float) $stmt->fetchColumn();
    }
}
