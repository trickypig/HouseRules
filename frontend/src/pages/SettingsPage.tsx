import { useState, useEffect, type FormEvent } from 'react';
import type { Kid, KidUser, Household, HouseholdMember } from '../types';
import { useAuth } from '../context/AuthContext';
import * as api from '../api/client';

export default function SettingsPage() {
  const { user, isKid, refreshUser, logout } = useAuth();
  const [kids, setKids] = useState<Kid[]>([]);
  const [kidUsers, setKidUsers] = useState<KidUser[]>([]);
  const [household, setHousehold] = useState<Household | null>(null);
  const [members, setMembers] = useState<HouseholdMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Profile form
  const [displayName, setDisplayName] = useState(user?.display_name ?? '');
  const [familyDisplayName, setFamilyDisplayName] = useState(user?.family_display_name ?? '');
  const [savingProfile, setSavingProfile] = useState(false);

  // Add kid form
  const [showAddKid, setShowAddKid] = useState(false);
  const [newKidName, setNewKidName] = useState('');
  const [newKidColor, setNewKidColor] = useState('#4A90D9');
  const [newKidAvatar, setNewKidAvatar] = useState('');
  const [addingKid, setAddingKid] = useState(false);

  // Household name
  const [householdName, setHouseholdName] = useState('');
  const [savingHousehold, setSavingHousehold] = useState(false);

  // Join household
  const [showJoin, setShowJoin] = useState(false);
  const [inviteCode, setInviteCode] = useState('');
  const [joining, setJoining] = useState(false);

  useEffect(() => {
    load();
  }, []);

  async function load() {
    try {
      if (!isKid) {
        const [kidData, kidUserData, householdData] = await Promise.all([
          api.getKids(),
          api.getKidUsers(),
          api.getHousehold(),
        ]);
        setKids(kidData.kids);
        setKidUsers(kidUserData.kid_users);
        setHousehold(householdData.household);
        setHouseholdName(householdData.household.name);
        setMembers(householdData.members);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }

  async function handleProfileSave(e: FormEvent) {
    e.preventDefault();
    setSavingProfile(true);
    setError('');
    setSuccess('');
    try {
      await api.updateProfile({
        display_name: displayName,
        family_display_name: familyDisplayName,
      });
      await refreshUser();
      setSuccess('Profile updated.');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to update profile');
    } finally {
      setSavingProfile(false);
    }
  }

  async function handleAddKid(e: FormEvent) {
    e.preventDefault();
    setAddingKid(true);
    setError('');
    try {
      await api.createKid({ name: newKidName, color: newKidColor, avatar: newKidAvatar });
      setNewKidName('');
      setNewKidColor('#4A90D9');
      setNewKidAvatar('');
      setShowAddKid(false);
      await load();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to add kid');
    } finally {
      setAddingKid(false);
    }
  }

  async function handleDeleteKid(id: number, name: string) {
    if (!confirm(`Delete ${name}? This will remove all their transactions, goals, and chore history.`)) return;
    setError('');
    try {
      await api.deleteKid(id);
      await load();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to delete kid');
    }
  }

  async function handleHouseholdNameSave() {
    setSavingHousehold(true);
    setError('');
    setSuccess('');
    try {
      const res = await api.updateHousehold({ name: householdName });
      setHousehold(res.household);
      setSuccess('Household name updated.');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to update household name');
    } finally {
      setSavingHousehold(false);
    }
  }

  async function handleRegenerateCode() {
    setError('');
    try {
      const res = await api.regenerateInviteCode();
      setHousehold(h => h ? { ...h, invite_code: res.invite_code } : h);
      setSuccess('Invite code regenerated.');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to regenerate code');
    }
  }

  async function handleJoinHousehold(e: FormEvent) {
    e.preventDefault();
    setJoining(true);
    setError('');
    setSuccess('');
    try {
      const res = await api.joinHousehold(inviteCode);
      // Update the token since household_id changed
      localStorage.setItem('token', res.token);
      await refreshUser();
      setInviteCode('');
      setShowJoin(false);
      setSuccess('Joined household!');
      await load();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to join household');
    } finally {
      setJoining(false);
    }
  }

  if (loading) {
    return <div className="loading-container"><div className="spinner" /><p>Loading...</p></div>;
  }

  return (
    <div>
      <h1>Settings</h1>

      {error && <div className="error-message">{error}</div>}
      {success && <div className="success-message">{success}</div>}

      {/* Profile */}
      <div className="card" style={{ marginBottom: '1.5rem' }}>
        <div className="card-header"><h3>Profile</h3></div>
        <div className="card-body">
          <form onSubmit={handleProfileSave}>
            <div className="form-group">
              <label>Display Name</label>
              <input className="form-control" value={displayName}
                onChange={e => setDisplayName(e.target.value)} required />
            </div>
            <div className="form-group">
              <label>Family Display Name</label>
              <input className="form-control" value={familyDisplayName}
                onChange={e => setFamilyDisplayName(e.target.value)}
                placeholder='e.g. "Mom", "Dad"' />
              <small style={{ color: 'var(--color-text-muted)' }}>
                What your kids see (e.g. "Dad", "Mom"). Leave empty to use your display name.
              </small>
            </div>
            <div className="form-actions">
              <button type="submit" className="btn btn-primary" disabled={savingProfile}>
                {savingProfile ? 'Saving...' : 'Save'}
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* Household - parents only */}
      {!isKid && household && (
        <div className="card" style={{ marginBottom: '1.5rem' }}>
          <div className="card-header"><h3>Household</h3></div>
          <div className="card-body">
            <div className="form-group">
              <label>Household Name</label>
              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                <input className="form-control" value={householdName}
                  onChange={e => setHouseholdName(e.target.value)} style={{ flex: 1 }} />
                <button className="btn btn-sm btn-primary" disabled={savingHousehold || householdName === household.name}
                  onClick={handleHouseholdNameSave}>
                  {savingHousehold ? 'Saving...' : 'Save'}
                </button>
              </div>
            </div>

            <div className="form-group">
              <label>Members</label>
              {members.map(m => (
                <div key={m.id} style={{ padding: '0.25rem 0', color: 'var(--color-text-secondary)' }}>
                  {m.display_name}
                  {m.family_display_name ? ` (${m.family_display_name})` : ''}
                  {m.id === user?.id ? ' (you)' : ''}
                </div>
              ))}
            </div>

            <div className="form-group">
              <label>Invite Code</label>
              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                <code style={{
                  background: 'var(--color-bg)', padding: '0.4rem 0.75rem',
                  borderRadius: 'var(--radius-sm)', fontSize: '1rem', letterSpacing: '0.1em',
                  border: '1px solid var(--color-border)',
                }}>
                  {household.invite_code}
                </code>
                <button className="btn btn-sm btn-outline" onClick={handleRegenerateCode}>
                  Regenerate
                </button>
              </div>
              <small style={{ color: 'var(--color-text-muted)' }}>
                Share this code with another parent to let them join your household.
              </small>
            </div>

            <div style={{ borderTop: '1px solid var(--color-border)', paddingTop: '1rem', marginTop: '0.5rem' }}>
              {showJoin ? (
                <form onSubmit={handleJoinHousehold} style={{ display: 'flex', gap: '0.5rem', alignItems: 'end' }}>
                  <div className="form-group" style={{ flex: 1, marginBottom: 0 }}>
                    <label>Join Another Household</label>
                    <input className="form-control" value={inviteCode}
                      onChange={e => setInviteCode(e.target.value)}
                      placeholder="Enter invite code" required autoFocus />
                  </div>
                  <button type="submit" className="btn btn-primary" disabled={joining}>
                    {joining ? 'Joining...' : 'Join'}
                  </button>
                  <button type="button" className="btn btn-outline" onClick={() => setShowJoin(false)}>Cancel</button>
                </form>
              ) : (
                <button className="btn btn-sm btn-outline" onClick={() => setShowJoin(true)}>
                  Join Another Household
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Kids Management - parents only */}
      {!isKid && (
        <div className="card" style={{ marginBottom: '1.5rem' }}>
          <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3>Kids</h3>
            <button className="btn btn-sm btn-primary" onClick={() => { setShowAddKid(!showAddKid); }}>
              + Add Kid
            </button>
          </div>
          <div className="card-body">
            {showAddKid && (
              <form onSubmit={handleAddKid} style={{ marginBottom: '1rem', paddingBottom: '1rem', borderBottom: '1px solid var(--color-border)' }}>
                <div className="form-row">
                  <div className="form-group form-group-grow">
                    <label>Name</label>
                    <input className="form-control" value={newKidName}
                      onChange={e => setNewKidName(e.target.value)} required placeholder="Kid's name" autoFocus />
                  </div>
                  <div className="form-group">
                    <label>Color</label>
                    <input type="color" className="form-control" value={newKidColor}
                      onChange={e => setNewKidColor(e.target.value)} style={{ height: '38px', padding: '2px' }} />
                  </div>
                  <div className="form-group">
                    <label>Avatar (emoji)</label>
                    <input className="form-control" value={newKidAvatar}
                      onChange={e => setNewKidAvatar(e.target.value)} placeholder="e.g. &#128522;" style={{ width: '80px' }} />
                  </div>
                </div>
                <div className="form-actions">
                  <button type="submit" className="btn btn-primary" disabled={addingKid}>
                    {addingKid ? 'Adding...' : 'Add Kid'}
                  </button>
                  <button type="button" className="btn btn-outline" onClick={() => setShowAddKid(false)}>Cancel</button>
                </div>
              </form>
            )}

            {kids.length === 0 ? (
              <p style={{ color: 'var(--color-text-muted)' }}>No kids added yet.</p>
            ) : (
              kids.map(kid => {
                const kidUser = kidUsers.find(ku => ku.kid_id === kid.id);
                return (
                  <div key={kid.id} style={{
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    padding: '0.75rem 0', borderBottom: '1px solid var(--color-border)',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                      <div style={{
                        width: 36, height: 36, borderRadius: '50%', background: kid.color,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: kid.avatar ? '1.1rem' : '0.9rem', color: '#fff', fontWeight: 700,
                      }}>
                        {kid.avatar || kid.name.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <strong>{kid.name}</strong>
                        {kidUser && (
                          <div style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>
                            Login: {kidUser.email}
                          </div>
                        )}
                      </div>
                    </div>
                    <button className="btn btn-sm btn-danger" onClick={() => handleDeleteKid(kid.id, kid.name)}>
                      Delete
                    </button>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      <button className="btn btn-outline" onClick={logout} style={{ width: '100%' }}>
        Log Out
      </button>
    </div>
  );
}
