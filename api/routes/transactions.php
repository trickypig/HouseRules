<?php

function registerTransactionRoutes(Router $router, PDO $db): void
{
    // GET /kids/{kidId}/transactions
    $router->get('/kids/{kidId}/transactions', function (array $params) use ($db) {
        $user = authenticate();
        $kid = Kid::getById($db, (int) $params['kidId']);

        if (!$kid || $kid['user_id'] !== $user['id']) {
            Response::notFound('Kid not found');
        }

        $filters = [
            'type'     => $_GET['type'] ?? null,
            'category' => $_GET['category'] ?? null,
            'from'     => $_GET['from'] ?? null,
            'to'       => $_GET['to'] ?? null,
            'page'     => $_GET['page'] ?? 1,
            'per_page' => $_GET['per_page'] ?? 25,
        ];

        $result = Transaction::getByKid($db, $kid['id'], $filters);
        Response::json($result);
    });

    // POST /kids/{kidId}/transactions
    $router->post('/kids/{kidId}/transactions', function (array $params) use ($db) {
        $user = authenticate();
        $body = $params['_body'];
        $kid = Kid::getById($db, (int) $params['kidId']);

        if (!$kid || $kid['user_id'] !== $user['id']) {
            Response::notFound('Kid not found');
        }

        $missing = Validator::required($body, ['type', 'amount']);
        if (!empty($missing)) {
            Response::error('Missing required fields: ' . implode(', ', $missing));
        }

        if (!is_numeric($body['amount']) || (float) $body['amount'] <= 0) {
            Response::error('Amount must be a positive number');
        }

        try {
            $txId = Transaction::create(
                $db,
                $kid['id'],
                $body['type'],
                $body['category'] ?? '',
                (float) $body['amount'],
                $body['description'] ?? '',
                $body['transaction_date'] ?? null
            );
        } catch (InvalidArgumentException $e) {
            Response::error($e->getMessage());
        }

        $tx = Transaction::getById($db, $txId);
        Response::json(['transaction' => $tx], 201);
    });

    // PUT /transactions/{id}
    $router->put('/transactions/{id}', function (array $params) use ($db) {
        $user = authenticate();
        $body = $params['_body'];
        $tx = Transaction::getById($db, (int) $params['id']);

        if (!$tx) {
            Response::notFound('Transaction not found');
        }

        // Verify ownership
        $kid = Kid::getById($db, $tx['kid_id']);
        if (!$kid || $kid['user_id'] !== $user['id']) {
            Response::notFound('Transaction not found');
        }

        try {
            Transaction::update(
                $db,
                $tx['id'],
                $body['type'] ?? $tx['type'],
                $body['category'] ?? $tx['category'],
                isset($body['amount']) ? (float) $body['amount'] : (float) $tx['amount'],
                $body['description'] ?? $tx['description'],
                $body['transaction_date'] ?? $tx['transaction_date']
            );
        } catch (InvalidArgumentException $e) {
            Response::error($e->getMessage());
        }

        $updated = Transaction::getById($db, $tx['id']);
        Response::json(['transaction' => $updated]);
    });

    // DELETE /transactions/{id}
    $router->delete('/transactions/{id}', function (array $params) use ($db) {
        $user = authenticate();
        $tx = Transaction::getById($db, (int) $params['id']);

        if (!$tx) {
            Response::notFound('Transaction not found');
        }

        $kid = Kid::getById($db, $tx['kid_id']);
        if (!$kid || $kid['user_id'] !== $user['id']) {
            Response::notFound('Transaction not found');
        }

        Transaction::delete($db, $tx['id']);
        Response::json(['message' => 'Transaction deleted']);
    });
}
