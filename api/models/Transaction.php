<?php

class Transaction
{
    private static array $validTypes = ['credit', 'debit'];
    private static array $validCategories = ['allowance', 'chore', 'gift', 'spending', 'savings_in', 'savings_out', 'adjustment', 'request'];
    private static array $validStatuses = ['future', 'pending', 'requested', 'verified', 'cancelled'];

    public static function getByKid(PDO $db, int $kidId, array $filters = []): array
    {
        $where = ['t.kid_id = :kid_id'];
        $params = ['kid_id' => $kidId];

        if (!empty($filters['type'])) {
            $where[] = 't.type = :type';
            $params['type'] = $filters['type'];
        }

        if (!empty($filters['category'])) {
            $where[] = 't.category = :category';
            $params['category'] = $filters['category'];
        }

        if (!empty($filters['status'])) {
            $where[] = 't.status = :status';
            $params['status'] = $filters['status'];
        }

        if (!empty($filters['from'])) {
            $where[] = 't.transaction_date >= :from_date';
            $params['from_date'] = $filters['from'];
        }

        if (!empty($filters['to'])) {
            $where[] = 't.transaction_date <= :to_date';
            $params['to_date'] = $filters['to'];
        }

        // Exclude cancelled by default unless explicitly requested
        if (empty($filters['status']) && empty($filters['include_cancelled'])) {
            $where[] = "t.status != 'cancelled'";
        }

        $whereSql = implode(' AND ', $where);

        // Count total
        $countStmt = $db->prepare("SELECT COUNT(*) FROM transactions t WHERE {$whereSql}");
        $countStmt->execute($params);
        $total = (int) $countStmt->fetchColumn();

        // Pagination
        $page = max(1, (int) ($filters['page'] ?? 1));
        $perPage = min(100, max(1, (int) ($filters['per_page'] ?? 25)));
        $offset = ($page - 1) * $perPage;

        $stmt = $db->prepare(
            "SELECT t.* FROM transactions t
             WHERE {$whereSql}
             ORDER BY t.transaction_date DESC, t.id DESC
             LIMIT :limit OFFSET :offset"
        );

        foreach ($params as $key => $value) {
            $stmt->bindValue($key, $value);
        }
        $stmt->bindValue('limit', $perPage, PDO::PARAM_INT);
        $stmt->bindValue('offset', $offset, PDO::PARAM_INT);
        $stmt->execute();

        $transactions = $stmt->fetchAll();

        // Compute ending balance per unique date
        $dates = array_unique(array_column($transactions, 'transaction_date'));
        $dateBalances = [];
        foreach ($dates as $date) {
            $balStmt = $db->prepare(
                "SELECT COALESCE(SUM(CASE WHEN type = 'credit' THEN amount ELSE -amount END), 0)
                 FROM transactions WHERE kid_id = :kid_id AND status IN ('verified', 'pending') AND transaction_date <= :date"
            );
            $balStmt->execute(['kid_id' => $kidId, 'date' => $date]);
            $dateBalances[$date] = (float) $balStmt->fetchColumn();
        }

        return [
            'transactions'  => $transactions,
            'date_balances' => $dateBalances,
            'pagination' => [
                'page'        => $page,
                'per_page'    => $perPage,
                'total'       => $total,
                'total_pages' => (int) ceil($total / $perPage),
            ],
        ];
    }

    public static function getById(PDO $db, int $id): array|false
    {
        $stmt = $db->prepare('SELECT * FROM transactions WHERE id = :id');
        $stmt->execute(['id' => $id]);
        return $stmt->fetch();
    }

