'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { useEffect, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import type { WizardHelp, WizardMood } from './quest-map.types';

const copy: Record<WizardMood, string> = {
  neutral: 'Gems buy Wizard hints and full explanations. XP from correct answers and milestones raises your mastery tier.',
  thinking: 'Trace the prerequisite runes: every unlocked concept builds on the path behind it.',
  celebrating: 'Splendid work! Your knowledge is becoming a legend worth telling.',
  puzzled: 'A wrong turn is still a map. Ask for a hint, then try the spell once more.',
};

interface Props {
  mood?: WizardMood;
  concept?: string;
  gemCost?: number;
  onAsk?: () => Promise<WizardHelp>;
}

export default function WizardDialogueBox({ mood = 'neutral', concept, gemCost = 5, onAsk }: Props) {
  const [open, setOpen] = useState(true);
  const [help, setHelp] = useState<WizardHelp | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => { setHelp(null); setError(''); }, [concept]);

  async function askWizard() {
    if (!onAsk || busy) { setOpen(value => !value); return; }
    setBusy(true); setError(''); setOpen(true);
    try { setHelp(await onAsk()); }
    catch (err) { setError(err instanceof Error ? err.message : 'The Wizard could not answer right now.'); }
    finally { setBusy(false); }
  }

  return (
    <div className="wizard-wrap">
      <AnimatePresence>
        {open && (
          <motion.div className="wizard-bubble" initial={{ opacity: 0, x: -12, scale: .96 }} animate={{ opacity: 1, x: 0, scale: 1 }} exit={{ opacity: 0, scale: .94 }} role="status">
            <button onClick={() => setOpen(false)} aria-label="Close wizard explanation">×</button>
            <b>{help?.title || (mood === 'celebrating' ? 'Path cleared!' : 'Sage’s field note')}</b>
            {error ? <p className="wizard-error">{error}</p> : help ? <div className="wizard-markdown"><ReactMarkdown remarkPlugins={[remarkGfm]}>{help.content}</ReactMarkdown><small>−{help.cost} gems · {help.remaining_gems} remaining</small></div> : <p>{concept ? `${concept}: ` : ''}{copy[mood]}</p>}
          </motion.div>
        )}
      </AnimatePresence>
      <motion.button className={`wizard-token ${mood}`} onClick={askWizard} disabled={busy} whileHover={{ y: -4 }} whileTap={{ scale: .94 }} aria-label={`Ask the AI Wizard for the full concept. Costs ${gemCost} gems.`}>
        <span />
        <i>{busy ? 'Conjuring…' : `Full concept · ${gemCost} 💎`}</i>
      </motion.button>
      <style jsx global>{`
        .wizard-wrap{position:absolute;left:22px;bottom:18px;z-index:25;display:flex;align-items:flex-end;gap:8px;pointer-events:none}
        .wizard-bubble{position:relative;width:min(430px,calc(100vw - 150px));max-height:285px;overflow:auto;margin-bottom:40px;padding:14px 30px 14px 16px;border:2px solid #5d4631;border-radius:18px 18px 18px 4px;background:#fff7dc;color:#4b3623;box-shadow:0 8px 0 rgba(100,70,37,.14);pointer-events:auto}
        .wizard-bubble:after{content:'';position:absolute;left:12px;bottom:-10px;width:18px;height:18px;background:#fff7dc;border-right:2px solid #5d4631;border-bottom:2px solid #5d4631;transform:rotate(45deg)}
        .wizard-bubble>button{position:absolute;right:8px;top:5px;border:0;background:transparent;color:#7d6348;font-size:18px}
        .wizard-bubble>b{display:block;padding-right:12px;color:#6844a7;font-size:11px;letter-spacing:.08em;text-transform:uppercase}
        .wizard-bubble p,.wizard-markdown{margin-top:5px;font:600 12px/1.5 ui-sans-serif,system-ui}.wizard-markdown p{margin:6px 0}.wizard-markdown ul,.wizard-markdown ol{margin:6px 0;padding-left:18px}.wizard-markdown h1,.wizard-markdown h2,.wizard-markdown h3{margin:10px 0 4px;font-family:Georgia,serif}.wizard-markdown small{display:block;margin-top:10px;color:#7659a8;font-size:10px;font-weight:800}.wizard-error{color:#a33c35}
        .wizard-token{position:relative;width:112px;height:116px;border:0;background:transparent;pointer-events:auto}.wizard-token:disabled{opacity:.7}
        .wizard-token>span{position:absolute;left:14px;top:0;width:84px;height:84px;background-image:url('/sprites/wizard-idle.png');background-size:1764px 168px;background-position:0 0;background-repeat:no-repeat;image-rendering:auto;filter:drop-shadow(0 7px 4px rgba(46,31,72,.25));animation:wizard-idle-frames 2.1s steps(21) infinite}
        .wizard-token.thinking>span{background-image:url('/sprites/wizard-jump.png');animation:wizard-jump-frames 1.25s steps(21) infinite}.wizard-token.celebrating>span{background-image:url('/sprites/wizard-attack.png');animation:wizard-attack-frames 1.05s steps(21) infinite}.wizard-token.puzzled>span{animation:wizard-idle-frames 2.1s steps(21) infinite,wizard-puzzle .65s ease-in-out infinite alternate}
        .wizard-token i{position:absolute;bottom:0;left:50%;transform:translateX(-50%);padding:4px 8px;border-radius:999px;background:#493b69;color:white;font:700 9px/1 ui-sans-serif,system-ui;white-space:nowrap;font-style:normal}
        @keyframes wizard-idle-frames{to{background-position-x:-1764px}}@keyframes wizard-jump-frames{to{background-position-x:-1764px}}@keyframes wizard-attack-frames{to{background-position-x:-1764px}}@keyframes wizard-puzzle{to{transform:rotate(-4deg)}}
        @media(max-width:700px){.wizard-wrap{position:fixed;left:10px;bottom:78px}.wizard-bubble{width:min(310px,calc(100vw - 115px))}}
        @media(prefers-reduced-motion:reduce){.wizard-token>span{animation:none}}
      `}</style>
    </div>
  );
}
