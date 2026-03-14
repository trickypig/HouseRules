<?php

function registerShoppingRoutes(Router $router, PDO $db): void
{
    // Helper: get family owner user_id
    $getFamilyUserId = function (array $user) use ($db): int {
        if (($user['role'] ?? 'parent') === 'kid' && $user['parent_id']) {
            return (int) $user['parent_id'];
        }
        return (int) $user['id'];
    };

    // GET /shopping/lists
    $router->get('/shopping/lists', function (array $params) use ($db, $getFamilyUserId) {
        $user = authenticate();
        $familyUserId = $getFamilyUserId($user);

        $lists = ShoppingList::getByUser($db, $familyUserId);
        Response::json(['lists' => $lists]);
    });

    // POST /shopping/lists (parent only)
    $router->post('/shopping/lists', function (array $params) use ($db) {
        $user = requireParent();
        $body = $params['_body'];

        $missing = Validator::required($body, ['name']);
        if (!empty($missing)) {
            Response::error('Missing required fields: ' . implode(', ', $missing));
        }

        $id = ShoppingList::create($db, $user['id'], $body['name']);
        $list = ShoppingList::getById($db, $id);
        Response::json(['list' => $list], 201);
    });

    // PUT /shopping/lists/{id} (parent only)
    $router->put('/shopping/lists/{id}', function (array $params) use ($db) {
        $user = requireParent();
        $body = $params['_body'];
        $list = ShoppingList::getById($db, (int) $params['id']);

        if (!$list || $list['user_id'] !== $user['id']) {
            Response::notFound('Shopping list not found');
        }

        ShoppingList::update($db, $list['id'], $body['name'] ?? $list['name']);
        $updated = ShoppingList::getById($db, $list['id']);
        Response::json(['list' => $updated]);
    });

    // DELETE /shopping/lists/{id} (parent only)
    $router->delete('/shopping/lists/{id}', function (array $params) use ($db) {
        $user = requireParent();
        $list = ShoppingList::getById($db, (int) $params['id']);

        if (!$list || $list['user_id'] !== $user['id']) {
            Response::notFound('Shopping list not found');
        }

        ShoppingList::delete($db, $list['id']);
        Response::json(['message' => 'Shopping list deleted']);
    });

    // GET /shopping/lists/{id}/items
    $router->get('/shopping/lists/{id}/items', function (array $params) use ($db, $getFamilyUserId) {
        $user = authenticate();
        $familyUserId = $getFamilyUserId($user);
        $list = ShoppingList::getById($db, (int) $params['id']);

        if (!$list || $list['user_id'] !== $familyUserId) {
            Response::notFound('Shopping list not found');
        }

        $items = ShoppingListItem::getByList($db, $list['id']);
        Response::json(['items' => $items, 'list' => $list]);
    });

    // POST /shopping/lists/{id}/items
    $router->post('/shopping/lists/{id}/items', function (array $params) use ($db, $getFamilyUserId) {
        $user = authenticate();
        $familyUserId = $getFamilyUserId($user);
        $body = $params['_body'];
        $list = ShoppingList::getById($db, (int) $params['id']);

        if (!$list || $list['user_id'] !== $familyUserId) {
            Response::notFound('Shopping list not found');
        }

        $missing = Validator::required($body, ['description']);
        if (!empty($missing)) {
            Response::error('Missing required fields: ' . implode(', ', $missing));
        }

        $isKid = ($user['role'] ?? 'parent') === 'kid';

        $id = ShoppingListItem::create(
            $db,
            $list['id'],
            $body['description'],
            $user['id'],
            $isKid,
            $body['quantity'] ?? '',
            $body['notes'] ?? ''
        );

        $item = ShoppingListItem::getById($db, $id);
        Response::json(['item' => $item], 201);
    });

    // PUT /shopping/items/{id}
    $router->put('/shopping/items/{id}', function (array $params) use ($db, $getFamilyUserId) {
        $user = authenticate();
        $familyUserId = $getFamilyUserId($user);
        $body = $params['_body'];
        $item = ShoppingListItem::getById($db, (int) $params['id']);

        if (!$item) {
            Response::notFound('Item not found');
        }

        $list = ShoppingList::getById($db, $item['list_id']);
        if (!$list || $list['user_id'] !== $familyUserId) {
            Response::notFound('Item not found');
        }

        ShoppingListItem::update($db, $item['id'], $body);
        $updated = ShoppingListItem::getById($db, $item['id']);
        Response::json(['item' => $updated]);
    });

    // POST /shopping/items/{id}/toggle
    $router->post('/shopping/items/{id}/toggle', function (array $params) use ($db, $getFamilyUserId) {
        $user = authenticate();
        $familyUserId = $getFamilyUserId($user);
        $item = ShoppingListItem::getById($db, (int) $params['id']);

        if (!$item) {
            Response::notFound('Item not found');
        }

        $list = ShoppingList::getById($db, $item['list_id']);
        if (!$list || $list['user_id'] !== $familyUserId) {
            Response::notFound('Item not found');
        }

        ShoppingListItem::togglePurchased($db, $item['id']);
        $updated = ShoppingListItem::getById($db, $item['id']);
        Response::json(['item' => $updated]);
    });

    // DELETE /shopping/items/{id}
    $router->delete('/shopping/items/{id}', function (array $params) use ($db, $getFamilyUserId) {
        $user = authenticate();
        $familyUserId = $getFamilyUserId($user);
        $item = ShoppingListItem::getById($db, (int) $params['id']);

        if (!$item) {
            Response::notFound('Item not found');
        }

        $list = ShoppingList::getById($db, $item['list_id']);
        if (!$list || $list['user_id'] !== $familyUserId) {
            Response::notFound('Item not found');
        }

        // Kids can only delete their own items
        $isKid = ($user['role'] ?? 'parent') === 'kid';
        if ($isKid && $item['added_by_user_id'] !== $user['id']) {
            Response::error('You can only delete your own items', 403);
        }

        ShoppingListItem::delete($db, $item['id']);
        Response::json(['message' => 'Item deleted']);
    });

    // GET /shopping/autocomplete?q=
    $router->get('/shopping/autocomplete', function (array $params) use ($db, $getFamilyUserId) {
        $user = authenticate();
        $familyUserId = $getFamilyUserId($user);
        $query = $_GET['q'] ?? '';

        if (strlen($query) < 1) {
            Response::json(['suggestions' => []]);
        }

        $suggestions = ShoppingListItem::autocomplete($db, $familyUserId, $query);
        Response::json(['suggestions' => $suggestions]);
    });
}
