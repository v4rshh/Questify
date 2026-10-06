# Questify learning feature requirements

Last reviewed: 2026-10-05

This document defines the requested learning improvements against the current
Questify architecture. Work is split into increments so existing worlds,
flashcards, quiz attempts, XP, and mastery data remain usable.

## Delivery rules

- Preserve learner ownership checks on every content and attempt endpoint.
- Keep existing generated multiple-choice content backward compatible.
- Do not require database recreation to deliver the first increment.
- Introduce Alembic before adding persistent exam or adaptive-session tables.
- Grade answers and enforce timers on the server before awarding XP.
- Preserve a question snapshot with future attempts so editing content cannot
  rewrite attempt history.
- Keep source files private and verify course ownership before serving them.

## Feature requirements and status

### 1. Editable generated content — increment 1

- Learners can edit a generated flashcard's front, back, and optional hint.
- Learners can edit a generated multiple-choice question's prompt, four
  options, correct answer, and explanation.
- Empty values, duplicate options, and invalid correct-answer indexes are
  rejected by the API.
- Editing is limited to content in a course owned by the authenticated learner.
- Existing review scheduling is preserved. Questions with saved attempts stay
  locked in increment 1 so editing cannot reinterpret historical answer indexes;
  immutable attempt snapshots remove that restriction in increment 2.

### 2. Additional question types — staged

- Support multiple choice, multiple select, true/false, fill in the blank,
  short answer, and matching.
- Use one normalized question contract and a server-side grading service.
- Deterministic question types ship before optional AI rubric grading.
- XP is never awarded from an unvalidated client-side score.

### 3. Custom exam builder — staged

- Configure topics, question count, types, difficulty mix, timer, shuffling,
  mistake inclusion, and feedback mode.
- Persist the generated question snapshot, start time, expiry, answers, and
  result.
- Enforce expiry on the API and allow saved attempts to be reviewed later.

### 4. Adaptive Learn Mode — staged

- Select work using due dates, recent mistakes, node mastery, repeated errors,
  and a recently-seen penalty.
- Progress from recognition to recall question formats.
- Provide remediation after repeated errors and finish concepts only after a
  mastery checkpoint.
- Keep the selection rules explainable and testable before considering ML.

### 5. Weakness Deck — staged on existing mistake retry

- Combine incorrect quiz answers, difficult flashcards, and low-mastery nodes.
- Explain the concept, review it, and ask a different checkpoint question.
- Deduplicate generated remediation items by their source question.
- Reduce weakness only after a successful later retrieval.

### 6. Source-linked explanations — increment 1 and later extension

- Display the generated filename and page with quiz explanations when present.
- Preserve source metadata when questions are edited.
- Later, add authenticated source viewing and source metadata to flashcards.
- Provide an eventual "Ask the Wizard" action with the source context attached.

## Implementation order

1. Editable multiple-choice questions and flashcards.
2. Visible quiz source citations.
3. Alembic migration foundation and immutable attempt snapshots.
4. Normalized question types and server-side grading.
5. Persistent custom exams.
6. Weakness Deck and adaptive session selection.
7. Authenticated source viewer and Wizard handoff.
