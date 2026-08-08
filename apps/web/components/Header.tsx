'use client';

interface HeaderProps {
  title: string;
  userXp?: number;
  streakCount?: number;
  masteryTier?: string;
}

export default function Header({
  title,
  userXp = 450,
  streakCount = 5,
  masteryTier = 'Gold'
}: HeaderProps) {
  const tierClass = `badge-${masteryTier.toLowerCase()}`;

  return (
    <header style={{
      height: '70px',
      marginLeft: '260px',
      background: 'rgba(15, 23, 42, 0.8)',
      backdropFilter: 'blur(16px)',
      borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '0 32px',
      position: 'sticky',
      top: 0,
      zIndex: 40
    }}>
      <h1 style={{ fontSize: '20px', fontWeight: '700', color: '#F8FAFC' }}>
        {title}
      </h1>

      {/* Gamification Bar Header Metrics */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '24px' }}>
        {/* Streak Counter */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          background: 'rgba(245, 158, 11, 0.15)',
          border: '1px solid rgba(245, 158, 11, 0.3)',
          padding: '6px 14px',
          borderRadius: '20px'
        }}>
          <span style={{ fontSize: '16px' }}>🔥</span>
          <span style={{ fontWeight: '700', color: '#F59E0B', fontSize: '14px' }}>
            {streakCount} Day Streak
          </span>
        </div>

        {/* XP Progress Bar */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
            <span style={{ fontSize: '12px', fontWeight: '700', color: '#8B5CF6' }}>
              ⚡ {userXp} XP
            </span>
            <span style={{ fontSize: '10px', color: '#94A3B8' }}>Lvl 4 Scholar</span>
          </div>
          <div style={{ width: '80px', height: '8px', background: 'rgba(255, 255, 255, 0.1)', borderRadius: '4px', overflow: 'hidden' }}>
            <div style={{ width: `${(userXp % 200) / 2}%`, height: '100%', background: 'linear-gradient(90deg, #6366F1, #D946EF)', borderRadius: '4px' }} />
          </div>
        </div>

        {/* Tier Badge */}
        <span className={`badge-tier ${tierClass}`}>
          🛡️ {masteryTier}
        </span>
      </div>
    </header>
  );
}
