import { useState, useEffect, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import type { Kid, Transaction, ChoreInstance, ShoppingList } from '../types';
import * as api from '../api/client';

export default function DashboardPage() {
  const [kids, setKids] = useState<Kid[]>([]);
  const [pendingTransactions, setPendingTransactions] = useState<Transaction[]>([]);
  const [overdueChores, setOverdueChores] = useState<ChoreInstance[]>([]);
  const [completedChores, setCompletedChores] = useState<ChoreInstance[]>([]);
  const [shoppingLists, setShoppingLists] = useState<ShoppingList[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Quick add transaction
  const [showQuickTx, setShowQuickTx] = useState(false);
  const [quickKidId, setQuickKidId] = useState<number | 'all' | null>(null);
  const [quickType, setQuickType] = useState<'credit' | 'debit'>('credit');
  const [quickAmount, setQuickAmount] = useState('');
  const [quickCategory, setQuickCategory] = useState('');
  const [quickDesc, setQuickDesc] = useState('');
  const [quickDate, setQuickDate] = useState(new Date().toISOString().split('T')[0]);

  useEffect(() => { loadDashboard(); }, []);

  async function loadDashboard() {
    try {
      const data = await api.getDashboard();
      setKids(data.kids);
      setPendingTransactions(data.pending_transactions);
      setOverdueChores(data.overdue_chores);
      setCompletedChores(data.completed_chores);
      setShoppingLists(data.shopping_lists);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load dashboard');
    } finally {
      setLoading(false);
    }
  }

  async function handleQuickTransaction(e: FormEvent) {
    e.preventDefault();
    if (!quickKidId) return;
    try {
      const targetKidIds = quickKidId === 'all' ? kids.map(k => k.id) : [quickKidId];
      const txData = {
        type: quickType,
        category: quickCategory,
        amount: parseFloat(quickAmount),
        description: quickDesc,
        transaction_date: quickDate,
      };
      await Promise.all(targetKidIds.map(id => api.createTransaction(id, txData)));
      setQuickKidId(null);
      setQuickAmount('');
      setQuickCategory('');
      setQuickDesc('');
      setQuickDate(new Date().toISOString().split('T')[0]);
      setShowQuickTx(false);
      loadDashboard();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to add transaction');
    }
  }

  async function handleVerifyTx(id: number) {
    try {
      await api.verifyTransaction(id);
      loadDashboard();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to verify');
    }
  }

  async function handleCancelTx(id: number) {
    try {
      await api.cancelTransaction(id);
      loadDashboard();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to cancel');
    }
  }

  async function handleVerifyChore(id: number) {
    try {
      await api.verifyChore(id);
      loadDashboard();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to verify');
    }
  }

  async function handleRejectChore(id: number) {
    try {
      await api.rejectChore(id);
      loadDashboard();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to reject');
    }
  }

  function formatCurrency(amount: number): string {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);
  }

  function formatDate(dateStr: string): string {
    return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }

  if (loading) {
    return <div className="loading-container"><div className="spinner" /><p>Loading...</p></div>;
  }

  const needsAttention = pendingTransactions.length > 0 || completedChores.length > 0 || overdueChores.length > 0;

  return (
    <div>
      <div className="section-header">
        <h1>Dashboard</h1>
        <button onClick={() => setShowQuickTx(!showQuickTx)} className="btn btn-primary">
          + Quick Transaction
        </button>
      </div>

      {error && <div className="error-message">{error}</div>}

      {/* Quick Transaction (collapsible) */}
      {showQuickTx && kids.length > 0 && (
        <div className="card" style={{ marginBottom: '1.5rem' }}>
          <h3>Quick Transaction</h3>
          <form onSubmit={handleQuickTransaction}>
            <div className="form-row">
              <div className="form-group form-group-grow">
                <label htmlFor="qKid">Kid</label>
                <select id="qKid" value={quickKidId ?? ''} onChange={e => { const v = e.target.value; setQuickKidId(v === 'all' ? 'all' : v ? Number(v) : null); }} required>
                  <option value="">Select kid...</option>
                  {kids.length > 1 && <option value="all">All Kids</option>}
                  {kids.map(k => <option key={k.id} value={k.id}>{k.name}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label htmlFor="qType">Type</label>
                <select id="qType" value={quickType} onChange={e => setQuickType(e.target.value as 'credit' | 'debit')}>
                  <option value="credit">Credit (+)</option>
                  <option value="debit">Debit (-)</option>
                </select>
              </div>
              <div className="form-group">
                <label htmlFor="qCategory">Category</label>
                <select id="qCategory" value={quickCategory} onChange={e => setQuickCategory(e.target.value)}>
                  <option value="">None</option>
                  <option value="allowance">Allowance</option>
                  <option value="chore">Chore</option>
                  <option value="gift">Gift</option>
                  <option value="spending">Spending</option>
                  <option value="adjustment">Adjustment</option>
                </select>
              </div>
              <div className="form-group">
                <label htmlFor="qAmount">Amount</label>
                <input id="qAmount" type="number" step="0.01" min="0.01" value={quickAmount} onChange={e => setQuickAmount(e.target.value)} required placeholder="0.00" />
              </div>
            </div>
            <div className="form-row">
              <div className="form-group form-group-grow">
                <label htmlFor="qDesc">Description (optional)</label>
                <input id="qDesc" type="text" value={quickDesc} onChange={e => setQuickDesc(e.target.value)} placeholder="What's this for?" />
              </div>
              <div className="form-group">
                <label htmlFor="qDate">Date</label>
                <input id="qDate" type="date" value={quickDate} onChange={e => setQuickDate(e.target.value)} required />
              </div>
              <div className="form-group" style={{ display: 'flex', alignItems: 'flex-end' }}>
                <button type="submit" className="btn btn-primary">Add</button>
              </div>
            </div>
          </form>
        </div>
      )}

      {/* Kid Cards */}
      {kids.length === 0 ? (
        <div className="empty-state">
          <p>No kids added yet. Go to <Link to="/money">Money</Link> to add kids.</p>
        </div>
      ) : (
        <div className="list-grid" style={{ marginBottom: '1.5rem' }}>
          {kids.map(kid => (
            <Link to={`/kids/${kid.id}`} key={kid.id} className="list-card">
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <div className="kid-avatar" style={{
                  width: 40, height: 40, borderRadius: '50%', background: kid.color,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: kid.avatar ? '1.25rem' : '1rem', color: '#fff', fontWeight: 700
                }}>
                  {kid.avatar || kid.name.charAt(0).toUpperCase()}
                </div>
                <div>
                  <div className="list-card-title">{kid.name}</div>
                  <div style={{ fontSize: '1.1rem', fontWeight: 700, color: kid.balance >= 0 ? 'var(--color-success)' : 'var(--color-danger)' }}>
                    {formatCurrency(kid.balance)}
                  </div>
                </div>
              </div>
              {(kid.pending_count ?? 0) > 0 && (
                <div className="list-card-meta" style={{ marginTop: '0.5rem' }}>
                  <span className="status-badge status-pending">{kid.pending_count} pending</span>
                </div>
              )}
            </Link>
          ))}
        </div>
      )}

      {/* Needs Attention Section */}
      {needsAttention && (
        <div className="side-cards" style={{ marginBottom: '1.5rem' }}>
          {/* Pending Transactions */}
          {pendingTransactions.length > 0 && (
            <div className="card">
              <div className="section-header" style={{ marginBottom: '0.75rem' }}>
                <h2>Needs Approval</h2>
                <span className="status-badge status-pending">{pendingTransactions.length}</span>
              </div>
              <div className="items-list">
                {pendingTransactions.map(tx => (
                  <div key={tx.id} className="item-card">
                    <div className="item-details">
                      <div className="item-header">
                        <span className="item-name">{tx.kid_name}</span>
                        <span className={`status-badge status-${tx.status}`}>{tx.status}</span>
                      </div>
                      {tx.description && <div className="item-desc">{tx.description}</div>}
                      <div className="item-qty">
                        {tx.type === 'credit' ? '+' : '-'}{formatCurrency(Number(tx.amount))} &middot; {formatDate(tx.transaction_date)}
                      </div>
                    </div>
                    <div className="item-actions" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.25rem' }}>
                      <button onClick={() => handleVerifyTx(tx.id)} className="btn btn-sm btn-primary">Approve</button>
                      <button onClick={() => handleCancelTx(tx.id)} className="btn btn-sm btn-ghost" style={{ color: 'var(--color-danger)' }}>Deny</button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Chores needing attention */}
          {(completedChores.length > 0 || overdueChores.length > 0) && (
            <div className="card">
              <div className="section-header" style={{ marginBottom: '0.75rem' }}>
                <h2>Chores</h2>
                <Link to="/chores" className="btn btn-sm btn-outline">View All</Link>
              </div>
              {completedChores.length > 0 && (
                <>
                  <h3 style={{ fontSize: '0.9rem', color: 'var(--color-text-muted)', marginBottom: '0.5rem' }}>Awaiting Verification</h3>
                  <div className="items-list" style={{ marginBottom: '1rem' }}>
                    {completedChores.map(chore => (
                      <div key={chore.id} className="item-card">
                        <div className="item-details">
                          <div className="item-header">
                            <span className="item-name">{chore.title}</span>
                            {chore.amount != null && <span className="badge badge-success">${Number(chore.amount).toFixed(2)}</span>}
                          </div>
                          <div className="item-qty">
                            {chore.kid_name || chore.claimed_by_name || 'Unassigned'} &middot; {formatDate(chore.due_date)}
                          </div>
                        </div>
                        <div className="item-actions" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.25rem' }}>
                          <button onClick={() => handleVerifyChore(chore.id)} className="btn btn-sm btn-primary">Verify</button>
                          <button onClick={() => handleRejectChore(chore.id)} className="btn btn-sm btn-ghost">Reject</button>
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}
              {overdueChores.length > 0 && (
                <>
                  <h3 style={{ fontSize: '0.9rem', color: 'var(--color-danger)', marginBottom: '0.5rem' }}>Overdue</h3>
                  <div className="items-list">
                    {overdueChores.slice(0, 10).map(chore => (
                      <div key={chore.id} className="item-card">
                        <div className="item-details">
                          <div className="item-header">
                            <span className="item-name">{chore.title}</span>
                            {chore.amount != null && <span className="badge badge-success">${Number(chore.amount).toFixed(2)}</span>}
                          </div>
                          <div className="item-qty" style={{ color: 'var(--color-danger)' }}>
                            {chore.kid_name || chore.claimed_by_name || 'Unassigned'} &middot; Due {formatDate(chore.due_date)}
                          </div>
                        </div>
                        <span style={{ color: 'var(--color-danger)', fontWeight: 500, fontSize: '0.85rem' }}>Missed</span>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      )}

      {/* Shopping Lists */}
      {shoppingLists.length > 0 && (
        <div className="card">
          <div className="section-header" style={{ marginBottom: '0.75rem' }}>
            <h2>Shopping Lists</h2>
            <Link to="/shopping" className="btn btn-sm btn-outline">View All</Link>
          </div>
          <div className="items-list">
            {shoppingLists.map(list => (
              <Link key={list.id} to={`/shopping/${list.id}`} className="item-card" style={{ textDecoration: 'none', color: 'inherit' }}>
                <div className="item-details">
                  <span className="item-name">{list.name}</span>
                </div>
                <span style={{ color: 'var(--color-text-muted)', fontWeight: 500 }}>
                  {list.unpurchased_count ?? 0} item{(list.unpurchased_count ?? 0) !== 1 ? 's' : ''}
                </span>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
