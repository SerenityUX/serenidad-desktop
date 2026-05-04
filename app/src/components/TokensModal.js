import React, { useEffect, useState, useCallback } from 'react';
import { apiUrl } from '../config';
import { useAuth } from '../context/AuthContext';

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

const TokensModal = ({ open, onClose }) => {
  const { token, user, refreshUser } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [balance, setBalance] = useState(user?.tokens ?? 0);
  const [transactions, setTransactions] = useState([]);
  const [packages, setPackages] = useState([]);

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
        window.electron?.openExternalLink?.(url);
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
              <span style={{ color: '#1F93FF', marginRight: 6 }}>✦</span>
              {(balance ?? 0).toLocaleString()}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <button
              type="button"
              onClick={() => {
                load();
                refreshUser?.();
              }}
              disabled={loading}
              style={{
                border: '1px solid #E2E2E2',
                background: '#fff',
                color: '#374151',
                borderRadius: 6,
                padding: '6px 10px',
                fontSize: 12,
                cursor: loading ? 'default' : 'pointer',
              }}
            >
              {loading ? 'Refreshing…' : 'Refresh'}
            </button>
            <button type="button" onClick={onClose} style={closeBtn} aria-label="Close">
              ×
            </button>
          </div>
        </div>

        <div style={{ overflowY: 'auto' }}>
          <div style={sectionTitle}>Buy more</div>
          <div
            style={{
              padding: '0 20px',
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
              gap: 8,
            }}
          >
            {packages.length === 0 ? (
              <div style={{ color: '#6B7280', fontSize: 13 }}>
                No packages configured yet.
              </div>
            ) : (
              packages.map((pkg) => (
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
                  <div style={{ color: '#1F93FF', fontWeight: 600 }}>
                    ✦ {pkg.tokens.toLocaleString()}
                  </div>
                  <div style={{ color: '#6B7280', fontSize: 12 }}>{pkg.priceLabel}</div>
                </button>
              ))
            )}
          </div>

          <div style={sectionTitle}>Activity</div>
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
            {transactions.map((t) => {
              const isCredit = t.delta > 0;
              return (
                <div
                  key={t.id}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'flex-start',
                    gap: 12,
                    padding: '10px 0',
                    borderBottom: '1px solid #F3F4F6',
                  }}
                >
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ fontSize: 13, color: '#111', fontWeight: 500 }}>
                      {t.name || (isCredit ? 'Credit' : 'Charge')}
                    </div>
                    {t.notes ? (
                      <div
                        style={{
                          fontSize: 12,
                          color: '#6B7280',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {t.notes}
                      </div>
                    ) : null}
                    <div style={{ fontSize: 11, color: '#9CA3AF', marginTop: 2 }}>
                      {formatDate(t.created_at)}
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
                    {t.delta.toLocaleString()}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};

export default TokensModal;
