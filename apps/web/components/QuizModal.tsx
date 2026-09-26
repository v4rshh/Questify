'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { useEffect, useState } from 'react';
import type { Feedback, Game, MapLevel, WizardHelp, WizardMood } from './quest-map.types';

interface Props {
  open: boolean;
  level: MapLevel | null;
  game: Game | null;
  loading?: boolean;
  onClose: () => void;
  onAnswer: (index: number) => Promise<Feedback>;
  onRequestHint: (questionIndex: number) => Promise<WizardHelp>;
  onLevelComplete: (game: Game) => void;
  onMoodChange?: (mood: WizardMood) => void;
}

export default function QuizModal({ open, level, game, loading, onClose, onAnswer, onRequestHint, onLevelComplete, onMoodChange }: Props) {
  const [selected, setSelected] = useState<number | null>(null);
  const [hintOpen, setHintOpen] = useState(false);
  const [purchasedHint, setPurchasedHint] = useState<WizardHelp | null>(null);
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [busy, setBusy] = useState(false);
  const [hintBusy, setHintBusy] = useState(false);
  const [error, setError] = useState('');
  const [mood, setMood] = useState<WizardMood>('neutral');

  const updateMood = (next: WizardMood) => { setMood(next); onMoodChange?.(next); };
  useEffect(() => {
    setSelected(null); setFeedback(null); setHintOpen(false); setPurchasedHint(null); setError(''); updateMood('neutral');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [level?.id, open]);

  async function checkAnswer() {
    if (selected === null || busy) return;
    setBusy(true); setError('');
    try { const result = await onAnswer(selected); setFeedback(result); updateMood(result.correct ? 'celebrating' : 'puzzled'); }
    catch (err) { setError(err instanceof Error ? err.message : 'The spell fizzled. Please try again.'); }
    finally { setBusy(false); }
  }

  async function toggleHint() {
    if (purchasedHint) { const next = !hintOpen; setHintOpen(next); updateMood(next ? 'thinking' : 'neutral'); return; }
    if (!game?.question || hintBusy) return;
    setHintBusy(true); setError(''); updateMood('thinking');
    try { const result = await onRequestHint(game.solved_count); setPurchasedHint(result); setHintOpen(true); }
    catch (err) { setError(err instanceof Error ? err.message : 'The Wizard could not reveal a hint.'); updateMood('puzzled'); }
    finally { setHintBusy(false); }
  }

  function advance() {
    if (!feedback) return;
    if (feedback.game.completed) onLevelComplete(feedback.game);
    else { setFeedback(null); setSelected(null); setHintOpen(false); setPurchasedHint(null); updateMood('neutral'); }
  }

  return <AnimatePresence>{open && (
    <motion.div className="backdrop" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onMouseDown={event => event.target === event.currentTarget && onClose()}>
      <motion.section className="quiz-scroll" initial={{ opacity: 0, y: 28, scale: .97 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 20, scale: .98 }} role="dialog" aria-modal="true" aria-label={level?.title || 'Level quiz'}>
        <header><button className="close" onClick={onClose} aria-label="Close level">×</button><div className="progress"><i style={{ width: game ? `${Math.min(100, ((game.solved_count + (feedback?.correct ? 1 : 0)) / game.total) * 100)}%` : '0%' }} /></div><span>{game ? `${Math.min(game.solved_count + 1, game.total)} / ${game.total}` : '—'}</span></header>

        {loading || !game || !level ? <div className="loading">The Wizard is preparing your trial…</div> : <>
          <button className={`hint-banner ${hintOpen ? 'open' : ''}`} onClick={toggleHint} disabled={hintBusy || game.completed}>
            <div className={`wizard-face ${mood}`}><span /></div>
            <div><b>{level.isFinal ? 'Wise Wizard’s Whisper' : 'Wizard Hint'} · 2 💎</b><p>{hintBusy ? 'The Wizard is studying the runes…' : hintOpen ? purchasedHint?.content : 'Spend 2 gems to reveal a clue for this question.'}</p>{purchasedHint && <small>{purchasedHint.remaining_gems} gems remaining</small>}</div>
            <strong>{hintBusy ? '…' : hintOpen ? '−' : '+'}</strong>
          </button>

          <div className="quest-heading"><span>{level.isFinal ? 'Roleplay boss encounter' : `${game.difficulty} concept trial`}</span><h2>{level.isFinal ? `Deep within the Great Archive of ${level.title}…` : level.title}</h2>{level.isFinal && <p>The final guardian blocks the road. Choose the artifact that restores the knowledge rune.</p>}</div>

          {game.completed && !feedback ? <div className="already-complete"><span>🏆</span><h3>Trail already mastered</h3><p>You can review this lesson or return to the map.</p><button onClick={() => onLevelComplete(game)}>View milestone</button></div> : game.question && <>
            <h3 className="prompt">{game.question.prompt}</h3>
            <div className="options">{game.question.options.map((option, index) => {
              const isSelected = selected === index;
              const state = feedback ? feedback.correct && isSelected ? 'correct' : !feedback.correct && isSelected ? 'wrong' : '' : '';
              return <button key={`${option}-${index}`} disabled={Boolean(feedback)} className={`${isSelected ? 'selected' : ''} ${state}`} onClick={() => setSelected(index)}><i>{String.fromCharCode(65 + index)}</i><span>{option}</span>{isSelected && <b>{state === 'correct' ? '✓' : state === 'wrong' ? '×' : '●'}</b>}</button>;
            })}</div>
            <p className="source">From {game.question.source}{game.question.page ? ` · page ${game.question.page}` : ''}</p>
          </>}

          {error && <p className="error" role="alert">{error}</p>}
          <AnimatePresence>{feedback && <motion.div className={`feedback ${feedback.correct ? 'correct' : 'wrong'}`} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}><div className="feedback-icon">{feedback.correct ? '✦' : '↻'}</div><div><b>{feedback.correct ? 'Rune restored!' : 'Not quite—your map just improved.'}</b><p>{feedback.explanation}</p></div>{feedback.correct ? <button onClick={advance}>{feedback.game.completed ? 'Claim milestone' : 'Next question'} →</button> : <button onClick={() => { setFeedback(null); setSelected(null); updateMood('thinking'); }}>Try again</button>}</motion.div>}</AnimatePresence>
          {!feedback && !game.completed && <button className="submit" disabled={selected === null || busy} onClick={checkAnswer}>{busy ? 'Consulting the runes…' : level.isFinal ? 'Cast Spell & Check Answer' : 'Check Answer'}</button>}
        </>}
      </motion.section>
      <style jsx global>{`
        .backdrop{position:fixed;inset:0;z-index:100;display:grid;place-items:center;padding:22px;background:rgba(42,30,23,.68);backdrop-filter:blur(5px)}
        .quiz-scroll{width:min(680px,100%);max-height:92vh;overflow:auto;padding:24px 30px 30px;border:2px solid #8a6842;border-radius:24px;background:#fffaf0;color:#34271d;box-shadow:0 28px 80px rgba(30,19,10,.45)}
        .quiz-scroll>header{display:flex;align-items:center;gap:16px}.close{width:36px;height:36px;border:1px solid #dac9a4;border-radius:50%;background:#fff5dd;color:#775b3e;font-size:22px}.progress{flex:1;height:10px;overflow:hidden;border-radius:999px;background:#dfd7c5}.progress i{display:block;height:100%;border-radius:inherit;background:linear-gradient(90deg,#3fa968,#78c66a);transition:width .35s}.quiz-scroll header>span{color:#856d51;font-size:11px;font-weight:800}
        .hint-banner{display:flex;align-items:center;gap:12px;width:100%;margin:20px 0;padding:12px 14px;border:1px solid #c9c6ed;border-radius:15px;background:#eeefff;color:#37316f;text-align:left}.hint-banner:hover:not(:disabled){border-color:#8980ce}.hint-banner:disabled{cursor:not-allowed;opacity:.72}.hint-banner>div:nth-child(2){flex:1}.hint-banner b{display:block;color:#6154bd;font-size:10px;letter-spacing:.08em;text-transform:uppercase}.hint-banner p{margin-top:3px;font-size:11px;line-height:1.4}.hint-banner small{display:block;margin-top:4px;color:#786ea8;font-size:9px;font-weight:800}.hint-banner>strong{font-size:18px}.wizard-face{position:relative;flex:0 0 52px;height:52px;overflow:hidden;border-radius:12px;background:#dedcff}.wizard-face span{position:absolute;inset:0;background-image:url('/sprites/wizard-idle.png');background-size:1092px 104px;background-position:0 0;background-repeat:no-repeat;animation:quiz-wizard-idle 2.1s steps(21) infinite}.wizard-face.thinking span{background-image:url('/sprites/wizard-jump.png');animation:quiz-wizard-jump 1.25s steps(21) infinite}.wizard-face.celebrating span{background-image:url('/sprites/wizard-attack.png');animation:quiz-wizard-attack 1.05s steps(21) infinite}.wizard-face.puzzled span{animation:quiz-wizard-idle 2.1s steps(21) infinite,puzzle .5s ease-in-out infinite alternate}
        .quest-heading>span{color:#987240;font-size:10px;font-weight:900;letter-spacing:.12em;text-transform:uppercase}.quest-heading h2{margin-top:5px;font-family:Georgia,serif;font-size:23px;line-height:1.2}.quest-heading p{margin-top:7px;color:#80694e;font-size:12px;line-height:1.5}.prompt{margin:22px 0 15px;font-size:17px;line-height:1.45}.options{display:grid;gap:10px}.options button{display:flex;align-items:center;gap:12px;min-height:54px;padding:10px 14px;border:2px solid #ded3bd;border-radius:13px;background:#fffdf7;color:#453424;text-align:left;transition:.16s}.options button:not(:disabled):hover,.options button.selected{border-color:#699d70;background:#f1f8ec;transform:translateY(-1px)}.options button.correct{border-color:#3e9e64;background:#e8f7e9}.options button.wrong{border-color:#bd6054;background:#fff0ec}.options i{display:grid;place-items:center;flex:0 0 29px;height:29px;border:1px solid #b8a98d;border-radius:50%;font-size:11px;font-style:normal;font-weight:900}.options span{flex:1;font-size:13px;font-weight:650}.options b{font-size:18px}.source{margin:12px 2px;color:#9a866d;font-size:10px}.submit,.already-complete button{width:100%;min-height:50px;margin-top:20px;border:0;border-radius:13px;background:linear-gradient(#35b875,#248a59);color:#fff;box-shadow:0 5px 0 #176c43;font-weight:900}.submit:disabled{background:#b9b7ab;box-shadow:0 5px 0 #969388;cursor:not-allowed}.feedback{display:grid;grid-template-columns:auto 1fr;gap:11px;margin-top:18px;padding:15px;border:1px solid #aad0b2;border-radius:14px;background:#eaf7e9}.feedback.wrong{border-color:#e0b0a6;background:#fff0ec}.feedback-icon{display:grid;place-items:center;width:35px;height:35px;border-radius:50%;background:#3d9f63;color:white}.feedback.wrong .feedback-icon{background:#b5574b}.feedback b{font-size:13px}.feedback p{margin-top:4px;color:#6f5a43;font-size:11px;line-height:1.45}.feedback button{grid-column:2;width:max-content;margin-top:2px;padding:7px 12px;border:0;border-radius:8px;background:#3b8057;color:white;font-size:11px;font-weight:800}.already-complete{text-align:center;padding:30px 10px}.already-complete>span{font-size:50px}.already-complete h3{font-family:Georgia,serif;font-size:22px}.already-complete p{margin-top:6px;color:#806b52;font-size:12px}.error{margin-top:12px;color:#a43f35;font-size:12px}.loading{padding:65px 20px;text-align:center;color:#806b52}
        @keyframes quiz-wizard-idle{to{background-position-x:-1092px}}@keyframes quiz-wizard-jump{to{background-position-x:-1092px}}@keyframes quiz-wizard-attack{to{background-position-x:-1092px}}@keyframes puzzle{to{transform:rotate(-5deg)}}
        @media(max-width:600px){.backdrop{padding:0}.quiz-scroll{align-self:end;max-height:95vh;padding:18px;border-radius:22px 22px 0 0}.quest-heading h2{font-size:20px}.prompt{font-size:15px}.options button{min-height:50px}}@media(prefers-reduced-motion:reduce){.wizard-face span{animation:none}}
      `}</style>
    </motion.div>
  )}</AnimatePresence>;
}
