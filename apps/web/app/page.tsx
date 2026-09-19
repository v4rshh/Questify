'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { fetchApi } from '@/lib/api';
import { Icon } from '@/components/Icon';

interface AuthResponse { access_token: string; token_type: string; user: { full_name: string; xp: number; streak_count: number; mastery_tier: string }; }

export default function LandingAuthPage() {
  const router = useRouter();
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault(); setError(''); setIsSubmitting(true);
    try {
      if (!isLogin) await fetchApi('/auth/register', { method: 'POST', body: JSON.stringify({ email, password, full_name: fullName }) });
      const result = await fetchApi<AuthResponse>('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) });
      localStorage.setItem('questify_token', result.access_token); localStorage.setItem('questify_user', JSON.stringify(result.user)); router.push('/dashboard');
    } catch (err) { setError(err instanceof Error ? err.message : 'Authentication failed.'); }
    finally { setIsSubmitting(false); }
  };

  return (
    <main className="auth-page">
      <section className="auth-story"><div className="auth-brand"><span>Q</span> Questify</div><div className="story-copy"><p className="story-kicker">A quieter way to study</p><h1>Turn your notes into a place you can <em>think.</em></h1><p>Questify brings your resources, questions, and progress into one focused learning workspace.</p></div><div className="story-footer"><span><Icon name="sparkles" size={14} /> Grounded in your materials</span><span><Icon name="bookOpen" size={14} /> Built for curious learners</span></div></section>
      <section className="auth-panel"><div className="auth-form-wrap"><div className="form-heading"><div className="small-mark"><Icon name="sparkles" size={16} /></div><h2>{isLogin ? 'Welcome back' : 'Create your workspace'}</h2><p>{isLogin ? 'Sign in to continue your study session.' : 'One account for all of your learning worlds.'}</p></div><form onSubmit={handleSubmit} className="auth-form">{!isLogin && <label>Full name<input className="input" value={fullName} onChange={(event) => setFullName(event.target.value)} placeholder="Alex Rivera" required /></label>}<label>Email address<input className="input" type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com" required /></label><label>Password<input className="input" type="password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="••••••••" required /></label>{error && <div className="auth-error">{error}</div>}<button className="btn btn-primary auth-submit" disabled={isSubmitting}>{isSubmitting ? 'Please wait…' : isLogin ? 'Continue to Questify' : 'Create account'}<Icon name="arrowUp" size={16} /></button></form><p className="auth-toggle">{isLogin ? 'New to Questify?' : 'Already have an account?'} <button type="button" onClick={() => { setIsLogin((value) => !value); setError(''); }}>{isLogin ? 'Create an account' : 'Sign in'}</button></p></div></section>
      <style jsx>{`
        .auth-page { display: grid; grid-template-columns: minmax(0, 1.1fr) minmax(380px, .9fr); min-height: 100vh; background: var(--background); }.auth-story { display: flex; flex-direction: column; padding: 34px 7vw 32px; background: #edf3ee; border-right: 1px solid #d9e4dc; }.auth-brand { display: flex; align-items: center; gap: 9px; color: var(--accent-ink); font-size: 19px; font-weight: 700; letter-spacing: -.04em; }.auth-brand span { display: grid; place-items: center; width: 29px; height: 29px; border-radius: 8px; background: var(--accent); color: white; font-family: Georgia, serif; font-size: 19px; }.story-copy { max-width: 570px; margin: auto 0; }.story-kicker { margin-bottom: 18px; color: var(--accent); font-size: 12px; font-weight: 700; letter-spacing: .1em; text-transform: uppercase; }.story-copy h1 { max-width: 590px; margin-bottom: 21px; color: #24372d; font-size: clamp(42px, 5vw, 70px); font-weight: 600; line-height: .99; letter-spacing: -.065em; }.story-copy h1 em { color: var(--accent); font-family: 'Instrument Serif', Georgia, serif; font-weight: 400; letter-spacing: -.02em; }.story-copy > p:last-child { max-width: 430px; color: #698072; font-size: 16px; line-height: 1.6; }.story-footer { display: flex; flex-wrap: wrap; gap: 18px; color: #789080; font-size: 11px; }.story-footer span { display: inline-flex; align-items: center; gap: 6px; }.auth-panel { display: flex; align-items: center; justify-content: center; padding: 36px; }.auth-form-wrap { width: min(100%, 385px); }.form-heading { margin-bottom: 29px; }.small-mark { display: grid; place-items: center; width: 34px; height: 34px; margin-bottom: 18px; border: 1px solid #cbdacf; border-radius: 9px; background: var(--accent-soft); color: var(--accent); }.form-heading h2 { margin-bottom: 7px; font-size: 25px; letter-spacing: -.04em; }.form-heading p { color: var(--muted); font-size: 13px; }.auth-form { display: flex; flex-direction: column; gap: 17px; }.auth-form label { display: flex; flex-direction: column; gap: 7px; color: var(--muted-strong); font-size: 12px; font-weight: 600; }.auth-submit { width: 100%; margin-top: 5px; min-height: 44px; }.auth-error { padding: 10px 11px; border: 1px solid #e7caca; border-radius: 8px; background: #fff6f6; color: var(--danger); font-size: 12px; }.auth-toggle { margin-top: 25px; color: var(--muted); font-size: 12px; }.auth-toggle button { padding: 0; border: 0; background: transparent; color: var(--accent); font-weight: 700; }.auth-toggle button:hover { text-decoration: underline; }
        @media (max-width: 800px) { .auth-page { display: block; }.auth-story { min-height: 320px; padding: 26px 24px; }.story-copy { margin-top: 65px; }.story-copy h1 { font-size: 44px; }.story-copy > p:last-child, .story-footer { display: none; }.auth-panel { min-height: calc(100vh - 320px); padding: 34px 24px; } }
      `}</style>
    </main>
  );
}
