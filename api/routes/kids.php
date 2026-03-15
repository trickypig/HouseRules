<?php

function registerKidRoutes(Router $router, PDO $db): void
{
    // GET /kids
    $router->get('/kids', function (array $params) use ($db) {
        $user = authenticate();
        $kids = Kid::getByHousehold($db, $user['household_id']);

        // Attach balance to each kid
        foreach ($kids as &$kid) {
            $kid['balance'] = Kid::getBalance($db, $kid['id']);
        }

        Response::json(['kids' => $kids]);
    });

    // POST /kids
    $router->post('/kids', function (array $params) use ($db) {
        $user = requireParent();
        $body = $params['_body'];

        $missing = Validator::required($body, ['name']);
        if (!empty($missing)) {
            Response::error('Missing required fields: ' . implode(', ', $missing));
        }

        $color = $body['color'] ?? '#4A90D9';
        $avatar = $body['avatar'] ?? '';

        $kidId = Kid::create($db, $user['id'], $body['name'], $color, $avatar, $user['household_id']);
        $kid = Kid::getById($db, $kidId);
        $kid['balance'] = 0;

        Response::json(['kid' => $kid], 201);
    });

    // GET /kids/{id}
    $router->get('/kids/{id}', function (array $params) use ($db) {
        $user = authenticate();
        $kid = Kid::getById($db, (int) $params['id']);

        if (!$kid || $kid['household_id'] != $user['household_id']) {
            Response::notFound('Kid not found');
        }

        $kid['balance'] = Kid::getBalance($db, $kid['id']);
        Response::json(['kid' => $kid]);
    });

    // PUT /kids/{id}
    $router->put('/kids/{id}', function (array $params) use ($db) {
        $user = requireParent();
        $body = $params['_body'];
        $kid = Kid::getById($db, (int) $params['id']);

        if (!$kid || $kid['household_id'] != $user['household_id']) {
            Response::notFound('Kid not found');
        }

        $name = $body['name'] ?? $kid['name'];
        $color = $body['color'] ?? $kid['color'];
        $avatar = $body['avatar'] ?? $kid['avatar'];

        Kid::update($db, $kid['id'], $name, $color, $avatar);
        $updated = Kid::getById($db, $kid['id']);
        $updated['balance'] = Kid::getBalance($db, $kid['id']);

        Response::json(['kid' => $updated]);
    });

    // DELETE /kids/{id}
    $router->delete('/kids/{id}', function (array $params) use ($db) {
        $user = requireParent();
        $kid = Kid::getById($db, (int) $params['id']);

        if (!$kid || $kid['household_id'] != $user['household_id']) {
            Response::notFound('Kid not found');
        }

        Kid::delete($db, $kid['id']);
        Response::json(['message' => 'Kid deleted']);
    });
}
