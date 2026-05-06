import React, { useEffect, useRef, useState, useCallback } from 'react';
import { apiUrl } from '../../../config';
import { useAuth } from '../../../context/AuthContext';
import UserAvatar from '../../UserAvatar';
import { asset } from '../../../lib/asset';
import { APP_FONT_STACK } from '../../../lib/fonts';
import AttachPicker from './AttachPicker';
import { renderMarkdown } from '../../../lib/markdown';
import ChatViewSkeleton from './ChatViewSkeleton';
import { subscribeProject } from '../../../lib/realtime';
import SfIcon from '../../ui/SfIcon';

const FlowerIcon = ({ size = 28, spinning = false }) => (
  <img
    src={asset('KodanFlower.png')}
    alt="CoCreate"
    style={{
      width: size,
      height: size,
      objectFit: 'contain',
      flexShrink: 0,
      animation: spinning ? 'cocreate-flower-spin 2.4s linear infinite' : 'none',
    }}
  />
);

const ASSISTANT_NAME = 'CoCreate';

const MAX_W = 760;

// Tool metadata. `icon` is an SfIcon name; `label` is the human-readable
// past-tense action; `target` returns a navigation descriptor consumed by
// onToolNavigate (or null for non-tappable tools like delete).
const TOOL_META = {
  list_scenes: {
    icon: 'list',
    label: 'Read storyboard',
    target: () => ({ tab: 'storyboard' }),
  },
  list_characters: {
    icon: 'person',
    label: 'Read characters',
    target: () => ({ tab: 'characters' }),
  },
  list_models: {
    icon: 'photo',
    label: 'Listed models',
    target: null,
  },
  list_styles: {
    icon: 'tag',
    label: 'Listed styles',
    target: null,
  },
  edit_scene_prompt: {
    icon: 'pencil',
    label: 'Edited prompt',
    target: (args) => ({ tab: 'storyboard', sceneIndex: args.sceneIndex }),
  },
  set_scene_model: {
    icon: 'photo',
    label: 'Set model',
    target: (args) => ({ tab: 'storyboard', sceneIndex: args.sceneIndex }),
  },
  add_reference_to_scene: {
    icon: 'link',
    label: 'Added reference',
    target: (args) => ({ tab: 'storyboard', sceneIndex: args.sceneIndex }),
  },
  set_scene_voiceline: {
    icon: 'pencil',
    label: 'Set voiceline',
    target: (args) => ({ tab: 'storyboard', sceneIndex: args.sceneIndex }),
  },
  set_scene: {
    icon: 'pencil',
    label: 'Updated scene',
    target: (args) => ({ tab: 'storyboard', sceneIndex: args.sceneIndex }),
  },
  add_scene: {
    icon: 'plusRectangle',
    label: 'Added scene',
    target: (_args, result) =>
      result && result.sceneIndex
        ? { tab: 'storyboard', sceneIndex: result.sceneIndex }
        : { tab: 'storyboard' },
  },
  delete_scene: {
    icon: 'trash',
    label: 'Deleted scene',
    target: null,
  },
  delete_character: {
    icon: 'trash',
    label: 'Deleted character',
    target: () => ({ tab: 'characters' }),
  },
  delete_empty_scenes: {
    icon: 'trash',
    label: 'Cleared empty scenes',
    target: () => ({ tab: 'storyboard' }),
  },
  set_project_style: {
    icon: 'tag',
    label: 'Set style',
    target: () => ({ tab: 'storyboard' }),
  },
  generate_scene: {
    icon: 'sparkles',
    label: 'Generated',
    target: (args) =>
      args.sceneIndex ? { tab: 'storyboard', sceneIndex: args.sceneIndex } : null,
  },
};

// Tools that produce a character payload — render as a satisfying card
// instead of the small pill, since the user is creating something they'll
// see and reuse rather than just a side-effect on the storyboard.
const CHARACTER_CARD_TOOLS = new Set([
  'create_character',
  'update_character',
  'regenerate_character_portrait',
]);

function CharacterToolCard({ entry, onOpen }) {
  const failed = entry.result && entry.result.error;
  const character = entry.result && entry.result.character;
  const isPending = !entry.result;
  const verbByTool = {
    create_character: 'Created character',
    update_character: 'Updated character',
    regenerate_character_portrait: 'Regenerated portrait',
  };
  const verb = verbByTool[entry.name] || 'Character';

  if (failed) {
    return (
      <span
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
          padding: '3px 9px 3px 7px',
          background: '#FFF1F0',
          border: '1px solid #F2C7C2',
          color: '#A33',
          borderRadius: 999,
          fontSize: 11,
        }}
        title={entry.result?.error}
      >
        <SfIcon name="warning" size={12} strokeWidth={1.7} />
        <span>{verb} failed</span>
      </span>
    );
  }

  const cardStyle = {
    display: 'flex',
    alignItems: 'stretch',
    gap: 10,
    padding: 8,
    background: '#fff',
    border: '1px solid #EFEAF6',
    borderRadius: 12,
    minWidth: 220,
    maxWidth: 320,
    boxShadow: '0 2px 10px rgba(35, 20, 90, 0.05)',
    cursor: onOpen ? 'pointer' : 'default',
    fontFamily: 'inherit',
    animation: 'cocreate-character-card-in 320ms cubic-bezier(0.2, 0.9, 0.3, 1.4)',
    transition: 'box-shadow 160ms ease, transform 160ms ease',
  };

  return (
    <div
      role={onOpen ? 'button' : undefined}
      onClick={onOpen}
      onMouseEnter={(e) => {
        if (!onOpen) return;
        e.currentTarget.style.boxShadow = '0 6px 18px rgba(35, 20, 90, 0.10)';
        e.currentTarget.style.transform = 'translateY(-1px)';
      }}
      onMouseLeave={(e) => {
        if (!onOpen) return;
        e.currentTarget.style.boxShadow = cardStyle.boxShadow;
        e.currentTarget.style.transform = 'translateY(0)';
      }}
      style={cardStyle}
    >
      <div
        style={{
          position: 'relative',
          width: 60,
          height: 80,
          flex: '0 0 auto',
          borderRadius: 8,
          overflow: 'hidden',
          background: 'linear-gradient(135deg, #F2EAFB 0%, #E2EEFF 100%)',
        }}
      >
        {character?.imageUrl ? (
          <img
            src={character.imageUrl}
            alt=""
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              animation: 'cocreate-character-portrait-fade 320ms ease',
            }}
          />
        ) : isPending ? (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              background:
                'linear-gradient(110deg, #F0EAFF 0%, #E4F0FF 50%, #F0EAFF 100%)',
              backgroundSize: '200% 100%',
              animation: 'cocreate-character-shimmer 1.4s ease-in-out infinite',
            }}
          />
        ) : (
          <div
            style={{
              width: '100%',
              height: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#9A8FBF',
            }}
          >
            <SfIcon name="person" size={20} strokeWidth={1.5} />
          </div>
        )}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0, paddingTop: 2 }}>
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 4,
            padding: '1px 7px',
            background: 'linear-gradient(90deg, #F0EAFF 0%, #E4F0FF 100%)',
            color: '#5A4AB5',
            borderRadius: 999,
            fontSize: 10,
            fontWeight: 600,
            letterSpacing: 0.2,
            width: 'fit-content',
          }}
        >
          <SfIcon name="sparkles" size={9} strokeWidth={2} /> {verb}
        </span>
        <div
          style={{
            fontSize: 13,
            fontWeight: 600,
            color: '#1f2328',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          {character?.name || (isPending ? 'Generating…' : 'Character')}
        </div>
        {character?.description ? (
          <div
            style={{
              fontSize: 11,
              color: '#656d76',
              lineHeight: 1.35,
              display: '-webkit-box',
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden',
            }}
          >
            {character.description}
          </div>
        ) : null}
      </div>
    </div>
  );
}

