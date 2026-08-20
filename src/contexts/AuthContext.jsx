import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { pb, supabase } from '@/lib/supabaseClient';

const AuthContext = createContext({});
export const useAuth = () => useContext(AuthContext);

const ADMIN_EMAIL = 'digihouse10@gmail.com';

// Ensure public.users row exists; auto-set admin role for main admin
const ensureUserRow = async (authUser) => {
  // Try reading existing row
  const { data: existing } = await supabase
    .from('users').select('*').eq('id', authUser.id).single();

  if (existing) {
    // Auto-fix: main admin must always have role=admin
    if (existing.email === ADMIN_EMAIL && existing.role !== 'admin') {
      await supabase.from('users').update({ role: 'admin' }).eq('id', existing.id);
      return { ...existing, role: 'admin' };
    }
    return existing;
  }

  // Row missing — create it
  const isMainAdminEmail = authUser.email === ADMIN_EMAIL;
  const newRow = {
    id: authUser.id,
    email: authUser.email,
    name: authUser.user_metadata?.name || '',
    referral_code: 'OBJ-' + Math.random().toString(36).slice(2, 8).toUpperCase(),
    points: 0,
    points_earned: 0,
    plan: 'free',
    role: isMainAdminEmail ? 'admin' : 'user',
  };

  const { error } = await supabase.from('users').insert(newRow);
  if (error) {
    console.warn('ensureUserRow insert failed:', error.message);
    return null;
  }

  const { data: created } = await supabase
    .from('users').select('*').eq('id', authUser.id).single();
  return created;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [isAuthed, setIsAuthed] = useState(false);
  const [loading, setLoading] = useState(true);

  const buildUser = useCallback(async (authUser) => {
    try {
      const row = await ensureUserRow(authUser);
      const merged = row ? { ...authUser, ...row } : authUser;
      setUser(merged);
      setIsAuthed(true);
      return merged;
    } catch (e) {
      console.warn('buildUser ensureUserRow error:', e);
      setUser(authUser);
      setIsAuthed(true);
      return authUser;
    }
  }, []);

  const refreshUser = useCallback(async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        await buildUser(session.user);
      }
    } catch (e) {
      console.warn('refreshUser error:', e);
    }
  }, [buildUser]);

  useEffect(() => {
    let mounted = true;

    const init = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user && mounted) {
          await buildUser(session.user);
          pb.authStore.record = session.user;
          pb.authStore.token = session.access_token;
          pb.authStore.isAuth = true;
        }
      } catch (error) {
        console.error('Erreur init auth:', error);
      } finally {
        if (mounted) setLoading(false);
      }
    };
    init();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if ((event === 'SIGNED_IN' || event === 'INITIAL_SESSION' || event === 'TOKEN_REFRESHED') && session?.user) {
          await buildUser(session.user);
          pb.authStore.record = session.user;
          pb.authStore.token = session.access_token;
          pb.authStore.isAuth = true;
        } else if (event === 'SIGNED_OUT') {
          setUser(null);
          setIsAuthed(false);
          pb.authStore.record = null;
          pb.authStore.token = null;
          pb.authStore.isAuth = false;
        }
      }
    );

    return () => {
      mounted = false;
      subscription?.unsubscribe();
    };
  }, [buildUser]);

  const login = async (email, password) => {
    const data = await pb.authWithPassword(email, password);
    await buildUser(data.user);
    return data;
  };

  const signup = async (email, password, userData = {}) => {
    const data = await pb.authWithSignUp(email, password, userData);

    // Email confirmation enabled — no session yet
    if (!data.session) {
      return { ...data, needsConfirmation: true };
    }

    // Wait for trigger to create public.users row (max 3s)
    if (data.user?.id) {
      let attempts = 0;
      let userDataRow = null;
      while (attempts < 10 && !userDataRow) {
        await new Promise((r) => setTimeout(r, 300));
        const { data: row } = await supabase
          .from('users').select('*').eq('id', data.user.id).single();
        if (row) userDataRow = row;
        attempts++;
      }
      const merged = userDataRow
        ? { ...data.user, ...userDataRow }
        : data.user;
      setUser(merged);
    }

    setIsAuthed(true);
    pb.authStore.record = data.user;
    pb.authStore.token = data.session?.access_token || null;
    pb.authStore.isAuth = !!data.session;

    return data;
  };

  const logout = async () => {
    await pb.authLogout();
    setUser(null);
    setIsAuthed(false);
  };

  const forgotPassword = async (email) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reinitialiser-mot-de-passe`,
    });
    if (error) throw error;
  };

  const resetPassword = async (newPassword) => {
    const { data, error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) throw error;
    return data;
  };

  const updateProfile = async (updates) => {
    if (!user?.id) throw new Error("Non connecté");
    const { error } = await supabase
      .from('users')
      .update({ name: updates.name, phone: updates.phone, city: updates.city })
      .eq('id', user.id);
    if (error) throw error;
    await refreshUser();
  };

  // ── ADMIN ──

  const isAdmin = user?.role === 'admin';
  const isMainAdmin = user?.email === ADMIN_EMAIL && user?.role === 'admin';

  const adminSetRole = async (targetUserId, newRole) => {
    if (!isMainAdmin) throw new Error("Seul l'administrateur principal peut modifier les rôles");
    const { error } = await supabase.rpc('admin_set_role', {
      target_user_id: targetUserId,
      new_role: newRole,
    });
    if (error) throw error;
  };

  const adminResetPassword = async (targetUserId) => {
    if (!isMainAdmin) throw new Error("Seul l'administrateur principal peut réinitialiser les mots de passe");
    const { error } = await supabase.rpc('admin_set_password', {
      target_id: targetUserId,
      new_password: '00000000',
    });
    if (error) throw error;
    return "Mot de passe réinitialisé à 00000000";
  };

  const value = {
    user, isAuthed, loading,
    isAdmin, isMainAdmin,
    login, signup, logout,
    forgotPassword, resetPassword, updateProfile, refreshUser,
    adminSetRole, adminResetPassword,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};
