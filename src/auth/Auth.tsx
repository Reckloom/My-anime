import { createContext, useContext, useEffect, useState, type FormEvent, type ReactNode } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';

type AuthMode = 'login' | 'signup' | 'reset' | 'update';
type AuthContextValue = { session: Session | null; user: User | null; loading: boolean };
const AuthContext = createContext<AuthContextValue>({ session: null, user: null, loading: false });

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(Boolean(supabase));
  useEffect(() => {
    if (!supabase) { setLoading(false); return; }
    let active = true;
    supabase.auth.getSession().then(({ data }) => { if (active) { setSession(data.session); setLoading(false); } });
    const { data } = supabase.auth.onAuthStateChange((_event, nextSession) => { setSession(nextSession); setLoading(false); });
    return () => { active = false; data.subscription.unsubscribe(); };
  }, []);
  return <AuthContext.Provider value={{ session, loading, user: session?.user ?? null }}>{children}</AuthContext.Provider>;
}

export function useAuth() { return useContext(AuthContext); }

export function AuthGate({ children }: { children: ReactNode }) {
  const { session, loading } = useAuth();
  if (!supabase) return <><div className="dev-banner"><span>DEVELOPMENT MODE</span>Supabase is not configured. Local library mode is enabled; authentication will be required once environment variables are added.</div>{children}</>;
  if (loading) return <div className="auth-loading"><div className="auth-mark">F</div><span>Loading FRAME…</span></div>;
  return session ? <>{children}</> : <AuthScreen />;
}

function AuthScreen() {
  const [mode, setMode] = useState<AuthMode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => { if (window.location.hash.includes('type=recovery')) setMode('update'); }, []);

  const submit = async (event: FormEvent) => {
    event.preventDefault(); if (!supabase) return;
    setBusy(true); setMessage(''); setError('');
    try {
      if (mode === 'signup') {
        const { error: e } = await supabase.auth.signUp({ email, password }); if (e) throw e;
        setMessage('Account created. Check your email if confirmation is enabled in Supabase.'); setMode('login');
      } else if (mode === 'login') {
        const { error: e } = await supabase.auth.signInWithPassword({ email, password }); if (e) throw e;
      } else if (mode === 'reset') {
        const redirectTo = `${window.location.origin}${window.location.pathname}#reset`;
        const { error: e } = await supabase.auth.resetPasswordForEmail(email, { redirectTo }); if (e) throw e;
        setMessage('If that email exists, a password-reset link has been sent.');
      } else {
        const { error: e } = await supabase.auth.updateUser({ password }); if (e) throw e;
        setMessage('Password updated. You can continue into FRAME.'); setMode('login'); setPassword('');
      }
    } catch (err) { setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.'); }
    finally { setBusy(false); }
  };

  const title = mode === 'signup' ? 'Create your universe.' : mode === 'reset' ? 'Reset your password.' : mode === 'update' ? 'Choose a new password.' : 'Welcome back.';
  return <main className="auth-shell">
    <section className="auth-art"><div className="auth-art-overlay" /><div className="auth-brand"><b>F</b>FRAME</div><div className="auth-copy"><small>YOUR MEDIA UNIVERSE</small><h1>Everything you follow.<br /><em>One frame.</em></h1><p>Keep your anime, manga, manhwa and everything else you love organized in one cinematic library.</p></div></section>
    <section className="auth-panel"><div className="auth-form-wrap">
      <div className="auth-mobile-brand"><b>F</b>FRAME</div><small className="auth-eyebrow">YOUR MEDIA UNIVERSE</small><h2>{title}</h2>
      <p className="auth-subtitle">{mode === 'signup' ? 'Create a private account for your library.' : mode === 'reset' ? 'Enter your email and we will send you a secure reset link.' : mode === 'update' ? 'Use a new password for your FRAME account.' : 'Sign in to access your private library.'}</p>
      <form onSubmit={submit}>
        {mode !== 'update' && <label>Email<input type="email" autoComplete="email" value={email} onChange={e => setEmail(e.target.value)} required /></label>}
        {mode !== 'reset' && <label>Password<input type="password" autoComplete={mode === 'login' ? 'current-password' : 'new-password'} minLength={6} value={password} onChange={e => setPassword(e.target.value)} required /></label>}
        {error && <div className="auth-message error">{error}</div>}{message && <div className="auth-message success">{message}</div>}
        <button className="auth-submit" disabled={busy}>{busy ? 'Please wait…' : mode === 'signup' ? 'Create account' : mode === 'reset' ? 'Send reset link' : mode === 'update' ? 'Update password' : 'Log in'}</button>
      </form>
      {mode === 'login' && <button className="auth-link" onClick={() => {setMode('reset');setError('');setMessage('');}}>Forgot password?</button>}
      {mode === 'reset' && <button className="auth-link" onClick={() => {setMode('login');setError('');setMessage('');}}>Back to login</button>}
      {mode === 'update' && <button className="auth-link" onClick={() => setMode('login')}>Back to login</button>}
      {(mode === 'login' || mode === 'signup') && <p className="auth-switch">{mode === 'login' ? 'New to FRAME?' : 'Already have an account?'} <button onClick={() => {setMode(mode === 'login' ? 'signup' : 'login');setError('');setMessage('');}}>{mode === 'login' ? 'Create account' : 'Log in'}</button></p>}
    </div></section>
  </main>;
}

export async function signOut() { if (supabase) await supabase.auth.signOut(); }
