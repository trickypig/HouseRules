<?php

function registerGoalRoutes(Router $router, PDO $db): void
{
    // GET /kids/{kidId}/goals
    $router->get('/kids/{kidId}/goals', function (array $params) use ($db) {
        $user = authenticate();
        $kid = Kid::getById($db, (int) $params['kidId']);

        if (!$kid || $kid['user_id'] !== $user['id']) {
            Response::notFound('Kid not found');
        }

        $goals = SavingsGoal::getByKid($db, $kid['id']);
        Response::json(['goals' => $goals]);
    });

    // POST /kids/{kidId}/goals
    $router->post('/kids/{kidId}/goals', function (array $params) use ($db) {
        $user = authenticate();
        $body = $params['_body'];
        $kid = Kid::getById($db, (int) $params['kidId']);

        if (!$kid || $kid['user_id'] !== $user['id']) {
            Response::notFound('Kid not found');
        }

        $missing = Validator::required($body, ['name']);
        if (!empty($missing)) {
            Response::error('Missing required fields: ' . implode(', ', $missing));
        }

        $targetAmount = isset($body['target_amount']) ? (float) $body['target_amount'] : null;
        $goalId = SavingsGoal::create($db, $kid['id'], $body['name'], $targetAmount);
        $goal = SavingsGoal::getById($db, $goalId);

        Response::json(['goal' => $goal], 201);
    });

    // PUT /goals/{id}
    $router->put('/goals/{id}', function (array $params) use ($db) {
        $user = authenticate();
        $body = $params['_body'];
        $goal = SavingsGoal::getById($db, (int) $params['id']);

        if (!$goal) {
            Response::notFound('Goal not found');
        }

        $kid = Kid::getById($db, $goal['kid_id']);
        if (!$kid || $kid['user_id'] !== $user['id']) {
            Response::notFound('Goal not found');
        }

        $name = $body['name'] ?? $goal['name'];
        $targetAmount = array_key_exists('target_amount', $body) ? (isset($body['target_amount']) ? (float) $body['target_amount'] : null) : $goal['target_amount'];

        SavingsGoal::update($db, $goal['id'], $name, $targetAmount);
        $updated = SavingsGoal::getById($db, $goal['id']);

        Response::json(['goal' => $updated]);
    });

    // DELETE /goals/{id}
    $router->delete('/goals/{id}', function (array $params) use ($db) {
        $user = authenticate();
        $goal = SavingsGoal::getById($db, (int) $params['id']);

        if (!$goal) {
            Response::notFound('Goal not found');
        }

        $kid = Kid::getById($db, $goal['kid_id']);
        if (!$kid || $kid['user_id'] !== $user['id']) {
            Response::notFound('Goal not found');
        }

        SavingsGoal::delete($db, $goal['id']);
        Response::json(['message' => 'Goal deleted']);
    });

    // POST /goals/{id}/deposit
    $router->post('/goals/{id}/deposit', function (array $params) use ($db) {
        $user = authenticate();
        $body = $params['_body'];
        $goal = SavingsGoal::getById($db, (int) $params['id']);

        if (!$goal) {
            Response::notFound('Goal not found');
        }

        $kid = Kid::getById($db, $goal['kid_id']);
        if (!$kid || $kid['user_id'] !== $user['id']) {
            Response::notFound('Goal not found');
        }

        $missing = Validator::required($body, ['amount']);
        if (!empty($missing)) {
            Response::error('Missing required fields: amount');
        }

        $amount = (float) $body['amount'];
        if ($amount <= 0) {
            Response::error('Amount must be positive');
        }

        // Create savings_in transaction (debit from balance, credit to goal)
        Transaction::create($db, $kid['id'], 'debit', 'savings_in', $amount, 'Savings: ' . $goal['name']);
        SavingsGoal::adjustAmount($db, $goal['id'], $amount);

        $updated = SavingsGoal::getById($db, $goal['id']);
        Response::json(['goal' => $updated]);
    });

    // POST /goals/{id}/withdraw
    $router->post('/goals/{id}/withdraw', function (array $params) use ($db) {
        $user = authenticate();
        $body = $params['_body'];
        $goal = SavingsGoal::getById($db, (int) $params['id']);

        if (!$goal) {
            Response::notFound('Goal not found');
        }

        $kid = Kid::getById($db, $goal['kid_id']);
        if (!$kid || $kid['user_id'] !== $user['id']) {
            Response::notFound('Goal not found');
        }

        $missing = Validator::required($body, ['amount']);
        if (!empty($missing)) {
            Response::error('Missing required fields: amount');
        }

        $amount = (float) $body['amount'];
        if ($amount <= 0) {
            Response::error('Amount must be positive');
        }

        if ($amount > (float) $goal['current_amount']) {
            Response::error('Insufficient savings in this goal');
        }

        // Create savings_out transaction (credit back to balance, debit from goal)
        Transaction::create($db, $kid['id'], 'credit', 'savings_out', $amount, 'Withdrawal: ' . $goal['name']);
        SavingsGoal::adjustAmount($db, $goal['id'], -$amount);

        $updated = SavingsGoal::getById($db, $goal['id']);
        Response::json(['goal' => $updated]);
    });
}
