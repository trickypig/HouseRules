<?php

use PHPUnit\Framework\TestCase;

class KidsTest extends TestCase
{
    private PDO $db;

    protected function setUp(): void
    {
        $this->db = createTestDatabase();
        // Create a test user
        User::create($this->db, 'parent@test.com', 'password123', 'Test Parent');
    }

    public function testCreateKid(): void
    {
        $kidId = Kid::create($this->db, 1, 'Alice', '#FF5733', '');
        $this->assertIsInt($kidId);
        $this->assertGreaterThan(0, $kidId);

        $kid = Kid::getById($this->db, $kidId);
        $this->assertIsArray($kid);
        $this->assertEquals('Alice', $kid['name']);
        $this->assertEquals('#FF5733', $kid['color']);
    }

    public function testGetByUser(): void
    {
        Kid::create($this->db, 1, 'Alice');
        Kid::create($this->db, 1, 'Bob');

        $kids = Kid::getByUser($this->db, 1);
        $this->assertCount(2, $kids);
    }

    public function testUpdateKid(): void
    {
        $kidId = Kid::create($this->db, 1, 'Alice');
        Kid::update($this->db, $kidId, 'Alicia', '#00FF00', '');

        $kid = Kid::getById($this->db, $kidId);
        $this->assertEquals('Alicia', $kid['name']);
        $this->assertEquals('#00FF00', $kid['color']);
    }

    public function testDeleteKid(): void
    {
        $kidId = Kid::create($this->db, 1, 'Alice');
        Kid::delete($this->db, $kidId);

        $kid = Kid::getById($this->db, $kidId);
        $this->assertFalse($kid);
    }

    public function testGetBalanceEmpty(): void
    {
        $kidId = Kid::create($this->db, 1, 'Alice');
        $balance = Kid::getBalance($this->db, $kidId);
        $this->assertEquals(0.0, $balance);
    }

    public function testGetBalanceWithTransactions(): void
    {
        $kidId = Kid::create($this->db, 1, 'Alice');

        Transaction::create($this->db, $kidId, 'credit', 'allowance', 10.00);
        Transaction::create($this->db, $kidId, 'credit', 'gift', 5.50);
        Transaction::create($this->db, $kidId, 'debit', 'spending', 3.25);

        $balance = Kid::getBalance($this->db, $kidId);
        $this->assertEquals(12.25, $balance);
    }

    public function testUserIsolation(): void
    {
        // Create a second user
        User::create($this->db, 'other@test.com', 'password123', 'Other Parent');

        Kid::create($this->db, 1, 'Alice');
        Kid::create($this->db, 2, 'Charlie');

        $user1Kids = Kid::getByUser($this->db, 1);
        $user2Kids = Kid::getByUser($this->db, 2);

        $this->assertCount(1, $user1Kids);
        $this->assertCount(1, $user2Kids);
        $this->assertEquals('Alice', $user1Kids[0]['name']);
        $this->assertEquals('Charlie', $user2Kids[0]['name']);
    }
}
