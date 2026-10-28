'use client';

import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent, type MouseEvent } from 'react';
import { ORDER_STATUSES, type OrderStatus } from '@/types';
import { gsap } from '@/hooks/useGsap';
import { prefersReducedMotion } from '@/hooks/useReducedMotion';
import {
  onPaletteRequest,
  requestDashboardRefresh,
  requestOrdersStatus,
  requestSimulate,
} from '@/lib/client/events';
import { toggleTheme } from '@/lib/client/theme';
import { statusLabel } from '@/components/orders/StatusPill';

interface Command {
  id: string;
  label: string;
  hint: string;
  run: () => void;
}

function jumpToOrders(): void {
  const section = document.getElementById('orders');
  section?.scrollIntoView({ behavior: prefersReducedMotion() ? 'auto' : 'smooth', block: 'start' });
  section?.querySelector<HTMLElement>('#orders-title')?.focus({ preventScroll: true });
}

function filterOrders(status: OrderStatus | undefined): void {
  requestOrdersStatus(status);
  jumpToOrders();
}

const COMMANDS: Command[] = [
  { id: 'jump-orders', label: 'Jump to orders', hint: 'Navigate', run: jumpToOrders },
  { id: 'filter-all', label: 'Show all orders', hint: 'Filter', run: () => filterOrders(undefined) },
  ...ORDER_STATUSES.map((status) => ({
    id: `filter-${status}`,
    label: `Filter orders: ${statusLabel(status)}`,
    hint: 'Filter',
    run: () => filterOrders(status),
  })),
  { id: 'simulate', label: 'Simulate rush hour', hint: 'Action', run: requestSimulate },
  { id: 'theme', label: 'Toggle Day / Night theme', hint: 'Appearance', run: toggleTheme },
  { id: 'refresh', label: 'Refresh live data now', hint: 'Action', run: requestDashboardRefresh },
];

export const matches = (command: Pick<Command, 'label' | 'hint'>, query: string): boolean => {
  const terms = query.toLowerCase().split(/\s+/).filter(Boolean);
  const haystack = `${command.label} ${command.hint}`.toLowerCase();
  return terms.every((term) => haystack.includes(term));
};

export function nextOption(key: string, active: number, last: number): number | null {
  if (key === 'ArrowDown') return Math.min(last, active + 1);
  if (key === 'ArrowUp') return Math.max(0, active - 1);
  if (key === 'Home') return 0;
  if (key === 'End') return last;
  return null;
}

/** ⌘K / Ctrl+K command palette: a native modal <dialog> (focus trap, Esc, focus return built in). */
export function CommandPalette() {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const listId = useId();
  const results = useMemo(() => COMMANDS.filter((command) => matches(command, query)), [query]);
  // An event handler, not render code: the short open tween is killed on unmount below.
  const open = () => {
    const dialog = dialogRef.current;
    if (!dialog || dialog.open) return;
    setQuery('');
    setActive(0);
    dialog.showModal();
    if (prefersReducedMotion()) gsap.fromTo(dialog, { opacity: 0 }, { opacity: 1, duration: 0.2 });
    else gsap.fromTo(dialog, { opacity: 0, y: -10, scale: 0.98 }, { opacity: 1, y: 0, scale: 1, duration: 0.24, ease: 'power3.out' });
  };

  const close = () => dialogRef.current?.close();

  const run = (command: Command | undefined) => {
    if (!command) return;
    close();
    command.run();
  };

  // Global listeners are registered once; they always call the latest `open`.
  const openRef = useRef(open);
  useEffect(() => {
    openRef.current = open;
  });

  useEffect(() => {
    const onKeyDown = (event: globalThis.KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        if (dialogRef.current?.open) dialogRef.current.close();
        else openRef.current();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    const offRequest = onPaletteRequest(() => openRef.current());
    const dialog = dialogRef.current;
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      offRequest();
      if (dialog) gsap.killTweensOf(dialog);
    };
  }, []);

  const onInputKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    const next = nextOption(event.key, active, results.length - 1);
    if (next !== null) {
      event.preventDefault();
      setActive(Math.max(0, next));
    } else if (event.key === 'Enter') {
      event.preventDefault();
      run(results.at(active));
    }
  };

  // Clicking the dimmed backdrop (the dialog element itself, outside the panel) closes it.
  const onDialogClick = (event: MouseEvent<HTMLDialogElement>) => {
    if (event.target === event.currentTarget) close();
  };

  const optionId = (index: number) => `${listId}-option-${index}`;

  return (
    <dialog ref={dialogRef} className="palette" aria-label="Command palette" onClick={onDialogClick}>
      <div className="palette-panel glass has-sheen">
        <span className="glass-sheen" data-revealed="true" aria-hidden="true" />
        <div className="palette-search">
          <input
            type="text"
            role="combobox"
            aria-expanded="true"
            aria-controls={listId}
            aria-autocomplete="list"
            aria-activedescendant={results.length > 0 ? optionId(active) : undefined}
            aria-label="Search commands"
            placeholder="Type a command…"
            maxLength={60}
            autoComplete="off"
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setActive(0);
            }}
            onKeyDown={onInputKeyDown}
          />
        </div>
        <ul id={listId} role="listbox" aria-label="Commands" className="palette-list">
          {results.map((command, index) => (
            <li
              key={command.id}
              id={optionId(index)}
              role="option"
              aria-selected={index === active}
              className={index === active ? 'palette-option is-active' : 'palette-option'}
              onPointerMove={() => setActive(index)}
              onClick={() => run(command)}
            >
              <span>{command.label}</span>
              <span className="palette-hint">{command.hint}</span>
            </li>
          ))}
        </ul>
        {results.length === 0 ? <p className="palette-empty">No matching commands</p> : null}
        <p className="palette-footer">↑ ↓ to move · Enter to run · Esc to close</p>
      </div>
    </dialog>
  );
}
