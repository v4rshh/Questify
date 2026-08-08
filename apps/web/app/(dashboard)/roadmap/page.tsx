'use client';

import Sidebar from '@/components/Sidebar';
import Header from '@/components/Header';

export default function RoadmapPage() {
  const worlds = [
    {
      id: 1,
      title: 'World 1: Operating System Fundamentals',
      status: 'unlocked',
      levels: [
        { level: 1, title: 'Processes & Threads', status: 'completed', score: '95%' },
        { level: 2, title: 'CPU Scheduling Algorithms', status: 'completed', score: '88%' },
        { level: 3, title: 'Memory Management & Paging', status: 'unlocked', score: 'Ready' },
        { level: 4, title: 'Boss Level: Virtual Memory', status: 'locked', score: 'Locked' },
      ],
    },
    {
      id: 2,
      title: 'World 2: Concurrency & Storage',
      status: 'locked',
      levels: [
        { level: 1, title: 'Synchronization & Semaphores', status: 'locked', score: 'Locked' },
        { level: 2, title: 'Deadlock Detection & Prevention', status: 'locked', score: 'Locked' },
        { level: 3, title: 'File Systems & Storage I/O', status: 'locked', score: 'Locked' },
      ],
    },
  ];

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: 'var(--bg-main)' }}>
      <Sidebar />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        <Header title="Personalized Learning Roadmap" />

        <main style={{ marginLeft: '260px', padding: '32px', display: 'flex', flexDirection: 'column', gap: '32px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h2 style={{ fontSize: '22px', fontWeight: '800' }}>Operating Systems Realm</h2>
              <p style={{ color: 'var(--text-muted)', fontSize: '14px' }}>
                Complete levels to increase mastery tier from Gold to Platinum.
              </p>
            </div>
            <span className="badge-tier badge-gold">Overall Mastery: 64%</span>
          </div>

          {worlds.map((world) => (
            <div key={world.id} className="glass-card" style={{ padding: '24px' }}>
              <h3 style={{ fontSize: '18px', fontWeight: '700', marginBottom: '20px' }}>
                {world.title}
              </h3>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px' }}>
                {world.levels.map((lvl) => (
                  <div
                    key={lvl.level}
                    style={{
                      padding: '20px',
                      borderRadius: '14px',
                      background: lvl.status === 'completed'
                        ? 'linear-gradient(135deg, rgba(16, 185, 129, 0.15), rgba(6, 182, 212, 0.1))'
                        : lvl.status === 'unlocked'
                        ? 'linear-gradient(135deg, rgba(99, 102, 241, 0.2), rgba(139, 92, 246, 0.15))'
                        : 'rgba(255, 255, 255, 0.02)',
                      border: lvl.status === 'unlocked' ? '1px solid #6366F1' : '1px solid rgba(255, 255, 255, 0.08)',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '8px'
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: '12px', fontWeight: '700', color: 'var(--text-muted)' }}>
                        Level {lvl.level}
                      </span>
                      <span>{lvl.status === 'completed' ? '✅' : lvl.status === 'unlocked' ? '🔓' : '🔒'}</span>
                    </div>

                    <div style={{ fontSize: '15px', fontWeight: '700' }}>{lvl.title}</div>
                    <div style={{ fontSize: '12px', color: lvl.status === 'completed' ? '#10B981' : '#94A3B8' }}>
                      Score: {lvl.score}
                    </div>

                    {lvl.status === 'unlocked' && (
                      <button className="gradient-btn" style={{ marginTop: '12px', fontSize: '12px', padding: '8px 12px' }}>
                        Start Level →
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </main>
      </div>
    </div>
  );
}
