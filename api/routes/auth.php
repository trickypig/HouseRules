<?php

function registerAuthRoutes(Router $router, PDO $db): void
{
    // POST /auth/register
    $router->post('/auth/register', function (array $params) use ($db) {
        $body = $params['_body'];

        $missing = Validator::required($body, ['email', 'password', 'display_name']);
        if (!empty($missing)) {
            Response::error('Missing required fields: ' . implode(', ', $missing));
        }

        if (!Validator::email($body['email'])) {
            Response::error('Invalid email format');
        }

        if (!Validator::minLength($body['password'], 6)) {
            Response::error('Password must be at least 6 characters');
        }

        // Check duplicate email
        $existing = User::findByEmail($db, $body['email']);
        if ($existing) {
            Response::error('Email already registered', 409);
        }

        $userId = User::create($db, $body['email'], $body['password'], $body['display_name']);
        $user = User::findById($db, $userId);

        $token = generateToken($user);

        Response::json([
            'token' => $token,
            'user'  => $user,
        ], 201);
    });

    // POST /auth/login
    $router->post('/auth/login', function (array $params) use ($db) {
        $body = $params['_body'];

        $missing = Validator::required($body, ['email', 'password']);
        if (!empty($missing)) {
            Response::error('Missing required fields: ' . implode(', ', $missing));
        }

        $user = User::findByEmail($db, $body['email']);
        if (!$user) {
            Response::error('Invalid email or password', 401);
        }

        if (!password_verify($body['password'], $user['password_hash'])) {
            Response::error('Invalid email or password', 401);
        }

        // Remove sensitive fields from response
        unset($user['password_hash']);

        $token = generateToken($user);

        Response::json([
            'token' => $token,
            'user'  => $user,
        ]);
    });

    // GET /auth/me
    $router->get('/auth/me', function (array $params) use ($db) {
        $authUser = authenticate();
        $user = User::findById($db, $authUser['id']);

        if (!$user) {
            Response::notFound('User not found');
        }

        Response::json(['user' => $user]);
    });

    // POST /auth/kid-login - parent creates a login for a kid
    $router->post('/auth/kid-login', function (array $params) use ($db) {
        $user = requireParent();
        $body = $params['_body'];

        $missing = Validator::required($body, ['kid_id', 'email', 'password']);
        if (!empty($missing)) {
            Response::error('Missing required fields: ' . implode(', ', $missing));
        }

        if (!Validator::email($body['email'])) {
            Response::error('Invalid email format');
        }

        if (!Validator::minLength($body['password'], 4)) {
            Response::error('Password must be at least 4 characters');
        }

        // Verify the kid belongs to this parent
        $kid = Kid::getById($db, (int) $body['kid_id']);
        if (!$kid || $kid['user_id'] !== $user['id']) {
            Response::notFound('Kid not found');
        }

        // Check if kid already has a login
        $existingKidUser = User::findByKidId($db, $kid['id']);
        if ($existingKidUser) {
            Response::error('This kid already has a login account', 409);
        }

        // Check duplicate email
        $existingEmail = User::findByEmail($db, $body['email']);
        if ($existingEmail) {
            Response::error('Email already registered', 409);
        }

        $displayName = $body['display_name'] ?? $kid['name'];
        $kidUserId = User::createKidUser($db, $user['id'], $kid['id'], $body['email'], $body['password'], $displayName);
        $kidUser = User::findById($db, $kidUserId);

        Response::json(['kid_user' => $kidUser], 201);
    });

    // GET /auth/kid-users - list kid logins for this parent
    $router->get('/auth/kid-users', function (array $params) use ($db) {
        $user = requireParent();
        $kidUsers = User::getKidUsers($db, $user['id']);

        Response::json(['kid_users' => $kidUsers]);
    });

    // PUT /auth/kid-login/{id} - update kid login (reset password)
    $router->put('/auth/kid-login/{id}', function (array $params) use ($db) {
        $user = requireParent();
        $body = $params['_body'];

        $kidUser = User::findById($db, (int) $params['id']);
        if (!$kidUser || ($kidUser['parent_id'] ?? null) !== $user['id'] || ($kidUser['role'] ?? 'parent') !== 'kid') {
            Response::notFound('Kid user not found');
        }

        if (isset($body['password'])) {
            if (!Validator::minLength($body['password'], 4)) {
                Response::error('Password must be at least 4 characters');
            }
            User::updatePassword($db, $kidUser['id'], $body['password']);
        }

        if (isset($body['display_name'])) {
            User::updateProfile($db, $kidUser['id'], $body['display_name']);
        }

        $updated = User::findById($db, $kidUser['id']);
        Response::json(['kid_user' => $updated]);
    });

    // DELETE /auth/kid-login/{id} - delete kid login
    $router->delete('/auth/kid-login/{id}', function (array $params) use ($db) {
        $user = requireParent();

        $kidUser = User::findById($db, (int) $params['id']);
        if (!$kidUser || ($kidUser['parent_id'] ?? null) !== $user['id'] || ($kidUser['role'] ?? 'parent') !== 'kid') {
            Response::notFound('Kid user not found');
        }

        User::deleteUser($db, $kidUser['id']);
        Response::json(['message' => 'Kid login deleted']);
    });
}
