'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Sidebar from './Sidebar';
import Header from './Header';
import ParchmentMapContainer, { buildMapLevels } from './ParchmentMapContainer';
import QuizModal from './QuizModal';
import ReviewSummary from './ReviewSummary';
import type { AvatarAction } from './AvatarToken';
import type { AdventureProgress, Course, Feedback, Game, MapLevel, Material, ReviewData, WizardHelp, WizardMood, World } from './quest-map.types';
import { fetchApi } from '@/lib/api';
import { generateWorld, GenerationStatus } from '@/lib/world-generation';

const wait = (milliseconds: number) => new Promise(resolve => setTimeout(resolve, milliseconds));

interface Reward { xp_gained: number; gems_gained: number; total_xp: number; total_gems: number; claimed: boolean; }

export default function WorldExplorer() {
  const params = useSearchParams();
  const [courses, setCourses] = useState<Course[]>([]);
  const [course, setCourse] = useState('');
  const [materials, setMaterials] = useState<Material[]>([]);
  const [material, setMaterial] = useState('');
  const [world, setWorld] = useState<World | null>(null);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [generation, setGeneration] = useState<GenerationStatus | null>(null);
  const [selectedLevel, setSelectedLevel] = useState<MapLevel | null>(null);
  const [game, setGame] = useState<Game | null>(null);
  const [gameLoading, setGameLoading] = useState(false);
  const [quizOpen, setQuizOpen] = useState(false);
  const [progress, setProgress] = useState<Record<string, AdventureProgress | undefined>>({});
  const [activeLevelId, setActiveLevelId] = useState<string>();
  const [avatarPoint, setAvatarPoint] = useState<{ x: number; y: number }>();
  const [avatarAction, setAvatarAction] = useState<AvatarAction>('idle');
  const [defeatedEnemies, setDefeatedEnemies] = useState<Set<string>>(new Set());
  const [wizardMood, setWizardMood] = useState<WizardMood>('neutral');
  const [milestone, setMilestone] = useState<{ level: MapLevel; reward: Reward } | null>(null);
  const [treasure, setTreasure] = useState<{ level: MapLevel; reward: Reward } | null>(null);
  const [review, setReview] = useState<ReviewData | null>(null);

  const mapLevels = useMemo(() => buildMapLevels(world?.nodes || []), [world?.nodes]);

  useEffect(() => {
    let active = true;
    fetchApi<Course[]>('/courses').then(items => {
      if (active) { setCourses(items); setCourse(items.find(item => item.id === params.get('course'))?.id || items[0]?.id || ''); }
    }).catch(err => active && setError(err.message));
    return () => { active = false; };
  }, [params]);

  useEffect(() => {
    let active = true;
    setMaterials([]); setMaterial(''); setWorld(null); setProgress({});
    if (course) fetchApi<Material[]>(`/courses/${course}/materials`).then(items => {
      if (!active) return;
      const ready = items.filter(item => item.status === 'completed');
      setMaterials(ready); setMaterial(ready.find(item => item.id === params.get('material'))?.id || ready[0]?.id || '');
    }).catch(err => active && setError(err.message));
    return () => { active = false; };
  }, [course, params]);

  const loadWorld = useCallback(async (reposition = true) => {
    if (!course || !material) return null;
    const value = await fetchApi<World>(`/learning/courses/${course}/world?material_id=${material}`);
    setWorld(value);
    const mapped = buildMapLevels(value.nodes);
    const current = mapped.find(item => item.status === 'unlocked') || [...mapped].reverse().find(item => item.status === 'completed') || mapped[0];
    if (current && reposition) { setActiveLevelId(current.id); setAvatarPoint({ x: current.x, y: current.y }); }
    return value;
  }, [course, material]);

  useEffect(() => {
    let active = true;
    setWorld(null); setProgress({}); setError(''); setGeneration(null);
    if (!material || !course) return;
    setLoading(true);
    loadWorld().catch(err => active && setError(err.message)).finally(() => active && setLoading(false));
    return () => { active = false; };
  }, [course, material, loadWorld]);

  useEffect(() => {
    if (!world?.generated) return;
    let active = true;
    Promise.all(world.nodes.filter(node => node.is_unlocked).map(node => fetchApi<Game>(`/learning/levels/${node.id}/game`).catch(() => null)))
      .then(games => {
        if (!active) return;
        setProgress(current => games.reduce((next, item) => item ? { ...next, [item.node_id]: item.adventure } : next, current));
      });
    return () => { active = false; };
  }, [world]);

  useEffect(() => {
    if (!course || !material || busy || world?.generated) return;
    let active = true; let timer: ReturnType<typeof setTimeout>;
    async function poll() {
      try {
        const status = await fetchApi<GenerationStatus>(`/learning/courses/${course}/materials/${material}/generation`);
        if (!active) return;
        setGeneration(status);
        if (status.status === 'completed') await loadWorld();
        else if (status.status === 'failed') setError(status.message);
        else if (status.status === 'running' || status.status === 'queued') timer = setTimeout(poll, 2500);
      } catch (err) { if (active) setError(err instanceof Error ? err.message : 'Could not load generation status.'); }
    }
    void poll();
    return () => { active = false; clearTimeout(timer); };
  }, [course, material, busy, world?.generated, loadWorld]);

  async function generate() {
    if (!material || busy) return;
    setBusy(true); setError('');
    try {
      const value = await generateWorld<World>(course, material, setGeneration);
      setWorld(value);
      const first = buildMapLevels(value.nodes)[0];
      if (first) { setActiveLevelId(first.id); setAvatarPoint({ x: first.x, y: first.y }); }
    }
    catch (err) { setError(err instanceof Error ? err.message : 'Could not generate this world.'); }
    finally { setBusy(false); }
  }

  async function openLevel(level: MapLevel) {
    setSelectedLevel(level); setQuizOpen(true); setGame(null); setGameLoading(true); setWizardMood('neutral'); setActiveLevelId(level.id);
    try {
      const value = await fetchApi<Game>(`/learning/levels/${level.id}/game`);
      setGame(value); setProgress(current => ({ ...current, [level.id]: value.adventure }));
    } catch (err) { setError(err instanceof Error ? err.message : 'Could not open this level.'); setQuizOpen(false); }
    finally { setGameLoading(false); }
  }

  async function answer(index: number) {
    if (!game || !selectedLevel) throw new Error('The level is still loading.');
    const result = await fetchApi<Feedback>(`/learning/levels/${selectedLevel.id}/game/answer`, { method: 'POST', body: JSON.stringify({ question_index: game.solved_count, answer_index: index }) });
    setGame(result.game); setProgress(current => ({ ...current, [selectedLevel.id]: result.game.adventure }));
    return result;
  }

  async function requestWizardHelp(level: MapLevel, mode: 'hint' | 'concept', questionIndex?: number) {
    const result = await fetchApi<WizardHelp>(`/learning/levels/${level.id}/wizard-help`, {
      method: 'POST', body: JSON.stringify({ mode, question_index: questionIndex }),
    });
    window.dispatchEvent(new Event('questify:metrics-updated'));
    return result;
  }

  async function finishLevel(completedGame: Game) {
    if (!selectedLevel) return;
    setQuizOpen(false);
    try {
      const reward = await fetchApi<Reward>(`/learning/levels/${selectedLevel.id}/reward`, { method: 'POST' });
      setMilestone({ level: selectedLevel, reward });
      setProgress(current => ({ ...current, [selectedLevel.id]: completedGame.adventure }));
      window.dispatchEvent(new Event('questify:metrics-updated'));
      await loadWorld(false);
    } catch (err) { setError(err instanceof Error ? err.message : 'Could not claim the milestone reward.'); }
  }

  async function travelTo(level: MapLevel) {
    setAvatarAction(level.enemy && !defeatedEnemies.has(level.id) ? 'running' : 'walking');
    if (level.enemy && !defeatedEnemies.has(level.id)) {
      setAvatarPoint({ x: level.x - 65, y: level.y });
      await wait(900); setAvatarAction('runAttacking'); await wait(540); setAvatarAction('attacking'); await wait(480); setAvatarAction('attack2'); await wait(440);
      setDefeatedEnemies(current => new Set(current).add(level.id));
    } else { setAvatarPoint({ x: level.x, y: level.y }); await wait(1050); }
    setAvatarPoint({ x: level.x, y: level.y }); setAvatarAction('idle'); setActiveLevelId(level.id); setWizardMood('celebrating');
  }

  function reviewFor(level: MapLevel, finalGame?: Game): ReviewData {
    const group = mapLevels.filter(item => item.displayWorld === level.displayWorld);
    const records = group.map(item => item.id === finalGame?.node_id ? finalGame.adventure : progress[item.id]).filter(Boolean) as AdventureProgress[];
    return { title: `World ${level.displayWorld}: ${group[0]?.title || world?.title || 'Learning Path'}`, correct: records.flatMap(item => item.correct_answers), mistakes: records.flatMap(item => item.mistakes) };
  }

  async function claimTreasure(level: MapLevel) {
    try {
      const reward = await fetchApi<Reward>(`/learning/levels/${level.id}/treasure`, { method: 'POST' });
      setTreasure({ level, reward });
      setProgress(current => ({ ...current, [level.id]: { ...(current[level.id] || { mistakes: [], correct_answers: [], level_reward_claimed: false, treasure_claimed: false }), treasure_claimed: true } }));
      window.dispatchEvent(new Event('questify:metrics-updated'));
    } catch (err) { setError(err instanceof Error ? err.message : 'The treasure seal would not open.'); }
  }

  async function continueMilestone() {
    if (!milestone) return;
    const finished = milestone.level; const next = mapLevels[mapLevels.findIndex(item => item.id === finished.id) + 1];
    setMilestone(null);
    if (finished.isFinal) { setReview(reviewFor(finished, game || undefined)); return; }
    if (!next) return;
    if (finished.isTreasureGate && next.isFinal) {
      const chestPoint = { x: finished.x + (next.x - finished.x) * .55, y: finished.y + (next.y - finished.y) * .55 - 2 };
      setAvatarAction('walking'); setAvatarPoint(chestPoint); await wait(1050); setAvatarAction('idle'); await claimTreasure(next); return;
    }
    await travelTo(next); await loadWorld(false);
  }

  async function continueTreasure() {
    if (!treasure) return;
    const target = treasure.level; setTreasure(null); await travelTo(target); await loadWorld(false);
  }

  async function continueReview() {
    if (!selectedLevel) { setReview(null); return; }
    const next = mapLevels[mapLevels.findIndex(item => item.id === selectedLevel.id) + 1];
    setReview(null); if (next) await travelTo(next); await loadWorld(false);
  }

  async function retryWorld() {
    if (!selectedLevel) return;
    const group = mapLevels.filter(item => item.displayWorld === selectedLevel.displayWorld);
    try {
      await fetchApi('/learning/world/retry', { method: 'POST', body: JSON.stringify({ node_ids: group.map(item => item.id) }) });
      setReview(null); setProgress(current => { const next = { ...current }; group.forEach(item => delete next[item.id]); return next; });
      await loadWorld(); const first = group[0]; setAvatarPoint({ x: first.x, y: first.y }); setActiveLevelId(first.id); setWizardMood('neutral');
    } catch (err) { setError(err instanceof Error ? err.message : 'Could not restart this world.'); }
  }

  const working = busy || Boolean(generation && ['queued', 'running'].includes(generation.status));
  return <div className="app-shell"><Sidebar /><div className="page-content"><Header title="Learning world" /><main className="world-page">
    <div className="page-intro"><div><p className="eyebrow">Learn · Play · Progress</p><h1>{world?.generated ? world.title : 'Build a world from your resource'}</h1><p>Follow the parchment trail, outwit its guardians, and turn every concept into mastery.</p></div><div className="selectors"><label>Workspace<select disabled={busy} value={course} onChange={event => setCourse(event.target.value)}><option value="">Choose workspace</option>{courses.map(item => <option key={item.id} value={item.id}>{item.title}</option>)}</select></label><label>Resource<select disabled={busy} value={material} onChange={event => setMaterial(event.target.value)}><option value="">Choose resource</option>{materials.map(item => <option key={item.id} value={item.id}>{item.filename}</option>)}</select></label></div></div>
    {error && <div className="error" role="alert"><span>!</span>{error}<button onClick={() => setError('')}>×</button></div>}
    {loading ? <section className="loading-map">Unrolling your map…</section> : world?.generated ? <>
      <div className="map-meta"><span>{world.nodes.length} levels across {Math.ceil(world.nodes.length / 5)} world{world.nodes.length > 5 ? 's' : ''}</span><span>Drag or scroll sideways to explore →</span></div>
      <ParchmentMapContainer nodes={world.nodes} progress={progress} activeLevelId={activeLevelId} avatarPoint={avatarPoint} avatarAction={avatarAction} defeatedEnemies={defeatedEnemies} wizardMood={wizardMood} onOpenLevel={openLevel} onTreasure={claimTreasure} onWizardHelp={(level) => requestWizardHelp(level, 'concept')} />
    </> : <section className="empty"><div>🗺️</div><h2>{working ? 'The Wizard is charting your path…' : 'Your adventure begins with a resource'}</h2><p>{working ? `${generation?.progress || 0}% · ${generation?.message || 'Reading concepts and arranging prerequisites.'}` : 'Generate a source-grounded learning world with trials, treasures, enemies, and review checkpoints.'}</p><button disabled={!material || working} onClick={generate}>{working ? 'Building world…' : 'Generate adventure map'}</button>{!materials.length && <a href="/dashboard">Upload a resource first</a>}</section>}
  </main>
  <QuizModal open={quizOpen} level={selectedLevel} game={game} loading={gameLoading} onClose={() => setQuizOpen(false)} onAnswer={answer} onRequestHint={(questionIndex) => {
    if (!selectedLevel) return Promise.reject(new Error('The level is still loading.'));
    return requestWizardHelp(selectedLevel, 'hint', questionIndex);
  }} onLevelComplete={finishLevel} onMoodChange={setWizardMood} />
  <AnimatePresence>{milestone && <RewardPopup title="Milestone Reached!" icon="🎁" copy="Fantastic work—another stretch of the path is yours." reward={milestone.reward} action="Continue Path" onContinue={continueMilestone} />}</AnimatePresence>
  <AnimatePresence>{treasure && <RewardPopup title={treasure.reward.xp_gained ? 'Treasure Unsealed!' : 'Treasure Already Claimed'} icon="🧰" copy="The cache glows with knowledge gathered along the trail." reward={treasure.reward} action="Approach Final Trial" onContinue={continueTreasure} />}</AnimatePresence>
  {review && <ReviewSummary data={review} onContinue={continueReview} onRetry={retryWorld} />}
  </div><style jsx>{`
    .world-page{max-width:1500px;margin:auto;padding:25px 30px 42px}.page-intro{display:flex;align-items:flex-end;justify-content:space-between;gap:24px;margin-bottom:18px}.eyebrow{color:#6f8c55;font-size:10px;font-weight:900;letter-spacing:.14em;text-transform:uppercase}.page-intro h1{margin-top:5px;font:700 29px/1.15 Georgia,serif;color:var(--foreground)}.page-intro>div>p:last-child{margin-top:6px;color:var(--muted);font-size:12px}.selectors{display:flex;gap:10px}.selectors label{display:grid;gap:5px;color:var(--muted);font-size:9px;font-weight:800;text-transform:uppercase;letter-spacing:.07em}.selectors select{width:210px;padding:9px 28px 9px 10px;border:1px solid var(--border-strong);border-radius:9px;background:var(--surface);color:var(--foreground);font-size:11px;text-transform:none;letter-spacing:0}.map-meta{display:flex;justify-content:space-between;margin:0 5px 8px;color:var(--muted);font-size:9px;font-weight:700}.error{display:flex;align-items:center;gap:9px;margin-bottom:12px;padding:10px 12px;border:1px solid #ddb3a9;border-radius:9px;background:#fff0ec;color:#913f36;font-size:11px}.error>span{display:grid;place-items:center;width:19px;height:19px;border-radius:50%;background:#a9473c;color:white;font-weight:900}.error button{margin-left:auto;border:0;background:transparent;color:inherit;font-size:17px}.loading-map,.empty{display:grid;place-items:center;min-height:420px;border:1px dashed #bda981;border-radius:20px;background:#f4ebd0;color:#705538}.empty{align-content:center;gap:10px;text-align:center}.empty>div{font-size:52px}.empty h2{font:700 23px Georgia,serif}.empty p{max-width:500px;color:#806b53;font-size:12px;line-height:1.6}.empty button{margin-top:8px;padding:11px 17px;border:1px solid #285d3e;border-radius:10px;background:#367c52;color:white;font-weight:800}.empty button:disabled{opacity:.5}.empty a{color:#3d6f50;font-size:11px}
    @media(max-width:900px){.world-page{padding:20px 16px}.page-intro{align-items:flex-start;flex-direction:column}.selectors{width:100%}.selectors label{flex:1}.selectors select{width:100%}}@media(max-width:600px){.world-page{padding:15px 10px 90px}.page-intro h1{font-size:24px}.selectors{flex-direction:column}.map-meta span:last-child{display:none}}
  `}</style></div>;
}

