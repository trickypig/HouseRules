<?php

class SavingsGoal
{
    /**
     * Get goals for a kid with current_amount computed from balance.
     * Balance is allocated across incomplete goals in sort_order priority.
     */
    public static function getByKid(PDO $db, int $kidId): array
    {
        $stmt = $db->prepare('SELECT * FROM savings_goals WHERE kid_id = :kid_id ORDER BY is_completed ASC, sort_order ASC, created_at ASC');
        $stmt->execute(['kid_id' => $kidId]);
        $goals = $stmt->fetchAll();

        $balance = Kid::getBalance($db, $kidId);
        return self::allocateBalance($goals, $balance);
    }

    /**
     * Allocate balance across goals sequentially by priority.
     */
    private static function allocateBalance(array $goals, float $balance): array
    {
        $available = $balance;
        foreach ($goals as &$goal) {
            if ($goal['target_amount'] === null) {
                $goal['current_amount'] = 0;
                $goal['is_completed'] = 0;
                continue;
            }
            $target = (float) $goal['target_amount'];
            $allocated = min(max(0, $available), $target);
            $goal['current_amount'] = $allocated;
            $goal['is_completed'] = ($allocated >= $target) ? 1 : 0;
            $available -= $allocated;
        }
        return $goals;
    }

    public static function getById(PDO $db, int $id): array|false
    {
        $stmt = $db->prepare('SELECT * FROM savings_goals WHERE id = :id');
        $stmt->execute(['id' => $id]);
        return $stmt->fetch();
    }

    public static function create(PDO $db, int $kidId, string $name, ?float $targetAmount = null, ?string $wantByDate = null): int
    {
        // Auto-assign sort_order at end
        $stmt = $db->prepare('SELECT COALESCE(MAX(sort_order), -1) + 1 FROM savings_goals WHERE kid_id = :kid_id');
        $stmt->execute(['kid_id' => $kidId]);
        $sortOrder = (int) $stmt->fetchColumn();

        $stmt = $db->prepare(
            'INSERT INTO savings_goals (kid_id, name, target_amount, want_by_date, sort_order, created_at, updated_at)
             VALUES (:kid_id, :name, :target_amount, :want_by_date, :sort_order, :created_at, :updated_at)'
        );
        $now = date('Y-m-d H:i:s');
        $stmt->execute([
            'kid_id'        => $kidId,
            'name'          => $name,
            'target_amount' => $targetAmount,
            'want_by_date'  => $wantByDate,
            'sort_order'    => $sortOrder,
            'created_at'    => $now,
            'updated_at'    => $now,
        ]);
        return (int) $db->lastInsertId();
    }

    public static function update(PDO $db, int $id, string $name, ?float $targetAmount, ?string $wantByDate = null): void
    {
        $stmt = $db->prepare(
            'UPDATE savings_goals SET name = :name, target_amount = :target_amount, want_by_date = :want_by_date, updated_at = :updated_at WHERE id = :id'
        );
        $stmt->execute([
            'name'          => $name,
            'target_amount' => $targetAmount,
            'want_by_date'  => $wantByDate,
            'updated_at'    => date('Y-m-d H:i:s'),
            'id'            => $id,
        ]);
    }

    public static function reorder(PDO $db, int $kidId, array $goalIds): void
    {
        $stmt = $db->prepare('UPDATE savings_goals SET sort_order = :sort_order, updated_at = :updated_at WHERE id = :id AND kid_id = :kid_id');
        $now = date('Y-m-d H:i:s');
        foreach ($goalIds as $i => $goalId) {
            $stmt->execute([
                'sort_order'  => $i,
                'updated_at'  => $now,
                'id'          => $goalId,
                'kid_id'      => $kidId,
            ]);
        }
    }

    public static function delete(PDO $db, int $id): void
    {
        $stmt = $db->prepare('DELETE FROM savings_goals WHERE id = :id');
        $stmt->execute(['id' => $id]);
    }

