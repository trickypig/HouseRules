import { useState, useEffect, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import type { ShoppingList } from '../types';
import { useAuth } from '../context/AuthContext';
import * as api from '../api/client';

export default function ShoppingListsPage() {
  const { isKid } = useAuth();
  const [lists, setLists] = useState<ShoppingList[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Form
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [name, setName] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => { load(); }, []);

  async function load() {
    try {
      const data = await api.getShoppingLists();
      setLists(data.lists);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      if (editingId) {
        await api.updateShoppingList(editingId, { name });
      } else {
        await api.createShoppingList({ name });
      }
      setName(''); setEditingId(null); setShowForm(false);
      await load();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(id: number) {
    if (!confirm('Delete this list and all its items?')) return;
    try {
      await api.deleteShoppingList(id);
      await load();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to delete');
    }
  }

  if (loading) return <div className="loading-spinner"><div className="spinner" /></div>;

  return (
    <div className="shopping-lists">
      <div className="page-header">
        <h1>Shopping Lists</h1>
        {!isKid && (
          <button className="btn btn-primary" onClick={() => { setName(''); setEditingId(null); setShowForm(true); }}>
            + New List
          </button>
        )}
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      {showForm && (
        <div className="card" style={{ marginBottom: '1.5rem' }}>
          <div className="card-body">
            <form onSubmit={handleSubmit} style={{ display: 'flex', gap: '0.5rem', alignItems: 'end' }}>
              <div className="form-group" style={{ flex: 1, marginBottom: 0 }}>
                <label>{editingId ? 'Rename List' : 'List Name'}</label>
                <input className="form-control" value={name} onChange={e => setName(e.target.value)}
                  placeholder="e.g. Groceries" required autoFocus />
              </div>
              <button type="submit" className="btn btn-primary" disabled={submitting}>
                {submitting ? 'Saving...' : (editingId ? 'Rename' : 'Create')}
              </button>
              <button type="button" className="btn btn-outline" onClick={() => setShowForm(false)}>Cancel</button>
            </form>
          </div>
        </div>
      )}

      {lists.length === 0 ? (
        <div className="card">
          <div className="card-body" style={{ textAlign: 'center', color: 'var(--text-secondary)' }}>
            <p>No shopping lists yet.</p>
          </div>
        </div>
      ) : (
        <div className="kids-grid">
          {lists.map(list => (
            <div key={list.id} className="card kid-card">
              <Link to={`/shopping/${list.id}`} style={{ textDecoration: 'none', color: 'inherit', display: 'block' }}>
                <div className="card-body">
                  <h3 style={{ textAlign: 'center' }}>{list.name}</h3>
                  {(list.unpurchased_items?.length ?? 0) > 0 && (
                    <div style={{ fontSize: '0.85rem', marginTop: '0.5rem' }}>
                      <strong>On list:</strong> {list.unpurchased_items!.join(', ')}
                    </div>
                  )}
                  {(list.purchased_items?.length ?? 0) > 0 && (
                    <div style={{ fontSize: '0.85rem', marginTop: '0.25rem', color: 'var(--color-text-muted)' }}>
                      <strong>Purchased:</strong> {list.purchased_items!.join(', ')}
                    </div>
                  )}
                  {(list.item_count ?? 0) === 0 && (
                    <div style={{ fontSize: '0.85rem', marginTop: '0.5rem', color: 'var(--color-text-muted)', textAlign: 'center' }}>
                      No items yet
                    </div>
                  )}
                </div>
              </Link>
              {!isKid && (
                <div style={{ display: 'flex', gap: '0.5rem', padding: '0 1rem 1rem', justifyContent: 'center' }}>
                  <button className="btn btn-sm btn-outline" onClick={() => {
                    setEditingId(list.id); setName(list.name); setShowForm(true);
                  }}>Rename</button>
                  <button className="btn btn-sm btn-danger" onClick={() => handleDelete(list.id)}>Delete</button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
