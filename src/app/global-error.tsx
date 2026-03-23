'use client';

export default function GlobalError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body style={{ background: '#0a0a12', color: '#fff', fontFamily: 'system-ui', display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', margin: 0 }}>
        <div style={{ textAlign: 'center' }}>
          <h2 style={{ fontSize: '1.5rem', marginBottom: '1rem' }}>Something went wrong</h2>
          <button onClick={() => reset()} style={{ padding: '0.5rem 1.5rem', background: '#FF6B35', color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '1rem' }}>
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
