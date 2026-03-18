<?php

class User
{
    public static function findByEmail(PDO $db, string $email): array|false
    {
        $stmt = $db->prepare('SELECT * FROM users WHERE email = :email');
        $stmt->execute(['email' => $email]);
        return $stmt->fetch();
    }

    public static function findById(PDO $db, int $id): array|false
    {
        $stmt = $db->prepare('SELECT id, email, display_name, family_display_name, is_admin, role, parent_id, kid_id, household_id, created_at, updated_at FROM users WHERE id = :id');
        $stmt->execute(['id' => $id]);
        return $stmt->fetch();
    }

    public static function create(PDO $db, string $email, string $password, string $displayName): int
    {
        // Create a household for this new parent
        $householdId = Household::create($db, $displayName . "'s Family");

        $hash = password_hash($password, PASSWORD_DEFAULT);
        $stmt = $db->prepare(
            'INSERT INTO users (email, password_hash, display_name, role, household_id, created_at, updated_at)
             VALUES (:email, :password_hash, :display_name, :role, :household_id, :created_at, :updated_at)'
        );
        $now = date('Y-m-d H:i:s');
        $stmt->execute([
            'email'         => $email,
            'password_hash' => $hash,
            'display_name'  => $displayName,
            'role'          => 'parent',
            'household_id'  => $householdId,
            'created_at'    => $now,
            'updated_at'    => $now,
        ]);
        return (int) $db->lastInsertId();
    }

    public static function createKidUser(PDO $db, int $parentId, int $kidId, string $email, string $password, string $displayName, int $householdId): int
    {
        $hash = password_hash($password, PASSWORD_DEFAULT);
        $stmt = $db->prepare(
            'INSERT INTO users (email, password_hash, display_name, role, parent_id, kid_id, household_id, created_at, updated_at)
             VALUES (:email, :password_hash, :display_name, :role, :parent_id, :kid_id, :household_id, :created_at, :updated_at)'
        );
        $now = date('Y-m-d H:i:s');
        $stmt->execute([
            'email'         => $email,
            'password_hash' => $hash,
            'display_name'  => $displayName,
            'role'          => 'kid',
            'parent_id'     => $parentId,
            'kid_id'        => $kidId,
            'household_id'  => $householdId,
            'created_at'    => $now,
            'updated_at'    => $now,
        ]);
        return (int) $db->lastInsertId();
    }

    public static function getKidUsers(PDO $db, int $householdId): array
    {
        $stmt = $db->prepare(
            'SELECT u.id, u.email, u.display_name, u.kid_id, k.name as kid_name
             FROM users u
             LEFT JOIN kids k ON k.id = u.kid_id
             WHERE u.household_id = :household_id AND u.role = :role'
        );
        $stmt->execute(['household_id' => $householdId, 'role' => 'kid']);
        return $stmt->fetchAll();
    }

    public static function findByKidId(PDO $db, int $kidId): array|false
    {
        $stmt = $db->prepare('SELECT id, email, display_name, kid_id FROM users WHERE kid_id = :kid_id AND role = :role');
        $stmt->execute(['kid_id' => $kidId, 'role' => 'kid']);
        return $stmt->fetch();
    }

    public static function updateProfile(PDO $db, int $id, array $data): void
    {
        $fields = [];
        $params = ['id' => $id, 'updated_at' => date('Y-m-d H:i:s')];

        if (array_key_exists('display_name', $data)) {
            $fields[] = 'display_name = :display_name';
            $params['display_name'] = $data['display_name'];
        }
        if (array_key_exists('family_display_name', $data)) {
            $fields[] = 'family_display_name = :family_display_name';
            $params['family_display_name'] = $data['family_display_name'];
        }

        if (empty($fields)) return;

        $fields[] = 'updated_at = :updated_at';
        $sql = 'UPDATE users SET ' . implode(', ', $fields) . ' WHERE id = :id';
        $stmt = $db->prepare($sql);
        $stmt->execute($params);
    }

    public static function updateEmail(PDO $db, int $id, string $email): void
    {
        $stmt = $db->prepare('UPDATE users SET email = :email, updated_at = :updated_at WHERE id = :id');
        $stmt->execute([
            'email'      => $email,
            'updated_at' => date('Y-m-d H:i:s'),
            'id'         => $id,
        ]);
    }

    public static function updatePassword(PDO $db, int $id, string $password): void
    {
        $hash = password_hash($password, PASSWORD_DEFAULT);
        $stmt = $db->prepare('UPDATE users SET password_hash = :password_hash, updated_at = :updated_at WHERE id = :id');
        $stmt->execute([
            'password_hash' => $hash,
            'updated_at'    => date('Y-m-d H:i:s'),
            'id'            => $id,
        ]);
    }

    public static function deleteUser(PDO $db, int $id): void
    {
        $stmt = $db->prepare('DELETE FROM users WHERE id = :id');
        $stmt->execute(['id' => $id]);
    }
}
