# Agent Notes (Macro Market Radar)

## Project Overview

“经纬雷达”是中文优先的只读全球宏观行情面板，面向手机与桌面浏览。它聚合 Yahoo Finance、美国财政部、纽约联储、Fiscal Data 和 FRED 数据，以低频缓存换取低 Vercel 资源占用。

## Quick Commands

- Install: `npm install`
- Dev: `npm run dev`
- Test: `npm test`
- Build: `npm run build`
- E2E: `npm run test:e2e`

## Architecture

- `src/`: static React interface and deterministic regime interpretation.
- `api/market.js`: the only browser-facing data interface.
- `api/lib/`: catalog, provider adapters, normalization and cache orchestration. Every upstream metric degrades independently.
- `docs/research/`: provider research and source notes.

```text
browser -> device-auth routing middleware -> /api/market -> Yahoo chart adapter
                                                       -> US Treasury curve adapter
                                                       -> New York Fed / Fiscal Data adapters
                                                       -> bundled FRED economic-series snapshot
        <- normalized snapshot + CDN cache headers
```

## Conventions

- JavaScript ES modules, two spaces, single quotes, no semicolons, LF.
- UI never calls upstream providers directly.
- Provider output must be normalized before crossing `/api/market`.
- A missing provider degrades individual tiles; it must not fail the whole snapshot.
- No polling. Users refresh explicitly; browser and CDN caches carry stale data safely.

## Safety

- Never commit provider credentials or `.vercel` metadata.
- `DEVICE_ACCESS_HASH` is a production-only Vercel secret. Never commit the raw device key or put it in a query string; enrollment uses the URL fragment handled by `public/unlock.html`.
- Yahoo endpoints are unofficial and may throttle. Keep retries bounded and preserve stale client data.
- Do not label price direction as economic benefit. Tiles show “红涨绿跌”; regime cards provide interpretation separately.
- Do not edit generated `dist/` files.

## Verification

- Simulation/interpretation changes require worked-example tests.
- Provider parsing changes require fixture-style tests.
- UI changes require desktop and iPhone 12 Pro Max Playwright checks using system Chrome.
