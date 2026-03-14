<?php

function registerChoreRoutes(Router $router, PDO $db): void
{
    // GET /chores — templates + instances (parent)
    $router->get('/chores', function (array $params) use ($db) {
        $user = requireParent();

        ChoreTemplate::generateForUser($db, $user['id']);

        $templates = ChoreTemplate::getByUser($db, $user['id']);
        $instances = ChoreInstance::getByUser($db, $user['id'], [
            'status' => $_GET['status'] ?? null,
            'kid_id' => $_GET['kid_id'] ?? null,
            'from'   => $_GET['from'] ?? null,
            'to'     => $_GET['to'] ?? null,
        ]);

        Response::json(['templates' => $templates, 'instances' => $instances]);
    });

    // POST /chores — create template (parent)
    $router->post('/chores', function (array $params) use ($db) {
        $user = requireParent();
        $body = $params['_body'];

        $missing = Validator::required($body, ['title']);
        if (!empty($missing)) {
            Response::error('Missing required fields: ' . implode(', ', $missing));
        }

        // Validate assigned kid belongs to parent
        $assignedKidId = isset($body['assigned_kid_id']) ? (int) $body['assigned_kid_id'] : null;
        if ($assignedKidId) {
            $kid = Kid::getById($db, $assignedKidId);
            if (!$kid || $kid['user_id'] !== $user['id']) {
                Response::error('Invalid kid assignment');
            }
        }

        try {
            $id = ChoreTemplate::create(
                $db,
                $user['id'],
                $body['title'],
                $body['description'] ?? '',
                isset($body['amount']) ? (float) $body['amount'] : null,
                $body['frequency'] ?? null,
                isset($body['day_of_week']) ? (int) $body['day_of_week'] : null,
                isset($body['day_of_month']) ? (int) $body['day_of_month'] : null,
                $assignedKidId,
                $body['start_date'] ?? date('Y-m-d'),
                $body['end_date'] ?? null
            );
        } catch (InvalidArgumentException $e) {
            Response::error($e->getMessage());
        }

        ChoreTemplate::generateForUser($db, $user['id']);

        $template = ChoreTemplate::getById($db, $id);
        Response::json(['template' => $template], 201);
    });

    // PUT /chores/{id} — update template (parent)
    $router->put('/chores/{id}', function (array $params) use ($db) {
        $user = requireParent();
        $body = $params['_body'];
        $template = ChoreTemplate::getById($db, (int) $params['id']);

        if (!$template || $template['user_id'] !== $user['id']) {
            Response::notFound('Chore template not found');
        }

        if (isset($body['assigned_kid_id']) && $body['assigned_kid_id']) {
            $kid = Kid::getById($db, (int) $body['assigned_kid_id']);
            if (!$kid || $kid['user_id'] !== $user['id']) {
                Response::error('Invalid kid assignment');
            }
        }

        try {
            ChoreTemplate::update($db, $template['id'], $body);
        } catch (InvalidArgumentException $e) {
            Response::error($e->getMessage());
        }

        $updated = ChoreTemplate::getById($db, $template['id']);
        Response::json(['template' => $updated]);
    });

    // DELETE /chores/{id} — delete template + future instances (parent)
    $router->delete('/chores/{id}', function (array $params) use ($db) {
        $user = requireParent();
        $template = ChoreTemplate::getById($db, (int) $params['id']);

        if (!$template || $template['user_id'] !== $user['id']) {
            Response::notFound('Chore template not found');
        }

        ChoreTemplate::delete($db, $template['id']);
        Response::json(['message' => 'Chore deleted']);
    });

    // GET /chores/instances — list instances with filters (parent)
    $router->get('/chores/instances', function (array $params) use ($db) {
        $user = requireParent();

        ChoreTemplate::generateForUser($db, $user['id']);

        $instances = ChoreInstance::getByUser($db, $user['id'], [
            'status' => $_GET['status'] ?? null,
            'kid_id' => $_GET['kid_id'] ?? null,
            'from'   => $_GET['from'] ?? null,
            'to'     => $_GET['to'] ?? null,
        ]);

        Response::json(['instances' => $instances]);
    });

    // POST /chores/instances/{id}/verify — verify chore (parent)
    $router->post('/chores/instances/{id}/verify', function (array $params) use ($db) {
        $user = requireParent();
        $instance = ChoreInstance::getById($db, (int) $params['id']);

        if (!$instance) {
            Response::notFound('Chore instance not found');
        }

        // Verify ownership via template or kid
        $owned = false;
        if ($instance['chore_template_id']) {
            $tpl = ChoreTemplate::getById($db, $instance['chore_template_id']);
            if ($tpl && $tpl['user_id'] === $user['id']) {
                $owned = true;
            }
        }
        if (!$owned && $instance['kid_id']) {
            $kid = Kid::getById($db, $instance['kid_id']);
            if ($kid && $kid['user_id'] === $user['id']) {
                $owned = true;
            }
        }
        if (!$owned && $instance['claimed_by_kid_id']) {
            $kid = Kid::getById($db, $instance['claimed_by_kid_id']);
            if ($kid && $kid['user_id'] === $user['id']) {
                $owned = true;
            }
        }

        if (!$owned) {
            Response::notFound('Chore instance not found');
        }

        $txId = ChoreInstance::verify($db, (int) $params['id']);
        $updated = ChoreInstance::getById($db, (int) $params['id']);
        Response::json(['instance' => $updated, 'transaction_id' => $txId]);
    });

    // POST /chores/instances/{id}/reject — reject back to pending (parent)
    $router->post('/chores/instances/{id}/reject', function (array $params) use ($db) {
        $user = requireParent();
        $instance = ChoreInstance::getById($db, (int) $params['id']);

        if (!$instance) {
            Response::notFound('Chore instance not found');
        }

        // Check ownership (same as verify)
        $owned = false;
        if ($instance['chore_template_id']) {
            $tpl = ChoreTemplate::getById($db, $instance['chore_template_id']);
            if ($tpl && $tpl['user_id'] === $user['id']) {
                $owned = true;
            }
        }
        if (!$owned && ($instance['kid_id'] || $instance['claimed_by_kid_id'])) {
            $kidId = $instance['kid_id'] ?? $instance['claimed_by_kid_id'];
            $kid = Kid::getById($db, $kidId);
            if ($kid && $kid['user_id'] === $user['id']) {
                $owned = true;
            }
        }

        if (!$owned) {
            Response::notFound('Chore instance not found');
        }

        ChoreInstance::reject($db, (int) $params['id']);
        $updated = ChoreInstance::getById($db, (int) $params['id']);
        Response::json(['instance' => $updated]);
    });

    // ---- Kid endpoints ----

    // GET /my/chores — kid's assigned + open chores
    $router->get('/my/chores', function (array $params) use ($db) {
        $user = authenticate();
        if (($user['role'] ?? 'parent') !== 'kid' || !$user['kid_id']) {
            Response::error('This endpoint is for kid accounts only', 403);
        }

        $kid = Kid::getById($db, $user['kid_id']);
        if (!$kid) {
            Response::notFound('Kid record not found');
        }

        // Generate chores for the parent
        ChoreTemplate::generateForUser($db, $kid['user_id']);

        $myChores = ChoreInstance::getByKid($db, $kid['id']);
        $openChores = ChoreInstance::getOpenChores($db, $kid['user_id']);

        Response::json(['my_chores' => $myChores, 'open_chores' => $openChores]);
    });

    // POST /my/chores/{id}/claim — claim open chore
    $router->post('/my/chores/{id}/claim', function (array $params) use ($db) {
        $user = authenticate();
        if (($user['role'] ?? 'parent') !== 'kid' || !$user['kid_id']) {
            Response::error('This endpoint is for kid accounts only', 403);
        }

        $instance = ChoreInstance::getById($db, (int) $params['id']);
        if (!$instance || $instance['status'] !== 'pending') {
            Response::notFound('Chore not found or not available');
        }

        // Verify it's an open chore from kid's family
        if ($instance['kid_id'] !== null || $instance['claimed_by_kid_id'] !== null) {
            Response::error('This chore is already assigned', 400);
        }

        $kid = Kid::getById($db, $user['kid_id']);
        if ($instance['chore_template_id']) {
            $tpl = ChoreTemplate::getById($db, $instance['chore_template_id']);
            if (!$tpl || $tpl['user_id'] !== $kid['user_id']) {
                Response::notFound('Chore not found');
            }
        }

        ChoreInstance::claim($db, (int) $params['id'], $kid['id']);
        $updated = ChoreInstance::getById($db, (int) $params['id']);
        Response::json(['instance' => $updated]);
    });

    // POST /my/chores/{id}/complete — mark chore done
    $router->post('/my/chores/{id}/complete', function (array $params) use ($db) {
        $user = authenticate();
        if (($user['role'] ?? 'parent') !== 'kid' || !$user['kid_id']) {
            Response::error('This endpoint is for kid accounts only', 403);
        }

        $kid = Kid::getById($db, $user['kid_id']);
        $instance = ChoreInstance::getById($db, (int) $params['id']);

        if (!$instance || $instance['status'] !== 'pending') {
            Response::notFound('Chore not found or not available');
        }

        // Must be assigned or claimed by this kid
        if ($instance['kid_id'] != $kid['id'] && $instance['claimed_by_kid_id'] != $kid['id']) {
            Response::error('This chore is not assigned to you', 403);
        }

        ChoreInstance::complete($db, (int) $params['id']);
        $updated = ChoreInstance::getById($db, (int) $params['id']);
        Response::json(['instance' => $updated]);
    });
}
