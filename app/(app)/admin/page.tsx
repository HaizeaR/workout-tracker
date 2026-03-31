'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

interface AdminUser {
  id: number;
  username: string;
  email: string | null;
  is_admin: boolean | null;
  created_at: string;
}

interface AuthUser {
  userId: number;
  username: string;
  isAdmin: boolean;
}

export default function AdminPage() {
  const router = useRouter();
  const [authUser, setAuthUser] = useState<AuthUser | null>(null);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // New user form
  const [newUsername, setNewUsername] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newIsAdmin, setNewIsAdmin] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState('');

  useEffect(() => {
    async function load() {
      try {
        const meRes = await fetch('/api/auth/me');
        if (!meRes.ok) { router.push('/login'); return; }
        const meData = await meRes.json();
        const me: AuthUser = meData.user;
        setAuthUser(me);

        if (!me.isAdmin) {
          router.push('/dashboard');
          return;
        }

        const usersRes = await fetch('/api/admin/users');
        if (!usersRes.ok) { setError('No autorizado'); return; }
        const usersData = await usersRes.json();
        setUsers(usersData.users || []);
      } catch {
        setError('Error al cargar');
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [router]);

  async function handleDelete(id: number) {
    if (!confirm('¿Seguro que quieres eliminar este usuario?')) return;

    try {
      const res = await fetch(`/api/admin/users/${id}`, { method: 'DELETE' });
      if (!res.ok) {
        const data = await res.json();
        alert(data.error || 'Error al eliminar');
        return;
      }
      setUsers((prev) => prev.filter((u) => u.id !== id));
    } catch {
      alert('Error al eliminar');
    }
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setCreateError('');
    setCreating(true);

    try {
      const res = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: newUsername,
          email: newEmail || undefined,
          password: newPassword,
          is_admin: newIsAdmin,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setCreateError(data.error || 'Error al crear usuario');
        return;
      }

      setUsers((prev) => [...prev, data.user]);
      setNewUsername('');
      setNewEmail('');
      setNewPassword('');
      setNewIsAdmin(false);
    } catch {
      setCreateError('Error de conexión');
    } finally {
      setCreating(false);
    }
  }

  if (loading) {
    return (
      <div className="p-4 space-y-4" style={{ background: '#0f1117', minHeight: '100vh' }}>
        <div className="h-8 rounded-lg animate-pulse" style={{ background: '#1a1d24', width: '200px' }} />
        <div className="h-32 rounded-xl animate-pulse" style={{ background: '#1a1d24' }} />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4" style={{ background: '#0f1117', minHeight: '100vh' }}>
        <p style={{ color: '#e05050' }}>{error}</p>
      </div>
    );
  }

  return (
    <div className="p-4 max-w-2xl mx-auto" style={{ background: '#0f1117', minHeight: '100vh' }}>
      <h1 className="text-xl font-bold mb-6 pt-2" style={{ color: '#f0f0f0' }}>
        Administrar usuarios
      </h1>

      {/* Users list */}
      <div className="rounded-xl overflow-hidden mb-6" style={{ background: '#1a1d24', border: '1px solid #2a2d36' }}>
        <div className="px-4 py-3" style={{ borderBottom: '1px solid #2a2d36' }}>
          <p className="text-sm font-medium" style={{ color: '#888' }}>USUARIOS ({users.length})</p>
        </div>
        <div className="divide-y" style={{ borderColor: '#2a2d36' }}>
          {users.map((u) => (
            <div
              key={u.id}
              className="flex items-center justify-between px-4 py-3"
            >
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-medium" style={{ color: '#f0f0f0' }}>{u.username}</span>
                  {u.is_admin && (
                    <span
                      className="text-xs px-2 py-0.5 rounded-full font-medium"
                      style={{ background: '#2a3a0e', color: '#c4f135' }}
                    >
                      admin
                    </span>
                  )}
                </div>
                <p className="text-xs mt-0.5" style={{ color: '#888' }}>
                  {u.email || 'Sin email'}
                </p>
              </div>
              {u.id !== authUser?.userId && (
                <button
                  onClick={() => handleDelete(u.id)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
                  style={{ background: '#2d1010', color: '#e05050' }}
                >
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                  Eliminar
                </button>
              )}
              {u.id === authUser?.userId && (
                <span className="text-xs" style={{ color: '#555' }}>Tú</span>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Create user form */}
      <div className="rounded-xl p-4" style={{ background: '#1a1d24', border: '1px solid #2a2d36' }}>
        <h2 className="font-medium mb-4" style={{ color: '#f0f0f0' }}>Nuevo usuario</h2>
        <form onSubmit={handleCreate} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs mb-1" style={{ color: '#888' }}>Usuario *</label>
              <input
                type="text"
                value={newUsername}
                onChange={(e) => setNewUsername(e.target.value)}
                required
                className="w-full px-3 py-2 rounded-lg text-sm focus:outline-none"
                style={{ background: '#111', border: '1px solid #2a2d36', color: '#f0f0f0' }}
                placeholder="usuario"
                onFocus={(e) => (e.target.style.borderColor = '#c4f135')}
                onBlur={(e) => (e.target.style.borderColor = '#2a2d36')}
              />
            </div>
            <div>
              <label className="block text-xs mb-1" style={{ color: '#888' }}>Email</label>
              <input
                type="email"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                className="w-full px-3 py-2 rounded-lg text-sm focus:outline-none"
                style={{ background: '#111', border: '1px solid #2a2d36', color: '#f0f0f0' }}
                placeholder="email@ejemplo.com"
                onFocus={(e) => (e.target.style.borderColor = '#c4f135')}
                onBlur={(e) => (e.target.style.borderColor = '#2a2d36')}
              />
            </div>
          </div>

          <div>
            <label className="block text-xs mb-1" style={{ color: '#888' }}>Contraseña *</label>
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              required
              className="w-full px-3 py-2 rounded-lg text-sm focus:outline-none"
              style={{ background: '#111', border: '1px solid #2a2d36', color: '#f0f0f0' }}
              placeholder="••••••••"
              onFocus={(e) => (e.target.style.borderColor = '#c4f135')}
              onBlur={(e) => (e.target.style.borderColor = '#2a2d36')}
            />
          </div>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="newIsAdmin"
              checked={newIsAdmin}
              onChange={(e) => setNewIsAdmin(e.target.checked)}
              className="w-4 h-4 rounded cursor-pointer"
              style={{ accentColor: '#c4f135' }}
            />
            <label htmlFor="newIsAdmin" className="text-sm cursor-pointer" style={{ color: '#ccc' }}>
              Administrador
            </label>
          </div>

          {createError && (
            <div
              className="px-3 py-2 rounded-lg text-sm"
              style={{ background: '#2d1010', color: '#e05050' }}
            >
              {createError}
            </div>
          )}

          <button
            type="submit"
            disabled={creating}
            className="w-full py-2.5 px-4 font-semibold rounded-xl text-sm transition-all"
            style={{
              background: '#c4f135',
              color: '#0f1117',
              opacity: creating ? 0.8 : 1,
              cursor: creating ? 'not-allowed' : 'pointer',
            }}
          >
            {creating ? 'Creando...' : 'Crear usuario'}
          </button>
        </form>
      </div>
    </div>
  );
}
