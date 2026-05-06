import { useState, useEffect, useCallback } from 'react';
import Sidebar from './components/layout/Sidebar';
import HeroSection from './components/dashboard/HeroSection';
import DeployForm from './components/meeting/DeployForm';
import ActiveMeetingDashboard from './components/meeting/ActiveMeetingDashboard';
import OutputTabs from './components/outputs/OutputTabs';
import MeetingMemory from './components/memory/MeetingMemory';
import './index.css';

const BACKEND_URL = 'http://localhost:8000';
type Page = 'home' | 'deploy' | 'active' | 'memory';

function Toast({ msg }: { msg: string }) {
  if (!msg) return null;
  return (
    <div className="fixed bottom-6 right-6 z-50 bg-slate-900 text-white text-sm font-medium px-4 py-3 rounded-xl shadow-xl animate-fade-in-up max-w-sm">
      {msg}
    </div>
  );
}

export default function App() {
  const [page, setPage] = useState<Page>('home');
  const [session, setSession] = useState<any>(null);
  const [toast, setToast] = useState('');

  // Live data
  const [chats, setChats] = useState<any[]>([]);
  const [alerts, setAlerts] = useState<any[]>([]);
  const [transcript, setTranscript] = useState<any[]>([]);
  const [audioFiles, setAudioFiles] = useState<any>({ chunks: [], cleaned_chunks: [] });
  const [summary, setSummary] = useState<any>(null);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [visualStatus, setVisualStatus] = useState<any>({ presentation_active: false, screenshots: [] });
  const [visualData, setVisualData] = useState<any>({ status: 'not_started', processed_count: 0, skipped_count: 0, screenshots: [] });
  const [isExtracting, setIsExtracting] = useState(false);

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(''), 4000); };

  // ── Polling ────────────────────────────────────────────────────────────────

  const poll = useCallback(async () => {
    if (!session) return;
    const id = session.id;
    try {
      const [statusRes, chatRes, alertRes, audioRes, transcriptRes, visualRes, visualArtifactRes] = await Promise.all([
        fetch(`${BACKEND_URL}/bot/status/${id}`),
        fetch(`${BACKEND_URL}/bot/${id}/chat`),
        fetch(`${BACKEND_URL}/bot/${id}/alerts`),
        fetch(`${BACKEND_URL}/bot/${id}/audio-files`),
        fetch(`${BACKEND_URL}/bot/${id}/transcript`),
        fetch(`${BACKEND_URL}/bot/${id}/screenshots`),
        fetch(`${BACKEND_URL}/bot/${id}/visual-content`),
      ]);

      if (statusRes.ok) {
        const s = await statusRes.json();
        setSession((prev: any) => ({ ...prev, ...s }));
      }
      if (chatRes.ok) setChats(await chatRes.json());
      if (alertRes.ok) setAlerts(await alertRes.json());
      if (audioRes.ok) setAudioFiles(await audioRes.json());
      if (transcriptRes.ok) {
        const t = await transcriptRes.json();
        setTranscript(t.segments || []);
      }
      if (visualRes.ok) {
        const v = await visualRes.json();
        setVisualStatus({ presentation_active: v.presentation_active, screenshots: v.screenshots || [] });
      }
      if (visualArtifactRes.ok) {
        const va = await visualArtifactRes.json();
        setVisualData(va);
        setIsExtracting(va.status === 'processing');
      }
    } catch {}
  }, [session?.id]);

  useEffect(() => {
    if (!session) return;
    const iv = setInterval(poll, 3000);
    poll();
    return () => clearInterval(iv);
  }, [poll]);

  // ── Handlers ───────────────────────────────────────────────────────────────

  const handleDeployed = (s: any) => {
    setSession(s);
    setChats([]);
    setAlerts([]);
    setTranscript([]);
    setAudioFiles({ chunks: [], cleaned_chunks: [] });
    setSummary(null);
    setVisualStatus({ presentation_active: false, screenshots: [] });
    setVisualData({ status: 'not_started', processed_count: 0, skipped_count: 0, screenshots: [] });
    showToast('🚀 AI Agent deployed successfully!');
    setPage('active');
  };

  const handleStopBot = async () => {
    if (!session) return;
    try {
      // 1. Save memory first so audio, transcript, screenshots are all persisted
      await fetch(`${BACKEND_URL}/bot/${session.id}/save-memory`, { method: 'POST' });
      // 2. Then stop the bot process
      await fetch(`${BACKEND_URL}/bot/${session.id}/stop`, { method: 'POST' });
      showToast('🛑 Bot stopped and meeting saved to memory.');
    } catch {
      showToast('⚠️ Failed to stop bot.');
    }
  };

  const handleGenerateSummary = async () => {
    if (!session) return;
    setSummaryLoading(true);
    setSummary(null);
    try {
      const res = await fetch(`${BACKEND_URL}/bot/${session.id}/generate-summary`, { method: 'POST' });
      const data = await res.json();
      if (data.error) showToast(`⚠️ ${data.error}`);
      else { setSummary(data); showToast('✅ Summary generated!'); }
    } catch {
      showToast('❌ Failed to generate summary.');
    }
    setSummaryLoading(false);
  };

  const handleProcessVisual = async () => {
    if (!session) return;
    setIsExtracting(true);
    showToast('👁️ Starting Groq Vision extraction...');
    try {
      await fetch(`${BACKEND_URL}/bot/${session.id}/process-visual-content`, { method: 'POST' });
    } catch {
      showToast('❌ Failed to start extraction.');
      setIsExtracting(false);
    }
  };

  const handleSaveMemory = async () => {
    if (!session) return;
    try {
      const res = await fetch(`${BACKEND_URL}/bot/${session.id}/save-memory`, { method: 'POST' });
      if (res.ok) showToast('💾 Meeting saved to memory!');
      else showToast('⚠️ Save failed.');
    } catch {
      showToast('❌ Failed to save memory.');
    }
  };

  // ── Derived state ──────────────────────────────────────────────────────────

  const isRecording = session?.is_recording || false;
  const isTranscribing = session?.transcribing || false;
  const hasSummary = !!summary;

  // ── Active page content ────────────────────────────────────────────────────

  const renderContent = () => {
    switch (page) {
      case 'home':
        return <HeroSection onNavigate={setPage} />;

      case 'deploy':
        return <DeployForm onDeployed={handleDeployed} />;

      case 'active':
        if (!session) {
          return (
            <div className="flex flex-col items-center justify-center h-80 gap-4">
              <div className="text-slate-300 text-6xl">🤖</div>
              <div className="font-semibold text-slate-500 text-lg">No active session</div>
              <button onClick={() => setPage('deploy')} className="btn-primary">Deploy AI Agent</button>
            </div>
          );
        }
        return (
          <div className="space-y-8">
            <ActiveMeetingDashboard
              session={session}
              visualStatus={visualStatus}
              isRecording={isRecording}
              isTranscribing={isTranscribing}
              hasSummary={hasSummary}
              chatCount={chats.length}
              onNavigateToOutputs={() => {}}
              onStop={handleStopBot}
            />
            <div>
              <div className="section-title mb-2">AI Outputs</div>
              <OutputTabs
                session={session}
                chats={chats}
                alerts={alerts}
                transcript={transcript}
                audioFiles={audioFiles}
                summary={summary}
                visualStatus={visualStatus}
                visualData={visualData}
                summaryLoading={summaryLoading}
                isExtracting={isExtracting}
                onGenerateSummary={handleGenerateSummary}
                onProcessVisual={handleProcessVisual}
                onSaveMemory={handleSaveMemory}
              />
            </div>
          </div>
        );

      case 'memory':
        return <MeetingMemory />;

      default:
        return null;
    }
  };

  return (
    <div className="flex min-h-screen bg-slate-50">
      {/* Sidebar */}
      <Sidebar currentPage={page} onNavigate={setPage} hasActiveSession={!!session} />

      {/* Main content */}
      <main className="flex-1 overflow-y-auto">
        {/* Top bar */}
        <div className="sticky top-0 z-10 bg-white/80 backdrop-blur-md border-b border-slate-100 px-8 py-3.5 flex items-center justify-between">
          <div className="font-semibold text-slate-800 text-sm capitalize">
            {page === 'home' ? 'Dashboard' : page === 'deploy' ? 'Deploy Agent' : page === 'active' ? 'Active Meeting' : 'Meeting Memory'}
          </div>
          {session && (
            <div className="flex items-center gap-2">
              <span className="status-dot-green" />
              <span className="text-xs font-medium text-slate-600">Session #{session.id} · {session.status}</span>
            </div>
          )}
        </div>

        {/* Page */}
        <div className="px-8 py-8 max-w-5xl mx-auto">
          {renderContent()}
        </div>
      </main>

      <Toast msg={toast} />
    </div>
  );
}
