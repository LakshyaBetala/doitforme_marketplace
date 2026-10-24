import { Session } from '@supabase/supabase-js';
import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { demoProfile, demoSession } from './demo';
import { setDemo, supabase } from './supabase';

export type Profile = {
  id: string;
  name: string | null;
  phone: string | null;
  college: string | null;
  avatar_url: string | null;
  rating: number | null;
  rating_count: number | null;
  jobs_completed: number | null;
  kyc_status: string | null;
  kyc_verified: boolean | null;
  username: string | null;
  role: string | null;
  referral_code: string | null;
  points_balance: number | null;
  total_earned: number | null;
  upi_id: string | null;
  is_elite: boolean | null;
  inner_circle_role: string | null;
};

type Ctx = {
  session: Session | null;
  profile: Profile | null;
  loading: boolean;
  reload: () => Promise<void>;
  startDemo: () => void;
  signOut: () => Promise<void>;
};

const SessionCtx = createContext<Ctx>({
  session: null,
  profile: null,
  loading: true,
  reload: async () => {},
  startDemo: () => {},
  signOut: async () => {},
});

export const useSession = () => useContext(SessionCtx);

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  const loadProfile = useCallback(async (uid: string | null) => {
    if (!uid) return setProfile(null);
    const { data } = await supabase.from('users').select('*').eq('id', uid).maybeSingle();
    setProfile((data as Profile) ?? null);
  }, []);

  useEffect(() => {
    let alive = true;
    supabase.auth.getSession().then(async ({ data }) => {
      if (!alive) return;
      setSession(data.session);
      await loadProfile(data.session?.user.id ?? null);
      if (alive) setLoading(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => {
      setSession(s);
      // Defer: awaiting a Supabase call inside this callback can deadlock the client.
      setTimeout(() => void loadProfile(s?.user.id ?? null), 0);
    });
    return () => {
      alive = false;
      sub.subscription.unsubscribe();
    };
  }, [loadProfile]);

  const value: Ctx = {
    session,
    profile,
    loading,
    reload: () => loadProfile(session?.user.id ?? null),
    startDemo: () => {
      setDemo(true);
      setSession(demoSession);
      setProfile(demoProfile as Profile);
    },
    signOut: async () => {
      if (session === demoSession) {
        setDemo(false);
        setSession(null);
        setProfile(null);
        return;
      }
      await supabase.auth.signOut();
    },
  };
  return <SessionCtx.Provider value={value}>{children}</SessionCtx.Provider>;
}
