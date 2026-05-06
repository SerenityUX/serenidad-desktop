import React, {
  forwardRef,
  useImperativeHandle,
  useLayoutEffect,
  useRef,
} from 'react';
import { color, radius } from '../../../lib/tokens';
import { buildMentionSegments } from '../../../lib/mentions';

/**
 * Slack-style mention editor. Uses `contenteditable` so mention chips are
 * real DOM spans rendered inline with the text — no mirror layer, no
 * pixel-matching tricks. Highlights for `@CharacterName` substrings appear
 * exactly where the glyphs sit, by construction.
 *
 * Caret preservation across re-renders: before React commits, we capture
 * the caret as an offset into the root's textContent; after commit, we walk
 * the DOM in order and place the caret at the matching offset. This keeps
 * typing fluid even when the segment structure changes (e.g. an @-token
 * crosses the boundary into a known character name and gains a chip).
 *
 * `onChange(text)` reports the plain text content. The component is
 * controlled — `value` always reflects the source of truth from the parent.
 */

function getCaretOffset(root) {
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0) return null;
  const range = sel.getRangeAt(0);
  if (!root.contains(range.endContainer)) return null;
  const pre = document.createRange();
  pre.selectNodeContents(root);
  pre.setEnd(range.endContainer, range.endOffset);
  return pre.toString().length;
}

function setCaretOffset(root, n) {
  if (n == null) return;
  const sel = window.getSelection();
  if (!sel) return;
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null);
  let acc = 0;
  let node = walker.nextNode();
  while (node) {
    const len = node.nodeValue.length;
    if (acc + len >= n) {
      const range = document.createRange();
      range.setStart(node, Math.max(0, Math.min(len, n - acc)));
      range.collapse(true);
      sel.removeAllRanges();
      sel.addRange(range);
      return;
    }
    acc += len;
    node = walker.nextNode();
  }
  const range = document.createRange();
  range.selectNodeContents(root);
  range.collapse(false);
  sel.removeAllRanges();
  sel.addRange(range);
}

const chipStyle = {
  background: color.bgAccentSubtle,
  color: color.textAccent,
  borderRadius: radius.sm,
  padding: '0 3px',
  margin: '0 1px',
  boxShadow: `inset 0 0 0 1px ${color.borderFocus}`,
  fontWeight: 500,
};

const MentionEditor = forwardRef(function MentionEditor(
  {
    value,
    characterNames = [],
    onChange,
    onKeyDown,
    onSelect,
    onFocus,
    onBlur,
    placeholder,
    style,
    minHeight = 84,
    maxHeight,
    autoFocus,
    spellCheck = true,
    'data-onboard': dataOnboard,
    ariaLabel,
  },
  apiRef,
) {
  const ref = useRef(null);
  const pendingCaret = useRef(null);
  const composing = useRef(false);

  useImperativeHandle(apiRef, () => ({
    focus: () => ref.current?.focus(),
    blur: () => ref.current?.blur(),
    getCaretOffset: () =>
      ref.current ? getCaretOffset(ref.current) : null,
    setCaretOffset: (n) => {
      const el = ref.current;
      if (!el) return;
      el.focus();
      setCaretOffset(el, n);
    },
    getElement: () => ref.current,
  }));

  const segments = buildMentionSegments(value || '', characterNames);

  // After every commit, if the user is typing into us, restore the caret to
  // the offset we captured before React replaced our children. Without this,
  // any segment change would yank the caret to position 0.
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (document.activeElement === el && pendingCaret.current != null) {
      setCaretOffset(el, pendingCaret.current);
      pendingCaret.current = null;
    }
  });

  // Initial autofocus.
  useLayoutEffect(() => {
    if (autoFocus) ref.current?.focus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleInput = () => {
    const el = ref.current;
    if (!el) return;
    // Skip mid-composition (IME): the value is still being assembled and
    // re-rendering would clobber the composition window.
    if (composing.current) return;
    const text = readPlainText(el);
    pendingCaret.current = getCaretOffset(el);
    onChange?.(text);
  };

  const handleCompositionStart = () => {
    composing.current = true;
  };

  const handleCompositionEnd = () => {
    composing.current = false;
    handleInput();
  };

  const handlePaste = (e) => {
    e.preventDefault();
    const text = (e.clipboardData || window.clipboardData)?.getData?.('text/plain') || '';
    if (!text) return;
    // Plain-text insert keeps the contenteditable from accumulating styled
    // markup from the source app (Word, web pages, etc).
    document.execCommand('insertText', false, text);
  };

  const isEmpty = !value || value.length === 0;

  // Build inline children. Plain segments render as raw strings — React
  // creates text nodes; mention segments render as styled spans. Keys are
  // segment-position based; if React reorders, caret restore handles it.
  const children = segments.map((s, i) => {
    if (s.type === 'mention') {
      return (
        <span
          key={`m-${i}`}
          data-mention="true"
          style={chipStyle}
          // Belt-and-suspenders: even if the user fights us, the chip's
          // visual is always the substring we matched.
        >
          {s.text}
        </span>
      );
    }
    return (
      <React.Fragment key={`t-${i}`}>{s.text}</React.Fragment>
    );
  });

  return (
    <div
      style={{
        position: 'relative',
        width: '100%',
        minHeight,
      }}
    >
      {isEmpty && placeholder ? (
        <div
          aria-hidden
          style={{
            position: 'absolute',
            inset: 0,
            boxSizing: 'border-box',
            color: color.textFaint,
            pointerEvents: 'none',
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word',
            textAlign: 'left',
            ...style,
          }}
        >
          {placeholder}
        </div>
      ) : null}
      <div
        ref={ref}
        contentEditable
        suppressContentEditableWarning
        spellCheck={spellCheck}
        role="textbox"
        aria-multiline="true"
        aria-label={ariaLabel}
        data-onboard={dataOnboard}
        onInput={handleInput}
        onCompositionStart={handleCompositionStart}
        onCompositionEnd={handleCompositionEnd}
        onKeyDown={onKeyDown}
        onKeyUp={onSelect}
        onClick={onSelect}
        onFocus={onFocus}
        onBlur={onBlur}
        onPaste={handlePaste}
        style={{
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-word',
          outline: 'none',
          width: '100%',
          boxSizing: 'border-box',
          minHeight,
          maxHeight,
          overflowY: maxHeight ? 'auto' : undefined,
          textAlign: 'left',
          ...style,
        }}
      >
        {children}
      </div>
    </div>
  );
});

/**
 * Read plain text from a contenteditable. Browsers serialize newlines
 * differently — Chrome wraps them in `<div>`, Safari uses `<br>`. Walk the
 * tree manually so we get a stable `\n`-joined string regardless.
 */
function readPlainText(root) {
  const out = [];
  const walk = (node, isBlockBoundary) => {
    if (node.nodeType === Node.TEXT_NODE) {
      out.push(node.nodeValue);
      return;
    }
    if (node.nodeType !== Node.ELEMENT_NODE) return;
    const tag = node.tagName;
    if (tag === 'BR') {
      out.push('\n');
      return;
    }
    const isBlock =
      tag === 'DIV' || tag === 'P' || tag === 'LI';
    // A new block that isn't the very first node introduces a newline.
    if (isBlock && !isBlockBoundary && out.length > 0) {
      out.push('\n');
    }
    let first = true;
    for (const child of node.childNodes) {
      walk(child, first && isBlock);
      first = false;
    }
  };
  walk(root, true);
  return out.join('').replace(/​/g, '');
}

export default MentionEditor;