function ToolCallPill({ entry, onNavigate }) {
  const meta = TOOL_META[entry.name] || { icon: 'sparkles', label: entry.name, target: null };
  const failed = entry.result && entry.result.error;
  const sceneIndex =
    entry.args?.sceneIndex ||
    (entry.result && entry.result.sceneIndex) ||
    null;
  const nav = !failed && meta.target ? meta.target(entry.args || {}, entry.result || {}) : null;
  const tappable = Boolean(nav && onNavigate);

  const tooltip = tappable
    ? `Open${sceneIndex ? ` scene ${sceneIndex}` : ''}`
    : JSON.stringify(entry.args || {});

  const baseStyle = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    padding: '0 9px 0 7px',
    background: failed ? '#FFF1F0' : '#F4F8FF',
    border: `1px solid ${failed ? '#F2C7C2' : '#D7E6FF'}`,
    color: failed ? '#A33' : '#1F4E8F',
    borderRadius: 999,
    fontSize: 11,
    fontFamily: 'inherit',
    lineHeight: 1,
    // Fixed height — flex parents that also contain a tall character card
    // would otherwise stretch the pill via default `align-items: stretch`.
    height: 22,
    boxSizing: 'border-box',
    flexShrink: 0,
    whiteSpace: 'nowrap',
  };

  const content = (
    <>
      <SfIcon name={failed ? 'warning' : meta.icon} size={12} strokeWidth={1.7} />
      <span>{failed ? `${meta.label} failed` : meta.label}</span>
      {sceneIndex ? (
        <span style={{ opacity: 0.65 }}>· scene {sceneIndex}</span>
      ) : null}
      {tappable ? (
        <SfIcon name="arrowUpRight" size={10} strokeWidth={1.6} style={{ opacity: 0.55, marginLeft: 1 }} />
      ) : null}
    </>
  );

  if (!tappable) {
    return <span style={baseStyle} title={tooltip}>{content}</span>;
  }

  return (
    <button
      type="button"
      onClick={() => onNavigate(nav)}
      title={tooltip}
      style={{
        ...baseStyle,
        cursor: 'pointer',
        transition: 'background-color 120ms ease, border-color 120ms ease',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = '#E9F0FF';
        e.currentTarget.style.borderColor = '#B8D2FF';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = baseStyle.background;
        e.currentTarget.style.borderColor = baseStyle.border.split(' ').pop();
      }}
    >
      {content}
    </button>
  );
}

// One row in the approval list: small 16:9 preview, prompt text, status or
// inline Generate / Reject buttons. Cursor-style — clean, dense, monochrome.
function ApprovalRow({ item, onApprove, onSkip, onNavigate }) {
  const { args, preview, status, result } = item;
  const sceneIndex = args?.sceneIndex || preview?.sceneIndex || null;
  const promptText = preview?.prompt || args?.prompt || '';
  const previewImage = result?.imageUrl || preview?.currentImage || null;
  const failed = status === 'error' || (result && result.error);

  const tappable = status === 'done' && sceneIndex && onNavigate;
  const onRowClick = tappable ? () => onNavigate({ tab: 'storyboard', sceneIndex }) : undefined;

  return (
    <div
      onClick={onRowClick}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: '8px 10px',
        cursor: tappable ? 'pointer' : 'default',
        opacity: status === 'skipped' ? 0.55 : 1,
      }}
    >
      <div
        style={{
          width: 56,
          aspectRatio: '16/9',
          flexShrink: 0,
          background: '#F2F2F2',
          borderRadius: 4,
          overflow: 'hidden',
          position: 'relative',
        }}
      >
        {previewImage ? (
          <img
            src={previewImage}
            alt=""
            style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
          />
        ) : null}
        {status === 'running' ? (
          <div
            aria-label="Generating"
            style={{
              position: 'absolute',
              left: 0,
              right: 0,
              bottom: 0,
              height: 3,
              background: 'rgba(0,0,0,0.08)',
              overflow: 'hidden',
            }}
          >
            <div className="cocreate-progress-bounce" />
          </div>
        ) : null}
      </div>

      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 1 }}>
        <div
          style={{
            fontSize: 11,
            color: '#888',
            display: 'flex',
            alignItems: 'center',
            gap: 4,
          }}
        >
          {sceneIndex ? <span>Scene {sceneIndex}</span> : <span>Scene</span>}
        </div>
        <div
          style={{
            fontSize: 12,
            color: '#222',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
          title={promptText}
        >
          {promptText || <span style={{ color: '#AAA' }}>No prompt</span>}
        </div>
      </div>

      <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: 6 }}>
        {status === 'pending' ? (
          <>
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onApprove(); }}
              style={{
                background: '#1F93FF',
                color: '#fff',
                border: 'none',
                borderRadius: 6,
                padding: '4px 10px',
                fontSize: 12,
                fontWeight: 500,
                cursor: 'pointer',
              }}
            >
              Generate
            </button>
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onSkip(); }}
              style={{
                background: 'transparent',
                color: '#666',
                border: '1px solid #DDD',
                borderRadius: 6,
                padding: '4px 10px',
                fontSize: 12,
                cursor: 'pointer',
              }}
            >
              Reject
            </button>
          </>
        ) : status === 'running' ? (
          <span style={{ fontSize: 11, color: '#1F4E8F' }}>Generating…</span>
        ) : status === 'done' ? (
          <span style={{ fontSize: 11, color: '#137333', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
            <SfIcon name="checkmark" size={11} strokeWidth={1.9} />
            Generated
          </span>
        ) : status === 'skipped' ? (
          <span style={{ fontSize: 11, color: '#888' }}>Rejected</span>
        ) : failed ? (
          <span style={{ fontSize: 11, color: '#A33' }} title={result?.error || ''}>Failed</span>
        ) : null}
      </div>
    </div>
  );
}

