import React, { useEffect, useState } from 'react';
import { ReportsApp } from './ReportsApp';

export function DevApp() {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!localStorage.getItem('authToken')) {
      localStorage.setItem(
        'authToken',
        'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzYWxlc2RiLWF1dGgiLCJpYXQiOjE3NzUyMTM3NzYsImV4cCI6MTc3NTI0OTc3NiwidGVuYW50X2lkIjoienlkdXN1YXQiLCJ1c2VyX2lkIjo5MjU3LCJ1c2VybmFtZSI6ImFkbWluQGFwcGxpY2F0ZS5pbiIsIm9yZ190eXBlIjpudWxsLCJvcmdfY29kZSI6bnVsbCwiZGVmYXVsdF9jcmVkcyI6dHJ1ZSwicm9sZXMiOlsiVEVOQU5UX0FETUlOIl0sImp0aSI6IjBiNDJhZTUwLTg3NGMtNDZiNC1hZDZmLWVlOTU1MGY2ZmRiYyJ9.79pGFJSk3wPUDoyBBC-LVhbB-TW1IQ9Za3Kl9dyqgHg',
      );
    }
    if (!localStorage.getItem('accountId')) {
      localStorage.setItem('accountId', 'zydusuat');
    }
    if (!localStorage.getItem('authContext')) {
      localStorage.setItem(
        'authContext',
        JSON.stringify({ user: { loginId: 'aditya.sharma@salescode.ai', email: 'aditya.sharma@salescode.ai' } }),
      );
    }
    setReady(true);
  }, []);

  if (!ready) return null;

  return <ReportsApp />;
}
