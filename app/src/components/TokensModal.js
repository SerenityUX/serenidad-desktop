import React, { useEffect, useState, useCallback } from 'react';
import { apiUrl } from '../config';
import { useAuth } from '../context/AuthContext';
import platform from '../platform';

const overlay = {
  position: 'fixed',
  inset: 0,
  zIndex: 10000,
  background: 'rgba(0, 0, 0, 0.45)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  WebkitAppRegion: 'no-drag',
};

const sheet = {
  width: 520,
  maxWidth: 'calc(100vw - 32px)',
  maxHeight: 'calc(100vh - 64px)',
  background: '#fff',
  borderRadius: 12,
  boxShadow: '0 16px 48px rgba(0,0,0,0.18)',
  display: 'flex',
  flexDirection: 'column',
  overflow: 'hidden',
};

const headerStyle = {
  padding: '16px 20px',
  borderBottom: '1px solid #EEE',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 12,
};

const sectionTitle = {
  fontSize: 12,
  fontWeight: 600,
  color: '#6B7280',
  textTransform: 'uppercase',
  letterSpacing: 0.4,
  margin: '20px 20px 8px',
};

const closeBtn = {
  border: 'none',
  background: 'transparent',
  fontSize: 18,
  lineHeight: 1,
  cursor: 'pointer',
  color: '#6B7280',
  padding: 4,
};

const isVideoUrl = (url) =>
  /\.(mp4|webm|mov|m4v)(\?|#|$)/i.test(String(url || ''));

const isImageUrl = (url) =>
  /\.(png|jpe?g|webp|gif|avif)(\?|#|$)/i.test(String(url || ''));

const filenameFromUrl = (url, fallback = 'asset') => {
  try {
    const u = new URL(url);
    const last = u.pathname.split('/').filter(Boolean).pop();
    return last || fallback;
  } catch {
    return fallback;
  }
};

const downloadAsset = async (url) => {
  if (!url) return;
  const filename = filenameFromUrl(url);
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const blob = await res.blob();
    const objectUrl = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = objectUrl;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
  } catch (e) {
    console.warn('blob download failed, opening externally', e);
    try {
      platform.openExternal(url);
    } catch {
      window.open(url, '_blank');
    }
  }
};

const formatDate = (iso) => {
  try {
    const d = new Date(iso);
    return d.toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  } catch {
    return '';
  }
};

const AssetPreview = ({ url, label }) => {
  if (!url) return null;
  const video = isVideoUrl(url);
  const image = !video && isImageUrl(url);
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 6,
        minWidth: 0,
      }}
    >
      <div
        style={{
          width: '100%',
          aspectRatio: '16 / 9',
          background: '#F3F4F6',
          borderRadius: 8,
          overflow: 'hidden',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {video ? (
          <video
            src={url}
            controls
            playsInline
            style={{ width: '100%', height: '100%', objectFit: 'cover', background: '#000' }}
          />
        ) : image ? (
          <img
            src={url}
            alt={label || ''}
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
          />
        ) : (
          <div style={{ fontSize: 12, color: '#6B7280', padding: 8, textAlign: 'center' }}>
            Asset
          </div>
        )}
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
        {label ? (
          <div
            style={{
              fontSize: 11,
              color: '#6B7280',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              flex: 1,
              minWidth: 0,
            }}
          >
            {label}
          </div>
        ) : <span />}
        <button
          type="button"
          onClick={() => downloadAsset(url)}
          style={{
            border: '1px solid #E2E2E2',
            background: '#fff',
            color: '#374151',
            borderRadius: 6,
            padding: '4px 10px',
            fontSize: 11,
            fontWeight: 500,
            cursor: 'pointer',
            flexShrink: 0,
          }}
        >
          Download
        </button>
      </div>
    </div>
  );
};

