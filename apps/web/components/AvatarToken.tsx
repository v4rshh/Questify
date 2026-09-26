'use client';

import { motion, useReducedMotion } from 'framer-motion';
import type { CSSProperties } from 'react';
import type { MapPoint } from './quest-map.types';

export type AvatarAction = 'idle' | 'walking' | 'running' | 'attacking' | 'attack2' | 'runAttacking' | 'defending' | 'hurt' | 'jumping';

const animations: Record<AvatarAction, { sheet: string; frames: number; duration: number }> = {
  idle: { sheet: 'idle.png', frames: 4, duration: 920 },
  walking: { sheet: 'walk.png', frames: 8, duration: 760 },
  running: { sheet: 'run.png', frames: 7, duration: 560 },
  attacking: { sheet: 'attack-1.png', frames: 5, duration: 480 },
  attack2: { sheet: 'attack-2.png', frames: 4, duration: 440 },
  runAttacking: { sheet: 'run-attack.png', frames: 6, duration: 540 },
  defending: { sheet: 'defend.png', frames: 5, duration: 700 },
  hurt: { sheet: 'hurt.png', frames: 2, duration: 380 },
  jumping: { sheet: 'jump.png', frames: 6, duration: 650 },
};

export default function AvatarToken({ point, action = 'idle' }: { point: MapPoint; action?: AvatarAction }) {
  const reduceMotion = useReducedMotion();
  const animation = animations[action];
  const moving = action === 'walking' || action === 'running' || action === 'runAttacking';
  const style = {
    '--hero-sheet': `url('/sprites/hero-knight/${animation.sheet}')`,
    '--hero-frames': animation.frames,
    '--hero-duration': `${animation.duration}ms`,
    '--hero-sheet-width': `${animation.frames * 104}px`,
    '--hero-end': `${animation.frames * -104}px`,
    animationPlayState: reduceMotion ? 'paused' : 'running',
  } as CSSProperties;

  return (
    <motion.div
      className="avatar-token"
      initial={false}
      animate={{ x: point.x - 52, y: point.y - 94, scale: action === 'attacking' || action === 'attack2' ? [1, 1.08, 1] : 1 }}
      transition={{ x: { duration: moving ? .9 : .3, ease: 'easeInOut' }, y: { duration: moving ? .9 : .3, ease: 'easeInOut' }, scale: { duration: .45 } }}
      aria-label={`Player is ${action}`}
    >
      <div className="hero-frame" style={style} />
      <span>{action.toLowerCase().includes('attack') ? 'Battle!' : moving ? 'Onward!' : 'You'}</span>
      <style jsx global>{`
        .avatar-token{position:absolute;z-index:18;left:0;top:0;width:104px;height:112px;pointer-events:none;filter:drop-shadow(0 8px 5px rgba(28,39,58,.3))}
        .hero-frame{width:104px;height:104px;background-image:var(--hero-sheet);background-size:var(--hero-sheet-width) 104px;background-position:0 0;background-repeat:no-repeat;image-rendering:pixelated;animation:hero-knight-frames var(--hero-duration) steps(var(--hero-frames)) infinite}
        .avatar-token>span{position:absolute;left:50%;bottom:-2px;transform:translateX(-50%);padding:2px 7px;border:1px solid #9f7a45;border-radius:999px;background:#fff6d8;color:#5d4025;font:800 9px/1.3 ui-sans-serif,system-ui;white-space:nowrap;box-shadow:0 2px 5px rgba(74,48,22,.16)}
        @keyframes hero-knight-frames{to{background-position-x:var(--hero-end)}}
        @media(prefers-reduced-motion:reduce){.hero-frame{animation:none}}
      `}</style>
    </motion.div>
  );
}
