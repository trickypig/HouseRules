import { useState, useEffect, type FormEvent } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import type { Kid, Transaction, RecurringTransaction, SavingsGoal, GoalProjection, Pagination, KidUser } from '../types';
import * as api from '../api/client';

export default function KidDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const kidId = Number(id);

  const [kid, setKid] = useState<Kid | null>(null);
  const [pastTransactions, setPastTransactions] = useState<Transaction[]>([]);
  const [pastDateBalances, setPastDateBalances] = useState<Record<string, number>>({});
  const [pastPagination, setPastPagination] = useState<Pagination | null>(null);
  const [futureTransactions, setFutureTransactions] = useState<Transaction[]>([]);
  const [recurring, setRecurring] = useState<RecurringTransaction[]>([]);
  const [goals, setGoals] = useState<SavingsGoal[]>([]);
  const [kidUser, setKidUser] = useState<KidUser | null>(null);
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

  // Recurring form
  const [showRecurringForm, setShowRecurringForm] = useState(false);
  const [editingRecId, setEditingRecId] = useState<number | null>(null);
  const [recType, setRecType] = useState<'credit' | 'debit'>('credit');
  const [recCategory, setRecCategory] = useState('allowance');
  const [recAmount, setRecAmount] = useState('');
  const [recDesc, setRecDesc] = useState('');
  const [recFrequency, setRecFrequency] = useState('weekly');
  const [recDayOfWeek, setRecDayOfWeek] = useState('0');
  const [recDayOfMonth, setRecDayOfMonth] = useState('1');
  const [recStartDate, setRecStartDate] = useState(new Date().toISOString().split('T')[0]);

  // Goal form
  const [showGoalForm, setShowGoalForm] = useState(false);
  const [goalName, setGoalName] = useState('');
  const [goalTarget, setGoalTarget] = useState('');
  const [goalWantBy, setGoalWantBy] = useState('');
  const [projections, setProjections] = useState<GoalProjection[]>([]);
  const [editingGoalId, setEditingGoalId] = useState<number | null>(null);
  const [editGoalName, setEditGoalName] = useState('');
  const [editGoalTarget, setEditGoalTarget] = useState('');
  const [editGoalWantBy, setEditGoalWantBy] = useState('');


  // Kid login form
  const [showKidLoginForm, setShowKidLoginForm] = useState(false);
  const [kidEmail, setKidEmail] = useState('');
  const [kidPassword, setKidPassword] = useState('');

  useEffect(() => {
    loadData();
  }, [kidId]); // eslint-disable-line react-hooks/exhaustive-deps

  async function loadData() {
    try {
      const today = new Date().toISOString().split('T')[0];
      const tomorrow = new Date(Date.now() + 86400000).toISOString().split('T')[0];
      const [kidRes, pastTxRes, futureTxRes, recRes, goalsRes, projectionsRes, kidUsersRes] = await Promise.all([
        api.getKid(kidId),
        api.getTransactions(kidId, { to: today }),
        api.getTransactions(kidId, { from: tomorrow, per_page: 100 }),
        api.getRecurring(kidId),
        api.getGoals(kidId),
        api.getGoalProjections(kidId),
        api.getKidUsers(),
      ]);
      setKid(kidRes.kid);
      setPastTransactions(pastTxRes.transactions);
      setPastDateBalances(pastTxRes.date_balances);
      setPastPagination(pastTxRes.pagination);
      setFutureTransactions(futureTxRes.transactions);
      setRecurring(recRes.recurring);
      setGoals(goalsRes.goals);
      setProjections(projectionsRes.projections);
      setEditName(kidRes.kid.name);
      setEditColor(kidRes.kid.color);
      setEditAvatar(kidRes.kid.avatar);

      const linkedUser = kidUsersRes.kid_users.find(u => u.kid_id === kidId);
      setKidUser(linkedUser ?? null);
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
    if (!confirm(`Delete ${kid?.name}? This will remove all their transactions, recurring rules, and goals.`)) return;
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

  async function handleVerify(txId: number) {
    try {
      await api.verifyTransaction(txId);
      loadData();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to verify');
    }
  }

  async function handleCancel(txId: number) {
    try {
      await api.cancelTransaction(txId);
      loadData();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to cancel');
    }
  }

  async function handleVerifyAll() {
    try {
      const res = await api.verifyAllPending(kidId);
      setError('');
      if (res.verified > 0) {
        loadData();
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to verify all');
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

  async function handleAddRecurring(e: FormEvent) {
    e.preventDefault();
    try {
      await api.createRecurring(kidId, {
        type: recType,
        category: recCategory,
        amount: parseFloat(recAmount),
        description: recDesc,
        frequency: recFrequency,
        day_of_week: recFrequency !== 'monthly' ? Number(recDayOfWeek) : undefined,
        day_of_month: recFrequency === 'monthly' ? Number(recDayOfMonth) : undefined,
        start_date: recStartDate,
      });
      setShowRecurringForm(false);
      setRecAmount('');
      setRecDesc('');
      loadData();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to create recurring transaction');
    }
  }

  async function handleDeleteRecurring(recId: number) {
    if (!confirm('Are you sure you want to delete this recurring transaction?')) return;
    try {
      await api.deleteRecurring(recId);
      loadData();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to delete');
    }
  }

  async function handleToggleRecurring(rec: RecurringTransaction) {
    try {
      await api.updateRecurring(rec.id, { is_active: !rec.is_active });
      loadData();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to update');
    }
  }

  function startEditRecurring(rec: RecurringTransaction) {
    setEditingRecId(rec.id);
    setRecType(rec.type);
    setRecCategory(rec.category || 'allowance');
    setRecAmount(String(rec.amount));
    setRecDesc(rec.description);
    setRecFrequency(rec.frequency);
    setRecDayOfWeek(rec.day_of_week !== null ? String(rec.day_of_week) : '0');
    setRecDayOfMonth(rec.day_of_month !== null ? String(rec.day_of_month) : '1');
    setRecStartDate(rec.start_date);
  }

  async function handleEditRecurring(e: FormEvent) {
    e.preventDefault();
    if (!editingRecId) return;
    try {
      await api.updateRecurring(editingRecId, {
        type: recType,
        category: recCategory,
        amount: parseFloat(recAmount),
        description: recDesc,
        frequency: recFrequency,
        day_of_week: recFrequency !== 'monthly' ? parseInt(recDayOfWeek) : null,
        day_of_month: recFrequency === 'monthly' ? parseInt(recDayOfMonth) : null,
      });
      setEditingRecId(null);
      loadData();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to update recurring transaction');
    }
  }

  async function handleAddGoal(e: FormEvent) {
    e.preventDefault();
    try {
      await api.createGoal(kidId, {
        name: goalName,
        target_amount: goalTarget ? parseFloat(goalTarget) : null,
        want_by_date: goalWantBy || null,
      });
      setShowGoalForm(false);
      setGoalName('');
      setGoalTarget('');
      setGoalWantBy('');
      loadData();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to create goal');
    }
  }

  async function handleDeleteGoal(goalId: number) {
    if (!confirm('Are you sure you want to delete this savings goal?')) return;
    try {
      await api.deleteGoal(goalId);
      loadData();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to delete goal');
    }
  }

  async function handleEditGoal(e: FormEvent) {
    e.preventDefault();
    if (!editingGoalId) return;
    try {
      await api.updateGoal(editingGoalId, {
        name: editGoalName,
        target_amount: editGoalTarget ? parseFloat(editGoalTarget) : null,
        want_by_date: editGoalWantBy || null,
      });
      setEditingGoalId(null);
      loadData();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to update goal');
    }
  }

  function startEditGoal(goal: SavingsGoal) {
    setEditingGoalId(goal.id);
    setEditGoalName(goal.name);
    setEditGoalTarget(goal.target_amount ? String(goal.target_amount) : '');
    setEditGoalWantBy(goal.want_by_date ?? '');
  }

  async function handleMoveGoal(goalId: number, direction: -1 | 1) {
    const incomplete = goals.filter(g => !g.is_completed);
    const idx = incomplete.findIndex(g => g.id === goalId);
    const newIdx = idx + direction;
    if (newIdx < 0 || newIdx >= incomplete.length) return;
    const reordered = [...incomplete];
    [reordered[idx], reordered[newIdx]] = [reordered[newIdx], reordered[idx]];
    try {
      await api.reorderGoals(kidId, reordered.map(g => g.id));
      loadData();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to reorder');
    }
  }

  async function handleCreateKidLogin(e: FormEvent) {
    e.preventDefault();
    try {
      await api.createKidLogin({
        kid_id: kidId,
        email: kidEmail,
        password: kidPassword,
        display_name: kid?.name,
      });
      setShowKidLoginForm(false);
      setKidEmail('');
      setKidPassword('');
      loadData();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to create login');
    }
  }

  async function handleDeleteKidLogin() {
    if (!kidUser) return;
    if (!confirm('Delete this kid\'s login account?')) return;
    try {
      await api.deleteKidLogin(kidUser.id);
      setKidUser(null);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to delete login');
    }
  }

  async function loadPage(page: number) {
    try {
      const today = new Date().toISOString().split('T')[0];
      const res = await api.getTransactions(kidId, { page, to: today });
      setPastTransactions(res.transactions);
      setPastDateBalances(res.date_balances);
      setPastPagination(res.pagination);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load');
    }
  }

  function formatCurrency(amount: number): string {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);
  }

  function formatDate(dateStr: string): string {
    const d = new Date(dateStr + 'T00:00:00');
    const currentYear = new Date().getFullYear();
    const opts: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' };
    if (d.getFullYear() !== currentYear) opts.year = 'numeric';
    return d.toLocaleDateString('en-US', opts);
  }

  // Group past transactions by date (sorted DESC from API)
  const pastGrouped: { date: string; txs: Transaction[] }[] = [];
  for (const tx of pastTransactions) {
    const last = pastGrouped[pastGrouped.length - 1];
    if (last && last.date === tx.transaction_date) {
      last.txs.push(tx);
    } else {
      pastGrouped.push({ date: tx.transaction_date, txs: [tx] });
    }
  }

  // Build unified future timeline: transactions + goal milestones
  type FutureItem =
    | { kind: 'tx_group'; date: string; txs: Transaction[]; balance: number }
    | { kind: 'goal_wanted'; date: string; projection: GoalProjection }
    | { kind: 'goal_expected'; date: string; projection: GoalProjection };

  // Group future transactions by date (API returns DESC, reverse to ASC)
  const futureSorted = [...futureTransactions].reverse();
  const futureTxGroups: { date: string; txs: Transaction[] }[] = [];
  for (const tx of futureSorted) {
    const last = futureTxGroups[futureTxGroups.length - 1];
    if (last && last.date === tx.transaction_date) {
      last.txs.push(tx);
    } else {
      futureTxGroups.push({ date: tx.transaction_date, txs: [tx] });
    }
  }

  // Compute expected balances for future tx dates
  const futureDateBalances: Record<string, number> = {};
  let runningBalance = kid?.balance ?? 0;
  for (const group of futureTxGroups) {
    for (const tx of group.txs) {
      const amt = Number(tx.amount);
      runningBalance += tx.type === 'credit' ? amt : -amt;
    }
    futureDateBalances[group.date] = runningBalance;
  }

  // Build the unified timeline
  const futureTimeline: FutureItem[] = [];
  for (const group of futureTxGroups) {
    futureTimeline.push({ kind: 'tx_group', date: group.date, txs: group.txs, balance: futureDateBalances[group.date] });
  }
  // Add goal milestones
  for (const proj of projections) {
    if (proj.remaining <= 0 || !proj.target_amount) continue;
    const wantDate = proj.want_by_date;
    const expDate = proj.expected_date;
    if (wantDate && expDate && wantDate < expDate) {
      // Want by is earlier than expected — show both
      futureTimeline.push({ kind: 'goal_wanted', date: wantDate, projection: proj });
      futureTimeline.push({ kind: 'goal_expected', date: expDate, projection: proj });
    } else if (expDate) {
      // On track or no want date — just show expected
      futureTimeline.push({ kind: 'goal_expected', date: expDate, projection: proj });
    } else if (wantDate) {
      // No expected date (no income) but has want date
      futureTimeline.push({ kind: 'goal_wanted', date: wantDate, projection: proj });
    }
  }
  futureTimeline.sort((a, b) => a.date.localeCompare(b.date));

  // Precompute progress bar % for each timeline item.
  // Only advance to the next goal after its goal_expected milestone appears.
  const futureProgressByIndex: (number | null)[] = [];
  {
    let goalsReached = 0;
    const goalsWithTargets = goals.filter(g => g.target_amount);
    for (const item of futureTimeline) {
      if (item.kind === 'goal_expected') {
        goalsReached++;
        futureProgressByIndex.push(null);
      } else if (item.kind === 'tx_group') {
        let remaining = item.balance;
        let skipped = 0;
        let pct: number | null = null;
        for (const g of goalsWithTargets) {
          const target = Number(g.target_amount);
          if (skipped < goalsReached) {
            remaining -= target;
            skipped++;
          } else {
            pct = Math.min(100, Math.max(0, (remaining / target) * 100));
            break;
          }
        }
        futureProgressByIndex.push(pct);
      } else {
        futureProgressByIndex.push(null);
      }
    }
  }

  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const pendingCount = pastTransactions.filter(t => t.status === 'pending' || t.status === 'requested').length;

  if (loading) return <div className="loading-container"><div className="spinner" /><p>Loading...</p></div>;
  if (!kid) return <div className="error-page"><h2>Kid not found</h2><Link to="/dashboard">Back to Dashboard</Link></div>;

  return (
    <div>
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

      {/* Kid Login Section */}
      <div className="card" style={{ marginBottom: '1.5rem' }}>
        <div className="section-header" style={{ marginBottom: '0.75rem' }}>
          <h2>Kid Login</h2>
        </div>
        {kidUser ? (
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <p><strong>{kidUser.email}</strong></p>
              <p className="text-muted">{kid.name} can log in with this account to view their balance and request money.</p>
            </div>
            <button onClick={handleDeleteKidLogin} className="btn btn-sm btn-ghost">Remove</button>
          </div>
        ) : showKidLoginForm ? (
          <form onSubmit={handleCreateKidLogin}>
            <div className="form-row">
              <div className="form-group form-group-grow">
                <label>Email</label>
                <input type="email" value={kidEmail} onChange={e => setKidEmail(e.target.value)} required placeholder="kid@example.com" />
              </div>
              <div className="form-group form-group-grow">
                <label>Password</label>
                <input type="text" value={kidPassword} onChange={e => setKidPassword(e.target.value)} required placeholder="At least 4 characters" minLength={4} />
              </div>
            </div>
            <div className="form-actions">
              <button type="submit" className="btn btn-primary">Create Login</button>
              <button type="button" className="btn btn-outline" onClick={() => setShowKidLoginForm(false)}>Cancel</button>
            </div>
          </form>
        ) : (
          <div>
            <p className="text-muted">No login account for {kid.name}.</p>
            <button onClick={() => setShowKidLoginForm(true)} className="btn btn-sm btn-outline">Create Kid Login</button>
          </div>
        )}
      </div>

      <div className="side-cards" style={{ marginBottom: '1.5rem' }}>
      {/* Recurring Transactions Section */}
      <div className="card">
        <div className="section-header" style={{ marginBottom: '0.75rem' }}>
          <h2>Recurring Transactions</h2>
          <button onClick={() => setShowRecurringForm(!showRecurringForm)} className="btn btn-sm btn-primary">+ Add</button>
        </div>
        {showRecurringForm && (
          <form onSubmit={handleAddRecurring} style={{ marginBottom: '1rem' }}>
            <div className="form-row">
              <div className="form-group">
                <label>Type</label>
                <select value={recType} onChange={e => setRecType(e.target.value as 'credit' | 'debit')}>
                  <option value="credit">Credit (+)</option>
                  <option value="debit">Debit (-)</option>
                </select>
              </div>
              <div className="form-group">
                <label>Category</label>
                <select value={recCategory} onChange={e => setRecCategory(e.target.value)}>
                  <option value="allowance">Allowance</option>
                  <option value="chore">Chore</option>
                  <option value="gift">Gift</option>
                  <option value="spending">Spending</option>
                  <option value="adjustment">Adjustment</option>
                </select>
              </div>
              <div className="form-group">
                <label>Amount</label>
                <input type="number" step="0.01" min="0.01" value={recAmount} onChange={e => setRecAmount(e.target.value)} required />
              </div>
            </div>
            <div className="form-row">
              <div className="form-group form-group-grow">
                <label>Description</label>
                <input type="text" value={recDesc} onChange={e => setRecDesc(e.target.value)} placeholder="e.g. Weekly allowance" />
              </div>
              <div className="form-group">
                <label>Frequency</label>
                <select value={recFrequency} onChange={e => setRecFrequency(e.target.value)}>
                  <option value="weekly">Weekly</option>
                  <option value="biweekly">Biweekly</option>
                  <option value="monthly">Monthly</option>
                </select>
              </div>
              {recFrequency !== 'monthly' ? (
                <div className="form-group">
                  <label>Day of Week</label>
                  <select value={recDayOfWeek} onChange={e => setRecDayOfWeek(e.target.value)}>
                    {dayNames.map((d, i) => <option key={i} value={i}>{d}</option>)}
                  </select>
                </div>
              ) : (
                <div className="form-group">
                  <label>Day of Month</label>
                  <input type="number" min="1" max="28" value={recDayOfMonth} onChange={e => setRecDayOfMonth(e.target.value)} />
                </div>
              )}
              <div className="form-group">
                <label>Start Date</label>
                <input type="date" value={recStartDate} onChange={e => setRecStartDate(e.target.value)} required />
              </div>
            </div>
            <div className="form-actions">
              <button type="submit" className="btn btn-primary">Create</button>
              <button type="button" className="btn btn-outline" onClick={() => setShowRecurringForm(false)}>Cancel</button>
            </div>
          </form>
        )}
        {recurring.length === 0 ? (
          <p className="text-muted">No recurring transactions.</p>
        ) : (
          <div className="items-list">
            {recurring.map(rec => (
              <div key={rec.id} className="item-card" style={{ flexDirection: 'column', gap: '0.25rem' }}>
                {editingRecId === rec.id ? (
                  <form onSubmit={handleEditRecurring} style={{ width: '100%' }}>
                    <div className="form-row">
                      <div className="form-group">
                        <label>Type</label>
                        <select value={recType} onChange={e => setRecType(e.target.value as 'credit' | 'debit')}>
                          <option value="credit">Credit (+)</option>
                          <option value="debit">Debit (-)</option>
                        </select>
                      </div>
                      <div className="form-group">
                        <label>Category</label>
                        <select value={recCategory} onChange={e => setRecCategory(e.target.value)}>
                          <option value="allowance">Allowance</option>
                          <option value="chore">Chore</option>
                          <option value="gift">Gift</option>
                          <option value="spending">Spending</option>
                          <option value="adjustment">Adjustment</option>
                        </select>
                      </div>
                      <div className="form-group">
                        <label>Amount</label>
                        <input type="number" step="0.01" min="0.01" value={recAmount} onChange={e => setRecAmount(e.target.value)} required />
                      </div>
                    </div>
                    <div className="form-row">
                      <div className="form-group form-group-grow">
                        <label>Description</label>
                        <input type="text" value={recDesc} onChange={e => setRecDesc(e.target.value)} />
                      </div>
                      <div className="form-group">
                        <label>Frequency</label>
                        <select value={recFrequency} onChange={e => setRecFrequency(e.target.value)}>
                          <option value="weekly">Weekly</option>
                          <option value="biweekly">Biweekly</option>
                          <option value="monthly">Monthly</option>
                        </select>
                      </div>
                      {recFrequency !== 'monthly' ? (
                        <div className="form-group">
                          <label>Day of Week</label>
                          <select value={recDayOfWeek} onChange={e => setRecDayOfWeek(e.target.value)}>
                            {dayNames.map((d, i) => <option key={i} value={i}>{d}</option>)}
                          </select>
                        </div>
                      ) : (
                        <div className="form-group">
                          <label>Day of Month</label>
                          <input type="number" min="1" max="28" value={recDayOfMonth} onChange={e => setRecDayOfMonth(e.target.value)} />
                        </div>
                      )}
                    </div>
                    <div className="form-actions">
                      <button type="submit" className="btn btn-sm btn-primary">Save</button>
                      <button type="button" className="btn btn-sm btn-ghost" onClick={() => setEditingRecId(null)}>Cancel</button>
                    </div>
                  </form>
                ) : (
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', cursor: 'pointer' }} onClick={() => startEditRecurring(rec)}>
                    <div className="item-details">
                      <div className="item-header">
                        <span className="item-name">
                          {rec.type === 'credit' ? '+' : '-'}{formatCurrency(Number(rec.amount))}
                        </span>
                        <span style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', textTransform: 'capitalize' }}>
                          {rec.category || rec.type} &middot; {rec.frequency}
                        </span>
                        {!rec.is_active && <span className="status-badge status-cancelled">Paused</span>}
                      </div>
                      {rec.description && <div className="item-desc">{rec.description}</div>}
                      <div className="item-qty">
                        Started {formatDate(rec.start_date)}
                        {rec.day_of_week !== null && ` on ${dayNames[rec.day_of_week]}s`}
                        {rec.day_of_month !== null && ` on day ${rec.day_of_month}`}
                      </div>
                    </div>
                    <div className="item-actions" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0' }} onClick={e => e.stopPropagation()}>
                      <button onClick={() => handleToggleRecurring(rec)} className="btn btn-sm btn-ghost" title={rec.is_active ? 'Pause' : 'Resume'} style={{ padding: '0.1rem 0.4rem' }}>
                        {rec.is_active ? '⏸' : '▶'}
                      </button>
                      <button onClick={() => handleDeleteRecurring(rec.id)} className="btn btn-sm btn-ghost" title="Delete" style={{ padding: '0.1rem 0.4rem', color: 'var(--color-danger)' }}>&times;</button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Savings Goals */}
      <div className="card">
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
                <label>Target Amount</label>
                <input type="number" step="0.01" min="0" value={goalTarget} onChange={e => setGoalTarget(e.target.value)} placeholder="0.00" />
              </div>
              <div className="form-group">
                <label>Want By</label>
                <input type="date" value={goalWantBy} onChange={e => setGoalWantBy(e.target.value)} />
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
            {goals.map((goal, idx) => {
              const progress = goal.target_amount ? Math.min(100, (Number(goal.current_amount) / Number(goal.target_amount)) * 100) : null;
              const proj = projections.find(p => p.goal_id === goal.id);
              const incompleteGoals = goals.filter(g => !g.is_completed);
              const incompleteIdx = incompleteGoals.findIndex(g => g.id === goal.id);
              return (
                <div key={goal.id} className="item-card" style={{ flexDirection: 'column', gap: '0.25rem' }}>
                  {editingGoalId === goal.id ? (
                    <form onSubmit={handleEditGoal} style={{ width: '100%' }}>
                      <div className="form-row">
                        <div className="form-group form-group-grow">
                          <input type="text" value={editGoalName} onChange={e => setEditGoalName(e.target.value)} required />
                        </div>
                        <div className="form-group">
                          <input type="number" step="0.01" min="0" value={editGoalTarget} onChange={e => setEditGoalTarget(e.target.value)} placeholder="Target" />
                        </div>
                        <div className="form-group">
                          <input type="date" value={editGoalWantBy} onChange={e => setEditGoalWantBy(e.target.value)} />
                        </div>
                      </div>
                      <div className="form-actions">
                        <button type="submit" className="btn btn-sm btn-primary">Save</button>
                        <button type="button" className="btn btn-sm btn-ghost" onClick={() => setEditingGoalId(null)}>Cancel</button>
                      </div>
                    </form>
                  ) : (
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', cursor: 'pointer' }} onClick={() => startEditGoal(goal)}>
                      <div className="item-details">
                        <div className="item-header">
                          {!goal.is_completed && <span style={{ color: 'var(--color-text-muted)', fontSize: '0.8rem', fontWeight: 600 }}>#{incompleteIdx + 1}</span>}
                          <span className="item-name">{goal.name}</span>
                          {goal.is_completed ? <span className="status-badge status-verified">Completed</span> : null}
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
                          <span style={{ fontWeight: 600 }}>{formatCurrency(Number(goal.current_amount))}</span>
                          {goal.target_amount && <span className="text-muted">of {formatCurrency(Number(goal.target_amount))}</span>}
                          {progress !== null && (
                            <div className="purchase-progress">
                              <div className="purchase-bar" style={{ width: '100px' }}>
                                <div className="purchase-bar-fill" style={{ width: `${progress}%` }} />
                              </div>
                              <span className="purchase-text">{progress.toFixed(0)}%</span>
                            </div>
                          )}
                        </div>
                        {proj && !goal.is_completed && goal.target_amount && (
                          <div style={{ fontSize: '0.8rem', marginTop: '0.15rem' }}>
                            {proj.expected_date ? (
                              <div style={{ color: proj.on_track ? 'var(--color-success)' : 'var(--color-danger)' }}>
                                Expected: {formatDate(proj.expected_date)}
                              </div>
                            ) : (
                              <div className="text-muted">No recurring income to project</div>
                            )}
                            {(goal.want_by_date || (proj.expected_date && !proj.on_track)) && (
                              <div style={{ color: 'var(--color-text-muted)' }}>
                                {goal.want_by_date && <>Want by {formatDate(goal.want_by_date)}</>}
                                {goal.want_by_date && !proj.on_track && proj.expected_date && <> &middot; </>}
                                {!proj.on_track && proj.expected_date && <span style={{ color: 'var(--color-danger)' }}>Need {formatCurrency(proj.shortfall)} extra</span>}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                      <div className="item-actions" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0' }} onClick={e => e.stopPropagation()}>
                        {!goal.is_completed && (
                          <button onClick={() => handleMoveGoal(goal.id, -1)} className="btn btn-sm btn-ghost" disabled={incompleteIdx === 0} title="Move up" style={{ padding: '0.1rem 0.4rem' }}>&uarr;</button>
                        )}
                        <button onClick={() => handleDeleteGoal(goal.id)} className="btn btn-sm btn-ghost" title="Delete" style={{ padding: '0.1rem 0.4rem', color: 'var(--color-danger)' }}>&times;</button>
                        {!goal.is_completed && (
                          <button onClick={() => handleMoveGoal(goal.id, 1)} className="btn btn-sm btn-ghost" disabled={incompleteIdx === incompleteGoals.length - 1} title="Move down" style={{ padding: '0.1rem 0.4rem' }}>&darr;</button>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
      </div>

      {/* Transactions Header + Add Form */}
      <div className="section-header">
        <h2>Transactions</h2>
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          {pendingCount > 0 && (
            <button onClick={handleVerifyAll} className="btn btn-sm btn-outline">
              Verify All Pending ({pendingCount})
            </button>
          )}
          <button onClick={() => setShowAddTx(!showAddTx)} className="btn btn-sm btn-primary">+ Add Transaction</button>
        </div>
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

      {/* Two-column transaction layout */}
      <div className="tx-columns">
        {/* Recent / Past Transactions */}
        <div className="tx-column">
          <h3>Recent</h3>
          {pastTransactions.length === 0 ? (
            <div className="empty-state"><p>No transactions yet.</p></div>
          ) : (
            <div>
              {pastGrouped.map(group => (
                <div key={group.date} style={{ marginBottom: '0.75rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', padding: '0.25rem 0.25rem' }}>
                    <span style={{ fontWeight: 600, fontSize: '0.9rem' }}>{formatDate(group.date)}</span>
                    {pastDateBalances[group.date] !== undefined && (
                      <span style={{ fontSize: '0.85rem', fontWeight: 600, color: pastDateBalances[group.date] >= 0 ? 'var(--color-success)' : 'var(--color-danger)' }}>
                        {formatCurrency(pastDateBalances[group.date])}
                      </span>
                    )}
                  </div>
                  <div className="items-list">
                    {group.txs.map(tx => (
                      <div key={tx.id} className="item-card">
                        <div className="item-details">
                          <div className="item-header">
                            <span className="item-name">{tx.description || tx.category || tx.type}</span>
                            <span className={`status-badge status-${tx.status}`}>{tx.status}</span>
                            {tx.category && <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', textTransform: 'capitalize' }}>{tx.category}</span>}
                          </div>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <span style={{
                            fontSize: '1rem', fontWeight: 600,
                            color: tx.type === 'credit' ? 'var(--color-success)' : 'var(--color-danger)'
                          }}>
                            {tx.type === 'credit' ? '+' : '-'}{formatCurrency(Number(tx.amount))}
                          </span>
                          {(tx.status === 'pending' || tx.status === 'requested') && (
                            <>
                              <button onClick={() => handleVerify(tx.id)} className="btn btn-sm btn-primary" title="Verify">&#10003;</button>
                              <button onClick={() => handleCancel(tx.id)} className="btn btn-sm btn-ghost" title="Cancel">&#10005;</button>
                            </>
                          )}
                          {!tx.recurring_transaction_id && (
                            <button onClick={() => handleDeleteTransaction(tx.id)} className="btn btn-sm btn-ghost">x</button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
              {pastPagination && pastPagination.total_pages > 1 && (
                <div className="admin-pagination">
                  <button className="btn btn-sm btn-outline" disabled={pastPagination.page <= 1} onClick={() => loadPage(pastPagination!.page - 1)}>Prev</button>
                  <span className="text-muted">Page {pastPagination.page} of {pastPagination.total_pages}</span>
                  <button className="btn btn-sm btn-outline" disabled={pastPagination.page >= pastPagination.total_pages} onClick={() => loadPage(pastPagination!.page + 1)}>Next</button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Future Transactions + Goal Milestones */}
        <div className="tx-column">
          <h3>Future</h3>
          {futureTimeline.length === 0 ? (
            <div className="empty-state"><p>No upcoming transactions.</p></div>
          ) : (
            <div>
              {futureTimeline.map((item, i) => {
                if (item.kind === 'tx_group') {
                  return (
                    <div key={`tx-${item.date}`} style={{ marginBottom: '0.75rem' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', padding: '0.25rem 0.25rem' }}>
                        <span style={{ fontWeight: 600, fontSize: '0.9rem' }}>{formatDate(item.date)}</span>
                        <span style={{ fontSize: '0.85rem', fontWeight: 600, color: item.balance >= 0 ? 'var(--color-success)' : 'var(--color-danger)' }}>
                          {formatCurrency(item.balance)}
                        </span>
                      </div>
                      {futureProgressByIndex[i] !== null && (
                        <div className="purchase-bar" style={{ width: '100%', height: '3px', margin: '0 0.25rem' }}>
                          <div className="purchase-bar-fill" style={{ width: `${futureProgressByIndex[i]}%` }} />
                        </div>
                      )}
                      <div className="items-list">
                        {item.txs.map(tx => (
                          <div key={tx.id} className="item-card">
                            <div className="item-details">
                              <div className="item-header">
                                <span className="item-name">{tx.description || tx.category || tx.type}</span>
                                {tx.category && <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', textTransform: 'capitalize' }}>{tx.category}</span>}
                              </div>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                              <span style={{
                                fontSize: '1rem', fontWeight: 600,
                                color: tx.type === 'credit' ? 'var(--color-success)' : 'var(--color-danger)'
                              }}>
                                {tx.type === 'credit' ? '+' : '-'}{formatCurrency(Number(tx.amount))}
                              </span>
                              <button onClick={() => handleCancel(tx.id)} className="btn btn-sm btn-ghost" title="Cancel">&#10005;</button>
                              {!tx.recurring_transaction_id && (
                                <button onClick={() => handleDeleteTransaction(tx.id)} className="btn btn-sm btn-ghost">x</button>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                }
                if (item.kind === 'goal_wanted') {
                  return (
                    <div key={`want-${item.projection.goal_id}`} className="item-card" style={{ marginBottom: '0.4rem', borderColor: 'var(--color-danger)', background: '#fef2f2' }}>
                      <div className="item-details">
                        <div className="item-header">
                          <span className="item-name">{item.projection.name}</span>
                          <span className="status-badge status-pending">Wanted by {formatDate(item.date)}</span>
                        </div>
                      </div>
                      <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--color-danger)' }}>
                        Need {formatCurrency(item.projection.shortfall)} extra
                      </span>
                    </div>
                  );
                }
                // goal_expected
                return (
                  <div key={`exp-${item.projection.goal_id}`} className="item-card" style={{ marginBottom: '0.4rem', borderColor: 'var(--color-success)', background: 'var(--color-success-light)' }}>
                    <div className="item-details">
                      <div className="item-header">
                        <span className="item-name">{item.projection.name}</span>
                        <span className="status-badge status-verified">Expected {formatDate(item.date)}</span>
                      </div>
                    </div>
                    <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--color-success)' }}>
                      {formatCurrency(item.projection.target_amount ?? 0)}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
