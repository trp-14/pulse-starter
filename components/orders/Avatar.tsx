import { initials } from '@/lib/format';

const PASTELS = 6;

/** Stable pastel per customer name (simple string hash), so a returning customer keeps their colour. */
export function avatarTone(name: string): number {
  let hash = 0;
  for (const char of name) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return (hash % PASTELS) + 1;
}

export function Avatar({ name }: { name: string }) {
  return (
    <span className={`avatar-orb avatar-tone-${avatarTone(name)}`} aria-hidden="true">
      {initials(name)}
    </span>
  );
}
