'use client';

// Route-level error boundary. Shows a generic message only: no stack trace or error text reaches
// the browser. `digest` is Next's opaque hash of the server error, matching the server log entry.
export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main id="dashboard" className="status-page">
      <section className="tile status-tile" aria-labelledby="error-title" role="alert">
        <span className="search-orb" aria-hidden="true" />
        <h1 id="error-title" className="status-title">
          Something went wrong
        </h1>
        <p className="status-text">
          The dashboard couldn’t load right now. Please try again in a moment.
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
  );
}
