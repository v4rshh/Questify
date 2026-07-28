"use client";
import { FormEvent, useEffect, useState } from "react";

type Course = { id: string; title: string };
const api = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export default function Home() {
  const [courses, setCourses] = useState<Course[]>([]);
  const [title, setTitle] = useState("");
  const [error, setError] = useState("");
  async function refresh() {
    const response = await fetch(`${api}/api/courses`);
    if (response.ok) setCourses(await response.json());
  }
  useEffect(() => { refresh().catch(() => setError("API is unavailable. Start Docker Compose first.")); }, []);
  async function createCourse(event: FormEvent) {
    event.preventDefault();
    if (!title.trim()) return;
    const response = await fetch(`${api}/api/courses`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ title }) });
    if (!response.ok) return setError("Could not create course.");
    setTitle(""); setError(""); await refresh();
  }
  return <main style={{ maxWidth: 800, margin: "0 auto", padding: "64px 24px" }}>
    <p style={{ color: "#7c3aed", fontWeight: 700 }}>QUESTIFY · MVP</p>
    <h1 style={{ fontSize: 42, margin: "8px 0" }}>Build your learning path.</h1>
    <p>Create a course, then connect material uploads, quizzes, and review scheduling.</p>
    <form onSubmit={createCourse} style={{ display: "flex", gap: 8, margin: "32px 0" }}>
      <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Operating Systems" style={{ flex: 1, padding: 12, border: "1px solid #cbd5e1", borderRadius: 8 }} />
      <button style={{ border: 0, borderRadius: 8, padding: "12px 18px", background: "#7c3aed", color: "white", fontWeight: 700 }}>Create course</button>
    </form>
    {error && <p style={{ color: "#b91c1c" }}>{error}</p>}
    <section><h2>Your courses</h2>{courses.length ? courses.map((course) => <article key={course.id} style={{ background: "white", borderRadius: 10, padding: 18, marginBottom: 10, border: "1px solid #e2e8f0" }}><strong>{course.title}</strong><p style={{ marginBottom: 0, color: "#64748b" }}>Ready for materials and learning activities</p></article>) : <p>No courses yet.</p>}</section>
  </main>;
}