    /**
     * Compute goal projections: expected date, shortfall, etc.
     * Goals are funded sequentially by priority (sort_order).
     * current_amount is derived from kid's balance, not stored.
     */
    public static function computeProjections(PDO $db, int $kidId): array
    {
        $goals = self::getByKid($db, $kidId);
        $balance = Kid::getBalance($db, $kidId);
        $rules = RecurringTransaction::getActiveByKid($db, $kidId);

        $today = date('Y-m-d');
        $horizon = date('Y-m-d', strtotime('+5 years'));

        // Build a timeline of all future recurring cash flows
        $timeline = [];
        foreach ($rules as $rule) {
            $effectiveEnd = $rule['end_date'] ? min($rule['end_date'], $horizon) : $horizon;
            $dates = RecurringTransaction::generateDates(
                $rule['frequency'],
                $rule['day_of_week'] !== null ? (int) $rule['day_of_week'] : null,
                $rule['day_of_month'] !== null ? (int) $rule['day_of_month'] : null,
                max($rule['start_date'], $today),
                $effectiveEnd
            );
            foreach ($dates as $date) {
                if ($date <= $today) continue;
                $net = $rule['type'] === 'credit' ? (float) $rule['amount'] : -(float) $rule['amount'];
                $timeline[] = ['date' => $date, 'net' => $net];
            }
        }

        // Sort timeline by date
        usort($timeline, fn($a, $b) => strcmp($a['date'], $b['date']));

        $projections = [];
        // Available balance after allocating to prior goals
        $availableNow = $balance;
        $timelinePos = 0;

        foreach ($goals as $goal) {
            $projection = [
                'goal_id'        => (int) $goal['id'],
                'name'           => $goal['name'],
                'target_amount'  => $goal['target_amount'] !== null ? (float) $goal['target_amount'] : null,
                'current_amount' => (float) $goal['current_amount'],
                'remaining'      => 0,
                'want_by_date'   => $goal['want_by_date'],
                'expected_date'  => null,
                'on_track'       => true,
                'shortfall'      => 0,
                'sort_order'     => (int) $goal['sort_order'],
            ];

            if ($goal['target_amount'] === null) {
                $projections[] = $projection;
                continue;
            }

            $target = (float) $goal['target_amount'];
            $remaining = $target - (float) $goal['current_amount'];
            $projection['remaining'] = max(0, $remaining);

            // Deduct this goal's allocation from available
            $availableNow -= (float) $goal['current_amount'];

            if ($remaining <= 0) {
                $projection['expected_date'] = $today;
                $projections[] = $projection;
                continue;
            }

            // Need future income to cover remaining
            $goalTimelineStart = $timelinePos;
            $accumulated = 0;
            $expectedDate = null;
            for ($i = $timelinePos; $i < count($timeline); $i++) {
                $accumulated += $timeline[$i]['net'];
                if ($accumulated >= $remaining) {
                    $expectedDate = $timeline[$i]['date'];
                    $timelinePos = $i + 1;
                    break;
                }
            }

            // If we didn't find an expected date, advance past all timeline entries
            if ($expectedDate === null) {
                $timelinePos = count($timeline);
            }

            $projection['expected_date'] = $expectedDate;

            // Compute shortfall if want_by_date is set and expected_date is after it (or null)
            if ($goal['want_by_date']) {
                if ($expectedDate === null || $expectedDate > $goal['want_by_date']) {
                    $projection['on_track'] = false;
                    // Sum net income available to THIS goal up to the want_by_date
                    $incomeByWantDate = 0;
                    for ($i = $goalTimelineStart; $i < count($timeline); $i++) {
                        if ($timeline[$i]['date'] > $goal['want_by_date']) break;
                        $incomeByWantDate += $timeline[$i]['net'];
                    }
                    $projection['shortfall'] = max(0, $remaining - max(0, $incomeByWantDate));
                }
            }

            $projections[] = $projection;
        }

        return $projections;
    }
}
