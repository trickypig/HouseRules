import { useState, useEffect, useRef, useCallback, type FormEvent } from 'react';
import { useParams, Link } from 'react-router-dom';
import type { ShoppingList, ShoppingListItem } from '../types';
import { useAuth } from '../context/AuthContext';
import * as api from '../api/client';

export default function ShoppingListDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { isKid, user } = useAuth();
  const [list, setList] = useState<ShoppingList | null>(null);
  const [items, setItems] = useState<ShoppingListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Add item form
  const [description, setDescription] = useState('');
  const [quantity, setQuantity] = useState('');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Autocomplete
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();
  const inputRef = useRef<HTMLInputElement>(null);

  const listId = Number(id);

  useEffect(() => { load(); }, [id]);

  async function load() {
    try {
      const data = await api.getShoppingItems(listId);
      setList(data.list);
      setItems(data.items);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }

  const handleDescriptionChange = useCallback((value: string) => {
    setDescription(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (value.length >= 2) {
      debounceRef.current = setTimeout(async () => {
        try {
          const data = await api.autocompleteShoppingItem(value);
          setSuggestions(data.suggestions);
          setShowSuggestions(data.suggestions.length > 0);
        } catch {
          setSuggestions([]);
        }
      }, 300);
    } else {
      setSuggestions([]);
      setShowSuggestions(false);
    }
  }, []);

  async function handleAdd(e: FormEvent) {
    e.preventDefault();
    if (!description.trim()) return;
    setSubmitting(true);
    try {
      await api.addShoppingItem(listId, { description: description.trim(), quantity, notes });
      setDescription(''); setQuantity(''); setNotes('');
      setShowSuggestions(false);
      await load();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to add');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleToggle(itemId: number) {
    try {
      await api.toggleShoppingItem(itemId);
      await load();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to update');
    }
  }

  async function handleDelete(itemId: number) {
    try {
      await api.deleteShoppingItem(itemId);
      await load();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to delete');
    }
  }

  if (loading) return <div className="loading-spinner"><div className="spinner" /></div>;
  if (!list) return <div className="alert alert-error">List not found</div>;

  function formatDate(dateStr: string): string {
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }

  const unpurchased = items.filter(i => !i.is_purchased);
  const purchased = items.filter(i => i.is_purchased);

  return (
    <div className="shopping-detail">
      <div className="page-header">
        <div>
          <Link to="/shopping" style={{ color: 'var(--text-secondary)', textDecoration: 'none' }}>&larr; All Lists</Link>
          <h1 style={{ marginTop: '0.25rem' }}>{list.name}</h1>
        </div>
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      {/* Add item form */}
      <div className="card" style={{ marginBottom: '1.5rem' }}>
        <div className="card-body">
          <form onSubmit={handleAdd}>
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'end', flexWrap: 'wrap' }}>
              <div className="form-group" style={{ flex: 2, minWidth: '200px', marginBottom: 0, position: 'relative' }}>
                <label>Item</label>
                <input ref={inputRef} className="form-control" value={description}
                  onChange={e => handleDescriptionChange(e.target.value)}
                  onFocus={() => suggestions.length > 0 && setShowSuggestions(true)}
                  onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
                  placeholder="What do you need?" required autoComplete="off" />
                {showSuggestions && (
                  <div style={{
                    position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 10,
                    background: 'var(--bg-primary)', border: '1px solid var(--border-color)',
                    borderRadius: '0.375rem', boxShadow: '0 4px 6px rgba(0,0,0,0.1)', maxHeight: '200px', overflow: 'auto'
                  }}>
                    {suggestions.map((s, i) => (
                      <div key={i} style={{ padding: '0.5rem 0.75rem', cursor: 'pointer' }}
                        onMouseDown={() => { setDescription(s); setShowSuggestions(false); }}>
                        {s}
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <div className="form-group" style={{ flex: 1, minWidth: '100px', marginBottom: 0 }}>
                <label>Qty</label>
                <input className="form-control" value={quantity} onChange={e => setQuantity(e.target.value)} placeholder="e.g. 2 lbs" />
              </div>
              <div className="form-group" style={{ flex: 1, minWidth: '100px', marginBottom: 0 }}>
                <label>Notes</label>
                <input className="form-control" value={notes} onChange={e => setNotes(e.target.value)} placeholder="Optional" />
              </div>
              <button type="submit" className="btn btn-primary" disabled={submitting} style={{ whiteSpace: 'nowrap' }}>
                {submitting ? 'Adding...' : 'Add'}
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* Unpurchased items */}
      <div className="card" style={{ marginBottom: '1.5rem' }}>
        <div className="card-header"><h3>To Buy ({unpurchased.length})</h3></div>
        <div className="card-body">
          {unpurchased.length === 0 ? (
            <p style={{ color: 'var(--text-secondary)' }}>All done! Nothing left to buy.</p>
          ) : unpurchased.map(item => (
            <ItemRow key={item.id} item={item} onToggle={handleToggle} onDelete={handleDelete}
              canDelete={!isKid || item.added_by_user_id === user?.id} formatDate={formatDate} />
          ))}
        </div>
      </div>

      {/* Purchased items */}
      {purchased.length > 0 && (
        <div className="card">
          <div className="card-header"><h3>Purchased ({purchased.length})</h3></div>
          <div className="card-body">
            {purchased.map(item => (
              <ItemRow key={item.id} item={item} onToggle={handleToggle} onDelete={handleDelete}
                canDelete={!isKid || item.added_by_user_id === user?.id} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function ItemRow({ item, onToggle, onDelete, canDelete, formatDate }: {
  item: ShoppingListItem;
  onToggle: (id: number) => void;
  onDelete: (id: number) => void;
  canDelete: boolean;
  formatDate: (d: string) => string;
}) {
  return (
    <div style={{
      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      padding: '0.5rem 0', borderBottom: '1px solid var(--border-color)',
      opacity: item.is_purchased ? 0.6 : 1,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flex: 1 }}>
        <input type="checkbox" checked={!!item.is_purchased} onChange={() => onToggle(item.id)}
          style={{ width: '1.2rem', height: '1.2rem', cursor: 'pointer' }} />
        <div>
          <span style={{ textDecoration: item.is_purchased ? 'line-through' : 'none', fontWeight: 500 }}>
            {item.description}
          </span>
          {item.quantity && <span style={{ marginLeft: '0.5rem', color: 'var(--text-secondary)' }}>({item.quantity})</span>}
          {item.is_request === 1 && <span className="badge" style={{ marginLeft: '0.5rem', background: 'var(--info-color)', color: '#fff', fontSize: '0.7rem' }}>Requested</span>}
          {item.notes && <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>{item.notes}</div>}
          <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
            {item.added_by_name || 'Unknown'}
            {item.is_purchased && item.purchased_at
              ? <> &middot; Purchased {formatDate(item.purchased_at)}</>
              : <> &middot; Added {formatDate(item.created_at)}</>
            }
          </div>
        </div>
      </div>
      {canDelete && (
        <button className="btn btn-sm btn-danger" onClick={() => onDelete(item.id)} style={{ marginLeft: '0.5rem' }}>
          &times;
        </button>
      )}
    </div>
  );
}
