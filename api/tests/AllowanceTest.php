<?php

use PHPUnit\Framework\TestCase;

class AllowanceTest extends TestCase
{
    private PDO $db;
    private int $kidId;

    protected function setUp(): void
    {
        $this->db = createTestDatabase();
        User::create($this->db, 'parent@test.com', 'password123', 'Test Parent');
        $this->kidId = Kid::create($this->db, 1, 'Alice');
    }

    public function testCreateAllowanceRule(): void
    {
        $id = AllowanceRule::createOrUpdate($this->db, $this->kidId, 10.00, 'weekly', 0);
        $this->assertGreaterThan(0, $id);

        $rule = AllowanceRule::getByKid($this->db, $this->kidId);
        $this->assertIsArray($rule);
        $this->assertEquals(10.00, (float) $rule['amount']);
        $this->assertEquals('weekly', $rule['frequency']);
        $this->assertEquals(1, $rule['is_active']);
        $this->assertNotEmpty($rule['next_due']);
    }

    public function testUpdateExistingRule(): void
    {
        AllowanceRule::createOrUpdate($this->db, $this->kidId, 10.00, 'weekly', 0);
        AllowanceRule::createOrUpdate($this->db, $this->kidId, 15.00, 'biweekly', 5);

        $rule = AllowanceRule::getByKid($this->db, $this->kidId);
        $this->assertEquals(15.00, (float) $rule['amount']);
        $this->assertEquals('biweekly', $rule['frequency']);
    }

    public function testDeleteRule(): void
    {
        AllowanceRule::createOrUpdate($this->db, $this->kidId, 10.00, 'weekly', 0);
        AllowanceRule::delete($this->db, $this->kidId);

        $rule = AllowanceRule::getByKid($this->db, $this->kidId);
        $this->assertFalse($rule);
    }

    public function testGetDueRules(): void
    {
        // Create rule with past due date
        AllowanceRule::createOrUpdate($this->db, $this->kidId, 10.00, 'weekly', 0);

        // Force next_due to the past
        $this->db->exec("UPDATE allowance_rules SET next_due = '2020-01-01'");

        $dueRules = AllowanceRule::getDueRules($this->db, date('Y-m-d'));
        $this->assertCount(1, $dueRules);
        $this->assertEquals('Alice', $dueRules[0]['kid_name']);
    }

    public function testAdvanceNextDue(): void
    {
        $id = AllowanceRule::createOrUpdate($this->db, $this->kidId, 10.00, 'weekly', 0);

        $ruleBefore = AllowanceRule::getByKid($this->db, $this->kidId);
        AllowanceRule::advanceNextDue($this->db, $id, 'weekly', 0, null);
        $ruleAfter = AllowanceRule::getByKid($this->db, $this->kidId);

        $this->assertNotEquals($ruleBefore['next_due'], $ruleAfter['next_due']);
    }

    public function testMonthlyAllowance(): void
    {
        AllowanceRule::createOrUpdate($this->db, $this->kidId, 50.00, 'monthly', null, 15);

        $rule = AllowanceRule::getByKid($this->db, $this->kidId);
        $this->assertEquals('monthly', $rule['frequency']);
        $this->assertEquals(50.00, (float) $rule['amount']);
    }

    public function testNoRuleReturnsfalse(): void
    {
        $rule = AllowanceRule::getByKid($this->db, $this->kidId);
        $this->assertFalse($rule);
    }
}
