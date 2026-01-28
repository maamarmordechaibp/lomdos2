import React, { createContext, useContext, useEffect, useState } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';

export type UserRole = 'admin' | 'user';

interface UserProfile {
  id: string;
  email: string;
  role: UserRole;
  name: string | null;
  created_at: string;
}

interface AuthContextType {
  user: User | null;
  session: Session | null;
  profile: UserProfile | null;
  loading: boolean;
  isAdmin: boolean;
  signIn: (email: string, password: string) => Promise<{ error: any }>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Known admin email - bypass profile check for this user
const ADMIN_EMAIL = '3762437@gmail.com';

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  // Create a default profile based on email
  const createDefaultProfile = (userId: string, email: string): UserProfile => ({
    id: userId,
    email: email,
    role: email === ADMIN_EMAIL ? 'admin' : 'user',
    name: email.split('@')[0],
    created_at: new Date().toISOString(),
  });

  const fetchProfile = async (userId: string, email: string): Promise<UserProfile | null> => {
    try {
      // Use a timeout promise race instead of abortSignal
      const timeoutPromise = new Promise<null>((_, reject) => 
        setTimeout(() => reject(new Error('Profile fetch timeout')), 3000)
      );
      
      const fetchPromise = supabase
        .from('user_profiles' as any)
        .select('*')
        .eq('id', userId)
        .single()
        .then(({ data, error }) => {
          if (error) throw error;
          return data as unknown as UserProfile;
        });
      
      const result = await Promise.race([fetchPromise, timeoutPromise]);
      return result;
    } catch (err: any) {
      console.warn('Profile fetch exception, using default:', err.message);
      return createDefaultProfile(userId, email);
    }
  };

  const refreshProfile = async () => {
    if (user) {
      const profileData = await fetchProfile(user.id, user.email || '');
      setProfile(profileData);
    }
  };

  useEffect(() => {
    let mounted = true;
    
    // Fallback timeout - if loading takes too long, stop
    const loadingTimeout = setTimeout(() => {
      if (mounted && loading) {
        console.log('Auth loading timeout');
        setLoading(false);
      }
    }, 4000);
    
    // Get initial session
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!mounted) return;
      
      if (session?.user) {
        setSession(session);
        setUser(session.user);
        
        // Use default profile immediately, then try to fetch real one
        const defaultProfile = createDefaultProfile(session.user.id, session.user.email || '');
        setProfile(defaultProfile);
        setLoading(false);
        
        // Try to fetch real profile in background (non-blocking)
        fetchProfile(session.user.id, session.user.email || '').then(p => {
          if (mounted && p) setProfile(p);
        });
      } else {
        setLoading(false);
      }
    }).catch((err) => {
      console.error('Error getting session:', err);
      if (mounted) {
        setLoading(false);
      }
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (!mounted) return;
        setSession(session);
        setUser(session?.user ?? null);
        
        if (session?.user) {
          // Set default profile immediately
          const defaultProfile = createDefaultProfile(session.user.id, session.user.email || '');
          setProfile(defaultProfile);
          
          // Try to fetch real profile in background
          fetchProfile(session.user.id, session.user.email || '').then(p => {
            if (mounted && p) setProfile(p);
          });
        } else {
          setProfile(null);
        }
        setLoading(false);
      }
    );
    
    return () => {
      mounted = false;
      clearTimeout(loadingTimeout);
      subscription.unsubscribe();
    };
  }, []);

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    return { error };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setProfile(null);
    // Clear any stale auth data from localStorage
    try {
      const keysToRemove = Object.keys(localStorage).filter(key => 
        key.startsWith('sb-') || key.includes('supabase')
      );
      keysToRemove.forEach(key => localStorage.removeItem(key));
    } catch {
      // Ignore storage errors
    }
  };

  const value = {
    user,
    session,
    profile,
    loading,
    isAdmin: profile?.role === 'admin',
    signIn,
    signOut,
    refreshProfile,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
