/**
 * Walk the prompt text and emit a list of {type:'text'|'mention', text}
 * segments. Each `@Token` whose name matches an existing project character
 * becomes a mention segment; everything else is plain text. Used by the
 * highlight overlay to paint chip backgrounds behind real character mentions
 * only — typos like @asfasf get no chip, so the user sees at a glance whether
 * their @ resolved.
 *
 * Multi-word names ("Lord Smith") are supported: at every `@`, we try the
 * longest known name that exactly follows (case-insensitive) and isn't
 * butted up against another word character. Longest-first prevents a name
 * "Lord" from preempting "Lord Smith".
 */
export function buildMentionSegments(text, characterNames) {
  const segments = [];
  if (!text) return segments;
  // Sort longest-first so the greedy match prefers "Lord Smith" over "Lord".
  const names = (characterNames || [])
    .map((n) => String(n || ''))
    .filter(Boolean)
    .sort((a, b) => b.length - a.length);
  let plainStart = 0;
  let i = 0;
  while (i < text.length) {
    if (text[i] === '@') {
      const prev = i > 0 ? text[i - 1] : '';
      const atBoundary = i === 0 || /\s|[.,;!?(){}\[\]"'`]/.test(prev);
      if (atBoundary) {
        let matched = null;
        for (const name of names) {
          const candidate = text.slice(i + 1, i + 1 + name.length);
          if (candidate.toLowerCase() === name.toLowerCase()) {
            // Avoid matching "@LordSmithers" against the name "Lord Smith"
            // — require the next char to be a non-word boundary (or EOF).
            const nextCh = text[i + 1 + name.length];
            if (nextCh === undefined || !/[A-Za-z0-9_]/.test(nextCh)) {
              matched = name;
              break;
            }
          }
        }
        if (matched) {
          const end = i + 1 + matched.length;
          if (plainStart < i) segments.push({ type: 'text', text: text.slice(plainStart, i) });
          segments.push({ type: 'mention', text: text.slice(i, end) });
          plainStart = end;
          i = end;
          continue;
        }
      }
    }
    i++;
  }
  if (plainStart < text.length) segments.push({ type: 'text', text: text.slice(plainStart) });
  return segments;
}