const ActivityRow = ({ tx }) => {
  const [open, setOpen] = useState(false);
  const isCredit = tx.delta > 0;
  const frame = tx.frame || null;
  const hasResult = !!frame?.result;
  const hasRefs = Array.isArray(frame?.reference_urls) && frame.reference_urls.length > 0;
  const hasPrompt = !!(frame?.prompt && frame.prompt.trim());
  const expandable = !!frame && (hasResult || hasRefs || hasPrompt);

  return (
    <div style={{ borderBottom: '1px solid #F3F4F6' }}>
      <button
        type="button"
        onClick={() => expandable && setOpen((v) => !v)}
        style={{
          all: 'unset',
          display: 'flex',
          width: '100%',
          boxSizing: 'border-box',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          gap: 12,
          padding: '10px 0',
          cursor: expandable ? 'pointer' : 'default',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, minWidth: 0, flex: 1 }}>
          <span
            aria-hidden
            style={{
              width: 14,
              display: 'inline-flex',
              justifyContent: 'center',
              color: '#9CA3AF',
              fontSize: 10,
              marginTop: 3,
              transform: open ? 'rotate(90deg)' : 'rotate(0deg)',
              transition: 'transform 140ms ease',
              opacity: expandable ? 1 : 0,
            }}
          >
            ▶
          </span>
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{ fontSize: 13, color: '#111', fontWeight: 500 }}>
              {tx.name || (isCredit ? 'Credit' : 'Charge')}
            </div>
            {tx.notes ? (
              <div
                style={{
                  fontSize: 12,
                  color: '#6B7280',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {tx.notes}
              </div>
            ) : null}
            <div style={{ fontSize: 11, color: '#9CA3AF', marginTop: 2 }}>
              {formatDate(tx.created_at)}
            </div>
          </div>
        </div>
        <div
          style={{
            fontSize: 13,
            fontWeight: 600,
            color: isCredit ? '#059669' : '#111',
            whiteSpace: 'nowrap',
          }}
        >
          {isCredit ? '+' : ''}
          {tx.delta.toLocaleString()}
        </div>
      </button>
      {expandable && open ? (
        <div style={{ padding: '4px 22px 14px', display: 'flex', flexDirection: 'column', gap: 10 }}>
          {hasPrompt ? (
            <div>
              <div
                style={{
                  fontSize: 11,
                  fontWeight: 600,
                  color: '#6B7280',
                  textTransform: 'uppercase',
                  letterSpacing: 0.4,
                  marginBottom: 4,
                }}
              >
                Prompt
              </div>
              <div style={{ fontSize: 12, color: '#374151', whiteSpace: 'pre-wrap' }}>
                {frame.prompt}
              </div>
            </div>
          ) : null}
          {hasResult ? (
            <div>
              <div
                style={{
                  fontSize: 11,
                  fontWeight: 600,
                  color: '#6B7280',
                  textTransform: 'uppercase',
                  letterSpacing: 0.4,
                  marginBottom: 4,
                }}
              >
                Result
              </div>
              <AssetPreview url={frame.result} label={frame.model || ''} />
            </div>
          ) : null}
          {hasRefs ? (
            <div>
              <div
                style={{
                  fontSize: 11,
                  fontWeight: 600,
                  color: '#6B7280',
                  textTransform: 'uppercase',
                  letterSpacing: 0.4,
                  marginBottom: 4,
                }}
              >
                References ({frame.reference_urls.length})
              </div>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))',
                  gap: 8,
                }}
              >
                {frame.reference_urls.map((u, i) => (
                  <AssetPreview key={`${u}-${i}`} url={u} />
                ))}
              </div>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
};

const TokensModal = ({ open, onClose }) => {
  const { token, user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [balance, setBalance] = useState(user?.tokens ?? 0);
  const [transactions, setTransactions] = useState([]);
  const [subscriptions, setSubscriptions] = useState([]);
  const [oneTime, setOneTime] = useState(null);
  const [billingMode, setBillingMode] = useState('subscription');
  const [activityOpen, setActivityOpen] = useState(false);
  const [oneTimeDollars, setOneTimeDollars] = useState(10);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError('');
    try {
      const [txRes, pkgRes] = await Promise.all([
        fetch(apiUrl('/auth/transactions'), {
          headers: { Authorization: `Bearer ${token}` },
        }),
        fetch(apiUrl('/auth/token-packages'), {
          headers: { Authorization: `Bearer ${token}` },
        }),
      ]);
      if (!txRes.ok) throw new Error(`HTTP ${txRes.status}`);
      const txBody = await txRes.json();
      setBalance(txBody.tokens ?? 0);
      setTransactions(Array.isArray(txBody.transactions) ? txBody.transactions : []);
      if (pkgRes.ok) {
        const pkgBody = await pkgRes.json();
        setSubscriptions(Array.isArray(pkgBody.subscriptions) ? pkgBody.subscriptions : []);
        setOneTime(pkgBody.oneTime || null);
      } else {
        setSubscriptions([]);
        setOneTime(null);
      }
    } catch (e) {
      setError(e.message || 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    if (open) load();
  }, [open, load]);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape') onClose?.();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  const openPaymentLink = useCallback(
    (linkUrl, extraParams) => {
      if (!linkUrl) return;
      const params = new URLSearchParams();
      if (user?.id) params.set('client_reference_id', String(user.id));
      if (extraParams) {
        Object.entries(extraParams).forEach(([k, v]) => {
          if (v !== undefined && v !== null && v !== '') params.set(k, String(v));
        });
      }
      const sep = linkUrl.includes('?') ? '&' : '?';
      const url = params.toString() ? `${linkUrl}${sep}${params.toString()}` : linkUrl;
      try {
        platform.openExternal(url);
      } catch (e) {
        console.error(e);
      }
    },
    [user?.id],
  );

  if (!open) return null;

  return (
    <div style={overlay} onClick={onClose}>
      <div style={sheet} onClick={(e) => e.stopPropagation()}>
        <div style={headerStyle}>
          <div>
            <div style={{ fontSize: 13, color: '#6B7280', marginBottom: 2 }}>
              Balance
            </div>
            <div style={{ fontSize: 24, fontWeight: 600, color: '#111' }}>
              <span style={{ color: '#4736C1', marginRight: 6 }}>✻</span>
              {(balance ?? 0).toLocaleString()}
            </div>
          </div>
          <button type="button" onClick={onClose} style={closeBtn} aria-label="Close">
            ×
          </button>
        </div>

        <div style={{ overflowY: 'auto' }}>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              margin: '20px 20px 8px',
              gap: 12,
            }}
          >
            <div
              style={{
                fontSize: 12,
                fontWeight: 600,
                color: '#6B7280',
                textTransform: 'uppercase',
                letterSpacing: 0.4,
              }}
            >
              Get more
            </div>
            <div
              role="tablist"
              style={{
                display: 'inline-flex',
                background: '#F3F4F6',
                borderRadius: 999,
                padding: 2,
                gap: 0,
              }}
            >
              {[
                { id: 'subscription', label: 'Subscribe' },
                { id: 'one_time', label: 'One-time' },
              ].map((opt) => {
                const selected = billingMode === opt.id;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    role="tab"
                    aria-selected={selected}
                    onClick={() => setBillingMode(opt.id)}
                    style={{
                      border: 'none',
                      background: selected ? '#fff' : 'transparent',
                      color: selected ? '#111' : '#6B7280',
                      fontSize: 12,
                      fontWeight: 600,
                      padding: '4px 12px',
                      borderRadius: 999,
                      cursor: 'pointer',
                      boxShadow: selected ? '0 1px 2px rgba(0,0,0,0.06)' : 'none',
                    }}
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>
          </div>
          {billingMode === 'subscription' ? (
            <div
              style={{
                padding: '0 20px',
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
                gap: 8,
              }}
            >
              {subscriptions.length === 0 ? (
                <div style={{ color: '#6B7280', fontSize: 13 }}>
                  No subscription plans configured yet.
                </div>
              ) : (
                subscriptions.map((pkg) => (
                  <div
                    key={pkg.id}
                    style={{
                      border: '1px solid #E2E2E2',
                      background: '#fff',
                      borderRadius: 10,
                      padding: 12,
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 4,
                    }}
                  >
                    <div style={{ fontWeight: 600, color: '#111' }}>{pkg.label}</div>
                    <div style={{ color: '#4736C1', fontWeight: 600 }}>
                      ✻ {pkg.tokens.toLocaleString()}
                    </div>
                    <div style={{ color: '#6B7280', fontSize: 12 }}>{pkg.priceLabel}</div>
                    <div
                      style={{
                        marginTop: 6,
                        paddingTop: 6,
                        borderTop: '1px solid #F3F4F6',
                        color: '#6B7280',
                        fontSize: 11,
                        lineHeight: 1.55,
                      }}
                    >
                      <div>~{Math.round(pkg.tokens / 4).toLocaleString()} images</div>
                      <div>~{Math.round(pkg.tokens / 10).toLocaleString()}s of video</div>
                      <div>{pkg.tokens.toLocaleString()} voice prompts</div>
                    </div>
                    <button
                      type="button"
                      onClick={() => openPaymentLink(pkg.paymentLinkUrl)}
                      disabled={!pkg.paymentLinkUrl}
                      style={{
                        marginTop: 10,
                        border: 'none',
                        background: pkg.paymentLinkUrl ? '#4736C1' : '#E5E7EB',
                        color: pkg.paymentLinkUrl ? '#fff' : '#9CA3AF',
                        fontWeight: 600,
                        fontSize: 12,
                        padding: '8px 10px',
                        borderRadius: 8,
                        cursor: pkg.paymentLinkUrl ? 'pointer' : 'not-allowed',
                      }}
                    >
                      Upgrade
                    </button>
                  </div>
                ))
              )}
            </div>
          ) : (
            (() => {
              const cfg = oneTime || {
                tokensPerUnit: 70,
                dollarsPerUnit: 1,
                minDollars: 5,
                maxDollars: 500,
                paymentLinkUrl: '',
              };
              const dollars = Math.max(
                cfg.minDollars,
                Math.min(cfg.maxDollars, oneTimeDollars || cfg.minDollars),
              );
              const quantity = Math.round(dollars / cfg.dollarsPerUnit);
              const tokens = quantity * cfg.tokensPerUnit;
              return (
                <div
                  style={{
                    margin: '0 20px',
                    border: '1px solid #E2E2E2',
                    borderRadius: 10,
                    padding: 14,
                    background: '#fff',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 12,
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 12 }}>
                    <div>
                      <div style={{ color: '#4736C1', fontWeight: 700, fontSize: 18 }}>
                        ✻ {tokens.toLocaleString()}
                      </div>
                      <div style={{ color: '#6B7280', fontSize: 12, marginTop: 2 }}>
                        ~{Math.round(tokens / 4).toLocaleString()} images ·{' '}
                        ~{Math.round(tokens / 10).toLocaleString()}s of video ·{' '}
                        {tokens.toLocaleString()} voice prompts
                      </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: 22, fontWeight: 700, color: '#111' }}>
                        ${dollars}
                      </div>
                    </div>
                  </div>

                  <div style={{ padding: '0 8px' }}>
                    <input
                      type="range"
                      min={cfg.minDollars}
                      max={cfg.maxDollars}
                      step={1}
                      value={dollars}
                      onChange={(e) => setOneTimeDollars(Number(e.target.value))}
                      style={{
                        display: 'block',
                        width: '100%',
                        margin: 0,
                        padding: 0,
                        boxSizing: 'border-box',
                        accentColor: '#4736C1',
                      }}
                    />
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        color: '#9CA3AF',
                        fontSize: 11,
                        marginTop: 6,
                      }}
                    >
                      <span>${cfg.minDollars}</span>
                      <span>${cfg.maxDollars}</span>
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <label style={{ fontSize: 12, color: '#6B7280' }}>Amount</label>
                    <div
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        border: '1px solid #E2E2E2',
                        borderRadius: 8,
                        overflow: 'hidden',
                      }}
                    >
                      <span style={{ padding: '6px 8px', color: '#6B7280', fontSize: 13 }}>$</span>
                      <input
                        type="number"
                        min={cfg.minDollars}
                        max={cfg.maxDollars}
                        step={1}
                        value={oneTimeDollars}
                        onChange={(e) => setOneTimeDollars(Number(e.target.value))}
                        onBlur={() => setOneTimeDollars(dollars)}
                        style={{
                          border: 'none',
                          outline: 'none',
                          fontSize: 13,
                          padding: '6px 8px',
                          width: 64,
                        }}
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() =>
                        openPaymentLink(cfg.paymentLinkUrl, { prefilled_quantity: quantity })
                      }
                      disabled={!cfg.paymentLinkUrl}
                      style={{
                        marginLeft: 'auto',
                        border: 'none',
                        background: cfg.paymentLinkUrl ? '#4736C1' : '#E5E7EB',
                        color: cfg.paymentLinkUrl ? '#fff' : '#9CA3AF',
                        fontWeight: 600,
                        fontSize: 13,
                        padding: '8px 14px',
                        borderRadius: 8,
                        cursor: cfg.paymentLinkUrl ? 'pointer' : 'not-allowed',
                      }}
                    >
                      Buy ✻ {tokens.toLocaleString()}
                    </button>
                  </div>
                  {!cfg.paymentLinkUrl ? (
                    <div style={{ fontSize: 11, color: '#9CA3AF' }}>
                      One-time purchases not configured yet.
                    </div>
                  ) : null}
                </div>
              );
            })()
          )}


          <div
            style={{
              margin: '20px 20px 24px',
              border: '1px solid #E5E7EB',
              borderRadius: 10,
              overflow: 'hidden',
              background: '#fff',
            }}
          >
            <button
              type="button"
              onClick={() => setActivityOpen((v) => !v)}
              style={{
                all: 'unset',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 8,
                cursor: 'pointer',
                padding: '12px 14px',
                width: '100%',
                boxSizing: 'border-box',
              }}
            >
              <span style={{ display: 'inline-flex', alignItems: 'baseline', gap: 6 }}>
                <span
                  style={{
                    fontSize: 12,
                    fontWeight: 600,
                    color: '#6B7280',
                    textTransform: 'uppercase',
                    letterSpacing: 0.4,
                  }}
                >
                  Activity
                </span>
                {transactions.length > 0 ? (
                  <span style={{ fontSize: 12, color: '#9CA3AF' }}>
                    ({transactions.length})
                  </span>
                ) : null}
              </span>
              <span
                aria-hidden
                style={{
                  color: '#9CA3AF',
                  fontSize: 10,
                  transform: activityOpen ? 'rotate(90deg)' : 'rotate(0deg)',
                  transition: 'transform 140ms ease',
                }}
              >
                ▶
              </span>
            </button>
            {activityOpen ? (
              <div
                style={{
                  padding: '4px 14px 14px',
                  borderTop: '1px solid #F3F4F6',
                  maxHeight: 280,
                  overflowY: 'auto',
                }}
              >
                {error ? (
                  <div style={{ color: '#B91C1C', fontSize: 13 }}>{error}</div>
                ) : null}
                {loading && transactions.length === 0 ? (
                  <div style={{ color: '#6B7280', fontSize: 13 }}>Loading…</div>
                ) : null}
                {!loading && transactions.length === 0 && !error ? (
                  <div style={{ color: '#6B7280', fontSize: 13 }}>No activity yet.</div>
                ) : null}
                {transactions.map((t) => (
                  <ActivityRow key={t.id} tx={t} />
                ))}
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
};

export default TokensModal;
