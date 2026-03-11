import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signUp: (email: string, password: string) => Promise<{ error: Error | null }>;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  resetPasswordForEmail: (email: string) => Promise<{ error: Error | null }>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    // onAuthStateChange fires immediately with the current session (or null),
    // including OAuth hash tokens on the URL — so getSession() is redundant.
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (!isMounted) return;

        // Gate: block only brand-new OAuth users that do not have a profile yet
        if (event === 'SIGNED_IN' && session?.user) {
          const provider = session.user.app_metadata?.provider;
          if (provider && provider !== 'email') {
            // Existing users are allowed if a profile row already exists
            const { data: profile } = await supabase
              .from('profiles')
              .select('id')
              .eq('user_id', session.user.id)
              .maybeSingle();

            if (!profile) {
              // New OAuth user without prior signup — kick them out
              await supabase.auth.signOut();
              // Clear any OAuth hash tokens from the URL to prevent re-processing
              if (window.location.hash) {
                window.history.replaceState(null, '', window.location.pathname + window.location.search);
              }
              if (isMounted) {
                setSession(null);
                setUser(null);
                setLoading(false);
              }
              // Dispatch a custom event so the Auth page can show a toast
              window.dispatchEvent(new CustomEvent('oauth-no-invite', {
                detail: { message: 'Please sign up with an invite code first, then you can use Google Sign-In.' }
              }));
              return;
            }
          }
        }

        setSession(session);
        setUser(session?.user ?? null);
        setLoading(false);
      }
    );

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const signIn = async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    // Auto-link any pending property invites for this email
    if (!error && data.user) {
      await linkPendingInvites(data.user.id, data.user.email || email);
    }
    return { error: error as Error | null };
  };

  const signUp = async (email: string, password: string) => {
    const redirectUrl = `${window.location.origin}/dashboard`;
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { emailRedirectTo: redirectUrl }
    });
    // Auto-link any pending invites if signup doesn't require email confirmation
    if (!error && data.user) {
      await linkPendingInvites(data.user.id, data.user.email || email);
    }
    return { error: error as Error | null };
  };

  const linkPendingInvites = async (userId: string, email: string) => {
    try {
      await supabase
        .from('property_members')
        .update({ user_id: userId, status: 'accepted', accepted_at: new Date().toISOString() } as any)
        .eq('email', email.toLowerCase())
        .eq('status', 'pending');
    } catch (e) {
      console.error('Error linking pending invites:', e);
    }
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setSession(null);
  };

  const resetPasswordForEmail = async (email: string) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    return { error: error as Error | null };
  };

  return (
    <AuthContext.Provider value={{ user, session, loading, signUp, signIn, signOut, resetPasswordForEmail }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
