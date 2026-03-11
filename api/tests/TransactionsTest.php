<?php

use PHPUnit\Framework\TestCase;

class TransactionsTest extends TestCase
{
    private PDO $db;
    private int $kidId;

    protected function setUp(): void
    {
        $this->db = createTestDatabase();
        User::create($this->db, 'parent@test.com', 'password123', 'Test Parent');
        $this->kidId = Kid::create($this->db, 1, 'Alice');
    }

    public function testCreateTransaction(): void
    {
        $txId = Transaction::create($this->db, $this->kidId, 'credit', 'allowance', 10.00, 'Weekly allowance');
        $this->assertGreaterThan(0, $txId);

        $tx = Transaction::getById($this->db, $txId);
        $this->assertEquals('credit', $tx['type']);
        $this->assertEquals('allowance', $tx['category']);
        $this->assertEquals(10.00, (float) $tx['amount']);
        $this->assertEquals('Weekly allowance', $tx['description']);
    }

    public function testAmountAlwaysPositive(): void
    {
        $txId = Transaction::create($this->db, $this->kidId, 'debit', 'spending', -5.00);
        $tx = Transaction::getById($this->db, $txId);
        $this->assertEquals(5.00, (float) $tx['amount']);
    }

    public function testInvalidType(): void
    {
        $this->expectException(InvalidArgumentException::class);
        Transaction::create($this->db, $this->kidId, 'invalid', '', 10.00);
    }

    public function testInvalidCategory(): void
    {
        $this->expectException(InvalidArgumentException::class);
        Transaction::create($this->db, $this->kidId, 'credit', 'invalid_category', 10.00);
    }

    public function testGetByKidWithPagination(): void
    {
        for ($i = 0; $i < 30; $i++) {
            Transaction::create($this->db, $this->kidId, 'credit', 'allowance', 1.00, "tx $i");
        }

        $result = Transaction::getByKid($this->db, $this->kidId, ['per_page' => 10]);
        $this->assertCount(10, $result['transactions']);
        $this->assertEquals(30, $result['pagination']['total']);
        $this->assertEquals(3, $result['pagination']['total_pages']);
    }

    public function testFilterByType(): void
    {
        Transaction::create($this->db, $this->kidId, 'credit', 'allowance', 10.00);
        Transaction::create($this->db, $this->kidId, 'debit', 'spending', 5.00);

        $credits = Transaction::getByKid($this->db, $this->kidId, ['type' => 'credit']);
        $debits = Transaction::getByKid($this->db, $this->kidId, ['type' => 'debit']);

        $this->assertCount(1, $credits['transactions']);
        $this->assertCount(1, $debits['transactions']);
    }

    public function testUpdateTransaction(): void
    {
        $txId = Transaction::create($this->db, $this->kidId, 'credit', 'allowance', 10.00, 'Original');
        Transaction::update($this->db, $txId, 'debit', 'spending', 5.00, 'Updated', '2026-03-01');

        $tx = Transaction::getById($this->db, $txId);
        $this->assertEquals('debit', $tx['type']);
        $this->assertEquals('spending', $tx['category']);
        $this->assertEquals(5.00, (float) $tx['amount']);
        $this->assertEquals('Updated', $tx['description']);
    }

    public function testDeleteTransaction(): void
    {
        $txId = Transaction::create($this->db, $this->kidId, 'credit', 'allowance', 10.00);
        Transaction::delete($this->db, $txId);

        $tx = Transaction::getById($this->db, $txId);
        $this->assertFalse($tx);
    }

    public function testBalanceAfterMultipleOperations(): void
    {
        Transaction::create($this->db, $this->kidId, 'credit', 'allowance', 20.00);
        Transaction::create($this->db, $this->kidId, 'credit', 'chore', 5.00);
        Transaction::create($this->db, $this->kidId, 'debit', 'spending', 8.50);
        Transaction::create($this->db, $this->kidId, 'credit', 'gift', 15.00);
        Transaction::create($this->db, $this->kidId, 'debit', 'spending', 12.00);

        $balance = Kid::getBalance($this->db, $this->kidId);
        $this->assertEquals(19.50, $balance);
    }

    public function testGetRecent(): void
    {
        $kid2Id = Kid::create($this->db, 1, 'Bob');
        Transaction::create($this->db, $this->kidId, 'credit', 'allowance', 10.00);
        Transaction::create($this->db, $kid2Id, 'credit', 'gift', 5.00);

        $recent = Transaction::getRecent($this->db, [$this->kidId, $kid2Id], 5);
        $this->assertCount(2, $recent);
        $this->assertArrayHasKey('kid_name', $recent[0]);
    }
}
