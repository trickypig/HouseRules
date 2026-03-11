import { useState, useEffect, type FormEvent } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import type { Kid, Transaction, AllowanceRule, SavingsGoal, Pagination } from '../types';
import * as api from '../api/client';

export default function KidDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const kidId = Number(id);

  const [kid, setKid] = useState<Kid | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [allowance, setAllowance] = useState<AllowanceRule | null>(null);
  const [goals, setGoals] = useState<SavingsGoal[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Edit kid
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState('');
  const [editColor, setEditColor] = useState('');
  const [editAvatar, setEditAvatar] = useState('');

  // Add transaction form
  const [showAddTx, setShowAddTx] = useState(false);
  const [txType, setTxType] = useState<'credit' | 'debit'>('credit');
  const [txCategory, setTxCategory] = useState('');
  const [txAmount, setTxAmount] = useState('');
  const [txDesc, setTxDesc] = useState('');
  const [txDate, setTxDate] = useState(new Date().toISOString().split('T')[0]);

  // Allowance form
  const [showAllowanceForm, setShowAllowanceForm] = useState(false);
  const [alAmount, setAlAmount] = useState('');
  const [alFrequency, setAlFrequency] = useState('weekly');
  const [alDayOfWeek, setAlDayOfWeek] = useState('0');
  const [alDayOfMonth, setAlDayOfMonth] = useState('1');

  // Goal form
  const [showGoalForm, setShowGoalForm] = useState(false);
  const [goalName, setGoalName] = useState('');
  const [goalTarget, setGoalTarget] = useState('');

  // Goal deposit/withdraw
  const [goalAction, setGoalAction] = useState<{ id: number; type: 'deposit' | 'withdraw' } | null>(null);
  const [goalActionAmount, setGoalActionAmount] = useState('');

  useEffect(() => {
    loadData();
  }, [kidId]); // eslint-disable-line react-hooks/exhaustive-deps

  async function loadData() {
    try {
      const [kidRes, txRes, alRes, goalsRes] = await Promise.all([
        api.getKid(kidId),
        api.getTransactions(kidId),
        api.getAllowance(kidId),
        api.getGoals(kidId),
      ]);
      setKid(kidRes.kid);
      setTransactions(txRes.transactions);
      setPagination(txRes.pagination);
      setAllowance(alRes.allowance);
      setGoals(goalsRes.goals);
      setEditName(kidRes.kid.name);
      setEditColor(kidRes.kid.color);
      setEditAvatar(kidRes.kid.avatar);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load data');
    } finally {
      setLoading(false);
    }
  }

  async function handleUpdateKid(e: FormEvent) {
    e.preventDefault();
    try {
      await api.updateKid(kidId, { name: editName, color: editColor, avatar: editAvatar });
      setEditing(false);
      loadData();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to update');
    }
  }

  async function handleDeleteKid() {
    if (!confirm(`Delete ${kid?.name}? This will remove all their transactions, allowance rules, and goals.`)) return;
    try {
      await api.deleteKid(kidId);
      navigate('/dashboard');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to delete');
    }
  }

  async function handleAddTransaction(e: FormEvent) {
    e.preventDefault();
    try {
      await api.createTransaction(kidId, {
        type: txType,
        category: txCategory,
        amount: parseFloat(txAmount),
        description: txDesc,
        transaction_date: txDate,
      });
      setShowAddTx(false);
      setTxAmount('');
      setTxDesc('');
      setTxCategory('');
      loadData();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to add transaction');
    }
  }

  async function handleDeleteTransaction(txId: number) {
    try {
      await api.deleteTransaction(txId);
      loadData();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to delete transaction');
    }
  }

  async function handleSetAllowance(e: FormEvent) {
    e.preventDefault();
    try {
      await api.setAllowance(kidId, {
        amount: parseFloat(alAmount),
        frequency: alFrequency,
        day_of_week: alFrequency !== 'monthly' ? Number(alDayOfWeek) : undefined,
        day_of_month: alFrequency === 'monthly' ? Number(alDayOfMonth) : undefined,
      });
      setShowAllowanceForm(false);
      loadData();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to set allowance');
    }
  }

  async function handleRemoveAllowance() {
    try {
      await api.removeAllowance(kidId);
      loadData();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to remove allowance');
    }
  }

  async function handleAddGoal(e: FormEvent) {
    e.preventDefault();
    try {
      await api.createGoal(kidId, {
        name: goalName,
        target_amount: goalTarget ? parseFloat(goalTarget) : null,
      });
      setShowGoalForm(false);
      setGoalName('');
      setGoalTarget('');
      loadData();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to create goal');
    }
  }

  async function handleDeleteGoal(goalId: number) {
    try {
      await api.deleteGoal(goalId);
      loadData();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to delete goal');
    }
  }

  async function handleGoalAction(e: FormEvent) {
    e.preventDefault();
    if (!goalAction) return;
    try {
      const amount = parseFloat(goalActionAmount);
      if (goalAction.type === 'deposit') {
        await api.depositToGoal(goalAction.id, amount);
      } else {
        await api.withdrawFromGoal(goalAction.id, amount);
      }
      setGoalAction(null);
      setGoalActionAmount('');
      loadData();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed');
    }
  }

  async function loadPage(page: number) {
    try {
      const res = await api.getTransactions(kidId, { page });
      setTransactions(res.transactions);
      setPagination(res.pagination);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load');
    }
  }

  function formatCurrency(amount: number): string {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);
  }

  function formatDate(dateStr: string): string {
    return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  }

  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

  if (loading) return <div className="loading-container"><div className="spinner" /><p>Loading...</p></div>;
  if (!kid) return <div className="error-page"><h2>Kid not found</h2><Link to="/dashboard">Back to Dashboard</Link></div>;

  return (
    <div className="page">
      <div style={{ marginBottom: '1rem' }}>
        <Link to="/dashboard" className="btn btn-ghost">&larr; Dashboard</Link>
      </div>

      {error && <div className="error-message">{error}</div>}

      {/* Kid Header */}
      <div className="card" style={{ marginBottom: '1.5rem' }}>
        {editing ? (
          <form onSubmit={handleUpdateKid}>
            <div className="form-row">
              <div className="form-group form-group-grow">
                <label>Name</label>
                <input type="text" value={editName} onChange={e => setEditName(e.target.value)} required />
              </div>
              <div className="form-group">
                <label>Color</label>
                <input type="color" value={editColor} onChange={e => setEditColor(e.target.value)} style={{ height: '38px' }} />
              </div>
              <div className="form-group">
                <label>Avatar</label>
                <input type="text" value={editAvatar} onChange={e => setEditAvatar(e.target.value)} style={{ width: '80px' }} />
              </div>
            </div>
            <div className="form-actions">
              <button type="submit" className="btn btn-primary">Save</button>
              <button type="button" className="btn btn-outline" onClick={() => setEditing(false)}>Cancel</button>
              <button type="button" className="btn btn-danger" onClick={handleDeleteKid}>Delete Kid</button>
            </div>
          </form>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
              <div style={{
                width: 56, height: 56, borderRadius: '50%', background: kid.color,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: kid.avatar ? '1.5rem' : '1.4rem', color: '#fff', fontWeight: 700
              }}>
                {kid.avatar || kid.name.charAt(0).toUpperCase()}
              </div>
              <div>
                <h1 style={{ marginBottom: '0.25rem' }}>{kid.name}</h1>
                <div style={{ fontSize: '1.5rem', fontWeight: 700, color: kid.balance >= 0 ? 'var(--color-success)' : 'var(--color-danger)' }}>
                  {formatCurrency(kid.balance)}
                </div>
              </div>
            </div>
            <button onClick={() => setEditing(true)} className="btn btn-outline">Edit</button>
          </div>
        )}
      </div>

      {/* Allowance Section */}
      <div className="card" style={{ marginBottom: '1.5rem' }}>
        <div className="section-header" style={{ marginBottom: '0.75rem' }}>
          <h2>Allowance</h2>
          {allowance && !showAllowanceForm && (
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button onClick={() => { setShowAllowanceForm(true); setAlAmount(String(allowance.amount)); setAlFrequency(allowance.frequency); }} className="btn btn-sm btn-outline">Edit</button>
              <button onClick={handleRemoveAllowance} className="btn btn-sm btn-ghost">Remove</button>
            </div>
          )}
        </div>
        {showAllowanceForm ? (
          <form onSubmit={handleSetAllowance}>
            <div className="form-row">
              <div className="form-group form-group-grow">
                <label>Amount</label>
                <input type="number" step="0.01" min="0.01" value={alAmount} onChange={e => setAlAmount(e.target.value)} required />
              </div>
              <div className="form-group form-group-grow">
                <label>Frequency</label>
                <select value={alFrequency} onChange={e => setAlFrequency(e.target.value)}>
                  <option value="weekly">Weekly</option>
                  <option value="biweekly">Biweekly</option>
                  <option value="monthly">Monthly</option>
                </select>
              </div>
              {alFrequency !== 'monthly' ? (
                <div className="form-group form-group-grow">
                  <label>Day of Week</label>
                  <select value={alDayOfWeek} onChange={e => setAlDayOfWeek(e.target.value)}>
                    {dayNames.map((d, i) => <option key={i} value={i}>{d}</option>)}
                  </select>
                </div>
              ) : (
                <div className="form-group form-group-grow">
                  <label>Day of Month</label>
                  <input type="number" min="1" max="28" value={alDayOfMonth} onChange={e => setAlDayOfMonth(e.target.value)} />
                </div>
              )}
            </div>
            <div className="form-actions">
              <button type="submit" className="btn btn-primary">Save Allowance</button>
              <button type="button" className="btn btn-outline" onClick={() => setShowAllowanceForm(false)}>Cancel</button>
            </div>
          </form>
        ) : allowance ? (
          <div>
            <p><strong>{formatCurrency(Number(allowance.amount))}</strong> {allowance.frequency}</p>
            <p className="text-muted">Next due: {formatDate(allowance.next_due)}</p>
          </div>
        ) : (
          <div>
            <p className="text-muted">No allowance configured.</p>
            <button onClick={() => setShowAllowanceForm(true)} className="btn btn-sm btn-outline">Set Up Allowance</button>
          </div>
        )}
      </div>

      {/* Savings Goals */}
      <div className="card" style={{ marginBottom: '1.5rem' }}>
        <div className="section-header" style={{ marginBottom: '0.75rem' }}>
          <h2>Savings Goals</h2>
          <button onClick={() => setShowGoalForm(!showGoalForm)} className="btn btn-sm btn-primary">+ Add Goal</button>
        </div>
        {showGoalForm && (
          <form onSubmit={handleAddGoal} style={{ marginBottom: '1rem' }}>
            <div className="form-row">
              <div className="form-group form-group-grow">
                <label>Goal Name</label>
                <input type="text" value={goalName} onChange={e => setGoalName(e.target.value)} required placeholder="e.g. New Bike" />
              </div>
              <div className="form-group">
                <label>Target Amount (optional)</label>
                <input type="number" step="0.01" min="0" value={goalTarget} onChange={e => setGoalTarget(e.target.value)} placeholder="0.00" />
              </div>
            </div>
            <div className="form-actions">
              <button type="submit" className="btn btn-primary">Create Goal</button>
              <button type="button" className="btn btn-outline" onClick={() => setShowGoalForm(false)}>Cancel</button>
            </div>
          </form>
        )}
        {goals.length === 0 ? (
          <p className="text-muted">No savings goals yet.</p>
        ) : (
          <div className="items-list">
            {goals.map(goal => {
              const progress = goal.target_amount ? Math.min(100, (Number(goal.current_amount) / Number(goal.target_amount)) * 100) : null;
              return (
                <div key={goal.id} className="item-card">
                  <div className="item-details">
                    <div className="item-header">
                      <span className="item-name">{goal.name}</span>
                      {goal.is_completed ? <span style={{ fontSize: '0.75rem', color: 'var(--color-success)', fontWeight: 600 }}>COMPLETED</span> : null}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginTop: '0.3rem' }}>
                      <span style={{ fontWeight: 600 }}>{formatCurrency(Number(goal.current_amount))}</span>
                      {goal.target_amount && <span className="text-muted">of {formatCurrency(Number(goal.target_amount))}</span>}
                    </div>
                    {progress !== null && (
                      <div className="purchase-progress" style={{ marginTop: '0.3rem' }}>
                        <div className="purchase-bar" style={{ width: '150px' }}>
                          <div className="purchase-bar-fill" style={{ width: `${progress}%` }} />
                        </div>
                        <span className="purchase-text">{progress.toFixed(0)}%</span>
                      </div>
                    )}
                    {goalAction?.id === goal.id && (
                      <form onSubmit={handleGoalAction} className="inline-form-row" style={{ marginTop: '0.5rem' }}>
                        <input type="number" step="0.01" min="0.01" value={goalActionAmount} onChange={e => setGoalActionAmount(e.target.value)} required placeholder="Amount" style={{ maxWidth: '120px' }} />
                        <button type="submit" className="btn btn-sm btn-primary">{goalAction.type === 'deposit' ? 'Deposit' : 'Withdraw'}</button>
                        <button type="button" className="btn btn-sm btn-ghost" onClick={() => setGoalAction(null)}>Cancel</button>
                      </form>
                    )}
                  </div>
                  <div className="item-actions">
                    <button onClick={() => setGoalAction({ id: goal.id, type: 'deposit' })} className="btn btn-sm btn-outline">+</button>
                    <button onClick={() => setGoalAction({ id: goal.id, type: 'withdraw' })} className="btn btn-sm btn-outline">-</button>
                    <button onClick={() => handleDeleteGoal(goal.id)} className="btn btn-sm btn-ghost">Del</button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Transactions */}
      <div className="section-header">
        <h2>Transactions</h2>
        <button onClick={() => setShowAddTx(!showAddTx)} className="btn btn-sm btn-primary">+ Add Transaction</button>
      </div>

      {showAddTx && (
        <div className="card" style={{ marginBottom: '1rem' }}>
          <form onSubmit={handleAddTransaction}>
            <div className="form-row">
              <div className="form-group">
                <label>Type</label>
                <select value={txType} onChange={e => setTxType(e.target.value as 'credit' | 'debit')}>
                  <option value="credit">Credit (+)</option>
                  <option value="debit">Debit (-)</option>
                </select>
              </div>
              <div className="form-group">
                <label>Category</label>
                <select value={txCategory} onChange={e => setTxCategory(e.target.value)}>
                  <option value="">None</option>
                  <option value="allowance">Allowance</option>
                  <option value="chore">Chore</option>
                  <option value="gift">Gift</option>
                  <option value="spending">Spending</option>
                  <option value="adjustment">Adjustment</option>
                </select>
              </div>
              <div className="form-group">
                <label>Amount</label>
                <input type="number" step="0.01" min="0.01" value={txAmount} onChange={e => setTxAmount(e.target.value)} required />
              </div>
              <div className="form-group">
                <label>Date</label>
                <input type="date" value={txDate} onChange={e => setTxDate(e.target.value)} required />
              </div>
            </div>
            <div className="form-group">
              <label>Description</label>
              <input type="text" value={txDesc} onChange={e => setTxDesc(e.target.value)} placeholder="What's this for?" />
            </div>
            <div className="form-actions">
              <button type="submit" className="btn btn-primary">Add</button>
              <button type="button" className="btn btn-outline" onClick={() => setShowAddTx(false)}>Cancel</button>
            </div>
          </form>
        </div>
      )}

      {transactions.length === 0 ? (
        <div className="empty-state"><p>No transactions yet.</p></div>
      ) : (
        <div className="items-list">
          {transactions.map(tx => (
            <div key={tx.id} className="item-card">
              <div className="item-details">
                <div className="item-header">
                  <span className="item-name">{tx.description || tx.category || tx.type}</span>
                  {tx.category && <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', textTransform: 'capitalize' }}>{tx.category}</span>}
                </div>
                <div className="item-qty">{formatDate(tx.transaction_date)}</div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span style={{
                  fontSize: '1rem', fontWeight: 600,
                  color: tx.type === 'credit' ? 'var(--color-success)' : 'var(--color-danger)'
                }}>
                  {tx.type === 'credit' ? '+' : '-'}{formatCurrency(Number(tx.amount))}
                </span>
                <button onClick={() => handleDeleteTransaction(tx.id)} className="btn btn-sm btn-ghost">x</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Pagination */}
      {pagination && pagination.total_pages > 1 && (
        <div className="admin-pagination">
          <button className="btn btn-sm btn-outline" disabled={pagination.page <= 1} onClick={() => loadPage(pagination!.page - 1)}>Prev</button>
          <span className="text-muted">Page {pagination.page} of {pagination.total_pages}</span>
          <button className="btn btn-sm btn-outline" disabled={pagination.page >= pagination.total_pages} onClick={() => loadPage(pagination!.page + 1)}>Next</button>
        </div>
      )}
    </div>
  );
}
