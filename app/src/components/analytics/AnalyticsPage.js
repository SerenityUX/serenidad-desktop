import React, { useEffect, useMemo, useState } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import AuthScreen from "../auth/AuthScreen";
import LauncherLoadingSkeleton from "../projects/LauncherLoadingSkeleton";
import { apiUrl } from "../../config";

const card = {
  background: "#fff",
  border: "1px solid #e5e7eb",
  borderRadius: 8,
  padding: 16,
};

const sectionTitle = {
  fontSize: 13,
  fontWeight: 600,
  textTransform: "uppercase",
  letterSpacing: 0.5,
  color: "#6b7280",
  marginBottom: 8,
};

function fmtUsd(cents) {
  return `$${(cents / 100).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function fmtDate(s) {
  if (!s) return "—";
  try {
    return new Date(s).toLocaleDateString();
  } catch {
    return "—";
  }
}

function fmtDateTime(s) {
  if (!s) return "—";
  try {
    return new Date(s).toLocaleString();
  } catch {
    return "—";
  }
}

function gmailComposeUrl(email, subject = "", body = "") {
  const params = new URLSearchParams({
    view: "cm",
    fs: "1",
    to: email,
  });
  if (subject) params.set("su", subject);
  if (body) params.set("body", body);
  return `https://mail.google.com/mail/?${params.toString()}`;
}

const StatCard = ({ label, value, sub }) => (
  <div style={card}>
    <div style={sectionTitle}>{label}</div>
    <div style={{ fontSize: 28, fontWeight: 600 }}>{value}</div>
    {sub ? (
      <div style={{ marginTop: 4, fontSize: 12, color: "#6b7280" }}>{sub}</div>
    ) : null}
  </div>
);

