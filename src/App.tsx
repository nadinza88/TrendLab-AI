import { useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import {
  ArrowDownWideNarrow, ArrowUpRight, Bookmark, Check, ChevronDown,
  CircleHelp, ExternalLink, Filter, Flame, Heart, History,
  Instagram, LoaderCircle, Play, Search, Settings2, Sparkles, Trash2,
  TrendingUp, Youtube, Zap
} from "lucide-react";
import type { AdaptResponse, Platform, SavedIdea, SearchResponse, VideoItem } from "./types";

const savedKey = "trendlab.saved.v1";
const historyKey = "trendlab.history.v1";

function readSaved(): SavedIdea[] {
  try { return JSON.parse(localStorage.getItem(savedKey) || "[]") as SavedIdea[]; }
  catch { return []; }
}
function formatNumber(value?: number) {
  if (value === undefined || !Number.isFinite(value)) return "—";
  return new Intl.NumberFormat("ru-RU", { notation: value >= 10000 ? "compact" : "standard", maximumFractionDigits: 1 }).format(value);
}
function formatDate(value?: string) {
  if (!value) return "Дата не указана";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Дата не указана" : new Intl.DateTimeFormat("ru-RU", { day: "numeric", month: "short", year: "numeric" }).format(date);
}
function duration(value?: number) {
  if (value === undefined) return "длительность —";
  return value < 60 ? `${value} сек` : `${Math.floor(value / 60)}:${String(value % 60).padStart(2, "0")}`;
}
function platformName(platform: Platform) {
  return platform === "youtube" ? "YouTube" : platform === "tiktok" ? "TikTok" : "Instagram";
}
function platformIcon(platform: Platform) {
  if (platform === "youtube") return <Youtube size={15} />;
  if (platform === "tiktok") return <Play size={15} />;
  return <Instagram size={15} />;
}
const defaultStatus: SearchResponse["sourceStatus"] = {
  youtube: { available: false, message: "Нужен ключ YouTube Data API" },
  tiktok: { available: false, message: "Нужен проверенный провайдер и доступ" },
  instagram: { available: false, message: "Нужен проверенный провайдер и доступ" }
};

export default function App() {
  const [query, setQuery] = useState("");
  const [audience, setAudience] = useState("Женщины 30–45 лет");
  const [niche, setNiche] = useState("Образование, коммуникация, повседневная жизнь");
  const [goal, setGoal] = useState("Охваты и сохранения");
  const [transcript, setTranscript] = useState("");
  const [selectedPlatforms, setSelectedPlatforms] = useState<Platform[]>(["youtube", "tiktok", "instagram"]);
  const [results, setResults] = useState<VideoItem[]>([]);
  const [status, setStatus] = useState(defaultStatus);
  const [notice, setNotice] = useState("Подключи источник данных, чтобы получать настоящие ролики и метрики. Демонстрационных результатов здесь нет.");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [sort, setSort] = useState("relevance");
  const [period, setPeriod] = useState("any");
  const [activeTab, setActiveTab] = useState<"discover" | "saved">("discover");
  const [saved, setSaved] = useState<SavedIdea[]>(readSaved);
  const [history, setHistory] = useState<string[]>(() => {
    try { return JSON.parse(localStorage.getItem(historyKey) || "[]") as string[]; } catch { return []; }
  });
  const [activeVideo, setActiveVideo] = useState<VideoItem | null>(null);
  const [adaptBusy, setAdaptBusy] = useState(false);
  const [adaptation, setAdaptation] = useState<AdaptResponse | null>(null);
  const [showSettings, setShowSettings] = useState(false);

  useEffect(() => { localStorage.setItem(savedKey, JSON.stringify(saved)); }, [saved]);
  useEffect(() => { localStorage.setItem(historyKey, JSON.stringify(history.slice(0, 8))); }, [history]);

  const sortedResults = useMemo(() => {
    let list = [...results];
    if (period !== "any") {
      const days = Number(period);
      list = list.filter(v => v.publishedAt && Date.now() - new Date(v.publishedAt).getTime() <= days * 86400000);
    }
    if (sort === "views") list.sort((a, b) => (b.views ?? -1) - (a.views ?? -1));
    if (sort === "likes") list.sort((a, b) => (b.likes ?? -1) - (a.likes ?? -1));
    if (sort === "newest") list.sort((a, b) => Date.parse(b.publishedAt || "") - Date.parse(a.publishedAt || ""));
    return list;
  }, [results, sort, period]);

  const isSaved = (video: VideoItem) => saved.some(item => item.video.id === video.id);
  function toggleSaved(video: VideoItem) {
    setSaved(current => current.some(item => item.video.id === video.id)
      ? current.filter(item => item.video.id !== video.id)
      : [{ id: video.id, savedAt: new Date().toISOString(), video, ...(activeVideo?.id === video.id && adaptation ? { adaptation } : {}) }, ...current]);
  }
  async function searchVideos(event?: FormEvent) {
    event?.preventDefault();
    const term = query.trim();
    if (!term) { setError("Введи тему или ключевые слова для поиска."); return; }
    setBusy(true); setError(""); setNotice("");
    setActiveTab("discover"); setActiveVideo(null); setAdaptation(null);
    setHistory(current => [term, ...current.filter(item => item !== term)].slice(0, 8));
    try {
      const params = new URLSearchParams({ q: term, platforms: selectedPlatforms.join(",") });
      const response = await fetch(`/api/search?${params.toString()}`);
      const data = await response.json() as SearchResponse & { error?: string };
      if (!response.ok) throw new Error(data.error || "Поиск не удался.");
      setResults(data.items || []);
      setStatus(data.sourceStatus || defaultStatus);
      setNotice(data.notice || "");
      if (!(data.items || []).length) setNotice(data.notice || "Источники не вернули результатов. Проверь доступ и настройки API.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Не удалось выполнить поиск.");
      setResults([]);
    } finally { setBusy(false); }
  }
  async function adaptVideo(video: VideoItem) {
    setActiveVideo(video); setAdaptation(null); setAdaptBusy(true); setError("");
    try {
      const response = await fetch("/api/adapt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ video, niche, audience, goal, transcript })
      });
      const data = await response.json() as AdaptResponse & { error?: string };
      if (!response.ok) throw new Error(data.error || "Не удалось подготовить сценарий.");
      setAdaptation(data);
    } catch (e) { setError(e instanceof Error ? e.message : "Ошибка генерации."); }
    finally { setAdaptBusy(false); }
  }
  function togglePlatform(platform: Platform) {
    setSelectedPlatforms(current => current.includes(platform)
      ? current.filter(item => item !== platform)
      : [...current, platform]);
  }
  function openSaved(item: SavedIdea) {
    setActiveVideo(item.video);
    setAdaptation(item.adaptation || null);
    setActiveTab("discover");
  }
  function copyText(text: string) {
    if (!navigator.clipboard) { setNotice("Буфер обмена недоступен в этом браузере — выдели текст вручную."); return; }
    void navigator.clipboard.writeText(text).then(() => setNotice("Скопировано в буфер обмена.")).catch(() => setNotice("Не удалось скопировать автоматически — выдели текст вручную."));
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <a className="brand" href="#" aria-label="TrendLab AI">
          <span className="brand-mark"><Sparkles size={21} /></span>
          <span><strong>TrendLab</strong><small>AI CREATOR STUDIO</small></span>
        </a>
        <div className="workspace-label">РАБОЧЕЕ ПРОСТРАНСТВО</div>
        <button className={activeTab === "discover" ? "nav-item active" : "nav-item"} onClick={() => setActiveTab("discover")}><Search size={18} /> Поиск видео</button>
        <button className={activeTab === "saved" ? "nav-item active" : "nav-item"} onClick={() => setActiveTab("saved")}><Bookmark size={18} /> Сохранённое <span className="nav-count">{saved.length}</span></button>
        <button className="nav-item" onClick={() => setShowSettings(v => !v)}><Settings2 size={18} /> Настройки источников</button>
        <div className="sidebar-bottom">
          <div className="sidebar-tip"><div className="tip-icon"><Zap size={16} /></div><strong>Не копируй ролик — изучай механику</strong><p>Сохраняй сильный хук, ритм и структуру. Смысл и формулировки делай своими.</p></div>
          <div className="profile"><div className="avatar">TL</div><div><strong>Моя лаборатория</strong><small>Личный проект</small></div><span className="online-dot" /></div>
        </div>
      </aside>

      <main className="main-area">
        <header className="topbar">
          <div className="breadcrumb">Студия <span>/</span> <b>{activeTab === "saved" ? "Сохранённое" : "Исследование видео"}</b></div>
          <div className="topbar-right"><span className="private-label"><span className="green-dot" /> Личное пространство</span><button className="icon-button" title="Подсказка" onClick={() => setNotice("Поиск использует только подключённые источники. Метрики показываются лишь тогда, когда их вернул источник.")}><CircleHelp size={18} /></button></div>
        </header>

        {activeTab === "discover" ? <>
          <section className="hero">
            <div className="hero-copy">
              <div className="eyebrow"><span className="eyebrow-dot" /> VIDEO INTELLIGENCE</div>
              <h1>Найди формат.<br /><span>Создай свой.</span></h1>
              <p className="hero-subtitle">Исследуй короткие видео, замечай закономерности и превращай удачные механики в оригинальные идеи для своего контента.</p>
            </div>
            <div className="hero-art" aria-hidden="true">
              <div className="orbit orbit-one" /><div className="orbit orbit-two" />
              <div className="art-glow" /><div className="art-core"><Flame size={42} strokeWidth={1.4} /></div>
              <div className="floating-chip chip-a"><TrendingUp size={14} /> Форматы</div>
              <div className="floating-chip chip-b"><Sparkles size={14} /> Идеи</div>
              <div className="floating-chip chip-c"><Play size={13} /> Shorts</div>
            </div>
          </section>

          <section className="search-panel">
            <div className="section-kicker">01 / ПОИСК ИССЛЕДОВАНИЯ</div>
            <form onSubmit={searchVideos}>
              <label className="field-label" htmlFor="topic">Что хочешь найти?</label>
              <div className="search-input-wrap"><Search size={20} /><input id="topic" value={query} onChange={e => setQuery(e.target.value)} placeholder="Например: смешные ситуации с детьми, привычки, нейросети…" /><button className="search-button" type="submit" disabled={busy}>{busy ? <LoaderCircle className="spin" size={17} /> : <Search size={17} />} {busy ? "Ищу…" : "Найти видео"}</button></div>
            </form>
            <div className="search-bottom">
              <div className="platform-picker">
                <span className="mini-label">ИСТОЧНИКИ</span>
                {(["youtube", "tiktok", "instagram"] as Platform[]).map(platform => <button key={platform} type="button" className={selectedPlatforms.includes(platform) ? "platform-toggle selected" : "platform-toggle"} onClick={() => togglePlatform(platform)}>{platformIcon(platform)} {platformName(platform)} {selectedPlatforms.includes(platform) && <Check size={12} />}</button>)}
              </div>
              <button className="text-button" type="button" onClick={() => setShowSettings(v => !v)}><Settings2 size={15} /> Источники и доступ <ChevronDown size={14} className={showSettings ? "rotate" : ""} /></button>
            </div>
            {showSettings && <div className="source-status-grid">{(["youtube", "tiktok", "instagram"] as Platform[]).map(p => <div className="source-status" key={p}><div className="source-status-title">{platformIcon(p)} {platformName(p)} <span className={status[p].available ? "status-dot ready" : "status-dot"} /></div><p>{status[p].message}</p></div>)}</div>}
            {history.length > 0 && <div className="recent-searches"><History size={14} /><span>Недавние:</span>{history.slice(0, 4).map(term => <button key={term} onClick={() => setQuery(term)}>{term}</button>)}</div>}
          </section>

          <section className="results-section">
            <div className="results-heading"><div><div className="section-kicker">02 / РЕЗУЛЬТАТЫ</div><h2>{results.length ? "Видео для исследования" : "Твоя следующая идея начинается здесь"}</h2><p>{results.length ? `Найдено ${results.length} роликов · данные от источника` : "Задай тему выше, чтобы найти реальные видео. Пока источники не подключены, мы не показываем выдуманные примеры."}</p></div>
              {results.length > 0 && <div className="filters"><label><Filter size={15} /><select aria-label="Период" value={period} onChange={e => setPeriod(e.target.value)}><option value="any">Любой период</option><option value="7">За 7 дней</option><option value="30">За 30 дней</option><option value="90">За 3 месяца</option></select></label><label><ArrowDownWideNarrow size={15} /><select aria-label="Сортировка" value={sort} onChange={e => setSort(e.target.value)}><option value="relevance">По релевантности</option><option value="views">По просмотрам</option><option value="likes">По лайкам</option><option value="newest">Сначала новые</option></select></label></div>}
            </div>
            {error && <div className="error-banner">{error}</div>}
            {notice && <div className="notice-banner"><CircleHelp size={17} /><span>{notice}</span></div>}
            {sortedResults.length > 0 ? <div className="video-grid">{sortedResults.map((video, index) => <VideoCard key={video.id} video={video} index={index} saved={isSaved(video)} onSave={() => toggleSaved(video)} onAnalyze={() => void adaptVideo(video)} />)}</div> : <div className="empty-state"><div className="empty-visual"><div className="empty-orb"><Search size={28} /></div><span className="spark spark-1">✳</span><span className="spark spark-2">✦</span><span className="spark spark-3">✧</span></div><strong>{busy ? "Ищем доступные видео…" : "Готова исследовать?"}</strong><p>{busy ? "Запрашиваем подключённые источники. Это может занять несколько секунд." : "Введи тему и нажми «Найти видео». Результаты появятся здесь, если источник настроен и вернул данные."}</p>{!busy && <div className="empty-steps"><span><i>1</i> Выбери тему</span><span><i>2</i> Найди ролик</span><span><i>3</i> Создай сценарий</span></div>}</div>}
          </section>
        </> : <section className="saved-page"><div className="section-kicker">ТВОЯ БИБЛИОТЕКА</div><h1>Сохранённые идеи<span>.</span></h1><p className="page-intro">Ролики и сценарии, к которым хочется вернуться.</p>{saved.length ? <div className="saved-list">{saved.map(item => <div className="saved-row" key={item.id}><img src={item.video.thumbnail || ""} alt="" /><div className="saved-row-main"><span className="platform-badge">{platformIcon(item.video.platform)} {platformName(item.video.platform)}</span><strong>{item.video.title}</strong><small>Сохранено {formatDate(item.savedAt)}</small></div><button className="secondary-button" onClick={() => openSaved(item)}>Открыть <ArrowUpRight size={15} /></button><button className="icon-button danger" title="Удалить" onClick={() => setSaved(current => current.filter(s => s.id !== item.id))}><Trash2 size={16} /></button></div>)}</div> : <div className="empty-state saved-empty"><div className="empty-visual"><div className="empty-orb"><Bookmark size={27} /></div></div><strong>Здесь будут твои находки</strong><p>Нажми на закладку в карточке ролика, чтобы сохранить его в этой библиотеке на устройстве.</p><button className="search-button" onClick={() => setActiveTab("discover")}>Вернуться к поиску</button></div>}</section>}

        {activeVideo && activeTab === "discover" && <section className="analysis-panel" id="analysis">
          <div className="analysis-header"><div><div className="section-kicker">03 / РАЗБОР И АДАПТАЦИЯ</div><h2>Преврати механику в свою идею</h2><p>AI опирается только на доступные метаданные и текст, который ты предоставишь.</p></div><button className="icon-button" onClick={() => { setActiveVideo(null); setAdaptation(null); }} title="Закрыть разбор">×</button></div>
          <div className="selected-video"><div className="selected-thumb">{activeVideo.thumbnail ? <img src={activeVideo.thumbnail} alt="" /> : <div className="thumb-placeholder"><Play size={22} /></div>}</div><div className="selected-details"><span className="platform-badge">{platformIcon(activeVideo.platform)} {platformName(activeVideo.platform)}</span><strong>{activeVideo.title}</strong><small>{activeVideo.creator || "Автор не указан"} · {duration(activeVideo.durationSeconds)} · {formatDate(activeVideo.publishedAt)}</small><a href={activeVideo.url} target="_blank" rel="noreferrer">Открыть оригинал <ExternalLink size={13} /></a></div></div>
          <div className="adapt-inputs"><label><span>Твоя ниша</span><input value={niche} onChange={e => setNiche(e.target.value)} /></label><label><span>Аудитория</span><input value={audience} onChange={e => setAudience(e.target.value)} /></label><label><span>Цель ролика</span><select value={goal} onChange={e => setGoal(e.target.value)}><option>Охваты и сохранения</option><option>Комментарии и обсуждение</option><option>Подписки</option><option>Продажа продукта</option><option>Обучение и польза</option></select></label></div><label className="transcript-field"><span>Транскрипт или описание сцен (необязательно)</span><textarea value={transcript} onChange={e => setTranscript(e.target.value)} placeholder="Вставь расшифровку речи или кратко опиши, что происходит в ролике. Тогда разбор будет точнее." rows={3} /></label>
          <div className="analysis-actions"><button className="search-button" onClick={() => void adaptVideo(activeVideo)} disabled={adaptBusy}>{adaptBusy ? <LoaderCircle className="spin" size={17} /> : <Sparkles size={17} />}{adaptBusy ? "Создаю варианты…" : "Разобрать и адаптировать"}</button><button className={isSaved(activeVideo) ? "secondary-button saved-action" : "secondary-button"} onClick={() => toggleSaved(activeVideo)}>{isSaved(activeVideo) ? <Check size={16} /> : <Bookmark size={16} />}{isSaved(activeVideo) ? "Сохранено" : "Сохранить ролик"}</button></div>
          {adaptation && <div className="adapt-result"><div className="adapt-title-row"><div><span className="result-tag"><Sparkles size={12} /> AI-АДАПТАЦИЯ</span><h3>{adaptation.title}</h3></div><button className="secondary-button" onClick={() => copyText(`${adaptation.title}\n\nХук: ${adaptation.hook}\n\nСтруктура:\n${adaptation.structure.map((s, i) => `${i + 1}. ${s}`).join("\n")}\n\nСценарий:\n${adaptation.script}\n\nВарианты:\n${adaptation.variations.join("\n")}`)}>Скопировать всё</button></div>
            <div className="adapt-columns"><div className="adapt-block highlight-block"><span className="block-label">ПЕРВЫЕ СЕКУНДЫ / ХУК</span><p className="hook-text">{adaptation.hook}</p></div><div className="adapt-block"><span className="block-label">СТРУКТУРА ФОРМАТА</span><ol>{adaptation.structure.map((item, i) => <li key={i}>{item}</li>)}</ol></div></div>
            <div className="adapt-block script-block"><span className="block-label">ТВОЙ СЦЕНАРИЙ</span><p>{adaptation.script}</p></div>
            <div className="adapt-block"><span className="block-label">ЕЩЁ ВАРИАНТЫ ХУКА</span><div className="variation-list">{adaptation.variations.map((item, i) => <button key={i} onClick={() => copyText(item)}><span>{item}</span><ArrowUpRight size={14} /></button>)}</div></div>
            <div className="why-block"><strong><Heart size={15} /> Почему это может сработать</strong><ul>{adaptation.whyItMayWork.map((item, i) => <li key={i}>{item}</li>)}</ul></div>
            <p className="disclaimer">{adaptation.disclaimer}</p>
            <button className="secondary-button" onClick={() => setSaved(current => current.map(item => item.video.id === activeVideo.id ? { ...item, adaptation } : item))}><Check size={15} /> Обновить сохранённую версию</button>
          </div>}
          {error && <div className="error-banner">{error}</div>}
        </section>}
        <footer className="footer"><span>TrendLab AI <span className="footer-dot">·</span> Исследуй механику, создавай оригинальное</span><span>Метрики — только от источников. Без выдуманных данных.</span></footer>
      </main>
    </div>
  );
}

