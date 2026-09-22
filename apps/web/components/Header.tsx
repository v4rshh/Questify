'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Icon } from './Icon';
import { fetchApi } from '@/lib/api';

interface HeaderProps { title: string; userXp?: number; streakCount?: number; masteryTier?: string; }

export default function Header({ title, userXp = 0, streakCount = 0, masteryTier = 'Bronze' }: HeaderProps) {
  const [metrics, setMetrics] = useState({ xp: userXp, streak: streakCount, tier: masteryTier });

  useEffect(() => {
    fetchApi<{ xp: number; streak_count: number; mastery_tier: string }>('/gamification/dashboard')
      .then((data) => setMetrics({ xp: data.xp, streak: data.streak_count, tier: data.mastery_tier }))
      .catch(() => undefined);
  }, []);

  return (
    <header className="questify-header">
      <div><div className="header-eyebrow">Workspace</div><h1>{title}</h1></div>
      <div className="header-metrics">
        <span className="metric"><Icon name="flame" size={15} /> {metrics.streak} day streak</span>
        <span className="metric"><Icon name="sparkles" size={15} /> {metrics.xp} XP</span>
        <span className="tier-pill">{metrics.tier}</span>
        <Link href="/dashboard" className="header-avatar"><Icon name="user" size={16} /></Link>
      </div>
      <style jsx>{`
        .questify-header { height: 72px; display: flex; align-items: center; justify-content: space-between; padding: 0 34px; border-bottom: 1px solid var(--border); background: var(--surface); }
        .header-eyebrow { color: var(--muted); font-size: 11px; margin-bottom: 3px; }
        h1 { font-size: 20px; line-height: 1; font-weight: 700; }
        .header-metrics { display: flex; align-items: center; gap: 16px; }
        .metric { display: inline-flex; align-items: center; gap: 6px; color: var(--muted-strong); font-size: 12px; }
        .metric:first-child { color: var(--warm); }
        .tier-pill { padding: 5px 9px; border: 1px solid #d8d8d1; border-radius: 999px; color: var(--muted-strong); font-size: 11px; font-weight: 600; }
        .header-avatar { display: grid; place-items: center; width: 31px; height: 31px; border-radius: 50%; background: var(--accent-soft); color: var(--accent); text-decoration: none; }
        @media (max-width: 900px) { .questify-header { margin-left: 0; padding: 0 18px; } .header-metrics .metric, .tier-pill { display: none; } }
      `}</style>
    </header>
  );
}
