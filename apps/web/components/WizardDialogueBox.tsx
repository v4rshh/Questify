'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { useState } from 'react';
import type { WizardMood } from './quest-map.types';

const copy: Record<WizardMood, string> = {
  neutral: 'The trail follows your source from foundations to mastery. Choose the glowing stop to continue.',
  thinking: 'Trace the prerequisite runes: every unlocked concept builds on the path behind it.',
  celebrating: 'Splendid work! Your knowledge is becoming a legend worth telling.',
  puzzled: 'A wrong turn is still a map. Revisit the hint, then try the spell once more.',
};

export default function WizardDialogueBox({ mood = 'neutral', concept }: { mood?: WizardMood; concept?: string }) {
  const [open, setOpen] = useState(true);
  return (
    <div className="wizard-wrap">
      <AnimatePresence>
        {open && (
          <motion.div className="wizard-bubble" initial={{ opacity: 0, x: -12, scale: .96 }} animate={{ opacity: 1, x: 0, scale: 1 }} exit={{ opacity: 0, scale: .94 }}>
            <button onClick={() => setOpen(false)} aria-label="Close wizard tip">×</button>
            <b>{mood === 'thinking' ? 'Concept trail' : mood === 'celebrating' ? 'Path cleared!' : mood === 'puzzled' ? 'Try this' : 'Sage’s field note'}</b>
            <p>{concept ? `${concept}: ` : ''}{copy[mood]}</p>
          </motion.div>
        )}
      </AnimatePresence>
      <motion.button className={`wizard-token ${mood}`} onClick={() => setOpen(value => !value)} whileHover={{ y: -4 }} whileTap={{ scale: .94 }} aria-label="Ask the AI Wizard for a map tip">
        <span />
        <i>{open ? 'Hide guide' : 'Ask Sage'}</i>
      </motion.button>
      <style jsx global>{`
        .wizard-wrap{position:absolute;left:22px;bottom:18px;z-index:25;display:flex;align-items:flex-end;gap:8px;pointer-events:none}
        .wizard-bubble{position:relative;width:min(310px,calc(100vw - 150px));margin-bottom:40px;padding:14px 30px 14px 16px;border:2px solid #5d4631;border-radius:18px 18px 18px 4px;background:#fff7dc;color:#4b3623;box-shadow:0 8px 0 rgba(100,70,37,.14);pointer-events:auto}
        .wizard-bubble:after{content:'';position:absolute;left:12px;bottom:-10px;width:18px;height:18px;background:#fff7dc;border-right:2px solid #5d4631;border-bottom:2px solid #5d4631;transform:rotate(45deg)}
        .wizard-bubble button{position:absolute;right:8px;top:5px;border:0;background:transparent;color:#7d6348;font-size:18px}
        .wizard-bubble b{display:block;color:#6844a7;font-size:11px;letter-spacing:.08em;text-transform:uppercase}
        .wizard-bubble p{margin-top:5px;font:600 12px/1.45 ui-sans-serif,system-ui}
        .wizard-token{position:relative;width:92px;height:106px;border:0;background:transparent;pointer-events:auto}
        .wizard-token>span{position:absolute;inset:0 10px 22px;background-image:url('/sprites/wizard-idle.png');background-size:256px 224px;background-position:center bottom;background-repeat:no-repeat;image-rendering:pixelated;filter:drop-shadow(0 7px 4px rgba(46,31,72,.25))}
        .wizard-token.thinking>span{animation:wizard-think 1s ease-in-out infinite}
        .wizard-token.celebrating>span{background-image:url('/sprites/wizard-attack.png');background-size:512px 56px;background-position:0 center;animation:wizard-cast .75s steps(8) infinite}
        .wizard-token.puzzled>span{animation:wizard-puzzle .65s ease-in-out infinite alternate}
        .wizard-token i{position:absolute;bottom:0;left:50%;transform:translateX(-50%);padding:3px 8px;border-radius:999px;background:#493b69;color:white;font:700 9px/1 ui-sans-serif,system-ui;white-space:nowrap;font-style:normal}
        @keyframes wizard-cast{to{background-position-x:-512px}}
        @keyframes wizard-think{50%{transform:translateY(-5px)}}
        @keyframes wizard-puzzle{to{transform:rotate(-4deg)}}
        @media(max-width:700px){.wizard-wrap{position:fixed;left:10px;bottom:78px}.wizard-bubble{width:min(250px,calc(100vw - 115px))}}
      `}</style>
    </div>
  );
}
