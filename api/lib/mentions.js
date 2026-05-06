// Source-of-truth helper for "the bound characters of a frame".
//
// `@Name` mentions in the scene prompt ARE the binding — there is no separate
// bind/unbind action. Generation routes call this to turn a prompt + the
// project's character roster into an ordered, de-duped list of characters
// (in first-mention order) that gets passed to applyCharacterPrompt.

/**
 * Walk the prompt and emit the characters mentioned, in first-occurrence
 * order, deduped. Match rules:
 *   - `@Name` always counts (any name length, including multi-word names).
 *   - Bare `Name` (no `@`) counts only when the name is ≥4 chars or contains
 *     whitespace — short names like "Tom" require an explicit `@` so we
 *     don't trigger on common English words.
 *   - Word-boundary on both sides so "Asuna" doesn't match inside other words.
 *   - Case-insensitive.
 *   - Longest-first matching prevents "Lord" preempting "Lord Smith".
 *
 * @param {string} prompt
 * @param {Array<{id:string,name:string,description?:string|null,image_url?:string|null}>} characters
 * @returns {Array<typeof characters[number]>}
 */
function extractMentionedCharacters(prompt, characters) {
  if (!prompt || !Array.isArray(characters) || characters.length === 0) return [];
  const named = characters
    .map((c) => ({ row: c, name: String(c?.name || "").trim() }))
    .filter((x) => x.name);
  if (named.length === 0) return [];

  // Sort longest-first so multi-word names beat single-word prefixes.
  const sorted = [...named].sort((a, b) => b.name.length - a.name.length);

  const firstHitAt = new Map();
  for (let i = 0; i < prompt.length; i++) {
    const isAt = prompt[i] === "@";
    const before = i > 0 ? prompt[i - 1] : "";
    if (isAt) {
      const validAtBoundary = i === 0 || /\s|[.,;!?(){}\[\]"'`]/.test(before);
      if (!validAtBoundary) continue;
    } else {
      // Bare-match must start at a word boundary and not after `@` (which
      // is its own path above).
      if (/[A-Za-z0-9_@]/.test(before)) continue;
    }

    const nameStart = isAt ? i + 1 : i;
    let matched = null;
    for (const c of sorted) {
      const safeBare = c.name.length >= 4 || /\s/.test(c.name);
      if (!isAt && !safeBare) continue;
      const candidate = prompt.slice(nameStart, nameStart + c.name.length);
      if (candidate.toLowerCase() === c.name.toLowerCase()) {
        const nextCh = prompt[nameStart + c.name.length];
        if (nextCh === undefined || !/[A-Za-z0-9_]/.test(nextCh)) {
          matched = c;
          break;
        }
      }
    }
    if (matched) {
      if (!firstHitAt.has(matched.row.id)) firstHitAt.set(matched.row.id, i);
      // Skip past this match.
      i = nameStart + matched.name.length - 1;
    }
  }

  return [...firstHitAt.entries()]
    .sort((a, b) => a[1] - b[1])
    .map(([id]) => named.find((x) => x.row.id === id)?.row)
    .filter(Boolean);
}

/**
 * Find character names that appear in the prompt as bare words (case-
 * insensitive, word-boundary-anchored) but NOT preceded by an @. Used to
 * emit a "you forgot the @" warning to the chat agent. Excludes names that
 * are also matched as proper @-mentions, so "@Alice and Alice" only flags
 * once.
 *
 * @param {string} prompt
 * @param {Array<{name:string}>} characters
 * @returns {string[]} unique names that appear bare
 */
function findUnmentionedCharacters(prompt, characters) {
  if (!prompt || !Array.isArray(characters) || characters.length === 0) return [];
  const names = characters
    .map((c) => String(c?.name || "").trim())
    .filter(Boolean);
  if (names.length === 0) return [];
  const out = new Set();
  for (const name of names) {
    // Word-boundary regex around the name. Reject when the immediately
    // preceding char is `@` (already a mention) or alphanumeric (substring).
    const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const re = new RegExp(`(^|[^A-Za-z0-9_@])${escaped}(?![A-Za-z0-9_])`, "gi");
    if (re.test(prompt)) out.add(name);
  }
  return [...out];
}

module.exports = { extractMentionedCharacters, findUnmentionedCharacters };
