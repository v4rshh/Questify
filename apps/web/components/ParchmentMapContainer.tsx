'use client';

import { useMemo } from 'react';
import AvatarToken, { type AvatarAction } from './AvatarToken';
import MapNode from './MapNode';
import WizardDialogueBox from './WizardDialogueBox';
import type { AdventureProgress, EnemyKind, Level, MapLevel, WizardMood } from './quest-map.types';

const yPattern = [318, 218, 286, 182, 304, 226];
const enemyPattern: EnemyKind[] = ['eye', 'fleshmaw', 'hornbrute'];

export function buildMapLevels(nodes: Level[], perWorld = 5): MapLevel[] {
  return nodes.map((node, index) => {
    const displayWorld = Math.floor(index / perWorld) + 1;
    const localIndex = index % perWorld;
    const groupEnd = Math.min(nodes.length, displayWorld * perWorld) - 1;
    const status = node.mastery_score >= 100 ? 'completed' : node.is_unlocked ? 'unlocked' : 'locked';
    return {
      ...node,
      x: 180 + index * 190,
      y: yPattern[index % yPattern.length],
      displayWorld,
      localIndex,
      status,
      isFinal: index === groupEnd,
      isTreasureGate: index === groupEnd - 1,
      enemy: localIndex > 0 && localIndex < (groupEnd % perWorld) && localIndex % 2 === 0 ? enemyPattern[(displayWorld + localIndex) % enemyPattern.length] : undefined,
    };
  });
}

function smoothPath(levels: MapLevel[]) {
  if (!levels.length) return '';
  return levels.slice(1).reduce((path, point, index) => {
    const previous = levels[index];
    const mid = (previous.x + point.x) / 2;
    return `${path} C ${mid} ${previous.y}, ${mid} ${point.y}, ${point.x} ${point.y}`;
  }, `M ${levels[0].x} ${levels[0].y}`);
}

interface Props {
  nodes: Level[];
  progress: Record<string, AdventureProgress | undefined>;
  activeLevelId?: string;
  avatarPoint?: { x: number; y: number };
  avatarAction?: AvatarAction;
  defeatedEnemies: Set<string>;
  wizardMood: WizardMood;
  onOpenLevel: (level: MapLevel) => void;
  onTreasure: (level: MapLevel) => void;
}

