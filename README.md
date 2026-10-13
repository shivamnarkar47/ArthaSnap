# ArthaSnap — NSE/BSE stocks, judged in seconds

Type up to 5 NSE/BSE symbols. SubQ's decision model calls **buy / watch / avoid**
with conviction — Groq briefs the latest news. No noise, just the verdict.

Live: https://subq-web.shivamnarkar47.workers.dev

## Parts (4, fewest moving pieces)

| Dir | What | Run | Deployed |
|---|---|---|---|
| `indian-api/` | NSE/BSE snapshot REST (Cloudflare Worker, Yahoo-backed, via [0xramm/Indian-Stock-Market-API](https://github.com/0xramm/Indian-Stock-Market-API)) | `npx wrangler dev --port 8787` | `stock-api…workers.dev` |
| `digest/` | Bun + Hono JSON API: `/stock /history /decide /news /digest /movers` | `bun src/index.ts` (:3000) | `subq-digest…workers.dev` |
| `web/` | TanStack Start + shadcn + ns-ui, SSR + streaming, nitro → Workers | `bun run dev` (:3001) | `subq-web…workers.dev` |
| `snap_nse.py` | Original one-file SubQ probe (stdlib only) | `python snap_nse.py` | — |

Standalone now: nothing fetches worker-to-worker (the edge 1042s those hops).
`digest` and `web` call Yahoo / SubQ / Groq directly; `web` imports `digest/src/svc.ts`
in-process on the server. `indian-api` stays a public API nobody depends on.

## API sketch

- `GET /digest?symbols=RELIANCE.NS,TCS.NS` → per-symbol snapshot + SMA20/RSI14 +
  SubQ `{buy:noul, action:choice, conviction:score 0-4}` (packed: 3 Qs × 5 symbols
  = 15 questions, **1 call**) + one Groq brief (**1 call**).
- `GET /movers` → top-10 gainers/losers over a 38-symbol Nifty-heavy universe, one
  Yahoo batch call, 5-min cache.
- `GET /history?symbol=&range=1mo&interval=1d` → OHLC candles (Yahoo v8, no key).

## Env (root `.env`, never committed)

```
SUBQ_API_KEY=sk-proj-…
GROQ_API_KEY=gsk_…
```

## Local dev

```
set -a; source .env; set +a
cd indian-api && npx wrangler dev --port 8787 &
bun digest/src/index.ts &            # :3000
cd web && bun run dev                # :3001
```

## Deploy (needs `wrangler login` once)

```
cd indian-api && npx wrangler deploy                                  # stock-api
cd digest && npx wrangler secret put SUBQ_API_KEY GROQ_API_KEY …      # secrets
           npx wrangler deploy                                        # subq-digest
cd web && NITRO_PRESET=cloudflare_module bun run build
  npx wrangler deploy --config .output/server/wrangler.json --name subq-web
  npx wrangler secret put SUBQ_API_KEY / GROQ_API_KEY --name subq-web
```

## Calls worth knowing

- SubQ charges input tokens only (`output_tokens` always 0); score criteria must be
  an **array** of consecutive levels, not an object.
- Groq `qwen/qwen3.8-27b` for briefs (`gpt-oss-20b` returns empty ~1/3 — measured).
- UI motion: [ns-ui](https://design.helpmarq.com) components, installed as owned
  source under `web/src/components/ui/`.

## Credits

- Stock snapshot API: [0xramm/Indian-Stock-Market-API](https://github.com/0xramm/Indian-Stock-Market-API) (MIT) — vendored under `indian-api/`, deployed as-is.
- Motion components: [ns-ui](https://design.helpmarq.com) by Nikolas Sapa (MIT).

## Disclaimer

Educational. Model judgments + delayed quotes are not financial advice. Verify
before trading.
