'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Sidebar, { ChatThread } from '@/components/Sidebar';
import { Icon } from '@/components/Icon';
import ThemeToggle from '@/components/ThemeToggle';
import { fetchApi } from '@/lib/api';
import { generateWorld as requestWorld } from '@/lib/world-generation';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { motion, useReducedMotion } from 'framer-motion';
import { LoadingIndicator } from '@/components/LoadingIndicator';
import MotionPage from '@/components/MotionPage';

interface Course {
  id: string;
  title: string;
  description?: string | null;
}
interface Citation {
  source: string;
  page: number | null;
  excerpt: string;
  chunk_index: number;
}
interface TutorChallenge {
  id: string;
  prompt: string;
  options: string[];
}
interface ChallengeResult {
  correct: boolean;
  selected_answer_index: number;
  correct_answer_index: number;
  explanation: string;
  xp_earned: number;
  total_xp: number;
  already_answered: boolean;
}
interface Message {
  id: string;
  sender: 'user' | 'assistant';
  text: string;
  citations?: Citation[];
  challenge?: TutorChallenge;
  challengeResult?: ChallengeResult;
}
interface TutorResponse {
  response: string;
  mode: string;
  xp_earned: number;
  total_xp: number;
  citations: Citation[];
  grounded: boolean;
  retrieved_chunks: number;
  challenge?: TutorChallenge | null;
}
interface Material {
  id: string;
  course_id: string;
  filename: string;
  status: string;
  summary?: string | null;
}
interface LearningWorld {
  title: string;
  generated: boolean;
  nodes: { id: string; title: string }[];
}
interface User {
  full_name: string;
  xp: number;
  streak_count: number;
  mastery_tier: string;
}
interface Stats {
  xp: number;
  gems: number;
  streak_count: number;
  mastery_tier: string;
  total_courses: number;
  active_quests: Quest[];
}
interface Quest {
  id: string;
  title: string;
  description: string;
  xp_reward: number;
  target_count: number;
  current_count: number;
  is_completed: boolean;
}
interface TodayPlan {
  course_id: string;
  course_title: string;
  estimated_minutes: number;
  due_flashcards: number;
  weak_topics: { node_id: string; title: string; mastery_score: number }[];
  unfinished_levels: {
    node_id: string;
    title: string;
    solved_questions: number;
    total_questions: number;
  }[];
  recommended_quiz?: { quiz_id: string; title: string; difficulty: string } | null;
  active_quest?: Quest | null;
}
type DeleteTarget = { kind: 'conversation' | 'world'; thread: ChatThread };

const welcomeMessage: Message = {
  id: 'welcome',
  sender: 'assistant',
  text: 'Hi, I’m Questify. Upload a resource or ask a question to start a focused study session. I’ll keep answers grounded in your materials and show the source below each answer.',
};

