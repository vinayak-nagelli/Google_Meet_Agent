/* ── Bot API calls ────────────────────────────────────────────────────────── */

import { apiGet, apiPost, BACKEND_URL } from './api';
import type { BotSession } from '../types';

export interface DeployPayload {
  meet_link: string;
  bot_name: string;
  user_name?: string;
  auto_instruction?: string;
  user_context?: string;
}

export const botApi = {
  deploy: (data: DeployPayload) => apiPost<BotSession>('/bot/deploy', data),
  getStatus: (id: number) => apiGet<BotSession>(`/bot/status/${id}`),
  stop: (id: number) => apiPost(`/bot/${id}/stop`),
  getChat: (id: number) => apiGet(`/bot/${id}/chat`),
  getAlerts: (id: number) => apiGet(`/bot/${id}/alerts`),
  sendMessage: (id: number, message: string) =>
    apiPost(`/bot/${id}/send-message`, { message }),
  getAudioFiles: (id: number) => apiGet(`/bot/${id}/audio-files`),
  getTranscript: (id: number) => apiGet(`/bot/${id}/transcript`),
  generateSummary: (id: number) => apiPost(`/bot/${id}/generate-summary`),
  getScreenshots: (id: number) => apiGet(`/bot/${id}/screenshots`),
  getVisualContent: (id: number) => apiGet(`/bot/${id}/visual-content`),
  processVisualContent: (id: number) => apiPost(`/bot/${id}/process-visual-content`),
  saveMemory: (id: number) => apiPost(`/bot/${id}/save-memory`),
};
