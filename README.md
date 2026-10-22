# TrendLab AI

Personal workspace for discovering short-form video ideas, reviewing observable signals, and adapting a format into an original script.

## Status

This repository contains the first implementation milestone. Cross-platform search is available when a Revid API key is configured; the free tier allows 20 searches per rolling 24 hours. Official YouTube Data API is a fallback. AI script generation uses the Cloudflare Workers AI binding by default, with an optional OpenAI-compatible endpoint. Saved items use browser local storage in this initial version; production sync/auth and Cloudflare D1 are not yet enabled.

## Stack

- React + TypeScript + Vite
- Cloudflare Worker API
- Revid Viral Video Search (YouTube Shorts, Instagram Reels, TikTok; free search tier, 20 requests/day)
- YouTube Data API v3 as fallback (optional)
- Cloudflare Workers AI for script adaptation (free daily allocation; optional OpenAI-compatible fallback)

## Local development

1. Install Node.js 20+.
2. Run `npm install`.
3. Copy `.dev.vars.example` to `.dev.vars` and fill in keys you have obtained.
4. Run `npm run dev` for the UI and local Worker.
5. Run `npm run typecheck` and `npm run build`.

Never commit `.dev.vars`, API keys, tokens, or real secrets.

## Environment variables

Worker secrets/config:
- `REVID_API_KEY` — optional, enables cross-platform viral-video search (free account tier: 20 searches per rolling 24 hours).
- `YOUTUBE_API_KEY` — optional, enables official YouTube fallback search.
- `AI_API_KEY` — optional, overrides Workers AI with an OpenAI-compatible provider.
- `CF_AI_MODEL` — optional, Workers AI model override; defaults to `@cf/google/gemma-4-26b-a4b-it`.
- `AI_BASE_URL` — optional, OpenAI-compatible API base URL, default `https://api.openai.com/v1`.
- `AI_MODEL` — optional, model name, default `gpt-4.1-mini`.

Set secrets for deployment using `wrangler secret put NAME`. Do not paste credentials into source code. Workers AI uses a Cloudflare binding and does not need a separate model API key.

## Deployment

Cloudflare deployment requires the owner's Cloudflare account, Workers permissions, API secrets, and approved configuration. Before public access, protect the app with Cloudflare Access (owner allowlist) or equivalent server-side authentication and rate limiting: otherwise the public API could consume the configured YouTube quota and AI budget. This repository intentionally does not deploy to production automatically. Review `docs/SETUP.md` before deploying.

## Data-source limitations

Revid's cross-platform index searches YouTube Shorts, Instagram Reels and TikTok, but it is not a complete census of all posts and its free tier is limited to 20 searches per rolling 24 hours. If Revid is not configured, YouTube Data API is an optional fallback; it has quotas and does not expose a definitive Shorts flag, so results are labelled as short videos rather than guaranteed Shorts.

## Privacy

Searches are sent to configured providers. Saved ideas remain in this browser only in this milestone. Do not enter sensitive personal data.
