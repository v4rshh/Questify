'use client';

import { useState } from 'react';
import Sidebar from '../../components/Sidebar';
import Header from '../../components/Header';

export default function AdminPage() {
  const [users, setUsers] = useState([
    { id: '1', name: 'Alex Rivera', email: 'alex@questify.edu', role: 'student', active: true },
    { id: '2', name: 'Dr. Sarah Connor', email: 'sarah@questify.edu', role: 'instructor', active: true },
    { id: '3', name: 'Admin Operations', email: 'admin@questify.edu', role: 'admin', active: true },
  ]);

  const handleRoleChange = (userId: string, newRole: string) => {
    setUsers((prev) =>
      prev.map((u) => (u.id === userId ? { ...u, role: newRole } : u))
    );
  };

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: 'var(--bg-main)' }}>
      <Sidebar userRole="admin" />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        <Header title="Administrator Interface & System Health" />

        <main style={{ marginLeft: '260px', padding: '32px', display: 'flex', flexDirection: 'column', gap: '32px' }}>
          
          {/* System Health Monitoring Grid */}
          <div>
            <h2 style={{ fontSize: '18px', fontWeight: '800', marginBottom: '16px' }}>
              ⚙️ System & AI Model Service Status
            </h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px' }}>
              <div className="glass-card" style={{ padding: '20px' }}>
                <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Ollama Local LLM</div>
                <div style={{ fontSize: '18px', fontWeight: '700', color: '#10B981', marginTop: '4px' }}>🟢 Online (12ms)</div>
                <div style={{ fontSize: '11px', color: 'var(--text-dim)', marginTop: '4px' }}>Llama 3.1 / Qwen 2.5</div>
              </div>
              <div className="glass-card" style={{ padding: '20px' }}>
                <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Qdrant Vector DB</div>
                <div style={{ fontSize: '18px', fontWeight: '700', color: '#10B981', marginTop: '4px' }}>🟢 Connected</div>
                <div style={{ fontSize: '11px', color: 'var(--text-dim)', marginTop: '4px' }}>Hybrid Index Active</div>
              </div>
              <div className="glass-card" style={{ padding: '20px' }}>
                <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>PostgreSQL DB</div>
                <div style={{ fontSize: '18px', fontWeight: '700', color: '#10B981', marginTop: '4px' }}>🟢 Connected</div>
                <div style={{ fontSize: '11px', color: 'var(--text-dim)', marginTop: '4px' }}>Relational Pool Healthy</div>
              </div>
              <div className="glass-card" style={{ padding: '20px' }}>
                <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Redis Task Queue</div>
                <div style={{ fontSize: '18px', fontWeight: '700', color: '#10B981', marginTop: '4px' }}>🟢 0 Pending Jobs</div>
                <div style={{ fontSize: '11px', color: 'var(--text-dim)', marginTop: '4px' }}>ZSET Leaderboard Active</div>
              </div>
            </div>
          </div>

          {/* User & Role Management Table */}
          <div className="glass-card" style={{ padding: '24px' }}>
            <h2 style={{ fontSize: '18px', fontWeight: '800', marginBottom: '16px' }}>
              👥 User Management & Role Assignment
            </h2>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '14px' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.1)', color: 'var(--text-muted)' }}>
                  <th style={{ padding: '12px 16px' }}>User Name</th>
                  <th style={{ padding: '12px 16px' }}>Email Address</th>
                  <th style={{ padding: '12px 16px' }}>Current Role</th>
                  <th style={{ padding: '12px 16px', textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id} style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.05)' }}>
                    <td style={{ padding: '16px', fontWeight: '600' }}>{u.name}</td>
                    <td style={{ padding: '16px', color: 'var(--text-muted)' }}>{u.email}</td>
                    <td style={{ padding: '16px' }}>
                      <select
                        value={u.role}
                        onChange={(e) => handleRoleChange(u.id, e.target.value)}
                        style={{
                          background: 'rgba(15, 23, 42, 0.8)',
                          color: '#FFF',
                          border: '1px solid rgba(255, 255, 255, 0.2)',
                          padding: '6px 12px',
                          borderRadius: '6px',
                          fontSize: '13px'
                        }}
                      >
                        <option value="student">student</option>
                        <option value="instructor">instructor</option>
                        <option value="admin">admin</option>
                      </select>
                    </td>
                    <td style={{ padding: '16px', textAlign: 'right' }}>
                      <button className="btn-secondary" style={{ padding: '6px 12px', fontSize: '12px' }}>
                        Audit Log
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

        </main>
      </div>
    </div>
  );
}
