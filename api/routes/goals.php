<?php

function registerGoalRoutes(Router $router, PDO $db): void
{
    // Helper to check kid access for both parents and kids
    $checkKidAccess = function (PDO $db, array $user, int $kidId): array {
        $kid = Kid::getById($db, $kidId);
        $allowed = false;
        if ($kid) {
            if (($user['role'] ?? 'parent') === 'parent' && $kid['household_id'] == $user['household_id']) {
                $allowed = true;
            }
            if (($user['role'] ?? 'parent') === 'kid' && $user['kid_id'] == $kid['id']) {
                $allowed = true;
            }
        }
        if (!$allowed) {
            Response::notFound('Kid not found');
        }
        return $kid;
    };

    // GET /kids/{kidId}/goals
    $router->get('/kids/{kidId}/goals', function (array $params) use ($db, $checkKidAccess) {
        $user = authenticate();
        $kid = $checkKidAccess($db, $user, (int) $params['kidId']);
        $goals = SavingsGoal::getByKid($db, $kid['id']);
        Response::json(['goals' => $goals]);
    });

    // GET /kids/{kidId}/goals/projections
    $router->get('/kids/{kidId}/goals/projections', function (array $params) use ($db, $checkKidAccess) {
        $user = authenticate();
        $kid = $checkKidAccess($db, $user, (int) $params['kidId']);
        $projections = SavingsGoal::computeProjections($db, $kid['id']);
        Response::json(['projections' => $projections]);
    });

    // POST /kids/{kidId}/goals
    $router->post('/kids/{kidId}/goals', function (array $params) use ($db, $checkKidAccess) {
        $user = authenticate();
        $body = $params['_body'];
        $kid = $checkKidAccess($db, $user, (int) $params['kidId']);

        $missing = Validator::required($body, ['name']);
        if (!empty($missing)) {
            Response::error('Missing required fields: ' . implode(', ', $missing));
        }

        $targetAmount = isset($body['target_amount']) ? (float) $body['target_amount'] : null;
        $wantByDate = $body['want_by_date'] ?? null;
        $goalId = SavingsGoal::create($db, $kid['id'], $body['name'], $targetAmount, $wantByDate);
        $goal = SavingsGoal::getById($db, $goalId);

        Response::json(['goal' => $goal], 201);
    });

    // PUT /kids/{kidId}/goals/reorder
    $router->put('/kids/{kidId}/goals/reorder', function (array $params) use ($db, $checkKidAccess) {
        $user = authenticate();
        $body = $params['_body'];
        $kid = $checkKidAccess($db, $user, (int) $params['kidId']);

        if (empty($body['goal_ids']) || !is_array($body['goal_ids'])) {
            Response::error('goal_ids array required');
        }

        SavingsGoal::reorder($db, $kid['id'], $body['goal_ids']);
        $goals = SavingsGoal::getByKid($db, $kid['id']);
        Response::json(['goals' => $goals]);
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
        $allowed = false;
        if ($kid) {
            if (($user['role'] ?? 'parent') === 'parent' && $kid['household_id'] == $user['household_id']) {
                $allowed = true;
            }
            if (($user['role'] ?? 'parent') === 'kid' && $user['kid_id'] == $kid['id']) {
                $allowed = true;
            }
        }
        if (!$allowed) {
            Response::notFound('Goal not found');
        }

        $name = $body['name'] ?? $goal['name'];
        $targetAmount = array_key_exists('target_amount', $body) ? (isset($body['target_amount']) ? (float) $body['target_amount'] : null) : $goal['target_amount'];
        $wantByDate = array_key_exists('want_by_date', $body) ? $body['want_by_date'] : $goal['want_by_date'];

        SavingsGoal::update($db, $goal['id'], $name, $targetAmount, $wantByDate);
        $updated = SavingsGoal::getById($db, $goal['id']);

        Response::json(['goal' => $updated]);
    });

    // DELETE /goals/{id}
    $router->delete('/goals/{id}', function (array $params) use ($db) {
        $user = requireParent();
        $goal = SavingsGoal::getById($db, (int) $params['id']);

        if (!$goal) {
            Response::notFound('Goal not found');
        }

        $kid = Kid::getById($db, $goal['kid_id']);
        if (!$kid || $kid['household_id'] != $user['household_id']) {
            Response::notFound('Goal not found');
        }

        SavingsGoal::delete($db, $goal['id']);
        Response::json(['message' => 'Goal deleted']);
    });
}
