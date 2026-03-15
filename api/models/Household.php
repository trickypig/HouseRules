<?php

class Household
{
    public static function getById(PDO $db, int $id): array|false
    {
        $stmt = $db->prepare('SELECT * FROM households WHERE id = :id');
        $stmt->execute(['id' => $id]);
        return $stmt->fetch();
    }

    public static function getByInviteCode(PDO $db, string $code): array|false
    {
        $stmt = $db->prepare('SELECT * FROM households WHERE invite_code = :code');
        $stmt->execute(['code' => $code]);
        return $stmt->fetch();
    }

    public static function create(PDO $db, string $name): int
    {
        $now = date('Y-m-d H:i:s');
        $inviteCode = bin2hex(random_bytes(6));
        $stmt = $db->prepare(
            'INSERT INTO households (name, invite_code, created_at, updated_at)
             VALUES (:name, :invite_code, :created_at, :updated_at)'
        );
        $stmt->execute([
            'name'        => $name,
            'invite_code' => $inviteCode,
            'created_at'  => $now,
            'updated_at'  => $now,
        ]);
        return (int) $db->lastInsertId();
    }

    public static function update(PDO $db, int $id, string $name): void
    {
        $stmt = $db->prepare(
            'UPDATE households SET name = :name, updated_at = :updated_at WHERE id = :id'
        );
        $stmt->execute([
            'name'       => $name,
            'updated_at' => date('Y-m-d H:i:s'),
            'id'         => $id,
        ]);
    }

    public static function regenerateInviteCode(PDO $db, int $id): string
    {
        $code = bin2hex(random_bytes(6));
        $stmt = $db->prepare(
            'UPDATE households SET invite_code = :code, updated_at = :updated_at WHERE id = :id'
        );
        $stmt->execute([
            'code'       => $code,
            'updated_at' => date('Y-m-d H:i:s'),
            'id'         => $id,
        ]);
        return $code;
    }

    public static function getMembers(PDO $db, int $householdId): array
    {
        $stmt = $db->prepare(
            "SELECT id, email, display_name, family_display_name, role
             FROM users WHERE household_id = :hid AND role = 'parent'
             ORDER BY created_at ASC"
        );
        $stmt->execute(['hid' => $householdId]);
        return $stmt->fetchAll();
    }
}
