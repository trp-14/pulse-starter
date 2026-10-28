'use client';

import './globals.css';

// Last-resort boundary for errors in the root layout itself (it replaces the whole document).
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="en">
      <body>
        <main className="status-page">
          <section className="tile status-tile" role="alert" aria-labelledby="global-error-title">
            <h1 id="global-error-title" className="status-title">
              Something went wrong
            </h1>
            <p className="status-text">
              Please reload the page.
              {error.digest ? (
                <>
                  {' '}
                  Reference <code>{error.digest}</code>
                </>
              ) : null}
            </p>
            <button type="button" className="btn-gloss" onClick={reset}>
              Try again
            </button>
          </section>
        </main>
      </body>
    </html>
  );
}
