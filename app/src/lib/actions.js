// Per-project undo stacks (CMD+Z).
//
// Every realtime event from the server may carry an `inverse` describing the
// operation that would undo it. When the event's actorId matches the current
// user (regardless of source — the AI agent counts as "your action" if you
// triggered it), we push the inverse onto that user's undo stack. CMD+Z pops
// it and runs it as a new action. Redo stack is the symmetric thing for
// CMD+Shift+Z.
//
// Why server-driven instead of client-driven: the agent can edit on your
// behalf, and image generation can land asynchronously. Treating the realtime
// event as the canonical "the action happened" makes both kinds of action
// land on the stack the same way.

import { apiUrl } from "../config";

const stacks = new Map(); // projectId -> { undo: [], redo: [] }

function ensureStack(projectId) {
  let s = stacks.get(projectId);
  if (!s) {
    s = { undo: [], redo: [] };
    stacks.set(projectId, s);
  }
  return s;
}

const MAX_DEPTH = 100;

/**
 * Called by the realtime listener for every incoming event.
 * userId = current user's id; events that aren't authored by them never go on
 * the local undo stack (you can't undo someone else's edit).
 */
export function recordIncomingEvent(projectId, userId, event, { isLocalRedo, isLocalUndo } = {}) {
  if (!event || !event.inverse) return;
  if (!event.actorId || event.actorId !== userId) return;
  const s = ensureStack(projectId);
  if (isLocalUndo) {
    // The event we just received IS the undo we performed. Push its inverse
    // onto the redo stack (so CMD+Shift+Z replays the original).
    s.redo.push(event);
    if (s.redo.length > MAX_DEPTH) s.redo.shift();
    return;
  }
  if (isLocalRedo) {
    s.undo.push(event);
    if (s.undo.length > MAX_DEPTH) s.undo.shift();
    return;
  }
  // Fresh action — clears the redo branch (standard undo semantics).
  s.undo.push(event);
  if (s.undo.length > MAX_DEPTH) s.undo.shift();
  s.redo.length = 0;
}

export function popUndo(projectId) {
  const s = ensureStack(projectId);
  return s.undo.pop() || null;
}

export function popRedo(projectId) {
  const s = ensureStack(projectId);
  return s.redo.pop() || null;
}

export function canUndo(projectId) {
  return ensureStack(projectId).undo.length > 0;
}

export function canRedo(projectId) {
  return ensureStack(projectId).redo.length > 0;
}

/**
 * Apply an inverse via the API. Returns once the server has accepted the
 * change; the realtime echo will reconcile state and (because we mark the
 * call as undo/redo) feed the right stack.
 *
 * The inverse shape is the same {kind, payload} we emit from the server —
 * each kind maps to a concrete REST call here.
 */
export async function applyInverse({ projectId, inverse, token }) {
  const headers = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
  };
  const { kind, payload } = inverse;

  if (kind === "frame.updated") {
    const { id, fields } = payload;
    const body = {};
    for (const k of ["prompt", "model", "reference_urls", "result", "meta"]) {
      if (Object.prototype.hasOwnProperty.call(fields, k)) body[k] = fields[k];
    }
    return fetch(
      apiUrlFor(`/projects/${projectId}/frames/${id}`),
      { method: "PATCH", headers, body: JSON.stringify(body) },
    );
  }

  if (kind === "frame.reordered") {
    return fetch(
      apiUrlFor(`/projects/${projectId}/frame-order`),
      { method: "PATCH", headers, body: JSON.stringify({ frame_ids: payload.frame_ids }) },
    );
  }

  if (kind === "frame.deleted") {
    return fetch(
      apiUrlFor(`/projects/${projectId}/frames/${payload.id}`),
      { method: "DELETE", headers },
    );
  }

  if (kind === "frame.restore") {
    // Best-effort recreate: POST a fresh frame, then PATCH its content.
    const { snapshot } = payload;
    const created = await fetch(
      apiUrlFor(`/projects/${projectId}/frames`),
      { method: "POST", headers, body: "{}" },
    );
    if (!created.ok) return created;
    const json = await created.json();
    const newId = json?.frame?.id;
    if (!newId) return created;
    await fetch(apiUrlFor(`/projects/${projectId}/frames/${newId}`), {
      method: "PATCH",
      headers,
      body: JSON.stringify({
        prompt: snapshot.prompt || "",
        model: snapshot.model || null,
        reference_urls: snapshot.reference_urls || [],
        result: snapshot.result || null,
        meta: snapshot.meta || {},
      }),
    });
    return created;
  }

  if (kind === "project.updated") {
    return fetch(apiUrlFor(`/projects/${projectId}`), {
      method: "PATCH",
      headers,
      body: JSON.stringify(payload.fields),
    });
  }

  console.warn("[actions] no handler for inverse kind:", kind);
  return null;
}

function apiUrlFor(path) {
  return apiUrl(path);
}
