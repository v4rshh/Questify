'use client';

import { useEffect, useState } from 'react';

import Header from '@/components/Header';
import { Icon } from '@/components/Icon';
import Sidebar from '@/components/Sidebar';
import { fetchApi } from '@/lib/api';

interface Course {
  id: string;
  title: string;
}

interface Flashcard {
  id: string;
  node_id: string;
  front: string;
  back: string;
  hint?: string | null;
  interval_days: number;
  repetition_count: number;
}

interface Topic {
  id: string;
  title: string;
}

interface ReviewResult {
  xp_earned: number;
}

type DeckScope = 'all' | 'due' | 'difficult';
type SessionSize = '5' | '10' | '20' | 'all';

export default function FlashcardsPage() {
  const [courses, setCourses] = useState<Course[]>([]);
  const [courseId, setCourseId] = useState('');
  const [cards, setCards] = useState<Flashcard[]>([]);
  const [topics, setTopics] = useState<Topic[]>([]);
  const [scope, setScope] = useState<DeckScope>('due');
  const [topicId, setTopicId] = useState('');
  const [sessionSize, setSessionSize] = useState<SessionSize>('10');
  const [shuffle, setShuffle] = useState(false);
  const [reloadSeed, setReloadSeed] = useState(0);
  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [reviewed, setReviewed] = useState(0);
  const [recalled, setRecalled] = useState(0);
  const [recallStreak, setRecallStreak] = useState(0);
  const [bestStreak, setBestStreak] = useState(0);
  const [sessionComplete, setSessionComplete] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function loadCourses() {
      try {
        const items = await fetchApi<Course[]>('/courses');
        if (cancelled) return;

        setCourses(items);
        setCourseId(items[0]?.id ?? '');
        if (items.length === 0) setLoading(false);
      } catch (loadError) {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : 'Could not load workspaces.');
          setLoading(false);
        }
      }
    }

    void loadCourses();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!courseId) return;
    fetchApi<{ node_mastery: Topic[] }>(`/learning/courses/${courseId}/analytics`)
      .then((analytics) => setTopics(analytics.node_mastery))
      .catch(() => setTopics([]));
  }, [courseId]);

  useEffect(() => {
    if (!courseId) return;

    let cancelled = false;
    setLoading(true);
    setError('');
    setNotice('');
    setIndex(0);
    setFlipped(false);
    setReviewed(0);
    setRecalled(0);
    setRecallStreak(0);
    setBestStreak(0);
    setSessionComplete(false);

    async function loadCards() {
      try {
        const params = new URLSearchParams();
        if (scope === 'due') params.set('due_only', 'true');
        if (scope === 'difficult') params.set('difficult_only', 'true');
        if (topicId) params.set('node_id', topicId);
        if (sessionSize !== 'all') params.set('limit', sessionSize);
        if (shuffle) params.set('shuffle', 'true');
        const items = await fetchApi<Flashcard[]>(
          `/learning/courses/${courseId}/flashcards?${params.toString()}`,
        );
        if (!cancelled) setCards(items);
      } catch (loadError) {
        if (!cancelled) {
          setCards([]);
          setError(loadError instanceof Error ? loadError.message : 'Could not load flashcards.');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void loadCards();
    return () => {
      cancelled = true;
    };
  }, [courseId, reloadSeed, scope, sessionSize, shuffle, topicId]);

  const card = cards[index];

  async function review(quality: number) {
    if (!card || busy) return;

    setBusy(true);
    setError('');
    setNotice('');

    try {
      const result = await fetchApi<ReviewResult>(`/learning/flashcards/${card.id}/review`, {
        method: 'POST',
        body: JSON.stringify({ quality }),
      });

      setNotice(`Review saved · +${result.xp_earned} XP`);
      setFlipped(false);
      const remembered = quality >= 3;
      const nextReviewed = reviewed + 1;
      const nextStreak = remembered ? recallStreak + 1 : 0;
      setReviewed(nextReviewed);
      setRecalled((value) => value + (remembered ? 1 : 0));
      setRecallStreak(nextStreak);
      setBestStreak((value) => Math.max(value, nextStreak));
      if (nextReviewed >= cards.length) setSessionComplete(true);
      else setIndex((current) => current + 1);
      window.dispatchEvent(new Event('questify:metrics-updated'));
    } catch (reviewError) {
      setError(reviewError instanceof Error ? reviewError.message : 'Could not save review.');
    } finally {
      setBusy(false);
    }
  }

  function restartSession() {
    setReloadSeed((value) => value + 1);
  }

  return (
    <div className="app-shell">
      <Sidebar />
      <div className="page-content">
        <Header title="Flashcards" />
        <main className="flash-page">
          <div className="flash-top">
            <div>
              <p className="eyebrow">Active recall</p>
              <h2>Practice what you want to keep.</h2>
            </div>
            <select
              aria-label="Choose workspace"
              className="course-select"
              value={courseId}
              onChange={(event) => setCourseId(event.target.value)}
            >
              <option value="">Choose workspace</option>
              {courses.map((course) => (
                <option key={course.id} value={course.id}>
                  {course.title}
                </option>
              ))}
            </select>
          </div>

          <section className="deck-controls" aria-label="Flashcard session options">
            <label>
              <span>Cards</span>
              <select value={scope} onChange={(event) => setScope(event.target.value as DeckScope)}>
                <option value="due">Due today</option>
                <option value="difficult">Difficult cards</option>
                <option value="all">All cards</option>
              </select>
            </label>
            <label>
              <span>Topic</span>
              <select value={topicId} onChange={(event) => setTopicId(event.target.value)}>
                <option value="">All topics</option>
                {topics.map((topic) => (
                  <option key={topic.id} value={topic.id}>
                    {topic.title}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span>Session size</span>
              <select
                value={sessionSize}
                onChange={(event) => setSessionSize(event.target.value as SessionSize)}
              >
                <option value="5">5 cards</option>
                <option value="10">10 cards</option>
                <option value="20">20 cards</option>
                <option value="all">All cards</option>
              </select>
            </label>
            <label className="shuffle-control">
              <input
                type="checkbox"
                checked={shuffle}
                onChange={(event) => setShuffle(event.target.checked)}
              />
              <span>Shuffle</span>
            </label>
          </section>

          {error && <p className="error-message">{error}</p>}
          {notice && <p className="notice">{notice}</p>}

          {loading ? (
            <section className="panel empty" aria-live="polite">
              <Icon name="bookOpen" size={22} />
              <h3>Loading your deck…</h3>
            </section>
          ) : sessionComplete ? (
            <section className="panel session-summary">
              <Icon name="trophy" size={28} />
              <p className="eyebrow">Session complete</p>
              <h3>{recalled} cards recalled</h3>
              <div>
                <span>
                  <b>{reviewed}</b> reviewed
                </span>
                <span>
                  <b>{reviewed ? Math.round((recalled / reviewed) * 100) : 0}%</b> recall
                </span>
                <span>
                  <b>{bestStreak}</b> best streak
                </span>
              </div>
              <button type="button" className="btn btn-primary" onClick={restartSession}>
                Start another session
              </button>
            </section>
          ) : card ? (
            <section className="deck">
              <div className="deck-meta">
                <span>
                  Card {index + 1} of {cards.length}
                </span>
                <span>
                  Review interval: {card.interval_days} day{card.interval_days === 1 ? '' : 's'}
                </span>
                <span>Recall streak: {recallStreak}</span>
              </div>

              <div className="card-scene" key={card.id}>
                <button
                  type="button"
                  className={`study-card ${flipped ? 'flipped' : ''}`}
                  aria-label={flipped ? 'Show the question' : 'Reveal the answer'}
                  aria-pressed={flipped}
                  onClick={() => setFlipped((value) => !value)}
                >
                  <span className="card-face card-front" aria-hidden={flipped}>
                    <span className="card-label">Question</span>
                    <strong className="card-copy">{card.front}</strong>
                    {card.hint && <span className="card-hint">Hint: {card.hint}</span>}
                    <span className="card-help">Select the card to reveal the answer.</span>
                  </span>

                  <span className="card-face card-back" aria-hidden={!flipped}>
                    <span className="card-label">Answer</span>
                    <strong className="card-copy">{card.back}</strong>
                    <span className="card-help">Rate how easily you recalled it.</span>
                  </span>
                </button>
              </div>

              <div className={`review-actions ${flipped ? 'visible' : ''}`} aria-hidden={!flipped}>
                <button
                  type="button"
                  className="btn review-again"
                  disabled={busy || !flipped}
                  onClick={() => review(1)}
                >
                  Again <span>1 day</span>
                </button>
                <button
                  type="button"
                  className="btn review-good"
                  disabled={busy || !flipped}
                  onClick={() => review(4)}
                >
                  Good <span>Save progress</span>
                </button>
                <button
                  type="button"
                  className="btn btn-primary"
                  disabled={busy || !flipped}
                  onClick={() => review(5)}
                >
                  Easy <Icon name="arrowUp" size={14} />
                </button>
              </div>
            </section>
          ) : (
            <section className="panel empty">
              <Icon name="bookOpen" size={22} />
              <h3>{scope === 'due' ? 'You are caught up' : 'No matching flashcards'}</h3>
              <p>
                {scope === 'due'
                  ? 'There are no cards due in this topic. Try all cards or another topic.'
                  : 'Generate a learning world or adjust the session filters to build a deck.'}
              </p>
            </section>
          )}
        </main>
      </div>

      <style jsx>{`
        .flash-page {
          max-width: 850px;
          margin: 0 auto;
          padding: 38px;
          font-size: 16px;
        }
        .flash-top {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          margin-bottom: 28px;
        }
        .eyebrow {
          color: var(--accent);
          font-size: 13px;
          font-weight: 700;
          letter-spacing: 0.09em;
          text-transform: uppercase;
        }
        .flash-top h2 {
          margin-top: 6px;
          font-size: 29px;
          letter-spacing: -0.045em;
        }
        .course-select {
          min-width: 220px;
          padding: 10px 12px;
          border: 1px solid var(--border);
          border-radius: 9px;
          background: var(--surface);
          color: var(--foreground);
          font-size: 15px;
        }
        .deck-controls {
          display: grid;
          grid-template-columns: 1fr 1fr 1fr auto;
          align-items: end;
          gap: 11px;
          margin-bottom: 20px;
          padding: 15px;
          border: 1px solid var(--border);
          border-radius: 12px;
          background: var(--surface);
        }
        .deck-controls label {
          display: grid;
          gap: 6px;
        }
        .deck-controls label > span {
          color: var(--muted);
          font-size: 10px;
          font-weight: 800;
          letter-spacing: 0.07em;
          text-transform: uppercase;
        }
        .deck-controls select {
          min-width: 0;
          padding: 9px 10px;
          border: 1px solid var(--border);
          border-radius: 8px;
          background: var(--surface);
          color: var(--foreground);
        }
        .deck-controls .shuffle-control {
          display: flex;
          align-items: center;
          gap: 7px;
          min-height: 38px;
          padding: 0 10px;
          border: 1px solid var(--border);
          border-radius: 8px;
        }
        .shuffle-control input {
          accent-color: var(--accent);
        }
        .deck-meta {
          display: flex;
          justify-content: space-between;
          margin-bottom: 11px;
          color: var(--muted);
          font-size: 12px;
        }
        .session-summary {
          display: grid;
          justify-items: center;
          gap: 13px;
          padding: 44px;
          color: var(--accent);
          text-align: center;
          animation: card-arrive 240ms ease-out;
        }
        .session-summary h3 {
          color: var(--foreground);
          font-size: 27px;
        }
        .session-summary > div {
          display: flex;
          gap: 10px;
        }
        .session-summary > div span {
          display: grid;
          gap: 3px;
          min-width: 110px;
          padding: 12px;
          border-radius: 10px;
          background: var(--surface-muted);
          color: var(--muted);
          font-size: 11px;
        }
        .session-summary > div b {
          color: var(--foreground);
          font-size: 18px;
        }
        .card-scene {
          min-height: 350px;
          perspective: 1200px;
          animation: card-arrive 240ms ease-out;
        }
        .study-card {
          position: relative;
          width: 100%;
          min-height: 350px;
          padding: 0;
          border: 0;
          border-radius: 15px;
          background: transparent;
          color: var(--foreground);
          cursor: pointer;
          transform-style: preserve-3d;
          transition: transform 560ms cubic-bezier(0.2, 0.72, 0.22, 1);
        }
        .study-card.flipped {
          transform: rotateY(180deg);
        }
        .card-face {
          position: absolute;
          inset: 0;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 38px;
          overflow: hidden;
          border: 1px solid var(--border-strong);
          border-radius: 15px;
          background: var(--surface);
          text-align: center;
          backface-visibility: hidden;
          -webkit-backface-visibility: hidden;
          transition:
            border-color 180ms ease,
            box-shadow 180ms ease;
        }
        .card-back {
          border-color: #abc4b3;
          background: var(--accent-soft);
          transform: rotateY(180deg);
        }
        .study-card:hover .card-face,
        .study-card:focus-visible .card-face {
          border-color: #8fab9b;
          box-shadow: 0 18px 50px rgb(27 61 44 / 10%);
        }
        .study-card:focus-visible {
          outline: none;
        }
        .card-label {
          margin-bottom: 18px;
          color: var(--accent);
          font-size: 11px;
          font-weight: 700;
          letter-spacing: 0.1em;
          text-transform: uppercase;
        }
        .card-copy {
          max-width: 620px;
          font-size: 30px;
          line-height: 1.35;
          letter-spacing: -0.035em;
        }
        .card-hint {
          margin-top: 16px;
          color: var(--muted);
          font-size: 12px;
          font-style: italic;
        }
        .card-help {
          margin-top: 20px;
          color: var(--muted);
          font-size: 12px;
        }
        .review-actions {
          display: flex;
          justify-content: center;
          gap: 10px;
          margin-top: 17px;
          opacity: 0;
          pointer-events: none;
          transform: translateY(-6px);
          transition:
            opacity 180ms ease 250ms,
            transform 180ms ease 250ms;
        }
        .review-actions.visible {
          opacity: 1;
          pointer-events: auto;
          transform: translateY(0);
        }
        .review-actions .btn {
          min-width: 128px;
          font-size: 16px;
        }
        .review-actions .btn span {
          display: block;
          color: inherit;
          font-size: 15px;
          font-weight: 400;
        }
        .review-again {
          border-color: #e4b0b0;
          color: #9b3f3f;
        }
        .review-good {
          border-color: #e5cf9d;
          color: #8a6323;
        }
        .empty {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 9px;
          max-width: 440px;
          margin: 70px auto;
          padding: 32px;
          color: var(--accent);
          text-align: center;
        }
        .empty h3 {
          color: var(--foreground);
          font-size: 20px;
        }
        .empty p {
          color: var(--muted);
          font-size: 13px;
          line-height: 1.55;
        }
        .error-message,
        .notice {
          margin-bottom: 12px;
          padding: 10px 12px;
          border-radius: 8px;
          font-size: 12px;
        }
        .error-message {
          border: 1px solid #e7caca;
          color: var(--danger);
        }
        .notice {
          border: 1px solid #b9d5c3;
          background: var(--accent-soft);
          color: var(--accent);
        }
        @keyframes card-arrive {
          from {
            opacity: 0;
            transform: translateY(8px);
          }
        }
        @media (prefers-reduced-motion: reduce) {
          .card-scene {
            animation: none;
          }
          .study-card,
          .review-actions {
            transition-duration: 1ms;
            transition-delay: 0ms;
          }
        }
        @media (max-width: 700px) {
          .flash-page {
            padding: 24px 16px;
          }
          .flash-top {
            flex-direction: column;
            gap: 16px;
          }
          .course-select {
            width: 100%;
          }
          .deck-controls {
            grid-template-columns: 1fr;
          }
          .card-scene,
          .study-card {
            min-height: 300px;
          }
          .card-face {
            padding: 24px;
          }
          .card-copy {
            font-size: 21px;
          }
          .review-actions {
            align-items: stretch;
            flex-direction: column;
          }
          .review-actions .btn {
            width: 100%;
          }
          .session-summary > div {
            flex-direction: column;
            width: 100%;
          }
        }
      `}</style>
    </div>
  );
}
