<?php

/**
 * Database migration script.
 * Run from CLI: php migrate.php
 */

require_once __DIR__ . '/../env.php';
require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../config/app.php';

echo "Starting migration...\n";

try {
    $db = getDatabase();
} catch (PDOException $e) {
    echo "Database connection failed: " . $e->getMessage() . "\n";
    exit(1);
}

$driver = env('DB_DRIVER', 'sqlite');
$isSqlite = ($driver === 'sqlite');

echo "Using driver: {$driver}\n";

// Helper for auto-increment syntax
$autoIncrement = $isSqlite
    ? 'INTEGER PRIMARY KEY AUTOINCREMENT'
    : 'INT AUTO_INCREMENT PRIMARY KEY';

$timestampType = $isSqlite ? 'TEXT' : 'DATETIME';

// ---- users ----
$db->exec("CREATE TABLE IF NOT EXISTS users (
    id {$autoIncrement},
    email VARCHAR(255) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    display_name VARCHAR(255) NOT NULL,
    is_admin INTEGER NOT NULL DEFAULT 0,
    created_at {$timestampType} NOT NULL,
    updated_at {$timestampType} NOT NULL
)");
echo "  [OK] users\n";

// ---- kids ----
$db->exec("CREATE TABLE IF NOT EXISTS kids (
    id {$autoIncrement},
    user_id INTEGER NOT NULL,
    name VARCHAR(255) NOT NULL,
    color VARCHAR(7) NOT NULL DEFAULT '#4A90D9',
    avatar VARCHAR(50) NOT NULL DEFAULT '',
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at {$timestampType} NOT NULL,
    updated_at {$timestampType} NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id)
)");
echo "  [OK] kids\n";

// ---- transactions ----
$db->exec("CREATE TABLE IF NOT EXISTS transactions (
    id {$autoIncrement},
    kid_id INTEGER NOT NULL,
    type VARCHAR(20) NOT NULL,
    category VARCHAR(50) NOT NULL DEFAULT '',
    amount DECIMAL(10,2) NOT NULL,
    description VARCHAR(255) NOT NULL DEFAULT '',
    transaction_date {$timestampType} NOT NULL,
    created_at {$timestampType} NOT NULL,
    FOREIGN KEY (kid_id) REFERENCES kids(id) ON DELETE CASCADE
)");
echo "  [OK] transactions\n";

// ---- allowance_rules ----
$db->exec("CREATE TABLE IF NOT EXISTS allowance_rules (
    id {$autoIncrement},
    kid_id INTEGER NOT NULL UNIQUE,
    amount DECIMAL(10,2) NOT NULL,
    frequency VARCHAR(20) NOT NULL,
    day_of_week INTEGER,
    day_of_month INTEGER,
    next_due {$timestampType},
    is_active INTEGER NOT NULL DEFAULT 1,
    created_at {$timestampType} NOT NULL,
    updated_at {$timestampType} NOT NULL,
    FOREIGN KEY (kid_id) REFERENCES kids(id) ON DELETE CASCADE
)");
echo "  [OK] allowance_rules\n";

// ---- savings_goals ----
$db->exec("CREATE TABLE IF NOT EXISTS savings_goals (
    id {$autoIncrement},
    kid_id INTEGER NOT NULL,
    name VARCHAR(255) NOT NULL,
    target_amount DECIMAL(10,2),
    current_amount DECIMAL(10,2) NOT NULL DEFAULT 0,
    is_completed INTEGER NOT NULL DEFAULT 0,
    completed_at {$timestampType},
    created_at {$timestampType} NOT NULL,
    updated_at {$timestampType} NOT NULL,
    FOREIGN KEY (kid_id) REFERENCES kids(id) ON DELETE CASCADE
)");
echo "  [OK] savings_goals\n";

// ---- Indexes ----
$indexes = [
    'CREATE INDEX IF NOT EXISTS idx_kids_user ON kids(user_id)',
    'CREATE INDEX IF NOT EXISTS idx_transactions_kid ON transactions(kid_id)',
    'CREATE INDEX IF NOT EXISTS idx_transactions_date ON transactions(transaction_date)',
    'CREATE INDEX IF NOT EXISTS idx_transactions_type ON transactions(type)',
    'CREATE INDEX IF NOT EXISTS idx_allowance_rules_kid ON allowance_rules(kid_id)',
    'CREATE INDEX IF NOT EXISTS idx_allowance_rules_next ON allowance_rules(next_due)',
    'CREATE INDEX IF NOT EXISTS idx_savings_goals_kid ON savings_goals(kid_id)',
];

foreach ($indexes as $idx) {
    $db->exec($idx);
}
echo "  [OK] indexes\n";

echo "\nMigration complete!\n";