// Vertical list of ApprovalRow — minimal, Cursor-like. Bottom of the list has
// a divider and a single "Generate All" action when more than one row is
// still pending.
function ApprovalSection({ run, onResolve, onCancel, onNavigate }) {
  if (!run || !run.items || run.items.length === 0) return null;
  const pendingItems = run.items.filter((it) => it.status === 'pending');
  const runningItems = run.items.filter((it) => it.status === 'running');
  const showGenerateAll = pendingItems.length > 1;
  // Anything currently rendering on the server gets a Cancel affordance —
  // user can bail out of an apparently-stuck run without sitting through it.
  const showCancel = runningItems.length > 0 && Boolean(onCancel);
  return (
    <div style={{ width: '100%', display: 'flex', justifyContent: 'center' }}>
      <div
        style={{
          width: '100%',
          maxWidth: MAX_W,
          margin: '8px 20px 18px',
          border: '1px solid #E5E5E5',
          borderRadius: 8,
          background: '#FFF',
          overflow: 'hidden',
        }}
      >
        {run.items.map((it, i) => (
          <div
            key={it.tool_call_id}
            style={{ borderTop: i === 0 ? 'none' : '1px solid #F0F0F0' }}
          >
            <ApprovalRow
              item={it}
              onApprove={() => onResolve([{ toolCallId: it.tool_call_id, action: 'approve' }])}
              onSkip={() => onResolve([{ toolCallId: it.tool_call_id, action: 'skip' }])}
              onNavigate={onNavigate}
            />
          </div>
        ))}
        {showCancel ? (
          <div style={{ borderTop: '1px solid #E5E5E5', padding: 8, display: 'flex', justifyContent: 'flex-end' }}>
            <button
              type="button"
              onClick={onCancel}
              style={{
                background: 'transparent',
                color: '#A33',
                border: '1px solid #F2C7C2',
                borderRadius: 6,
                padding: '5px 14px',
                fontSize: 12,
                fontWeight: 500,
                cursor: 'pointer',
              }}
            >
              Cancel
            </button>
          </div>
        ) : showGenerateAll ? (
          <div style={{ borderTop: '1px solid #E5E5E5', padding: 8, display: 'flex', justifyContent: 'flex-end', gap: 6 }}>
            <button
              type="button"
              onClick={() =>
                onResolve(pendingItems.map((it) => ({ toolCallId: it.tool_call_id, action: 'skip' })))
              }
              style={{
                background: 'transparent',
                color: '#666',
                border: '1px solid #DDD',
                borderRadius: 6,
                padding: '5px 12px',
                fontSize: 12,
                cursor: 'pointer',
              }}
            >
              Reject all
            </button>
            <button
              type="button"
              onClick={() =>
                onResolve(pendingItems.map((it) => ({ toolCallId: it.tool_call_id, action: 'approve' })))
              }
              style={{
                background: '#1F93FF',
                color: '#fff',
                border: 'none',
                borderRadius: 6,
                padding: '5px 14px',
                fontSize: 12,
                fontWeight: 500,
                cursor: 'pointer',
              }}
            >
              Generate All ({pendingItems.length})
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function MessageRow({ msg, isAssistant, streaming, showDivider, liveToolEvents, onToolNavigate }) {
  const senderName = isAssistant
    ? ASSISTANT_NAME
    : msg.sender_name || msg.sender_email || 'You';
  const fakeUser = isAssistant
    ? null
    : {
        name: msg.sender_name,
        email: msg.sender_email,
        profile_picture: msg.sender_profile_picture,
      };
  return (
    <div
      style={{
        width: '100%',
        display: 'flex',
        justifyContent: 'center',
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: MAX_W,
          display: 'flex',
          gap: 12,
          padding: '18px 20px',
          alignItems: 'flex-start',
          borderBottom: showDivider ? '1px solid #EEE' : 'none',
        }}
      >
      <div style={{ flexShrink: 0, marginTop: 2 }}>
        {isAssistant ? <FlowerIcon size={28} spinning={streaming} /> : <UserAvatar user={fakeUser} size={28} />}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: '#222', marginBottom: 2 }}>
          {senderName}
        </div>
        <div
          style={{
            fontSize: 14,
            lineHeight: 1.55,
            color: '#222',
            wordBreak: 'break-word',
          }}
        >
          {isAssistant ? (
            <>
              {renderMarkdown(msg.message_contents)}
              {streaming ? <span className="cocreate-caret" /> : null}
            </>
          ) : (
            <span style={{ whiteSpace: 'pre-wrap' }}>
              {msg.message_contents}
              {streaming ? <span className="cocreate-caret" /> : null}
            </span>
          )}
        </div>
        {(() => {
          // Split attachments into three rows so a tall character card never
          // forces a sibling pill to stretch to match its height. Each row
          // uses align-items: flex-start to keep pills at their natural size.
          const attachments = Array.isArray(msg.attachments) ? msg.attachments : [];
          const refs = [];
          const pills = [];
          const cards = [];
          const images = [];
          for (let i = 0; i < attachments.length; i++) {
            const a = attachments[i];
            if (a && a.kind === 'ref') refs.push({ a, i });
            else if (a && a.kind === 'tool_call') {
              if (CHARACTER_CARD_TOOLS.has(a.name)) cards.push({ a, i });
              else pills.push({ a, i });
            } else {
              const url = typeof a === 'string' ? a : a?.url;
              if (url) images.push({ url, i });
            }
          }
          const rowStyle = {
            display: 'flex',
            gap: 6,
            marginTop: 8,
            flexWrap: 'wrap',
            alignItems: 'flex-start',
          };
          return (
            <>
              {refs.length || images.length ? (
                <div style={rowStyle}>
                  {refs.map(({ a, i }) => {
                    const lbl =
                      a.type === 'frame'
                        ? `Scene ${a.sceneIndex}`
                        : a.label || 'Character';
                    return (
                      <span
                        key={i}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 4,
                          padding: '2px 8px',
                          background: '#F0F7FF',
                          border: '1px solid #C9E1FF',
                          color: '#1F4E8F',
                          borderRadius: 999,
                          fontSize: 11,
                          height: 22,
                          boxSizing: 'border-box',
                        }}
                      >
                        {lbl}
                      </span>
                    );
                  })}
                  {images.map(({ url, i }) => (
                    <img
                      key={i}
                      src={url}
                      alt=""
                      style={{
                        maxWidth: 220,
                        maxHeight: 160,
                        borderRadius: 8,
                        border: '1px solid #EEE',
                      }}
                    />
                  ))}
                </div>
              ) : null}
              {pills.length ? (
                <div style={rowStyle}>
                  {pills.map(({ a, i }) => (
                    <ToolCallPill key={i} entry={a} onNavigate={onToolNavigate} />
                  ))}
                </div>
              ) : null}
              {cards.length ? (
                <div style={rowStyle}>
                  {cards.map(({ a, i }) => {
                    const cid = a.result?.character?.id || null;
                    return (
                      <CharacterToolCard
                        key={i}
                        entry={a}
                        onOpen={
                          cid && onToolNavigate
                            ? () => onToolNavigate({ tab: 'characters', characterId: cid })
                            : null
                        }
                      />
                    );
                  })}
                </div>
              ) : null}
            </>
          );
        })()}
        {Array.isArray(liveToolEvents) && liveToolEvents.length > 0 ? (
          (() => {
            const livePills = [];
            const liveCards = [];
            for (let i = 0; i < liveToolEvents.length; i++) {
              const t = liveToolEvents[i];
              if (CHARACTER_CARD_TOOLS.has(t.name)) liveCards.push({ t, i });
              else livePills.push({ t, i });
            }
            const rowStyle = {
              display: 'flex',
              gap: 6,
              marginTop: 8,
              flexWrap: 'wrap',
              alignItems: 'flex-start',
            };
            return (
              <>
                {livePills.length ? (
                  <div style={rowStyle}>
                    {livePills.map(({ t, i }) => (
                      <ToolCallPill key={i} entry={t} onNavigate={onToolNavigate} />
                    ))}
                  </div>
                ) : null}
                {liveCards.length ? (
                  <div style={rowStyle}>
                    {liveCards.map(({ t, i }) => {
                      const cid = t.result?.character?.id || null;
                      return (
                        <CharacterToolCard
                          key={i}
                          entry={t}
                          onOpen={
                            cid && onToolNavigate
                              ? () =>
                                  onToolNavigate({ tab: 'characters', characterId: cid })
                              : null
                          }
                        />
                      );
                    })}
                  </div>
                ) : null}
              </>
            );
          })()
        ) : null}
      </div>
      </div>
    </div>
  );
}

