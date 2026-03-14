<?php

class ShoppingList
{
    public static function getByUser(PDO $db, int $userId): array
    {
        $stmt = $db->prepare(
            'SELECT sl.*,
                    COUNT(sli.id) as item_count,
                    SUM(CASE WHEN sli.is_purchased = 0 THEN 1 ELSE 0 END) as unpurchased_count
             FROM shopping_lists sl
             LEFT JOIN shopping_list_items sli ON sli.list_id = sl.id
             WHERE sl.user_id = :user_id
             GROUP BY sl.id
             ORDER BY sl.sort_order ASC, sl.created_at ASC'
        );
        $stmt->execute(['user_id' => $userId]);
        $lists = $stmt->fetchAll();

        // Attach item description lists for each list
        foreach ($lists as &$list) {
            $itemStmt = $db->prepare(
                'SELECT description, is_purchased FROM shopping_list_items
                 WHERE list_id = :list_id ORDER BY is_purchased ASC, created_at DESC'
            );
            $itemStmt->execute(['list_id' => $list['id']]);
            $items = $itemStmt->fetchAll();

            $list['unpurchased_items'] = [];
            $list['purchased_items'] = [];
            foreach ($items as $item) {
                if ($item['is_purchased']) {
                    $list['purchased_items'][] = $item['description'];
                } else {
                    $list['unpurchased_items'][] = $item['description'];
                }
            }
        }

        return $lists;
    }

    public static function getById(PDO $db, int $id): array|false
    {
        $stmt = $db->prepare('SELECT * FROM shopping_lists WHERE id = :id');
        $stmt->execute(['id' => $id]);
        return $stmt->fetch();
    }

    public static function create(PDO $db, int $userId, string $name): int
    {
        $stmt = $db->prepare(
            'INSERT INTO shopping_lists (user_id, name, sort_order, created_at, updated_at)
             VALUES (:user_id, :name, 0, :created_at, :updated_at)'
        );
        $now = date('Y-m-d H:i:s');
        $stmt->execute([
            'user_id'    => $userId,
            'name'       => $name,
            'created_at' => $now,
            'updated_at' => $now,
        ]);
        return (int) $db->lastInsertId();
    }

    public static function update(PDO $db, int $id, string $name): void
    {
        $stmt = $db->prepare(
            'UPDATE shopping_lists SET name = :name, updated_at = :updated_at WHERE id = :id'
        );
        $stmt->execute([
            'name'       => $name,
            'updated_at' => date('Y-m-d H:i:s'),
            'id'         => $id,
        ]);
    }

    public static function delete(PDO $db, int $id): void
    {
        $stmt = $db->prepare('DELETE FROM shopping_lists WHERE id = :id');
        $stmt->execute(['id' => $id]);
    }
}
