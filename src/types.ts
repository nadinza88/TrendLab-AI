export type Platform = "youtube" | "tiktok" | "instagram";

export interface VideoItem {
  id: string;
  platform: Platform;
  title: string;
  description: string;
  url: string;
  thumbnail?: string;
  creator?: string;
  publishedAt?: string;
  durationSeconds?: number;
  views?: number;
  likes?: number;
  comments?: number;
  sourceLabel: string;
  fetchedAt: string;
  metricNote?: string;
}

export interface SearchResponse {
  items: VideoItem[];
  sourceStatus: Record<Platform, { available: boolean; message: string }>;
  fetchedAt: string;
  query: string;
  notice?: string;
}

export interface AdaptResponse {
  title: string;
  hook: string;
  structure: string[];
  script: string;
  variations: string[];
  whyItMayWork: string[];
  disclaimer: string;
}

export interface SavedIdea {
  id: string;
  savedAt: string;
  video: VideoItem;
  adaptation?: AdaptResponse;
}