const MUTATING_TOOLS = new Set([
  'add_scene',
  'delete_scene',
  'edit_scene_prompt',
  'set_scene_model',
  'add_reference_to_scene',
  'set_scene_voiceline',
  'set_scene',
  'set_project_style',
  'create_character',
  'update_character',
  'regenerate_character_portrait',
  'delete_character',
  'delete_empty_scenes',
]);

const ChatView = ({ projectId, onStoryboardChanged, onToolNavigate, refreshKey = 0 }) => {
  const { token } = useAuth();
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [input, setInput] = useState('');
  const [streamingText, setStreamingText] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState(null);
  const [contextRefs, setContextRefs] = useState([]);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerAnchor, setPickerAnchor] = useState(null);
  const [toolEvents, setToolEvents] = useState([]);
  // approvalRun is the in-flight server-paused agent run awaiting per-item
  // approval. `items` are keyed by tool_call_id and progress through:
  //   'pending' → user clicks Approve → 'running' → 'done' (with imageUrl)
  //                                              → 'error'
  //              → user clicks Skip → 'skipped'
  const [approvalRun, setApprovalRun] = useState(null);
  // Voice mode: hands-free chat. Tap mic to enter, tap again to leave.
  // While on, the composer becomes a single record/listening control —
  // recordings POST to /chat/.../voice (Whisper STT → agent → fal TTS).
  const [voiceMode, setVoiceMode] = useState(false);
  const [voiceState, setVoiceState] = useState('idle'); // 'idle' | 'recording' | 'thinking' | 'speaking'
  const [lastTranscript, setLastTranscript] = useState('');
  const [lastTtsUrl, setLastTtsUrl] = useState(null);
  const scrollRef = useRef(null);
  const plusBtnRef = useRef(null);
  const textareaRef = useRef(null);
  const voiceRecorderRef = useRef(null);
  const voiceChunksRef = useRef([]);
  const voiceStreamRef = useRef(null);
  const voiceAudioRef = useRef(null);
  const approvalRunRef = useRef(null);
  const voiceModeRef = useRef(false);
  // Sticky-bottom: only auto-scroll on new content if the user is already
  // pinned to the bottom. If they scroll up to read history, we leave them
  // there until they scroll back down themselves. Same pattern as iMessage,
  // ChatGPT, Cursor, etc.
  const stickToBottomRef = useRef(true);

  // Auto-grow the composer to fit its content, capped at maxHeight (the
  // overflow-y handles anything beyond that with a scrollbar).
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    const next = Math.min(el.scrollHeight, 200);
    el.style.height = `${next}px`;
  }, [input]);

  const scrollToBottom = useCallback(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, []);

  const handleScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    // 40px threshold so a tiny manual scroll doesn't break stickiness, and
    // sub-pixel rounding from zoom/devicePixelRatio doesn't either.
    stickToBottomRef.current = distanceFromBottom < 40;
  }, []);

  useEffect(() => {
    let cancelled = false;
    if (!token || !projectId) return undefined;
    setLoading(true);
    fetch(apiUrl(`/chat/projects/${encodeURIComponent(projectId)}/messages`), {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(async (r) => {
        if (!r.ok) throw new Error(`Failed to load chat (${r.status})`);
        return r.json();
      })
      .then((data) => {
        if (cancelled) return;
        setMessages(Array.isArray(data.messages) ? data.messages : []);
      })
      .catch((e) => {
        if (!cancelled) setError(e.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [projectId, token, refreshKey]);

  useEffect(() => {
    if (stickToBottomRef.current) scrollToBottom();
  }, [messages, streamingText, approvalRun, scrollToBottom]);

  // Realtime: peers' chat messages, the agent's reply, AND every agent_step
  // event (tool_pending, tool_progress, tool_call, paused, done). The agent
  // loop runs server-side independent of any one client's socket — these
  // events are the durable source of truth, so a refreshing tab catches up
  // without needing the original SSE response.
  useEffect(() => {
    if (!projectId || !token) return undefined;
    return subscribeProject(projectId, token, (event) => {
      if (event.kind === 'chat.message_created') {
        const incoming = event.payload?.message;
        if (!incoming?.id) return;
        setMessages((prev) => {
          if (prev.some((m) => m.id === incoming.id)) return prev;
          return [...prev, incoming];
        });
        return;
      }
      if (event.kind === 'chat.agent_step') {
        const p = event.payload || {};
        // The original local SSE may already have applied this step. The
        // setters below all dedupe / are idempotent so duplicate delivery is
        // safe — the realtime path is the fallback for disconnected clients.
        if (p.type === 'tool_pending') {
          setApprovalRun((prev) => {
            const item = {
              tool_call_id: p.tool_call_id,
              args: p.args || {},
              preview: p.preview || {},
              status: 'pending',
              result: null,
            };
            if (!prev) return { runId: p.runId || null, items: [item] };
            if (prev.items.some((it) => it.tool_call_id === item.tool_call_id)) return prev;
            return { ...prev, runId: prev.runId || p.runId || null, items: [...prev.items, item] };
          });
        } else if (p.type === 'tool_progress') {
          setApprovalRun((prev) => {
            if (!prev) return prev;
            return {
              ...prev,
              items: prev.items.map((it) =>
                it.tool_call_id === p.tool_call_id ? { ...it, status: p.status || it.status } : it,
              ),
            };
          });
        } else if (p.type === 'tool_call') {
          setToolEvents((prev) => (prev.some((e) => e.tool_call_id === p.tool_call_id) ? prev : [...prev, p]));
          if (p.name === 'generate_scene' && p.tool_call_id) {
            setApprovalRun((prev) => {
              if (!prev) return prev;
              return {
                ...prev,
                items: prev.items.map((it) =>
                  it.tool_call_id === p.tool_call_id
                    ? {
                        ...it,
                        status: p.status || (p.result?.error ? 'error' : 'done'),
                        result: p.result || null,
                      }
                    : it,
                ),
              };
            });
            if (p.result?.imageUrl && !p.result?.error) onStoryboardChanged?.(p);
          }
        } else if (p.type === 'paused') {
          setApprovalRun((prev) => (prev ? { ...prev, runId: p.runId } : { runId: p.runId, items: [] }));
        } else if (p.type === 'done') {
          // The 'done' agent_step carries the persisted assistant message.
          // Clear the approval UI; the chat.message_created event delivers
          // the message itself.
          setApprovalRun(null);
          setStreamingText('');
        } else if (p.type === 'cancelled') {
          setApprovalRun((prev) => (prev && prev.runId === p.runId ? null : prev));
          setSending(false);
          setStreamingText('');
        }
      }
    });
  }, [projectId, token, onStoryboardChanged]);

  // After mount (and project/user changes), check for an in-flight pending
  // run and rehydrate the approval list so a refresh during a generation
  // round-trip doesn't lose the cards. Subsequent updates flow via realtime.
  useEffect(() => {
    if (!projectId || !token) return;
    let cancelled = false;
    fetch(apiUrl(`/chat/projects/${encodeURIComponent(projectId)}/active-run`), {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => (r.ok ? r.json() : { run: null }))
      .then((data) => {
        if (cancelled || !data?.run) return;
        setApprovalRun({
          runId: data.run.id,
          items: (data.run.items || []).map((it) => ({
            tool_call_id: it.tool_call_id,
            args: it.args || {},
            preview: it.preview || {},
            status: it.status || 'pending',
            result: it.result || null,
          })),
        });
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [projectId, token]);

  const addRef = useCallback((ref) => {
    setContextRefs((prev) => {
      // Dedupe by stable key.
      const key = (r) => `${r.type}:${r.id || r.sceneIndex}`;
      if (prev.some((r) => key(r) === key(ref))) return prev;
      return [...prev, ref];
    });
  }, []);

  const removeRef = useCallback((ref) => {
    const key = (r) => `${r.type}:${r.id || r.sceneIndex}`;
    setContextRefs((prev) => prev.filter((r) => key(r) !== key(ref)));
  }, []);

  const handlePaste = useCallback(
    (e) => {
      const text = e.clipboardData?.getData('text/plain') || '';
      const m = text.match(/^cocreate:\/\/(frame|character)\/(.+)$/);
      if (!m) return;
      e.preventDefault();
      if (m[1] === 'frame') {
        const idx = Number(m[2]);
        if (Number.isInteger(idx) && idx >= 1) {
          addRef({ type: 'frame', sceneIndex: idx, label: `Scene ${idx}` });
        }
      } else if (m[1] === 'character') {
        addRef({ type: 'character', id: m[2], label: 'Character' });
      }
    },
    [addRef],
  );

  // Drains the chat SSE stream, dispatching each event to the right state
  // setter. Used by both initial send and approval resume — they speak the
  // same protocol. Returns when the server closes the stream (paused or done).
  const consumeChatStream = useCallback(
    async (response) => {
      if (!response.ok || !response.body) {
        const body = await response.text().catch(() => '');
        // Pre-flight failure (4xx/5xx). Worth surfacing — the request was
        // rejected before any work happened.
        const err = new Error(`Stream failed (${response.status}) ${body.slice(0, 120)}`);
        err.preflight = true;
        throw err;
      }
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let liveText = '';
      while (true) {
        let chunk;
        try {
          chunk = await reader.read();
        } catch (readErr) {
          // Network drop / proxy timeout / browser abort mid-stream. The
          // agent loop runs server-side and pushes events through realtime
          // (subscribeProject), so the run isn't actually broken. Swallow
          // and let the realtime listener deliver the rest.
          const err = new Error(readErr?.message || 'Stream interrupted');
          err.midStream = true;
          throw err;
        }
        const { value, done } = chunk;
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const events = buffer.split('\n\n');
        buffer = events.pop() || '';
        for (const evt of events) {
          const lines = evt.split('\n');
          let event = 'message';
          let data = '';
          for (const ln of lines) {
            if (ln.startsWith('event:')) event = ln.slice(6).trim();
            else if (ln.startsWith('data:')) data += ln.slice(5).trim();
          }
          if (!data) continue;
          let parsed;
          try {
            parsed = JSON.parse(data);
          } catch {
            continue;
          }
          if (event === 'user_message') {
            // Dedupe against the realtime chat.message_created path — both
            // deliver the same row and arrive in unspecified order.
            setMessages((prev) =>
              parsed?.id && prev.some((m) => m.id === parsed.id)
                ? prev
                : [...prev, parsed],
            );
          } else if (event === 'delta') {
            liveText += parsed.text || '';
            setStreamingText(liveText);
          } else if (event === 'done') {
            setMessages((prev) =>
              parsed?.id && prev.some((m) => m.id === parsed.id)
                ? prev
                : [...prev, parsed],
            );
            setStreamingText('');
            setApprovalRun(null);
          } else if (event === 'tool_call') {
            setToolEvents((prev) => [...prev, parsed]);
            // generate_scene results update the matching approval card.
            if (parsed?.name === 'generate_scene' && parsed.tool_call_id) {
              setApprovalRun((prev) => {
                if (!prev) return prev;
                return {
                  ...prev,
                  items: prev.items.map((it) =>
                    it.tool_call_id === parsed.tool_call_id
                      ? {
                          ...it,
                          status: parsed.status || (parsed.result?.error ? 'error' : 'done'),
                          result: parsed.result || null,
                        }
                      : it,
                  ),
                };
              });
              if (parsed.result && parsed.result.imageUrl && !parsed.result.error) {
                onStoryboardChanged?.(parsed);
              }
            } else if (
              parsed?.name &&
              MUTATING_TOOLS.has(parsed.name) &&
              !(parsed.result && parsed.result.error)
            ) {
              onStoryboardChanged?.(parsed);
            }
          } else if (event === 'tool_pending') {
            setApprovalRun((prev) => {
              const item = {
                tool_call_id: parsed.tool_call_id,
                args: parsed.args || {},
                preview: parsed.preview || {},
                status: 'pending',
                result: null,
              };
              if (!prev) return { runId: null, items: [item] };
              // Avoid dupes if the server re-emits.
              if (prev.items.some((it) => it.tool_call_id === item.tool_call_id)) return prev;
              return { ...prev, items: [...prev.items, item] };
            });
          } else if (event === 'tool_progress') {
            setApprovalRun((prev) => {
              if (!prev) return prev;
              return {
                ...prev,
                items: prev.items.map((it) =>
                  it.tool_call_id === parsed.tool_call_id
                    ? { ...it, status: parsed.status || it.status }
                    : it,
                ),
              };
            });
          } else if (event === 'paused') {
            setApprovalRun((prev) => (prev ? { ...prev, runId: parsed.runId } : { runId: parsed.runId, items: [] }));
          } else if (event === 'cancelled') {
            setApprovalRun((prev) => (prev && prev.runId === parsed.runId ? null : prev));
          } else if (event === 'transcript') {
            setLastTranscript(parsed.text || '');
          } else if (event === 'response_audio') {
            setLastTtsUrl(parsed.url || null);
          } else if (event === 'error') {
            setError(parsed.message || 'Stream error');
          }
        }
      }
    },
    [onStoryboardChanged],
  );

  // Keep refs synced so the playback-end handler can decide whether to
  // auto-rearm without rebuilding the whole audio element on every render.
  useEffect(() => {
    voiceModeRef.current = voiceMode;
  }, [voiceMode]);
  useEffect(() => {
    approvalRunRef.current = approvalRun;
  }, [approvalRun]);

  const stopVoiceTracks = useCallback(() => {
    const stream = voiceStreamRef.current;
    if (stream) {
      stream.getTracks().forEach((t) => t.stop());
      voiceStreamRef.current = null;
    }
  }, []);

  const sendVoiceBlob = useCallback(
    async (blob) => {
      if (!blob || blob.size < 200) {
        // Almost-empty recording — just rearm if we're still in voice mode.
        setVoiceState('idle');
        return;
      }
      setVoiceState('thinking');
      setSending(true);
      setError(null);
      setStreamingText('');
      try {
        const fd = new FormData();
        fd.append('audio', blob, 'voice.webm');
        if (contextRefs.length) {
          fd.append('contextRefs', JSON.stringify(contextRefs));
        }
        const res = await fetch(
          apiUrl(`/chat/projects/${encodeURIComponent(projectId)}/voice`),
          {
            method: 'POST',
            headers: { Authorization: `Bearer ${token}` },
            body: fd,
          },
        );
        if (!res.ok) {
          const body = await res.text().catch(() => '');
          throw new Error(`Voice send failed (${res.status}) ${body.slice(0, 120)}`);
        }
        await consumeChatStream(res);
        setContextRefs([]);
      } catch (e) {
        setError(e.message);
        setVoiceState('idle');
      } finally {
        setSending(false);
        setStreamingText('');
      }
    },
    [contextRefs, projectId, token, consumeChatStream],
  );

  // Try to detect approval-by-voice when there are pending generate_scene
  // approvals. Fires after each transcript arrives, before the agent replies.
  // Returns true if we resolved approvals (so the caller can short-circuit
  // any further auto-rearm wiring).
  const maybeResolveByVoice = useCallback(
    (transcriptText) => {
      const run = approvalRunRef.current;
      if (!run || !run.runId) return false;
      const t = String(transcriptText || '').toLowerCase();
      if (!t.trim()) return false;
      const approveAll = /\b(approve(?:\s+all)?|yes|yep|yeah|do it|go ahead|sure|sounds good|generate(?:\s+all)?)\b/.test(t);
      const skipAll = /\b(skip(?:\s+all)?|no|nope|don'?t|cancel|stop|reject)\b/.test(t);
      const pending = run.items.filter((it) => it.status === 'pending');
      if (pending.length === 0) return false;
      if (approveAll && !skipAll) {
        resolveApprovals(
          pending.map((it) => ({ toolCallId: it.tool_call_id, action: 'approve' })),
        );
        return true;
      }
      if (skipAll && !approveAll) {
        resolveApprovals(
          pending.map((it) => ({ toolCallId: it.tool_call_id, action: 'skip' })),
        );
        return true;
      }
      return false;
    },
    // resolveApprovals is declared later; ESLint can't see it but the closure
    // will resolve at call-time.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  const startVoiceRecording = useCallback(async () => {
    if (voiceRecorderRef.current) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      voiceStreamRef.current = stream;
      const mime = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : MediaRecorder.isTypeSupported('audio/webm')
          ? 'audio/webm'
          : '';
      const rec = mime ? new MediaRecorder(stream, { mimeType: mime }) : new MediaRecorder(stream);
      voiceChunksRef.current = [];
      rec.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) voiceChunksRef.current.push(e.data);
      };
      rec.onstop = () => {
        const blob = new Blob(voiceChunksRef.current, { type: rec.mimeType || 'audio/webm' });
        voiceChunksRef.current = [];
        voiceRecorderRef.current = null;
        stopVoiceTracks();
        sendVoiceBlob(blob);
      };
      rec.start();
      voiceRecorderRef.current = rec;
      setVoiceState('recording');
    } catch (e) {
      console.error(e);
      setError('Microphone access denied');
      setVoiceMode(false);
      setVoiceState('idle');
    }
  }, [stopVoiceTracks, sendVoiceBlob]);

  const stopVoiceRecording = useCallback(() => {
    const rec = voiceRecorderRef.current;
    if (rec && rec.state !== 'inactive') {
      rec.stop();
    }
  }, []);

  const exitVoiceMode = useCallback(() => {
    setVoiceMode(false);
    setVoiceState('idle');
    const rec = voiceRecorderRef.current;
    if (rec && rec.state !== 'inactive') {
      try { rec.stop(); } catch { /* ignore */ }
    }
    voiceRecorderRef.current = null;
    stopVoiceTracks();
    if (voiceAudioRef.current) {
      try { voiceAudioRef.current.pause(); } catch { /* ignore */ }
      voiceAudioRef.current = null;
    }
  }, [stopVoiceTracks]);

  // Run voice intents through the approval check before letting the
  // assistant continue. The transcript event fires before the agent has
  // begun replying, so we can interrupt and resolve in-flight approvals.
  useEffect(() => {
    if (!lastTranscript) return;
    maybeResolveByVoice(lastTranscript);
  }, [lastTranscript, maybeResolveByVoice]);

  // When TTS audio arrives, play it; if voice mode is on, auto-rearm the
  // mic when playback finishes so the user can keep talking hands-free.
  useEffect(() => {
    if (!lastTtsUrl) return;
    if (voiceAudioRef.current) {
      try { voiceAudioRef.current.pause(); } catch { /* ignore */ }
    }
    const audio = new Audio(lastTtsUrl);
    voiceAudioRef.current = audio;
    setVoiceState('speaking');
    audio.onended = () => {
      voiceAudioRef.current = null;
      if (voiceModeRef.current) {
        // Re-arm only if we're not waiting on user approvals.
        const pending = (approvalRunRef.current?.items || []).some((it) => it.status === 'pending');
        if (!pending) {
          startVoiceRecording();
        } else {
          setVoiceState('idle');
        }
      } else {
        setVoiceState('idle');
      }
    };
    audio.onerror = () => {
      voiceAudioRef.current = null;
      setVoiceState('idle');
    };
    audio.play().catch(() => {
      setVoiceState('idle');
    });
  }, [lastTtsUrl, startVoiceRecording]);

  const enterVoiceMode = useCallback(() => {
    setVoiceMode(true);
    setLastTranscript('');
    setLastTtsUrl(null);
    startVoiceRecording();
  }, [startVoiceRecording]);

  // Cleanup mic on unmount.
  useEffect(() => () => exitVoiceMode(), [exitVoiceMode]);

  const sendMessage = useCallback(async () => {
    const text = input.trim();
    if ((!text && contextRefs.length === 0) || sending) return;
    setSending(true);
    setError(null);
    setInput('');
    setStreamingText('');
    setToolEvents([]);
    setApprovalRun(null);
    // User sending implies they want to see the response — re-pin to bottom.
    stickToBottomRef.current = true;
    const refsForSend = contextRefs;
    setContextRefs([]);

    try {
      const res = await fetch(
        apiUrl(`/chat/projects/${encodeURIComponent(projectId)}/messages`),
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
            Accept: 'text/event-stream',
          },
          body: JSON.stringify({ message: text, contextRefs: refsForSend }),
        },
      );
      await consumeChatStream(res);
    } catch (e) {
      if (e?.midStream) {
        console.warn('[chat] send stream interrupted, falling back to realtime:', e.message);
      } else {
        setError(e.message);
      }
    } finally {
      setSending(false);
      setStreamingText('');
    }
  }, [input, projectId, sending, token, contextRefs, consumeChatStream]);

  // Approve or skip a list of pending generate_scene calls. `decisions` is an
  // array of { toolCallId, action: 'approve'|'skip', overrides? }. The server
  // streams progress + completion events back through the same protocol.
  const resolveApprovals = useCallback(
    async (decisions) => {
      if (!approvalRun?.runId || decisions.length === 0) return;
      // Optimistically mark approved items as 'running' so the UI snaps to the
      // loading state immediately.
      setApprovalRun((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          items: prev.items.map((it) => {
            const d = decisions.find((x) => x.toolCallId === it.tool_call_id);
            if (!d) return it;
            return { ...it, status: d.action === 'approve' ? 'running' : 'skipped' };
          }),
        };
      });
      setSending(true);
      setError(null);
      try {
        const res = await fetch(
          apiUrl(
            `/chat/projects/${encodeURIComponent(projectId)}/messages/runs/${encodeURIComponent(
              approvalRun.runId,
            )}/resolve`,
          ),
          {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${token}`,
              'Content-Type': 'application/json',
              Accept: 'text/event-stream',
            },
            body: JSON.stringify({ decisions }),
          },
        );
        await consumeChatStream(res);
      } catch (e) {
        // Mid-stream interruptions (proxy timeouts, network drops) are not
        // user-facing errors — the work continues server-side and reaches us
        // via realtime. Only surface true failures (preflight 4xx/5xx).
        if (e?.midStream) {
          console.warn('[chat] approval stream interrupted, falling back to realtime:', e.message);
        } else {
          setError(e.message);
        }
      } finally {
        setSending(false);
        setStreamingText('');
      }
    },
    [approvalRun, projectId, token, consumeChatStream],
  );

  // Bail out of an in-flight approval run. Server deletes the row + emits
  // a cancelled event so all clients clear their cards. Already-running fal
  // jobs may still complete on the server (we can't recall those), but no
  // further agent continuation runs against this run id.
  const cancelApprovals = useCallback(async () => {
    if (!approvalRun?.runId) return;
    const runId = approvalRun.runId;
    setApprovalRun(null);
    setSending(false);
    setStreamingText('');
    try {
      await fetch(
        apiUrl(
          `/chat/projects/${encodeURIComponent(projectId)}/messages/runs/${encodeURIComponent(
            runId,
          )}/cancel`,
        ),
        {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
        },
      );
    } catch (e) {
      console.warn('[chat] cancel request failed:', e.message);
    }
  }, [approvalRun, projectId, token]);

  if (loading && messages.length === 0) {
    return <ChatViewSkeleton />;
  }

  return (
    <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', background: '#fff', fontFamily: APP_FONT_STACK }}>
      <style>{`
        @keyframes cocreate-flower-spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        @keyframes cocreate-character-card-in {
          0% { opacity: 0; transform: translateY(6px) scale(0.96); }
          60% { opacity: 1; transform: translateY(0) scale(1.015); }
          100% { opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes cocreate-character-portrait-fade {
          from { opacity: 0; filter: blur(6px); }
          to { opacity: 1; filter: blur(0); }
        }
        @keyframes cocreate-character-shimmer {
          0% { background-position: 100% 0; }
          100% { background-position: -100% 0; }
        }
        .cocreate-caret {
          display: inline-block;
          width: 7px;
          height: 1em;
          margin-left: 2px;
          background: #1F93FF;
          vertical-align: text-bottom;
          animation: cocreate-caret-blink 1s step-end infinite;
        }
        @keyframes cocreate-caret-blink {
          50% { opacity: 0; }
        }
        @keyframes cocreate-mic-pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.85; transform: scale(0.97); }
        }
        .cocreate-approval-spin {
          display: inline-flex;
          animation: cocreate-flower-spin 1.6s linear infinite;
          color: #1F93FF;
        }
        /* Indeterminate progress bar — a 30% blue chip slides edge-to-edge
           in its track. macOS-style; conveys "working" without spinning. */
        .cocreate-progress-bounce {
          width: 30%;
          height: 100%;
          background: #1F93FF;
          border-radius: 2px;
          animation: cocreate-progress-bounce-anim 1.2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
          will-change: transform;
        }
        @keyframes cocreate-progress-bounce-anim {
          0%   { transform: translateX(-100%); }
          50%  { transform: translateX(233%); }
          100% { transform: translateX(-100%); }
        }
      `}</style>
      <div ref={scrollRef} onScroll={handleScroll} style={{ flex: 1, overflowY: 'auto', minHeight: 0 }}>
        <div style={{ width: '100%', display: 'flex', justifyContent: 'center' }}>
          <div style={{ width: '100%', maxWidth: MAX_W, borderBottom: '1px solid #EEE' }} />
        </div>
        {messages.length === 0 && !streamingText && !loading ? (
          <div style={{ padding: 32, color: '#888', fontSize: 14, textAlign: 'center' }}>
            Start chatting with CoCreate about your story.
          </div>
        ) : null}
        {messages.map((m, i) => {
          const isLast = i === messages.length - 1 && !streamingText;
          return (
            <MessageRow
              key={m.id}
              msg={m}
              isAssistant={m.role === 'assistant'}
              streaming={false}
              showDivider={!isLast}
              onToolNavigate={onToolNavigate}
            />
          );
        })}
        {streamingText || (sending && toolEvents.length > 0) ? (
          <MessageRow
            msg={{
              id: 'streaming',
              role: 'assistant',
              message_contents: streamingText,
              attachments: [],
            }}
            isAssistant
            streaming={Boolean(streamingText) || sending}
            showDivider={false}
            liveToolEvents={toolEvents}
            onToolNavigate={onToolNavigate}
          />
        ) : null}
        <ApprovalSection
          run={approvalRun}
          onResolve={resolveApprovals}
          onCancel={cancelApprovals}
          onNavigate={onToolNavigate}
        />
        {error ? (
          <div style={{ padding: '8px 16px', color: '#C0392B', fontSize: 12 }}>{error}</div>
        ) : null}
      </div>
      <div
        style={{
          padding: '12px 20px 16px',
          background: '#fff',
          display: 'flex',
          justifyContent: 'center',
        }}
      >
        <div
          style={{
            width: '100%',
            maxWidth: MAX_W,
            display: 'flex',
            flexDirection: 'column',
            gap: 6,
            background: '#fff',
            border: '1px solid #D9D9D9',
            borderRadius: 12,
            padding: 8,
            boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
          }}
        >
          {contextRefs.length > 0 ? (
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', padding: '2px 4px 0' }}>
              {contextRefs.map((r) => (
                <ContextChip key={`${r.type}:${r.id || r.sceneIndex}`} chip={r} onRemove={() => removeRef(r)} />
              ))}
            </div>
          ) : null}
          {voiceMode ? (
            <VoiceModePanel
              state={voiceState}
              transcript={lastTranscript}
              hasPendingApprovals={Boolean(
                approvalRun && approvalRun.items.some((it) => it.status === 'pending'),
              )}
              onStop={stopVoiceRecording}
              onStart={startVoiceRecording}
              onExit={exitVoiceMode}
            />
          ) : null}
          <div style={{ display: voiceMode ? 'none' : 'flex', alignItems: 'flex-end', gap: 6 }}>
          <button
            ref={plusBtnRef}
            type="button"
            onClick={() => {
              const rect = plusBtnRef.current?.getBoundingClientRect();
              setPickerAnchor(rect ? { left: rect.left, top: rect.top } : null);
              setPickerOpen((o) => !o);
            }}
            title="Add context"
            style={{
              width: 30,
              height: 30,
              borderRadius: 8,
              border: '1px solid #E5E5E5',
              background: '#fff',
              color: '#666',
              cursor: 'pointer',
              flexShrink: 0,
              padding: 0,
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 14 14"
              aria-hidden="true"
              style={{ display: 'block' }}
            >
              <path
                d="M7 1.5v11M1.5 7h11"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
              />
            </svg>
          </button>
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onPaste={handlePaste}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                sendMessage();
              }
            }}
            rows={1}
            placeholder="Message CoCreate…"
            disabled={sending}
            style={{
              flex: 1,
              border: 'none',
              outline: 'none',
              resize: 'none',
              fontFamily: 'inherit',
              fontSize: 14,
              padding: 6,
              minHeight: 24,
              maxHeight: 200,
              overflowY: 'auto',
              lineHeight: 1.45,
              background: 'transparent',
            }}
          />
          <button
            type="button"
            onClick={enterVoiceMode}
            disabled={sending}
            title="Voice mode"
            style={{
              width: 30,
              height: 30,
              borderRadius: 8,
              border: '1px solid #E5E5E5',
              background: '#fff',
              color: '#666',
              cursor: sending ? 'default' : 'pointer',
              flexShrink: 0,
              padding: 0,
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <MicGlyph size={14} />
          </button>
          <button
            type="button"
            onClick={sendMessage}
            disabled={sending || (!input.trim() && contextRefs.length === 0)}
            style={{
              height: 30,
              background: (input.trim() || contextRefs.length) && !sending ? '#1F93FF' : '#BFD7F2',
              color: '#fff',
              border: 'none',
              borderRadius: 8,
              padding: '0 14px',
              fontFamily: 'inherit',
              fontSize: 13,
              lineHeight: 1,
              display: 'inline-flex',
              alignItems: 'center',
              cursor: (input.trim() || contextRefs.length) && !sending ? 'pointer' : 'default',
            }}
          >
            {sending ? 'Sending…' : 'Send'}
          </button>
          </div>
        </div>
      </div>
      {pickerOpen ? (
        <AttachPicker
          projectId={projectId}
          anchorRect={pickerAnchor}
          onClose={() => setPickerOpen(false)}
          onPick={(ref) => {
            addRef(ref);
            setPickerOpen(false);
          }}
        />
      ) : null}
    </div>
  );
};

const MicGlyph = ({ size = 14 }) => (
  <svg width={size} height={size} viewBox="0 0 14 14" aria-hidden="true" style={{ display: 'block' }}>
    <path
      d="M7 1.5a2 2 0 0 0-2 2v3.5a2 2 0 0 0 4 0V3.5a2 2 0 0 0-2-2zM3.5 7v.25a3.5 3.5 0 0 0 7 0V7M7 11v1.5"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.4"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

const VoiceModePanel = ({ state, transcript, hasPendingApprovals, onStop, onStart, onExit }) => {
  const label = (() => {
    if (hasPendingApprovals) return 'Say “approve” or “skip”…';
    if (state === 'recording') return 'Listening…';
    if (state === 'thinking') return 'Thinking…';
    if (state === 'speaking') return 'Speaking…';
    return 'Tap mic to talk';
  })();

  const dotColor = state === 'recording' ? '#E0457B' : state === 'thinking' ? '#9C8BFF' : state === 'speaking' ? '#1F93FF' : '#999';

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '8px 4px',
      }}
    >
      <button
        type="button"
        onClick={state === 'recording' ? onStop : onStart}
        disabled={state === 'thinking' || state === 'speaking'}
        title={state === 'recording' ? 'Stop' : 'Start'}
        style={{
          width: 40,
          height: 40,
          borderRadius: '50%',
          border: 'none',
          background: state === 'recording' ? '#E0457B' : '#1F93FF',
          color: '#fff',
          cursor: state === 'thinking' || state === 'speaking' ? 'default' : 'pointer',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 0,
          flexShrink: 0,
          opacity: state === 'thinking' || state === 'speaking' ? 0.6 : 1,
          boxShadow: state === 'recording' ? '0 0 0 6px rgba(224,69,123,0.18)' : 'none',
          transition: 'box-shadow 160ms ease, background-color 160ms ease',
          animation: state === 'recording' ? 'cocreate-mic-pulse 1.4s ease-in-out infinite' : 'none',
        }}
      >
        <MicGlyph size={16} />
      </button>
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#666' }}>
          <span
            style={{
              width: 6,
              height: 6,
              borderRadius: '50%',
              background: dotColor,
              animation: state === 'thinking' ? 'cocreate-mic-pulse 1.2s ease-in-out infinite' : 'none',
            }}
          />
          {label}
        </div>
        {transcript ? (
          <div
            style={{
              fontSize: 13,
              color: '#222',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            “{transcript}”
          </div>
        ) : null}
      </div>
      <button
        type="button"
        onClick={onExit}
        title="Exit voice mode"
        style={{
          background: 'transparent',
          border: '1px solid #E5E5E5',
          borderRadius: 8,
          padding: '6px 10px',
          fontFamily: 'inherit',
          fontSize: 12,
          color: '#666',
          cursor: 'pointer',
        }}
      >
        Done
      </button>
    </div>
  );
};

const ContextChip = ({ chip, onRemove }) => {
  const copy = () => {
    const url =
      chip.type === 'frame'
        ? `cocreate://frame/${chip.sceneIndex}`
        : `cocreate://character/${chip.id}`;
    navigator.clipboard?.writeText(url).catch(() => {});
  };
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4,
        padding: '2px 4px 2px 4px',
        background: '#F0F7FF',
        border: '1px solid #C9E1FF',
        color: '#1F4E8F',
        borderRadius: 6,
        fontSize: 12,
        fontFamily: 'inherit',
      }}
    >
      {chip.thumbnail ? (
        <img
          src={chip.thumbnail}
          alt=""
          style={{ width: 16, height: 16, borderRadius: 3, objectFit: 'cover' }}
        />
      ) : null}
      <span
        onClick={copy}
        title="Click to copy reference"
        style={{ cursor: 'pointer', maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
      >
        {chip.label || (chip.type === 'frame' ? `Scene ${chip.sceneIndex}` : 'Character')}
      </span>
      <button
        type="button"
        onClick={onRemove}
        style={{
          border: 'none',
          background: 'transparent',
          color: '#1F4E8F',
          cursor: 'pointer',
          padding: 0,
          fontSize: 12,
          lineHeight: 1,
        }}
      >
        ✕
      </button>
    </span>
  );
};

export default ChatView;
