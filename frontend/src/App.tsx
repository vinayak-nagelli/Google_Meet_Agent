import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Sidebar from './components/layout/Sidebar';
import HeroSection from './components/dashboard/HeroSection';
import DeployForm from './components/meeting/DeployForm';
import ActiveMeetingDashboard from './components/meeting/ActiveMeetingDashboard';
import OutputTabs from './components/outputs/OutputTabs';
import MeetingMemory from './components/memory/MeetingMemory';
import { Bot } from 'lucide-react';
import { useMeetingSession } from './hooks/useMeetingSession';
import type { Page } from './types';
import './index.css';

function Toast({ msg }: { msg: string }) {
  if (!msg) return null;
  return (
    <motion.div
      className="fixed bottom-6 right-6 z-50 text-white text-sm font-medium px-5 py-3 rounded-2xl shadow-2xl max-w-sm"
      style={{ background: 'linear-gradient(135deg, #1e1b4b, #312e81)' }}
      initial={{ opacity: 0, y: 20, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 20 }}
    >
      {msg}
    </motion.div>
  );
}

export default function App() {
  const [page, setPage] = useState<Page>('home');
  const ms = useMeetingSession();

  const handleDeployed = (s: any) => {
    ms.deploy(s);
    setPage('active');
  };

  const pageTitles: Record<Page, string> = {
    home: 'Dashboard',
    deploy: 'Deploy Agent',
    active: 'Active Meeting',
    memory: 'Meeting Memory',
  };

  const renderContent = () => {
    switch (page) {
      case 'home':
        return <HeroSection onNavigate={setPage} />;

      case 'deploy':
        return <DeployForm onDeployed={handleDeployed} />;

      case 'active':
        if (!ms.session) {
          return (
            <motion.div
              className="flex flex-col items-center justify-center h-80 gap-4"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
            >
              <div className="w-20 h-20 rounded-3xl flex items-center justify-center animate-float" style={{ background: 'var(--gradient-primary)' }}>
                <Bot className="w-10 h-10 text-white" />
              </div>
              <div className="font-semibold text-slate-500 text-lg">No active session</div>
              <p className="text-sm text-slate-400 max-w-sm text-center">Deploy an AI agent to start monitoring a Google Meet session.</p>
              <button onClick={() => setPage('deploy')} className="btn-primary">Deploy AI Agent</button>
            </motion.div>
          );
        }
        return (
          <div className="space-y-8">
            <ActiveMeetingDashboard
              session={ms.session}
              visualStatus={ms.visualStatus}
              isRecording={ms.session?.is_recording || false}
              isTranscribing={ms.session?.transcribing || false}
              hasSummary={!!ms.summary}
              chatCount={ms.chats.length}
              onNavigateToOutputs={() => {}}
              onStop={ms.stopBot}
            />
            <div>
              <div className="section-title mb-3">AI Intelligence Outputs</div>
              <OutputTabs
                session={ms.session}
                chats={ms.chats}
                alerts={ms.alerts}
                transcript={ms.transcript}
                audioFiles={ms.audioFiles}
                summary={ms.summary}
                visualStatus={ms.visualStatus}
                visualData={ms.visualData}
                summaryLoading={ms.summaryLoading}
                isExtracting={ms.isExtracting}
                onGenerateSummary={ms.generateSummary}
                onProcessVisual={ms.processVisual}
                onSaveMemory={ms.saveMemory}
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
    <div className="flex min-h-screen">
      <Sidebar currentPage={page} onNavigate={setPage} hasActiveSession={!!ms.session} />

      <main className="flex-1 overflow-y-auto">
        <div
          className="sticky top-0 z-10 border-b px-8 py-3.5 flex items-center justify-between"
          style={{
            background: 'rgba(240,244,248,0.8)',
            backdropFilter: 'blur(16px)',
            borderColor: 'rgba(148,163,184,0.15)',
          }}
        >
          <div className="flex items-center gap-3">
            <div className="font-bold text-slate-800 text-sm">{pageTitles[page]}</div>
          </div>
          {ms.session && (
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full" style={{ background: 'rgba(255,255,255,0.7)' }}>
              <span className="status-dot-green" />
              <span className="text-xs font-medium text-slate-600">Session #{ms.session.id}</span>
              <span className="text-[11px] text-slate-400">· {ms.session.status}</span>
            </div>
          )}
        </div>

        <div className="px-8 py-8 max-w-5xl mx-auto">
          <AnimatePresence mode="wait">
            <motion.div
              key={page}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.3 }}
            >
              {renderContent()}
            </motion.div>
          </AnimatePresence>
        </div>
      </main>

      <AnimatePresence>
        {ms.toast && <Toast msg={ms.toast} />}
      </AnimatePresence>
    </div>
  );
}
