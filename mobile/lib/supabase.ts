import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import { AppState } from 'react-native';
import { demoClient } from './demo';

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const key = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
if (!url || !key) {
  throw new Error('EXPO_PUBLIC_SUPABASE_URL / EXPO_PUBLIC_SUPABASE_ANON_KEY missing (see eas.json env)');
}

const real = createClient(url, key, {
  auth: {
    // AsyncStorage, not SecureStore: sessions exceed SecureStore's ~2KB value limit.
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

// Refresh tokens only while foregrounded; a backgrounded timer is unreliable on mobile.
AppState.addEventListener('change', (s) => {
  if (s === 'active') supabase.auth.startAutoRefresh();
  else supabase.auth.stopAutoRefresh();
});

let demo = false;
export const isDemo = () => demo;
export const setDemo = (on: boolean) => {
  demo = on;
};

// Data calls go to the sample data while demo mode is on; auth always stays real.
export const supabase = new Proxy(real, {
  get(target, prop, receiver) {
    if (demo && (prop === 'from' || prop === 'storage')) return (demoClient as any)[prop];
    const v = Reflect.get(target, prop, receiver);
    return typeof v === 'function' ? v.bind(target) : v;
  },
});
