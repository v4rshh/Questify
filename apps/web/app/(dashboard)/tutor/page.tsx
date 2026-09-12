'use client';

import { useEffect, useState } from 'react';
import Sidebar from '@/components/Sidebar';
import Header from '@/components/Header';
import { fetchApi } from '@/lib/api';

interface Message {
  sender: 'user' | 'ai';
  text: string;
  citations?: Citation[];
}

interface Citation { source: string; page: number | null; excerpt: string; chunk_index: number }
interface Course { id: string; title: string }

interface TutorChatResponse {
  response: string;
  mode: string;
  xp_earned: number;
  total_xp: number;
  citations: Citation[];
}

export default function TutorPage() {
  const [messages, setMessages] = useState<Message[]>([
    {
      sender: 'ai',
      text: 'Hello! Ask me anything and I\'ll do my best to help you learn.',
    },
  ]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [gameMode, setGameMode] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [xpToast, setXpToast] = useState<number | null>(null);
  const [courses, setCourses] = useState<Course[]>([]);
  const [selectedCourseId, setSelectedCourseId] = useState('');

  useEffect(() => {
    fetchApi<Course[]>('/courses')
      .then((items) => {
        setCourses(items);
        if (items.length) setSelectedCourseId(items[0].id);
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Could not load courses.'));
  }, []);

  const handleSend = async () => {
    if (!input.trim() || isTyping) return;
    if (!selectedCourseId) {
      setError('Create and select a course before asking the tutor.');
      return;
    }
    const userMsg = input;
    setMessages((prev) => [...prev, { sender: 'user', text: userMsg }]);
    setInput('');
    setIsTyping(true);
    setError(null);

    try {
      const data = await fetchApi<TutorChatResponse>('/tutor/chat', {
        method: 'POST',
        body: JSON.stringify({ message: userMsg, mode: gameMode ? 'game' : 'normal', course_id: selectedCourseId }),
      });

      setMessages((prev) => [...prev, { sender: 'ai', text: data.response, citations: data.citations }]);
      if (data.xp_earned > 0) {
        setXpToast(data.xp_earned);
        setTimeout(() => setXpToast(null), 2500);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to reach the AI Tutor.');
    } finally {
      setIsTyping(false);
    }
  };

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: 'var(--bg-main)' }}>
      <Sidebar />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        <Header title="Interactive AI Tutor Chat" />

        <main style={{ marginLeft: '260px', padding: '32px', display: 'flex', gap: '24px', height: 'calc(100vh - 70px)' }}>
          {/* Chat Container */}
          <div className="glass-card" style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: '20px', position: 'relative' }}>
            {xpToast !== null && (
              <div style={{
                position: 'absolute', top: '16px', right: '16px',
                background: 'rgba(16, 185, 129, 0.15)', border: '1px solid rgba(16, 185, 129, 0.4)',
                color: '#10B981', padding: '6px 14px', borderRadius: '20px', fontSize: '13px', fontWeight: 700
              }}>
                ⚡ +{xpToast} XP
              </div>
            )}

            <select
              value={selectedCourseId}
              onChange={(e) => setSelectedCourseId(e.target.value)}
              aria-label="Selected course"
              style={{ alignSelf: 'flex-start', minWidth: '240px', background: '#111827', color: '#FFF', border: '1px solid rgba(255,255,255,.12)', borderRadius: '8px', padding: '8px 10px', marginBottom: '-32px', zIndex: 1 }}
            >
              <option value="">Select a course</option>
              {courses.map((course) => <option key={course.id} value={course.id}>{course.title}</option>)}
            </select>

            {/* Normal / Game mode toggle */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '10px', marginBottom: '12px' }}>
              <span style={{ fontSize: '12px', color: gameMode ? 'var(--text-muted)' : '#F8FAFC' }}>Normal</span>
              <button
                onClick={() => setGameMode((v) => !v)}
                style={{
                  width: '44px', height: '24px', borderRadius: '12px', border: 'none', cursor: 'pointer',
                  background: gameMode ? 'linear-gradient(90deg, #6366F1, #8B5CF6)' : 'rgba(255,255,255,0.15)',
                  position: 'relative', transition: 'background 0.2s'
                }}
                aria-label="Toggle game mode"
              >
                <span style={{
                  position: 'absolute', top: '3px', left: gameMode ? '23px' : '3px',
                  width: '18px', height: '18px', borderRadius: '50%', background: '#FFF', transition: 'left 0.2s'
                }} />
              </button>
              <span style={{ fontSize: '12px', color: gameMode ? '#F8FAFC' : 'var(--text-muted)' }}>🎮 Game</span>
            </div>

            <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '16px', paddingRight: '8px' }}>
              {messages.map((msg, idx) => (
                <div
                  key={idx}
                  style={{
                    alignSelf: msg.sender === 'user' ? 'flex-end' : 'flex-start',
                    maxWidth: '75%',
                    padding: '14px 18px',
                    borderRadius: '16px',
                    background: msg.sender === 'user' ? 'linear-gradient(135deg, #6366F1, #8B5CF6)' : 'rgba(255, 255, 255, 0.05)',
                    border: msg.sender === 'ai' ? '1px solid rgba(255, 255, 255, 0.1)' : 'none',
                    color: '#FFF',
                    fontSize: '14px',
                    lineHeight: '1.5',
                    whiteSpace: 'pre-wrap'
                  }}
                >
                  {msg.text}
                  {msg.citations && msg.citations.length > 0 && (
                    <div style={{ marginTop: '12px', paddingTop: '10px', borderTop: '1px solid rgba(255,255,255,.1)', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      {msg.citations.map((citation, citationIndex) => (
                        <div key={`${citation.source}-${citation.chunk_index}-${citationIndex}`} style={{ color: '#A5B4FC', fontSize: '11px' }}>
                          [{citationIndex + 1}] {citation.source}{citation.page ? ` · page ${citation.page}` : ''}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
              {isTyping && <div style={{ fontSize: '12px', color: '#94A3B8' }}>AI Tutor is thinking...</div>}
              {error && (
                <div style={{ fontSize: '12px', color: '#F87171', background: 'rgba(248,113,113,0.1)', border: '1px solid rgba(248,113,113,0.3)', borderRadius: '8px', padding: '10px 14px' }}>
                  {error}
                </div>
              )}
            </div>

            {/* Input Bar */}
            <div style={{ display: 'flex', gap: '12px', marginTop: '16px' }}>
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                placeholder={gameMode ? 'Ask anything to start a quest...' : 'Ask anything...'}
                style={{
                  flex: 1,
                  background: 'rgba(15, 23, 42, 0.6)',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  borderRadius: '10px',
                  padding: '12px 16px',
                  color: '#FFF',
                  fontSize: '14px',
                  outline: 'none'
                }}
              />
              <button onClick={handleSend} className="gradient-btn" disabled={isTyping}>
                Send 🚀
              </button>
            </div>
          </div>

          {/* Quick Concept Prompts Sidebar */}
          <div className="glass-card" style={{ width: '280px', padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <h3 style={{ fontSize: '16px', fontWeight: '700' }}>💡 Suggested Prompts</h3>
            <div
              onClick={() => setInput('Explain the difference between Preemptive and Non-Preemptive scheduling.')}
              style={{ padding: '12px', borderRadius: '8px', background: 'rgba(255, 255, 255, 0.03)', cursor: 'pointer', fontSize: '12px', border: '1px solid rgba(255, 255, 255, 0.05)' }}
            >
              "Compare Preemptive vs Non-Preemptive CPU scheduling"
            </div>
            <div
              onClick={() => setInput('What is a deadlock and what are its four necessary conditions?')}
              style={{ padding: '12px', borderRadius: '8px', background: 'rgba(255, 255, 255, 0.03)', cursor: 'pointer', fontSize: '12px', border: '1px solid rgba(255, 255, 255, 0.05)' }}
            >
              "Explain deadlock conditions with an example"
            </div>
            <p style={{ fontSize: '11px', color: 'var(--text-muted)', lineHeight: 1.5 }}>
              Answers are grounded only in documents uploaded to the selected course. Sources and PDF page numbers appear below each response.
            </p>
          </div>
        </main>
      </div>
    </div>
  );
}
