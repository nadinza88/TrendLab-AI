# TrendLab AI — архитектура

## Текущая реализация
- Frontend: React, TypeScript, Vite, responsive CSS.
- API: Cloudflare Worker.
- Видео-адаптер: Revid Viral Video Search для YouTube Shorts, Instagram Reels и TikTok; официальный YouTube Data API v3 — резервный источник.
- AI-адаптер: Cloudflare Workers AI по умолчанию; OpenAI-compatible `/chat/completions` — необязательный резервный провайдер.
- Сохранённое и история: localStorage текущего браузера.
- Хостинг-конфигурация: Wrangler assets + Worker.

## API
- `GET /api/health`: статус подключения источников и AI без раскрытия секретов.
- `GET /api/search?q=...&platforms=...`: нормализованные результаты, статусы источников, время получения и ограничения.
- `POST /api/adapt`: адаптация метаданных/предоставленного транскрипта в JSON-сценарий.

## Секреты
`REVID_API_KEY`, `YOUTUBE_API_KEY`, `AI_API_KEY`, `AI_BASE_URL`, `AI_MODEL`; `CF_AI_MODEL` — необязательная переменная выбора модели Workers AI. Секреты хранятся в Worker secrets или локальном `.dev.vars`, никогда не в frontend bundle или Git.

## Источники
Revid Viral Video Search выполняет поиск по YouTube Shorts, Instagram Reels и TikTok; бесплатный аккаунт ограничен 20 поисками за скользящие 24 часа, поиск не расходует кредиты. Нормализованный адаптер сохраняет оригинальные URL, доступные метрики, хук и транскрипт, если провайдер их вернул. YouTube Data API v3 используется как резерв. TikTok Research API не считать общедоступным коммерческим API.

## Ограничения текущего milestone
- Revid cross-platform search requires `REVID_API_KEY`; YouTube fallback requires `YOUTUBE_API_KEY`.
- Нет D1, аккаунтов, синхронизации между устройствами, кеширования или отдельного бюджетного биллинга.
- YouTube API не подтверждает принадлежность каждого результата к Shorts.
- AI анализирует только полученные метаданные и доступный источник-транскрипт/текст, а не утверждает, что просмотрел ролик, если видеофайл не передавался модели.
- Workers AI имеет бесплатную дневную квоту 10 000 neurons на аккаунт; после её исчерпания запросы могут завершаться ошибкой.

## Следующие технические этапы
1. Локально установить зависимости и пройти CI/typecheck/build.
2. Получить ключ YouTube Data API и проверить реальные результаты, метрики и квоты.
3. Проверить выбранный AI endpoint и формат ответа.
4. Отдельно провести provider spike для TikTok/Instagram и только затем выбрать интеграцию.
5. После одобрения владельца настроить Cloudflare secrets и выполнить production deployment.
6. При подтверждённой потребности добавить D1 и синхронизацию сохранённых идей.
