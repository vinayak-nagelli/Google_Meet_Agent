/* ── Meeting Memory API calls ─────────────────────────────────────────────── */

import { apiGet, apiPost } from './api';
import type { MeetingMemoryItem, MeetingDetail, MeetingSearchFilters } from '../types';

export const memoryApi = {
  list: () => apiGet<{ count: number; meetings: MeetingMemoryItem[] }>('/meetings/list'),
  getDetail: (botId: number) => apiGet<MeetingDetail>(`/meetings/${botId}`),
  search: (filters: MeetingSearchFilters) =>
    apiPost<{ query: string; count: number; results: MeetingDetail[] }>('/meetings/search', filters),
};
