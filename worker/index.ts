interface Env {
  ASSETS: Fetcher;
  YOUTUBE_API_KEY?: string;
  AI_API_KEY?: string;
  AI_BASE_URL?: string;
  AI_MODEL?: string;
}
interface VideoItem {
  id: string; platform: "youtube" | "tiktok" | "instagram"; title: string; description: string;
  url: string; thumbnail?: string; creator?: string; publishedAt?: string; durationSeconds?: number;
  views?: number; likes?: number; comments?: number; sourceLabel: string; fetchedAt: string; metricNote?: string;
}
const jsonHeaders = { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" };
function json(data: unknown, status = 200) { return new Response(JSON.stringify(data), { status, headers: jsonHeaders }); }
function parseDuration(value: string): number {
  const match = value.match(/^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/);
  if (!match) return 0;
  return Number(match[1] || 0) * 3600 + Number(match[2] || 0) * 60 + Number(match[3] || 0);
}
function safeText(value: unknown, max = 3000): string { return typeof value === "string" ? value.slice(0, max) : ""; }
async function searchYouTube(query: string, key: string): Promise<VideoItem[]> {
  const params = new URLSearchParams({
    part: "snippet", type: "video", q: query, maxResults: "25",
    videoDuration: "short", order: "relevance", key
  });
  const response = await fetch(`https://www.googleapis.com/youtube/v3/search?${params.toString()}`);
  if (!response.ok) {
    const body = await response.json().catch(() => ({})) as { error?: { message?: string; errors?: { reason?: string }[] } };
    const reason = body.error?.errors?.[0]?.reason;
    if (response.status === 403) throw new Error(reason === "quotaExceeded" ? "Исчерпана суточная квота YouTube API. Попробуй позже." : "YouTube API отклонил запрос. Проверь ключ и разрешения в Google Cloud.");
    if (response.status === 400) throw new Error("YouTube API не принял запрос. Проверь настройки API-ключа.");
    throw new Error(body.error?.message || `YouTube API вернул ошибку ${response.status}.`);
  }
  const data = await response.json() as { items?: { id?: { videoId?: string }; snippet?: { title?: string; description?: string; channelTitle?: string; publishedAt?: string; thumbnails?: { high?: { url?: string }; medium?: { url?: string }; default?: { url?: string } } } };
  const ids = (data.items || []).map(item => item.id?.videoId).filter((id): id is string => Boolean(id));
  if (!ids.length) return [];
  const detailParams = new URLSearchParams({ part: "contentDetails,statistics", id: ids.join(","), key });
  const detailsResponse = await fetch(`https://www.googleapis.com/youtube/v3/videos?${detailParams.toString()}`);
  const detailData = detailsResponse.ok ? await detailsResponse.json() as { items?: { id: string; contentDetails?: { duration?: string }; statistics?: { viewCount?: string; likeCount?: string; commentCount?: string } }[] } : { items: [] };
  const detailMap = new Map((detailData.items || []).map(item => [item.id, item]));
  const fetchedAt = new Date().toISOString();
  return (data.items || []).flatMap(item => {
    const id = item.id?.videoId;
    if (!id) return [];
    const snippet = item.snippet || {};
    const detail = detailMap.get(id);
    const seconds = detail?.contentDetails?.duration ? parseDuration(detail.contentDetails.duration) : undefined;
    return [{
      id: `youtube:${id}`, platform: "youtube" as const,
      title: safeText(snippet.title, 500) || "Видео без названия",
      description: safeText(snippet.description, 3000),
      url: `https://www.youtube.com/watch?v=${id}`,
      thumbnail: snippet.thumbnails?.high?.url || snippet.thumbnails?.medium?.url || snippet.thumbnails?.default?.url,
      creator: safeText(snippet.channelTitle, 250),
      publishedAt: snippet.publishedAt,
      durationSeconds: seconds,
      views: detail?.statistics?.viewCount !== undefined ? Number(detail.statistics.viewCount) : undefined,
      likes: detail?.statistics?.likeCount !== undefined ? Number(detail.statistics.likeCount) : undefined,
      comments: detail?.statistics?.commentCount !== undefined ? Number(detail.statistics.commentCount) : undefined,
      sourceLabel: "YouTube Data API v3", fetchedAt,
      metricNote: "Поиск коротких видео YouTube; API не предоставляет достоверный отдельный флаг Shorts. Некоторые метрики могут быть скрыты автором."
    }];
  });
}
async function adapt(env: Env, payload: { video?: VideoItem; niche?: string; audience?: string; goal?: string; transcript?: string }) {
  if (!env.AI_API_KEY) return json({ error: "AI не подключён. Добавь AI_API_KEY в секреты Worker и повтори попытку." }, 503);
  const video = payload.video;
  if (!video || !video.title || !video.url) return json({ error: "Не хватает данных о выбранном ролике." }, 400);
  const base = (env.AI_BASE_URL || "https://api.openai.com/v1").replace(/\/$/, "");
  const prompt = [
    "Ты — редактор коротких вертикальных видео. Проанализируй только предоставленные метаданные и текст. Не утверждай, что видел видео, если дан только заголовок/описание. Не выдумывай просмотры или причины популярности.",
    "Перенеси общую механику, но не копируй уникальные фразы. Создай оригинальный сценарий.",
    `Тема/ниша пользователя: ${safeText(payload.niche, 500) || "не указана"}`,
    `Целевая аудитория: ${safeText(payload.audience, 300) || "не указана"}`,
    `Цель: ${safeText(payload.goal, 200) || "охваты и сохранения"}`,
    `Название: ${safeText(video.title, 500)}`,
    `Описание: ${safeText(video.description, 2500)}`,
    `Платформа: ${video.platform}; дата: ${video.publishedAt || "неизвестна"}; длительность: ${video.durationSeconds ?? "неизвестна"} сек; доступные метрики: просмотры ${video.views ?? "нет данных"}, лайки ${video.likes ?? "нет данных"}, комментарии ${video.comments ?? "нет данных"}.`,
    `Транскрипт, предоставленный пользователем (если есть): ${safeText(payload.transcript, 5000) || "не предоставлен"}`,
    "Ответь строго JSON с ключами: title (string), hook (string), structure (array of 3-6 strings), script (string with shot/voiceover directions), variations (array of 3 hooks), whyItMayWork (array of 2-4 cautious reasons), disclaimer (string explaining limitations). На русском. Будь конкретным и естественным."
  ].join("\n\n");
  const response = await fetch(`${base}/chat/completions`, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${env.AI_API_KEY}` },
    body: JSON.stringify({ model: env.AI_MODEL || "gpt-4.1-mini", temperature: 0.7, response_format: { type: "json_object" }, messages: [{ role: "system", content: "Верни валидный JSON без Markdown-обрамления." }, { role: "user", content: prompt }] })
  });
  if (!response.ok) {
    const errorBody = await response.text().catch(() => "");
    return json({ error: response.status === 429 ? "Лимит AI-провайдера исчерпан. Попробуй позже." : `AI-провайдер вернул ошибку ${response.status}. Проверь endpoint, модель и ключ. ${errorBody.slice(0, 160)}` }, 502);
  }
  const result = await response.json() as { choices?: { message?: { content?: string } }[] };
  const content = result.choices?.[0]?.message?.content;
  if (!content) return json({ error: "AI-провайдер вернул пустой ответ." }, 502);
  try {
    const parsed = JSON.parse(content);
    if (!Array.isArray(parsed.structure) || !Array.isArray(parsed.variations) || !Array.isArray(parsed.whyItMayWork)) throw new Error("invalid schema");
    return json(parsed);
  } catch {
    return json({ error: "AI-провайдер вернул ответ в неожиданном формате. Попробуй ещё раз." }, 502);
  }
}
export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname === "/api/health") {
      return json({ ok: true, app: "TrendLab AI", version: "0.1.0", sources: {
        youtube: { available: Boolean(env.YOUTUBE_API_KEY), message: env.YOUTUBE_API_KEY ? "YouTube Data API настроен" : "Нужен YOUTUBE_API_KEY" },
        tiktok: { available: false, message: "Не подключён: нужен одобренный/проверенный провайдер" },
        instagram: { available: false, message: "Не подключён: нужен одобренный/проверенный провайдер" },
        ai: { available: Boolean(env.AI_API_KEY), message: env.AI_API_KEY ? "AI настроен" : "Нужен AI_API_KEY для генерации сценариев" }
      } });
    }
    if (url.pathname === "/api/search" && request.method === "GET") {
      const query = safeText(url.searchParams.get("q"), 200).trim();
      const platforms = (url.searchParams.get("platforms") || "youtube,tiktok,instagram").split(",").filter(p => ["youtube", "tiktok", "instagram"].includes(p));
      if (query.length < 2) return json({ error: "Введи тему длиной минимум 2 символа." }, 400);
      if (!platforms.length) return json({ error: "Выбери хотя бы один источник." }, 400);
      const sourceStatus = {
        youtube: { available: Boolean(env.YOUTUBE_API_KEY), message: env.YOUTUBE_API_KEY ? "YouTube Data API настроен" : "Нужен YOUTUBE_API_KEY" },
        tiktok: { available: false, message: "Не подключён: нужен одобренный/проверенный провайдер" },
        instagram: { available: false, message: "Не подключён: нужен одобренный/проверенный провайдер" }
      };
      const items: VideoItem[] = [];
      const errors: string[] = [];
      if (platforms.includes("youtube")) {
        if (env.YOUTUBE_API_KEY) {
          try { items.push(...await searchYouTube(query, env.YOUTUBE_API_KEY)); sourceStatus.youtube.message = "Данные получены через YouTube Data API v3"; }
          catch (error) { errors.push(error instanceof Error ? error.message : "Ошибка YouTube API"); sourceStatus.youtube.message = "Ошибка запроса — см. сообщение"; }
        } else {
          sourceStatus.youtube.message = "Источник выбран, но не настроен: добавь YOUTUBE_API_KEY";
        }
      }
      const unavailable = platforms.filter(p => p !== "youtube").map(p => p === "tiktok" ? "TikTok пока не подключён" : "Instagram пока не подключён");
      const noticeParts = [
        !env.YOUTUBE_API_KEY && platforms.includes("youtube") ? "YouTube не подключён: нужен ключ YouTube Data API." : "",
        ...unavailable,
        ...errors
      ].filter(Boolean);
      return json({
        items,
        sourceStatus,
        query,
        fetchedAt: new Date().toISOString(),
        notice: items.length ? `Результаты получены из YouTube Data API. ${noticeParts.join(" · ")}` : noticeParts.join(" ") || "Источники не вернули видео. Проверь настройки и попробуй другую тему."
      });
    }
    if (url.pathname === "/api/adapt" && request.method === "POST") {
      let payload: { video?: VideoItem; niche?: string; audience?: string; goal?: string; transcript?: string };
      try { payload = await request.json() as typeof payload; } catch { return json({ error: "Тело запроса должно быть корректным JSON." }, 400); }
      return adapt(env, payload);
    }
    if (url.pathname.startsWith("/api/")) return json({ error: "API endpoint не найден." }, 404);
    if (env.ASSETS) return env.ASSETS.fetch(request);
    return new Response("TrendLab AI assets are not configured.", { status: 503 });
  }
};