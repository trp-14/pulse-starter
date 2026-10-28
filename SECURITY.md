# SECURITY — Pulse

## Threat Model
- **Apa yang dilindungi:** ...
- **Dari siapa:** ...
- **Asumsi:** public demo, data sintetis, tanpa login.

## Controls (map ke OWASP Top 10)
| Control | Spec section | OWASP | Diverifikasi oleh |
|---|---|---|---|
| | | | |

## Accepted Risks
- No authentication (public demo, synthetic data) — alasan + cara menambah auth di real store (session cookie httpOnly/Secure/SameSite, role-based access untuk write endpoint)
- ...

## Static & Dynamic Analysis
- ESLint (`eslint-plugin-security`, `eslint-plugin-sonarjs`): ...
- `npm audit --omit=dev`: ...
- Semgrep: ... (atau: tidak tersedia, alasan)

## Reporting a Vulnerability
...
