<?php

function registerRecurringRoutes(Router $router, PDO $db): void
{
    // GET /kids/{kidId}/recurring
    $router->get('/kids/{kidId}/recurring', function (array $params) use ($db) {
        $user = requireParent();
        $kid = Kid::getById($db, (int) $params['kidId']);

        if (!$kid || $kid['user_id'] !== $user['id']) {
            Response::notFound('Kid not found');
        }

        $rules = RecurringTransaction::getByKid($db, $kid['id']);
        Response::json(['recurring' => $rules]);
    });

    // POST /kids/{kidId}/recurring
    $router->post('/kids/{kidId}/recurring', function (array $params) use ($db) {
        $user = requireParent();
        $body = $params['_body'];
        $kid = Kid::getById($db, (int) $params['kidId']);

        if (!$kid || $kid['user_id'] !== $user['id']) {
            Response::notFound('Kid not found');
        }

        $missing = Validator::required($body, ['type', 'amount', 'frequency']);
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

        try {
            $id = RecurringTransaction::create(
                $db,
                $kid['id'],
                $body['type'],
                $body['category'] ?? '',
                (float) $body['amount'],
                $body['description'] ?? '',
                $body['frequency'],
                isset($body['day_of_week']) ? (int) $body['day_of_week'] : null,
                isset($body['day_of_month']) ? (int) $body['day_of_month'] : null,
                $body['start_date'] ?? date('Y-m-d'),
                $body['end_date'] ?? null
            );
        } catch (InvalidArgumentException $e) {
            Response::error($e->getMessage());
        }

        // Generate transactions immediately
        RecurringTransaction::generateForKid($db, $kid['id']);

        $rule = RecurringTransaction::getById($db, $id);
        Response::json(['recurring' => $rule], 201);
    });

    // PUT /recurring/{id}
    $router->put('/recurring/{id}', function (array $params) use ($db) {
        $user = requireParent();
        $body = $params['_body'];
        $rule = RecurringTransaction::getById($db, (int) $params['id']);

        if (!$rule) {
            Response::notFound('Recurring transaction not found');
        }

        $kid = Kid::getById($db, $rule['kid_id']);
        if (!$kid || $kid['user_id'] !== $user['id']) {
            Response::notFound('Recurring transaction not found');
        }

        try {
            RecurringTransaction::update(
                $db,
                $rule['id'],
                $body['type'] ?? $rule['type'],
                $body['category'] ?? $rule['category'],
                isset($body['amount']) ? (float) $body['amount'] : (float) $rule['amount'],
                $body['description'] ?? $rule['description'],
                $body['frequency'] ?? $rule['frequency'],
                array_key_exists('day_of_week', $body) ? (isset($body['day_of_week']) ? (int) $body['day_of_week'] : null) : $rule['day_of_week'],
                array_key_exists('day_of_month', $body) ? (isset($body['day_of_month']) ? (int) $body['day_of_month'] : null) : $rule['day_of_month'],
                array_key_exists('end_date', $body) ? $body['end_date'] : $rule['end_date'],
                isset($body['is_active']) ? (bool) $body['is_active'] : (bool) $rule['is_active']
            );
        } catch (InvalidArgumentException $e) {
            Response::error($e->getMessage());
        }

        $updated = RecurringTransaction::getById($db, $rule['id']);
        Response::json(['recurring' => $updated]);
    });

    // DELETE /recurring/{id}
    $router->delete('/recurring/{id}', function (array $params) use ($db) {
        $user = requireParent();
        $rule = RecurringTransaction::getById($db, (int) $params['id']);

        if (!$rule) {
            Response::notFound('Recurring transaction not found');
        }

        $kid = Kid::getById($db, $rule['kid_id']);
        if (!$kid || $kid['user_id'] !== $user['id']) {
            Response::notFound('Recurring transaction not found');
        }

        RecurringTransaction::delete($db, $rule['id']);
        Response::json(['message' => 'Recurring transaction deleted']);
    });
}
