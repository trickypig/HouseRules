<?php

/**
 * Database migration script.
 * Run from CLI: php migrate.php
 * Safe to run multiple times (idempotent).
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

$autoIncrement = $isSqlite
    ? 'INTEGER PRIMARY KEY AUTOINCREMENT'
    : 'INT AUTO_INCREMENT PRIMARY KEY';

$timestampType = $isSqlite ? 'TEXT' : 'DATETIME';

// Helper to add a column if it doesn't exist (catches error for duplicates)
function addColumn(PDO $db, string $table, string $column, string $definition): void
{
    try {
        $db->exec("ALTER TABLE {$table} ADD COLUMN {$column} {$definition}");
        echo "  [OK] Added {$table}.{$column}\n";
    } catch (PDOException $e) {
        echo "  [SKIP] {$table}.{$column} (already exists)\n";
    }
}

// ---- users ----
$db->exec("CREATE TABLE IF NOT EXISTS users (
    id {$autoIncrement},
    email VARCHAR(255) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    display_name VARCHAR(255) NOT NULL,
    is_admin INTEGER NOT NULL DEFAULT 0,
    role VARCHAR(20) NOT NULL DEFAULT 'parent',
    parent_id INTEGER,
    kid_id INTEGER,
    created_at {$timestampType} NOT NULL,
    updated_at {$timestampType} NOT NULL
)");
echo "  [OK] users\n";

// Add new columns to existing users table
addColumn($db, 'users', 'role', "VARCHAR(20) NOT NULL DEFAULT 'parent'");
addColumn($db, 'users', 'parent_id', 'INTEGER');
addColumn($db, 'users', 'kid_id', 'INTEGER');

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
    status VARCHAR(20) NOT NULL DEFAULT 'verified',
    recurring_transaction_id INTEGER,
    created_at {$timestampType} NOT NULL,
    FOREIGN KEY (kid_id) REFERENCES kids(id) ON DELETE CASCADE,
    FOREIGN KEY (recurring_transaction_id) REFERENCES recurring_transactions(id) ON DELETE SET NULL
)");
echo "  [OK] transactions\n";

// Add new columns to existing transactions table
addColumn($db, 'transactions', 'status', "VARCHAR(20) NOT NULL DEFAULT 'verified'");
addColumn($db, 'transactions', 'recurring_transaction_id', 'INTEGER');

// ---- recurring_transactions ----
$db->exec("CREATE TABLE IF NOT EXISTS recurring_transactions (
    id {$autoIncrement},
    kid_id INTEGER NOT NULL,
    type VARCHAR(20) NOT NULL,
    category VARCHAR(50) NOT NULL DEFAULT '',
    amount DECIMAL(10,2) NOT NULL,
    description VARCHAR(255) NOT NULL DEFAULT '',
    frequency VARCHAR(20) NOT NULL,
    day_of_week INTEGER,
    day_of_month INTEGER,
    start_date {$timestampType} NOT NULL,
    end_date {$timestampType},
    is_active INTEGER NOT NULL DEFAULT 1,
    created_at {$timestampType} NOT NULL,
    updated_at {$timestampType} NOT NULL,
    FOREIGN KEY (kid_id) REFERENCES kids(id) ON DELETE CASCADE
)");
echo "  [OK] recurring_transactions\n";

// ---- allowance_rules (legacy, kept for data preservation) ----
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
echo "  [OK] allowance_rules (legacy)\n";

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

// Add new columns to savings_goals
addColumn($db, 'savings_goals', 'want_by_date', $timestampType);
addColumn($db, 'savings_goals', 'sort_order', 'INTEGER NOT NULL DEFAULT 0');

// ---- chore_templates ----
$db->exec("CREATE TABLE IF NOT EXISTS chore_templates (
    id {$autoIncrement},
    user_id INTEGER NOT NULL,
    title VARCHAR(255) NOT NULL,
    description VARCHAR(255) NOT NULL DEFAULT '',
    amount DECIMAL(10,2),
    frequency VARCHAR(20),
    day_of_week INTEGER,
    day_of_month INTEGER,
    assigned_kid_id INTEGER,
    start_date {$timestampType} NOT NULL,
    end_date {$timestampType},
    is_active INTEGER NOT NULL DEFAULT 1,
    created_at {$timestampType} NOT NULL,
    updated_at {$timestampType} NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (assigned_kid_id) REFERENCES kids(id)
)");
echo "  [OK] chore_templates\n";

// ---- chore_instances ----
$db->exec("CREATE TABLE IF NOT EXISTS chore_instances (
    id {$autoIncrement},
    chore_template_id INTEGER,
    kid_id INTEGER,
    claimed_by_kid_id INTEGER,
    title VARCHAR(255) NOT NULL,
    description VARCHAR(255) NOT NULL DEFAULT '',
    amount DECIMAL(10,2),
    due_date {$timestampType} NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'pending',
    completed_at {$timestampType},
    verified_at {$timestampType},
    transaction_id INTEGER,
    created_at {$timestampType} NOT NULL,
    FOREIGN KEY (chore_template_id) REFERENCES chore_templates(id),
    FOREIGN KEY (kid_id) REFERENCES kids(id),
    FOREIGN KEY (claimed_by_kid_id) REFERENCES kids(id),
    FOREIGN KEY (transaction_id) REFERENCES transactions(id)
)");
echo "  [OK] chore_instances\n";

// ---- shopping_lists ----
$db->exec("CREATE TABLE IF NOT EXISTS shopping_lists (
    id {$autoIncrement},
    user_id INTEGER NOT NULL,
    name VARCHAR(255) NOT NULL,
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at {$timestampType} NOT NULL,
    updated_at {$timestampType} NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id)
)");
echo "  [OK] shopping_lists\n";

// ---- shopping_list_items ----
$db->exec("CREATE TABLE IF NOT EXISTS shopping_list_items (
    id {$autoIncrement},
    list_id INTEGER NOT NULL,
    description VARCHAR(255) NOT NULL,
    is_purchased INTEGER NOT NULL DEFAULT 0,
    added_by_user_id INTEGER NOT NULL,
    is_request INTEGER NOT NULL DEFAULT 0,
    quantity VARCHAR(50) NOT NULL DEFAULT '',
    notes VARCHAR(255) NOT NULL DEFAULT '',
    purchased_at {$timestampType},
    created_at {$timestampType} NOT NULL,
    FOREIGN KEY (list_id) REFERENCES shopping_lists(id) ON DELETE CASCADE,
    FOREIGN KEY (added_by_user_id) REFERENCES users(id)
)");
echo "  [OK] shopping_list_items\n";

// ---- Indexes ----
$indexes = [
    'CREATE INDEX IF NOT EXISTS idx_kids_user ON kids(user_id)',
    'CREATE INDEX IF NOT EXISTS idx_transactions_kid ON transactions(kid_id)',
    'CREATE INDEX IF NOT EXISTS idx_transactions_date ON transactions(transaction_date)',
    'CREATE INDEX IF NOT EXISTS idx_transactions_type ON transactions(type)',
    'CREATE INDEX IF NOT EXISTS idx_transactions_status ON transactions(status)',
    'CREATE INDEX IF NOT EXISTS idx_transactions_recurring ON transactions(recurring_transaction_id)',
    'CREATE INDEX IF NOT EXISTS idx_recurring_kid ON recurring_transactions(kid_id)',
    'CREATE INDEX IF NOT EXISTS idx_recurring_active ON recurring_transactions(is_active)',
    'CREATE INDEX IF NOT EXISTS idx_allowance_rules_kid ON allowance_rules(kid_id)',
    'CREATE INDEX IF NOT EXISTS idx_savings_goals_kid ON savings_goals(kid_id)',
    'CREATE INDEX IF NOT EXISTS idx_users_parent ON users(parent_id)',
    'CREATE INDEX IF NOT EXISTS idx_users_kid ON users(kid_id)',
    'CREATE INDEX IF NOT EXISTS idx_users_role ON users(role)',
    'CREATE INDEX IF NOT EXISTS idx_chore_templates_user ON chore_templates(user_id)',
    'CREATE INDEX IF NOT EXISTS idx_chore_templates_kid ON chore_templates(assigned_kid_id)',
    'CREATE INDEX IF NOT EXISTS idx_chore_instances_template ON chore_instances(chore_template_id)',
    'CREATE INDEX IF NOT EXISTS idx_chore_instances_kid ON chore_instances(kid_id)',
    'CREATE INDEX IF NOT EXISTS idx_chore_instances_due ON chore_instances(due_date)',
    'CREATE INDEX IF NOT EXISTS idx_chore_instances_status ON chore_instances(status)',
    'CREATE INDEX IF NOT EXISTS idx_shopping_lists_user ON shopping_lists(user_id)',
    'CREATE INDEX IF NOT EXISTS idx_shopping_items_list ON shopping_list_items(list_id)',
];

foreach ($indexes as $idx) {
    $db->exec($idx);
}
echo "  [OK] indexes\n";

echo "\nMigration complete!\n";
