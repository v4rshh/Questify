'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Sidebar, { ChatThread } from '@/components/Sidebar';
import { Icon } from '@/components/Icon';
import ThemeToggle from '@/components/ThemeToggle';
import { fetchApi } from '@/lib/api';
import { generateWorld as requestWorld } from '@/lib/world-generation';

interface Course { id: string; title: string; description?: string | null; }
interface Citation { source: string; page: number | null; excerpt: string; chunk_index: number; }
interface Message { id: string; sender: 'user' | 'assistant'; text: string; citations?: Citation[]; }
interface TutorResponse { response: string; mode: string; xp_earned: number; total_xp: number; citations: Citation[]; grounded: boolean; retrieved_chunks: number; }
interface Material { id: string; course_id: string; filename: string; status: string; summary?: string | null; }
interface LearningWorld { title: string; generated: boolean; nodes: { id: string; title: string }[]; }
interface User { full_name: string; xp: number; streak_count: number; mastery_tier: string; }
interface Stats { xp: number; streak_count: number; mastery_tier: string; total_courses: number; }

const welcomeMessage: Message = {
  id: 'welcome', sender: 'assistant',
  text: 'Hi, I’m Questify. Upload a resource or ask a question to start a focused study session. I’ll keep answers grounded in your materials and show the source below each answer.',
};

function titleFromFilename(filename: string) {
  return filename.replace(/\.[^/.]+$/, '').replace(/[-_]+/g, ' ').replace(/\s+/g, ' ').trim().replace(/\b\w/g, (letter) => letter.toUpperCase()) || 'New resource';
}

