# TrendLab AI

Personal workspace for discovering short-form video ideas, reviewing observable signals, and adapting a format into an original script.

## Status

This repository contains the first implementation milestone. YouTube search is available when a YouTube Data API key is configured. Instagram and TikTok are shown as unavailable until an approved provider is configured; the app never fabricates results or metrics. AI script generation requires an OpenAI-compatible API endpoint and key. Saved items use browser local storage in this initial version; production sync/auth and Cloudflare D1 are not yet enabled.

## Stack

- React + TypeScript + Vite
- Cloudflare Worker API
- YouTube Data API v3 (official API)
- OpenAI-compatible chat completions endpoint (optional)

## Local development

1. Install Node.js 20+.
2. Run `npm install`.
3. Copy `.dev.vars.example` to `.dev.vars` and fill in keys you have obtained.
4. Run `npm run dev` for the UI and local Worker.
5. Run `npm run typecheck` and `npm run build`.

Never commit `.dev.vars`, API keys, tokens, or real secrets.

## Environment variables

Worker secrets/config:
- `YOUTUBE_API_KEY` — optional, enables YouTube search.
- `AI_API_KEY` — optional, enables script adaptation.
- `AI_BASE_URL` — optional, OpenAI-compatible API base URL, default `https://api.openai.com/v1`.
- `AI_MODEL` — optional, model name, default `gpt-4.1-mini`.

Set secrets for deployment using `wrangler secret put NAME`. Do not paste credentials into source code.

## Deployment

Cloudflare deployment requires the owner's Cloudflare account, Workers permissions, API secrets, and approved configuration. Before public access, protect the app with Cloudflare Access (owner allowlist) or equivalent server-side authentication and rate limiting: otherwise the public API could consume the configured YouTube quota and AI budget. This repository intentionally does not deploy to production automatically. Review `docs/SETUP.md` before deploying.

## Data-source limitations

YouTube's official search API has quotas and does not expose a definitive Shorts flag. The app uses short-duration search and labels the result type accurately as “короткое видео”, not as guaranteed Shorts. Official TikTok Research API access is restricted to approved researchers, so it is not treated as generally available for commercial creator use. Instagram/TikTok providers must be vetted for terms, actual fields, cost, and data rights before integration.

## Privacy

Searches are sent to configured providers. Saved ideas remain in this browser only in this milestone. Do not enter sensitive personal data.
