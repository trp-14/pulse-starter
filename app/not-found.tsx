import Link from 'next/link';

export const metadata = { title: 'Not found · Pulse' };

export default function NotFound() {
  return (
    <main id="dashboard" className="status-page">
      <section className="tile status-tile" aria-labelledby="not-found-title">
        <span className="search-orb" aria-hidden="true" />
        <h1 id="not-found-title" className="status-title">
          We couldn’t find that page
        </h1>
        <p className="status-text">The link may be old, or the page may have moved.</p>
        <Link href="/" className="btn-gloss">
          Back to the dashboard
        </Link>
      </section>
    </main>
  );
}