    public static function create(
        PDO $db,
        int $kidId,
        string $type,
        string $category,
        float $amount,
        string $description = '',
        ?string $transactionDate = null,
        string $status = 'verified',
        ?int $recurringTransactionId = null
    ): int {
        if (!in_array($type, self::$validTypes)) {
            throw new InvalidArgumentException('Invalid transaction type');
        }
        if ($category !== '' && !in_array($category, self::$validCategories)) {
            throw new InvalidArgumentException('Invalid category');
        }
        if (!in_array($status, self::$validStatuses)) {
            throw new InvalidArgumentException('Invalid status');
        }

        $stmt = $db->prepare(
            'INSERT INTO transactions (kid_id, type, category, amount, description, transaction_date, status, recurring_transaction_id, created_at)
             VALUES (:kid_id, :type, :category, :amount, :description, :transaction_date, :status, :recurring_transaction_id, :created_at)'
        );
        $now = date('Y-m-d H:i:s');
        $stmt->execute([
            'kid_id'                   => $kidId,
            'type'                     => $type,
            'category'                 => $category,
            'amount'                   => abs($amount),
            'description'              => $description,
            'transaction_date'         => $transactionDate ?? date('Y-m-d'),
            'status'                   => $status,
            'recurring_transaction_id' => $recurringTransactionId,
            'created_at'               => $now,
        ]);
        return (int) $db->lastInsertId();
    }

    public static function update(PDO $db, int $id, string $type, string $category, float $amount, string $description, string $transactionDate, ?string $status = null): void
    {
        if (!in_array($type, self::$validTypes)) {
            throw new InvalidArgumentException('Invalid transaction type');
        }
        if ($category !== '' && !in_array($category, self::$validCategories)) {
            throw new InvalidArgumentException('Invalid category');
        }

        $sql = 'UPDATE transactions SET type = :type, category = :category, amount = :amount,
                 description = :description, transaction_date = :transaction_date';
        $params = [
            'type'             => $type,
            'category'         => $category,
            'amount'           => abs($amount),
            'description'      => $description,
            'transaction_date' => $transactionDate,
            'id'               => $id,
        ];

        if ($status !== null) {
            if (!in_array($status, self::$validStatuses)) {
                throw new InvalidArgumentException('Invalid status');
            }
            $sql .= ', status = :status';
            $params['status'] = $status;
        }

        $sql .= ' WHERE id = :id';
        $stmt = $db->prepare($sql);
        $stmt->execute($params);
    }

    public static function delete(PDO $db, int $id): void
    {
        $stmt = $db->prepare('DELETE FROM transactions WHERE id = :id');
        $stmt->execute(['id' => $id]);
    }

    public static function verify(PDO $db, int $id): void
    {
        $stmt = $db->prepare("UPDATE transactions SET status = 'verified' WHERE id = :id AND status IN ('pending', 'requested')");
        $stmt->execute(['id' => $id]);
    }

    public static function cancel(PDO $db, int $id): void
    {
        $stmt = $db->prepare("UPDATE transactions SET status = 'cancelled' WHERE id = :id AND status IN ('pending', 'requested', 'future')");
        $stmt->execute(['id' => $id]);
    }

    public static function verifyAllPending(PDO $db, int $kidId): int
    {
        $stmt = $db->prepare("UPDATE transactions SET status = 'verified' WHERE kid_id = :kid_id AND status IN ('pending', 'requested')");
        $stmt->execute(['kid_id' => $kidId]);
        return $stmt->rowCount();
    }

    public static function getPendingCount(PDO $db, int $kidId): int
    {
        $stmt = $db->prepare("SELECT COUNT(*) FROM transactions WHERE kid_id = :kid_id AND status IN ('pending', 'requested')");
        $stmt->execute(['kid_id' => $kidId]);
        return (int) $stmt->fetchColumn();
    }

    public static function getRecent(PDO $db, array $kidIds, int $limit = 10): array
    {
        if (empty($kidIds)) {
            return [];
        }

        $placeholders = implode(',', array_fill(0, count($kidIds), '?'));
        $stmt = $db->prepare(
            "SELECT t.*, k.name as kid_name FROM transactions t
             JOIN kids k ON k.id = t.kid_id
             WHERE t.kid_id IN ({$placeholders}) AND t.status != 'cancelled' AND t.transaction_date <= CURRENT_DATE
             ORDER BY t.transaction_date DESC, t.id DESC
             LIMIT ?"
        );

        $params = array_values($kidIds);
        $params[] = $limit;
        $stmt->execute($params);
        return $stmt->fetchAll();
    }
}
