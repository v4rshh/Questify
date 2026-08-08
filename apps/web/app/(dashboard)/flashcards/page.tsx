'use client';

import { useState } from 'react';
import Sidebar from '@/components/Sidebar';
import Header from '@/components/Header';

export default function FlashcardsPage() {
  const cards = [
    {
      id: 1,
      front: 'What is a Semaphore in Operating Systems?',
      back: 'A Semaphore is an integer variable used to solve critical section problems by synchronizing concurrent processes using wait() [P] and signal() [V] operations.',
      hint: 'Think of atomic signal and wait counters.',
    },
    {
      id: 2,
      front: 'What are the 4 conditions required for a Deadlock to occur?',
      back: '1. Mutual Exclusion\n2. Hold and Wait\n3. No Preemption\n4. Circular Wait',
      hint: 'Mutual exclusion, hold and wait, no preemption, circular wait.',
    },
  ];

  const [currentIndex, setCurrentIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [showHint, setShowHint] = useState(false);

  const currentCard = cards[currentIndex];

  const handleNext = () => {
    setFlipped(false);
    setShowHint(false);
    setCurrentIndex((prev) => (prev + 1) % cards.length);
  };

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: 'var(--bg-main)' }}>
      <Sidebar />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        <Header title="Flashcard Active Recall Player" />

        <main style={{ marginLeft: '260px', padding: '32px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '32px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', maxWidth: '600px' }}>
            <span style={{ fontSize: '14px', color: 'var(--text-muted)' }}>
              Card {currentIndex + 1} of {cards.length}
            </span>
            <span style={{ fontSize: '14px', color: '#10B981', fontWeight: '600' }}>
              SM-2 Spaced Repetition Mode
            </span>
          </div>

          {/* 3D Flip Card */}
          <div
            className={`flip-card ${flipped ? 'flipped' : ''}`}
            onClick={() => setFlipped(!flipped)}
            style={{ maxWidth: '600px', cursor: 'pointer' }}
          >
            <div className="flip-card-inner">
              <div className="flip-card-front glass-card">
                <div style={{ fontSize: '12px', color: '#8B5CF6', fontWeight: '700', marginBottom: '16px', textTransform: 'uppercase' }}>
                  Question / Concept
                </div>
                <h2 style={{ fontSize: '20px', fontWeight: '700', textAlign: 'center' }}>
                  {currentCard.front}
                </h2>
                <span style={{ fontSize: '12px', color: 'var(--text-dim)', marginTop: '24px' }}>
                  Click to reveal answer 🔄
                </span>
              </div>

              <div className="flip-card-back glass-card">
                <div style={{ fontSize: '12px', color: '#10B981', fontWeight: '700', marginBottom: '16px', textTransform: 'uppercase' }}>
                  Answer Explanation
                </div>
                <p style={{ fontSize: '15px', textAlign: 'center', lineHeight: '1.6', whiteSpace: 'pre-line' }}>
                  {currentCard.back}
                </p>
              </div>
            </div>
          </div>

          {/* Controls */}
          {flipped && (
            <div style={{ display: 'flex', gap: '16px', marginTop: '16px' }}>
              <button onClick={handleNext} className="btn-secondary" style={{ borderColor: '#F43F5E', color: '#F43F5E' }}>
                🔴 Hard (Repeat Soon)
              </button>
              <button onClick={handleNext} className="btn-secondary" style={{ borderColor: '#F59E0B', color: '#F59E0B' }}>
                🟡 Good (Interval 3 days)
              </button>
              <button onClick={handleNext} className="gradient-btn">
                🟢 Easy (Interval 7 days)
              </button>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
