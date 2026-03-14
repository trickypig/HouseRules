<?php

function registerKidPortalRoutes(Router $router, PDO $db): void
{
    // GET /my/dashboard - kid's own dashboard
    $router->get('/my/dashboard', function (array $params) use ($db) {
        $user = authenticate();
        if (($user['role'] ?? 'parent') !== 'kid' || !$user['kid_id']) {
            Response::error('This endpoint is for kid accounts only', 403);
        }

        $kid = Kid::getById($db, $user['kid_id']);
        if (!$kid) {
            Response::notFound('Kid record not found');
        }

        // Generate recurring transactions
        RecurringTransaction::generateForKid($db, $kid['id']);

        $kid['balance'] = Kid::getBalance($db, $kid['id']);

        $recurring = RecurringTransaction::getByKid($db, $kid['id']);
        $goals = SavingsGoal::getByKid($db, $kid['id']);

        $txResult = Transaction::getByKid($db, $kid['id'], ['per_page' => 25]);

        Response::json([
            'kid'            => $kid,
            'recurring'      => $recurring,
            'goals'          => $goals,
            'transactions'   => $txResult['transactions'],
            'date_balances'  => $txResult['date_balances'],
            'pagination'     => $txResult['pagination'],
        ]);
    });

    // GET /my/transactions - kid's transactions with pagination
    $router->get('/my/transactions', function (array $params) use ($db) {
        $user = authenticate();
        if (($user['role'] ?? 'parent') !== 'kid' || !$user['kid_id']) {
            Response::error('This endpoint is for kid accounts only', 403);
        }

        $filters = [
            'type'     => $_GET['type'] ?? null,
            'category' => $_GET['category'] ?? null,
            'status'   => $_GET['status'] ?? null,
            'from'     => $_GET['from'] ?? null,
            'to'       => $_GET['to'] ?? null,
            'page'     => $_GET['page'] ?? 1,
            'per_page' => $_GET['per_page'] ?? 25,
        ];

        $result = Transaction::getByKid($db, $user['kid_id'], $filters);
        Response::json($result);
    });

    // POST /my/request - kid requests a transaction from parent
    $router->post('/my/request', function (array $params) use ($db) {
        $user = authenticate();
        if (($user['role'] ?? 'parent') !== 'kid' || !$user['kid_id']) {
            Response::error('This endpoint is for kid accounts only', 403);
        }

        $body = $params['_body'];

        $missing = Validator::required($body, ['amount', 'description']);
        if (!empty($missing)) {
            Response::error('Missing required fields: ' . implode(', ', $missing));
        }

        $amount = (float) $body['amount'];
        if ($amount <= 0) {
            Response::error('Amount must be positive');
        }

        $type = in_array($body['type'] ?? '', ['credit', 'debit']) ? $body['type'] : 'credit';
        $category = $body['category'] ?? 'request';

        $txId = Transaction::create(
            $db,
            $user['kid_id'],
            $type,
            $category,
            $amount,
            $body['description'],
            date('Y-m-d'),
            'requested'
        );

        $tx = Transaction::getById($db, $txId);
        Response::json(['transaction' => $tx], 201);
    });
}
