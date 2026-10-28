import type { Theme } from '@/lib/theme';
import { RushTicker } from './RushTicker';
import { SimulateButton } from './SimulateButton';
import { ThemeToggle } from './ThemeToggle';

export function Header({ serverTheme }: { serverTheme: Theme | null }) {
  return (
    <header className="site-header glass has-sheen" data-reveal>
      <span className="glass-sheen" aria-hidden="true" />
      <div className="brand">
        <span className="brand-mark" aria-hidden="true" />
        <div>
          <h1 className="brand-name">Pulse</h1>
          <p className="brand-tagline">Live control room</p>
        </div>
      </div>
      {/* Reserved space between brand and controls: the RUSH MODE ticker appears here, so nothing shifts. */}
      <RushTicker />
      <div className="header-actions">
        <ThemeToggle serverTheme={serverTheme} />
      </div>
      <div className="header-simulate">
        <SimulateButton />
      </div>
    </header>
  );
}
