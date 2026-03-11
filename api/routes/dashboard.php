<?php

function registerDashboardRoutes(Router $router, PDO $db): void
{
    // GET /dashboard
    $router->get('/dashboard', function (array $params) use ($db) {
        $user = authenticate();
        $kids = Kid::getByUser($db, $user['id']);
        $kidIds = array_column($kids, 'id');

        // Attach balances and goals to each kid
        foreach ($kids as &$kid) {
            $kid['balance'] = Kid::getBalance($db, $kid['id']);
            $kid['allowance'] = AllowanceRule::getByKid($db, $kid['id']) ?: null;
            $kid['goals'] = SavingsGoal::getByKid($db, $kid['id']);
        }

        // Recent transactions across all kids
        $recentTransactions = Transaction::getRecent($db, $kidIds, 10);

        Response::json([
            'kids'                => $kids,
            'recent_transactions' => $recentTransactions,
        ]);
    });
}