function titleFromFilename(filename: string) {
  return (
    filename
      .replace(/\.[^/.]+$/, '')
      .replace(/[-_]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .replace(/\b\w/g, (letter) => letter.toUpperCase()) || 'New resource'
  );
}

export default function DashboardPage() {
  const reduceMotion = useReducedMotion();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [courses, setCourses] = useState<Course[]>([]);
  const [selectedCourseId, setSelectedCourseId] = useState('');
  const [threads, setThreads] = useState<ChatThread[]>([{ id: 'new', title: 'New conversation' }]);
  const [activeThreadId, setActiveThreadId] = useState('new');
  const [messagesByThread, setMessagesByThread] = useState<Record<string, Message[]>>({
    new: [welcomeMessage],
  });
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
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget | null>(null);
  const [isResolvingContext, setIsResolvingContext] = useState(false);
  const [todayPlan, setTodayPlan] = useState<TodayPlan | null>(null);
  const [claimingQuest, setClaimingQuest] = useState(false);
  const [answeringChallengeId, setAnsweringChallengeId] = useState<string | null>(null);

  const messages = messagesByThread[activeThreadId] || [welcomeMessage];
  const activeThread = threads.find((thread) => thread.id === activeThreadId);
  const selectedCourse = courses.find((course) => course.id === selectedCourseId);
  const activeQuest = todayPlan?.active_quest || stats?.active_quests?.[0];
  const canCreateWorld = Boolean(
    activeThread?.courseId &&
    activeThread.materialId &&
    activeThread.resourceReady &&
    !activeThread.worldTitle &&
    !isResolvingContext &&
    !isUploading &&
    !isSending,
  );
  const hasConversation = messages.some((message) => message.sender === 'user');
  const greeting = user?.full_name
    ? `What are you working on, ${user.full_name.split(' ')[0]}?`
    : 'What do you want to understand?';

  useEffect(() => {
    Promise.allSettled([
      fetchApi<Course[]>('/courses'),
      fetchApi<User>('/auth/me'),
      fetchApi<Stats>('/gamification/dashboard'),
    ]).then(([courseResult, userResult, statsResult]) => {
      if (courseResult.status === 'fulfilled') {
        setCourses(courseResult.value);
        setSelectedCourseId((current) => current || courseResult.value[0]?.id || '');
      }
      if (userResult.status === 'fulfilled') setUser(userResult.value);
      if (statsResult.status === 'fulfilled') setStats(statsResult.value);
    });
  }, []);

  useEffect(() => {
    if (!selectedCourseId) {
      setTodayPlan(null);
      return;
    }
    let active = true;
    fetchApi<TodayPlan>(`/learning/today?course_id=${selectedCourseId}&minutes=20`)
      .then((plan) => active && setTodayPlan(plan))
      .catch(() => active && setTodayPlan(null));
    return () => {
      active = false;
    };
  }, [selectedCourseId, stats]);

  async function claimQuest(quest: Quest) {
    if (claimingQuest || quest.current_count < quest.target_count) return;
    setClaimingQuest(true);
    try {
      await fetchApi(`/gamification/quests/${quest.id}/claim`, { method: 'POST' });
      const refreshed = await fetchApi<Stats>('/gamification/dashboard');
      setStats(refreshed);
      window.dispatchEvent(new Event('questify:metrics-updated'));
    } catch (claimError) {
      setError(claimError instanceof Error ? claimError.message : 'Could not claim this quest.');
    } finally {
      setClaimingQuest(false);
    }
  }

  useEffect(() => {
    const refreshMetrics = () =>
      fetchApi<Stats>('/gamification/dashboard')
        .then(setStats)
        .catch(() => undefined);
    window.addEventListener('questify:metrics-updated', refreshMetrics);
    return () => window.removeEventListener('questify:metrics-updated', refreshMetrics);
  }, []);

  useEffect(() => {
    try {
      const saved = localStorage.getItem('questify_chats');
      if (saved) {
        const parsed = JSON.parse(saved) as {
          threads?: ChatThread[];
          messages?: Record<string, Message[]>;
          activeThreadId?: string;
        };
        if (parsed.threads?.length && parsed.messages) {
          setThreads(parsed.threads);
          setMessagesByThread(parsed.messages);
          setActiveThreadId(
            parsed.activeThreadId && parsed.messages[parsed.activeThreadId]
              ? parsed.activeThreadId
              : parsed.threads[0].id,
          );
        }
      }
    } catch {
      /* A malformed local cache should never block the workspace. */
    }
    setChatStateReady(true);
  }, []);

  useEffect(() => {
    if (!chatStateReady) return;
    localStorage.setItem(
      'questify_chats',
      JSON.stringify({ threads, messages: messagesByThread, activeThreadId }),
    );
  }, [activeThreadId, chatStateReady, messagesByThread, threads]);

  useEffect(() => {
    setSelectedCourseId(activeThread?.courseId || '');
    const threadId = activeThreadId;
    const courseId = activeThread?.courseId;
    if (!courseId) {
      setIsResolvingContext(false);
      return;
    }
    let cancelled = false;
    setIsResolvingContext(true);
    async function resolveContext() {
      try {
        const materials = await fetchApi<Material[]>(`/courses/${courseId}/materials`);
        if (cancelled) return;
        const readyMaterials = materials.filter((material) => material.status === 'completed');
        const ready =
          readyMaterials.find((material) => material.id === activeThread?.materialId) ||
          readyMaterials[0];
        if (!ready) {
          setThreads((current) =>
            current.map((thread) =>
              thread.id === threadId
                ? { ...thread, materialId: undefined, resourceReady: false, worldTitle: undefined }
                : thread,
            ),
          );
          return;
        }
        const world = await fetchApi<LearningWorld>(
          `/learning/courses/${courseId}/world?material_id=${ready.id}`,
        );
        if (cancelled) return;
        setThreads((current) =>
          current.map((thread) =>
            thread.id === threadId
              ? {
                  ...thread,
                  materialId: ready.id,
                  resourceReady: true,
                  worldTitle: world.generated ? world.title : undefined,
                }
              : thread,
          ),
        );
      } catch (err) {
        if (!cancelled)
          setError(
            err instanceof Error ? err.message : 'Could not check this workspace for resources.',
          );
      } finally {
        if (!cancelled) setIsResolvingContext(false);
      }
    }
    void resolveContext();
    return () => {
      cancelled = true;
    };
  }, [activeThreadId, activeThread?.courseId, activeThread?.materialId]);

  const updateActiveMessages = (updater: (current: Message[]) => Message[]) => {
    setMessagesByThread((current) => ({
      ...current,
      [activeThreadId]: updater(current[activeThreadId] || [welcomeMessage]),
    }));
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
    setThreads((current) =>
      current.map((thread) => (thread.id === activeThreadId ? { ...thread, title } : thread)),
    );
  };

  const updateActiveThread = (updates: Partial<ChatThread>) => {
    setThreads((current) =>
      current.map((thread) => (thread.id === activeThreadId ? { ...thread, ...updates } : thread)),
    );
  };

  const sendMessage = async (preset?: string) => {
    const message = (preset ?? input).trim();
    if (!message || isSending) return;
    setError('');
    updateActiveMessages((current) => [
      ...current,
      { id: `user-${Date.now()}`, sender: 'user', text: message },
    ]);
    setInput('');
    setIsSending(true);
    try {
      const courseId = activeThread?.courseId || (await ensureCourse('General Study'));
      const result = await fetchApi<TutorResponse>('/tutor/chat', {
        method: 'POST',
        body: JSON.stringify({ message, mode: gameMode ? 'game' : 'normal', course_id: courseId }),
      });
      updateActiveMessages((current) => [
        ...current,
        {
          id: `assistant-${Date.now()}`,
          sender: 'assistant',
          // The API also includes a markdown fallback for older clients. The
          // current client renders the structured challenge directly.
          text: result.challenge
            ? 'Choose the best answer. A correct response earns 5 XP.'
            : result.response,
          citations: result.citations,
          challenge: result.challenge || undefined,
        },
      ]);
      if (
        !hasConversation &&
        threads.find((thread) => thread.id === activeThreadId)?.title === 'New conversation'
      )
        updateThreadTitle(message.length > 34 ? `${message.slice(0, 34)}…` : message);
      setStats((current) => (current ? { ...current, xp: result.total_xp } : current));
      if (result.xp_earned) window.dispatchEvent(new Event('questify:metrics-updated'));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'The tutor could not be reached.');
    } finally {
      setIsSending(false);
    }
  };

  const answerChallenge = async (messageId: string, challengeId: string, answerIndex: number) => {
    if (answeringChallengeId) return;
    setAnsweringChallengeId(challengeId);
    setError('');
    try {
      const result = await fetchApi<ChallengeResult>(
        `/tutor/challenges/${challengeId}/answer`,
        {
          method: 'POST',
          body: JSON.stringify({ answer_index: answerIndex }),
        },
      );
      updateActiveMessages((current) =>
        current.map((message) =>
          message.id === messageId ? { ...message, challengeResult: result } : message,
        ),
      );
      setStats((current) => (current ? { ...current, xp: result.total_xp } : current));
      if (result.xp_earned) window.dispatchEvent(new Event('questify:metrics-updated'));
    } catch (challengeError) {
      setError(
        challengeError instanceof Error
          ? challengeError.message
          : 'The challenge answer could not be submitted.',
      );
    } finally {
      setAnsweringChallengeId(null);
    }
  };

  const ensureCourse = async (filename: string) => {
    if (activeThread?.courseId) return activeThread.courseId;
    const title = titleFromFilename(filename);
    const course = await fetchApi<Course>('/courses', {
      method: 'POST',
      body: JSON.stringify({ title, description: `Study workspace for ${filename}` }),
    });
    setCourses((current) => [course, ...current]);
    setStats((current) =>
      current ? { ...current, total_courses: current.total_courses + 1 } : current,
    );
    setSelectedCourseId(course.id);
    updateActiveThread({ courseId: course.id });
    return course.id;
  };

  const uploadResource = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file || isUploading || isGeneratingWorld || isSending) return;
    setIsUploading(true);
    setError('');
    try {
      const course = await fetchApi<Course>('/courses', {
        method: 'POST',
        body: JSON.stringify({
          title: titleFromFilename(file.name),
          description: `Study workspace for ${file.name}`,
        }),
      });
      const courseId = course.id;
      const formData = new FormData();
      formData.append('file', file);
      const material = await fetchApi<Material>(`/courses/${courseId}/materials/upload`, {
        method: 'POST',
        body: formData,
      });
      const title = titleFromFilename(material.filename);
      const threadId = activeThread?.resourceReady ? `chat-${crypto.randomUUID()}` : activeThreadId;
      const resourceThread: ChatThread = {
        id: threadId,
        title: `${title} study chat`,
        courseId,
        materialId: material.id,
        resourceReady: true,
      };
      setThreads((current) =>
        threadId === activeThreadId
          ? current.map((thread) => (thread.id === threadId ? resourceThread : thread))
          : [resourceThread, ...current],
      );
      setMessagesByThread((current) => ({
        ...current,
        [threadId]: [
          ...(threadId === activeThreadId ? current[threadId] || [] : [welcomeMessage]),
          {
            id: `upload-${Date.now()}`,
            sender: 'assistant',
            text: `Indexed ${material.filename}. Create a world to learn its concepts step by step.`,
          },
        ],
      }));
      setActiveThreadId(threadId);
      setSelectedCourseId(courseId);
      setCourses((current) => [course, ...current]);
      setPendingWorld(material);
      setStats((current) =>
        current ? { ...current, total_courses: current.total_courses + 1 } : current,
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'The resource could not be uploaded.');
    } finally {
      setIsUploading(false);
    }
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
        materialId = materials.find((material) => material.status === 'completed')?.id;
      }
      if (!materialId) throw new Error('Upload a resource before creating a world.');
      const world = await requestWorld<LearningWorld>(courseId, materialId, (status) =>
        setGenerationMessage(`${status.progress}% · ${status.message}`),
      );
      updateActiveMessages((current) => [
        ...current,
        {
          id: `world-${Date.now()}`,
          sender: 'assistant',
          text: `Your learning world is ready: ${world.title}. I created ${world.nodes.length} levels, with a lesson, concept game, and flashcards for each level. You can open them from the sidebar whenever you are ready.`,
        },
      ]);
      updateActiveThread({ courseId, materialId, resourceReady: true, worldTitle: world.title });
      setPendingWorld(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'The learning world could not be generated.');
    } finally {
      setIsGeneratingWorld(false);
      setGenerationMessage('');
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    const { kind, thread } = deleteTarget;
    setError('');
    try {
      if (kind === 'world') {
        if (!thread.courseId || !thread.materialId)
          throw new Error('This world is missing its workspace information.');
        await fetchApi(
          `/learning/courses/${thread.courseId}/world?material_id=${thread.materialId}`,
          { method: 'DELETE' },
        );
        setThreads((current) =>
          current.map((item) =>
            item.id === thread.id ? { ...item, worldTitle: undefined } : item,
          ),
        );
      } else {
        const remaining = threads.filter((item) => item.id !== thread.id);
        if (remaining.length) {
          setThreads(remaining);
          setMessagesByThread((current) => {
            const next = { ...current };
            delete next[thread.id];
            return next;
          });
          if (activeThreadId === thread.id) setActiveThreadId(remaining[0].id);
        } else {
          const id = `chat-${Date.now()}`;
          setThreads([{ id, title: 'New conversation' }]);
          setMessagesByThread({ [id]: [welcomeMessage] });
          setActiveThreadId(id);
        }
      }
      setDeleteTarget(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : `The ${kind} could not be deleted.`);
    }
  };

  const quickPrompts = useMemo(
    () => [
      {
        title: 'Explain a concept',
        prompt: 'Explain the most important concept in this resource in simple terms.',
      },
      { title: 'Make a study plan', prompt: 'Make a short study plan for this resource.' },
      {
        title: 'Test my understanding',
        prompt: 'Give me three questions to test my understanding of this resource.',
      },
    ],
    [],
  );

  return (
    <div className="app-shell">
      <Sidebar
        threads={threads}
        activeThreadId={activeThreadId}
        onNewChat={startNewChat}
        onSelectThread={(id) => {
          const thread = threads.find((item) => item.id === id);
          setActiveThreadId(id);
          if (thread?.courseId) setSelectedCourseId(thread.courseId);
          setPendingWorld(null);
          setError('');
        }}
        onDeleteThread={(thread) => setDeleteTarget({ kind: 'conversation', thread })}
        onDeleteWorld={(thread) => setDeleteTarget({ kind: 'world', thread })}
        canCreateWorld={canCreateWorld}
        isCreatingWorld={isGeneratingWorld}
        isCheckingWorld={isResolvingContext}
        onCreateWorld={generateWorld}
      />
      <MotionPage className="page-content chat-page">
        <header className="chat-topbar">
          <div className="mobile-brand">
            <span className="brand-mark-small">Q</span> Questify
          </div>
          <div className="context-select">
            <Icon name="bookOpen" size={15} />
            <select
              value={selectedCourseId}
              onChange={(event) => {
                const courseId = event.target.value;
                setSelectedCourseId(courseId);
                updateActiveThread({
                  courseId: courseId || undefined,
                  materialId: undefined,
                  resourceReady: false,
                  worldTitle: undefined,
                });
              }}
              aria-label="Study context"
            >
              <option value="">Choose study context</option>
              {courses.map((course) => (
                <option key={course.id} value={course.id}>
                  {course.title}
                </option>
              ))}
            </select>
            <Icon name="chevronDown" size={14} />
          </div>
          <div className="topbar-right">
            <span className="topbar-stat">
              <Icon name="flame" size={20} /> {stats?.streak_count ?? user?.streak_count ?? 0}
            </span>
            <span className="topbar-stat">
              <Icon name="sparkles" size={20} /> {stats?.xp ?? user?.xp ?? 0} XP
            </span>
            <span className="topbar-stat text-lg">💎 {stats?.gems ?? 20}</span>
            <ThemeToggle compact />
            <button className="icon-button" type="button" aria-label="More options">
              <Icon name="more" />
            </button>
          </div>
        </header>
        <section className="chat-workspace">
          <div className="chat-column">
            {!hasConversation && (
              <div className="chat-empty-state">
                <div className="quiet-mark">
                  <Icon name="sparkles" size={22} />
                </div>
                <p className="chat-kicker">Your study workspace</p>
                <h1>{greeting}</h1>
                <p className="chat-intro">
                  Ask a question, add a resource, or start a world. Questify keeps the conversation
                  close to what you are learning.
                </p>
                <div className="quick-prompts">
                  {quickPrompts.map((item) => (
                    <motion.button
                      type="button"
                      key={item.title}
                      className="quick-prompt"
                      onClick={() => sendMessage(item.prompt)}
                      whileHover={reduceMotion ? undefined : { y: -3 }}
                      whileTap={reduceMotion ? undefined : { scale: 0.98 }}
                      transition={{ type: 'spring', stiffness: 360, damping: 28 }}
                    >
                      <span>{item.title}</span>
                      <Icon name="arrowUp" size={14} />
                    </motion.button>
                  ))}
                </div>
              </div>
            )}
            <div className="message-list" aria-live="polite">
              {messages.map((message) => (
                <motion.div
                  key={message.id}
                  className={`message-row ${message.sender}`}
                  initial={reduceMotion ? false : { opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
                >
                  <div className={`message-avatar ${message.sender}`}>
                    <Icon name={message.sender === 'assistant' ? 'sparkles' : 'user'} size={15} />
                  </div>
                  <div className="message-body">
                    <div className="message-label">
                      {message.sender === 'assistant' ? 'Questify' : 'You'}
                    </div>
                    {message.sender === 'assistant' ? (
                      <div className="message-text markdown-response">
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>{message.text}</ReactMarkdown>
                      </div>
                    ) : (
                      <div className="message-text">{message.text}</div>
                    )}
                    {message.challenge && (
                      <section className="chat-challenge" aria-label="Game mode challenge">
                        <div className="challenge-heading">
                          <span>Game challenge</span>
                          <b>+5 XP</b>
                        </div>
                        <p>{message.challenge.prompt}</p>
                        <div className="challenge-options">
                          {message.challenge.options.map((option, optionIndex) => {
                            const result = message.challengeResult;
                            const selected = result?.selected_answer_index === optionIndex;
                            const correct = result?.correct_answer_index === optionIndex;
                            return (
                              <button
                                type="button"
                                key={`${message.challenge?.id}-${optionIndex}`}
                                disabled={Boolean(result) || answeringChallengeId === message.challenge?.id}
                                className={`${selected ? 'selected' : ''} ${result && correct ? 'correct' : ''} ${result && selected && !correct ? 'wrong' : ''}`}
                                onClick={() =>
                                  answerChallenge(message.id, message.challenge!.id, optionIndex)
                                }
                              >
                                <span>{String.fromCharCode(65 + optionIndex)}</span>
                                {option}
                              </button>
                            );
                          })}
                        </div>
                        {message.challengeResult && (
                          <div
                            className={`challenge-feedback ${message.challengeResult.correct ? 'success' : 'incorrect'}`}
                            role="status"
                          >
                            <strong>
                              {message.challengeResult.correct
                                ? `Correct! +${message.challengeResult.xp_earned} XP`
                                : 'Not quite — review the answer below.'}
                            </strong>
                            <p>{message.challengeResult.explanation}</p>
                          </div>
                        )}
                      </section>
                    )}
                    {message.citations && message.citations.length > 0 && (
                      <div className="citation-list">
                        <span className="citation-heading">Sources</span>
                        {message.citations.map((citation, index) => (
                          <span
                            className="citation"
                            key={`${citation.source}-${citation.chunk_index}`}
                          >
                            [{index + 1}] {citation.source}
                            {citation.page ? ` · p. ${citation.page}` : ''}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </motion.div>
              ))}
              {isSending && (
                <div className="message-row assistant">
                  <div className="message-avatar assistant">
                    <Icon name="sparkles" size={15} />
                  </div>
                  <div className="message-body">
                    <div className="message-label">Questify</div>
                    <div className="typing">
                      <i></i>
                      <i></i>
                      <i></i>
                    </div>
                  </div>
                </div>
              )}
            </div>
            {pendingWorld && (
              <motion.div
                className="world-card"
                initial={reduceMotion ? false : { opacity: 0, y: 14, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ type: 'spring', stiffness: 320, damping: 26 }}
              >
                <div className="world-card-icon">
                  <Icon name="sparkles" size={18} />
                </div>
                <div className="world-card-copy">
                  <strong>Resource ready</strong>
                  <span>
                    {pendingWorld.filename} is indexed and ready to become a learning world.
                  </span>
                </div>
                <button
                  className="btn btn-primary"
                  type="button"
                  onClick={generateWorld}
                  disabled={isGeneratingWorld}
                >
                  {isGeneratingWorld && <LoadingIndicator label="Generating world" size="small" />}
                  {isGeneratingWorld ? 'Generating…' : 'Generate world'}{' '}
                  {!isGeneratingWorld && <Icon name="arrowUp" size={14} />}
                </button>
              </motion.div>
            )}
            {generationMessage && (
              <p role="status" style={{ padding: 12, color: 'var(--accent)' }}>
                {generationMessage} You can leave this page; generation continues on the server.
              </p>
            )}
            {error && (
              <div className="chat-error">
                <Icon name="x" size={15} /> {error}
              </div>
            )}
            <div className="composer-wrap">
              <div className="composer">
                <button
                  type="button"
                  className="composer-action"
                  aria-label="Add resource"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isUploading}
                >
                  {isUploading ? (
                    <LoadingIndicator label="Indexing resource" size="small" />
                  ) : (
                    <Icon name="plus" size={20} />
                  )}
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf,.docx,.txt,.md,.markdown"
                  className="sr-only"
                  onChange={uploadResource}
                />
                <textarea
                  value={input}
                  onChange={(event) => setInput(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' && !event.shiftKey) {
                      event.preventDefault();
                      sendMessage();
                    }
                  }}
                  placeholder={
                    isUploading
                      ? 'Indexing your resource…'
                      : gameMode
                        ? 'Choose a topic for your next challenge…'
                        : 'Ask anything about your studies…'
                  }
                  rows={1}
                  disabled={isUploading}
                />
                <div className="mode-control">
                  <button
                    type="button"
                    className={`mode-switch ${gameMode ? 'on' : ''}`}
                    onClick={() => setGameMode((value) => !value)}
                    aria-describedby="mode-help"
                  >
                    <span></span>
                    <em>{gameMode ? 'Game' : 'Focus'}</em>
                  </button>
                  <div className="mode-popup" id="mode-help" role="tooltip">
                    <b>Focus mode</b>
                    <p>Grounded AI tutor explanations from your study context.</p>
                    <b>Game mode</b>
                    <p>
                      Challenge-style replies award XP, which raises your mastery tier. Use Create
                      world for the full adventure map.
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  className="send-button"
                  onClick={() => sendMessage()}
                  disabled={isSending || !input.trim()}
                  aria-label="Send message"
                >
                  <Icon name="arrowUp" size={18} />
                </button>
              </div>
              <div className="composer-hint">
                <span>
                  <Icon name="paperclip" size={12} /> Add PDF, DOCX, TXT or Markdown
                </span>
                <span>Enter to send · Shift + Enter for a new line</span>
              </div>
            </div>
          </div>
          <aside className="context-rail">
            <div className="rail-heading">
              <span>Study context</span>
              <Icon name="more" size={16} />
            </div>
            {selectedCourse ? (
              <>
                <div className="context-card">
                  <div className="context-icon">
                    <Icon name="bookOpen" size={18} />
                  </div>
                  <strong>{selectedCourse.title}</strong>
                  <span>{pendingWorld ? 'Resource uploaded' : 'Active workspace'}</span>
                </div>
                <div className="rail-divider" />
                <div className="rail-note">
                  <Icon name="sparkles" size={15} />
                  <p>Answers are grounded in the resources attached to this workspace.</p>
                </div>
                {todayPlan && (
                  <section className="today-plan">
                    <header>
                      <div>
                        <span>Today&apos;s plan</span>
                        <strong>{todayPlan.estimated_minutes} min</strong>
                      </div>
                      <Icon name="target" size={17} />
                    </header>
                    <a href="/flashcards">
                      <b>{todayPlan.due_flashcards}</b>
                      <span>flashcards due</span>
                    </a>
                    <a href="/roadmap">
                      <b>{todayPlan.unfinished_levels.length}</b>
                      <span>levels to continue</span>
                    </a>
                    {todayPlan.recommended_quiz && (
                      <a href="/quizzes" className="plan-recommendation">
                        <span>Recommended quiz</span>
                        <strong>{todayPlan.recommended_quiz.title}</strong>
                      </a>
                    )}
                    {todayPlan.weak_topics[0] && (
                      <p>
                        Focus topic: <b>{todayPlan.weak_topics[0].title}</b>
                      </p>
                    )}
                  </section>
                )}
                {activeQuest && (
                  <section className="quest-card">
                    <span>Daily quest · +{activeQuest.xp_reward} XP</span>
                    <strong>{activeQuest.title}</strong>
                    <p>{activeQuest.description}</p>
                    <i>
                      <b
                        style={{
                          width: `${Math.min(100, (activeQuest.current_count / activeQuest.target_count) * 100)}%`,
                        }}
                      />
                    </i>
                    <footer>
                      <span>
                        {activeQuest.current_count}/{activeQuest.target_count}
                      </span>
                      <button
                        type="button"
                        disabled={
                          claimingQuest || activeQuest.current_count < activeQuest.target_count
                        }
                        onClick={() => claimQuest(activeQuest)}
                      >
                        {claimingQuest ? 'Claiming…' : 'Claim'}
                      </button>
                    </footer>
                  </section>
                )}
              </>
            ) : (
              <div className="rail-empty">
                <Icon name="filePlus" size={20} />
                <strong>Add your first resource</strong>
                <span>Use the plus button below to give your tutor some context.</span>
                <button className="btn" type="button" onClick={() => fileInputRef.current?.click()}>
                  <Icon name="upload" size={14} /> Upload resource
                </button>
              </div>
            )}
          </aside>
        </section>
      </MotionPage>
      {deleteTarget && (
        <div
          className="confirm-backdrop"
          role="presentation"
          onMouseDown={(event) => event.target === event.currentTarget && setDeleteTarget(null)}
        >
          <section
            className="confirm-dialog"
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="confirm-title"
          >
            <div className="confirm-icon">
              <Icon name="trash" size={20} />
            </div>
            <h2 id="confirm-title">Delete this {deleteTarget.kind}?</h2>
            <p>
              {deleteTarget.kind === 'world'
                ? `This removes “${deleteTarget.thread.worldTitle}” and its saved level progress. Your uploaded resource and chat stay available.`
                : `This removes “${deleteTarget.thread.title}” from this browser. This cannot be undone.`}
            </p>
            <div>
              <button type="button" className="btn" onClick={() => setDeleteTarget(null)}>
                Cancel
              </button>
              <button type="button" className="btn confirm-delete" onClick={confirmDelete}>
                Delete
              </button>
            </div>
          </section>
        </div>
      )}
      <style jsx>{`
        .chat-page {
          display: flex;
          flex-direction: column;
          height: 100vh;
        }
        .chat-topbar {
          display: flex;
          align-items: center;
          justify-content: space-between;
          height: 64px;
          padding: 0 34px;
          border-bottom: 1px solid var(--border);
          background: rgba(251, 251, 250, 0.86);
        }
        .mobile-brand {
          display: none;
          align-items: center;
          gap: 8px;
          font-size: 16px;
          font-weight: 700;
        }
        .brand-mark-small {
          display: grid;
          place-items: center;
          width: 24px;
          height: 24px;
          border-radius: 6px;
          background: var(--accent);
          color: white;
          font-family: Georgia, serif;
        }
        .context-select {
          display: flex;
          align-items: center;
          gap: 8px;
          color: var(--muted-strong);
          font-size: 15px;
        }
        .context-select select {
          max-width: 240px;
          border: 0;
          outline: 0;
          appearance: none;
          background: transparent;
          color: var(--foreground);
          font-weight: 600;
          cursor: pointer;
        }
        .topbar-right {
          display: flex;
          align-items: center;
          gap: 15px;
        }
        .topbar-stat {
          display: inline-flex;
          align-items: center;
          gap: 5px;
          color: var(--muted);
          font-size: 14px;
        }
        .topbar-stat:first-child {
          color: var(--warm);
        }
        .icon-button {
          display: grid;
          place-items: center;
          width: 31px;
          height: 31px;
          border: 0;
          border-radius: 8px;
          background: transparent;
          color: var(--muted);
        }
        .icon-button:hover {
          background: var(--surface-muted);
          color: var(--foreground);
        }
        .chat-workspace {
          display: flex;
          flex: 1;
          min-height: 0;
        }
        .chat-column {
          display: flex;
          flex: 1;
          flex-direction: column;
          min-width: 0;
          max-width: 860px;
          margin: 0 auto;
          padding: 0 42px;
        }
        .chat-empty-state {
          max-width: 660px;
          margin: auto auto 36px;
          text-align: center;
        }
        .quiet-mark {
          display: grid;
          place-items: center;
          width: 45px;
          height: 45px;
          margin: 0 auto 17px;
          border: 1px solid #cbdacf;
          border-radius: 14px;
          background: var(--accent-soft);
          color: var(--accent);
        }
        .chat-kicker {
          color: var(--accent);
          font-size: 13px;
          font-weight: 700;
          letter-spacing: 0.1em;
          text-transform: uppercase;
        }
        .chat-empty-state h1 {
          margin: 8px 0 11px;
          font-size: clamp(30px, 4vw, 44px);
          line-height: 1.08;
          font-weight: 600;
          letter-spacing: -0.055em;
        }
        .chat-intro {
          max-width: 500px;
          margin: 0 auto;
          color: var(--muted);
          font-size: 15px;
          line-height: 1.6;
        }
        .quick-prompts {
          display: flex;
          justify-content: center;
          align-items: center;
          flex-wrap: wrap;
          gap: 10px;
          margin-top: 27px;
        }

        :global(.quick-prompt) {
          appearance: none;
          -webkit-appearance: none;

          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 8px;

          min-height: 42px;
          padding: 0 16px;

          border: 1px solid var(--border-strong);
          border-radius: 10px;

          background: var(--surface);
          color: var(--foreground);

          font-family: inherit;
          font-size: 15px;
          font-weight: 500;
          line-height: 1;

          white-space: nowrap;
          text-align: center;

          cursor: pointer;
          box-shadow: var(--shadow-sm);
        }

        :global(.quick-prompt:hover) {
          border-color: #b7cbbf;
          background: var(--accent-soft);
          color: var(--accent-ink);
        }

        :global(.quick-prompt span) {
          display: inline-block;
          line-height: 1;
        }

        :global(.quick-prompt svg) {
          flex-shrink: 0;
        }
        .message-list {
          display: flex;
          flex: 1;
          flex-direction: column;
          gap: 24px;
          overflow-y: auto;
          padding: 34px 0 22px;
        }
        .message-row {
          display: flex;
          align-items: flex-start;
          gap: 12px;
          max-width: 760px;
        }
        .message-row.user {
          align-self: flex-end;
          flex-direction: row-reverse;
          max-width: 680px;
        }
        .message-avatar {
          display: grid;
          flex: 0 0 auto;
          place-items: center;
          width: 28px;
          height: 28px;
          margin-top: 2px;
          border-radius: 8px;
          color: var(--muted-strong);
          background: var(--surface-muted);
        }
        .message-avatar.assistant {
          color: var(--accent);
          background: var(--accent-soft);
        }
        .message-row.user .message-avatar {
          color: white;
          background: var(--accent);
        }
        .message-body {
          min-width: 0;
        }
        .message-label {
          margin-bottom: 5px;
          color: var(--muted);
          font-size: 13px;
          font-weight: 600;
        }
        .message-row.user .message-label {
          text-align: right;
        }
        .message-text {
          color: var(--foreground);
          font-size: 15px;
          line-height: 1.65;
          white-space: pre-wrap;
        }
        .markdown-response {
          white-space: normal;
          overflow-wrap: anywhere;
        }
        .markdown-response :global(p) {
          margin: 0 0 10px;
        }
        .markdown-response :global(p:last-child) {
          margin-bottom: 0;
        }
        .markdown-response :global(h1),
        .markdown-response :global(h2),
        .markdown-response :global(h3) {
          margin: 18px 0 8px;
          line-height: 1.25;
          font-weight: 700;
        }
        .markdown-response :global(h1) {
          font-size: 23px;
        }
        .markdown-response :global(h2) {
          font-size: 19px;
        }
        .markdown-response :global(h3) {
          font-size: 16px;
        }
        .markdown-response :global(ul),
        .markdown-response :global(ol) {
          margin: 8px 0 12px;
          padding-left: 23px;
        }
        .markdown-response :global(li) {
          margin: 4px 0;
        }
        .markdown-response :global(blockquote) {
          margin: 12px 0;
          padding: 8px 12px;
          border-left: 3px solid var(--accent);
          background: var(--accent-soft);
          color: var(--muted-strong);
        }
        .markdown-response :global(pre) {
          overflow-x: auto;
          margin: 12px 0;
          padding: 12px;
          border-radius: 8px;
          background: #171a18;
          color: #eef4ef;
          font-size: 14px;
        }
        .markdown-response :global(code:not(pre code)) {
          padding: 2px 5px;
          border-radius: 4px;
          background: var(--surface-muted);
          font-size: 0.9em;
        }
        .markdown-response :global(table) {
          display: block;
          max-width: 100%;
          overflow-x: auto;
          border-collapse: collapse;
          margin: 12px 0;
        }
        .markdown-response :global(th),
        .markdown-response :global(td) {
          padding: 7px 9px;
          border: 1px solid var(--border);
          text-align: left;
        }
        .markdown-response :global(a) {
          color: var(--accent);
          text-decoration: underline;
        }
        .message-row.user .message-text {
          padding: 11px 14px;
          border-radius: 12px 3px 12px 12px;
          background: var(--accent);
          color: white;
        }
        .citation-list {
          display: flex;
          flex-wrap: wrap;
          gap: 6px;
          margin-top: 12px;
          padding-top: 10px;
          border-top: 1px solid var(--border);
        }
        .chat-challenge {
          width: min(620px, 100%);
          margin-top: 14px;
          padding: 17px;
          border: 1px solid #c9dacf;
          border-radius: 13px;
          background: color-mix(in srgb, var(--accent-soft) 55%, var(--surface));
        }
        .challenge-heading {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 9px;
          color: var(--accent);
          font-size: 12px;
          font-weight: 800;
          letter-spacing: 0.08em;
          text-transform: uppercase;
        }
        .challenge-heading b {
          padding: 3px 7px;
          border-radius: 99px;
          background: var(--accent);
          color: white;
          font-size: 11px;
          letter-spacing: 0;
        }
        .chat-challenge > p {
          margin: 0 0 13px;
          font-size: 16px;
          font-weight: 650;
          line-height: 1.45;
        }
        .challenge-options {
          display: grid;
          gap: 8px;
        }
        .challenge-options button {
          display: flex;
          align-items: center;
          gap: 10px;
          width: 100%;
          padding: 10px 12px;
          border: 1px solid var(--border-strong);
          border-radius: 9px;
          background: var(--surface);
          color: var(--foreground);
          font: inherit;
          font-size: 14px;
          line-height: 1.35;
          text-align: left;
          cursor: pointer;
          transition: border-color 0.16s, background 0.16s, transform 0.16s;
        }
        .challenge-options button:not(:disabled):hover {
          border-color: var(--accent);
          background: var(--accent-soft);
          transform: translateY(-1px);
        }
        .challenge-options button:disabled {
          cursor: default;
          opacity: 0.78;
        }
        .challenge-options button span {
          display: grid;
          flex: 0 0 auto;
          place-items: center;
          width: 25px;
          height: 25px;
          border: 1px solid currentColor;
          border-radius: 50%;
          font-size: 12px;
          font-weight: 700;
        }
        .challenge-options button.correct {
          border-color: #4f8a67;
          background: #e8f5ec;
          color: #245d3d;
          opacity: 1;
        }
        .challenge-options button.wrong {
          border-color: #bd6b6b;
          background: #fff0f0;
          color: #8b3232;
          opacity: 1;
        }
        .challenge-feedback {
          margin-top: 12px;
          padding: 11px 12px;
          border-radius: 9px;
          font-size: 14px;
          line-height: 1.45;
        }
        .challenge-feedback.success {
          background: #dff1e5;
          color: #245d3d;
        }
        .challenge-feedback.incorrect {
          background: #fff0f0;
          color: #7b3434;
        }
        .challenge-feedback p {
          margin: 4px 0 0;
        }
        .citation-heading {
          width: 100%;
          color: var(--muted);
          font-size: 12px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.08em;
        }
        .citation {
          padding: 4px 7px;
          border: 1px solid #d3e2d9;
          border-radius: 5px;
          background: #f2f8f4;
          color: var(--accent-ink);
          font-size: 12px;
        }
        .typing {
          display: flex;
          gap: 4px;
          padding-top: 7px;
        }
        .typing i {
          width: 5px;
          height: 5px;
          border-radius: 50%;
          background: #9bb4a5;
          animation: blink 1.2s infinite;
        }
        .typing i:nth-child(2) {
          animation-delay: 0.18s;
        }
        .typing i:nth-child(3) {
          animation-delay: 0.36s;
        }
        @keyframes blink {
          0%,
          60%,
          100% {
            opacity: 0.25;
          }
          30% {
            opacity: 1;
          }
        }
        .world-card {
          display: flex;
          align-items: center;
          gap: 11px;
          margin-bottom: 11px;
          padding: 12px;
          border: 1px solid #cbdacf;
          border-radius: 11px;
          background: #f1f8f3;
        }
        .world-card-icon {
          display: grid;
          place-items: center;
          width: 32px;
          height: 32px;
          border-radius: 8px;
          background: #d9ebdf;
          color: var(--accent);
        }
        .world-card-copy {
          display: flex;
          flex: 1;
          flex-direction: column;
          gap: 2px;
          min-width: 0;
        }
        .world-card-copy strong {
          font-size: 14px;
        }
        .world-card-copy span {
          color: var(--muted-strong);
          font-size: 13px;
        }
        .world-card .btn {
          min-height: 33px;
          padding: 0 10px;
          font-size: 13px;
        }
        .chat-error {
          display: flex;
          align-items: center;
          gap: 7px;
          margin-bottom: 10px;
          padding: 10px 12px;
          border: 1px solid #e7caca;
          border-radius: 8px;
          background: #fff6f6;
          color: var(--danger);
          font-size: 14px;
        }
        .composer-wrap {
          padding: 12px 0 23px;
        }
        .composer {
          display: flex;
          align-items: flex-end;
          gap: 8px;
          min-height: 57px;
          padding: 8px;
          border: 1px solid var(--border-strong);
          border-radius: 13px;
          background: var(--surface);
          box-shadow: 0 5px 18px rgba(35, 35, 29, 0.06);
        }
        .composer textarea {
          flex: 1;
          align-self: center;
          min-height: 25px;
          max-height: 110px;
          resize: none;
          padding: 9px 3px;
          border: 0;
          outline: 0;
          background: transparent;
          color: var(--foreground);
          font-size: 15px;
          line-height: 1.4;
        }
        .composer textarea::placeholder {
          color: #9b9b93;
        }
        .composer-action,
        .send-button {
          display: grid;
          flex: 0 0 auto;
          place-items: center;
          width: 38px;
          height: 38px;
          border: 0;
          border-radius: 9px;
        }
        .composer-action {
          background: var(--surface-muted);
          color: var(--muted-strong);
        }
        .composer-action:hover {
          background: var(--accent-soft);
          color: var(--accent);
        }
        .composer-action:disabled {
          opacity: 0.5;
        }
        .send-button {
          background: var(--accent);
          color: white;
        }
        .send-button:disabled {
          opacity: 0.35;
          cursor: default;
        }
        .mode-control {
          position: relative;
          align-self: center;
        }
        .mode-switch {
          display: flex;
          align-items: center;
          gap: 5px;
          border: 0;
          background: transparent;
          color: var(--muted);
          font-size: 12px;
        }
        .mode-switch em {
          font-style: normal;
        }
        .mode-switch span {
          width: 22px;
          height: 13px;
          border-radius: 99px;
          background: #d5d5cf;
          position: relative;
        }
        .mode-switch span::after {
          content: '';
          position: absolute;
          top: 2px;
          left: 2px;
          width: 9px;
          height: 9px;
          border-radius: 50%;
          background: white;
          transition: 0.18s;
        }
        .mode-switch.on {
          color: var(--accent);
        }
        .mode-switch.on span {
          background: var(--accent);
        }
        .mode-switch.on span::after {
          left: 11px;
        }
        .mode-popup {
          position: absolute;
          right: -30px;
          bottom: calc(100% + 13px);
          z-index: 20;
          width: 245px;
          padding: 12px 14px;
          border: 1px solid var(--border-strong);
          border-radius: 10px;
          background: var(--surface);
          color: var(--foreground);
          box-shadow: 0 12px 28px rgba(20, 25, 21, 0.18);
          opacity: 0;
          visibility: hidden;
          transform: translateY(5px);
          transition: 0.16s;
          pointer-events: none;
        }
        .mode-popup::after {
          content: '';
          position: absolute;
          right: 43px;
          bottom: -6px;
          width: 11px;
          height: 11px;
          border-right: 1px solid var(--border-strong);
          border-bottom: 1px solid var(--border-strong);
          background: var(--surface);
          transform: rotate(45deg);
        }
        .mode-popup b {
          display: block;
          color: var(--accent);
          font-size: 12px;
          text-transform: uppercase;
          letter-spacing: 0.07em;
        }
        .mode-popup p {
          margin: 3px 0 9px;
          color: var(--muted-strong);
          font-size: 12px;
          line-height: 1.4;
        }
        .mode-popup p:last-child {
          margin-bottom: 0;
        }
        .mode-control:hover .mode-popup,
        .mode-control:focus-within .mode-popup {
          opacity: 1;
          visibility: visible;
          transform: translateY(0);
        }
        .composer-hint {
          display: flex;
          justify-content: space-between;
          padding: 7px 4px 0;
          color: #9a9a92;
          font-size: 12px;
        }
        .composer-hint span {
          display: inline-flex;
          align-items: center;
          gap: 4px;
        }
        .context-rail {
          width: 245px;
          padding: 31px 27px 28px 0;
          overflow-y: auto;
        }
        .rail-heading {
          display: flex;
          justify-content: space-between;
          color: var(--muted);
          font-size: 13px;
          font-weight: 700;
          letter-spacing: 0.08em;
          text-transform: uppercase;
        }
        .context-card {
          display: flex;
          flex-direction: column;
          gap: 5px;
          margin-top: 17px;
          padding: 15px;
          border: 1px solid var(--border);
          border-radius: 11px;
          background: var(--surface);
          box-shadow: var(--shadow-sm);
        }
        .context-icon {
          display: grid;
          place-items: center;
          width: 30px;
          height: 30px;
          margin-bottom: 5px;
          border-radius: 8px;
          background: var(--accent-soft);
          color: var(--accent);
        }
        .context-card strong {
          font-size: 15px;
          line-height: 1.35;
        }
        .context-card span {
          color: var(--muted);
          font-size: 13px;
        }
        .rail-divider {
          height: 1px;
          margin: 22px 0;
          background: var(--border);
        }
        .rail-note {
          display: flex;
          align-items: flex-start;
          gap: 8px;
          color: var(--accent);
        }
        .rail-note p {
          color: var(--muted);
          font-size: 13px;
          line-height: 1.5;
        }
        .today-plan,
        .quest-card {
          display: grid;
          gap: 9px;
          margin-top: 18px;
          padding: 14px;
          border: 1px solid var(--border);
          border-radius: 12px;
          background: var(--surface);
          box-shadow: var(--shadow-sm);
        }
        .today-plan header,
        .quest-card footer {
          display: flex;
          align-items: center;
          justify-content: space-between;
        }
        .today-plan header > div {
          display: grid;
          gap: 2px;
        }
        .today-plan header span,
        .quest-card > span {
          color: var(--accent);
          font-size: 11px;
          font-weight: 800;
          letter-spacing: 0.08em;
          text-transform: uppercase;
        }
        .today-plan header strong {
          font-size: 16px;
        }
        .today-plan > a {
          display: flex;
          align-items: baseline;
          gap: 7px;
          padding: 7px 9px;
          border-radius: 8px;
          background: var(--surface-muted);
          color: var(--foreground);
          text-decoration: none;
        }
        .today-plan > a:hover {
          background: var(--accent-soft);
        }
        .today-plan > a b {
          color: var(--accent);
          font-size: 17px;
        }
        .today-plan > a span,
        .today-plan > p,
        .quest-card p {
          color: var(--muted);
          font-size: 12px;
          line-height: 1.45;
        }
        .today-plan .plan-recommendation {
          display: grid;
          gap: 2px;
        }
        .today-plan .plan-recommendation strong {
          overflow: hidden;
          font-size: 13px;
          white-space: nowrap;
          text-overflow: ellipsis;
        }
        .quest-card > strong {
          font-size: 15px;
        }
        .quest-card > i {
          height: 6px;
          overflow: hidden;
          border-radius: 99px;
          background: var(--surface-muted);
        }
        .quest-card > i b {
          display: block;
          height: 100%;
          border-radius: inherit;
          background: linear-gradient(90deg, var(--accent), #6fb682);
          transition: width 300ms ease;
        }
        .quest-card footer span {
          color: var(--muted);
          font-size: 12px;
          font-weight: 700;
        }
        .quest-card footer button {
          padding: 5px 9px;
          border: 0;
          border-radius: 7px;
          background: var(--accent);
          color: white;
          font-size: 12px;
          font-weight: 800;
        }
        .quest-card footer button:disabled {
          background: var(--surface-muted);
          color: var(--muted);
          cursor: not-allowed;
        }
        .rail-empty {
          display: flex;
          flex-direction: column;
          align-items: flex-start;
          gap: 8px;
          margin-top: 18px;
          padding: 15px;
          border: 1px dashed var(--border-strong);
          border-radius: 11px;
          color: var(--muted);
        }
        .rail-empty > svg {
          color: var(--accent);
        }
        .rail-empty strong {
          color: var(--foreground);
          font-size: 15px;
        }
        .rail-empty span {
          font-size: 13px;
          line-height: 1.45;
        }
        .rail-empty .btn {
          margin-top: 5px;
          min-height: 33px;
          padding: 0 10px;
          font-size: 13px;
        }
        .confirm-backdrop {
          position: fixed;
          inset: 0;
          z-index: 100;
          display: grid;
          place-items: center;
          padding: 20px;
          background: rgba(15, 18, 16, 0.58);
          backdrop-filter: blur(4px);
        }
        .confirm-dialog {
          width: min(390px, 100%);
          padding: 24px;
          border: 1px solid var(--border-strong);
          border-radius: 15px;
          background: var(--surface);
          color: var(--foreground);
          box-shadow: 0 24px 70px rgba(0, 0, 0, 0.28);
          text-align: center;
        }
        .confirm-icon {
          display: grid;
          place-items: center;
          width: 42px;
          height: 42px;
          margin: 0 auto 12px;
          border-radius: 50%;
          background: #fae7e5;
          color: var(--danger);
        }
        .confirm-dialog h2 {
          font-size: 20px;
        }
        .confirm-dialog p {
          margin: 8px 0 20px;
          color: var(--muted-strong);
          font-size: 14px;
          line-height: 1.55;
        }
        .confirm-dialog > div:last-child {
          display: flex;
          justify-content: flex-end;
          gap: 8px;
        }
        .confirm-dialog .btn {
          min-width: 88px;
        }
        .confirm-delete {
          border-color: #9e4139;
          background: #a94b42;
          color: white;
        }
        @media (max-width: 1100px) {
          .context-rail {
            display: none;
          }
          .chat-column {
            max-width: 900px;
          }
        }
        @media (max-width: 900px) {
          .chat-topbar {
            height: 57px;
            padding: 0 16px;
          }
          .mobile-brand {
            display: flex;
          }
          .context-select {
            margin-left: auto;
          }
          .context-select select {
            max-width: 145px;
            font-size: 14px;
          }
          .topbar-right {
            display: flex;
            gap: 3px;
          }
          .topbar-stat,
          .icon-button {
            display: none;
          }
          .chat-column {
            padding: 0 16px;
          }
          .chat-empty-state {
            margin-top: auto;
          }
          .quick-prompts {
            grid-template-columns: 1fr;
          }
          :global(.quick-prompt) {
            min-height: 42px;
          }
          .message-list {
            padding-top: 20px;
          }
          .composer-hint span:last-child {
            display: none;
          }
          .composer-hint {
            justify-content: center;
          }
        }
      `}</style>
    </div>
  );
}
