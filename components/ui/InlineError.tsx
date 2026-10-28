import { formatDateTime } from '@/lib/format';

interface InlineErrorProps {
  message: string;
  requestId: string | null;
  lastUpdated?: string | null;
  onRetry: () => void;
}

/** Tile-level fetch error: generic text, last good timestamp, request ID and a retry. */
export function InlineError({ message, requestId, lastUpdated, onRetry }: InlineErrorProps) {
  return (
    <div className="inline-error" role="alert">
      <p className="inline-error-message">{message}</p>
      <p className="inline-error-meta">
        {lastUpdated ? <>Last updated {formatDateTime(lastUpdated)}. </> : null}
        {requestId ? <>Request ID <code>{requestId}</code></> : null}
      </p>
      <button type="button" className="btn" onClick={onRetry}>
        Retry now
      </button>
    </div>
  );
}
