import React, { useEffect, useMemo, useRef, useState } from 'react';
import SectionHeader from '../shared/SectionHeader';
import { asset } from '../../../lib/asset';
import { useOnboarding, STEPS } from '../../../context/OnboardingContext';
import { color, font, radius, space } from '../../../lib/tokens';
import MentionEditor from '../shared/MentionEditor';

// Slack-style @mention popover. Watches the editor for an @ token whose
// caret hasn't passed a whitespace yet; while one is active, the popover
// shows project characters filtered by the typed prefix. Selecting an
// option replaces the @prefix with @CharacterName and notifies the parent
// so it can bind the character to the frame at the same time.

const popoverStyle = {
  position: 'absolute',
  bottom: '100%',
  left: 0,
  marginBottom: 4,
  width: '100%',
  maxHeight: 220,
  overflowY: 'auto',
  background: color.bg,
  border: `1px solid ${color.borderStrong}`,
  borderRadius: radius.md,
  zIndex: 50,
  padding: space[1],
};

const optionStyle = (active) => ({
  display: 'flex',
  alignItems: 'center',
  gap: space[2],
  padding: `${space[1]}px ${space[2]}px`,
  borderRadius: radius.sm,
  cursor: 'pointer',
  background: active ? color.bgMuted : 'transparent',
});

const portraitStyle = {
  width: 22,
  height: 22,
  borderRadius: '50%',
  objectFit: 'cover',
  background: color.bgSubtle,
  flex: '0 0 auto',
};

