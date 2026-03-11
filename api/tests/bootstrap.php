<?php

/**
 * PHPUnit bootstrap: set up in-memory SQLite database for testing.
 */

// Override env to use in-memory SQLite
$_ENV_LOADED = true;
$_ENV_VALUES = [
    'DB_DRIVER'   => 'sqlite',
    'DB_PATH'     => ':memory:',
    'JWT_SECRET'  => 'test-secret-key',
    'APP_ENV'     => 'testing',
    'CORS_ORIGIN' => 'http://localhost:5173',
];

require_once __DIR__ . '/../env.php';
require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../config/app.php';
require_once __DIR__ . '/../helpers/Response.php';
require_once __DIR__ . '/../helpers/Validator.php';
require_once __DIR__ . '/../helpers/Router.php';
require_once __DIR__ . '/../middleware/Auth.php';
require_once __DIR__ . '/../middleware/Cors.php';
require_once __DIR__ . '/../models/User.php';
require_once __DIR__ . '/../models/Kid.php';
require_once __DIR__ . '/../models/Transaction.php';
require_once __DIR__ . '/../models/AllowanceRule.php';
require_once __DIR__ . '/../models/SavingsGoal.php';

/**
 * Create a fresh in-memory database with the schema.
 */
function createTestDatabase(): PDO
{
    $db = new PDO('sqlite::memory:');
    $db->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
    $db->setAttribute(PDO::ATTR_DEFAULT_FETCH_MODE, PDO::FETCH_ASSOC);
    $db->setAttribute(PDO::ATTR_EMULATE_PREPARES, false);
    $db->exec('PRAGMA foreign_keys=ON');

    $db->exec("CREATE TABLE users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        email VARCHAR(255) NOT NULL UNIQUE,
        password_hash VARCHAR(255) NOT NULL,
        display_name VARCHAR(255) NOT NULL,
        is_admin INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
    )");

    $db->exec("CREATE TABLE kids (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        name VARCHAR(255) NOT NULL,
        color VARCHAR(7) NOT NULL DEFAULT '#4A90D9',
        avatar VARCHAR(50) NOT NULL DEFAULT '',
        sort_order INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        FOREIGN KEY (user_id) REFERENCES users(id)
    )");

    $db->exec("CREATE TABLE transactions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        kid_id INTEGER NOT NULL,
        type VARCHAR(20) NOT NULL,
        category VARCHAR(50) NOT NULL DEFAULT '',
        amount DECIMAL(10,2) NOT NULL,
        description VARCHAR(255) NOT NULL DEFAULT '',
        transaction_date TEXT NOT NULL,
        created_at TEXT NOT NULL,
        FOREIGN KEY (kid_id) REFERENCES kids(id) ON DELETE CASCADE
    )");

    $db->exec("CREATE TABLE allowance_rules (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        kid_id INTEGER NOT NULL UNIQUE,
        amount DECIMAL(10,2) NOT NULL,
        frequency VARCHAR(20) NOT NULL,
        day_of_week INTEGER,
        day_of_month INTEGER,
        next_due TEXT,
        is_active INTEGER NOT NULL DEFAULT 1,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        FOREIGN KEY (kid_id) REFERENCES kids(id) ON DELETE CASCADE
    )");

    $db->exec("CREATE TABLE savings_goals (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        kid_id INTEGER NOT NULL,
        name VARCHAR(255) NOT NULL,
        target_amount DECIMAL(10,2),
        current_amount DECIMAL(10,2) NOT NULL DEFAULT 0,
        is_completed INTEGER NOT NULL DEFAULT 0,
        completed_at TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        FOREIGN KEY (kid_id) REFERENCES kids(id) ON DELETE CASCADE
    )");

    return $db;
}
