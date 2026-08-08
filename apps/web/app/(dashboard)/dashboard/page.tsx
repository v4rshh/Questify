'use client';

import { useState } from 'react';
import Sidebar from '../../../components/Sidebar';
import Header from '../../../components/Header';

export default function DashboardPage() {
  const [isUploading, setIsUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<string | null>(null);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setIsUploading(true);
      setUploadStatus(`Uploading ${file.name}...`);
      setTimeout(() => {
        setIsUploading(false);
        setUploadStatus(`Successfully uploaded ${file.name}! Processing background OCR & vector embeddings.`);
      }, 1500);
    }
  };

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: 'var(--bg-main)' }}>
      <Sidebar />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        <Header title="Student Dashboard" userXp={650} streakCount={7} masteryTier="Gold" />

        <main style={{ marginLeft: '260px', padding: '32px', display: 'flex', flexDirection: 'column', gap: '32px' }}>
          
          {/* Welcome Banner */}
          <div className="glass-card" style={{
            padding: '28px',
            background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.2), rgba(217, 70, 239, 0.15))',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center'
          }}>
            <div>
              <h2 style={{ fontSize: '24px', fontWeight: '800', marginBottom: '8px' }}>
                Welcome back, <span className="gradient-text">Alex</span>! 🚀
              </h2>
              <p style={{ color: 'var(--text-muted)', fontSize: '14px', maxWidth: '500px' }}>
                You are on a 7-day streak! Complete today&apos;s quests to unlock the Gold Mastery Badge and gain 150 XP.
              </p>
            </div>
            <button className="gradient-btn" style={{ padding: '12px 24px' }}>
              Resume Learning Roadmap →
            </button>
          </div>

          {/* Core Gamification Stats Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '20px' }}>
            <div className="glass-card" style={{ padding: '20px' }}>
              <div style={{ fontSize: '28px', marginBottom: '8px' }}>⚡</div>
              <div style={{ fontSize: '24px', fontWeight: '800', color: '#6366F1' }}>650 XP</div>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Total Experience Points</div>
            </div>
            <div className="glass-card" style={{ padding: '20px' }}>
              <div style={{ fontSize: '28px', marginBottom: '8px' }}>🔥</div>
              <div style={{ fontSize: '24px', fontWeight: '800', color: '#F59E0B' }}>7 Days</div>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Active Learning Streak</div>
            </div>
            <div className="glass-card" style={{ padding: '20px' }}>
              <div style={{ fontSize: '28px', marginBottom: '8px' }}>🛡️</div>
              <div style={{ fontSize: '24px', fontWeight: '800', color: '#FACC15' }}>Gold</div>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Current Mastery Tier</div>
            </div>
            <div className="glass-card" style={{ padding: '20px' }}>
              <div style={{ fontSize: '28px', marginBottom: '8px' }}>📚</div>
              <div style={{ fontSize: '24px', fontWeight: '800', color: '#10B981' }}>3 Courses</div>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Enrolled Realm Courses</div>
            </div>
          </div>

          {/* Section: Upload Material & Daily Quests split */}
          <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '24px' }}>
            
            {/* Upload Material Widget */}
            <div className="glass-card" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h3 style={{ fontSize: '18px', fontWeight: '700' }}>📤 Upload Learning Materials</h3>
                <span style={{ fontSize: '11px', color: 'var(--text-dim)' }}>PDF, DOCX, PPTX, Images</span>
              </div>
              
              <label style={{
                border: '2px dashed rgba(99, 102, 241, 0.4)',
                borderRadius: '12px',
                padding: '36px 20px',
                textAlign: 'center',
                cursor: 'pointer',
                background: 'rgba(15, 23, 42, 0.4)',
                transition: 'all 0.2s ease'
              }}>
                <input type="file" onChange={handleFileUpload} accept=".pdf,.docx,.pptx,.txt,image/*" style={{ display: 'none' }} />
                <div style={{ fontSize: '36px', marginBottom: '12px' }}>📄</div>
                <div style={{ fontWeight: '600', color: '#F8FAFC', marginBottom: '4px' }}>
                  Click to upload or drag & drop files
                </div>
                <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                  OCR, text extraction, knowledge graph & quiz auto-generation enabled
                </div>
              </label>

              {uploadStatus && (
                <div style={{
                  padding: '12px',
                  borderRadius: '8px',
                  background: isUploading ? 'rgba(99, 102, 241, 0.15)' : 'rgba(16, 185, 129, 0.15)',
                  border: isUploading ? '1px solid #6366F1' : '1px solid #10B981',
                  color: '#F8FAFC',
                  fontSize: '13px'
                }}>
                  {uploadStatus}
                </div>
              )}
            </div>

            {/* Daily & Weekly Quests */}
            <div className="glass-card" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h3 style={{ fontSize: '18px', fontWeight: '700' }}>🎯 Active Quests</h3>
                <span style={{ fontSize: '12px', color: '#F59E0B', fontWeight: '600' }}>Reset in 8h 12m</span>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div style={{
                  padding: '12px 16px',
                  borderRadius: '10px',
                  background: 'rgba(255, 255, 255, 0.03)',
                  border: '1px solid rgba(255, 255, 255, 0.08)',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center'
                }}>
                  <div>
                    <div style={{ fontSize: '14px', fontWeight: '600' }}>Review 10 Flashcards</div>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Active Recall Session</div>
                  </div>
                  <span style={{ color: '#8B5CF6', fontWeight: '700', fontSize: '13px' }}>+50 XP</span>
                </div>

                <div style={{
                  padding: '12px 16px',
                  borderRadius: '10px',
                  background: 'rgba(255, 255, 255, 0.03)',
                  border: '1px solid rgba(255, 255, 255, 0.08)',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center'
                }}>
                  <div>
                    <div style={{ fontSize: '14px', fontWeight: '600' }}>Ask AI Tutor 3 Questions</div>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Concept Exploration</div>
                  </div>
                  <span style={{ color: '#8B5CF6', fontWeight: '700', fontSize: '13px' }}>+75 XP</span>
                </div>

                <div style={{
                  padding: '12px 16px',
                  borderRadius: '10px',
                  background: 'rgba(255, 255, 255, 0.03)',
                  border: '1px solid rgba(255, 255, 255, 0.08)',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center'
                }}>
                  <div>
                    <div style={{ fontSize: '14px', fontWeight: '600' }}>Achieve 80% on Quiz 2</div>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Adaptive Quiz Challenge</div>
                  </div>
                  <span style={{ color: '#8B5CF6', fontWeight: '700', fontSize: '13px' }}>+100 XP</span>
                </div>
              </div>
            </div>

          </div>
        </main>
      </div>
    </div>
  );
}
