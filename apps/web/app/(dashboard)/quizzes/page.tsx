'use client';

import { useEffect, useMemo, useState } from 'react';
import Sidebar from '@/components/Sidebar';
import Header from '@/components/Header';
import { Icon } from '@/components/Icon';
import { fetchApi } from '@/lib/api';
import { LoadingIndicator, LoadingState } from '@/components/LoadingIndicator';
import MotionPage from '@/components/MotionPage';

interface Course {
  id: string;
  title: string;
}
interface Question {
  prompt: string;
  options: string[];
  answer_index: number;
  explanation: string;
}
interface Quiz {
  id: string;
  node_id: string;
  title: string;
  difficulty: string;
  questions_data: { questions: Question[] };
}
interface Attempt {
  score: number;
  max_score: number;
  accuracy_percentage: number;
  xp_earned: number;
  total_xp: number;
  attempts_created: number;
}
interface SessionQuestion {
  key: string;
  quizId: string;
  quizTitle: string;
  questionIndex: number;
  question: Question;
}
interface QuizHistory {
  id: string;
  quiz_id: string;
  quiz_title: string;
  difficulty: string;
  score: number;
  max_score: number;
  accuracy_percentage: number;
  xp_earned: number;
  incorrect_count: number;
  attempt_number: number;
  best_accuracy_percentage: number;
  completed_at: string;
}
interface QuizMistake {
  quiz_id: string;
  quiz_title: string;
  question_index: number;
  prompt: string;
  options: string[];
  correct_answer_index: number;
  explanation: string;
}
type SessionMode = 'level' | '5' | '10' | 'all' | 'mistakes';

function shuffled<T>(items: T[]) {
  const next = [...items];
  for (let index = next.length - 1; index > 0; index -= 1) {
    const target = Math.floor(Math.random() * (index + 1));
    [next[index], next[target]] = [next[target], next[index]];
  }
  return next;
}

