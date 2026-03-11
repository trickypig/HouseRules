<?php

use PHPUnit\Framework\TestCase;

class GoalsTest extends TestCase
{
    private PDO $db;
    private int $kidId;

    protected function setUp(): void
    {
        $this->db = createTestDatabase();
        User::create($this->db, 'parent@test.com', 'password123', 'Test Parent');
        $this->kidId = Kid::create($this->db, 1, 'Alice');
    }

    public function testCreateGoal(): void
    {
        $goalId = SavingsGoal::create($this->db, $this->kidId, 'New Bike', 150.00);
        $this->assertGreaterThan(0, $goalId);

        $goal = SavingsGoal::getById($this->db, $goalId);
        $this->assertEquals('New Bike', $goal['name']);
        $this->assertEquals(150.00, (float) $goal['target_amount']);
        $this->assertEquals(0.00, (float) $goal['current_amount']);
        $this->assertEquals(0, $goal['is_completed']);
    }

    public function testCreateGoalWithoutTarget(): void
    {
        $goalId = SavingsGoal::create($this->db, $this->kidId, 'General Savings');
        $goal = SavingsGoal::getById($this->db, $goalId);

        $this->assertNull($goal['target_amount']);
    }

    public function testDeposit(): void
    {
        $goalId = SavingsGoal::create($this->db, $this->kidId, 'New Bike', 100.00);

        SavingsGoal::adjustAmount($this->db, $goalId, 25.00);
        $goal = SavingsGoal::getById($this->db, $goalId);
        $this->assertEquals(25.00, (float) $goal['current_amount']);
        $this->assertEquals(0, $goal['is_completed']);
    }

    public function testGoalCompletion(): void
    {
        $goalId = SavingsGoal::create($this->db, $this->kidId, 'New Bike', 50.00);

        SavingsGoal::adjustAmount($this->db, $goalId, 30.00);
        $goal = SavingsGoal::getById($this->db, $goalId);
        $this->assertEquals(0, $goal['is_completed']);

        SavingsGoal::adjustAmount($this->db, $goalId, 20.00);
        $goal = SavingsGoal::getById($this->db, $goalId);
        $this->assertEquals(1, $goal['is_completed']);
        $this->assertNotNull($goal['completed_at']);
    }

    public function testWithdraw(): void
    {
        $goalId = SavingsGoal::create($this->db, $this->kidId, 'Savings', 100.00);

        SavingsGoal::adjustAmount($this->db, $goalId, 50.00);
        SavingsGoal::adjustAmount($this->db, $goalId, -20.00);

        $goal = SavingsGoal::getById($this->db, $goalId);
        $this->assertEquals(30.00, (float) $goal['current_amount']);
    }

    public function testWithdrawCantGoBelowZero(): void
    {
        $goalId = SavingsGoal::create($this->db, $this->kidId, 'Savings', 100.00);

        SavingsGoal::adjustAmount($this->db, $goalId, 10.00);
        SavingsGoal::adjustAmount($this->db, $goalId, -50.00);

        $goal = SavingsGoal::getById($this->db, $goalId);
        $this->assertEquals(0.00, (float) $goal['current_amount']);
    }

    public function testUpdateGoal(): void
    {
        $goalId = SavingsGoal::create($this->db, $this->kidId, 'Old Name', 50.00);
        SavingsGoal::update($this->db, $goalId, 'New Name', 75.00);

        $goal = SavingsGoal::getById($this->db, $goalId);
        $this->assertEquals('New Name', $goal['name']);
        $this->assertEquals(75.00, (float) $goal['target_amount']);
    }

    public function testDeleteGoal(): void
    {
        $goalId = SavingsGoal::create($this->db, $this->kidId, 'Delete Me');
        SavingsGoal::delete($this->db, $goalId);

        $goal = SavingsGoal::getById($this->db, $goalId);
        $this->assertFalse($goal);
    }

    public function testGetByKid(): void
    {
        SavingsGoal::create($this->db, $this->kidId, 'Goal 1', 50.00);
        SavingsGoal::create($this->db, $this->kidId, 'Goal 2', 100.00);

        $goals = SavingsGoal::getByKid($this->db, $this->kidId);
        $this->assertCount(2, $goals);
    }

    public function testDepositCreatesTransaction(): void
    {
        // Verify that when a goal deposit is made via the route logic,
        // both the goal amount AND a transaction are created
        $goalId = SavingsGoal::create($this->db, $this->kidId, 'Bike', 100.00);

        // Simulate the deposit route logic
        Transaction::create($this->db, $this->kidId, 'debit', 'savings_in', 25.00, 'Savings: Bike');
        SavingsGoal::adjustAmount($this->db, $goalId, 25.00);

        $goal = SavingsGoal::getById($this->db, $goalId);
        $this->assertEquals(25.00, (float) $goal['current_amount']);

        $balance = Kid::getBalance($this->db, $this->kidId);
        $this->assertEquals(-25.00, $balance); // Debit reduces balance
    }
}
