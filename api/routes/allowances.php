<?php

function registerAllowanceRoutes(Router $router, PDO $db): void
{
    // GET /kids/{kidId}/allowance
    $router->get('/kids/{kidId}/allowance', function (array $params) use ($db) {
        $user = authenticate();
        $kid = Kid::getById($db, (int) $params['kidId']);

        if (!$kid || $kid['user_id'] !== $user['id']) {
            Response::notFound('Kid not found');
        }

        $rule = AllowanceRule::getByKid($db, $kid['id']);
        Response::json(['allowance' => $rule ?: null]);
    });

    // POST /kids/{kidId}/allowance
    $router->post('/kids/{kidId}/allowance', function (array $params) use ($db) {
        $user = authenticate();
        $body = $params['_body'];
        $kid = Kid::getById($db, (int) $params['kidId']);

        if (!$kid || $kid['user_id'] !== $user['id']) {
            Response::notFound('Kid not found');
        }

        $missing = Validator::required($body, ['amount', 'frequency']);
        if (!empty($missing)) {
            Response::error('Missing required fields: ' . implode(', ', $missing));
        }

        if (!is_numeric($body['amount']) || (float) $body['amount'] <= 0) {
            Response::error('Amount must be a positive number');
        }

        $validFrequencies = ['weekly', 'biweekly', 'monthly'];
        if (!in_array($body['frequency'], $validFrequencies)) {
            Response::error('Frequency must be one of: ' . implode(', ', $validFrequencies));
        }

        $dayOfWeek = isset($body['day_of_week']) ? (int) $body['day_of_week'] : null;
        $dayOfMonth = isset($body['day_of_month']) ? (int) $body['day_of_month'] : null;

        AllowanceRule::createOrUpdate(
            $db,
            $kid['id'],
            (float) $body['amount'],
            $body['frequency'],
            $dayOfWeek,
            $dayOfMonth
        );

        $rule = AllowanceRule::getByKid($db, $kid['id']);
        Response::json(['allowance' => $rule]);
    });

    // DELETE /kids/{kidId}/allowance
    $router->delete('/kids/{kidId}/allowance', function (array $params) use ($db) {
        $user = authenticate();
        $kid = Kid::getById($db, (int) $params['kidId']);

        if (!$kid || $kid['user_id'] !== $user['id']) {
            Response::notFound('Kid not found');
        }

        AllowanceRule::delete($db, $kid['id']);
        Response::json(['message' => 'Allowance rule removed']);
    });

    // POST /allowances/process
    $router->post('/allowances/process', function (array $params) use ($db) {
        $user = authenticate();
        $today = date('Y-m-d');
        $dueRules = AllowanceRule::getDueRules($db, $today);

        $processed = [];

        foreach ($dueRules as $rule) {
            // Only process rules belonging to the authenticated user
            if ($rule['user_id'] !== $user['id']) {
                continue;
            }

            // Create the allowance credit transaction
            Transaction::create(
                $db,
                $rule['kid_id'],
                'credit',
                'allowance',
                (float) $rule['amount'],
                'Allowance (' . $rule['frequency'] . ')',
                $today
            );

            // Advance the next_due date
            AllowanceRule::advanceNextDue(
                $db,
                $rule['id'],
                $rule['frequency'],
                $rule['day_of_week'] !== null ? (int) $rule['day_of_week'] : null,
                $rule['day_of_month'] !== null ? (int) $rule['day_of_month'] : null
            );

            $processed[] = [
                'kid_name' => $rule['kid_name'],
                'amount'   => (float) $rule['amount'],
            ];
        }

        Response::json([
            'processed' => $processed,
            'count'     => count($processed),
        ]);
    });
}
