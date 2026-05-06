import React from 'react';

/**
 * Tiny safe Markdown renderer. No HTML pass-through, no eval. Supports:
 *   # / ## / ### headings, **bold**, *italic*, _italic_, `code`,
 *   - / * bullet lists, 1. numbered lists, blank-line paragraphs.
 * Links are not auto-linked — keep it predictable inside the editor chat.
 */
function renderInline(text, keyPrefix = '') {
  // Walk the string left-to-right, peeling off the next markup token.
  const out = [];
  let i = 0;
  let buf = '';
  let k = 0;
  const flushBuf = () => {
    if (buf) {
      out.push(buf);
      buf = '';
    }
  };
  while (i < text.length) {
    const rest = text.slice(i);
    let m;
    if ((m = rest.match(/^\*\*([^*]+)\*\*/))) {
      flushBuf();
      out.push(<strong key={`${keyPrefix}b${k++}`}>{m[1]}</strong>);
      i += m[0].length;
    } else if ((m = rest.match(/^\*([^*\n]+)\*/))) {
      flushBuf();
      out.push(<em key={`${keyPrefix}i${k++}`}>{m[1]}</em>);
      i += m[0].length;
    } else if ((m = rest.match(/^_([^_\n]+)_/))) {
      flushBuf();
      out.push(<em key={`${keyPrefix}u${k++}`}>{m[1]}</em>);
      i += m[0].length;
    } else if ((m = rest.match(/^`([^`\n]+)`/))) {
      flushBuf();
      out.push(
        <code
          key={`${keyPrefix}c${k++}`}
          style={{
            background: '#F4F4F4',
            border: '1px solid #EAEAEA',
            borderRadius: 4,
            padding: '0 4px',
            fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
            fontSize: '0.92em',
          }}
        >
          {m[1]}
        </code>,
      );
      i += m[0].length;
    } else {
      buf += text[i];
      i += 1;
    }
  }
  flushBuf();
  return out;
}

const HEADING_STYLE = {
  1: { fontSize: 18, fontWeight: 700, margin: '8px 0 4px' },
  2: { fontSize: 16, fontWeight: 700, margin: '8px 0 4px' },
  3: { fontSize: 14, fontWeight: 600, margin: '6px 0 4px' },
};

export function renderMarkdown(src) {
  if (!src) return null;
  const lines = String(src).replace(/\r\n/g, '\n').split('\n');
  const blocks = [];
  let i = 0;
  let k = 0;

  while (i < lines.length) {
    const line = lines[i];

    // Headings.
    const h = line.match(/^(#{1,3})\s+(.*)$/);
    if (h) {
      const level = h[1].length;
      const Tag = `h${level}`;
      blocks.push(
        <Tag key={`h${k++}`} style={HEADING_STYLE[level]}>
          {renderInline(h[2], `h${k}-`)}
        </Tag>,
      );
      i += 1;
      continue;
    }

    // Numbered list.
    if (/^\s*\d+\.\s+/.test(line)) {
      const items = [];
      while (i < lines.length && /^\s*\d+\.\s+/.test(lines[i])) {
        const m = lines[i].match(/^\s*\d+\.\s+(.*)$/);
        items.push(
          <li key={`li${k++}`} style={{ margin: '2px 0' }}>
            {renderInline(m[1], `li${k}-`)}
          </li>,
        );
        i += 1;
      }
      blocks.push(
        <ol key={`ol${k++}`} style={{ paddingLeft: 22, margin: '4px 0' }}>
          {items}
        </ol>,
      );
      continue;
    }

    // Bullet list.
    if (/^\s*[-*]\s+/.test(line)) {
      const items = [];
      while (i < lines.length && /^\s*[-*]\s+/.test(lines[i])) {
        const m = lines[i].match(/^\s*[-*]\s+(.*)$/);
        items.push(
          <li key={`li${k++}`} style={{ margin: '2px 0' }}>
            {renderInline(m[1], `li${k}-`)}
          </li>,
        );
        i += 1;
      }
      blocks.push(
        <ul key={`ul${k++}`} style={{ paddingLeft: 22, margin: '4px 0' }}>
          {items}
        </ul>,
      );
      continue;
    }

    // Blank line → paragraph break.
    if (line.trim() === '') {
      i += 1;
      continue;
    }

    // Paragraph: collect until next blank line or block boundary.
    const paraLines = [];
    while (
      i < lines.length &&
      lines[i].trim() !== '' &&
      !/^(#{1,3})\s/.test(lines[i]) &&
      !/^\s*\d+\.\s+/.test(lines[i]) &&
      !/^\s*[-*]\s+/.test(lines[i])
    ) {
      paraLines.push(lines[i]);
      i += 1;
    }
    const paraText = paraLines.join('\n');
    blocks.push(
      <p key={`p${k++}`} style={{ margin: '4px 0', lineHeight: 1.55 }}>
        {renderInline(paraText, `p${k}-`)}
      </p>,
    );
  }

  return blocks;
}