export default function DashboardPage() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [courses, setCourses] = useState<Course[]>([]);
  const [selectedCourseId, setSelectedCourseId] = useState('');
  const [threads, setThreads] = useState<ChatThread[]>([{ id: 'new', title: 'New conversation' }]);
  const [activeThreadId, setActiveThreadId] = useState('new');
  const [messagesByThread, setMessagesByThread] = useState<Record<string, Message[]>>({ new: [welcomeMessage] });
  const [input, setInput] = useState('');
  const [gameMode, setGameMode] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isGeneratingWorld, setIsGeneratingWorld] = useState(false);
  const [generationMessage, setGenerationMessage] = useState('');
  const [error, setError] = useState('');
  const [pendingWorld, setPendingWorld] = useState<Material | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [stats, setStats] = useState<Stats | null>(null);
  const [chatStateReady, setChatStateReady] = useState(false);

  const messages = messagesByThread[activeThreadId] || [welcomeMessage];
  const activeThread = threads.find((thread) => thread.id === activeThreadId);
  const selectedCourse = courses.find((course) => course.id === selectedCourseId);
  const canCreateWorld = Boolean(activeThread?.courseId && activeThread.resourceReady && (!activeThread.worldTitle || !activeThread.materialId) && !isUploading && !isSending);
  const hasConversation = messages.some((message) => message.sender === 'user');
  const greeting = user?.full_name ? `What are you working on, ${user.full_name.split(' ')[0]}?` : 'What do you want to understand?';

  useEffect(() => {
    Promise.allSettled([
      fetchApi<Course[]>('/courses'),
      fetchApi<User>('/auth/me'),
      fetchApi<Stats>('/gamification/dashboard'),
    ]).then(([courseResult, userResult, statsResult]) => {
      if (courseResult.status === 'fulfilled') {
        setCourses(courseResult.value);
      }
      if (userResult.status === 'fulfilled') setUser(userResult.value);
      if (statsResult.status === 'fulfilled') setStats(statsResult.value);
    });
  }, []);

  useEffect(() => {
    try {
      const saved = localStorage.getItem('questify_chats');
      if (saved) {
        const parsed = JSON.parse(saved) as { threads?: ChatThread[]; messages?: Record<string, Message[]>; activeThreadId?: string };
        if (parsed.threads?.length && parsed.messages) {
          setThreads(parsed.threads);
          setMessagesByThread(parsed.messages);
          setActiveThreadId(parsed.activeThreadId && parsed.messages[parsed.activeThreadId] ? parsed.activeThreadId : parsed.threads[0].id);
        }
      }
    } catch { /* A malformed local cache should never block the workspace. */ }
    setChatStateReady(true);
  }, []);

  useEffect(() => {
    if (!chatStateReady) return;
    localStorage.setItem('questify_chats', JSON.stringify({ threads, messages: messagesByThread, activeThreadId }));
  }, [activeThreadId, chatStateReady, messagesByThread, threads]);

  useEffect(() => {
    setSelectedCourseId(activeThread?.courseId || '');
  }, [activeThreadId, activeThread?.courseId]);

  const updateActiveMessages = (updater: (current: Message[]) => Message[]) => {
    setMessagesByThread((current) => ({ ...current, [activeThreadId]: updater(current[activeThreadId] || [welcomeMessage]) }));
  };

  const startNewChat = () => {
    const id = `chat-${Date.now()}`;
    setThreads((current) => [{ id, title: 'New conversation' }, ...current]);
    setMessagesByThread((current) => ({ ...current, [id]: [welcomeMessage] }));
    setActiveThreadId(id);
    setSelectedCourseId('');
    setPendingWorld(null);
    setError('');
  };

  const updateThreadTitle = (title: string) => {
    setThreads((current) => current.map((thread) => thread.id === activeThreadId ? { ...thread, title } : thread));
  };

  const updateActiveThread = (updates: Partial<ChatThread>) => {
    setThreads((current) => current.map((thread) => thread.id === activeThreadId ? { ...thread, ...updates } : thread));
  };

  const sendMessage = async (preset?: string) => {
    const message = (preset ?? input).trim();
    if (!message || isSending) return;
    setError('');
    updateActiveMessages((current) => [...current, { id: `user-${Date.now()}`, sender: 'user', text: message }]);
    setInput('');
    setIsSending(true);
    try {
      const courseId = activeThread?.courseId || await ensureCourse('General Study');
      const result = await fetchApi<TutorResponse>('/tutor/chat', { method: 'POST', body: JSON.stringify({ message, mode: gameMode ? 'game' : 'normal', course_id: courseId }) });
      updateActiveMessages((current) => [...current, { id: `assistant-${Date.now()}`, sender: 'assistant', text: result.response, citations: result.citations }]);
      if (!hasConversation && threads.find((thread) => thread.id === activeThreadId)?.title === 'New conversation') updateThreadTitle(message.length > 34 ? `${message.slice(0, 34)}…` : message);
      setStats((current) => current ? { ...current, xp: result.total_xp } : current);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'The tutor could not be reached.');
    } finally { setIsSending(false); }
  };

  const ensureCourse = async (filename: string) => {
    if (activeThread?.courseId) return activeThread.courseId;
    const title = titleFromFilename(filename);
    const course = await fetchApi<Course>('/courses', { method: 'POST', body: JSON.stringify({ title, description: `Study workspace for ${filename}` }) });
    setCourses((current) => [course, ...current]);
    setSelectedCourseId(course.id);
    updateActiveThread({ courseId: course.id });
    return course.id;
  };

  const uploadResource = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file || isUploading || isGeneratingWorld || isSending) return;
    setIsUploading(true); setError('');
    try {
      const course = await fetchApi<Course>('/courses', { method: 'POST', body: JSON.stringify({ title: titleFromFilename(file.name), description: `Study workspace for ${file.name}` }) });
      const courseId = course.id;
      const formData = new FormData(); formData.append('file', file);
      const material = await fetchApi<Material>(`/courses/${courseId}/materials/upload`, { method: 'POST', body: formData });
      const title = titleFromFilename(material.filename);
      const threadId = activeThread?.resourceReady ? `chat-${crypto.randomUUID()}` : activeThreadId;
      const resourceThread: ChatThread = { id: threadId, title: `${title} study chat`, courseId, materialId: material.id, resourceReady: true };
      setThreads(current => threadId === activeThreadId ? current.map(thread => thread.id === threadId ? resourceThread : thread) : [resourceThread, ...current]);
      setMessagesByThread(current => ({ ...current, [threadId]: [...(threadId === activeThreadId ? current[threadId] || [] : [welcomeMessage]), { id: `upload-${Date.now()}`, sender: 'assistant', text: `Indexed ${material.filename}. Create a world to learn its concepts step by step.` }] }));
      setActiveThreadId(threadId);
      setSelectedCourseId(courseId);
      setCourses(current => [course, ...current]);
      setPendingWorld(material);
      setStats((current) => current ? { ...current, total_courses: Math.max(current.total_courses, courses.length || 1) } : current);
    } catch (err) { setError(err instanceof Error ? err.message : 'The resource could not be uploaded.'); }
    finally { setIsUploading(false); }
  };

  const generateWorld = async () => {
    const courseId = activeThread?.courseId || pendingWorld?.course_id;
    if (!courseId || isGeneratingWorld || isUploading) return;
    setIsGeneratingWorld(true);
    setError('');
    try {
      let materialId = activeThread?.materialId || pendingWorld?.id;
      if (!materialId) {
        const materials = await fetchApi<Material[]>(`/courses/${courseId}/materials`);
        materialId = materials.find(material => material.status === 'completed')?.id;
      }
      if (!materialId) throw new Error('Upload a resource before creating a world.');
      const world = await requestWorld<LearningWorld>(courseId, materialId, status => setGenerationMessage(`${status.progress}% · ${status.message}`));
      updateActiveMessages((current) => [...current, { id: `world-${Date.now()}`, sender: 'assistant', text: `Your learning world is ready: ${world.title}. I created ${world.nodes.length} levels, with a lesson, concept game, and flashcards for each level. You can open them from the sidebar whenever you are ready.` }]);
      updateActiveThread({ courseId, materialId, resourceReady: true, worldTitle: world.title });
      setPendingWorld(null);
    } catch (err) { setError(err instanceof Error ? err.message : 'The learning world could not be generated.'); }
    finally { setIsGeneratingWorld(false); setGenerationMessage(''); }
  };

  const quickPrompts = useMemo(() => [
    { title: 'Explain a concept', prompt: 'Explain the most important concept in this resource in simple terms.' },
    { title: 'Make a study plan', prompt: 'Make a short study plan for this resource.' },
    { title: 'Test my understanding', prompt: 'Give me three questions to test my understanding of this resource.' },
  ], []);

  return (
    <div className="app-shell">
      <Sidebar threads={threads} activeThreadId={activeThreadId} onNewChat={startNewChat} onSelectThread={(id) => { const thread = threads.find((item) => item.id === id); setActiveThreadId(id); if (thread?.courseId) setSelectedCourseId(thread.courseId); setPendingWorld(null); setError(''); }} canCreateWorld={canCreateWorld} isCreatingWorld={isGeneratingWorld} onCreateWorld={generateWorld} />
      <main className="page-content chat-page">
        <header className="chat-topbar"><div className="mobile-brand"><span className="brand-mark-small">Q</span> Questify</div><div className="context-select"><Icon name="bookOpen" size={15} /><select value={selectedCourseId} onChange={(event) => { setSelectedCourseId(event.target.value); updateActiveThread({ courseId: event.target.value, materialId: undefined, resourceReady: false, worldTitle: undefined }); }} aria-label="Study context"><option value="">Choose study context</option>{courses.map((course) => <option key={course.id} value={course.id}>{course.title}</option>)}</select><Icon name="chevronDown" size={14} /></div><div className="topbar-right"><span className="topbar-stat"><Icon name="flame" size={14} /> {stats?.streak_count ?? user?.streak_count ?? 0}</span><span className="topbar-stat"><Icon name="sparkles" size={14} /> {stats?.xp ?? user?.xp ?? 0} XP</span><ThemeToggle compact /><button className="icon-button" type="button" aria-label="More options"><Icon name="more" /></button></div></header>
        <section className="chat-workspace">
          <div className="chat-column">
            {!hasConversation && <div className="chat-empty-state"><div className="quiet-mark"><Icon name="sparkles" size={22} /></div><p className="chat-kicker">Your study workspace</p><h1>{greeting}</h1><p className="chat-intro">Ask a question, add a resource, or start a world. Questify keeps the conversation close to what you are learning.</p><div className="quick-prompts">{quickPrompts.map((item) => <button type="button" key={item.title} className="quick-prompt" onClick={() => sendMessage(item.prompt)}><span>{item.title}</span><Icon name="arrowUp" size={14} /></button>)}</div></div>}
            <div className="message-list" aria-live="polite">
              {messages.map((message) => <div key={message.id} className={`message-row ${message.sender}`}><div className={`message-avatar ${message.sender}`}><Icon name={message.sender === 'assistant' ? 'sparkles' : 'user'} size={15} /></div><div className="message-body"><div className="message-label">{message.sender === 'assistant' ? 'Questify' : 'You'}</div><div className="message-text">{message.text}</div>{message.citations && message.citations.length > 0 && <div className="citation-list"><span className="citation-heading">Sources</span>{message.citations.map((citation, index) => <span className="citation" key={`${citation.source}-${citation.chunk_index}`}>[{index + 1}] {citation.source}{citation.page ? ` · p. ${citation.page}` : ''}</span>)}</div>}</div></div>)}
              {isSending && <div className="message-row assistant"><div className="message-avatar assistant"><Icon name="sparkles" size={15} /></div><div className="message-body"><div className="message-label">Questify</div><div className="typing"><i></i><i></i><i></i></div></div></div>}
            </div>
            {pendingWorld && <div className="world-card"><div className="world-card-icon"><Icon name="sparkles" size={18} /></div><div className="world-card-copy"><strong>Resource ready</strong><span>{pendingWorld.filename} is indexed and ready to become a learning world.</span></div><button className="btn btn-primary" type="button" onClick={generateWorld} disabled={isGeneratingWorld}>{isGeneratingWorld ? 'Generating…' : 'Generate world'} <Icon name="arrowUp" size={14} /></button></div>}
            {generationMessage && <p role="status" style={{ padding: 12, color: 'var(--accent)' }}>{generationMessage} You can leave this page; generation continues on the server.</p>}
            {error && <div className="chat-error"><Icon name="x" size={15} /> {error}</div>}
            <div className="composer-wrap"><div className="composer"><button type="button" className="composer-action" aria-label="Add resource" onClick={() => fileInputRef.current?.click()} disabled={isUploading}><Icon name="plus" size={20} /></button><input ref={fileInputRef} type="file" accept=".pdf,.docx,.txt,.md,.markdown" className="sr-only" onChange={uploadResource} /><textarea value={input} onChange={(event) => setInput(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); sendMessage(); } }} placeholder={isUploading ? 'Indexing your resource…' : 'Ask anything about your studies…'} rows={1} disabled={isUploading} /><button type="button" className={`mode-switch ${gameMode ? 'on' : ''}`} onClick={() => setGameMode((value) => !value)} title="Toggle game mode"><span></span><label>{gameMode ? 'Game' : 'Focus'}</label></button><button type="button" className="send-button" onClick={() => sendMessage()} disabled={isSending || !input.trim()} aria-label="Send message"><Icon name="arrowUp" size={18} /></button></div><div className="composer-hint"><span><Icon name="paperclip" size={12} /> Add PDF, DOCX, TXT or Markdown</span><span>Enter to send · Shift + Enter for a new line</span></div></div>
          </div>
          <aside className="context-rail"><div className="rail-heading"><span>Study context</span><Icon name="more" size={16} /></div>{selectedCourse ? <><div className="context-card"><div className="context-icon"><Icon name="bookOpen" size={18} /></div><strong>{selectedCourse.title}</strong><span>{pendingWorld ? 'Resource uploaded' : 'Active workspace'}</span></div><div className="rail-divider" /><div className="rail-note"><Icon name="sparkles" size={15} /><p>Answers are grounded in the resources attached to this workspace.</p></div></> : <div className="rail-empty"><Icon name="filePlus" size={20} /><strong>Add your first resource</strong><span>Use the plus button below to give your tutor some context.</span><button className="btn" type="button" onClick={() => fileInputRef.current?.click()}><Icon name="upload" size={14} /> Upload resource</button></div>}</aside>
        </section>
      </main>
      <style jsx>{`
        .chat-page { display: flex; flex-direction: column; height: 100vh; }
        .chat-topbar { display: flex; align-items: center; justify-content: space-between; height: 64px; padding: 0 34px; border-bottom: 1px solid var(--border); background: rgba(251,251,250,.86); }
        .mobile-brand { display: none; align-items: center; gap: 8px; font-size: 15px; font-weight: 700; }
        .brand-mark-small { display: grid; place-items: center; width: 24px; height: 24px; border-radius: 6px; background: var(--accent); color: white; font-family: Georgia, serif; }
        .context-select { display: flex; align-items: center; gap: 8px; color: var(--muted-strong); font-size: 13px; }
        .context-select select { max-width: 240px; border: 0; outline: 0; appearance: none; background: transparent; color: var(--foreground); font-weight: 600; cursor: pointer; }
        .topbar-right { display: flex; align-items: center; gap: 15px; }
        .topbar-stat { display: inline-flex; align-items: center; gap: 5px; color: var(--muted); font-size: 12px; }
        .topbar-stat:first-child { color: var(--warm); }
        .icon-button { display: grid; place-items: center; width: 31px; height: 31px; border: 0; border-radius: 8px; background: transparent; color: var(--muted); }
        .icon-button:hover { background: var(--surface-muted); color: var(--foreground); }
        .chat-workspace { display: flex; flex: 1; min-height: 0; }
        .chat-column { display: flex; flex: 1; flex-direction: column; min-width: 0; max-width: 860px; margin: 0 auto; padding: 0 42px; }
        .chat-empty-state { max-width: 660px; margin: auto auto 36px; text-align: center; }
        .quiet-mark { display: grid; place-items: center; width: 45px; height: 45px; margin: 0 auto 17px; border: 1px solid #cbdacf; border-radius: 14px; background: var(--accent-soft); color: var(--accent); }
        .chat-kicker { color: var(--accent); font-size: 11px; font-weight: 700; letter-spacing: .1em; text-transform: uppercase; }
        .chat-empty-state h1 { margin: 8px 0 11px; font-size: clamp(28px, 4vw, 42px); line-height: 1.08; font-weight: 600; letter-spacing: -.055em; }
        .chat-intro { max-width: 500px; margin: 0 auto; color: var(--muted); font-size: 14px; line-height: 1.6; }
        .quick-prompts { display: grid; grid-template-columns: repeat(3, 1fr); gap: 9px; margin-top: 27px; }
        .quick-prompt { display: flex; align-items: center; justify-content: space-between; min-height: 50px; padding: 0 12px; border: 1px solid var(--border); border-radius: 9px; background: var(--surface); color: var(--muted-strong); font-size: 12px; text-align: left; box-shadow: var(--shadow-sm); }
        .quick-prompt:hover { border-color: #b7cbbf; color: var(--accent-ink); background: #f9fcfa; }
        .message-list { display: flex; flex: 1; flex-direction: column; gap: 24px; overflow-y: auto; padding: 34px 0 22px; }
        .message-row { display: flex; align-items: flex-start; gap: 12px; max-width: 760px; }
        .message-row.user { align-self: flex-end; flex-direction: row-reverse; max-width: 680px; }
        .message-avatar { display: grid; flex: 0 0 auto; place-items: center; width: 28px; height: 28px; margin-top: 2px; border-radius: 8px; color: var(--muted-strong); background: var(--surface-muted); }
        .message-avatar.assistant { color: var(--accent); background: var(--accent-soft); }
        .message-row.user .message-avatar { color: white; background: var(--accent); }
        .message-body { min-width: 0; }
        .message-label { margin-bottom: 5px; color: var(--muted); font-size: 11px; font-weight: 600; }
        .message-row.user .message-label { text-align: right; }
        .message-text { color: var(--foreground); font-size: 14px; line-height: 1.65; white-space: pre-wrap; }
        .message-row.user .message-text { padding: 11px 14px; border-radius: 12px 3px 12px 12px; background: var(--accent); color: white; }
        .citation-list { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 12px; padding-top: 10px; border-top: 1px solid var(--border); }
        .citation-heading { width: 100%; color: var(--muted); font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: .08em; }
        .citation { padding: 4px 7px; border: 1px solid #d3e2d9; border-radius: 5px; background: #f2f8f4; color: var(--accent-ink); font-size: 10px; }
        .typing { display: flex; gap: 4px; padding-top: 7px; }
        .typing i { width: 5px; height: 5px; border-radius: 50%; background: #9bb4a5; animation: blink 1.2s infinite; }.typing i:nth-child(2) { animation-delay: .18s; }.typing i:nth-child(3) { animation-delay: .36s; }
        @keyframes blink { 0%, 60%, 100% { opacity: .25; } 30% { opacity: 1; } }
        .world-card { display: flex; align-items: center; gap: 11px; margin-bottom: 11px; padding: 12px; border: 1px solid #cbdacf; border-radius: 11px; background: #f1f8f3; }
        .world-card-icon { display: grid; place-items: center; width: 32px; height: 32px; border-radius: 8px; background: #d9ebdf; color: var(--accent); }
        .world-card-copy { display: flex; flex: 1; flex-direction: column; gap: 2px; min-width: 0; }.world-card-copy strong { font-size: 12px; }.world-card-copy span { color: var(--muted-strong); font-size: 11px; }
        .world-card .btn { min-height: 33px; padding: 0 10px; font-size: 11px; }
        .chat-error { display: flex; align-items: center; gap: 7px; margin-bottom: 10px; padding: 10px 12px; border: 1px solid #e7caca; border-radius: 8px; background: #fff6f6; color: var(--danger); font-size: 12px; }
        .composer-wrap { padding: 12px 0 23px; }
        .composer { display: flex; align-items: flex-end; gap: 8px; min-height: 57px; padding: 8px; border: 1px solid var(--border-strong); border-radius: 13px; background: var(--surface); box-shadow: 0 5px 18px rgba(35,35,29,.06); }
        .composer textarea { flex: 1; align-self: center; min-height: 25px; max-height: 110px; resize: none; padding: 9px 3px; border: 0; outline: 0; background: transparent; color: var(--foreground); font-size: 14px; line-height: 1.4; }
        .composer textarea::placeholder { color: #9b9b93; }
        .composer-action, .send-button { display: grid; flex: 0 0 auto; place-items: center; width: 38px; height: 38px; border: 0; border-radius: 9px; }
        .composer-action { background: var(--surface-muted); color: var(--muted-strong); }.composer-action:hover { background: var(--accent-soft); color: var(--accent); }.composer-action:disabled { opacity: .5; }
        .send-button { background: var(--accent); color: white; }.send-button:disabled { opacity: .35; cursor: default; }
        .mode-switch { display: flex; align-items: center; gap: 5px; align-self: center; border: 0; background: transparent; color: var(--muted); font-size: 10px; }.mode-switch span { width: 22px; height: 13px; border-radius: 99px; background: #d5d5cf; position: relative; }.mode-switch span::after { content: ''; position: absolute; top: 2px; left: 2px; width: 9px; height: 9px; border-radius: 50%; background: white; transition: .18s; }.mode-switch.on { color: var(--accent); }.mode-switch.on span { background: var(--accent); }.mode-switch.on span::after { left: 11px; }
        .composer-hint { display: flex; justify-content: space-between; padding: 7px 4px 0; color: #9a9a92; font-size: 10px; }.composer-hint span { display: inline-flex; align-items: center; gap: 4px; }
        .context-rail { width: 245px; padding: 31px 27px 0 0; }.rail-heading { display: flex; justify-content: space-between; color: var(--muted); font-size: 11px; font-weight: 700; letter-spacing: .08em; text-transform: uppercase; }.context-card { display: flex; flex-direction: column; gap: 5px; margin-top: 17px; padding: 15px; border: 1px solid var(--border); border-radius: 11px; background: var(--surface); box-shadow: var(--shadow-sm); }.context-icon { display: grid; place-items: center; width: 30px; height: 30px; margin-bottom: 5px; border-radius: 8px; background: var(--accent-soft); color: var(--accent); }.context-card strong { font-size: 13px; line-height: 1.35; }.context-card span { color: var(--muted); font-size: 11px; }.rail-divider { height: 1px; margin: 22px 0; background: var(--border); }.rail-note { display: flex; align-items: flex-start; gap: 8px; color: var(--accent); }.rail-note p { color: var(--muted); font-size: 11px; line-height: 1.5; }.rail-empty { display: flex; flex-direction: column; align-items: flex-start; gap: 8px; margin-top: 18px; padding: 15px; border: 1px dashed var(--border-strong); border-radius: 11px; color: var(--muted); }.rail-empty > svg { color: var(--accent); }.rail-empty strong { color: var(--foreground); font-size: 13px; }.rail-empty span { font-size: 11px; line-height: 1.45; }.rail-empty .btn { margin-top: 5px; min-height: 33px; padding: 0 10px; font-size: 11px; }
        @media (max-width: 1100px) { .context-rail { display: none; } .chat-column { max-width: 900px; } }
        @media (max-width: 900px) { .chat-topbar { height: 57px; padding: 0 16px; }.mobile-brand { display: flex; }.context-select { margin-left: auto; }.context-select select { max-width: 145px; font-size: 12px; }.topbar-right { display: flex; gap: 3px; }.topbar-stat, .icon-button { display: none; }.chat-column { padding: 0 16px; }.chat-empty-state { margin-top: auto; }.quick-prompts { grid-template-columns: 1fr; }.quick-prompt { min-height: 42px; }.message-list { padding-top: 20px; }.composer-hint span:last-child { display: none; }.composer-hint { justify-content: center; } }
      `}</style>
    </div>
  );
}
