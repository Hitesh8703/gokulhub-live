'use client';

import { useState, useEffect } from 'react';
import { usePWA } from '@/hooks/usePWA';

export default function PWAInstallButton() {
  const { isInstallable, isInstalled, isOnline, isUpdateAvailable, promptInstall, updateServiceWorker } = usePWA();
  const [dismissed, setDismissed] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    // Check if user previously dismissed
    const wasDismissed = sessionStorage.getItem('pwa-install-dismissed');
    if (wasDismissed) setDismissed(true);
  }, []);

  if (!mounted) return null;

  const handleDismiss = () => {
    setDismissed(true);
    sessionStorage.setItem('pwa-install-dismissed', 'true');
  };

  // Update available banner
  if (isUpdateAvailable) {
    return (
      <div style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 9999,
        background: 'linear-gradient(135deg, #0e0e0e, #161616)',
        borderBottom: '1px solid rgba(201,168,76,0.4)',
        padding: '12px 20px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '12px',
      }}>
        <span style={{ color: '#c9a84c', fontSize: '0.875rem', fontWeight: 500 }}>
          🔄 A new version of GokulHub is available
        </span>
        <button
          onClick={updateServiceWorker}
          style={{
            background: 'linear-gradient(135deg, #c9a84c, #8a6e2f)',
            color: '#050505',
            border: 'none',
            padding: '6px 16px',
            borderRadius: '999px',
            fontSize: '0.8rem',
            fontWeight: 700,
            cursor: 'pointer',
            flexShrink: 0,
          }}
        >
          Update Now
        </button>
      </div>
    );
  }

  // Offline indicator
  if (!isOnline) {
    return (
      <div style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 9999,
        background: '#1a0a0a',
        borderBottom: '1px solid rgba(220,50,50,0.4)',
        padding: '10px 20px',
        textAlign: 'center',
        color: '#ff6b6b',
        fontSize: '0.85rem',
        fontWeight: 500,
      }}>
        ⚠️ You are offline — some features may not be available
      </div>
    );
  }

  // Install prompt banner (only if installable and not dismissed and not already installed)
  if (!isInstallable || isInstalled || dismissed) return null;

  return (
    <div style={{
      position: 'fixed',
      bottom: '24px',
      left: '50%',
      transform: 'translateX(-50%)',
      zIndex: 9999,
      background: 'linear-gradient(145deg, rgba(20,18,14,0.98), rgba(14,14,14,0.99))',
      border: '1px solid rgba(201,168,76,0.4)',
      borderRadius: '20px',
      padding: '16px 20px',
      width: 'calc(100vw - 40px)',
      maxWidth: '420px',
      boxShadow: '0 8px 40px rgba(0,0,0,0.7), 0 0 30px rgba(201,168,76,0.1)',
      backdropFilter: 'blur(20px)',
      display: 'flex',
      flexDirection: 'column',
      gap: '12px',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/icon-72x72.png"
          alt="GokulHub"
          width={44}
          height={44}
          style={{ borderRadius: '10px', flexShrink: 0 }}
        />
        <div style={{ flex: 1 }}>
          <div style={{ color: '#f0ece4', fontWeight: 600, fontSize: '0.95rem' }}>
            Install GokulHub
          </div>
          <div style={{ color: '#aaa', fontSize: '0.8rem', marginTop: '2px' }}>
            Add to home screen for quick access
          </div>
        </div>
        <button
          onClick={handleDismiss}
          style={{
            background: 'none',
            border: 'none',
            color: '#777',
            cursor: 'pointer',
            fontSize: '1.2rem',
            lineHeight: 1,
            padding: '4px',
            flexShrink: 0,
          }}
          aria-label="Dismiss"
        >
          ×
        </button>
      </div>
      <div style={{ display: 'flex', gap: '10px' }}>
        <button
          onClick={handleDismiss}
          style={{
            flex: 1,
            background: 'transparent',
            border: '1px solid rgba(201,168,76,0.3)',
            color: '#c9a84c',
            padding: '10px',
            borderRadius: '12px',
            fontSize: '0.85rem',
            fontWeight: 500,
            cursor: 'pointer',
          }}
        >
          Not Now
        </button>
        <button
          onClick={promptInstall}
          style={{
            flex: 2,
            background: 'linear-gradient(135deg, #c9a84c, #8a6e2f)',
            border: 'none',
            color: '#050505',
            padding: '10px',
            borderRadius: '12px',
            fontSize: '0.85rem',
            fontWeight: 700,
            cursor: 'pointer',
          }}
        >
          Install App
        </button>
      </div>
    </div>
  );
}
