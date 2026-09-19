'use client';

import { useEffect, useState } from 'react';
import { fetchApi } from '@/lib/api';

interface Game {
  node_id: string; title: string; difficulty: string; lesson: string;
  solved_count: number; total: number; points: number; completed: boolean;
  question: { prompt: string; options: string[]; source: string; page: number | null } | null;
}
interface Feedback { correct: boolean; explanation: string; correct_answer: string; xp_earned: number; game: Game; }

export default function LevelGame({ nodeId, onProgress }: { nodeId: string; onProgress: () => void }) {
  const [game, setGame] = useState<Game | null>(null);
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    let active = true;
    setGame(null); setFeedback(null); setError('');
    fetchApi<Game>(`/learning/levels/${nodeId}/game`).then(value => { if (active) setGame(value); }).catch(err => { if (active) setError(err.message); });
    return () => { active = false; };
  }, [nodeId]);
  async function answer(index: number) {
    if (!game || busy || feedback) return;
    setBusy(true); setError('');
    try {
      const result = await fetchApi<Feedback>(`/learning/levels/${nodeId}/game/answer`, {
        method: 'POST', body: JSON.stringify({ question_index: game.solved_count, answer_index: index }),
      });
      setFeedback(result);
      onProgress();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save your answer.');
      // Recover server state after an interrupted response or a second tab.
      try { setGame(await fetchApi<Game>(`/learning/levels/${nodeId}/game`)); } catch { /* Keep the retryable error visible. */ }
    } finally { setBusy(false); }
  }
  const current = feedback?.game || game;
  return <section className="level-game panel" aria-busy={busy}>
    {error && <p role="alert">{error}</p>}
    {!game ? <p>Loading level…</p> : <>
      <div className="game-heading"><div><small>{game.difficulty} · Concept trail</small><h2>{game.title}</h2></div><strong aria-live="polite">{current?.points} points</strong></div>
      <p className="game-lesson">{game.lesson}</p>
      <div className="game-trail" aria-label={`${current?.solved_count} of ${game.total} checkpoints completed`}>
        {Array.from({ length: game.total + 1 }, (_, index) => <span className={index <= (current?.solved_count || 0) ? 'reached' : ''} key={index}>{index === current?.solved_count ? '◆' : index === game.total ? '⚑' : index}</span>)}
      </div>
      <p className="game-caption">Answer each challenge to move one checkpoint. Earn 10 points for each first correct solve.</p>
      {game.completed ? <div className="game-complete"><h3>Level complete</h3><p>Your progress is saved. Open the next unlocked level, or review this lesson.</p></div> : game.question && <>
        <h3>Challenge {game.solved_count + 1} of {game.total}</h3>
        <p className="game-prompt">{game.question.prompt}</p>
        <div className="game-options">{game.question.options.map((option, index) => <button className="btn" type="button" key={index} disabled={busy || Boolean(feedback)} onClick={() => answer(index)}><b>{String.fromCharCode(65 + index)}</b>{option}</button>)}</div>
        <small>Source: {game.question.source}{game.question.page ? ` · page ${game.question.page}` : ''}</small>
      </>}
      {feedback && <div className="game-feedback" role="status"><strong>{feedback.correct ? `Checkpoint reached! +${feedback.xp_earned} XP` : 'Not quite. Let’s work through it.'}</strong><p>{!feedback.correct && `Correct answer: ${feedback.correct_answer}. `}{feedback.explanation}</p><button className="btn btn-primary" onClick={() => { setGame(feedback.game); setFeedback(null); }}>{feedback.correct ? feedback.game.completed ? 'Finish level' : 'Next challenge' : 'Try this challenge again'}</button></div>}
    </>}
    <style jsx>{`
      .level-game{padding:28px;margin-top:20px}.game-heading{display:flex;justify-content:space-between;gap:16px}.game-heading h2{font-size:23px;margin-top:6px}.game-heading small,small,.game-caption{color:var(--muted);font-size:12px}.game-heading strong{color:var(--accent);white-space:nowrap}.game-lesson{line-height:1.8;white-space:pre-wrap;margin:20px 0}.game-trail{display:flex;justify-content:space-between;position:relative;margin:28px 0 12px;border-bottom:3px solid var(--border);padding-bottom:12px}.game-trail span{display:grid;place-items:center;width:38px;height:38px;border-radius:50%;background:var(--surface-muted);border:2px solid var(--border);transition:background .3s,transform .3s}.game-trail .reached{background:var(--accent);color:white;border-color:var(--accent);transform:translateY(-4px)}.game-caption{margin-bottom:24px}.game-prompt{margin:12px 0;line-height:1.6}.game-options{display:grid;gap:10px;margin:16px 0}.game-options .btn{justify-content:flex-start;white-space:normal;text-align:left;height:auto;padding:14px;line-height:1.5}.game-options b{margin-right:12px;color:var(--accent)}.game-feedback,.game-complete{padding:20px;background:var(--accent-soft);border-radius:12px;margin-top:20px}.game-feedback p{line-height:1.7;margin:12px 0}.game-feedback button{margin-top:12px}@media(max-width:640px){.level-game{padding:18px}.game-heading{flex-direction:column}}
    `}</style>
  </section>;
}
