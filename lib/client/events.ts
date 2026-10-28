// Tiny typed event bus so unrelated widgets (e.g. the Simulate button and the pollers)
// can talk without prop drilling or a global store.

const REFRESH_EVENT = 'pulse:refresh';

/** Ask every live widget to refetch now instead of waiting for its next poll. */
export function requestDashboardRefresh(): void {
  window.dispatchEvent(new Event(REFRESH_EVENT));
}

export function onDashboardRefresh(listener: () => void): () => void {
  window.addEventListener(REFRESH_EVENT, listener);
  return () => window.removeEventListener(REFRESH_EVENT, listener);
}
