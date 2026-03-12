'use client';

export default function GlobalError({ reset }: { reset: () => void }) {
  return (
    <html>
      <body>
        <button onClick={() => reset()}>重试</button>
      </body>
    </html>
  );
}
