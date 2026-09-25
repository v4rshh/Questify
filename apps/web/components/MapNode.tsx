'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { useState } from 'react';
import type { AdventureProgress, EnemyKind, MapLevel, MapPoint } from './quest-map.types';

const enemies: Record<EnemyKind, string> = {
  eye: '/sprites/enemy-eye.png',
  fleshmaw: '/sprites/enemy-fleshmaw.png',
  hornbrute: '/sprites/enemy-hornbrute.png',
};

interface LevelProps {
  kind?: 'level';
  level: MapLevel;
  progress?: AdventureProgress;
  defeated?: boolean;
  onOpen: (level: MapLevel) => void;
}

interface TreasureProps {
  kind: 'treasure';
  point: MapPoint;
  claimed: boolean;
  unlocked: boolean;
  onTreasure: () => void;
}

export default function MapNode(props: LevelProps | TreasureProps) {
  const [summary, setSummary] = useState(false);
  if (props.kind === 'treasure') {
    return (
      <motion.button
        className={`treasure ${props.claimed ? 'claimed' : ''} ${props.unlocked ? 'ready' : ''}`}
        style={{ left: props.point.x - 39, top: props.point.y - 42 }}
        onClick={props.onTreasure}
        whileHover={props.unlocked ? { y: -6, rotate: [-2, 2, 0] } : undefined}
        disabled={!props.unlocked}
        aria-label={props.claimed ? 'Treasure claimed' : 'Treasure chest'}
      >
        <span>{props.claimed ? '✨' : '🧰'}</span><b>{props.claimed ? 'Claimed' : 'Bonus cache'}</b>
        <style jsx global>{`
          .treasure{position:absolute;z-index:8;width:78px;height:78px;border:0;background:transparent;color:#68461f;filter:drop-shadow(0 7px 3px rgba(69,43,17,.18))}
          .treasure span{display:block;font-size:45px;line-height:1;filter:saturate(.8)}.treasure b{display:block;margin-top:4px;padding:2px 6px;border-radius:999px;background:#fff2bf;font-size:9px;white-space:nowrap}
          .treasure:disabled{cursor:not-allowed;filter:grayscale(1);opacity:.55}.treasure.ready:not(.claimed) span{animation:chest-ready 1.3s ease-in-out infinite}
          @keyframes chest-ready{50%{transform:translateY(-5px) scale(1.05)}}
        `}</style>
      </motion.button>
    );
  }

  const { level, progress, defeated } = props;
  const complete = level.status === 'completed';
  const locked = level.status === 'locked';
  const mistakes = progress?.mistakes.length || 0;
  return (
    <div className="node-wrap" style={{ left: level.x - 47, top: level.y - 47 }}>
      {level.enemy && !defeated && (
        <motion.img className={`enemy ${level.enemy}`} src={enemies[level.enemy]} alt={`${level.enemy} enemy`} initial={{ y: 3 }} animate={{ y: [3, -3, 3] }} transition={{ repeat: Infinity, duration: 1.5 }} />
      )}
      <motion.button
        className={`node ${level.status} ${level.isFinal ? 'final' : ''}`}
        onClick={() => !locked && props.onOpen(level)}
        whileHover={!locked ? { y: -5, scale: 1.04 } : undefined}
        whileTap={!locked ? { scale: .95 } : undefined}
        aria-label={`${level.title}, ${level.status}`}
      >
        <span className="node-icon">{locked ? '🔒' : level.isFinal ? '⚔' : complete ? '✓' : level.localIndex + 1}</span>
        {complete && <span className="stars">★ ★ ★</span>}
      </motion.button>
      <div className="node-label"><small>{level.isFinal ? 'World final' : `Level ${level.level_index}`}</small><strong>{level.title}</strong></div>
      <button className="progress-button" onClick={() => setSummary(value => !value)} aria-label={`Show ${level.title} progress`}>
        <i style={{ width: `${level.mastery_score}%` }} /><span>{Math.round(level.mastery_score)}%</span>
      </button>
      <AnimatePresence>
        {summary && (
          <motion.div className="summary" initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 4 }}>
            <button onClick={() => setSummary(false)}>×</button><b>{level.title}</b>
            <p>{complete ? 'Trail mastered.' : locked ? 'Complete the previous stop to unlock this trail.' : 'This trail is ready for you.'}</p>
            <span>{mistakes ? `${mistakes} mistake${mistakes === 1 ? '' : 's'} recorded` : 'No mistakes recorded yet'}</span>
          </motion.div>
        )}
      </AnimatePresence>
      <style jsx global>{`
        .node-wrap{position:absolute;z-index:9;width:94px;text-align:center}
        .node{position:relative;width:82px;height:64px;border:3px solid #6b4b2b;border-radius:50%;background:linear-gradient(#efe0ad,#c49a5b);color:#4a321f;box-shadow:0 7px 0 #7d5834,0 10px 15px rgba(65,43,23,.24);font-weight:900}
        .node.unlocked{border-color:#315d46;background:linear-gradient(#8ecf72,#4c955d);color:#fff;box-shadow:0 7px 0 #294d3a,0 0 0 8px rgba(100,169,101,.13),0 11px 18px rgba(45,78,52,.26);animation:node-pulse 2s infinite}
        .node.completed{border-color:#9a6b24;background:linear-gradient(#ffd661,#e8a832);color:#684010;box-shadow:0 7px 0 #926322,0 11px 16px rgba(87,57,15,.22)}
        .node.locked{filter:grayscale(.75);opacity:.72;cursor:not-allowed}.node.final{border-radius:18px;border-color:#6b3d32;background:linear-gradient(#ce7056,#8f3f37);color:white;box-shadow:0 7px 0 #60312c,0 11px 16px rgba(82,39,34,.28)}
        .node-icon{font-size:20px;text-shadow:0 1px white}.stars{position:absolute;left:50%;bottom:4px;transform:translateX(-50%);font-size:8px;white-space:nowrap}
        .node-label{position:absolute;left:50%;top:72px;transform:translateX(-50%);width:145px;padding:6px 8px;border:1px solid rgba(112,79,43,.28);border-radius:8px;background:rgba(255,248,222,.94);box-shadow:0 3px 8px rgba(67,45,25,.1)}
        .node-label small{display:block;color:#987446;font-size:8px;text-transform:uppercase;letter-spacing:.08em}.node-label strong{display:block;overflow:hidden;color:#49311f;font-size:10px;line-height:1.25;white-space:nowrap;text-overflow:ellipsis}
        .progress-button{position:absolute;left:7px;top:105px;width:80px;height:14px;overflow:hidden;border:1px solid #8b6a42;border-radius:999px;background:#ddcfaa;color:#47311f;font-size:7px}
        .progress-button i{position:absolute;inset:0 auto 0 0;background:#4d9060}.progress-button span{position:relative;z-index:1;font-weight:900;text-shadow:0 1px rgba(255,255,255,.7)}
        .summary{position:absolute;z-index:30;left:50%;top:128px;width:210px;transform:translateX(-50%)!important;padding:12px;border:2px solid #60452d;border-radius:12px;background:#fff8df;color:#49321f;text-align:left;box-shadow:0 12px 30px rgba(54,35,18,.24)}
        .summary:before{content:'';position:absolute;left:50%;top:-7px;width:11px;height:11px;background:#fff8df;border-left:2px solid #60452d;border-top:2px solid #60452d;transform:translateX(-50%) rotate(45deg)}
        .summary button{position:absolute;right:7px;top:4px;border:0;background:transparent}.summary b{display:block;padding-right:15px;font-size:12px}.summary p,.summary span{display:block;margin-top:5px;color:#73583a;font-size:10px;line-height:1.35}
        .enemy{position:absolute;z-index:4;right:-48px;top:-48px;width:66px;height:66px;object-fit:contain;image-rendering:pixelated;filter:drop-shadow(0 6px 3px rgba(59,21,22,.25))}.enemy.fleshmaw{width:82px;height:82px;right:-62px;top:-63px}.enemy.hornbrute{width:74px;height:74px;right:-54px;top:-56px}
        @keyframes node-pulse{50%{box-shadow:0 7px 0 #294d3a,0 0 0 14px rgba(100,169,101,0),0 11px 18px rgba(45,78,52,.26)}}
        @media(prefers-reduced-motion:reduce){.node.unlocked{animation:none}}
      `}</style>
    </div>
  );
}