function RewardPopup({ title, icon, copy, reward, action, onContinue }: { title: string; icon: string; copy: string; reward: Reward; action: string; onContinue: () => void }) {
  return <motion.div className="reward-backdrop" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}><motion.section initial={{ y: 26, scale: .95 }} animate={{ y: 0, scale: 1 }} exit={{ y: 20, scale: .96 }}><div className="rays" /><span className="reward-icon">{icon}</span><p className="kicker">Quest updated</p><h2>{title}</h2><p className="copy">{copy}</p><div className="loot"><div><span>XP GAINED</span><b>+{reward.xp_gained || 0} XP</b></div><div><span>GEMS DROPPED</span><b>+{reward.gems_gained || 0} 💎</b></div></div><button onClick={onContinue}>{action} →</button></motion.section><style jsx global>{`
    .reward-backdrop{position:fixed;inset:0;z-index:105;display:grid;place-items:center;padding:20px;background:rgba(44,31,22,.68);backdrop-filter:blur(5px)}.reward-backdrop>section{position:relative;width:min(410px,100%);overflow:hidden;padding:30px;border:2px solid #8b683e;border-radius:24px;background:#fff7df;color:#3f2d1e;text-align:center;box-shadow:0 25px 70px rgba(34,22,12,.5)}.rays{position:absolute;left:50%;top:-85px;width:260px;height:260px;transform:translateX(-50%);opacity:.22;background:repeating-conic-gradient(#d9a839 0 10deg,transparent 10deg 22deg);animation:spin 15s linear infinite}.reward-icon{position:relative;display:block;font-size:58px;animation:bounce 1s ease-in-out infinite}.reward-backdrop .kicker{position:relative;color:#9a722d;font-size:9px;font-weight:900;letter-spacing:.15em;text-transform:uppercase}.reward-backdrop h2{position:relative;margin-top:5px;font:700 27px Georgia,serif}.reward-backdrop .copy{position:relative;margin:7px auto 0;max-width:310px;color:#80694c;font-size:11px;line-height:1.5}.loot{position:relative;display:grid;grid-template-columns:1fr 1fr;gap:10px;margin:20px 0}.loot div{padding:12px;border:1px solid #d9bc7e;border-radius:12px;background:#fff1c9}.loot div+div{border-color:#a8c9de;background:#e9f5fc}.loot span{display:block;color:#9b6c2e;font-size:8px;font-weight:900}.loot div+div span{color:#397697}.loot b{display:block;margin-top:3px;font-size:16px}.reward-backdrop>section>button{width:100%;min-height:47px;border:0;border-radius:12px;background:#328557;color:white;box-shadow:0 5px 0 #246641;font-weight:900}@keyframes spin{to{transform:translateX(-50%) rotate(360deg)}}@keyframes bounce{50%{transform:translateY(-5px)}}@media(prefers-reduced-motion:reduce){.rays,.reward-icon{animation:none}}
  `}</style></motion.div>;
}
