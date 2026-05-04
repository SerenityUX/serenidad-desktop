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
  const { token, user, refreshUser } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [balance, setBalance] = useState(user?.tokens ?? 0);
  const [transactions, setTransactions] = useState([]);
  const [packages, setPackages] = useState([]);
  const [billingMode, setBillingMode] = useState('subscription');
  const [activityOpen, setActivityOpen] = useState(false);

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
        setPackages(Array.isArray(pkgBody.packages) ? pkgBody.packages : []);
      } else {
        setPackages([]);
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

  const buy = useCallback(
    (pkg) => {
      if (!pkg?.paymentLinkUrl) return;
      const userId = user?.id || '';
      const sep = pkg.paymentLinkUrl.includes('?') ? '&' : '?';
      const url = userId
        ? `${pkg.paymentLinkUrl}${sep}client_reference_id=${encodeURIComponent(userId)}`
        : pkg.paymentLinkUrl;
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
              <span style={{ color: '#F97316', marginRight: 6 }}>✻</span>
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
          <div
            style={{
              padding: '0 20px',
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
              gap: 8,
            }}
          >
            {(() => {
              const filtered = packages.filter((p) => p.kind === billingMode);
              if (filtered.length === 0) {
                return (
                  <div style={{ color: '#6B7280', fontSize: 13 }}>
                    {billingMode === 'subscription'
                      ? 'No subscription plans configured yet.'
                      : 'No token packs configured yet.'}
                  </div>
                );
              }
              return filtered.map((pkg) => (
                <button
                  key={pkg.id}
                  type="button"
                  onClick={() => buy(pkg)}
                  style={{
                    border: '1px solid #E2E2E2',
                    background: '#fff',
                    borderRadius: 10,
                    padding: '12px 12px',
                    textAlign: 'left',
                    cursor: 'pointer',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 4,
                  }}
                >
                  <div style={{ fontWeight: 600, color: '#111' }}>{pkg.label}</div>
                  <div style={{ color: '#F97316', fontWeight: 600 }}>
                    ✻ {pkg.tokens.toLocaleString()}
                  </div>
                  <div style={{ color: '#6B7280', fontSize: 12 }}>{pkg.priceLabel}</div>
                </button>
              ));
            })()}
          </div>

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
              margin: '20px 20px 8px',
            }}
          >
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
              {transactions.length > 0 ? (
                <span style={{ marginLeft: 6, color: '#9CA3AF' }}>
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
            <div style={{ padding: '0 20px 20px' }}>
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
  );
};

export default TokensModal;
