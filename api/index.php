<?php

/**
 * House Rules API - Front Controller
 */

// Environment
require_once __DIR__ . '/env.php';

// Config
require_once __DIR__ . '/config/database.php';
require_once __DIR__ . '/config/app.php';

// Helpers
require_once __DIR__ . '/helpers/Response.php';
require_once __DIR__ . '/helpers/Validator.php';
require_once __DIR__ . '/helpers/Router.php';

// Middleware
require_once __DIR__ . '/middleware/Cors.php';
require_once __DIR__ . '/middleware/Auth.php';

// Models
require_once __DIR__ . '/models/User.php';
require_once __DIR__ . '/models/Kid.php';
require_once __DIR__ . '/models/Transaction.php';
require_once __DIR__ . '/models/RecurringTransaction.php';
require_once __DIR__ . '/models/SavingsGoal.php';
require_once __DIR__ . '/models/ChoreTemplate.php';
require_once __DIR__ . '/models/ChoreInstance.php';
require_once __DIR__ . '/models/ShoppingList.php';
require_once __DIR__ . '/models/ShoppingListItem.php';

// Routes
require_once __DIR__ . '/routes/auth.php';
require_once __DIR__ . '/routes/kids.php';
require_once __DIR__ . '/routes/transactions.php';
require_once __DIR__ . '/routes/recurring.php';
require_once __DIR__ . '/routes/goals.php';
require_once __DIR__ . '/routes/dashboard.php';
require_once __DIR__ . '/routes/kid_portal.php';
require_once __DIR__ . '/routes/chores.php';
require_once __DIR__ . '/routes/shopping.php';

// Handle CORS
handleCors();

// Database connection
try {
    $db = getDatabase();
} catch (PDOException $e) {
    Response::error('Database connection failed: ' . $e->getMessage(), 500);
}

// Router
$router = new Router();

// Register all routes
registerAuthRoutes($router, $db);
registerKidRoutes($router, $db);
registerTransactionRoutes($router, $db);
registerRecurringRoutes($router, $db);
registerGoalRoutes($router, $db);
registerDashboardRoutes($router, $db);
registerKidPortalRoutes($router, $db);
registerChoreRoutes($router, $db);
registerShoppingRoutes($router, $db);

// Dispatch
$router->dispatch();
