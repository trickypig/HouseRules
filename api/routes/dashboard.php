<?php

function registerDashboardRoutes(Router $router, PDO $db): void
{
    // GET /dashboard
    $router->get('/dashboard', function (array $params) use ($db) {
        $user = requireParent();
        $kids = Kid::getByUser($db, $user['id']);
        $kidIds = array_column($kids, 'id');

        // Generate recurring transactions for each kid
        foreach ($kidIds as $kidId) {
            RecurringTransaction::generateForKid($db, $kidId);
        }

        // Generate chore instances
        ChoreTemplate::generateForUser($db, $user['id']);

        // Attach balances, recurring rules, goals, and pending counts to each kid
        foreach ($kids as &$kid) {
            $kid['balance'] = Kid::getBalance($db, $kid['id']);
            $kid['recurring'] = RecurringTransaction::getActiveByKid($db, $kid['id']);
            $kid['goals'] = SavingsGoal::getByKid($db, $kid['id']);
            $kid['pending_count'] = Transaction::getPendingCount($db, $kid['id']);
        }

        // Recent transactions across all kids
        $recentTransactions = Transaction::getRecent($db, $kidIds, 15);

        // Pending/requested transactions needing approval
        $pendingTransactions = [];
        if (!empty($kidIds)) {
            $placeholders = implode(',', array_fill(0, count($kidIds), '?'));
            $stmt = $db->prepare(
                "SELECT t.*, k.name as kid_name FROM transactions t
                 JOIN kids k ON k.id = t.kid_id
                 WHERE t.kid_id IN ({$placeholders}) AND t.status IN ('pending', 'requested')
                 AND t.transaction_date <= CURRENT_DATE
                 ORDER BY t.transaction_date DESC, t.id DESC
                 LIMIT 20"
            );
            $stmt->execute(array_values($kidIds));
            $pendingTransactions = $stmt->fetchAll();
        }

        // Overdue/missed chores
        $overdueChores = ChoreInstance::getByUser($db, $user['id'], ['status' => 'missed']);
        // Also get completed chores awaiting verification
        $completedChores = ChoreInstance::getByUser($db, $user['id'], ['status' => 'completed']);

        // Shopping lists with counts
        $shoppingLists = ShoppingList::getByUser($db, $user['id']);

        Response::json([
            'kids'                  => $kids,
            'recent_transactions'   => $recentTransactions,
            'pending_transactions'  => $pendingTransactions,
            'overdue_chores'        => $overdueChores,
            'completed_chores'      => $completedChores,
            'shopping_lists'        => $shoppingLists,
        ]);
    });
}
