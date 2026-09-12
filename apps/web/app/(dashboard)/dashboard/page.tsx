'use client';

import { useEffect, useState } from 'react';
import Sidebar from '@/components/Sidebar';
import Header from '@/components/Header';
import { fetchApi } from '@/lib/api';

interface Course { id: string; title: string; description?: string | null }
interface Material { id: string; filename: string; status: string; summary?: string | null }

export default function DashboardPage() {
  const [isUploading, setIsUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<string | null>(null);
  const [courses, setCourses] = useState<Course[]>([]);
  const [selectedCourseId, setSelectedCourseId] = useState('');
  const [newCourseTitle, setNewCourseTitle] = useState('');

  useEffect(() => {
    fetchApi<Course[]>('/courses')
      .then((items) => {
        setCourses(items);
        if (items.length) setSelectedCourseId(items[0].id);
      })
      .catch((err) => setUploadStatus(err instanceof Error ? err.message : 'Could not load courses.'));
  }, []);

  const createCourse = async () => {
    if (!newCourseTitle.trim()) return;
    try {
      const course = await fetchApi<Course>('/courses', {
        method: 'POST',
        body: JSON.stringify({ title: newCourseTitle.trim() }),
      });
      setCourses((current) => [course, ...current]);
      setSelectedCourseId(course.id);
      setNewCourseTitle('');
      setUploadStatus(`Created course: ${course.title}`);
    } catch (err) {
      setUploadStatus(err instanceof Error ? err.message : 'Could not create course.');
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!selectedCourseId) {
      setUploadStatus('Create or select a course before uploading a document.');
      return;
    }
    setIsUploading(true);
    setUploadStatus(`Uploading and indexing ${file.name}...`);
    const formData = new FormData();
    formData.append('file', file);
    try {
      const material = await fetchApi<Material>(`/courses/${selectedCourseId}/materials/upload`, {
        method: 'POST',
        body: formData,
      });
      setUploadStatus(`${material.filename} is ready. ${material.summary || ''}`);
    } catch (err) {
      setUploadStatus(err instanceof Error ? err.message : 'Upload failed.');
    } finally {
      setIsUploading(false);
      e.target.value = '';
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
                <span style={{ fontSize: '11px', color: 'var(--text-dim)' }}>PDF, DOCX, TXT, Markdown</span>
              </div>

              <div style={{ display: 'flex', gap: '10px' }}>
                <select
                  value={selectedCourseId}
                  onChange={(e) => setSelectedCourseId(e.target.value)}
                  style={{ flex: 1, background: '#111827', color: '#FFF', border: '1px solid rgba(255,255,255,.12)', borderRadius: '8px', padding: '10px' }}
                >
                  <option value="">Select a course</option>
                  {courses.map((course) => <option key={course.id} value={course.id}>{course.title}</option>)}
                </select>
              </div>
              <div style={{ display: 'flex', gap: '10px' }}>
                <input
                  value={newCourseTitle}
                  onChange={(e) => setNewCourseTitle(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && createCourse()}
                  placeholder="New course name"
                  style={{ flex: 1, background: 'rgba(15,23,42,.6)', color: '#FFF', border: '1px solid rgba(255,255,255,.12)', borderRadius: '8px', padding: '10px' }}
                />
                <button type="button" onClick={createCourse} className="gradient-btn">Create</button>
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
                <input type="file" disabled={isUploading} onChange={handleFileUpload} accept=".pdf,.docx,.txt,.md,.markdown" style={{ display: 'none' }} />
                <div style={{ fontSize: '36px', marginBottom: '12px' }}>📄</div>
                <div style={{ fontWeight: '600', color: '#F8FAFC', marginBottom: '4px' }}>
                  Click to upload or drag & drop files
                </div>
                <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                  Text extraction and course-scoped RAG indexing enabled
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
