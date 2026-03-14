import { useState, useEffect, type FormEvent } from 'react';
import type { ChoreTemplate, ChoreInstance, Kid } from '../types';
import { useAuth } from '../context/AuthContext';
import * as api from '../api/client';

export default function ChoreBoardPage() {
  const { isKid } = useAuth();

  return isKid ? <KidChoreView /> : <ParentChoreView />;
}

// ---- Parent View ----
function ParentChoreView() {
  const [templates, setTemplates] = useState<ChoreTemplate[]>([]);
  const [instances, setInstances] = useState<ChoreInstance[]>([]);
  const [kids, setKids] = useState<Kid[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Form state
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [frequency, setFrequency] = useState<string>('');
  const [dayOfWeek, setDayOfWeek] = useState('');
  const [dayOfMonth, setDayOfMonth] = useState('');
  const [assignedKidId, setAssignedKidId] = useState('');
  const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [endDate, setEndDate] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => { load(); }, []);

  async function load() {
    try {
      const [choreData, kidData] = await Promise.all([
        api.getChoreBoard(),
        api.getKids(),
      ]);
      setTemplates(choreData.templates);
      setInstances(choreData.instances);
      setKids(kidData.kids);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }

  function resetForm() {
    setTitle(''); setDescription(''); setAmount(''); setFrequency('');
    setDayOfWeek(''); setDayOfMonth(''); setAssignedKidId('');
    setStartDate(new Date().toISOString().split('T')[0]); setEndDate('');
    setEditingId(null); setShowForm(false);
  }

  function editTemplate(t: ChoreTemplate) {
    setEditingId(t.id);
    setTitle(t.title);
    setDescription(t.description);
    setAmount(t.amount != null ? String(t.amount) : '');
    setFrequency(t.frequency ?? '');
    setDayOfWeek(t.day_of_week != null ? String(t.day_of_week) : '');
    setDayOfMonth(t.day_of_month != null ? String(t.day_of_month) : '');
    setAssignedKidId(t.assigned_kid_id != null ? String(t.assigned_kid_id) : '');
    setStartDate(t.start_date);
    setEndDate(t.end_date ?? '');
    setShowForm(true);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      const data = {
        title,
        description,
        amount: amount ? parseFloat(amount) : null,
        frequency: frequency || null,
        day_of_week: dayOfWeek ? parseInt(dayOfWeek) : null,
        day_of_month: dayOfMonth ? parseInt(dayOfMonth) : null,
        assigned_kid_id: assignedKidId ? parseInt(assignedKidId) : null,
        start_date: startDate,
        end_date: endDate || null,
      };
      if (editingId) {
        await api.updateChore(editingId, data);
      } else {
        await api.createChore(data);
      }
      resetForm();
      await load();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(id: number) {
    if (!confirm('Delete this chore template and its future instances?')) return;
    try {
      await api.deleteChore(id);
      await load();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to delete');
    }
  }

  async function handleVerify(id: number) {
    try {
      await api.verifyChore(id);
      await load();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to verify');
    }
  }

  async function handleReject(id: number) {
    try {
      await api.rejectChore(id);
      await load();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to reject');
    }
  }

  if (loading) return <div className="loading-spinner"><div className="spinner" /></div>;

  const today = new Date().toISOString().split('T')[0];
  const todayInstances = instances.filter(i => i.due_date === today);
  const upcomingInstances = instances.filter(i => i.due_date > today && i.status === 'pending');
  const completedInstances = instances.filter(i => i.status === 'completed');

  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

  return (
    <div className="chore-board">
      <div className="page-header">
        <h1>Chore Board</h1>
        <button className="btn btn-primary" onClick={() => { resetForm(); setShowForm(true); }}>
          + New Chore
        </button>
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      {showForm && (
        <div className="card" style={{ marginBottom: '1.5rem' }}>
          <div className="card-header">
            <h3>{editingId ? 'Edit Chore' : 'New Chore'}</h3>
          </div>
          <div className="card-body">
            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label>Title *</label>
                <input className="form-control" value={title} onChange={e => setTitle(e.target.value)} required />
              </div>
              <div className="form-group">
                <label>Description</label>
                <input className="form-control" value={description} onChange={e => setDescription(e.target.value)} />
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>Pay Amount ($)</label>
                  <input type="number" step="0.01" min="0" className="form-control" value={amount}
                    onChange={e => setAmount(e.target.value)} placeholder="Leave empty = no pay" />
                </div>
                <div className="form-group">
                  <label>Frequency</label>
                  <select className="form-control" value={frequency} onChange={e => setFrequency(e.target.value)}>
                    <option value="">One-time</option>
                    <option value="daily">Daily</option>
                    <option value="weekly">Weekly</option>
                    <option value="biweekly">Biweekly</option>
                    <option value="monthly">Monthly</option>
                  </select>
                </div>
              </div>
              {(frequency === 'weekly' || frequency === 'biweekly') && (
                <div className="form-group">
                  <label>Day of Week</label>
                  <select className="form-control" value={dayOfWeek} onChange={e => setDayOfWeek(e.target.value)}>
                    <option value="">Any</option>
                    {dayNames.map((d, i) => <option key={i} value={i}>{d}</option>)}
                  </select>
                </div>
              )}
              {frequency === 'monthly' && (
                <div className="form-group">
                  <label>Day of Month</label>
                  <input type="number" min="1" max="31" className="form-control" value={dayOfMonth}
                    onChange={e => setDayOfMonth(e.target.value)} />
                </div>
              )}
              <div className="form-row">
                <div className="form-group">
                  <label>Assign To</label>
                  <select className="form-control" value={assignedKidId} onChange={e => setAssignedKidId(e.target.value)}>
                    <option value="">Open (any kid)</option>
                    {kids.map(k => <option key={k.id} value={k.id}>{k.name}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label>Start Date</label>
                  <input type="date" className="form-control" value={startDate} onChange={e => setStartDate(e.target.value)} />
                </div>
                <div className="form-group">
                  <label>End Date</label>
                  <input type="date" className="form-control" value={endDate} onChange={e => setEndDate(e.target.value)} />
                </div>
              </div>
              <div className="form-actions">
                <button type="submit" className="btn btn-primary" disabled={submitting}>
                  {submitting ? 'Saving...' : (editingId ? 'Update' : 'Create')}
                </button>
                <button type="button" className="btn btn-outline" onClick={resetForm}>Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Completed - needs verification */}
      {completedInstances.length > 0 && (
        <div className="card" style={{ marginBottom: '1.5rem' }}>
          <div className="card-header"><h3>Awaiting Verification</h3></div>
          <div className="card-body">
            {completedInstances.map(inst => (
              <div key={inst.id} className="chore-instance-row" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.5rem 0', borderBottom: '1px solid var(--border-color)' }}>
                <div>
                  <strong>{inst.title}</strong>
                  {inst.amount != null && <span className="badge badge-success" style={{ marginLeft: '0.5rem' }}>${Number(inst.amount).toFixed(2)}</span>}
                  <span style={{ marginLeft: '0.5rem', color: 'var(--text-secondary)' }}>
                    {inst.kid_name || inst.claimed_by_name || 'Unassigned'} &middot; {inst.due_date}
                  </span>
                </div>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button className="btn btn-sm btn-primary" onClick={() => handleVerify(inst.id)}>Verify</button>
                  <button className="btn btn-sm btn-outline" onClick={() => handleReject(inst.id)}>Reject</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Today's chores */}
      <div className="card" style={{ marginBottom: '1.5rem' }}>
        <div className="card-header"><h3>Today</h3></div>
        <div className="card-body">
          {todayInstances.length === 0 ? (
            <p style={{ color: 'var(--text-secondary)' }}>No chores for today.</p>
          ) : todayInstances.map(inst => (
            <ChoreInstanceRow key={inst.id} instance={inst} />
          ))}
        </div>
      </div>

      {/* Upcoming */}
      {upcomingInstances.length > 0 && (
        <div className="card" style={{ marginBottom: '1.5rem' }}>
          <div className="card-header"><h3>Upcoming</h3></div>
          <div className="card-body">
            {upcomingInstances.slice(0, 20).map(inst => (
              <ChoreInstanceRow key={inst.id} instance={inst} />
            ))}
          </div>
        </div>
      )}

      {/* Templates */}
      <div className="card">
        <div className="card-header"><h3>Chore Templates</h3></div>
        <div className="card-body">
          {templates.length === 0 ? (
            <p style={{ color: 'var(--text-secondary)' }}>No chore templates yet.</p>
          ) : templates.map(t => (
            <div key={t.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.5rem 0', borderBottom: '1px solid var(--border-color)' }}>
              <div>
                <strong>{t.title}</strong>
                {t.amount != null && <span className="badge badge-success" style={{ marginLeft: '0.5rem' }}>${Number(t.amount).toFixed(2)}</span>}
                <span style={{ marginLeft: '0.5rem', color: 'var(--text-secondary)' }}>
                  {t.frequency ?? 'one-time'} &middot; {t.assigned_kid_name ?? 'open'}
                  {!t.is_active && ' (inactive)'}
                </span>
              </div>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button className="btn btn-sm btn-outline" onClick={() => editTemplate(t)}>Edit</button>
                <button className="btn btn-sm btn-danger" onClick={() => handleDelete(t.id)}>Delete</button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function ChoreInstanceRow({ instance: inst }: { instance: ChoreInstance }) {
  const statusColors: Record<string, string> = {
    pending: 'var(--warning-color)',
    completed: 'var(--info-color)',
    verified: 'var(--success-color)',
    missed: 'var(--danger-color)',
  };

  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.5rem 0', borderBottom: '1px solid var(--border-color)' }}>
      <div>
        <strong>{inst.title}</strong>
        {inst.amount != null && <span className="badge badge-success" style={{ marginLeft: '0.5rem' }}>${Number(inst.amount).toFixed(2)}</span>}
        <span style={{ marginLeft: '0.5rem', color: 'var(--text-secondary)' }}>
          {inst.kid_name || inst.claimed_by_name || 'Open'}
        </span>
      </div>
      <span style={{ color: statusColors[inst.status] || 'var(--text-secondary)', fontWeight: 500, textTransform: 'capitalize' }}>
        {inst.status}
      </span>
    </div>
  );
}

// ---- Kid View ----
function KidChoreView() {
  const [myChores, setMyChores] = useState<ChoreInstance[]>([]);
  const [openChores, setOpenChores] = useState<ChoreInstance[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => { load(); }, []);

  async function load() {
    try {
      const data = await api.getMyChores();
      setMyChores(data.my_chores);
      setOpenChores(data.open_chores);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }

  async function handleClaim(id: number) {
    try {
      await api.claimChore(id);
      await load();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to claim');
    }
  }

  async function handleComplete(id: number) {
    try {
      await api.completeChore(id);
      await load();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to complete');
    }
  }

  if (loading) return <div className="loading-spinner"><div className="spinner" /></div>;

  const pending = myChores.filter(c => c.status === 'pending');
  const completed = myChores.filter(c => c.status === 'completed');
  const verified = myChores.filter(c => c.status === 'verified');

  return (
    <div className="chore-board">
      <h1>My Chores</h1>

      {error && <div className="alert alert-error">{error}</div>}

      {/* Pending - can mark done */}
      <div className="card" style={{ marginBottom: '1.5rem' }}>
        <div className="card-header"><h3>To Do</h3></div>
        <div className="card-body">
          {pending.length === 0 ? (
            <p style={{ color: 'var(--text-secondary)' }}>No chores to do right now!</p>
          ) : pending.map(c => (
            <div key={c.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.5rem 0', borderBottom: '1px solid var(--border-color)' }}>
              <div>
                <strong>{c.title}</strong>
                {c.amount != null && <span className="badge badge-success" style={{ marginLeft: '0.5rem' }}>${Number(c.amount).toFixed(2)}</span>}
                <span style={{ marginLeft: '0.5rem', color: 'var(--text-secondary)' }}>Due: {c.due_date}</span>
              </div>
              <button className="btn btn-sm btn-primary" onClick={() => handleComplete(c.id)}>Mark Done</button>
            </div>
          ))}
        </div>
      </div>

      {/* Open chores to claim */}
      {openChores.length > 0 && (
        <div className="card" style={{ marginBottom: '1.5rem' }}>
          <div className="card-header"><h3>Available Chores</h3></div>
          <div className="card-body">
            {openChores.map(c => (
              <div key={c.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.5rem 0', borderBottom: '1px solid var(--border-color)' }}>
                <div>
                  <strong>{c.title}</strong>
                  {c.amount != null && <span className="badge badge-success" style={{ marginLeft: '0.5rem' }}>${Number(c.amount).toFixed(2)}</span>}
                  <span style={{ marginLeft: '0.5rem', color: 'var(--text-secondary)' }}>Due: {c.due_date}</span>
                </div>
                <button className="btn btn-sm btn-outline" onClick={() => handleClaim(c.id)}>Claim</button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Completed - awaiting verification */}
      {completed.length > 0 && (
        <div className="card" style={{ marginBottom: '1.5rem' }}>
          <div className="card-header"><h3>Awaiting Verification</h3></div>
          <div className="card-body">
            {completed.map(c => (
              <div key={c.id} style={{ padding: '0.5rem 0', borderBottom: '1px solid var(--border-color)', color: 'var(--text-secondary)' }}>
                <strong>{c.title}</strong>
                {c.amount != null && <span style={{ marginLeft: '0.5rem' }}>${Number(c.amount).toFixed(2)}</span>}
                <span style={{ marginLeft: '0.5rem' }}>Completed {c.completed_at?.split(' ')[0]}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Verified */}
      {verified.length > 0 && (
        <div className="card">
          <div className="card-header"><h3>Completed</h3></div>
          <div className="card-body">
            {verified.slice(0, 10).map(c => (
              <div key={c.id} style={{ padding: '0.5rem 0', borderBottom: '1px solid var(--border-color)', opacity: 0.7 }}>
                <strong>{c.title}</strong>
                {c.amount != null && <span className="badge badge-success" style={{ marginLeft: '0.5rem' }}>${Number(c.amount).toFixed(2)}</span>}
                <span style={{ marginLeft: '0.5rem', color: 'var(--success-color)' }}>Verified</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
