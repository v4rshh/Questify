'use client';

import { useState } from 'react';
import Sidebar from '../../../components/Sidebar';
import Header from '../../../components/Header';

interface Message {
  sender: 'user' | 'ai';
  text: string;
  citations?: { source: string; page: number }[];
}

export default function TutorPage() {
  const [messages, setMessages] = useState<Message[]>([
    {
      sender: 'ai',
      text: 'Hello Alex! I am your AI Study Mentor grounded in your uploaded materials. Ask me any question, ask for concept comparisons, or request code examples.',
    },
  ]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);

  const handleSend = () => {
    if (!input.trim()) return;
    const userMsg = input;
    setMessages((prev) => [...prev, { sender: 'user', text: userMsg }]);
    setInput('');
    setIsTyping(true);

    setTimeout(() => {
      setIsTyping(false);
      setMessages((prev) => [
        ...prev,
        {
          sender: 'ai',
          text: `Here is the explanation grounded in your Operating Systems material regarding "${userMsg}":\n\nProcess scheduling manages state transitions between Ready, Running, and Blocked queues. The short-term scheduler decides which ready process CPU executes next.`,
          citations: [
            { source: 'OS_Chapter_3_Processes.pdf', page: 14 },
            { source: 'Lecture_Notes_Unit1.docx', page: 5 },
          ],
        },
      ]);
    }, 1200);
  };

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: 'var(--bg-main)' }}>
      <Sidebar />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        <Header title="Interactive AI Tutor Chat" />

        <main style={{ marginLeft: '260px', padding: '32px', display: 'flex', gap: '24px', height: 'calc(100vh - 70px)' }}>
          {/* Chat Container */}
          <div className="glass-card" style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: '20px' }}>
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
                    lineHeight: '1.5'
                  }}
                >
                  <div>{msg.text}</div>

                  {msg.citations && msg.citations.length > 0 && (
                    <div style={{ marginTop: '10px', paddingTop: '10px', borderTop: '1px solid rgba(255, 255, 255, 0.1)', display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                      <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Citations:</span>
                      {msg.citations.map((c, i) => (
                        <span key={i} style={{ background: 'rgba(99, 102, 241, 0.2)', color: '#A5B4FC', padding: '2px 8px', borderRadius: '4px', fontSize: '11px' }}>
                          📄 {c.source} (p. {c.page})
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              ))}
              {isTyping && <div style={{ fontSize: '12px', color: '#94A3B8' }}>AI Tutor is generating grounded answer...</div>}
            </div>

            {/* Input Bar */}
            <div style={{ display: 'flex', gap: '12px', marginTop: '16px' }}>
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                placeholder="Ask your AI tutor anything about your course material..."
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
              <button onClick={handleSend} className="gradient-btn">
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
          </div>
        </main>
      </div>
    </div>
  );
}
