import React, { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { isElectron } from '../platform';
import { asset } from '../lib/asset';
import { useAuth } from '../context/AuthContext';

const STORAGE_KEY = 'kodan_download_banner_dismissed';
const ZIP_URL =
  'https://serenidad.hel1.your-objectstorage.com/mealpack/desktop/Serenidad-mac.zip';

export const DOWNLOAD_BANNER_HEIGHT = 40;

const DownloadAppBanner = () => {
  const [hovered, setHovered] = useState(false);
  const [dismissed, setDismissed] = useState(() => {
    try {
      return localStorage.getItem(STORAGE_KEY) === '1';
    } catch {
      return false;
    }
  });

  // Landing page (`/`) is intentionally chrome-free — no banner there.
  const { pathname } = useLocation();
  const onLanding = pathname === '/';
  const { ready, user } = useAuth();
  const signedOut = ready && !user;
  const visible = !isElectron && !dismissed && !onLanding && !signedOut;

  useEffect(() => {
    const root = document.documentElement;
    if (visible) {
      root.style.setProperty('--app-top-offset', `${DOWNLOAD_BANNER_HEIGHT}px`);
    } else {
      root.style.setProperty('--app-top-offset', '0px');
    }
    return () => {
      root.style.setProperty('--app-top-offset', '0px');
    };
  }, [visible]);

  if (!visible) return null;

  const close = (e) => {
    e.preventDefault();
    e.stopPropagation();
    try {
      localStorage.setItem(STORAGE_KEY, '1');
    } catch {
      /* ignore quota */
    }
    setDismissed(true);
  };

  return (
    <a
      href={ZIP_URL}
      download
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        position: 'relative',
        height: DOWNLOAD_BANNER_HEIGHT,
        background: '#4736C1',
        color: '#fff',
        textDecoration: 'none',
        fontFamily: 'inherit',
        fontSize: 14,
        fontWeight: 500,
        cursor: 'pointer',
        userSelect: 'none',
      }}
    >
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 10 }}>
        <img
          src={asset('KodanFlower.png')}
          alt=""
          width={22}
          height={22}
          style={{
            display: 'block',
            borderRadius: 5,
          }}
        />
        <span
          style={{
            textDecoration: hovered ? 'underline' : 'none',
            fontFamily:
              '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
            fontSize: 14,
            fontWeight: 500,
          }}
        >
          Download Kōdan Desktop App
        </span>
      </span>
      <button
        type="button"
        onClick={close}
        aria-label="Dismiss download banner"
        style={{
          position: 'absolute',
          right: 8,
          top: '50%',
          transform: 'translateY(-50%)',
          width: 24,
          height: 24,
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          border: 'none',
          background: 'transparent',
          color: '#fff',
          opacity: 0.85,
          cursor: 'pointer',
          fontSize: 16,
          lineHeight: 1,
          padding: 0,
          borderRadius: 4,
        }}
      >
        ×
      </button>
    </a>
  );
};

export default DownloadAppBanner;
