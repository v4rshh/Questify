'use client';

import { useState } from 'react';
import Sidebar from '@/components/Sidebar';
import Header from '@/components/Header';

export default function QuizzesPage() {
  const quiz = {
    title: 'Adaptive Quiz: Process Scheduling & CPU Dispatch',
    difficulty: 'Medium',
    questions: [
      {
        id: 1,
        question: 'Which CPU scheduling algorithm can suffer from the Convoy Effect?',
        options: ['First-Come, First-Served (FCFS)', 'Shortest Job First (SJF)', 'Round Robin (RR)', 'Priority Scheduling'],
        correctIndex: 0,
        explanation: 'FCFS suffers from the Convoy Effect when short CPU-bound processes wait behind a long I/O-bound process.',
      },
    ],
  };

  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [submitted, setSubmitted] = useState(false);

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: 'var(--bg-main)' }}>
      <Sidebar />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        <Header title="Adaptive Quiz Interface" />

        <main style={{ marginLeft: '260px', padding: '32px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '24px' }}>
          <div className="glass-card" style={{ width: '100%', maxWidth: '700px', padding: '32px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '24px' }}>
              <span style={{ fontSize: '13px', color: '#8B5CF6', fontWeight: '700' }}>Question 1 of 5</span>
              <span className="badge-tier badge-gold">Difficulty: {quiz.difficulty}</span>
            </div>

            <h2 style={{ fontSize: '20px', fontWeight: '700', marginBottom: '24px' }}>
              {quiz.questions[0].question}
            </h2>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '24px' }}>
              {quiz.questions[0].options.map((opt, idx) => {
                const isSelected = selectedOption === idx;
                const isCorrect = submitted && idx === quiz.questions[0].correctIndex;
                const isWrong = submitted && isSelected && idx !== quiz.questions[0].correctIndex;

                return (
                  <button
                    key={idx}
                    onClick={() => !submitted && setSelectedOption(idx)}
                    style={{
                      padding: '16px 20px',
                      borderRadius: '12px',
                      textAlign: 'left',
                      background: isCorrect
                        ? 'rgba(16, 185, 129, 0.2)'
                        : isWrong
                        ? 'rgba(244, 63, 94, 0.2)'
                        : isSelected
                        ? 'rgba(99, 102, 241, 0.25)'
                        : 'rgba(255, 255, 255, 0.03)',
                      border: isCorrect
                        ? '1px solid #10B981'
                        : isWrong
                        ? '1px solid #F43F5E'
                        : isSelected
                        ? '1px solid #6366F1'
                        : '1px solid rgba(255, 255, 255, 0.08)',
                      color: '#FFF',
                      fontSize: '14px',
                      fontWeight: isSelected ? '600' : '400',
                      cursor: submitted ? 'default' : 'pointer',
                      transition: 'all 0.2s ease'
                    }}
                  >
                    {opt}
                  </button>
                );
              })}
            </div>

            {!submitted ? (
              <button
                disabled={selectedOption === null}
                onClick={() => setSubmitted(true)}
                className="gradient-btn"
                style={{ width: '100%', opacity: selectedOption === null ? 0.5 : 1 }}
              >
                Submit Answer 🎯
              </button>
            ) : (
              <div style={{ padding: '16px', borderRadius: '10px', background: 'rgba(16, 185, 129, 0.15)', border: '1px solid #10B981', color: '#F8FAFC' }}>
                <div style={{ fontWeight: '700', marginBottom: '4px' }}>Correct! +25 XP Earned! ⚡</div>
                <div style={{ fontSize: '13px', color: 'var(--text-muted)' }}>{quiz.questions[0].explanation}</div>
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
