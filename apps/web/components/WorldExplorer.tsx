'use client';
import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Sidebar from './Sidebar';
import Header from './Header';
import LevelGame from './LevelGame';
import { fetchApi } from '@/lib/api';
import { generateWorld, GenerationStatus } from '@/lib/world-generation';

interface Course { id: string; title: string; }
interface Material { id: string; filename: string; status: string; }
interface Level { id: string; title: string; description: string; level_index: number; mastery_score: number; is_unlocked: boolean; }
interface World { title: string; generated: boolean; nodes: Level[]; coverage?: { text_sections?: number; mapped_topics?: number; assigned_topics?: number; limitations?: string; plan?: { title: string; difficulty: number; prerequisites: string[] }[] }; }

export default function WorldExplorer() {
  const params = useSearchParams();
  const [courses, setCourses] = useState<Course[]>([]);
  const [course, setCourse] = useState('');
  const [materials, setMaterials] = useState<Material[]>([]);
  const [material, setMaterial] = useState('');
  const [world, setWorld] = useState<World | null>(null);
  const [node, setNode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [generation, setGeneration] = useState<GenerationStatus | null>(null);
  useEffect(() => {
    let active = true;
    fetchApi<Course[]>('/courses').then(items => { if (active) { setCourses(items); setCourse(items.find(item => item.id === params.get('course'))?.id || items[0]?.id || ''); } }).catch(err => { if (active) setError(err.message); });
    return () => { active = false; };
  }, [params]);
  useEffect(() => {
    let active = true;
    setMaterials([]); setMaterial(''); setWorld(null); setNode('');
    if (course) fetchApi<Material[]>(`/courses/${course}/materials`).then(items => {
      if (!active) return;
      const ready = items.filter(item => item.status === 'completed');
      setMaterials(ready); setMaterial(ready.find(item => item.id === params.get('material'))?.id || ready[0]?.id || '');
    }).catch(err => { if (active) setError(err.message); });
    return () => { active = false; };
  }, [course, params]);
  useEffect(() => {
    let active = true;
    setWorld(null); setNode(''); setError(''); setGeneration(null);
    if (!material || !course) return;
    setLoading(true);
    fetchApi<World>(`/learning/courses/${course}/world?material_id=${material}`).then(value => {
      if (active) { setWorld(value); setNode(value.nodes.find(item => item.is_unlocked && item.mastery_score < 100)?.id || value.nodes[0]?.id || ''); }
    }).catch(err => { if (active) setError(err.message); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [course, material]);
  useEffect(() => {
    if (!course || !material || busy || world?.generated) return;
    let active = true;
    let timer: ReturnType<typeof setTimeout>;
    async function poll() {
      try {
        const status = await fetchApi<GenerationStatus>(`/learning/courses/${course}/materials/${material}/generation`);
        if (!active) return;
        setGeneration(status);
        if (status.status === 'completed') {
          const value = await fetchApi<World>(`/learning/courses/${course}/world?material_id=${material}`);
          if (active) { setWorld(value); setNode(value.nodes.find(item => item.is_unlocked && item.mastery_score < 100)?.id || value.nodes[0]?.id || ''); }
        } else if (status.status === 'failed') {
          setError(status.message);
        } else if (status.status === 'running' || status.status === 'queued') {
          timer = setTimeout(poll, 2500);
        }
      } catch (err) { if (active) setError(err instanceof Error ? err.message : 'Could not load generation status.'); }
    }
    void poll();
    return () => { active = false; clearTimeout(timer); };
  }, [course, material, busy, world?.generated]);
  async function generate() {
    if (!material || busy) return;
    setBusy(true); setError('');
    try {
      const value = await generateWorld<World>(course, material, setGeneration);
      setWorld(value); setNode(value.nodes[0]?.id || '');
      try {
        const saved = JSON.parse(localStorage.getItem('questify_chats') || '{}');
        if (Array.isArray(saved.threads)) {
          saved.threads = saved.threads.map((thread: { id: string; courseId?: string; materialId?: string }) => thread.courseId === course && (thread.materialId === material || (!thread.materialId && thread.id === saved.activeThreadId)) ? { ...thread, materialId: material, worldTitle: value.title } : thread);
          localStorage.setItem('questify_chats', JSON.stringify(saved));
        }
      } catch { /* Optional browser cache. */ }
    } catch (err) { setError(err instanceof Error ? err.message : 'Could not generate world.'); }
    finally { setBusy(false); }
  }
  async function refresh() {
    try { setWorld(await fetchApi<World>(`/learning/courses/${course}/world?material_id=${material}`)); }
    catch (err) { setError(err instanceof Error ? err.message : 'Could not refresh progress.'); }
  }
  const working = busy || Boolean(generation && ['queued', 'running'].includes(generation.status));
  return <div className="app-shell"><Sidebar /><div className="page-content"><Header title="Learning world" /><main className="world-page">
    <p className="eyebrow">Learn · Play · Progress</p><h1>{world?.generated ? world.title : 'Build a world from your resource'}</h1><p>Learn the foundations first. Finish each concept trail to unlock the next level.</p>
    <div className="selectors"><label>Workspace<select disabled={busy} value={course} onChange={event => setCourse(event.target.value)}><option value="">Choose workspace</option>{courses.map(item => <option key={item.id} value={item.id}>{item.title}</option>)}</select></label><label>Resource<select disabled={busy} value={material} onChange={event => setMaterial(event.target.value)}><option value="">Choose resource</option>{materials.map(item => <option key={item.id} value={item.id}>{item.filename}</option>)}</select></label></div>
    {world?.coverage?.mapped_topics && <p>{world.coverage.assigned_topics} of {world.coverage.mapped_topics} mapped concepts assigned across {world.nodes.length} levels · {world.coverage.text_sections} text sections processed. {world.coverage.limitations}</p>}
    {generation && !busy && ['queued', 'running'].includes(generation.status) && <p role="status">{generation.progress}% · {generation.message}</p>}
    {error && <p role="alert">{error}</p>}
    {loading ? <p>Loading world…</p> : world?.generated ? <><div className="levels">{world.nodes.map(item => <button className={node === item.id ? 'selected' : ''} disabled={!item.is_unlocked} key={item.id} onClick={() => setNode(item.id)}><small>Level {item.level_index} · {['', 'Beginner', 'Intermediate', 'Advanced'][world.coverage?.plan?.find(level => level.title === item.title)?.difficulty || 0]} · {item.mastery_score === 100 ? 'Complete' : item.is_unlocked ? 'Open' : 'Locked'}</small><strong>{item.title}</strong><span>{item.description}</span><progress value={item.mastery_score} max={100} aria-label={`${item.title} progress`} /></button>)}</div>{node && <LevelGame key={node} nodeId={node} onProgress={refresh} />}</> : <section className="panel empty"><h2>{working ? 'Building your learning path…' : 'Ready to begin?'}</h2><p>{working ? (generation ? `${generation.progress}% · ${generation.message}. You can leave this page; generation continues on the server.` : 'Reading all extracted text and planning prerequisite levels. Large books can take several minutes.') : 'Create as many focused concept levels as this resource needs, ordered by prerequisites and difficulty. Each level includes a lesson, game and flashcards.'}</p><button className="btn btn-primary" disabled={!material || working} onClick={generate}>{working ? 'Generating…' : 'Generate world'}</button>{!materials.length && <a href="/dashboard">Upload a resource in the dashboard</a>}</section>}
  </main></div><style jsx>{`
    .world-page{max-width:1200px;margin:auto;padding:32px}.world-page h1{font-size:28px;margin:8px 0}.world-page>p{color:var(--muted);line-height:1.7}.eyebrow{font-size:12px;color:var(--accent)!important}.selectors{display:flex;gap:16px;margin:24px 0}.selectors label{display:flex;flex:1;min-width:0;flex-direction:column;gap:8px;font-size:12px}select{width:100%;padding:12px;border:1px solid var(--border);border-radius:8px;background:var(--surface);color:var(--foreground)}.levels{display:grid;grid-template-columns:repeat(2,1fr);gap:12px}.levels button{display:flex;flex-direction:column;gap:10px;text-align:left;padding:20px;border:1px solid var(--border);border-radius:12px;background:var(--surface);color:var(--foreground)}.levels .selected{border-color:var(--accent);background:var(--accent-soft)}.levels button:disabled{opacity:.55}.levels small,.levels span{color:var(--muted);font-size:12px;line-height:1.6}.levels strong{font-size:16px}progress{width:100%;height:6px;accent-color:var(--accent)}.empty{padding:32px;display:flex;flex-direction:column;align-items:flex-start;gap:20px}.empty p{line-height:1.7;color:var(--muted)}[role=alert]{color:var(--danger)!important}@media(max-width:700px){.world-page{padding:20px 16px}.selectors{flex-direction:column}.levels{grid-template-columns:1fr}}
  `}</style></div>;
}
