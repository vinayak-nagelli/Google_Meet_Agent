/* ── Central meeting session hook ──────────────────────────────────────────
   Manages all live session state and polling.
   Components read from this hook — they never call fetch() directly.
   IMPORTANT: Form state (DeployForm inputs) is NOT managed here
   to prevent the input focus-loss bug.
─────────────────────────────────────────────────────────────────────────── */

import { useState, useEffect, useCallback } from 'react';
import { botApi } from '../services/botApi';
import type {
  BotSession, ChatMessage, Alert, AudioFilesData,
  TranscriptSegment, SummaryData, VisualStatus, VisualData
} from '../types';

interface MeetingSessionState {
  session: BotSession | null;
  chats: ChatMessage[];
  alerts: Alert[];
  audioFiles: AudioFilesData;
  transcript: TranscriptSegment[];
  summary: SummaryData | null;
  summaryLoading: boolean;
  visualStatus: VisualStatus;
  visualData: VisualData;
  isExtracting: boolean;
}

const INITIAL_STATE: MeetingSessionState = {
  session: null,
  chats: [],
  alerts: [],
  audioFiles: { chunks: [], cleaned_chunks: [] },
  transcript: [],
  summary: null,
  summaryLoading: false,
  visualStatus: { presentation_active: false, screenshots: [] },
  visualData: { status: 'not_started', processed_count: 0, skipped_count: 0, screenshots: [] },
  isExtracting: false,
};

export function useMeetingSession() {
  const [state, setState] = useState<MeetingSessionState>(INITIAL_STATE);
  const [toast, setToast] = useState('');

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(''), 4000);
  }, []);

  // ── Polling ──────────────────────────────────────────────────────────────

  const poll = useCallback(async () => {
    if (!state.session) return;
    const id = state.session.id;
    try {
      const [statusRes, chats, alerts, audio, transcriptRes, visual, visualArt] = await Promise.all([
        fetch(`http://localhost:8000/bot/status/${id}`).then(r => r.ok ? r.json() : null),
        fetch(`http://localhost:8000/bot/${id}/chat`).then(r => r.ok ? r.json() : []),
        fetch(`http://localhost:8000/bot/${id}/alerts`).then(r => r.ok ? r.json() : []),
        fetch(`http://localhost:8000/bot/${id}/audio-files`).then(r => r.ok ? r.json() : { chunks: [], cleaned_chunks: [] }),
        fetch(`http://localhost:8000/bot/${id}/transcript`).then(r => r.ok ? r.json() : { segments: [] }),
        fetch(`http://localhost:8000/bot/${id}/screenshots`).then(r => r.ok ? r.json() : { presentation_active: false, screenshots: [] }),
        fetch(`http://localhost:8000/bot/${id}/visual-content`).then(r => r.ok ? r.json() : { status: 'not_started', processed_count: 0, skipped_count: 0, screenshots: [] }),
      ]);

      setState(prev => ({
        ...prev,
        session: statusRes ? { ...prev.session!, ...statusRes } : prev.session,
        chats,
        alerts,
        audioFiles: audio,
        transcript: transcriptRes.segments || [],
        visualStatus: { presentation_active: visual.presentation_active, screenshots: visual.screenshots || [] },
        visualData: visualArt,
        isExtracting: visualArt.status === 'processing',
      }));
    } catch {}
  }, [state.session?.id]);

  useEffect(() => {
    if (!state.session) return;
    const iv = setInterval(poll, 3000);
    poll();
    return () => clearInterval(iv);
  }, [poll]);

  // ── Actions ──────────────────────────────────────────────────────────────

  const deploy = useCallback((session: BotSession) => {
    setState({ ...INITIAL_STATE, session });
    showToast('🚀 AI Agent deployed successfully!');
  }, [showToast]);

  const stopBot = useCallback(async () => {
    if (!state.session) return;
    try {
      await botApi.saveMemory(state.session.id);
      await botApi.stop(state.session.id);
      showToast('🛑 Bot stopped and meeting saved to memory.');
    } catch {
      showToast('⚠️ Failed to stop bot.');
    }
  }, [state.session, showToast]);

  const generateSummary = useCallback(async () => {
    if (!state.session) return;
    setState(p => ({ ...p, summaryLoading: true, summary: null }));
    try {
      const data = await botApi.generateSummary(state.session.id);
      if ((data as any).error) {
        showToast(`⚠️ ${(data as any).error}`);
        setState(p => ({ ...p, summaryLoading: false }));
      } else {
        setState(p => ({ ...p, summary: data as SummaryData, summaryLoading: false }));
        showToast('✅ Summary generated!');
      }
    } catch {
      showToast('❌ Failed to generate summary.');
      setState(p => ({ ...p, summaryLoading: false }));
    }
  }, [state.session, showToast]);

  const processVisual = useCallback(async () => {
    if (!state.session) return;
    setState(p => ({ ...p, isExtracting: true }));
    showToast('👁️ Starting Groq Vision extraction...');
    try {
      await botApi.processVisualContent(state.session.id);
    } catch {
      showToast('❌ Failed to start extraction.');
      setState(p => ({ ...p, isExtracting: false }));
    }
  }, [state.session, showToast]);

  const saveMemory = useCallback(async () => {
    if (!state.session) return;
    try {
      await botApi.saveMemory(state.session.id);
      showToast('💾 Meeting saved to memory!');
    } catch {
      showToast('❌ Failed to save memory.');
    }
  }, [state.session, showToast]);

  return {
    ...state,
    toast,
    showToast,
    deploy,
    stopBot,
    generateSummary,
    processVisual,
    saveMemory,
  };
}
