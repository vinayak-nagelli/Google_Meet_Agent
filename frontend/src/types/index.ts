/* ── Shared TypeScript types for MeetAgent frontend ─────────────────────── */

// ── Bot / Session ────────────────────────────────────────────────────────────

export type Page = 'home' | 'deploy' | 'active' | 'memory';

export interface BotSession {
  id: number;
  meet_link: string;
  bot_name: string;
  user_name: string;
  auto_instruction: string;
  user_context: string;
  status: string;
  created_at: string;
  is_recording?: boolean;
  transcribing?: boolean;
  recording_chunks?: string[];
  recording_error?: string;
  error_message?: string;
  transcription_status?: string;
  [key: string]: any;
}

// ── Chat ─────────────────────────────────────────────────────────────────────

export interface ChatMessage {
  sender: string;
  message: string;
  timestamp: string;
  auto_reply?: boolean;
}

// ── Alerts ───────────────────────────────────────────────────────────────────

export interface Alert {
  bot_id: number;
  type: string;
  message: string;
  original_message?: string;
  sender: string;
  timestamp: string;
}

// ── Audio ────────────────────────────────────────────────────────────────────

export interface AudioFilesData {
  chunks: string[];
  cleaned_chunks: string[];
  error?: string;
}

// ── Transcript ───────────────────────────────────────────────────────────────

export interface TranscriptSegment {
  timestamp_str?: string;
  start?: string;
  text: string;
}

// ── Summary ──────────────────────────────────────────────────────────────────

export interface SummaryData {
  meeting_summary?: string;
  participant_summaries?: any[];
  key_points?: string[];
  decisions?: string[];
  action_items?: string[];
  deadlines?: string[];
  unanswered_questions?: string[];
  important_messages?: any[];
  limitations?: string[];
  error?: string;
  raw_response?: string;
}

// ── Visual / Screenshots ─────────────────────────────────────────────────────

export interface ScreenshotItem {
  file_path: string;
  filename: string;
  captured_at: string;
  change_score: string;
}

export interface VisualStatus {
  presentation_active: boolean;
  screenshots: ScreenshotItem[];
}

export interface VisionResult {
  slide_title?: string;
  main_text_blocks?: string[];
  bullet_points?: string[];
  urls?: string[];
  visible_dates?: string[];
}

export interface VisualScreenshot {
  file_path: string;
  captured_at: string;
  vision_result?: VisionResult;
  error?: string;
}

export interface VisualData {
  status: string;
  error?: string;
  processed_count: number;
  skipped_count: number;
  screenshots: VisualScreenshot[];
}

// ── Meeting Memory ───────────────────────────────────────────────────────────

export interface MeetingMemoryItem {
  bot_id: number;
  meet_link: string;
  bot_name: string;
  saved_at: string;
  summary_short?: string;
  action_items?: string[];
  deadlines?: string[];
}

export interface MeetingDetail {
  bot_id: number;
  meet_link: string;
  bot_name: string;
  meeting_title?: string;
  user_name?: string;
  created_at: string;
  ended_at?: string;
  saved_at: string;
  chat_messages: ChatMessage[];
  transcript: TranscriptSegment[];
  summary: SummaryData;
  alerts: Alert[];
  audio_chunks: string[];
  screenshot_metadata: ScreenshotItem[];
  visual_content: VisualData;
}

export interface MeetingSearchFilters {
  query: string;
  date_filter?: string;
  participant_filter?: string;
  has_deadline?: boolean;
  has_action_items?: boolean;
}
