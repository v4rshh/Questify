'use client';

import Sidebar from '@/components/Sidebar';
import Header from '@/components/Header';

export default function LeaderboardPage() {
  const leaderboard = [
    { rank: 1, name: 'Sophia Chen', xp: 1250, streak: 14, tier: 'Diamond', isUser: false },
    { rank: 2, name: 'Marcus Vance', xp: 980, streak: 10, tier: 'Platinum', isUser: false },
    { rank: 3, name: 'Alex Rivera (You)', xp: 650, streak: 7, tier: 'Gold', isUser: true },
    { rank: 4, name: 'Elena Rostova', xp: 520, streak: 4, tier: 'Gold', isUser: false },
    { rank: 5, name: 'David Kim', xp: 410, streak: 3, tier: 'Silver', isUser: false },
  ];

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: 'var(--bg-main)' }}>
      <Sidebar />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        <Header title="Global Realm Leaderboard" />

        <main style={{ marginLeft: '260px', padding: '32px', display: 'flex', flexDirection: 'column', gap: '24px' }}>
          
          <div className="glass-card" style={{ padding: '28px', background: 'linear-gradient(135deg, rgba(234, 179, 8, 0.15), rgba(99, 102, 241, 0.15))' }}>
            <h2 style={{ fontSize: '22px', fontWeight: '800', marginBottom: '8px' }}>
              🏆 Weekly Realm League
            </h2>
            <p style={{ color: 'var(--text-muted)', fontSize: '14px' }}>
              Top 3 scholars receive 500 bonus XP and advance to the Diamond Mastery Tier at week end.
            </p>
          </div>

          <div className="glass-card" style={{ padding: '16px', overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '14px' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.1)', color: 'var(--text-muted)' }}>
                  <th style={{ padding: '12px 16px' }}>Rank</th>
                  <th style={{ padding: '12px 16px' }}>Scholar</th>
                  <th style={{ padding: '12px 16px' }}>Streak</th>
                  <th style={{ padding: '12px 16px' }}>Mastery Tier</th>
                  <th style={{ padding: '12px 16px', textAlign: 'right' }}>Total XP</th>
                </tr>
              </thead>
              <tbody>
                {leaderboard.map((row) => (
                  <tr
                    key={row.rank}
                    style={{
                      borderBottom: '1px solid rgba(255, 255, 255, 0.05)',
                      background: row.isUser ? 'rgba(99, 102, 241, 0.15)' : 'transparent',
                      fontWeight: row.isUser ? '700' : '400'
                    }}
                  >
                    <td style={{ padding: '16px' }}>
                      {row.rank === 1 ? '🥇 #1' : row.rank === 2 ? '🥈 #2' : row.rank === 3 ? '🥉 #3' : `#${row.rank}`}
                    </td>
                    <td style={{ padding: '16px', color: row.isUser ? '#A5B4FC' : '#F8FAFC' }}>
                      {row.name}
                    </td>
                    <td style={{ padding: '16px' }}>
                      🔥 {row.streak} Days
                    </td>
                    <td style={{ padding: '16px' }}>
                      <span className={`badge-tier badge-${row.tier.toLowerCase()}`}>
                        {row.tier}
                      </span>
                    </td>
                    <td style={{ padding: '16px', textAlign: 'right', fontWeight: '700', color: '#6366F1' }}>
                      ⚡ {row.xp} XP
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

        </main>
      </div>
    </div>
  );
}
