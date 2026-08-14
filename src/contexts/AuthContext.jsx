// src/contexts/AuthContext.jsx
import React, { createContext, useContext, useEffect, useState } from 'react';
import { pb, supabase } from '@/lib/supabaseClient';

const AuthContext = createContext({});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [isAuthed, setIsAuthed] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const init = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        
        if (session?.user) {
          const { data: userData } = await supabase
            .from('users')
            .select('*')
            .eq('id', session.user.id)
            .single();
          
          setUser({ ...session.user, ...userData });
          setIsAuthed(true);
          pb.authStore.record = session.user;
          pb.authStore.token = session.access_token;
          pb.authStore.isAuth = true;
        }
      } catch (error) {
        console.error('❌ Erreur init auth:', error);
      } finally {
        setLoading(false);
      }
    };
    
    init();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (event === 'SIGNED_IN' && session?.user) {
          const { data: userData } = await supabase
            .from('users')
            .select('*')
            .eq('id', session.user.id)
            .single();
          setUser({ ...session.user, ...userData });
          setIsAuthed(true);
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
      subscription?.unsubscribe();
    };
  }, []);

  const login = async (email, password) => {
    const data = await pb.authWithPassword(email, password);
    
    const { data: userData } = await supabase
      .from('users')
      .select('*')
      .eq('id', data.user.id)
      .single();
    
    setUser({ ...data.user, ...userData });
    setIsAuthed(true);
    return data;
  };

  const signup = async (email, password, userData = {}) => {
    const data = await pb.authWithSignUp(email, password, userData);
    
    const { data: userDataComplete } = await supabase
      .from('users')
      .select('*')
      .eq('id', data.user.id)
      .single();
    
    setUser({ ...data.user, ...userDataComplete });
    setIsAuthed(true);
    return data;
  };

  const logout = async () => {
    await pb.authLogout();
    setUser(null);
    setIsAuthed(false);
  };

  const value = {
    user,
    isAuthed,
    loading,
    login,
    signup,
    logout,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};