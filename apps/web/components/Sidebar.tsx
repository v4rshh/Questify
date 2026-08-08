'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

interface NavItem {
  label: string;
  href: string;
  icon: string;
  badge?: string;
  role?: string;
}

const navItems: NavItem[] = [
  { label: 'Dashboard', href: '/dashboard', icon: '⚡' },
  { label: 'Learning Roadmap', href: '/roadmap', icon: '🗺️' },
  { label: 'AI Tutor Chat', href: '/tutor', icon: '🤖', badge: 'AI' },
  { label: 'Flashcards', href: '/flashcards', icon: '🎴' },
  { label: 'Adaptive Quizzes', href: '/quizzes', icon: '🎯' },
  { label: 'Analytics', href: '/analytics', icon: '📊' },
  { label: 'Leaderboard', href: '/leaderboard', icon: '🏆' },
  { label: 'Admin Console', href: '/admin', icon: '⚙️', role: 'admin' },
];

export default function Sidebar({ userRole }: { userRole?: string }) {
  const pathname = usePathname();

  return (
    <aside style={{
      width: '260px',
      background: 'rgba(15, 23, 42, 0.95)',
      backdropFilter: 'blur(20px)',
      borderRight: '1px solid rgba(255, 255, 255, 0.08)',
      height: '100vh',
      position: 'fixed',
      left: 0,
      top: 0,
      display: 'flex',
      flexDirection: 'column',
      zIndex: 50,
      padding: '24px 16px'
    }}>
      {/* Brand Logo */}
      <Link href="/dashboard" style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '32px', paddingLeft: '8px' }}>
        <div style={{
          width: '40px',
          height: '40px',
          borderRadius: '12px',
          background: 'linear-gradient(135deg, #6366F1, #D946EF)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '20px',
          fontWeight: 'bold',
          color: '#fff',
          boxShadow: '0 4px 12px rgba(99, 102, 241, 0.4)'
        }}>
          Q
        </div>
        <div>
          <span style={{ fontSize: '22px', fontWeight: '800', letterSpacing: '-0.5px' }} className="gradient-text">
            Questify
          </span>
          <span style={{ display: 'block', fontSize: '10px', color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '1px' }}>
            AI Learning Realm
          </span>
        </div>
      </Link>

      {/* Navigation List */}
      <nav style={{ display: 'flex', flexDirection: 'column', gap: '6px', flex: 1 }}>
        {navItems.map((item) => {
          if (item.role === 'admin' && userRole !== 'admin') return null;
          const isActive = pathname === item.href;

          return (
            <Link
              key={item.href}
              href={item.href}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '12px 16px',
                borderRadius: '12px',
                color: isActive ? '#FFFFFF' : '#94A3B8',
                background: isActive ? 'linear-gradient(90deg, rgba(99, 102, 241, 0.25) 0%, rgba(139, 92, 246, 0.15) 100%)' : 'transparent',
                borderLeft: isActive ? '3px solid #6366F1' : '3px solid transparent',
                textDecoration: 'none',
                fontWeight: isActive ? '600' : '500',
                transition: 'all 0.2s ease',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <span style={{ fontSize: '18px' }}>{item.icon}</span>
                <span style={{ fontSize: '14px' }}>{item.label}</span>
              </div>
              {item.badge && (
                <span style={{
                  background: 'linear-gradient(135deg, #6366F1, #D946EF)',
                  color: '#fff',
                  fontSize: '10px',
                  fontWeight: '700',
                  padding: '2px 6px',
                  borderRadius: '6px'
                }}>
                  {item.badge}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      {/* User Quick Info */}
      <div className="glass-card" style={{ padding: '14px', marginTop: 'auto', display: 'flex', alignItems: 'center', gap: '12px' }}>
        <div style={{
          width: '38px',
          height: '38px',
          borderRadius: '50%',
          background: 'linear-gradient(135deg, #10B981, #06B6D4)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontWeight: '700',
          fontSize: '16px'
        }}>
          👤
        </div>
        <div style={{ flex: 1, overflow: 'hidden' }}>
          <div style={{ fontSize: '13px', fontWeight: '600', color: '#F8FAFC', whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>
            Learner Account
          </div>
          <span className="badge-tier badge-gold" style={{ fontSize: '9px', padding: '1px 6px' }}>
            Gold Tier
          </span>
        </div>
      </div>
    </aside>
  );
}
