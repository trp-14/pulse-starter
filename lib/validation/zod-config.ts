import { z } from 'zod';

// Zod 4 probes `new Function("")` to decide whether it may JIT-compile object parsers. Under our
// strict CSP (no 'unsafe-eval') the probe is blocked and reported as a CSP violation, even though
// Zod swallows the error. Jitless mode skips the probe; parsing is identical, marginally slower.
z.config({ jitless: true });
