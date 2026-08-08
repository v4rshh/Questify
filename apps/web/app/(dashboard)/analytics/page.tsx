'use client';

import Sidebar from '../../../components/Sidebar';
import Header from '../../../components/Header';

export default function AnalyticsPage() {
  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: 'var(--bg-main)' }}>
      <Sidebar />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        <Header title="Performance Analytics & Mastery Scores" />

        <main style={{ marginLeft: '260px', padding: '32px', display: 'flex', flexDirection: 'column', gap: '28px' }}>
          
          {/* Top Metrics Row */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '20px' }}>
            <div className="glass-card" style={{ padding: '24px' }}>
              <div style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '4px' }}>Overall Mastery Score</div>
              <div style={{ fontSize: '32px', fontWeight: '800', color: '#10B981' }}>78.4%</div>
              <div style={{ fontSize: '12px', color: '#10B981', marginTop: '4px' }}>↑ +5.2% from last week</div>
            </div>
            <div className="glass-card" style={{ padding: '24px' }}>
              <div style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '4px' }}>Average Quiz Accuracy</div>
              <div style={{ fontSize: '32px', fontWeight: '800', color: '#6366F1' }}>86%</div>
              <div style={{ fontSize: '12px', color: '#6366F1', marginTop: '4px' }}>14 Quizzes Completed</div>
            </div>
            <div className="glass-card" style={{ padding: '24px' }}>
              <div style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '4px' }}>Active Retention Rate</div>
              <div style={{ fontSize: '32px', fontWeight: '800', color: '#F59E0B' }}>92%</div>
              <div style={{ fontSize: '12px', color: '#F59E0B', marginTop: '4px' }}>42 Flashcards Reviewed</div>
            </div>
          </div>

          {/* Strong vs Weak Concepts breakdown */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
            
            <div className="glass-card" style={{ padding: '24px' }}>
              <h3 style={{ fontSize: '18px', fontWeight: '700', color: '#10B981', marginBottom: '16px' }}>
                💪 Strongest Concepts
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px' }}>
                  <span>Process States & Transitions</span>
                  <span style={{ fontWeight: '700', color: '#10B981' }}>95% Mastery</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px' }}>
                  <span>CPU Scheduling (FCFS, SJF)</span>
                  <span style={{ fontWeight: '700', color: '#10B981' }}>90% Mastery</span>
                </div>
              </div>
            </div>

            <div className="glass-card" style={{ padding: '24px' }}>
              <h3 style={{ fontSize: '18px', fontWeight: '700', color: '#F43F5E', marginBottom: '16px' }}>
                ⚠️ Target Concepts for Revision
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px' }}>
                  <span>Virtual Memory Paging Algorithms</span>
                  <span style={{ fontWeight: '700', color: '#F43F5E' }}>55% Mastery</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px' }}>
                  <span>Deadlock Banker&apos;s Algorithm</span>
                  <span style={{ fontWeight: '700', color: '#F59E0B' }}>62% Mastery</span>
                </div>
              </div>
            </div>

          </div>
        </main>
      </div>
    </div>
  );
}
