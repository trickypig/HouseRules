import { useState, useEffect, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import type { Kid, SavingsGoal, GoalProjection, ChoreInstance } from '../types';
import * as api from '../api/client';

export default function KidDashboardPage() {
  const [kid, setKid] = useState<Kid | null>(null);
  const [goals, setGoals] = useState<SavingsGoal[]>([]);
  const [projections, setProjections] = useState<GoalProjection[]>([]);
  const [myChores, setMyChores] = useState<ChoreInstance[]>([]);
  const [openChores, setOpenChores] = useState<ChoreInstance[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

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

  useEffect(() => { loadDashboard(); }, []);

  async function loadDashboard() {
    try {
      const [dashData, choresData] = await Promise.all([
        api.getMyDashboard(),
        api.getMyChores(),
      ]);
      setKid(dashData.kid);
      setGoals(dashData.goals);
      setMyChores(choresData.my_chores);
      setOpenChores(choresData.open_chores);
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

  async function handleCompleteChore(id: number) {
    try {
      await api.completeChore(id);
      loadDashboard();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to complete');
    }
  }

  async function handleClaimChore(id: number) {
    try {
      await api.claimChore(id);
      loadDashboard();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to claim');
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

  if (loading) {
    return <div className="loading-container"><div className="spinner" /><p>Loading...</p></div>;
  }

  if (!kid) {
    return <div className="error-page"><h2>Could not load your data</h2></div>;
  }

  const today = new Date().toISOString().split('T')[0];
  const dueChores = myChores.filter(c => c.status === 'pending' && c.due_date <= today);
  const overdueChores = myChores.filter(c => c.status === 'missed');
  const completedChores = myChores.filter(c => c.status === 'completed');

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
      {/* Chores */}
      <div className="card">
        <div className="section-header" style={{ marginBottom: '0.75rem' }}>
          <h2>Chores</h2>
          <Link to="/chores" className="btn btn-sm btn-outline">View All</Link>
        </div>

        {/* Overdue */}
        {overdueChores.length > 0 && (
          <>
            <h3 style={{ fontSize: '0.9rem', color: 'var(--color-danger)', marginBottom: '0.5rem' }}>Overdue</h3>
            <div className="items-list" style={{ marginBottom: '1rem' }}>
              {overdueChores.map(chore => (
                <div key={chore.id} className="item-card">
                  <div className="item-details">
                    <div className="item-header">
                      <span className="item-name">{chore.title}</span>
                      {chore.amount != null && <span className="badge badge-success">${Number(chore.amount).toFixed(2)}</span>}
                    </div>
                    <div className="item-qty" style={{ color: 'var(--color-danger)' }}>Due {formatDate(chore.due_date)}</div>
                  </div>
                  <span style={{ color: 'var(--color-danger)', fontWeight: 500, fontSize: '0.85rem' }}>Missed</span>
                </div>
              ))}
            </div>
          </>
        )}

        {/* Due today / current */}
        {dueChores.length > 0 && (
          <>
            <h3 style={{ fontSize: '0.9rem', color: 'var(--color-text-muted)', marginBottom: '0.5rem' }}>To Do</h3>
            <div className="items-list" style={{ marginBottom: '1rem' }}>
              {dueChores.map(chore => (
                <div key={chore.id} className="item-card">
                  <div className="item-details">
                    <div className="item-header">
                      <span className="item-name">{chore.title}</span>
                      {chore.amount != null && <span className="badge badge-success">${Number(chore.amount).toFixed(2)}</span>}
                    </div>
                    <div className="item-qty">Due {formatDate(chore.due_date)}</div>
                  </div>
                  <button onClick={() => handleCompleteChore(chore.id)} className="btn btn-sm btn-primary">Done</button>
                </div>
              ))}
            </div>
          </>
        )}

        {/* Open chores to claim */}
        {openChores.length > 0 && (
          <>
            <h3 style={{ fontSize: '0.9rem', color: 'var(--color-text-muted)', marginBottom: '0.5rem' }}>Available</h3>
            <div className="items-list" style={{ marginBottom: '1rem' }}>
              {openChores.map(chore => (
                <div key={chore.id} className="item-card">
                  <div className="item-details">
                    <div className="item-header">
                      <span className="item-name">{chore.title}</span>
                      {chore.amount != null && <span className="badge badge-success">${Number(chore.amount).toFixed(2)}</span>}
                    </div>
                    <div className="item-qty">Due {formatDate(chore.due_date)}</div>
                  </div>
                  <button onClick={() => handleClaimChore(chore.id)} className="btn btn-sm btn-outline">Claim</button>
                </div>
              ))}
            </div>
          </>
        )}

        {/* Completed awaiting verification */}
        {completedChores.length > 0 && (
          <>
            <h3 style={{ fontSize: '0.9rem', color: 'var(--color-text-muted)', marginBottom: '0.5rem' }}>Awaiting Verification</h3>
            <div className="items-list">
              {completedChores.map(chore => (
                <div key={chore.id} className="item-card" style={{ opacity: 0.7 }}>
                  <div className="item-details">
                    <div className="item-header">
                      <span className="item-name">{chore.title}</span>
                      {chore.amount != null && <span className="badge badge-success">${Number(chore.amount).toFixed(2)}</span>}
                    </div>
                  </div>
                  <span className="text-muted" style={{ fontSize: '0.85rem' }}>Pending</span>
                </div>
              ))}
            </div>
          </>
        )}

        {dueChores.length === 0 && overdueChores.length === 0 && openChores.length === 0 && completedChores.length === 0 && (
          <p className="text-muted">No chores right now!</p>
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
      </div>
    </div>
  );
}
