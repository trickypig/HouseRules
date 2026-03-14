import { useState, useEffect, type FormEvent } from 'react';
import type { Kid, Transaction, RecurringTransaction, SavingsGoal, GoalProjection, Pagination } from '../types';
import * as api from '../api/client';

export default function KidMoneyPage() {
  const [kid, setKid] = useState<Kid | null>(null);
  const [pastTransactions, setPastTransactions] = useState<Transaction[]>([]);
  const [pastDateBalances, setPastDateBalances] = useState<Record<string, number>>({});
  const [pastPagination, setPastPagination] = useState<Pagination | null>(null);
  const [futureTransactions, setFutureTransactions] = useState<Transaction[]>([]);
  const [recurring, setRecurring] = useState<RecurringTransaction[]>([]);
  const [goals, setGoals] = useState<SavingsGoal[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [projections, setProjections] = useState<GoalProjection[]>([]);

  // Request form
  const [requestKind, setRequestKind] = useState<'spent' | 'gift' | 'chore' | null>(null);
  const [reqAmount, setReqAmount] = useState('');
  const [reqDesc, setReqDesc] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');

  // Goal form
  const [showGoalForm, setShowGoalForm] = useState(false);
  const [goalName, setGoalName] = useState('');
  const [goalTarget, setGoalTarget] = useState('');
  const [goalWantBy, setGoalWantBy] = useState('');
  const [editingGoalId, setEditingGoalId] = useState<number | null>(null);
  const [editGoalName, setEditGoalName] = useState('');
  const [editGoalTarget, setEditGoalTarget] = useState('');
  const [editGoalWantBy, setEditGoalWantBy] = useState('');

  useEffect(() => {
    loadDashboard();
  }, []);

  async function loadDashboard() {
    try {
      const today = new Date().toISOString().split('T')[0];
      const tomorrow = new Date(Date.now() + 86400000).toISOString().split('T')[0];
      const [dashData, futureTxRes] = await Promise.all([
        api.getMyDashboard(),
        api.getMyTransactions({ from: tomorrow, per_page: 100 }),
      ]);
      setKid(dashData.kid);
      // Dashboard returns all transactions; filter to past only
      const pastOnly = dashData.transactions.filter((tx: Transaction) => tx.transaction_date <= today);
      setPastTransactions(pastOnly);
      setPastDateBalances(dashData.date_balances);
      setPastPagination(dashData.pagination);
      setFutureTransactions(futureTxRes.transactions);
      setRecurring(dashData.recurring);
      setGoals(dashData.goals);
      const projRes = await api.getGoalProjections(dashData.kid.id);
      setProjections(projRes.projections);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load dashboard');
    } finally {
      setLoading(false);
    }
  }

  async function handleRequest(e: FormEvent) {
    e.preventDefault();
    if (!requestKind) return;
    setSubmitting(true);
    setSuccessMsg('');
    const kindConfig = {
      spent: { type: 'debit', category: 'spending' },
      gift: { type: 'credit', category: 'gift' },
      chore: { type: 'credit', category: 'chore' },
    } as const;
    const { type, category } = kindConfig[requestKind];
    try {
      await api.requestMoney({
        amount: parseFloat(reqAmount),
        description: reqDesc,
        type,
        category,
      });
      setSuccessMsg('Request sent to your parent!');
      setRequestKind(null);
      setReqAmount('');
      setReqDesc('');
      loadDashboard();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to send request');
    } finally {
      setSubmitting(false);
    }
  }

  async function loadPage(page: number) {
    try {
      const today = new Date().toISOString().split('T')[0];
      const res = await api.getMyTransactions({ page, to: today });
      setPastTransactions(res.transactions);
      setPastDateBalances(res.date_balances);
      setPastPagination(res.pagination);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load');
    }
  }

  async function handleAddGoal(e: FormEvent) {
    e.preventDefault();
    if (!kid) return;
    try {
      await api.createGoal(kid.id, {
        name: goalName,
        target_amount: goalTarget ? parseFloat(goalTarget) : null,
        want_by_date: goalWantBy || null,
      });
      setShowGoalForm(false);
      setGoalName('');
      setGoalTarget('');
      setGoalWantBy('');
      loadDashboard();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to create goal');
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
      loadDashboard();
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
    if (!kid) return;
    const incomplete = goals.filter(g => !g.is_completed);
    const idx = incomplete.findIndex(g => g.id === goalId);
    const newIdx = idx + direction;
    if (newIdx < 0 || newIdx >= incomplete.length) return;
    const reordered = [...incomplete];
    [reordered[idx], reordered[newIdx]] = [reordered[newIdx], reordered[idx]];
    try {
      await api.reorderGoals(kid.id, reordered.map(g => g.id));
      loadDashboard();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to reorder');
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
      futureTimeline.push({ kind: 'goal_wanted', date: wantDate, projection: proj });
      futureTimeline.push({ kind: 'goal_expected', date: expDate, projection: proj });
    } else if (expDate) {
      futureTimeline.push({ kind: 'goal_expected', date: expDate, projection: proj });
    } else if (wantDate) {
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

  if (loading) {
    return <div className="loading-container"><div className="spinner" /><p>Loading...</p></div>;
  }

  if (!kid) {
    return <div className="error-page"><h2>Could not load your data</h2></div>;
  }

  return (
    <div>
      {error && <div className="error-message">{error}</div>}
      {successMsg && <div className="success-message">{successMsg}</div>}

      {/* Balance Card */}
      <div className="card" style={{ marginBottom: '1.5rem', textAlign: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '1rem', marginBottom: '0.5rem' }}>
          <div style={{
            width: 56, height: 56, borderRadius: '50%', background: kid.color,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: kid.avatar ? '1.5rem' : '1.4rem', color: '#fff', fontWeight: 700
          }}>
            {kid.avatar || kid.name.charAt(0).toUpperCase()}
          </div>
          <h1 style={{ marginBottom: 0 }}>{kid.name}</h1>
        </div>
        <div style={{ fontSize: '2rem', fontWeight: 700, color: kid.balance >= 0 ? 'var(--color-success)' : 'var(--color-danger)', marginBottom: '1rem' }}>
          {formatCurrency(kid.balance)}
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center', flexWrap: 'wrap' }}>
          <button onClick={() => setRequestKind(requestKind === 'spent' ? null : 'spent')} className={`btn ${requestKind === 'spent' ? 'btn-primary' : 'btn-outline'}`}>
            I Spent Money
          </button>
          <button onClick={() => setRequestKind(requestKind === 'gift' ? null : 'gift')} className={`btn ${requestKind === 'gift' ? 'btn-primary' : 'btn-outline'}`}>
            I Got a Gift
          </button>
          <button onClick={() => setRequestKind(requestKind === 'chore' ? null : 'chore')} className={`btn ${requestKind === 'chore' ? 'btn-primary' : 'btn-outline'}`}>
            I Did a Chore
          </button>
        </div>
      </div>

      {/* Request Form */}
      {requestKind && (
        <div className="card" style={{ marginBottom: '1.5rem' }}>
          <h3>{requestKind === 'spent' ? 'I Spent Money' : requestKind === 'gift' ? 'I Got a Gift' : 'I Did a Chore'}</h3>
          <form onSubmit={handleRequest}>
            <div className="form-row">
              <div className="form-group">
                <label htmlFor="reqAmount">Amount</label>
                <input id="reqAmount" type="number" step="0.01" min="0.01" value={reqAmount} onChange={e => setReqAmount(e.target.value)} required placeholder="0.00" />
              </div>
              <div className="form-group form-group-grow">
                <label htmlFor="reqDesc">{requestKind === 'spent' ? 'What did you buy?' : requestKind === 'gift' ? 'Who gave it to you?' : 'What did you do?'}</label>
                <input id="reqDesc" type="text" value={reqDesc} onChange={e => setReqDesc(e.target.value)} required placeholder={requestKind === 'spent' ? 'e.g. Candy at the store' : requestKind === 'gift' ? 'e.g. Birthday money from Grandma' : 'e.g. Took out the trash'} />
              </div>
            </div>
            <div className="form-actions">
              <button type="submit" className="btn btn-primary" disabled={submitting}>
                {submitting ? 'Sending...' : 'Send Request'}
              </button>
              <button type="button" className="btn btn-outline" onClick={() => setRequestKind(null)}>Cancel</button>
            </div>
          </form>
        </div>
      )}

      <div className="side-cards" style={{ marginBottom: '1.5rem' }}>
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
          <p className="text-muted">No savings goals yet. Add one above!</p>
        ) : (
          <div className="items-list">
            {goals.map(goal => {
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
                          {goal.is_completed ? <span className="status-badge status-verified">Completed!</span> : null}
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

      {/* Recurring Transactions */}
      {recurring.length > 0 && (
        <div className="card">
          <h2>Recurring</h2>
          <div className="items-list">
            {recurring.map(rec => (
              <div key={rec.id} className="item-card">
                <div className="item-details">
                  <div className="item-header">
                    <span className="item-name">
                      {rec.type === 'credit' ? '+' : '-'}{formatCurrency(Number(rec.amount))}
                    </span>
                    <span style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', textTransform: 'capitalize' }}>
                      {rec.category || rec.type} &middot; {rec.frequency}
                    </span>
                  </div>
                  {rec.description && <div className="item-desc">{rec.description}</div>}
                  <div className="item-qty">
                    {rec.day_of_week !== null && `${dayNames[rec.day_of_week]}s`}
                    {rec.day_of_month !== null && `Day ${rec.day_of_month} of each month`}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
      </div>

      {/* Transactions - Two Column Layout */}
      <h2>Transactions</h2>
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
                          </div>
                        </div>
                        <span style={{
                          fontSize: '1rem', fontWeight: 600,
                          color: tx.type === 'credit' ? 'var(--color-success)' : 'var(--color-danger)'
                        }}>
                          {tx.type === 'credit' ? '+' : '-'}{formatCurrency(Number(tx.amount))}
                        </span>
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
                            <span style={{
                              fontSize: '1rem', fontWeight: 600,
                              color: tx.type === 'credit' ? 'var(--color-success)' : 'var(--color-danger)'
                            }}>
                              {tx.type === 'credit' ? '+' : '-'}{formatCurrency(Number(tx.amount))}
                            </span>
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
