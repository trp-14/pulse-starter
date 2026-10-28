'use client';

import { useSyncExternalStore } from 'react';
import { requestPalette } from '@/lib/client/events';

const noopSubscribe = () => () => undefined;
const isApple = () => /Mac|iPhone|iPad/.test(navigator.userAgent);

/** Opens the command palette; shows ⌘K on Apple devices, Ctrl K elsewhere (server renders Ctrl K). */
export function PaletteButton() {
  const shortcut = useSyncExternalStore(
    noopSubscribe,
    () => (isApple() ? '⌘K' : 'Ctrl K'),
    () => 'Ctrl K',
  );
  return (
    <button type="button" className="btn palette-button" onClick={requestPalette} aria-keyshortcuts="Control+K Meta+K">
      Commands
      <kbd className="kbd">{shortcut}</kbd>
    </button>
  );
}
