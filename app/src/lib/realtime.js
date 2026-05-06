// Client realtime primitive.
//
// One EventSource per projectId, ref-counted across components. Components
// subscribe via subscribeProject(projectId, token, onEvent) and get an
// unsubscribe() back. The EventSource is closed when the last subscriber
// leaves.
//
// Reliability:
// - Tracks lastSeq per project. On reconnect (auto via EventSource, or after
//   a visibility resume) we open with ?since=<seq> so the server replays any
//   events written while we were disconnected.
// - Pauses on document.hidden (closes the connection) and resumes on
//   visibility return — saves a socket per backgrounded tab.
//
// THE RULE FOR FUTURE FEATURES:
// Anything that mutates project state on the server should be subscribed-to
// here. The flow is always:
//   1. local optimistic apply
//   2. POST to API
//   3. server emits a project_events row
//   4. SSE fans it out — including back to us
//   5. our handler reconciles by id (last-write-wins, server is truth)
// Wire your new feature's reducer into onEvent and you get multi-user sync
// for free.

import { apiUrl } from "../config";

const channels = new Map(); // projectId -> Channel

class Channel {
  constructor(projectId, token) {
    this.projectId = projectId;
    this.token = token;
    this.listeners = new Set();
    this.lastSeq = 0;
    this.es = null;
    this.closed = false;
    this._onVisibility = this._onVisibility.bind(this);
    document.addEventListener("visibilitychange", this._onVisibility);
    this._open();
  }

  _open() {
    if (this.closed) return;
    if (document.hidden) return;
    this._closeEs();
    const sinceParam = this.lastSeq > 0 ? `&since=${this.lastSeq}` : "";
    const url = apiUrl(
      `/realtime/projects/${encodeURIComponent(this.projectId)}/stream?token=${encodeURIComponent(this.token)}${sinceParam}`,
    );
    const es = new EventSource(url);
    this.es = es;
    es.addEventListener("change", (e) => {
      let data;
      try {
        data = JSON.parse(e.data);
      } catch {
        return;
      }
      if (typeof data.seq === "number" && data.seq > this.lastSeq) {
        this.lastSeq = data.seq;
      }
      for (const fn of this.listeners) {
        try {
          fn(data);
        } catch (err) {
          console.error("[realtime] listener threw:", err);
        }
      }
    });
    es.addEventListener("error", () => {
      // EventSource auto-reconnects on its own. Browsers don't allow setting
      // ?since on those auto-reconnects, so when the network actually drops,
      // we tear down and re-open with the right since= to replay.
      if (es.readyState === EventSource.CLOSED) {
        setTimeout(() => this._open(), 1000);
      }
    });
  }

  _closeEs() {
    if (this.es) {
      try {
        this.es.close();
      } catch {}
      this.es = null;
    }
  }

  _onVisibility() {
    if (this.closed) return;
    if (document.hidden) {
      this._closeEs();
    } else if (!this.es) {
      this._open();
    }
  }

  add(fn) {
    this.listeners.add(fn);
    return () => {
      this.listeners.delete(fn);
      if (this.listeners.size === 0) this.shutdown();
    };
  }

  shutdown() {
    if (this.closed) return;
    this.closed = true;
    document.removeEventListener("visibilitychange", this._onVisibility);
    this._closeEs();
    channels.delete(this.projectId);
  }
}

export function subscribeProject(projectId, token, onEvent) {
  if (!projectId || !token) return () => {};
  let ch = channels.get(projectId);
  if (!ch) {
    ch = new Channel(projectId, token);
    channels.set(projectId, ch);
  }
  return ch.add(onEvent);
}

// Test helper — closes everything. Useful for hot reload.
export function _shutdownAll() {
  for (const ch of [...channels.values()]) ch.shutdown();
}