export default function QuizzesPage() {
  const [courses, setCourses] = useState<Course[]>([]);
  const [courseId, setCourseId] = useState('');
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [selectedQuizId, setSelectedQuizId] = useState('');
  const [mode, setMode] = useState<SessionMode>('level');
  const [mixSeed, setMixSeed] = useState(0);
  const [position, setPosition] = useState(0);
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [attempt, setAttempt] = useState<Attempt | null>(null);
  const [history, setHistory] = useState<QuizHistory[]>([]);
  const [mistakes, setMistakes] = useState<QuizMistake[]>([]);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchApi<Course[]>('/courses')
      .then((items) => {
        setCourses(items);
        if (items.length) setCourseId(items[0].id);
        else setLoading(false);
      })
      .catch((err) => {
        setError(err.message);
        setLoading(false);
      });
  }, []);

  useEffect(() => {
    if (!courseId) return;
    setQuizzes([]);
    setSelectedQuizId('');
    setAttempt(null);
    setHistory([]);
    setMistakes([]);
    setAnswers({});
    setPosition(0);
    setError('');
    setLoading(true);
    Promise.all([
      fetchApi<Quiz[]>(`/learning/courses/${courseId}/quizzes`),
      fetchApi<QuizHistory[]>(`/learning/courses/${courseId}/quiz-attempts`),
      fetchApi<QuizMistake[]>(`/learning/courses/${courseId}/quiz-mistakes`),
    ])
      .then(([items, attempts, missed]) => {
        setQuizzes(items);
        setHistory(attempts);
        setMistakes(missed);
        setSelectedQuizId(items[0]?.id || '');
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [courseId]);

  const questionPool = useMemo<SessionQuestion[]>(
    () =>
      quizzes.flatMap((quiz) =>
        quiz.questions_data.questions.map((question, questionIndex) => ({
          key: `${quiz.id}:${questionIndex}`,
          quizId: quiz.id,
          quizTitle: quiz.title,
          questionIndex,
          question,
        })),
      ),
    [quizzes],
  );

  const mistakePool = useMemo<SessionQuestion[]>(
    () =>
      mistakes.map((mistake) => ({
        key: `${mistake.quiz_id}:${mistake.question_index}`,
        quizId: mistake.quiz_id,
        quizTitle: mistake.quiz_title,
        questionIndex: mistake.question_index,
        question: {
          prompt: mistake.prompt,
          options: mistake.options,
          answer_index: mistake.correct_answer_index,
          explanation: mistake.explanation,
        },
      })),
    [mistakes],
  );

  const session = useMemo(() => {
    if (mode === 'mistakes') return mistakePool;
    if (mode === 'level') return questionPool.filter((item) => item.quizId === selectedQuizId);
    if (mode === 'all') return questionPool;
    return shuffled(questionPool).slice(0, Math.min(Number(mode), questionPool.length));
    // mixSeed intentionally creates a new randomized practice set.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mistakePool, mode, questionPool, selectedQuizId, mixSeed]);

  useEffect(() => {
    setPosition(0);
    setAnswers({});
    setAttempt(null);
  }, [mode, selectedQuizId, mixSeed]);

  const current = session[position];
  const answered = session.filter((item) => answers[item.key] !== undefined).length;
  const complete = session.length > 0 && answered === session.length;

  const choose = (optionIndex: number) => {
    if (!current || attempt) return;
    setAnswers((value) => ({ ...value, [current.key]: optionIndex }));
  };

  const submit = async () => {
    if (!complete || busy) return;
    setBusy(true);
    setError('');
    try {
      const result = await fetchApi<Attempt>('/learning/quizzes/session', {
        method: 'POST',
        body: JSON.stringify({
          answers: session.map((item) => ({
            quiz_id: item.quizId,
            question_index: item.questionIndex,
            answer_index: answers[item.key],
          })),
        }),
      });
      setAttempt(result);
      void fetchApi<QuizHistory[]>(`/learning/courses/${courseId}/quiz-attempts`)
        .then(setHistory)
        .catch(() => undefined);
      window.dispatchEvent(new Event('questify:metrics-updated'));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not submit this practice session.');
    } finally {
      setBusy(false);
    }
  };

  const resetSession = (newMix = false) => {
    if (mode === 'mistakes') {
      fetchApi<QuizMistake[]>(`/learning/courses/${courseId}/quiz-mistakes`)
        .then((items) => {
          setMistakes(items);
          if (!items.length) setMode('level');
        })
        .catch((err) => setError(err.message));
    }
    if (newMix && (mode === '5' || mode === '10')) setMixSeed((value) => value + 1);
    else {
      setAnswers({});
      setAttempt(null);
      setPosition(0);
    }
  };

  return (
    <div className="app-shell">
      <Sidebar />
      <div className="page-content">
        <Header title="Quizzes" />
        <MotionPage className="quiz-page">
          <div className="quiz-top">
            <div>
              <p className="eyebrow">Knowledge check</p>
              <h2>Build a practice session.</h2>
              <p>Choose one level, a quick mixed set, or every generated question.</p>
            </div>
            <select
              className="course-select"
              value={courseId}
              onChange={(event) => setCourseId(event.target.value)}
            >
              <option value="">Choose workspace</option>
              {courses.map((course) => (
                <option key={course.id} value={course.id}>
                  {course.title}
                </option>
              ))}
            </select>
          </div>
          {error && <p className="error-message">{error}</p>}
          {loading ? (
            <LoadingState
              title="Loading your quizzes…"
              detail="Collecting questions, attempts, and review history."
            />
          ) : quizzes.length ? (
            <>
              <section className="session-controls">
                <label>
                  <span>Practice mode</span>
                  <select
                    value={mode}
                    onChange={(event) => setMode(event.target.value as SessionMode)}
                  >
                    <option value="level">One level</option>
                    <option value="5">Quick mix · 5</option>
                    <option value="10">Mixed practice · 10</option>
                    <option value="all">All questions · {questionPool.length}</option>
                    <option value="mistakes" disabled={!mistakes.length}>
                      Retry mistakes · {mistakes.length}
                    </option>
                  </select>
                </label>
                <label className={mode !== 'level' ? 'disabled' : ''}>
                  <span>Level quiz</span>
                  <select
                    disabled={mode !== 'level'}
                    value={selectedQuizId}
                    onChange={(event) => setSelectedQuizId(event.target.value)}
                  >
                    {quizzes.map((quiz, index) => (
                      <option key={quiz.id} value={quiz.id}>
                        Level {index + 1} · {quiz.title}
                      </option>
                    ))}
                  </select>
                </label>
                {(mode === '5' || mode === '10') && (
                  <button className="btn remix" type="button" onClick={() => resetSession(true)}>
                    <Icon name="sparkles" size={14} /> New mix
                  </button>
                )}
              </section>

              {current && (
                <section className="quiz-card">
                  <header>
                    <div>
                      <span className="eyebrow">
                        {mode === 'level' ? current.quizTitle : 'Mixed practice'}
                      </span>
                      <h3>
                        Question {position + 1} of {session.length}
                      </h3>
                    </div>
                    <div className="session-progress">
                      <span>
                        {answered}/{session.length} answered
                      </span>
                      <i>
                        <b
                          style={{
                            width: `${session.length ? (answered / session.length) * 100 : 0}%`,
                          }}
                        />
                      </i>
                    </div>
                  </header>

                  <nav className="question-nav" aria-label="Quiz questions">
                    {session.map((item, index) => {
                      const isAnswered = answers[item.key] !== undefined;
                      const isCorrect = attempt && answers[item.key] === item.question.answer_index;
                      return (
                        <button
                          type="button"
                          key={item.key}
                          className={`${index === position ? 'active' : ''} ${isAnswered ? 'answered' : ''} ${attempt ? (isCorrect ? 'correct' : 'wrong') : ''}`}
                          onClick={() => setPosition(index)}
                          aria-label={`Question ${index + 1}${isAnswered ? ', answered' : ''}`}
                        >
                          {index + 1}
                        </button>
                      );
                    })}
                  </nav>

                  <div className="question">
                    <p className="question-source">{current.quizTitle}</p>
                    <h3>{current.question.prompt}</h3>
                    <div className="options">
                      {current.question.options.map((option, optionIndex) => {
                        const selected = answers[current.key] === optionIndex;
                        const correct =
                          Boolean(attempt) && optionIndex === current.question.answer_index;
                        const wrong = Boolean(attempt) && selected && !correct;
                        return (
                          <button
                            key={`${option}-${optionIndex}`}
                            type="button"
                            disabled={Boolean(attempt)}
                            onClick={() => choose(optionIndex)}
                            className={`${selected ? 'selected' : ''} ${correct ? 'correct' : ''} ${wrong ? 'wrong' : ''}`}
                          >
                            <i>{String.fromCharCode(65 + optionIndex)}</i>
                            <span>{option}</span>
                            {attempt && correct && <b>✓</b>}
                            {attempt && wrong && <b>×</b>}
                          </button>
                        );
                      })}
                    </div>
                    {attempt && (
                      <p className="explanation">
                        <strong>Explanation</strong>
                        {current.question.explanation}
                      </p>
                    )}
                  </div>

                  <div className="navigation">
                    <button
                      className="btn"
                      type="button"
                      disabled={position === 0}
                      onClick={() => setPosition((value) => value - 1)}
                    >
                      ← Previous
                    </button>
                    {position < session.length - 1 ? (
                      <button
                        className="btn btn-primary"
                        type="button"
                        onClick={() => setPosition((value) => value + 1)}
                      >
                        Next question →
                      </button>
                    ) : (
                      !attempt && (
                        <button
                          className="btn btn-primary"
                          type="button"
                          disabled={!complete || busy}
                          onClick={submit}
                        >
                          {busy && <LoadingIndicator label="Checking answers" size="small" />}
                          {busy
                            ? 'Checking…'
                            : complete
                              ? 'Check all answers'
                              : `${session.length - answered} unanswered`}
                        </button>
                      )
                    )}
                  </div>

                  {attempt && (
                    <div className="attempt-result">
                      <div>
                        <strong>
                          {attempt.score} / {attempt.max_score} correct
                        </strong>
                        <span>
                          {attempt.accuracy_percentage}% accuracy · +{attempt.xp_earned} XP
                        </span>
                      </div>
                      <p>
                        Use the numbered navigation above to review every answer and explanation.
                      </p>
                      <button
                        className="btn btn-primary"
                        onClick={() => resetSession(mode === '5' || mode === '10')}
                      >
                        {mode === '5' || mode === '10'
                          ? 'Start a new mix'
                          : mode === 'mistakes'
                            ? 'Refresh mistakes'
                            : 'Try again'}
                      </button>
                    </div>
                  )}
                </section>
              )}
              <section className="history-panel">
                <header>
                  <div>
                    <p className="eyebrow">Attempt history</p>
                    <h3>Recent quiz results</h3>
                  </div>
                  {mistakes.length > 0 && (
                    <button type="button" className="btn" onClick={() => setMode('mistakes')}>
                      Retry {mistakes.length} mistake{mistakes.length === 1 ? '' : 's'}
                    </button>
                  )}
                </header>
                {history.length ? (
                  <div className="history-list">
                    {history.slice(0, 8).map((item) => (
                      <article key={item.id}>
                        <div>
                          <strong>{item.quiz_title}</strong>
                          <span>
                            {item.difficulty} · Attempt {item.attempt_number} · Best{' '}
                            {item.best_accuracy_percentage}% ·{' '}
                            {new Date(item.completed_at).toLocaleDateString()}
                          </span>
                        </div>
                        <div className="history-score">
                          <b>{item.accuracy_percentage}%</b>
                          <span>
                            {item.score}/{item.max_score} · +{item.xp_earned} XP
                          </span>
                        </div>
                        <span className={item.incorrect_count ? 'missed' : 'perfect'}>
                          {item.incorrect_count ? `${item.incorrect_count} to review` : 'Perfect'}
                        </span>
                      </article>
                    ))}
                  </div>
                ) : (
                  <p className="history-empty">Complete a session to start your history.</p>
                )}
              </section>
            </>
          ) : (
            <section className="panel empty">
              <Icon name="target" size={22} />
              <h3>No quiz yet</h3>
              <p>Generate a learning world to create level quizzes for this workspace.</p>
            </section>
          )}
        </MotionPage>
        <style jsx>{`
          .quiz-page {
            max-width: 940px;
            margin: 0 auto;
            padding: 38px;
          }
          .quiz-top {
            display: flex;
            align-items: flex-start;
            justify-content: space-between;
            gap: 24px;
            margin-bottom: 24px;
          }
          .eyebrow {
            color: var(--accent);
            font-size: 10px;
            font-weight: 800;
            letter-spacing: 0.09em;
            text-transform: uppercase;
          }
          .quiz-top h2 {
            margin-top: 6px;
            font-size: 29px;
            letter-spacing: -0.045em;
          }
          .quiz-top > div > p:last-child {
            margin-top: 7px;
            color: var(--muted);
            font-size: 13px;
          }
          .course-select,
          .session-controls select {
            min-width: 220px;
            padding: 10px 12px;
            border: 1px solid var(--border);
            border-radius: 9px;
            background: var(--surface);
            color: var(--foreground);
          }
          .session-controls {
            display: flex;
            align-items: flex-end;
            gap: 12px;
            margin-bottom: 16px;
            padding: 16px;
            border: 1px solid var(--border);
            border-radius: 12px;
            background: var(--surface);
          }
          .session-controls label {
            display: grid;
            flex: 1;
            gap: 6px;
          }
          .session-controls label > span {
            color: var(--muted);
            font-size: 10px;
            font-weight: 800;
            letter-spacing: 0.07em;
            text-transform: uppercase;
          }
          .session-controls label.disabled {
            opacity: 0.52;
          }
          .session-controls select {
            width: 100%;
            min-width: 0;
          }
          .remix {
            height: 39px;
            gap: 6px;
            white-space: nowrap;
          }
          .quiz-card {
            padding: 26px;
            border: 1px solid var(--border);
            border-radius: 14px;
            background: var(--surface);
          }
          .quiz-card > header {
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 15px;
            padding-bottom: 18px;
            border-bottom: 1px solid var(--border);
          }
          .quiz-card header h3 {
            margin-top: 5px;
            font-size: 19px;
          }
          .session-progress {
            display: grid;
            justify-items: end;
            gap: 6px;
            color: var(--muted);
            font-size: 11px;
          }
          .session-progress i {
            display: block;
            width: 140px;
            height: 6px;
            overflow: hidden;
            border-radius: 99px;
            background: var(--surface-muted);
          }
          .session-progress b {
            display: block;
            height: 100%;
            border-radius: inherit;
            background: var(--accent);
            transition: width 0.2s;
          }
          .question-nav {
            display: flex;
            gap: 7px;
            overflow-x: auto;
            padding: 16px 1px;
          }
          .question-nav button {
            flex: 0 0 31px;
            height: 31px;
            border: 1px solid var(--border);
            border-radius: 8px;
            background: var(--surface);
            color: var(--muted);
            font-size: 11px;
            font-weight: 700;
          }
          .question-nav button.answered {
            border-color: #a9c4b1;
            background: var(--accent-soft);
            color: var(--accent);
          }
          .question-nav button.active {
            outline: 2px solid var(--accent);
            outline-offset: 1px;
          }
          .question-nav button.correct {
            border-color: #6ca27c;
            background: #e7f5eb;
            color: #34724a;
          }
          .question-nav button.wrong {
            border-color: #d68f8f;
            background: #fff0f0;
            color: #9c4141;
          }
          .question {
            padding: 21px 2px 10px;
          }
          .question-source {
            margin-bottom: 7px;
            color: var(--muted);
            font-size: 10px;
          }
          .question > h3 {
            font-size: 18px;
            line-height: 1.5;
          }
          .options {
            display: grid;
            gap: 9px;
            margin-top: 17px;
          }
          .options button {
            display: flex;
            align-items: center;
            gap: 11px;
            padding: 12px 14px;
            border: 1px solid var(--border);
            border-radius: 9px;
            background: var(--surface);
            color: var(--foreground);
            font-size: 13px;
            text-align: left;
          }
          .options button:hover:not(:disabled),
          .options button.selected {
            border-color: #8eae9a;
            background: var(--accent-soft);
          }
          .options button.correct {
            border-color: #75a98a;
            background: #eaf5ed;
          }
          .options button.wrong {
            border-color: #d99595;
            background: #fff0f0;
          }
          .options i {
            display: grid;
            place-items: center;
            flex: 0 0 23px;
            height: 23px;
            border: 1px solid currentColor;
            border-radius: 50%;
            font-size: 10px;
            font-style: normal;
          }
          .options span {
            flex: 1;
          }
          .options b {
            font-size: 18px;
          }
          .explanation {
            display: grid;
            gap: 4px;
            margin-top: 14px;
            padding: 13px;
            border-left: 3px solid var(--accent);
            border-radius: 4px;
            background: var(--accent-soft);
            color: var(--muted-strong);
            font-size: 12px;
            line-height: 1.55;
          }
          .explanation strong {
            color: var(--accent);
            font-size: 10px;
            text-transform: uppercase;
          }
          .navigation {
            display: flex;
            justify-content: space-between;
            gap: 10px;
            margin-top: 18px;
            padding-top: 18px;
            border-top: 1px solid var(--border);
          }
          .navigation .btn {
            min-width: 125px;
          }
          .attempt-result {
            display: grid;
            grid-template-columns: 1fr auto;
            align-items: center;
            gap: 8px 16px;
            margin-top: 20px;
            padding: 16px;
            border: 1px solid #b9d5c3;
            border-radius: 10px;
            background: var(--accent-soft);
          }
          .attempt-result div {
            display: flex;
            align-items: center;
            gap: 12px;
          }
          .attempt-result strong {
            font-size: 16px;
          }
          .attempt-result span {
            color: var(--accent);
            font-size: 12px;
          }
          .attempt-result p {
            grid-column: 1;
            color: var(--muted-strong);
            font-size: 11px;
          }
          .attempt-result button {
            grid-column: 2;
            grid-row: 1/3;
          }
          .history-panel {
            margin-top: 18px;
            padding: 22px;
            border: 1px solid var(--border);
            border-radius: 14px;
            background: var(--surface);
          }
          .history-panel > header {
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 16px;
            margin-bottom: 15px;
          }
          .history-panel h3 {
            margin-top: 4px;
            font-size: 18px;
          }
          .history-list {
            display: grid;
            gap: 8px;
          }
          .history-list article {
            display: grid;
            grid-template-columns: minmax(0, 1fr) auto auto;
            align-items: center;
            gap: 16px;
            padding: 12px 13px;
            border-radius: 9px;
            background: var(--surface-muted);
          }
          .history-list article > div {
            display: grid;
            gap: 3px;
            min-width: 0;
          }
          .history-list strong {
            overflow: hidden;
            font-size: 13px;
            white-space: nowrap;
            text-overflow: ellipsis;
          }
          .history-list span,
          .history-empty {
            color: var(--muted);
            font-size: 10px;
          }
          .history-score {
            justify-items: end;
          }
          .history-score b {
            color: var(--accent);
            font-size: 15px;
          }
          .history-list article > span {
            min-width: 76px;
            padding: 5px 8px;
            border-radius: 999px;
            text-align: center;
          }
          .history-list .missed {
            background: #fff0f0;
            color: #9c4141;
          }
          .history-list .perfect {
            background: #e7f5eb;
            color: #34724a;
          }
          .empty {
            display: flex;
            flex-direction: column;
            align-items: center;
            gap: 9px;
            margin: 70px auto;
            padding: 32px;
            max-width: 440px;
            text-align: center;
            color: var(--accent);
          }
          .empty h3 {
            color: var(--foreground);
            font-size: 19px;
          }
          .empty p {
            color: var(--muted);
            font-size: 13px;
            line-height: 1.55;
          }
          .error-message {
            margin-bottom: 12px;
            padding: 10px 12px;
            border: 1px solid #e7caca;
            border-radius: 8px;
            color: var(--danger);
            font-size: 12px;
          }
          @media (max-width: 700px) {
            .quiz-page {
              padding: 24px 14px 90px;
            }
            .quiz-top {
              flex-direction: column;
            }
            .course-select {
              width: 100%;
            }
            .session-controls {
              align-items: stretch;
              flex-direction: column;
            }
            .quiz-card {
              padding: 17px;
            }
            .quiz-card > header {
              align-items: flex-start;
              flex-direction: column;
            }
            .session-progress {
              justify-items: start;
              width: 100%;
            }
            .session-progress i {
              width: 100%;
            }
            .question > h3 {
              font-size: 16px;
            }
            .navigation .btn {
              min-width: 0;
            }
            .attempt-result {
              grid-template-columns: 1fr;
            }
            .attempt-result div {
              align-items: flex-start;
              flex-direction: column;
              gap: 3px;
            }
            .attempt-result p,
            .attempt-result button {
              grid-column: 1;
              grid-row: auto;
            }
            .attempt-result button {
              width: 100%;
            }
            .history-list article {
              grid-template-columns: 1fr auto;
            }
            .history-list article > span {
              grid-column: 1 / -1;
              justify-self: start;
            }
          }
        `}</style>
      </div>
    </div>
  );
}
