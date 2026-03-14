import { useState, useEffect, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import type { Kid, Transaction } from '../types';
import * as api from '../api/client';

export default function MoneyPage() {
  const [kids, setKids] = useState<Kid[]>([]);
  const [recentTransactions, setRecentTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Add kid form
  const [showAddKid, setShowAddKid] = useState(false);
  const [newKidName, setNewKidName] = useState('');
  const [newKidColor, setNewKidColor] = useState('#4A90D9');
  const [newKidAvatar, setNewKidAvatar] = useState('');
  const [adding, setAdding] = useState(false);

  // Quick add transaction
  const [quickKidId, setQuickKidId] = useState<number | 'all' | null>(null);
  const [quickType, setQuickType] = useState<'credit' | 'debit'>('credit');
  const [quickAmount, setQuickAmount] = useState('');
  const [quickCategory, setQuickCategory] = useState('');
  const [quickDesc, setQuickDesc] = useState('');
  const [quickDate, setQuickDate] = useState(new Date().toISOString().split('T')[0]);

  useEffect(() => {
    loadDashboard();
  }, []);

  async function loadDashboard() {
    try {
      const data = await api.getDashboard();
      setKids(data.kids);
      setRecentTransactions(data.recent_transactions);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load dashboard');
    } finally {
      setLoading(false);
    }
  }

  async function handleAddKid(e: FormEvent) {
    e.preventDefault();
    setAdding(true);
    try {
      await api.createKid({ name: newKidName, color: newKidColor, avatar: newKidAvatar });
      setNewKidName('');
      setNewKidColor('#4A90D9');
      setNewKidAvatar('');
      setShowAddKid(false);
      loadDashboard();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to add kid');
    } finally {
      setAdding(false);
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
      loadDashboard();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to add transaction');
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

  return (
    <div>
      <div className="section-header">
        <h1>Money</h1>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button onClick={() => setShowAddKid(!showAddKid)} className="btn btn-primary">
            + Add Kid
          </button>
        </div>
      </div>

      {error && <div className="error-message">{error}</div>}

      {showAddKid && (
        <div className="card" style={{ marginBottom: '1.5rem' }}>
          <h3>Add a Kid</h3>
          <form onSubmit={handleAddKid}>
            <div className="form-row">
              <div className="form-group form-group-grow">
                <label htmlFor="kidName">Name</label>
                <input id="kidName" type="text" value={newKidName} onChange={e => setNewKidName(e.target.value)} required placeholder="Kid's name" />
              </div>
              <div className="form-group">
                <label htmlFor="kidColor">Color</label>
                <input id="kidColor" type="color" value={newKidColor} onChange={e => setNewKidColor(e.target.value)} style={{ height: '38px', padding: '2px' }} />
              </div>
              <div className="form-group">
                <label htmlFor="kidAvatar">Avatar (emoji)</label>
                <input id="kidAvatar" type="text" value={newKidAvatar} onChange={e => setNewKidAvatar(e.target.value)} placeholder="e.g. &#128522;" style={{ width: '80px' }} />
              </div>
            </div>
            <div className="form-actions">
              <button type="submit" className="btn btn-primary" disabled={adding}>{adding ? 'Adding...' : 'Add Kid'}</button>
              <button type="button" className="btn btn-outline" onClick={() => setShowAddKid(false)}>Cancel</button>
            </div>
          </form>
        </div>
      )}

      {kids.length === 0 ? (
        <div className="empty-state">
          <p>No kids added yet. Click "Add Kid" to get started!</p>
        </div>
      ) : (
        <>
          <div className="list-grid" style={{ marginBottom: '2rem' }}>
            {kids.map(kid => (
              <Link to={`/kids/${kid.id}`} key={kid.id} className="list-card">
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
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
                {kid.recurring && kid.recurring.length > 0 && (
                  <div className="list-card-meta">
                    <span>{kid.recurring.length} recurring transaction(s)</span>
                  </div>
                )}
                {kid.goals && kid.goals.length > 0 && (
                  <div className="list-card-meta">
                    <span>{kid.goals.filter(g => !g.is_completed).length} active goal(s)</span>
                  </div>
                )}
                {(kid.pending_count ?? 0) > 0 && (
                  <div className="list-card-meta">
                    <span className="status-badge status-pending">{kid.pending_count} pending</span>
                  </div>
                )}
              </Link>
            ))}
          </div>

          {/* Quick Add Transaction */}
          <div className="card" style={{ marginBottom: '2rem' }}>
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

          {/* Recent Transactions */}
          {recentTransactions.length > 0 && (
            <div>
              <h2>Recent Activity</h2>
              <div className="items-list">
                {recentTransactions.map(tx => (
                  <div key={tx.id} className="item-card">
                    <div className="item-details">
                      <div className="item-header">
                        <span className="item-name">{tx.kid_name}</span>
                        <span className={`status-badge status-${tx.status}`}>{tx.status}</span>
                        {tx.category && <span style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>{tx.category}</span>}
                      </div>
                      {tx.description && <div className="item-desc">{tx.description}</div>}
                      <div className="item-qty">{formatDate(tx.transaction_date)}</div>
                    </div>
                    <div style={{
                      fontSize: '1rem', fontWeight: 600,
                      color: tx.type === 'credit' ? 'var(--color-success)' : 'var(--color-danger)'
                    }}>
                      {tx.type === 'credit' ? '+' : '-'}{formatCurrency(Number(tx.amount))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
