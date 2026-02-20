export interface Video {
  video_id: string;
  title: string;
  video_url?: string;
  thumbnail_url?: string;
  description?: string;
  save_mode?: 'link_only' | 'full_transcript';
  created_at?: string;
}

export interface Highlight {
  id: string;
  video_id: string;
  video_title?: string;
  text: string;
  note?: string;
  timestamp: number;
  created_at?: string;
}

export interface Session {
  id: string;
  date: string;
  focus_score: number;
  videos_watched: number;
  highlights_count: number;
}

export interface Summary {
  video_id: string;
  title: string;
  summary: string;
  summary_preset?: string;
  created_at?: string;
}

export interface ChatMessage {
  id: string;
  type: 'user' | 'bot';
  text: string;
  isLoading?: boolean;
  sources?: SourceCard[];
}

export interface SourceCard {
  video_id: string;
  title: string;
  thumbnail_url?: string;
  highlights?: Highlight[];
  summary?: string;
}

export interface ChatContext {
  video: Video | null;
}
