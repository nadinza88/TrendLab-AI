# Development rules for TrendLab AI

1. Read README.md and docs/ before changing architecture.
2. Do not replace real results with mock results in the product UI.
3. Never invent video metrics, transcript, source status, popularity or trend explanations.
4. Never commit credentials, tokens, local .dev.vars, or user data.
5. Keep source integrations behind adapters and report unavailable platforms honestly.
6. Do not scrape around login, CAPTCHA, or platform restrictions.
7. No paid provider, paid deployment, public access changes, or production deploy without owner approval.
8. Run typecheck and build after changes; fix CI failures before declaring completion.
9. Keep user-visible errors actionable and in Russian.
10. Save progress in the repository, not only in conversation. Do not claim a feature is finished unless tested.
