import React from 'react';
import { Link } from 'react-router-dom';

/**
 * Public landing page at `/`. Empty stub for now — real marketing content
 * goes here later. The launcher (project list) lives at `/home`.
 */
const LandingPage = () => (
  <div
    style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontFamily:
        '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
    }}
  >
    <Link to="/home" style={{ color: '#1F93FF', fontSize: 18 }}>
      home
    </Link>
  </div>
);

export default LandingPage;
