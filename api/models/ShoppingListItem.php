<?php

class ShoppingListItem
{
    public static function getByList(PDO $db, int $listId): array
    {
        $oneWeekAgo = date('Y-m-d H:i:s', strtotime('-7 days'));
        $stmt = $db->prepare(
            'SELECT sli.*, u.display_name as added_by_name
             FROM shopping_list_items sli
             LEFT JOIN users u ON u.id = sli.added_by_user_id
             WHERE sli.list_id = :list_id
             AND (sli.is_purchased = 0 OR sli.purchased_at IS NULL OR sli.purchased_at >= :cutoff)
             ORDER BY sli.is_purchased ASC, sli.created_at DESC'
        );
        $stmt->execute(['list_id' => $listId, 'cutoff' => $oneWeekAgo]);
        return $stmt->fetchAll();
    }

    public static function getById(PDO $db, int $id): array|false
    {
        $stmt = $db->prepare(
            'SELECT sli.*, u.display_name as added_by_name
             FROM shopping_list_items sli
             LEFT JOIN users u ON u.id = sli.added_by_user_id
             WHERE sli.id = :id'
        );
        $stmt->execute(['id' => $id]);
        return $stmt->fetch();
    }

    public static function create(
        PDO $db,
        int $listId,
        string $description,
        int $addedByUserId,
        bool $isRequest = false,
        string $quantity = '',
        string $notes = ''
    ): int {
        $stmt = $db->prepare(
            'INSERT INTO shopping_list_items (list_id, description, is_purchased, added_by_user_id, is_request, quantity, notes, created_at)
             VALUES (:list_id, :description, 0, :added_by_user_id, :is_request, :quantity, :notes, :created_at)'
        );
        $stmt->execute([
            'list_id'          => $listId,
            'description'      => $description,
            'added_by_user_id' => $addedByUserId,
            'is_request'       => $isRequest ? 1 : 0,
            'quantity'         => $quantity,
            'notes'            => $notes,
            'created_at'       => date('Y-m-d H:i:s'),
        ]);
        return (int) $db->lastInsertId();
    }

    public static function update(PDO $db, int $id, array $data): void
    {
        $fields = [];
        $params = ['id' => $id];

        foreach (['description', 'quantity', 'notes'] as $field) {
            if (array_key_exists($field, $data)) {
                $fields[] = "{$field} = :{$field}";
                $params[$field] = $data[$field];
            }
        }

        if (empty($fields)) {
            return;
        }

        $fieldsSql = implode(', ', $fields);
        $stmt = $db->prepare("UPDATE shopping_list_items SET {$fieldsSql} WHERE id = :id");
        $stmt->execute($params);
    }

    public static function togglePurchased(PDO $db, int $id): void
    {
        $item = self::getById($db, $id);
        if (!$item) {
            return;
        }

        $newValue = $item['is_purchased'] ? 0 : 1;
        $purchasedAt = $newValue ? date('Y-m-d H:i:s') : null;

        $stmt = $db->prepare(
            'UPDATE shopping_list_items SET is_purchased = :val, purchased_at = :purchased_at WHERE id = :id'
        );
        $stmt->execute(['val' => $newValue, 'purchased_at' => $purchasedAt, 'id' => $id]);
    }

    public static function delete(PDO $db, int $id): void
    {
        $stmt = $db->prepare('DELETE FROM shopping_list_items WHERE id = :id');
        $stmt->execute(['id' => $id]);
    }

    public static function autocomplete(PDO $db, int $userId, string $query): array
    {
        $stmt = $db->prepare(
            "SELECT DISTINCT sli.description
             FROM shopping_list_items sli
             JOIN shopping_lists sl ON sl.id = sli.list_id
             WHERE sl.user_id = :user_id AND sli.description LIKE :query
             LIMIT 10"
        );
        $stmt->execute([
            'user_id' => $userId,
            'query'   => '%' . $query . '%',
        ]);
        return array_column($stmt->fetchAll(), 'description');
    }
}
