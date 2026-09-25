'use client';

import { motion } from 'framer-motion';
import type { MapPoint } from './quest-map.types';

export type AvatarAction = 'idle' | 'walking' | 'attacking';

export default function AvatarToken({ point, action = 'idle' }: { point: MapPoint; action?: AvatarAction }) {
  return (
    <motion.div
      className="avatar-token"
      initial={false}
      animate={{ x: point.x - 36, y: point.y - 74, scale: action === 'attacking' ? [1, 1.12, 1] : 1 }}
      transition={{ x: { duration: action === 'walking' ? 1.05 : .35, ease: 'easeInOut' }, y: { duration: action === 'walking' ? 1.05 : .35, ease: 'easeInOut' }, scale: { duration: .45 } }}
      aria-label={`Player is ${action}`}
    >
      <div className={`hero-sprite ${action}`} />
      <span>{action === 'attacking' ? 'Battle!' : action === 'walking' ? 'Onward!' : 'You'}</span>
      <style jsx global>{`
        .avatar-token{position:absolute;z-index:18;left:0;top:0;width:72px;height:84px;pointer-events:none;filter:drop-shadow(0 8px 5px rgba(63,43,24,.22))}
        .hero-sprite{width:72px;height:72px;background-repeat:no-repeat;background-size:576px 72px;image-rendering:pixelated;animation:hero-frames 1s steps(8) infinite}
        .hero-sprite.idle{background-image:url('/sprites/hero-idle.png');animation-duration:1.5s}
        .hero-sprite.walking{background-image:url('/sprites/hero-move.png');animation-duration:.72s}
        .hero-sprite.attacking{background-image:url('/sprites/hero-attack.png');animation-duration:.55s}
        .avatar-token>span{position:absolute;left:50%;bottom:-2px;transform:translateX(-50%);padding:2px 7px;border:1px solid #9f7a45;border-radius:999px;background:#fff6d8;color:#5d4025;font:800 9px/1.3 ui-sans-serif,system-ui;white-space:nowrap;box-shadow:0 2px 5px rgba(74,48,22,.16)}
        @keyframes hero-frames{from{background-position-x:0}to{background-position-x:-576px}}
        @media (prefers-reduced-motion:reduce){.hero-sprite{animation:none}}
      `}</style>
    </motion.div>
  );
}