// Simple inline-SVG line chart so we don't drag in a chart library.
const DauChart = ({ points }) => {
  const W = 720;
  const H = 220;
  const PAD_L = 36;
  const PAD_R = 12;
  const PAD_T = 12;
  const PAD_B = 24;
  const max = Math.max(1, ...points.map((p) => p.dau));
  const innerW = W - PAD_L - PAD_R;
  const innerH = H - PAD_T - PAD_B;
  const xStep = points.length > 1 ? innerW / (points.length - 1) : 0;
  const path = points
    .map((p, i) => {
      const x = PAD_L + i * xStep;
      const y = PAD_T + innerH - (p.dau / max) * innerH;
      return `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
  const ticks = [0, Math.round(max / 2), max];
  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", height: "auto" }}>
      {ticks.map((t) => {
        const y = PAD_T + innerH - (t / max) * innerH;
        return (
          <g key={t}>
            <line x1={PAD_L} y1={y} x2={W - PAD_R} y2={y} stroke="#f3f4f6" />
            <text x={4} y={y + 4} fontSize="10" fill="#9ca3af">
              {t}
            </text>
          </g>
        );
      })}
      <path d={path} fill="none" stroke="#1F93FF" strokeWidth="2" />
      {points.map((p, i) => {
        const x = PAD_L + i * xStep;
        const y = PAD_T + innerH - (p.dau / max) * innerH;
        return <circle key={p.day} cx={x} cy={y} r={2.5} fill="#1F93FF" />;
      })}
      {points.length > 0 && (
        <>
          <text x={PAD_L} y={H - 6} fontSize="10" fill="#9ca3af">
            {points[0].day}
          </text>
          <text
            x={W - PAD_R}
            y={H - 6}
            fontSize="10"
            fill="#9ca3af"
            textAnchor="end"
          >
            {points[points.length - 1].day}
          </text>
        </>
      )}
    </svg>
  );
};

const UsersTable = ({ users, onSelect, selectedId }) => (
  <div
    style={{
      ...card,
      padding: 0,
      maxHeight: 420,
      overflowY: "auto",
    }}
  >
    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
      <thead style={{ position: "sticky", top: 0, background: "#f9fafb" }}>
        <tr style={{ textAlign: "left", color: "#6b7280" }}>
          <th style={{ padding: "10px 12px" }}>Name</th>
          <th style={{ padding: "10px 12px" }}>Email</th>
          <th style={{ padding: "10px 12px" }}>Role</th>
          <th style={{ padding: "10px 12px" }}>Tokens</th>
          <th style={{ padding: "10px 12px" }}>Gens</th>
          <th style={{ padding: "10px 12px" }}>Joined</th>
          <th style={{ padding: "10px 12px" }}>Last seen</th>
          <th style={{ padding: "10px 12px" }} />
        </tr>
      </thead>
      <tbody>
        {users.map((u) => (
          <tr
            key={u.id}
            onClick={() => onSelect?.(u)}
            style={{
              cursor: "pointer",
              background: selectedId === u.id ? "#eff6ff" : "transparent",
              borderTop: "1px solid #f3f4f6",
            }}
          >
            <td style={{ padding: "10px 12px" }}>{u.name}</td>
            <td style={{ padding: "10px 12px", color: "#374151" }}>
              {u.email}
            </td>
            <td style={{ padding: "10px 12px" }}>{u.role}</td>
            <td style={{ padding: "10px 12px" }}>{u.tokens ?? 0}</td>
            <td style={{ padding: "10px 12px" }}>{u.generations ?? 0}</td>
            <td style={{ padding: "10px 12px" }}>{fmtDate(u.created_at)}</td>
            <td style={{ padding: "10px 12px" }}>{fmtDateTime(u.last_seen)}</td>
            <td style={{ padding: "10px 12px", textAlign: "right" }}>
              <a
                href={gmailComposeUrl(u.email)}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                style={{
                  color: "#1F93FF",
                  textDecoration: "none",
                  fontWeight: 500,
                }}
              >
                Email
              </a>
            </td>
          </tr>
        ))}
        {users.length === 0 && (
          <tr>
            <td
              colSpan={8}
              style={{ padding: 20, textAlign: "center", color: "#9ca3af" }}
            >
              No users yet.
            </td>
          </tr>
        )}
      </tbody>
    </table>
  </div>
);

const GenerationsList = ({ generations }) => (
  <div style={{ ...card, padding: 0, maxHeight: 420, overflowY: "auto" }}>
    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
      <thead style={{ position: "sticky", top: 0, background: "#f9fafb" }}>
        <tr style={{ textAlign: "left", color: "#6b7280" }}>
          <th style={{ padding: "10px 12px" }}>When</th>
          <th style={{ padding: "10px 12px" }}>User</th>
          <th style={{ padding: "10px 12px" }}>Project</th>
          <th style={{ padding: "10px 12px" }}>Model</th>
          <th style={{ padding: "10px 12px" }}>Prompt</th>
        </tr>
      </thead>
      <tbody>
        {generations.map((g) => (
          <tr key={g.id} style={{ borderTop: "1px solid #f3f4f6" }}>
            <td style={{ padding: "10px 12px", whiteSpace: "nowrap" }}>
              {fmtDateTime(g.created_at)}
            </td>
            <td style={{ padding: "10px 12px" }}>
              {g.user_name}{" "}
              <span style={{ color: "#9ca3af" }}>({g.user_email})</span>
            </td>
            <td style={{ padding: "10px 12px" }}>{g.project_name}</td>
            <td style={{ padding: "10px 12px" }}>{g.model || "—"}</td>
            <td
              style={{
                padding: "10px 12px",
                maxWidth: 320,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
              title={g.prompt || ""}
            >
              {g.prompt || ""}
            </td>
          </tr>
        ))}
        {generations.length === 0 && (
          <tr>
            <td
              colSpan={5}
              style={{ padding: 20, textAlign: "center", color: "#9ca3af" }}
            >
              No generations yet.
            </td>
          </tr>
        )}
      </tbody>
    </table>
  </div>
);

const AnalyticsPage = () => {
  const { ready, user, token } = useAuth();
  const [summary, setSummary] = useState(null);
  const [dau, setDau] = useState({ days: 30, points: [] });
  const [users, setUsers] = useState([]);
  const [generations, setGenerations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedUserId, setSelectedUserId] = useState(null);
  const [grantOpen, setGrantOpen] = useState(false);
  const [grantAmount, setGrantAmount] = useState("");
  const [grantNote, setGrantNote] = useState("");
  const [grantBusy, setGrantBusy] = useState(false);
  const [grantError, setGrantError] = useState(null);
  const [userProjects, setUserProjects] = useState([]);
  const [userProjectsLoading, setUserProjectsLoading] = useState(false);
  const [userProjectsError, setUserProjectsError] = useState(null);

  const isAdmin = user?.role === "admin";

  useEffect(() => {
    if (!ready || !user || !isAdmin) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      const headers = { Authorization: `Bearer ${token}` };
      try {
        const [s, d, u, g] = await Promise.all([
          fetch(apiUrl("/analytics/summary"), { headers }).then((r) => r.json()),
          fetch(apiUrl("/analytics/dau?days=30"), { headers }).then((r) => r.json()),
          fetch(apiUrl("/analytics/users"), { headers }).then((r) => r.json()),
          fetch(apiUrl("/analytics/generations"), { headers }).then((r) => r.json()),
        ]);
        if (cancelled) return;
        setSummary(s);
        setDau(d);
        setUsers(u.users || []);
        setGenerations(g.generations || []);
      } catch (e) {
        if (!cancelled) setError(String(e.message || e));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [ready, user, isAdmin, token]);

  const selectedUser = useMemo(
    () => users.find((u) => u.id === selectedUserId) || null,
    [users, selectedUserId],
  );

  useEffect(() => {
    if (!selectedUserId || !isAdmin) {
      setUserProjects([]);
      return;
    }
    let cancelled = false;
    (async () => {
      setUserProjectsLoading(true);
      setUserProjectsError(null);
      try {
        const res = await fetch(
          apiUrl(`/analytics/users/${selectedUserId}/projects`),
          { headers: { Authorization: `Bearer ${token}` } },
        );
        const body = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(body.error || `HTTP ${res.status}`);
        if (!cancelled) setUserProjects(body.projects || []);
      } catch (e) {
        if (!cancelled) setUserProjectsError(String(e.message || e));
      } finally {
        if (!cancelled) setUserProjectsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [selectedUserId, isAdmin, token]);

  const submitGrant = async () => {
    if (!selectedUser) return;
    const amount = parseInt(String(grantAmount).trim(), 10);
    if (!Number.isFinite(amount) || amount === 0) {
      setGrantError("Enter a non-zero integer (use a negative number to deduct).");
      return;
    }
    setGrantBusy(true);
    setGrantError(null);
    try {
      const res = await fetch(apiUrl("/analytics/grant"), {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          userId: selectedUser.id,
          amount,
          note: grantNote.trim() || undefined,
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || `HTTP ${res.status}`);
      setUsers((prev) =>
        prev.map((u) =>
          u.id === selectedUser.id ? { ...u, tokens: body.tokens } : u,
        ),
      );
      setGrantOpen(false);
      setGrantAmount("");
      setGrantNote("");
    } catch (e) {
      setGrantError(String(e.message || e));
    } finally {
      setGrantBusy(false);
    }
  };

  if (!ready) return <LauncherLoadingSkeleton />;
  if (!user) return <AuthScreen />;
  if (!isAdmin) return <Navigate to="/" replace />;

  return (
    <div
      style={{
        padding: 24,
        maxWidth: 1100,
        margin: "0 auto",
        fontFamily:
          '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
        color: "#111827",
      }}
    >
      <h1 style={{ fontSize: 22, marginTop: 0, marginBottom: 16 }}>
        Analytics
      </h1>

      {error && (
        <div
          style={{
            ...card,
            background: "#fef2f2",
            borderColor: "#fecaca",
            color: "#991b1b",
            marginBottom: 16,
          }}
        >
          Couldn’t load analytics: {error}
        </div>
      )}

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
          gap: 12,
          marginBottom: 20,
        }}
      >
        <StatCard
          label="Total Users"
          value={summary?.totalUsers ?? (loading ? "…" : 0)}
        />
        <StatCard
          label="MRR"
          value={summary ? fmtUsd(summary.mrrCents) : loading ? "…" : "$0.00"}
          sub={
            summary
              ? `S ${summary.tierBreakdown.starter} · C ${summary.tierBreakdown.creator} · St ${summary.tierBreakdown.studio}`
              : null
          }
        />
        <StatCard
          label="Generations"
          value={summary?.totalGenerations ?? (loading ? "…" : 0)}
        />
      </div>

      <div style={{ ...card, marginBottom: 20 }}>
        <div style={sectionTitle}>Daily Active Users (last 30 days)</div>
        <DauChart points={dau.points} />
      </div>

      <div style={{ marginBottom: 20 }}>
        <div style={{ ...sectionTitle, marginBottom: 8 }}>Users</div>
        <UsersTable
          users={users}
          onSelect={(u) => setSelectedUserId(u.id)}
          selectedId={selectedUserId}
        />
        {selectedUser && (
          <div
            style={{
              ...card,
              marginTop: 12,
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 12,
            }}
          >
            <div>
              <div style={{ fontWeight: 600 }}>{selectedUser.name}</div>
              <div style={{ color: "#6b7280", fontSize: 13 }}>
                {selectedUser.email} · {selectedUser.role} ·{" "}
                {selectedUser.tokens ?? 0} tokens
              </div>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button
                onClick={() => {
                  setGrantError(null);
                  setGrantOpen(true);
                }}
                style={{
                  background: "#fff",
                  color: "#1F93FF",
                  border: "1px solid #1F93FF",
                  padding: "8px 14px",
                  borderRadius: 6,
                  fontSize: 13,
                  fontWeight: 500,
                  cursor: "pointer",
                }}
              >
                Give grant
              </button>
              <a
                href={gmailComposeUrl(selectedUser.email)}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  background: "#1F93FF",
                  color: "#fff",
                  padding: "8px 14px",
                  borderRadius: 6,
                  fontSize: 13,
                  textDecoration: "none",
                  fontWeight: 500,
                }}
              >
                Compose email
              </a>
            </div>
          </div>
        )}

        {selectedUser && (
          <div style={{ ...card, marginTop: 12, padding: 0 }}>
            <div
              style={{
                padding: "10px 16px",
                borderBottom: "1px solid #f3f4f6",
                fontSize: 13,
                fontWeight: 600,
                color: "#374151",
              }}
            >
              {selectedUser.name}'s projects
            </div>
            {userProjectsLoading ? (
              <div style={{ padding: 16, color: "#9ca3af", fontSize: 13 }}>
                Loading…
              </div>
            ) : userProjectsError ? (
              <div style={{ padding: 16, color: "#991b1b", fontSize: 13 }}>
                {userProjectsError}
              </div>
            ) : userProjects.length === 0 ? (
              <div style={{ padding: 16, color: "#9ca3af", fontSize: 13 }}>
                No projects.
              </div>
            ) : (
              <table
                style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}
              >
                <thead style={{ background: "#f9fafb" }}>
                  <tr style={{ textAlign: "left", color: "#6b7280" }}>
                    <th style={{ padding: "10px 12px" }}>Name</th>
                    <th style={{ padding: "10px 12px" }}>Size</th>
                    <th style={{ padding: "10px 12px" }}>Frames</th>
                    <th style={{ padding: "10px 12px" }}>Created</th>
                    <th style={{ padding: "10px 12px" }} />
                  </tr>
                </thead>
                <tbody>
                  {userProjects.map((p) => (
                    <tr key={p.id} style={{ borderTop: "1px solid #f3f4f6" }}>
                      <td style={{ padding: "10px 12px" }}>{p.name}</td>
                      <td style={{ padding: "10px 12px" }}>
                        {p.width}×{p.height}
                      </td>
                      <td style={{ padding: "10px 12px" }}>{p.frame_count}</td>
                      <td style={{ padding: "10px 12px" }}>
                        {fmtDate(p.created_at)}
                      </td>
                      <td style={{ padding: "10px 12px", textAlign: "right" }}>
                        <a
                          href={`/project/${p.id}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{
                            color: "#1F93FF",
                            textDecoration: "none",
                            fontWeight: 500,
                          }}
                        >
                          Open ↗
                        </a>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}

        {grantOpen && selectedUser && (
          <div
            onClick={() => !grantBusy && setGrantOpen(false)}
            style={{
              position: "fixed",
              inset: 0,
              background: "rgba(0,0,0,0.4)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              zIndex: 1000,
            }}
          >
            <div
              onClick={(e) => e.stopPropagation()}
              style={{
                background: "#fff",
                borderRadius: 8,
                padding: 20,
                width: 400,
                maxWidth: "90vw",
                boxShadow: "0 10px 30px rgba(0,0,0,0.2)",
              }}
            >
              <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 4 }}>
                Give grant
              </div>
              <div style={{ fontSize: 13, color: "#6b7280", marginBottom: 16 }}>
                {selectedUser.name} ({selectedUser.email}) — current balance{" "}
                {selectedUser.tokens ?? 0} tokens
              </div>
              <label
                style={{
                  display: "block",
                  fontSize: 12,
                  color: "#6b7280",
                  marginBottom: 4,
                }}
              >
                Amount (tokens, negative to deduct)
              </label>
              <input
                type="number"
                value={grantAmount}
                onChange={(e) => setGrantAmount(e.target.value)}
                placeholder="e.g. 1000"
                disabled={grantBusy}
                style={{
                  width: "100%",
                  padding: "8px 10px",
                  fontSize: 14,
                  border: "1px solid #d1d5db",
                  borderRadius: 6,
                  marginBottom: 12,
                  boxSizing: "border-box",
                }}
              />
              <label
                style={{
                  display: "block",
                  fontSize: 12,
                  color: "#6b7280",
                  marginBottom: 4,
                }}
              >
                Note (optional)
              </label>
              <input
                type="text"
                value={grantNote}
                onChange={(e) => setGrantNote(e.target.value)}
                placeholder="Reason for grant"
                disabled={grantBusy}
                style={{
                  width: "100%",
                  padding: "8px 10px",
                  fontSize: 14,
                  border: "1px solid #d1d5db",
                  borderRadius: 6,
                  marginBottom: 12,
                  boxSizing: "border-box",
                }}
              />
              {grantError && (
                <div
                  style={{
                    color: "#991b1b",
                    fontSize: 13,
                    marginBottom: 12,
                  }}
                >
                  {grantError}
                </div>
              )}
              <div
                style={{
                  display: "flex",
                  justifyContent: "flex-end",
                  gap: 8,
                }}
              >
                <button
                  onClick={() => setGrantOpen(false)}
                  disabled={grantBusy}
                  style={{
                    background: "#fff",
                    color: "#374151",
                    border: "1px solid #d1d5db",
                    padding: "8px 14px",
                    borderRadius: 6,
                    fontSize: 13,
                    cursor: grantBusy ? "not-allowed" : "pointer",
                  }}
                >
                  Cancel
                </button>
                <button
                  onClick={submitGrant}
                  disabled={grantBusy}
                  style={{
                    background: "#1F93FF",
                    color: "#fff",
                    border: 0,
                    padding: "8px 14px",
                    borderRadius: 6,
                    fontSize: 13,
                    fontWeight: 500,
                    cursor: grantBusy ? "not-allowed" : "pointer",
                  }}
                >
                  {grantBusy ? "Granting…" : "Grant"}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      <div>
        <div style={{ ...sectionTitle, marginBottom: 8 }}>
          Recent Generations
        </div>
        <GenerationsList generations={generations} />
      </div>
    </div>
  );
};

export default AnalyticsPage;
