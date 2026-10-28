'use client';

export interface ToastMessage {
  id: number;
  title: string;
  body: string;
}

interface ToastProps {
  toast: ToastMessage | null;
  onDismiss: () => void;
}

/** Glass toast in a polite live region, so screen readers announce it without stealing focus. */
export function Toast({ toast, onDismiss }: ToastProps) {
  return (
    <div className="toast-region" role="status" aria-live="polite" aria-atomic="true">
      {toast ? (
        <div className="toast glass" key={toast.id}>
          <div>
            <p className="toast-title">{toast.title}</p>
            <p className="toast-body">{toast.body}</p>
          </div>
          <button type="button" className="toast-close" aria-label="Dismiss notification" onClick={onDismiss}>
            ×
          </button>
        </div>
      ) : null}
    </div>
  );
}