function VideoCard({ video, index, saved, onSave, onAnalyze }: { video: VideoItem; index: number; saved: boolean; onSave: () => void; onAnalyze: () => void }) {
  return <article className="video-card">
    <div className="video-thumb-wrap">
      {video.thumbnail ? <img className="video-thumb" src={video.thumbnail} alt="" loading="lazy" /> : <div className="thumb-placeholder"><Play size={24} /></div>}
      <span className="video-index">{String(index + 1).padStart(2, "0")}</span><span className="duration-chip">{duration(video.durationSeconds)}</span>
      <button className={saved ? "save-fab is-saved" : "save-fab"} onClick={onSave} title={saved ? "Убрать из сохранённого" : "Сохранить"}><Bookmark size={16} fill={saved ? "currentColor" : "none"} /></button>
      <a className="open-video-fab" href={video.url} target="_blank" rel="noreferrer" aria-label="Открыть оригинал"><ExternalLink size={15} /></a>
    </div>
    <div className="video-card-body">
      <div className="video-card-meta"><span className="platform-badge">{platformIcon(video.platform)} {platformName(video.platform)}</span><span>{formatDate(video.publishedAt)}</span></div>
      <h3>{video.title}</h3><p className="creator">{video.creator || "Автор не указан"}</p>
      <div className="metrics"><div><Play size={14} /><strong>{formatNumber(video.views)}</strong><small>просмотры</small></div><div><Heart size={14} /><strong>{formatNumber(video.likes)}</strong><small>лайки</small></div><div><span className="comment-glyph">▤</span><strong>{formatNumber(video.comments)}</strong><small>комменты</small></div></div>
      {video.metricNote && <p className="metric-note">{video.metricNote}</p>}
      <button className="analyze-button" onClick={onAnalyze}><Sparkles size={15} /> Разобрать формат <ArrowUpRight size={15} /></button>
    </div>
  </article>;
}