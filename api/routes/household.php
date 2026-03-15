<?php

function registerHouseholdRoutes(Router $router, PDO $db): void
{
    // GET /household — current household info + members
    $router->get('/household', function (array $params) use ($db) {
        $user = requireParent();
        $household = Household::getById($db, $user['household_id']);

        if (!$household) {
            Response::notFound('Household not found');
        }

        $members = Household::getMembers($db, $household['id']);

        Response::json([
            'household' => $household,
            'members'   => $members,
        ]);
    });

    // PUT /household — update household name
    $router->put('/household', function (array $params) use ($db) {
        $user = requireParent();
        $body = $params['_body'];

        if (empty($body['name'])) {
            Response::error('Household name is required');
        }

        Household::update($db, $user['household_id'], trim($body['name']));
        $household = Household::getById($db, $user['household_id']);

        Response::json(['household' => $household]);
    });

    // POST /household/regenerate-code — generate new invite code
    $router->post('/household/regenerate-code', function (array $params) use ($db) {
        $user = requireParent();
        $code = Household::regenerateInviteCode($db, $user['household_id']);

        Response::json(['invite_code' => $code]);
    });

    // POST /household/join — join a household by invite code
    $router->post('/household/join', function (array $params) use ($db) {
        $user = requireParent();
        $body = $params['_body'];

        if (empty($body['invite_code'])) {
            Response::error('Invite code is required');
        }

        $targetHousehold = Household::getByInviteCode($db, trim($body['invite_code']));
        if (!$targetHousehold) {
            Response::error('Invalid invite code', 404);
        }

        if ($targetHousehold['id'] == $user['household_id']) {
            Response::error('You are already in this household');
        }

        $oldHouseholdId = $user['household_id'];
        $newHouseholdId = $targetHousehold['id'];

        // Move this user to the target household
        $db->prepare('UPDATE users SET household_id = :hid, updated_at = :now WHERE id = :id')
            ->execute(['hid' => $newHouseholdId, 'now' => date('Y-m-d H:i:s'), 'id' => $user['id']]);

        // Move only this user's own kids, chore templates, shopping lists
        $db->prepare('UPDATE kids SET household_id = :hid WHERE user_id = :uid')
            ->execute(['hid' => $newHouseholdId, 'uid' => $user['id']]);
        $db->prepare('UPDATE chore_templates SET household_id = :hid WHERE user_id = :uid')
            ->execute(['hid' => $newHouseholdId, 'uid' => $user['id']]);
        $db->prepare('UPDATE shopping_lists SET household_id = :hid WHERE user_id = :uid')
            ->execute(['hid' => $newHouseholdId, 'uid' => $user['id']]);
        // Move kid users created by this parent
        $db->prepare("UPDATE users SET household_id = :hid WHERE parent_id = :pid AND role = 'kid'")
            ->execute(['hid' => $newHouseholdId, 'pid' => $user['id']]);

        // Delete the old household only if no one else is in it
        $stmt = $db->prepare('SELECT COUNT(*) FROM users WHERE household_id = :hid');
        $stmt->execute(['hid' => $oldHouseholdId]);
        if ((int) $stmt->fetchColumn() === 0) {
            $db->prepare('DELETE FROM households WHERE id = :id')
                ->execute(['id' => $oldHouseholdId]);
        }

        // Return updated user with new token
        $updatedUser = User::findById($db, $user['id']);
        $token = generateToken($updatedUser);

        Response::json([
            'token'     => $token,
            'user'      => $updatedUser,
            'household' => $targetHousehold,
        ]);
    });
}
