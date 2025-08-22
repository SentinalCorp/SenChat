# SenChat – GitHub Pages Setup

## Quick Deploy
1. Copy these files into your repo root.
2. Commit and push to `main`.
3. In GitHub, go to **Settings → Pages** → select **GitHub Actions**.
4. Wait for deploy → site at `https://<your-user>.github.io/SenChat/`.

## Notes
- Vite base is set to `/SenChat/`.
- `404.html` fallback prevents broken routing.
- If repo name ≠ `SenChat`, edit `vite.config.ts` → change `base`.
