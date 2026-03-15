import { useState, type FormEvent } from 'react';
import type { SavingsGoal, GoalProjection } from '../types';

interface GoalCardProps {
  goal: SavingsGoal;
  projection?: GoalProjection;
  incompleteIndex: number;
  incompleteCount: number;
  formatCurrency: (amount: number) => string;
  formatDate: (dateStr: string) => string;
  onEdit: (id: number, data: { name: string; target_amount: number | null; want_by_date: string | null }) => Promise<void>;
  onDelete: (id: number) => void;
  onMove: (id: number, direction: -1 | 1) => void;
}

export default function GoalCard({ goal, projection: proj, incompleteIndex, incompleteCount, formatCurrency, formatDate, onEdit, onDelete, onMove }: GoalCardProps) {
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState('');
  const [editTarget, setEditTarget] = useState('');
  const [editWantBy, setEditWantBy] = useState('');

  const progress = goal.target_amount ? Math.min(100, (Number(goal.current_amount) / Number(goal.target_amount)) * 100) : null;

  function startEdit() {
    setEditName(goal.name);
    setEditTarget(goal.target_amount ? String(goal.target_amount) : '');
    setEditWantBy(goal.want_by_date?.slice(0, 10) ?? '');
    setEditing(true);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    await onEdit(goal.id, {
      name: editName,
      target_amount: editTarget ? parseFloat(editTarget) : null,
      want_by_date: editWantBy || null,
    });
    setEditing(false);
  }

  if (editing) {
    return (
      <div className="item-card" style={{ flexDirection: 'column', gap: '0.25rem' }}>
        <form onSubmit={handleSubmit} style={{ width: '100%' }}>
          <div className="form-row">
            <div className="form-group form-group-grow">
              <input type="text" value={editName} onChange={e => setEditName(e.target.value)} required />
            </div>
            <div className="form-group">
              <input type="number" step="0.01" min="0" value={editTarget} onChange={e => setEditTarget(e.target.value)} placeholder="Target" />
            </div>
            <div className="form-group">
              <input type="date" value={editWantBy} onChange={e => setEditWantBy(e.target.value)} />
            </div>
          </div>
          <div className="form-actions">
            <button type="submit" className="btn btn-sm btn-primary">Save</button>
            <button type="button" className="btn btn-sm btn-ghost" onClick={() => setEditing(false)}>Cancel</button>
          </div>
        </form>
      </div>
    );
  }

  return (
    <div className="item-card" style={{ flexDirection: 'column', gap: '0.25rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', cursor: 'pointer' }} onClick={startEdit}>
        <div className="item-details">
          <div className="item-header">
            {!goal.is_completed && <span style={{ color: 'var(--color-text-muted)', fontSize: '0.8rem', fontWeight: 600 }}>#{incompleteIndex + 1}</span>}
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
            <button onClick={() => onMove(goal.id, -1)} className="btn btn-sm btn-ghost" disabled={incompleteIndex === 0} title="Move up" style={{ padding: '0.1rem 0.4rem' }}>&uarr;</button>
          )}
          <button onClick={() => onDelete(goal.id)} className="btn btn-sm btn-ghost" title="Delete" style={{ padding: '0.1rem 0.4rem', color: 'var(--color-danger)' }}>&times;</button>
          {!goal.is_completed && (
            <button onClick={() => onMove(goal.id, 1)} className="btn btn-sm btn-ghost" disabled={incompleteIndex === incompleteCount - 1} title="Move down" style={{ padding: '0.1rem 0.4rem' }}>&darr;</button>
          )}
        </div>
      </div>
    </div>
  );
}
