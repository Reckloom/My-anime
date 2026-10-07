import { createContext, useContext, useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { Shield } from 'lucide-react';
import type { Session, User } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';

type AuthMode='login'|'signup'|'reset'|'update';
type AuthContextValue={session:Session|null;user:User|null;loading:boolean};
const AuthContext=createContext<AuthContextValue>({session:null,user:null,loading:false});

export function AuthProvider({children}:{children:ReactNode}){
 const [session,setSession]=useState<Session|null>(null),[loading,setLoading]=useState(Boolean(supabase));
 useEffect(()=>{
  if(!supabase){setLoading(false);return}
  let active=true;
  supabase.auth.getSession().then(({data})=>{if(active){setSession(data.session);setLoading(false)}});
  const {data}=supabase.auth.onAuthStateChange((_event,next)=>{setSession(next);setLoading(false)});
  return()=>{active=false;data.subscription.unsubscribe()};
 },[]);
 return <AuthContext.Provider value={{session,loading,user:session?.user??null}}>{children}</AuthContext.Provider>;
}
export function useAuth(){return useContext(AuthContext)}

export function AuthGate({children}:{children:ReactNode}){
 const {session,loading}=useAuth();
 const guest=localStorage.getItem('frame-guest')==='1';
 if(!supabase)return <>{children}</>;
 if(loading)return <div className="auth-loading"><div className="auth-mark">F</div><span>Opening your library…</span></div>;
 return session||guest?<>{children}</>:<AuthScreen/>;
}

function AuthScreen(){
 const [mode,setMode]=useState<AuthMode>('login'),[email,setEmail]=useState(''),[password,setPassword]=useState('');
 const [message,setMessage]=useState(''),[error,setError]=useState(''),[busy,setBusy]=useState(false),[showPass,setShowPass]=useState(false);
 useEffect(()=>{if(window.location.hash.includes('type=recovery'))setMode('update')},[]);
 const reset=()=>{setError('');setMessage('')};
 const guest=()=>{localStorage.setItem('frame-guest','1');window.location.reload()};
 const submit=async(event:FormEvent)=>{
  event.preventDefault();if(!supabase)return;setBusy(true);reset();
  try{
   if(mode==='signup'){const {error:e}=await supabase.auth.signUp({email,password});if(e)throw e;setMessage('Account created. Check your email if confirmation is enabled.');setMode('login')}
   else if(mode==='login'){localStorage.removeItem('frame-guest');const {error:e}=await supabase.auth.signInWithPassword({email,password});if(e)throw e}
   else if(mode==='reset'){const redirectTo=window.location.origin+window.location.pathname+'#reset';const {error:e}=await supabase.auth.resetPasswordForEmail(email,{redirectTo});if(e)throw e;setMessage('If that email exists, a secure reset link has been sent.')}
   else {const {error:e}=await supabase.auth.updateUser({password});if(e)throw e;setMessage('Password updated. Continue into FRAME.');setMode('login');setPassword('')}
  }catch(e){setError(e instanceof Error?e.message:'Something went wrong. Please try again.')}
  finally{setBusy(false)}
 };
 const title=mode==='signup'?'Create your media library':mode==='reset'?'Recover your library':mode==='update'?'Set a new password':'Welcome back to FRAME';
 const sub=mode==='signup'?'Create one account for your entire media universe.':mode==='reset'?'We will send a secure recovery link to your email.':mode==='update'?'Choose a new password for your FRAME account.':'Your private media universe is waiting.';
 return <main className="library-gate">
  <section className="gate-art"><div className="gate-grid"/><div className="gate-glow one"/><div className="gate-glow two"/><div className="gate-brand"><b>F</b><strong>FRAME</strong></div><div className="gate-copy"><small>PERSONAL MEDIA LIBRARY</small><h1>Enter your<br/><em>media universe.</em></h1><p>Anime, manga, games, movies, books and every story you care about — organized in one private space.</p><div className="gate-points"><span>Private by default</span><span>Cloud sync</span><span>AI-assisted discovery</span></div></div></section>
  <section className="gate-panel"><div className="gate-mobile-brand"><b>F</b>FRAME</div><div className="gate-card"><small className="gate-eyebrow">WELCOME TO FRAME</small><h2>{title}</h2><p>{sub}</p>
   {error&&<div className="auth-message error">{error}</div>}{message&&<div className="auth-message success">{message}</div>}
   {mode!=='update'&&<form onSubmit={submit}>{mode!=='reset'&&<label>Email<input type="email" autoComplete="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="you@example.com" required/></label>}{mode!=='reset'&&<label>Password<div className="pass-wrap"><input type={showPass?'text':'password'} autoComplete={mode==='login'?'current-password':'new-password'} minLength={6} value={password} onChange={e=>setPassword(e.target.value)} placeholder="At least 6 characters" required/><button type="button" onClick={()=>setShowPass(!showPass)}>{showPass?'Hide':'Show'}</button></div></label>}{mode==='reset'&&<label>Email<input type="email" autoComplete="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="you@example.com" required/></label>}<button className="gate-submit" disabled={busy}>{busy?'Opening…':mode==='signup'?'Create account':mode==='reset'?'Send recovery link':'Enter FRAME'}</button></form>}
   {mode==='update'&&<form onSubmit={submit}><label>New password<div className="pass-wrap"><input type={showPass?'text':'password'} minLength={6} value={password} onChange={e=>setPassword(e.target.value)} required/><button type="button" onClick={()=>setShowPass(!showPass)}>{showPass?'Hide':'Show'}</button></div></label><button className="gate-submit" disabled={busy}>{busy?'Saving…':'Update password'}</button></form>}
   {mode==='login'&&<div className="gate-links"><button onClick={()=>{setMode('reset');reset()}}>Forgot password?</button><button onClick={guest}>Enter as guest</button></div>}
   {mode==='reset'&&<button className="gate-link" onClick={()=>{setMode('login');reset()}}>Back to login</button>}
   {mode==='update'&&<button className="gate-link" onClick={()=>setMode('login')}>Back to login</button>}
   {(mode==='login'||mode==='signup')&&<p className="gate-switch">{mode==='login'?'New to FRAME?':'Already have an account?'} <button onClick={()=>{setMode(mode==='login'?'signup':'login');reset()}}>{mode==='login'?'Create account':'Sign in'}</button></p>}
  </div><div className="gate-footer"><Shield size={14}/> Your library is private unless you choose to share it.</div></section>
 </main>;
}
export async function signOut(){localStorage.removeItem('frame-guest');if(supabase)await supabase.auth.signOut()}
