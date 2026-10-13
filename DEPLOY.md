# DEPLOY.md — where ArthaSnap lives

## Hosted

| Surface | URL |
|---|---|
| App | https://subq-web.shivamnarkar47.workers.dev |
| Digest API | https://subq-digest.shivamnarkar47.workers.dev |
| Snapshot API (standalone) | https://stock-api.shivamnarkar47.workers.dev |

Digest endpoints: `/health` · `/stock?symbol=` · `/history?symbol=&range=&interval=`
· `/decide?symbol=` · `/news?symbol=` · `/digest?symbol=` or `?symbols=` (max 5)
· `/movers` · `/suggest?q=`

Snapshot endpoints: `/` · `/search?q=` · `/stock?symbol=&res=num|val`
· `/stock/list?symbols=&res=` · `/symbols`

## Deploy (needs `wrangler login` once)

```
cd indian-api && npx wrangler deploy                                   # stock-api
cd digest
printf '%s' "$SUBQ_API_KEY" | npx wrangler secret put SUBQ_API_KEY    # secrets live only here
printf '%s' "$GROQ_API_KEY" | npx wrangler secret put GROQ_API_KEY
npx wrangler deploy                                                    # subq-digest
cd ../web
NITRO_PRESET=cloudflare_module bun run build
npx wrangler deploy --config .output/server/wrangler.json \
  --name subq-web --compatibility-date 2026-10-13
npx wrangler secret put SUBQ_API_KEY --name subq-web
npx wrangler secret put GROQ_API_KEY --name subq-web                   # subq-web
```

## Constraints that shaped this

- Worker → `workers.dev` fetches die at the edge (1042). So `digest` and `web`
  call Yahoo / SubQ / Groq directly, and `web` imports `digest/src/svc.ts`
  in-process. `stock-api` is standalone; nothing depends on it.
- Yahoo crumb retry is capped at one — persistent 401s used to recurse into the
  50-subrequest cap and 500 the page.
- Secrets on Workers, keys only in local root `.env` (git-ignored).