export default function ParchmentMapContainer({ nodes, progress, activeLevelId, avatarPoint, avatarAction = 'idle', defeatedEnemies, wizardMood, onOpenLevel, onTreasure }: Props) {
  const levels = useMemo(() => buildMapLevels(nodes), [nodes]);
  const width = Math.max(1080, (levels.at(-1)?.x || 800) + 230);
  const groups = Array.from(new Set(levels.map(level => level.displayWorld))).map(world => levels.filter(level => level.displayWorld === world));
  const current = levels.find(level => level.id === activeLevelId) || levels.find(level => level.status === 'unlocked') || levels[0];
  const point = avatarPoint || current || { x: 180, y: 318 };
  return (
    <section className="map-viewport" aria-label="Interactive learning path">
      <div className="parchment" style={{ width }}>
        <div className="paper-grain" />
        {groups.map((group, index) => {
          const left = group[0].x - 120;
          const right = group[group.length - 1].x + 120;
          return <div className={`world-region world-${(index % 3) + 1}`} key={index} style={{ left, width: right - left }}><div className="world-banner"><span>World {index + 1}</span><b>{group[0].title}</b><small>{group.length} trials · {group.filter(level => level.status === 'completed').length} cleared</small></div></div>;
        })}
        <svg className="trail" viewBox={`0 0 ${width} 510`} preserveAspectRatio="none" aria-hidden="true">
          <path className="trail-shadow" d={smoothPath(levels)} />
          <path className="trail-line" d={smoothPath(levels)} />
        </svg>
        {levels.map(level => <MapNode key={level.id} level={level} progress={progress[level.id]} defeated={defeatedEnemies.has(level.id)} onOpen={onOpenLevel} />)}
        {groups.filter(group => group.length > 2).map(group => {
          const final = group[group.length - 1]; const before = group[group.length - 2];
          const chestPoint = { x: before.x + (final.x - before.x) * .55, y: before.y + (final.y - before.y) * .55 - 2 };
          return <MapNode key={`treasure-${final.id}`} kind="treasure" point={chestPoint} claimed={Boolean(progress[final.id]?.treasure_claimed)} unlocked={final.status !== 'locked'} onTreasure={() => onTreasure(final)} />;
        })}
        <AvatarToken point={point} action={avatarAction} />
        <WizardDialogueBox mood={wizardMood} concept={current?.title} />
        <div className="legend"><span><i className="done" /> Mastered</span><span><i className="open" /> Current trail</span><span><i /> Locked</span></div>
      </div>
      <style jsx>{`
        .map-viewport{position:relative;min-height:535px;overflow-x:auto;overflow-y:hidden;border:1px solid #bba477;border-radius:22px;background:#c9b17e;box-shadow:inset 0 0 30px rgba(73,47,22,.22),0 14px 34px rgba(63,44,24,.12);scrollbar-color:#8b6a42 #d9c79d}
        .parchment{position:relative;height:535px;overflow:hidden;background-color:#f4ebd0;background-image:radial-gradient(circle at 18% 23%,rgba(139,105,54,.11) 0 1px,transparent 1.5px),radial-gradient(circle at 72% 65%,rgba(142,100,47,.08) 0 1px,transparent 1.5px),linear-gradient(90deg,rgba(255,255,255,.2),transparent 20%,rgba(112,76,35,.05) 70%,transparent);background-size:23px 23px,31px 31px,100% 100%}
        .parchment:before,.parchment:after{content:'';position:absolute;z-index:20;left:0;right:0;height:12px;background:linear-gradient(135deg,transparent 7px,#8e6d44 8px,#f4ebd0 10px) 0 0/26px 12px repeat-x;pointer-events:none}.parchment:before{top:0}.parchment:after{bottom:0;transform:rotate(180deg)}.paper-grain{position:absolute;inset:0;opacity:.3;pointer-events:none;background:repeating-linear-gradient(12deg,transparent 0 13px,rgba(111,79,42,.035) 14px)}
        .world-region{position:absolute;top:22px;height:466px;border:1px solid rgba(108,79,43,.2);border-radius:26px;background:rgba(255,249,224,.25);box-shadow:inset 0 0 40px rgba(255,255,255,.3)}.world-region.world-2{background:rgba(214,228,199,.28)}.world-region.world-3{background:rgba(225,210,234,.22)}
        .world-banner{position:absolute;left:18px;top:18px;display:flex;flex-direction:column;width:168px;padding:13px 15px;border:2px solid #425c42;border-radius:13px;background:linear-gradient(135deg,#476b4c,#2f4f3d);color:#fff;box-shadow:0 5px 0 #263d30}.world-2 .world-banner{border-color:#59418a;background:linear-gradient(135deg,#7257b5,#463476);box-shadow:0 5px 0 #37285e}.world-3 .world-banner{border-color:#8a5b35;background:linear-gradient(135deg,#b67740,#7d4c2a);box-shadow:0 5px 0 #60391f}.world-banner span{font-size:8px;font-weight:900;letter-spacing:.13em;text-transform:uppercase;opacity:.8}.world-banner b{margin-top:4px;overflow:hidden;font-family:Georgia,serif;font-size:14px;white-space:nowrap;text-overflow:ellipsis}.world-banner small{margin-top:3px;font-size:8px;opacity:.78}
        .trail{position:absolute;inset:0;width:100%;height:510px;overflow:visible}.trail path{fill:none;stroke-linecap:round;stroke-linejoin:round}.trail-shadow{stroke:rgba(255,255,255,.7);stroke-width:13}.trail-line{stroke:#624d35;stroke-width:5;stroke-dasharray:8 10;animation:trail-march 12s linear infinite}
        .legend{position:absolute;right:22px;bottom:20px;z-index:22;display:flex;gap:14px;padding:7px 10px;border:1px solid rgba(99,71,40,.25);border-radius:999px;background:rgba(255,249,226,.86);color:#664c32;font-size:8px;font-weight:800}.legend span{display:flex;align-items:center;gap:4px}.legend i{width:8px;height:8px;border-radius:50%;background:#9c9789}.legend i.done{background:#dda72e}.legend i.open{background:#4b9963}
        @keyframes trail-march{to{stroke-dashoffset:-180}}
        @media(max-width:700px){.map-viewport{min-height:510px;border-radius:16px}.parchment{height:510px}.legend{display:none}}
        @media(prefers-reduced-motion:reduce){.trail-line{animation:none}}
      `}</style>
    </section>
  );
}
