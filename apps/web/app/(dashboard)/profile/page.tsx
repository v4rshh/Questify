'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import Sidebar from '@/components/Sidebar';
import Header from '@/components/Header';
import { Icon } from '@/components/Icon';
import { fetchApi } from '@/lib/api';

interface Topic { id: string; title: string; mastery_score: number; is_unlocked: boolean; world_index: number; level_index: number; }
interface Badge { title: string; description: string; icon: string; earned: boolean; }
interface Achievement { id: string; title: string; description: string; badge_icon: string; unlocked_at: string; }
interface Profile {
  username: string; email: string; member_since: string; xp: number; gems: number;
  mastery_tier: string; next_tier: string | null; next_tier_xp: number | null;
  tier_progress_percentage: number; rank: number; total_learners: number; streak_count: number;
  total_courses: number; completed_quizzes: number; mastered_topics: number; total_topics: number;
  topics: Topic[]; badges: Badge[]; achievements: Achievement[];
}

const badgeIcons: Record<string, string> = { world: '🗺️', target: '🎯', gem: '💎', crown: '👑', flame: '🔥', rocket: '🚀' };

export default function ProfilePage() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordBusy, setPasswordBusy] = useState(false);
  const [passwordNotice, setPasswordNotice] = useState('');

  useEffect(() => {
    fetchApi<Profile>('/gamification/profile').then(setProfile).catch(err => setError(err.message)).finally(() => setLoading(false));
  }, []);

  const initials = useMemo(() => profile?.username.split(/\s+/).filter(Boolean).slice(0, 2).map(part => part[0]).join('').toUpperCase() || 'Q', [profile?.username]);
  const passwordsMatch = newPassword === confirmPassword;
  const passwordStrong = newPassword.length >= 8 && /[A-Za-z]/.test(newPassword) && /\d/.test(newPassword);

  async function updatePassword(event: FormEvent) {
    event.preventDefault(); setPasswordNotice(''); setError('');
    if (!passwordsMatch) { setError('The new passwords do not match.'); return; }
    if (!passwordStrong) { setError('Use at least 8 characters with one letter and one number.'); return; }
    setPasswordBusy(true);
    try {
      const result = await fetchApi<{ message: string }>('/auth/password', { method: 'PUT', body: JSON.stringify({ new_password: newPassword, confirm_password: confirmPassword }) });
      setPasswordNotice(result.message); setNewPassword(''); setConfirmPassword('');
    } catch (err) { setError(err instanceof Error ? err.message : 'Could not update your password.'); }
    finally { setPasswordBusy(false); }
  }

  return <div className="app-shell"><Sidebar /><div className="page-content"><Header title="Learner profile" /><main className="profile-page">
    {loading ? <section className="loading-card">Loading your learning record…</section> : !profile ? <section className="loading-card">{error || 'Profile unavailable.'}</section> : <>
      <section className="profile-hero">
        <div className="avatar">{initials}</div>
        <div className="identity"><p>Learner profile</p><h2>{profile.username}</h2><span>{profile.email}</span><small>Member since {new Date(profile.member_since).toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}</small></div>
        <div className="rank-card"><span>Learning position</span><strong>#{profile.rank}</strong><small>of {profile.total_learners} learner{profile.total_learners === 1 ? '' : 's'}</small></div>
      </section>

      <section className="stats-grid">
        <article><span className="stat-icon xp"><Icon name="sparkles" size={18} /></span><div><small>Experience</small><strong>{profile.xp.toLocaleString()} XP</strong></div></article>
        <article><span className="stat-icon gems">💎</span><div><small>Wizard currency</small><strong>{profile.gems} Gems</strong></div></article>
        <article><span className="stat-icon streak"><Icon name="flame" size={18} /></span><div><small>Current streak</small><strong>{profile.streak_count} day{profile.streak_count === 1 ? '' : 's'}</strong></div></article>
        <article><span className="stat-icon topics"><Icon name="bookOpen" size={18} /></span><div><small>Topics mastered</small><strong>{profile.mastered_topics} / {profile.total_topics}</strong></div></article>
      </section>

      <section className="profile-grid">
        <div className="main-column">
          <section className="panel mastery-panel"><div className="section-heading"><div><p>Mastery level</p><h3>{profile.mastery_tier} Scholar</h3></div><span>{Math.round(profile.tier_progress_percentage)}%</span></div><div className="tier-track"><i style={{ width: `${profile.tier_progress_percentage}%` }} /></div><div className="tier-labels"><span>{profile.mastery_tier}</span><span>{profile.next_tier ? `${Math.max(0, (profile.next_tier_xp || 0) - profile.xp)} XP to ${profile.next_tier}` : 'Maximum tier reached'}</span></div><div className="mini-stats"><span><b>{profile.total_courses}</b> Worlds</span><span><b>{profile.completed_quizzes}</b> Quiz attempts</span><span><b>{profile.mastered_topics}</b> Mastered</span></div></section>

          <section className="panel"><div className="section-heading"><div><p>Knowledge map</p><h3>Your topics</h3></div><span>{profile.total_topics} total</span></div>{profile.topics.length ? <div className="topic-list">{profile.topics.map(topic => <article key={topic.id}><div className="topic-copy"><span className={topic.is_unlocked ? 'unlocked' : 'locked'}>{topic.is_unlocked ? `World ${topic.world_index} · Level ${topic.level_index}` : 'Locked topic'}</span><strong>{topic.title}</strong></div><div className="topic-score"><span>{Math.round(topic.mastery_score)}%</span><i><b style={{ width: `${topic.mastery_score}%` }} /></i></div></article>)}</div> : <div className="empty-state"><Icon name="bookOpen" size={22} /><p>Generate a learning world to begin tracking topic mastery.</p></div>}</section>

          <section className="panel"><div className="section-heading"><div><p>Milestones</p><h3>Achievements</h3></div><span>{profile.achievements.length} earned</span></div>{profile.achievements.length ? <div className="achievement-list">{profile.achievements.map(item => <article key={item.id}><span>{badgeIcons[item.badge_icon] || '🏅'}</span><div><strong>{item.title}</strong><p>{item.description}</p><small>{new Date(item.unlocked_at).toLocaleDateString()}</small></div></article>)}</div> : <div className="empty-state"><Icon name="trophy" size={22} /><p>Your completed milestones will appear here.</p></div>}</section>
        </div>

        <aside className="side-column">
          <section className="panel"><div className="section-heading"><div><p>Collection</p><h3>Badges</h3></div><span>{profile.badges.filter(item => item.earned).length}/{profile.badges.length}</span></div><div className="badge-grid">{profile.badges.map(item => <article key={item.title} className={item.earned ? 'earned' : 'locked'}><span>{item.earned ? badgeIcons[item.icon] || '🏅' : '🔒'}</span><strong>{item.title}</strong><p>{item.description}</p></article>)}</div></section>

          <section className="panel password-panel"><div className="section-heading"><div><p>Account security</p><h3>Change password</h3></div><Icon name="settings" size={18} /></div><form onSubmit={updatePassword}><label><span>New password</span><input type="password" autoComplete="new-password" value={newPassword} onChange={event => setNewPassword(event.target.value)} placeholder="At least 8 characters" /></label><label><span>Retype new password</span><input type="password" autoComplete="new-password" value={confirmPassword} onChange={event => setConfirmPassword(event.target.value)} placeholder="Enter it again" /></label>{confirmPassword && !passwordsMatch && <p className="field-error">Passwords do not match.</p>}<small>Use at least 8 characters with one letter and one number.</small><button className="btn btn-primary" type="submit" disabled={passwordBusy || !passwordStrong || !passwordsMatch}>{passwordBusy ? 'Updating…' : 'Update password'}</button>{passwordNotice && <p className="success" role="status">✓ {passwordNotice}</p>}</form></section>
        </aside>
      </section>
    </>}
    {error && profile && <p className="page-error" role="alert">{error}<button onClick={() => setError('')} aria-label="Dismiss">×</button></p>}
  </main><style jsx>{`
    .profile-page{max-width:1180px;margin:0 auto;padding:32px}.loading-card{display:grid;min-height:380px;place-items:center;color:var(--muted)}.profile-hero{display:flex;align-items:center;gap:18px;padding:24px;border:1px solid var(--border);border-radius:16px;background:linear-gradient(135deg,var(--surface),var(--accent-soft));box-shadow:var(--shadow-sm)}.avatar{display:grid;flex:0 0 74px;height:74px;place-items:center;border:3px solid rgba(255,255,255,.75);border-radius:22px;background:var(--accent);color:white;font:700 25px Georgia,serif;box-shadow:0 8px 22px rgba(38,92,60,.2)}.identity{display:flex;flex:1;flex-direction:column}.identity p,.section-heading p{color:var(--accent);font-size:9px;font-weight:800;letter-spacing:.11em;text-transform:uppercase}.identity h2{margin-top:4px;font-size:27px;letter-spacing:-.04em}.identity span{margin-top:2px;color:var(--muted-strong);font-size:12px}.identity small{margin-top:8px;color:var(--muted);font-size:10px}.rank-card{display:grid;justify-items:center;min-width:130px;padding:15px;border:1px solid rgba(98,139,110,.35);border-radius:13px;background:rgba(255,255,255,.6)}.rank-card span{color:var(--muted);font-size:9px;text-transform:uppercase}.rank-card strong{margin-top:2px;color:var(--accent);font-size:28px}.rank-card small{color:var(--muted);font-size:10px}
    .stats-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin:16px 0}.stats-grid article{display:flex;align-items:center;gap:11px;padding:15px;border:1px solid var(--border);border-radius:12px;background:var(--surface)}.stat-icon{display:grid;width:38px;height:38px;place-items:center;border-radius:10px;background:var(--accent-soft);color:var(--accent)}.stat-icon.gems{background:#e8f5fc;color:#377a9d}.stat-icon.streak{background:#fff0db;color:#ae6d20}.stat-icon.topics{background:#eeeafa;color:#6654a5}.stats-grid small{display:block;color:var(--muted);font-size:9px;text-transform:uppercase}.stats-grid strong{display:block;margin-top:2px;font-size:14px}
    .profile-grid{display:grid;grid-template-columns:minmax(0,1.55fr) minmax(300px,.85fr);gap:16px}.main-column,.side-column{display:grid;align-content:start;gap:16px}.panel{padding:20px;border:1px solid var(--border);border-radius:14px;background:var(--surface);box-shadow:var(--shadow-sm)}.section-heading{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:17px}.section-heading h3{margin-top:3px;font-size:18px}.section-heading>span{color:var(--muted);font-size:11px}.mastery-panel{background:linear-gradient(150deg,var(--surface),color-mix(in srgb,var(--accent-soft) 60%,var(--surface)))}.mastery-panel .section-heading>span{display:grid;width:44px;height:44px;place-items:center;border-radius:50%;background:var(--accent);color:white;font-weight:800}.tier-track,.topic-score i{display:block;height:9px;overflow:hidden;border-radius:99px;background:var(--surface-muted)}.tier-track i,.topic-score b{display:block;height:100%;border-radius:inherit;background:linear-gradient(90deg,var(--accent),#79b989)}.tier-labels{display:flex;justify-content:space-between;margin-top:7px;color:var(--muted);font-size:10px}.mini-stats{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-top:17px}.mini-stats span{padding:10px;border-radius:9px;background:color-mix(in srgb,var(--surface-muted) 70%,transparent);color:var(--muted);font-size:10px;text-align:center}.mini-stats b{display:block;color:var(--foreground);font-size:16px}
    .topic-list{display:grid;gap:7px;max-height:410px;overflow:auto}.topic-list article{display:flex;align-items:center;gap:16px;padding:11px;border:1px solid var(--border);border-radius:10px}.topic-copy{display:grid;flex:1;gap:3px;min-width:0}.topic-copy>span{color:var(--muted);font-size:8px;font-weight:700;text-transform:uppercase}.topic-copy>span.unlocked{color:var(--accent)}.topic-copy strong{overflow:hidden;font-size:12px;white-space:nowrap;text-overflow:ellipsis}.topic-score{display:grid;grid-template-columns:34px 85px;align-items:center;gap:7px;color:var(--muted-strong);font-size:10px;font-weight:700}.topic-score i{height:6px}.achievement-list{display:grid;grid-template-columns:repeat(2,1fr);gap:9px}.achievement-list article{display:flex;gap:10px;padding:12px;border:1px solid var(--border);border-radius:10px;background:var(--surface)}.achievement-list article>span{font-size:24px}.achievement-list strong{font-size:12px}.achievement-list p{margin-top:2px;color:var(--muted);font-size:10px;line-height:1.4}.achievement-list small{display:block;margin-top:5px;color:var(--muted);font-size:9px}
    .badge-grid{display:grid;grid-template-columns:1fr 1fr;gap:8px}.badge-grid article{display:grid;justify-items:center;min-height:132px;align-content:center;padding:11px;border:1px solid var(--border);border-radius:11px;text-align:center}.badge-grid article.earned{border-color:#b6d1bf;background:var(--accent-soft)}.badge-grid article.locked{filter:grayscale(.8);opacity:.56}.badge-grid article>span{font-size:28px}.badge-grid strong{margin-top:6px;font-size:11px}.badge-grid p{margin-top:3px;color:var(--muted);font-size:9px;line-height:1.35}.password-panel form{display:grid;gap:12px}.password-panel label{display:grid;gap:5px}.password-panel label>span{color:var(--muted-strong);font-size:10px;font-weight:700}.password-panel input{width:100%;padding:10px 11px;border:1px solid var(--border-strong);border-radius:8px;background:var(--background);color:var(--foreground);font-size:12px}.password-panel input:focus{outline:2px solid color-mix(in srgb,var(--accent) 35%,transparent);border-color:var(--accent)}.password-panel form>small{color:var(--muted);font-size:9px;line-height:1.4}.password-panel .btn{width:100%;margin-top:2px}.field-error{color:var(--danger);font-size:10px}.success{padding:8px;border-radius:7px;background:var(--accent-soft);color:var(--accent);font-size:10px;text-align:center}.empty-state{display:grid;min-height:110px;place-items:center;align-content:center;gap:8px;color:var(--muted);font-size:11px;text-align:center}.page-error{position:fixed;right:20px;bottom:20px;z-index:60;display:flex;align-items:center;gap:12px;max-width:380px;padding:11px 13px;border:1px solid #e1b2b2;border-radius:9px;background:#fff3f3;color:var(--danger);font-size:11px;box-shadow:0 10px 28px rgba(0,0,0,.15)}.page-error button{border:0;background:transparent;color:inherit;font-size:17px}
    @media(max-width:900px){.profile-page{padding:22px 16px 90px}.stats-grid{grid-template-columns:1fr 1fr}.profile-grid{grid-template-columns:1fr}.profile-hero{align-items:flex-start;flex-wrap:wrap}.rank-card{margin-left:auto}.achievement-list{grid-template-columns:1fr 1fr}}@media(max-width:560px){.profile-hero{padding:18px}.avatar{flex-basis:56px;height:56px;border-radius:16px;font-size:19px}.identity{min-width:calc(100% - 80px)}.identity h2{font-size:22px}.rank-card{width:100%;margin:0}.stats-grid{grid-template-columns:1fr}.achievement-list,.badge-grid{grid-template-columns:1fr}.topic-list article{align-items:flex-start;flex-direction:column}.topic-score{width:100%;grid-template-columns:34px 1fr}.mini-stats{grid-template-columns:1fr 1fr 1fr}}
  `}</style></div></div>;
}
