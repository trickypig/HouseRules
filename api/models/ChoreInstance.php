<?php

class ChoreInstance
{
    public static function getByUser(PDO $db, int $userId, array $filters = []): array
    {
        $where = [
            '(k.user_id = :user_id OR (ci.kid_id IS NULL AND ct.user_id = :user_id2))'
        ];
        $params = ['user_id' => $userId, 'user_id2' => $userId];

        if (!empty($filters['status'])) {
            $where[] = 'ci.status = :status';
            $params['status'] = $filters['status'];
        }

        if (!empty($filters['kid_id'])) {
            $where[] = '(ci.kid_id = :kid_id OR ci.claimed_by_kid_id = :kid_id2)';
            $params['kid_id'] = $filters['kid_id'];
            $params['kid_id2'] = $filters['kid_id'];
        }

        if (!empty($filters['from'])) {
            $where[] = 'ci.due_date >= :from_date';
            $params['from_date'] = $filters['from'];
        }

        if (!empty($filters['to'])) {
            $where[] = 'ci.due_date <= :to_date';
            $params['to_date'] = $filters['to'];
        }

        $whereSql = implode(' AND ', $where);

        $stmt = $db->prepare(
            "SELECT ci.*, k.name as kid_name, ck.name as claimed_by_name
             FROM chore_instances ci
             LEFT JOIN kids k ON k.id = ci.kid_id
             LEFT JOIN kids ck ON ck.id = ci.claimed_by_kid_id
             LEFT JOIN chore_templates ct ON ct.id = ci.chore_template_id
             WHERE {$whereSql}
             ORDER BY ci.due_date ASC, ci.id ASC"
        );
        $stmt->execute($params);
        return $stmt->fetchAll();
    }

    public static function getByKid(PDO $db, int $kidId, array $filters = []): array
    {
        $where = ['(ci.kid_id = :kid_id OR ci.claimed_by_kid_id = :kid_id2)'];
        $params = ['kid_id' => $kidId, 'kid_id2' => $kidId];

        if (!empty($filters['status'])) {
            $where[] = 'ci.status = :status';
            $params['status'] = $filters['status'];
        }

        $whereSql = implode(' AND ', $where);

        $stmt = $db->prepare(
            "SELECT ci.*, k.name as kid_name, ck.name as claimed_by_name
             FROM chore_instances ci
             LEFT JOIN kids k ON k.id = ci.kid_id
             LEFT JOIN kids ck ON ck.id = ci.claimed_by_kid_id
             WHERE {$whereSql}
             ORDER BY ci.due_date ASC, ci.id ASC"
        );
        $stmt->execute($params);
        return $stmt->fetchAll();
    }

    public static function getOpenChores(PDO $db, int $userId): array
    {
        $stmt = $db->prepare(
            "SELECT ci.* FROM chore_instances ci
             JOIN chore_templates ct ON ct.id = ci.chore_template_id
             WHERE ct.user_id = :user_id
             AND ci.kid_id IS NULL AND ci.claimed_by_kid_id IS NULL
             AND ci.status = 'pending'
             ORDER BY ci.due_date ASC"
        );
        $stmt->execute(['user_id' => $userId]);
        return $stmt->fetchAll();
    }

    public static function getById(PDO $db, int $id): array|false
    {
        $stmt = $db->prepare(
            'SELECT ci.*, k.name as kid_name, ck.name as claimed_by_name
             FROM chore_instances ci
             LEFT JOIN kids k ON k.id = ci.kid_id
             LEFT JOIN kids ck ON ck.id = ci.claimed_by_kid_id
             WHERE ci.id = :id'
        );
        $stmt->execute(['id' => $id]);
        return $stmt->fetch();
    }

    public static function claim(PDO $db, int $id, int $kidId): void
    {
        $stmt = $db->prepare(
            "UPDATE chore_instances SET claimed_by_kid_id = :kid_id
             WHERE id = :id AND claimed_by_kid_id IS NULL AND status = 'pending'"
        );
        $stmt->execute(['kid_id' => $kidId, 'id' => $id]);
    }

    public static function complete(PDO $db, int $id): void
    {
        $stmt = $db->prepare(
            "UPDATE chore_instances SET status = 'completed', completed_at = :now
             WHERE id = :id AND status = 'pending'"
        );
        $stmt->execute(['now' => date('Y-m-d H:i:s'), 'id' => $id]);
    }

    public static function verify(PDO $db, int $id): ?int
    {
        $instance = self::getById($db, $id);
        if (!$instance || $instance['status'] !== 'completed') {
            return null;
        }

        $now = date('Y-m-d H:i:s');
        $transactionId = null;

        // If chore pays money and there's an effective kid, create transaction
        $effectiveKidId = $instance['kid_id'] ?? $instance['claimed_by_kid_id'];
        if ($instance['amount'] && $effectiveKidId) {
            $transactionId = Transaction::create(
                $db,
                (int) $effectiveKidId,
                'credit',
                'chore',
                (float) $instance['amount'],
                $instance['title'],
                date('Y-m-d'),
                'verified'
            );
        }

        $stmt = $db->prepare(
            "UPDATE chore_instances SET status = 'verified', verified_at = :now, transaction_id = :tx_id
             WHERE id = :id"
        );
        $stmt->execute(['now' => $now, 'tx_id' => $transactionId, 'id' => $id]);

        return $transactionId;
    }

    public static function reject(PDO $db, int $id): void
    {
        $stmt = $db->prepare(
            "UPDATE chore_instances SET status = 'pending', completed_at = NULL
             WHERE id = :id AND status = 'completed'"
        );
        $stmt->execute(['id' => $id]);
    }

    public static function createOneTime(
        PDO $db,
        ?int $kidId,
        string $title,
        string $description,
        ?float $amount,
        string $dueDate,
        ?int $templateId = null
    ): int {
        $stmt = $db->prepare(
            'INSERT INTO chore_instances (chore_template_id, kid_id, title, description, amount, due_date, status, created_at)
             VALUES (:template_id, :kid_id, :title, :description, :amount, :due_date, :status, :created_at)'
        );

        $today = date('Y-m-d');
        $status = ($dueDate > $today) ? 'pending' : 'pending';

        $stmt->execute([
            'template_id' => $templateId,
            'kid_id'      => $kidId,
            'title'       => $title,
            'description' => $description,
            'amount'      => $amount,
            'due_date'    => $dueDate,
            'status'      => $status,
            'created_at'  => date('Y-m-d H:i:s'),
        ]);
        return (int) $db->lastInsertId();
    }
}
