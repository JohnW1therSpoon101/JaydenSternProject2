export const API = {
  process: "/api/process",
  stream: (task) => `/api/logs/stream?task_id=${encodeURIComponent(task)}`,
  status: (task) => `/api/status/${encodeURIComponent(task)}`,
};

export async function startProcess(payload) {
  const res = await fetch(API.process, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(`Start failed (${res.status})`);
  return res.json();
}

export async function fetchStatus(task) {
  const res = await fetch(API.status(task));
  if (!res.ok) return null;
  return res.json();
}
