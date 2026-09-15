import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { useStore } from 'better-auth/react';
import { pb, supabase, authClient } from '@/lib/supabaseClient';

const AuthContext = createContext({});
export const useAuth = () => useContext(AuthContext);

const ADMIN_EMAIL = 'digihouse10@gmail.com';

// Ensure users row exists; auto-set admin role for main admin
const ensureUserRow = async (authUser) => {
  let existing = null;
  try {
    const { data } = await supabase.from('users').select('*').eq('id', authUser.id).single();
    existing = data;
  } catch (_) {
    existing = null;
  }

  if (existing) {
    // Auto-fix: main admin must always have role=admin
    if (existing.email === ADMIN_EMAIL && existing.role !== 'admin') {
      await supabase.from('users').update({ role: 'admin' }).eq('id', existing.id);
      return { ...existing, role: 'admin' };
    }
    // Generate referral code if missing (row created by Better Auth)
    if (!existing.referral_code) {
      const code = 'OBJ-' + Math.random().toString(36).slice(2, 8).toUpperCase();
      await supabase.from('users').update({ referral_code: code }).eq('id', existing.id);
      return { ...existing, referral_code: code };
    }
    return existing;
  }

  // Row missing — create it
  const isMainAdminEmail = authUser.email === ADMIN_EMAIL;
  const newRow = {
    id: authUser.id,
    email: authUser.email,
    name: authUser.name || '',
    city: authUser.city || '',
    quarter: authUser.quarter || '',
    phone: authUser.phone || '',
    referral_code: 'OBJ-' + Math.random().toString(36).slice(2, 8).toUpperCase(),
    points: 0,
    points_earned: 0,
    plan: 'free',
    role: isMainAdminEmail ? 'admin' : 'user',
  };

  try {
    await supabase.from('users').insert(newRow);
  } catch (e) {
    console.warn('ensureUserRow insert failed:', e?.message || e);
  }

  const { data: created } = await supabase
    .from('users').select('*').eq('id', authUser.id).single();
  return created;
};

export const AuthProvider = ({ children }) => {
  const sessionState = useStore(authClient.$store.atoms.session);
  const { data: session, isPending } = sessionState || {};
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
      const { data: { session: s } } = await supabase.auth.getSession();
      if (s?.user) {
        await buildUser(s.user);
      }
    } catch (e) {
      console.warn('refreshUser error:', e);
    }
  }, [buildUser]);

  useEffect(() => {
    if (isPending) return;
    let cancelled = false;

    (async () => {
      const authUser = session?.user || null;
      if (authUser) {
        const merged = await buildUser(authUser);
        if (cancelled) return;
        if (merged?.blocked) {
          await pb.authLogout();
          setUser(null);
          setIsAuthed(false);
          localStorage.setItem("auth_block_reason", "Votre compte a été bloqué par l'administrateur.");
          return;
        }
        pb.authStore.record = authUser;
        pb.authStore.token = null;
        pb.authStore.isAuth = true;
      } else {
        setUser(null);
        setIsAuthed(false);
      }
      if (!cancelled) setLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [isPending, session?.user?.id, buildUser]);

  const login = async (email, password) => {
    const data = await pb.authWithPassword(email, password);
    const merged = await buildUser(data.user);
    if (merged?.blocked) {
      await pb.authLogout();
      setUser(null);
      setIsAuthed(false);
      throw new Error("Votre compte a été bloqué par l'administrateur. Contactez le support.");
    }
    return data;
  };

  const signup = async (email, password, userData = {}) => {
    const data = await pb.authWithSignUp(email, password, userData);

    // Pas de session (confirmation par email) — retour anticipé
    if (!data.session) {
      return { ...data, needsConfirmation: true };
    }

    if (data.user?.id) {
      try {
        const merged = await buildUser(data.user);
        if (merged) setUser(merged);
      } catch (_) {
        /* noop */
      }
    }

    setIsAuthed(true);
    pb.authStore.record = data.user;
    pb.authStore.token = data.token || null;
    pb.authStore.isAuth = true;

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
      .update({
        name: updates.name,
        phone: updates.phone,
        city: updates.city,
        quarter: updates.quarter ?? user.quarter ?? '',
      })
      .eq('id', user.id);
    if (error) throw error;
    await refreshUser();
  };

  // ── ADMIN ──

  const isAdmin = user?.role === 'admin';
  const isMainAdmin = user?.email === ADMIN_EMAIL && user?.role === 'admin';

  const adminSetRole = async (targetUserId, newRole) => {
    if (!isMainAdmin) throw new Error("Seul l'administrateur principal peut modifier les rôles");
    await supabase.rpc('admin_set_role', { target_user_id: targetUserId, new_role: newRole });
  };

  const adminResetPassword = async (targetUserId) => {
    if (!isMainAdmin) throw new Error("Seul l'administrateur principal peut réinitialiser les mots de passe");
    const result = await supabase.rpc('admin_set_password', { target_id: targetUserId, new_password: '00000000' });
    return result?.message || "Mot de passe réinitialisé à 00000000";
  };

  const adminBlockUser = async (targetUserId) => {
    if (!isMainAdmin) throw new Error("Seul l'administrateur principal peut bloquer un utilisateur");
    await supabase.rpc('admin_block_user', { target_id: targetUserId });
  };

  const adminUnblockUser = async (targetUserId) => {
    if (!isMainAdmin) throw new Error("Seul l'administrateur principal peut débloquer un utilisateur");
    await supabase.rpc('admin_unblock_user', { target_id: targetUserId });
  };

  const adminUpdateUserEmail = async (targetUserId, newEmail) => {
    if (!isMainAdmin) throw new Error("Seul l'administrateur principal peut modifier les emails");
    await supabase.rpc('admin_update_user_email', { target_id: targetUserId, new_email: newEmail });
  };

  const adminDeleteUser = async (targetUserId) => {
    if (!isMainAdmin) throw new Error("Seul l'administrateur principal peut supprimer un utilisateur");
    await supabase.rpc('admin_delete_user', { target_id: targetUserId });
  };

  const value = {
    user, isAuthed, loading,
    isAdmin, isMainAdmin,
    login, signup, logout,
    forgotPassword, resetPassword, updateProfile, refreshUser,
    adminSetRole, adminResetPassword, adminBlockUser, adminUnblockUser, adminUpdateUserEmail, adminDeleteUser,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};