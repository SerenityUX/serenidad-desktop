import React, { useEffect, useState } from 'react';
import platform, { isElectron } from '../platform';
import { apiUrl } from '../config';

const CURRENT_VERSION = process.env.DESKTOP_VERSION || '0.0.0';
const POLL_MS = 5 * 60 * 1000;

const UpdateGate = ({ children }) => {
  const [latest, setLatest] = useState(null);

  useEffect(() => {
    if (!isElectron) return;

    let cancelled = false;
    const check = async () => {
      try {
        const res = await fetch(apiUrl('/desktop-version'), {
          cache: 'no-store',
        });
        if (!res.ok) return;
        const data = await res.json();
        if (!cancelled && data && data.version) setLatest(data);
      } catch {
        /* offline — try again on next tick */
      }
    };

    check();
    const id = setInterval(check, POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  const needsUpdate =
    isElectron && latest && latest.version && latest.version !== CURRENT_VERSION;

  if (!needsUpdate) return children;

  const downloadUrl = latest.dmgUrl || latest.downloadUrl;
  const handleDownload = () => {
    if (downloadUrl) platform.openExternal(downloadUrl);
  };

  return (
    <>
      {children}
      <div
        style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0,0,0,0.55)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 2147483647,
          fontFamily:
            '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
        }}
      >
        <div
          style={{
            width: 420,
            background: '#fff',
            borderRadius: 12,
            padding: '28px 28px 24px',
            boxShadow: '0 20px 60px rgba(0,0,0,0.35)',
            textAlign: 'center',
          }}
        >
          <div
            style={{
              fontSize: 18,
              fontWeight: 600,
              marginBottom: 8,
              color: '#111',
            }}
          >
            Update required
          </div>
          <div
            style={{
              fontSize: 14,
              color: '#444',
              lineHeight: 1.5,
              marginBottom: 20,
            }}
          >
            A newer version of Serenidad is available
            {latest.version ? ` (${latest.version})` : ''}. You're on{' '}
            {CURRENT_VERSION}. Please download and install the update to
            continue.
          </div>
          <button
            type="button"
            onClick={handleDownload}
            style={{
              width: '100%',
              padding: '10px 14px',
              background: '#4736C1',
              color: '#fff',
              border: 'none',
              borderRadius: 8,
              fontSize: 14,
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Download update
          </button>
          <div
            style={{
              fontSize: 12,
              color: '#888',
              marginTop: 14,
              lineHeight: 1.5,
            }}
          >
            After downloading, quit Serenidad and replace the app in your
            Applications folder, then reopen.
          </div>
        </div>
      </div>
    </>
  );
};

export default UpdateGate;