// Find the active @-token to the left of the caret. The query may include
// spaces — e.g. "@Lord Smith" — but only when some character name actually
// starts with that whitespace-containing prefix. Once the typed query no
// longer prefix-matches anyone, the mention is considered ended.
function findActiveMention(text, caret, characterNames = []) {
  if (!text) return null;
  const before = text.slice(0, caret);
  // Most recent @ that begins a valid mention (preceded by start, whitespace
  // or punctuation). Walk backward through everything — including spaces —
  // since multi-word names may legitimately contain whitespace between @ and
  // caret.
  let atIndex = -1;
  for (let i = before.length - 1; i >= 0; i--) {
    if (before[i] === '@') {
      const prev = i > 0 ? before[i - 1] : '';
      if (i === 0 || /\s|[.,;!?(){}\[\]"'`]/.test(prev)) {
        atIndex = i;
      }
      break;
    }
  }
  if (atIndex < 0) return null;
  const query = before.slice(atIndex + 1);
  // No whitespace yet → always treat as an active mention. Empty query
  // (just typed `@`) opens the popover with the full list.
  if (!/\s/.test(query)) return { atIndex, query };
  // Has whitespace — keep open only while some character name still
  // prefix-matches the query (case-insensitive). This is what makes
  // "@Lord Smith" work without committing the popover at the space.
  const lowerQ = query.toLowerCase();
  const stillMatches = characterNames.some((n) =>
    String(n || '').toLowerCase().startsWith(lowerQ),
  );
  return stillMatches ? { atIndex, query } : null;
}

const PromptSection = ({
  prompt,
  onPromptChange,
  isTransitioning,
  promptLabel,
  characters = [],
  onMentionCharacter,
}) => {
  const onboarding = useOnboarding();
  const editorRef = useRef(null);
  const [mention, setMention] = useState(null);
  const [activeIndex, setActiveIndex] = useState(0);

  const matches = useMemo(() => {
    if (!mention) return [];
    const q = mention.query.toLowerCase();
    return characters
      .filter((c) => (c.name || '').toLowerCase().startsWith(q))
      .slice(0, 8);
  }, [mention, characters]);

  useEffect(() => {
    if (matches.length === 0) setActiveIndex(0);
    else if (activeIndex >= matches.length) setActiveIndex(0);
  }, [matches, activeIndex]);

  const isVideoPrompt = promptLabel === 'VIDEO PROMPT';

  const characterNames = useMemo(() => characters.map((c) => c.name), [characters]);

  // Walk the saved text + caret offset to find the active mention. Using
  // the *prop* value here is intentional — it's already in sync with the
  // editor's text content, since the editor calls onChange before the
  // parent re-renders us.
  const updateMentionFromCaret = (textOverride) => {
    const editor = editorRef.current;
    if (!editor) return;
    const caret = editor.getCaretOffset();
    if (caret == null) {
      setMention(null);
      return;
    }
    const text = textOverride != null ? textOverride : prompt || '';
    setMention(findActiveMention(text, caret, characterNames));
  };

  const handleEditorChange = (text) => {
    if (text && text.trim().length > 0) {
      onboarding.advanceFrom(STEPS.EDITOR_PROMPT);
    }
    onPromptChange?.({ target: { value: text } });
    // Caret has already moved by the time onChange fires; recompute against
    // the new text so the popover stays accurate as the user types.
    requestAnimationFrame(() => updateMentionFromCaret(text));
  };

  const insertMention = (character) => {
    const editor = editorRef.current;
    if (!editor || !mention) return;
    const value = prompt || '';
    const before = value.slice(0, mention.atIndex);
    const afterStart = mention.atIndex + 1 + mention.query.length;
    const after = value.slice(afterStart);
    const inserted = `@${character.name} `;
    const nextValue = before + inserted + after;
    const nextCaret = (before + inserted).length;

    onPromptChange?.({ target: { value: nextValue } });
    setMention(null);
    // Wait for parent to re-render us with the new value, then place caret.
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        editor.setCaretOffset(nextCaret);
      });
    });
    onMentionCharacter?.(character);
  };

  const handleKeyDown = (e) => {
    if (!mention || matches.length === 0) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex((i) => (i + 1) % matches.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex((i) => (i - 1 + matches.length) % matches.length);
    } else if (e.key === 'Enter' || e.key === 'Tab') {
      e.preventDefault();
      insertMention(matches[activeIndex]);
    } else if (e.key === 'Escape') {
      setMention(null);
    }
  };

  const handleSelect = () => {
    updateMentionFromCaret();
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: space[2] }}>
      <SectionHeader icon={asset('icons/Prompt.svg')} label={isVideoPrompt ? 'Video prompt' : 'Prompt'} />

      <div style={{ display: 'flex', flexDirection: 'column', gap: space[1], position: 'relative' }}>
        <MentionEditor
          ref={editorRef}
          value={prompt || ''}
          characterNames={characterNames}
          onChange={handleEditorChange}
          onKeyDown={handleKeyDown}
          onSelect={handleSelect}
          onBlur={() => setTimeout(() => setMention(null), 100)}
          placeholder={
            isVideoPrompt
              ? 'Describe the motion between the two frames…'
              : 'Describe the scene… try @character'
          }
          data-onboard="prompt-textarea"
          minHeight={64}
          maxHeight={140}
          style={{
            border: `1px solid ${color.border}`,
            borderRadius: radius.md,
            padding: '6px 10px',
            background: color.bg,
            fontFamily: 'inherit',
            fontSize: font.size.md,
            lineHeight: 1.45,
            color: color.text,
            opacity: isTransitioning ? 0 : 1,
            transition: 'opacity 0.2s ease-in-out, border-color 120ms ease',
          }}
        />
        {mention && matches.length > 0 ? (
          <div style={popoverStyle}>
            {matches.map((c, i) => (
              <div
                key={c.id}
                role="button"
                onMouseDown={(e) => {
                  // mousedown beats blur — blur would tear down the popover
                  // before onClick fires.
                  e.preventDefault();
                  insertMention(c);
                }}
                onMouseEnter={() => setActiveIndex(i)}
                style={optionStyle(i === activeIndex)}
              >
                {c.image_url ? (
                  <img src={c.image_url} alt="" style={portraitStyle} />
                ) : (
                  <span style={{ ...portraitStyle, display: 'inline-block' }} />
                )}
                <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                  <span
                    style={{
                      fontSize: font.size.sm,
                      color: color.text,
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                    }}
                  >
                    {c.name}
                  </span>
                  {c.description ? (
                    <span
                      style={{
                        fontSize: 10,
                        color: color.textFaint,
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                      }}
                    >
                      {c.description}
                    </span>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
};

export default PromptSection;
