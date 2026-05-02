import React, { useState, useEffect, useRef } from 'react';

const BACKEND_URL = 'http://localhost:8000';

const STATUS_STEPS = ['created', 'launching', 'opened_meet', 'configuring_device', 'joining', 'waiting_for_host_approval', 'joined', 'monitoring_chat'];

function getStatusColor(status: string) {
  if (status === 'joined' || status === 'monitoring_chat') return '#22d3ee';
  if (status === 'failed') return '#f87171';
  if (status === 'stopped') return '#94a3b8';
  return '#818cf8';
}

function StatusBadge({ status }: { status: string }) {
  const color = getStatusColor(status);
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: '6px',
      padding: '4px 12px', borderRadius: '999px',
      background: `${color}22`, border: `1px solid ${color}55`,
      color, fontSize: '12px', fontWeight: 600, letterSpacing: '0.05em'
    }}>
      <span style={{
        width: 7, height: 7, borderRadius: '50%', background: color,
        display: 'inline-block',
        boxShadow: (status === 'joined' || status === 'monitoring_chat') ? `0 0 8px ${color}` : 'none',
        animation: (status !== 'stopped' && status !== 'failed') ? 'pulse 1.5s infinite' : 'none'
      }} />
      {status.replace(/_/g, ' ').toUpperCase()}
    </span>
  );
}

interface BotSession { id: number; meet_link: string; bot_name: string; user_name: string; status: string; created_at: string; error_message?: string; }
interface ChatMsg { sender: string; message: string; timestamp: string; }
interface Alert { bot_id: number; type: string; message: string; original_message: string; sender: string; timestamp: string; }
interface ParticipantSummary { participant: string; message_count: number; main_points: string[]; questions_asked: string[]; decisions_contributed: string[]; action_items: string[]; deadlines_mentioned: string[]; }
interface ImportantMessage { sender: string; message: string; reason: string; }
interface MeetingSummary { meeting_summary: string; participant_summaries: ParticipantSummary[]; key_points: string[]; decisions: string[]; action_items: string[]; deadlines: string[]; unanswered_questions: string[]; important_messages: ImportantMessage[]; limitations: string[]; error?: string; }

const FEATURES = [
  { icon: '🤖', title: 'Auto Joins Meet', desc: 'Clicks join and enters the meeting automatically.' },
  { icon: '🔇', title: 'Mic & Cam Off', desc: 'Runs silently — mic and camera are always disabled.' },
  { icon: '💬', title: 'Chat Monitoring', desc: 'Captures every message from the Meet chat in real-time.' },
  { icon: '🔔', title: 'Name Mention Alerts', desc: 'Notifies you whenever your name is mentioned in chat.' },
  { icon: '📝', title: 'Meeting Summary', desc: 'AI-generated summary after the call. (Coming soon)' },
  { icon: '📊', title: 'Action Items', desc: 'Extract decisions and tasks automatically. (Coming soon)' },
];

export default function App() {
  const [meetLink, setMeetLink] = useState('');
  const [botName, setBotName] = useState('Meeting Assistant');
  const [userName, setUserName] = useState('');
  const [autoInstruction, setAutoInstruction] = useState('');
  const [userContext, setUserContext] = useState('');
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState('');
  const [session, setSession] = useState<BotSession | null>(null);
  const [chatMessages, setChatMessages] = useState<ChatMsg[]>([]);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [seenAlertCount, setSeenAlertCount] = useState(0);
  const [replyText, setReplyText] = useState('');
  const [sendingReply, setSendingReply] = useState(false);
  const [summary, setSummary] = useState<MeetingSummary | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [recordingChunks, setRecordingChunks] = useState<string[]>([]);
  const [recordingError, setRecordingError] = useState('');
  
  // Milestone 11: Transcript state
  const [transcriptSegments, setTranscriptSegments] = useState<{timestamp_str: string, text: string}[]>([]);
  const [isTranscribing, setIsTranscribing] = useState(false);

  // Milestone 10.5: Preprocessing state
  const [audioFiles, setAudioFiles] = useState<{original_files: string[], cleaned_files: string[], preprocessing_status: string, logs: any[]}>({original_files: [], cleaned_files: [], preprocessing_status: 'not_started', logs: []});
  const [isPreprocessing, setIsPreprocessing] = useState(false);
  const [transcriptionStatus, setTranscriptionStatus] = useState('not_started');

  const chatRef = useRef<HTMLDivElement>(null);

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(''), 4000); };

  const generateSummary = async () => {
    if (!session) return;
    setSummaryLoading(true);
    setSummary(null);
    try {
      const res = await fetch(`${BACKEND_URL}/bot/${session.id}/generate-summary`, { method: 'POST' });
      const data = await res.json();
      if (data.error) { showToast(`⚠️ ${data.error}`); }
      else { setSummary(data); showToast('✅ AI Summary generated!'); }
    } catch {
      showToast('❌ Failed to generate summary. Is GROQ_API_KEY set?');
    } finally {
      setSummaryLoading(false);
    }
  };

  const sendReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!session || !replyText.trim()) return;
    setSendingReply(true);
    try {
      const res = await fetch(`${BACKEND_URL}/bot/${session.id}/send-message`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: replyText.trim() })
      });
      if (res.ok) {
        showToast(`✉️ Message queued — bot will send it shortly!`);
        setReplyText('');
      } else {
        showToast('❌ Failed to queue message.');
      }
    } catch {
      showToast('❌ Could not reach backend.');
    } finally {
      setSendingReply(false);
    }
  };

  const deployBot = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setAlerts([]);
    setChatMessages([]);
    setSeenAlertCount(0);
    setRecordingChunks([]);
    setRecordingError('');
    try {
      const res = await fetch(`${BACKEND_URL}/bot/deploy`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ meet_link: meetLink, bot_name: botName, user_name: userName, auto_instruction: autoInstruction, user_context: userContext })
      });
      if (!res.ok) throw new Error('Backend error');
      const data: BotSession = await res.json();
      setSession(data);
      showToast(`✅ Bot #${data.id} deployed! Watching for "${userName || 'no name set'}"`);
    } catch {
      showToast('❌ Failed to connect to backend. Is it running?');
    } finally {
      setLoading(false);
    }
  };

  // Poll status
  useEffect(() => {
    if (!session) return;
    const iv = setInterval(async () => {
      try {
        const res = await fetch(`${BACKEND_URL}/bot/status/${session.id}`);
        if (res.ok) setSession(await res.json());
      } catch {}
    }, 2000);
    return () => clearInterval(iv);
  }, [session?.id]);

  // Poll recordings
  useEffect(() => {
    if (!session) return;
    const iv = setInterval(async () => {
      try {
        const res = await fetch(`${BACKEND_URL}/bot/${session.id}/recording`);
        if (res.ok) {
          const data = await res.json();
          setRecordingChunks(data.chunks || []);
          if (data.error) setRecordingError(data.error);
        }
      } catch {}
    }, 5000); // Poll every 5s for recordings
    return () => clearInterval(iv);
  }, [session?.id]);

  // Poll audio-files (Milestone 10.5)
  useEffect(() => {
    if (!session) return;
    const iv = setInterval(async () => {
      try {
        const res = await fetch(`${BACKEND_URL}/bot/${session.id}/audio-files`);
        if (res.ok) {
          const data = await res.json();
          setAudioFiles(data);
          if (data.preprocessing_status !== 'preprocessing') setIsPreprocessing(false);
        }
      } catch {}
    }, 4000);
    return () => clearInterval(iv);
  }, [session?.id]);

  const handlePreprocess = async () => {
    if (!session) return;
    setIsPreprocessing(true);
    showToast('🎛️ Audio preprocessing started...');
    try {
      await fetch(`${BACKEND_URL}/bot/${session.id}/preprocess-audio`, { method: 'POST' });
    } catch {
      showToast('❌ Failed to start preprocessing');
      setIsPreprocessing(false);
    }
  };

  const handleTranscription = async () => {
    if (!session) return;
    setIsTranscribing(true);
    setTranscriptionStatus('preprocessing');
    showToast('🚀 Starting full transcription pipeline...');
    try {
      await fetch(`${BACKEND_URL}/bot/${session.id}/transcribe-audio`, { method: 'POST' });
    } catch {
      showToast('❌ Failed to start transcription');
      setIsTranscribing(false);
    }
  };

  // Poll transcript
  useEffect(() => {
    if (!session) return;
    const iv = setInterval(async () => {
      try {
        const res = await fetch(`${BACKEND_URL}/bot/${session.id}/transcript`);
        if (res.ok) {
          const data = await res.json();
          setTranscriptionStatus(data.status);
          setIsTranscribing(['preprocessing', 'transcribing'].includes(data.status));
          setTranscriptSegments(data.transcript || []);
        }
      } catch {}
    }, 5000); // Poll every 5s
    return () => clearInterval(iv);
  }, [session?.id]);

  // Poll chat
  useEffect(() => {
    if (!session) return;
    const iv = setInterval(async () => {
      try {
        const res = await fetch(`${BACKEND_URL}/bot/${session.id}/chat`);
        if (res.ok) setChatMessages(await res.json());
      } catch {}
    }, 2000);
    return () => clearInterval(iv);
  }, [session?.id]);

  // Poll alerts
  useEffect(() => {
    if (!session) return;
    const iv = setInterval(async () => {
      try {
        const res = await fetch(`${BACKEND_URL}/bot/${session.id}/alerts`);
        if (res.ok) {
          const data: Alert[] = await res.json();
          setAlerts(data);
          // Show toast for each new alert
          if (data.length > seenAlertCount) {
            const newest = data[data.length - 1];
            showToast(`🔔 ${newest.message} — "${newest.original_message}"`);
            setSeenAlertCount(data.length);
          }
        }
      } catch {}
    }, 2000);
    return () => clearInterval(iv);
  }, [session?.id, seenAlertCount]);

  useEffect(() => {
    if (chatRef.current) chatRef.current.scrollTop = chatRef.current.scrollHeight;
  }, [chatMessages]);

  const stepIndex = session ? STATUS_STEPS.indexOf(session.status) : -1;

  return (
    <div style={{ minHeight: '100vh', background: 'linear-gradient(135deg, #0a0f1e 0%, #0d1630 50%, #0a1628 100%)', fontFamily: "'Inter', sans-serif", color: '#e2e8f0' }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap');
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.4} }
        @keyframes fadeIn { from{opacity:0;transform:translateY(10px)} to{opacity:1;transform:translateY(0)} }
        @keyframes slideIn { from{opacity:0;transform:translateX(20px)} to{opacity:1;transform:translateX(0)} }
        @keyframes alertPop { 0%{transform:scale(0.95);opacity:0} 100%{transform:scale(1);opacity:1} }
        * { box-sizing: border-box; margin: 0; padding: 0; }
        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-track { background: #1e293b; }
        ::-webkit-scrollbar-thumb { background: #334155; border-radius: 4px; }
        input:focus { outline: none; border-color: rgba(99,102,241,0.6) !important; box-shadow: 0 0 0 3px rgba(99,102,241,0.15); }
      `}</style>

      {/* Toast */}
      {toast && (
        <div style={{ position: 'fixed', top: 24, right: 24, zIndex: 9999, background: '#1e293b', border: '1px solid #334155', padding: '14px 20px', borderRadius: 14, fontSize: 13, fontWeight: 500, animation: 'slideIn 0.3s ease', boxShadow: '0 10px 40px rgba(0,0,0,0.5)', maxWidth: 380, lineHeight: 1.5 }}>
          {toast}
        </div>
      )}

      {/* Header */}
      <header style={{ padding: '20px 40px', borderBottom: '1px solid #1e293b', display: 'flex', alignItems: 'center', justifyContent: 'space-between', backdropFilter: 'blur(20px)', position: 'sticky', top: 0, zIndex: 100, background: 'rgba(10,15,30,0.85)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 36, height: 36, borderRadius: 10, background: 'linear-gradient(135deg, #6366f1, #22d3ee)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>🤖</div>
          <div>
            <div style={{ fontWeight: 800, fontSize: 18, background: 'linear-gradient(90deg, #818cf8, #22d3ee)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>Meet Agent</div>
            <div style={{ fontSize: 10, color: '#64748b', letterSpacing: '0.1em' }}>AI MEETING PRESENCE AGENT</div>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          {alerts.length > 0 && (
            <span style={{ padding: '4px 12px', borderRadius: 999, background: 'rgba(251,191,36,0.15)', border: '1px solid rgba(251,191,36,0.4)', color: '#fbbf24', fontSize: 12, fontWeight: 700 }}>
              🔔 {alerts.length} Alert{alerts.length > 1 ? 's' : ''}
            </span>
          )}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#22d3ee', boxShadow: '0 0 8px #22d3ee', animation: 'pulse 1.5s infinite' }} />
            <span style={{ fontSize: 12, color: '#94a3b8', fontWeight: 500 }}>MVP Active</span>
          </div>
        </div>
      </header>

      <main style={{ maxWidth: 1100, margin: '0 auto', padding: '40px 24px' }}>

        {/* Hero */}
        <section style={{ textAlign: 'center', marginBottom: 60, animation: 'fadeIn 0.6s ease' }}>
          <div style={{ display: 'inline-block', padding: '6px 16px', borderRadius: 999, background: 'rgba(99,102,241,0.15)', border: '1px solid rgba(99,102,241,0.3)', fontSize: 12, color: '#818cf8', fontWeight: 600, marginBottom: 20, letterSpacing: '0.05em' }}>
            🚀 PERSONAL AI MEETING AGENT
          </div>
          <h1 style={{ fontSize: 'clamp(32px,5vw,56px)', fontWeight: 800, lineHeight: 1.15, marginBottom: 16, background: 'linear-gradient(135deg, #ffffff 0%, #94a3b8 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
            Never Miss a<br />Meeting Again
          </h1>
          <p style={{ fontSize: 18, color: '#64748b', maxWidth: 520, margin: '0 auto 40px', lineHeight: 1.7 }}>
            Deploy an AI assistant that joins Google Meet, monitors chat, alerts on name mentions, and reports back.
          </p>

          {/* Deploy Card */}
          <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 20, padding: '32px', maxWidth: 580, margin: '0 auto', backdropFilter: 'blur(20px)', boxShadow: '0 25px 80px rgba(0,0,0,0.4)' }}>
            <form onSubmit={deployBot}>
              <div style={{ marginBottom: 16, textAlign: 'left' }}>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#94a3b8', marginBottom: 8, letterSpacing: '0.05em' }}>GOOGLE MEET LINK</label>
                <input type="text" value={meetLink} onChange={e => setMeetLink(e.target.value)} required
                  placeholder="https://meet.google.com/xxx-xxxx-xxx"
                  style={{ width: '100%', padding: '12px 16px', borderRadius: 12, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#e2e8f0', fontSize: 14, fontFamily: 'Inter, sans-serif', transition: 'all 0.2s' }}
                />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
                <div style={{ textAlign: 'left' }}>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#94a3b8', marginBottom: 8, letterSpacing: '0.05em' }}>BOT NAME</label>
                  <input type="text" value={botName} onChange={e => setBotName(e.target.value)} required
                    placeholder="Meeting Assistant"
                    style={{ width: '100%', padding: '12px 16px', borderRadius: 12, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#e2e8f0', fontSize: 14, fontFamily: 'Inter, sans-serif', transition: 'all 0.2s' }}
                  />
                </div>
                <div style={{ textAlign: 'left' }}>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#94a3b8', marginBottom: 8, letterSpacing: '0.05em' }}>
                    YOUR NAME <span style={{ color: '#475569', fontWeight: 400 }}>(for alerts)</span>
                  </label>
                  <input type="text" value={userName} onChange={e => setUserName(e.target.value)}
                    placeholder="e.g. Vinayak"
                    style={{ width: '100%', padding: '12px 16px', borderRadius: 12, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#e2e8f0', fontSize: 14, fontFamily: 'Inter, sans-serif', transition: 'all 0.2s' }}
                  />
                </div>
              </div>
              <div style={{ marginBottom: 16, textAlign: 'left' }}>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#94a3b8', marginBottom: 8, letterSpacing: '0.05em' }}>
                  WHO ARE YOU? <span style={{ color: '#475569', fontWeight: 400 }}>(context for AI)</span>
                </label>
                <textarea value={userContext} onChange={e => setUserContext(e.target.value)} rows={2}
                  placeholder={`e.g. I am Vinayak, a computer science student attending to learn. I don't have tasks.`}
                  style={{ width: '100%', padding: '12px 16px', borderRadius: 12, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#e2e8f0', fontSize: 13, fontFamily: 'Inter, sans-serif', resize: 'vertical', lineHeight: 1.5 }}
                />
                <div style={{ fontSize: 11, color: '#334155', marginTop: 4 }}>This helps the LLM personalize the replies and summaries for your specific role.</div>
              </div>
              <div style={{ marginBottom: 16, textAlign: 'left' }}>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#94a3b8', marginBottom: 8, letterSpacing: '0.05em' }}>
                  AUTO-REPLY INSTRUCTION <span style={{ color: '#475569', fontWeight: 400 }}>(optional)</span>
                </label>
                <textarea value={autoInstruction} onChange={e => setAutoInstruction(e.target.value)} rows={2}
                  placeholder={`e.g. If someone asks about task, reply: It will be done by Thursday`}
                  style={{ width: '100%', padding: '12px 16px', borderRadius: 12, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#e2e8f0', fontSize: 13, fontFamily: 'Inter, sans-serif', resize: 'vertical', lineHeight: 1.5 }}
                />
                <div style={{ fontSize: 11, color: '#334155', marginTop: 4 }}>Format: "If someone asks about X, reply: Y" or "keyword1, keyword2 -&gt; response"</div>
              </div>
              <button type="submit" disabled={loading}
                style={{ width: '100%', padding: '14px', borderRadius: 12, border: 'none', cursor: loading ? 'not-allowed' : 'pointer', fontWeight: 700, fontSize: 15, fontFamily: 'Inter, sans-serif', background: loading ? '#334155' : 'linear-gradient(135deg, #6366f1, #22d3ee)', color: loading ? '#64748b' : 'white', transition: 'all 0.2s', boxShadow: loading ? 'none' : '0 4px 20px rgba(99,102,241,0.4)' }}>
                {loading ? '⏳ Deploying...' : '🚀 Deploy Bot'}
              </button>
            </form>
          </div>
        </section>

        {/* Alerts Section */}
        {alerts.length > 0 && (
          <section style={{ marginBottom: 32, animation: 'fadeIn 0.4s ease' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
              <span style={{ fontSize: 20 }}>🔔</span>
              <h2 style={{ fontSize: 18, fontWeight: 700 }}>Name Mention Alerts</h2>
              <span style={{ padding: '2px 10px', borderRadius: 999, background: 'rgba(251,191,36,0.15)', border: '1px solid rgba(251,191,36,0.3)', color: '#fbbf24', fontSize: 12, fontWeight: 600 }}>{alerts.length}</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {[...alerts].reverse().map((alert, i) => (
                <div key={i} style={{ background: 'rgba(251,191,36,0.06)', border: '1px solid rgba(251,191,36,0.25)', borderRadius: 16, padding: '18px 22px', animation: 'alertPop 0.3s ease', display: 'flex', alignItems: 'flex-start', gap: 14 }}>
                  <div style={{ fontSize: 24, flexShrink: 0, marginTop: 2 }}>🔔</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 700, color: '#fbbf24', fontSize: 14, marginBottom: 4 }}>{alert.message}</div>
                    <div style={{ background: 'rgba(255,255,255,0.04)', borderRadius: 8, padding: '8px 12px', fontSize: 13, color: '#e2e8f0', marginBottom: 6, borderLeft: '3px solid rgba(251,191,36,0.4)' }}>
                      "{alert.original_message}"
                    </div>
                    <div style={{ fontSize: 11, color: '#64748b' }}>Sent by <span style={{ color: '#94a3b8', fontWeight: 600 }}>{alert.sender}</span> at {alert.timestamp}</div>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Status + Chat */}
        {session && (
          <section style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, marginBottom: 48, animation: 'fadeIn 0.5s ease' }}>
            {/* Bot Status Card */}
            <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 20, padding: 28, backdropFilter: 'blur(20px)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
                <div>
                  <div style={{ fontSize: 12, color: '#64748b', marginBottom: 4, letterSpacing: '0.05em' }}>BOT SESSION</div>
                  <div style={{ fontSize: 20, fontWeight: 700 }}>Bot #{session.id}</div>
                </div>
                <StatusBadge status={session.status} />
              </div>

              {/* Timeline */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {STATUS_STEPS.map((step, i) => {
                  const done = i <= stepIndex;
                  const active = i === stepIndex;
                  return (
                    <div key={step} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <div style={{ width: 24, height: 24, borderRadius: '50%', border: `2px solid ${done ? '#22d3ee' : '#1e293b'}`, background: done ? (active ? '#22d3ee22' : '#22d3ee11') : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, transition: 'all 0.3s' }}>
                        {done && <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#22d3ee' }} />}
                      </div>
                      <span style={{ fontSize: 13, color: done ? '#e2e8f0' : '#334155', fontWeight: active ? 600 : 400 }}>
                        {step.replace(/_/g, ' ')}
                      </span>
                    </div>
                  );
                })}
              </div>

              {session.error_message && (
                <div style={{ marginTop: 16, padding: '10px 14px', borderRadius: 10, background: 'rgba(248,113,113,0.1)', border: '1px solid rgba(248,113,113,0.3)', color: '#f87171', fontSize: 13 }}>
                  ⚠️ {session.error_message}
                </div>
              )}

              <div style={{ marginTop: 20, padding: '14px', borderRadius: 12, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', fontSize: 13, color: '#64748b', display: 'flex', flexDirection: 'column', gap: 6 }}>
                <div>🔗 {session.meet_link}</div>
                <div>🤖 {session.bot_name}</div>
                {session.user_name && <div>👤 Watching for: <span style={{ color: '#fbbf24', fontWeight: 600 }}>"{session.user_name}"</span></div>}
              </div>
            </div>

            {/* Live Chat */}
            <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 20, padding: 28, backdropFilter: 'blur(20px)', display: 'flex', flexDirection: 'column' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                <div>
                  <div style={{ fontSize: 12, color: '#64748b', marginBottom: 4, letterSpacing: '0.05em' }}>LIVE CHAT</div>
                  <div style={{ fontSize: 18, fontWeight: 700 }}>💬 Chat Monitor</div>
                </div>
                {chatMessages.length > 0 && (
                  <span style={{ padding: '4px 10px', borderRadius: 999, background: 'rgba(34,211,238,0.15)', border: '1px solid rgba(34,211,238,0.3)', color: '#22d3ee', fontSize: 12, fontWeight: 600 }}>
                    {chatMessages.length} msgs
                  </span>
                )}
              </div>
              <div ref={chatRef} style={{ flex: 1, minHeight: 260, maxHeight: 320, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 10 }}>
                {chatMessages.length === 0 ? (
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: '#334155', gap: 8, paddingTop: 40 }}>
                    <div style={{ fontSize: 32 }}>💬</div>
                    <div style={{ fontSize: 13 }}>Waiting for chat messages...</div>
                  </div>
                ) : (
                  chatMessages.map((msg, i) => {
                    const isMention = session.user_name && msg.message.toLowerCase().includes(session.user_name.toLowerCase());
                    const isAutoReply = msg.sender === 'Bot (Auto-reply)';
                    const isSentByUser = msg.sender === 'You via Bot';
                    const borderColor = isAutoReply ? 'rgba(34,197,94,0.3)' : isSentByUser ? 'rgba(99,102,241,0.3)' : isMention ? 'rgba(251,191,36,0.3)' : 'rgba(255,255,255,0.06)';
                    const bgColor = isAutoReply ? 'rgba(34,197,94,0.06)' : isSentByUser ? 'rgba(99,102,241,0.07)' : isMention ? 'rgba(251,191,36,0.08)' : 'rgba(255,255,255,0.04)';
                    const senderColor = isAutoReply ? '#4ade80' : isSentByUser ? '#818cf8' : isMention ? '#fbbf24' : '#818cf8';
                    return (
                      <div key={i} style={{ padding: '10px 14px', borderRadius: 12, background: bgColor, border: `1px solid ${borderColor}`, animation: 'fadeIn 0.3s ease' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <span style={{ fontSize: 12, fontWeight: 600, color: senderColor }}>
                              {isMention && '🔔 '}{isAutoReply && '🤖 '}{isSentByUser && '✉️ '}{msg.sender}
                            </span>
                            {isAutoReply && <span style={{ fontSize: 10, padding: '1px 7px', borderRadius: 999, background: 'rgba(34,197,94,0.15)', border: '1px solid rgba(34,197,94,0.3)', color: '#4ade80', fontWeight: 600 }}>AUTO-REPLIED</span>}
                            {isSentByUser && <span style={{ fontSize: 10, padding: '1px 7px', borderRadius: 999, background: 'rgba(99,102,241,0.15)', border: '1px solid rgba(99,102,241,0.3)', color: '#818cf8', fontWeight: 600 }}>SENT BY YOU</span>}
                          </div>
                          <span style={{ fontSize: 11, color: '#475569' }}>{msg.timestamp}</span>
                        </div>
                        <div style={{ fontSize: 13, color: '#e2e8f0', lineHeight: 1.5 }}>{msg.message}</div>
                      </div>
                    );
                  })
                )}
              </div>

              {/* Reply Box — always visible once bot is inside the meeting */}
              {session && ['joined', 'monitoring_chat', 'message_sent'].includes(session.status) && (
                <form onSubmit={sendReply} style={{ marginTop: 16, display: 'flex', gap: 10 }}>
                  <input
                    type="text" value={replyText} onChange={e => setReplyText(e.target.value)}
                    placeholder="Type a message to send via bot..."
                    style={{ flex: 1, padding: '10px 14px', borderRadius: 10, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#e2e8f0', fontSize: 13, fontFamily: 'Inter, sans-serif', outline: 'none' }}
                  />
                  <button type="submit" disabled={sendingReply || !replyText.trim()}
                    style={{ padding: '10px 18px', borderRadius: 10, border: 'none', cursor: (sendingReply || !replyText.trim()) ? 'not-allowed' : 'pointer', background: (sendingReply || !replyText.trim()) ? '#334155' : 'linear-gradient(135deg, #6366f1, #22d3ee)', color: 'white', fontWeight: 700, fontSize: 13, fontFamily: 'Inter, sans-serif', whiteSpace: 'nowrap' }}>
                    {sendingReply ? '⏳' : '✉️ Send'}
                  </button>
                </form>
              )}
            </div>
          </section>
        )}

        {/* AI Meeting Recording Section */}
        <section style={{ marginBottom: 48, animation: 'fadeIn 0.5s ease' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
            <div>
              <div style={{ fontSize: 12, color: '#64748b', letterSpacing: '0.1em', marginBottom: 4 }}>MILESTONE 10</div>
              <h2 style={{ fontSize: 24, fontWeight: 700 }}>🎧 Meeting Recording</h2>
            </div>
            {session && !['stopped', 'failed'].includes(session.status) && (
              <button onClick={async () => {
                if (confirm("Are you sure you want to end the meeting and stop recording?")) {
                  await fetch(`${BACKEND_URL}/bot/${session.id}/end`, { method: 'POST' });
                  showToast("🛑 Stopping meeting bot...");
                }
              }}
                style={{ padding: '10px 20px', borderRadius: 10, border: 'none', cursor: 'pointer', background: 'rgba(248,113,113,0.15)', color: '#f87171', borderStyle: 'solid', borderWidth: 1, borderColor: 'rgba(248,113,113,0.3)', fontWeight: 600, fontSize: 13, fontFamily: 'Inter, sans-serif' }}>
                End Meeting
              </button>
            )}
          </div>

          <div style={{ padding: '24px', borderRadius: 16, background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)', backdropFilter: 'blur(10px)' }}>
            {!session ? (
              <div style={{ textAlign: 'center', padding: '20px', color: '#475569', fontSize: 13 }}>Deploy a bot to start capturing meeting audio.</div>
            ) : recordingError ? (
              <div style={{ padding: '16px', background: 'rgba(248,113,113,0.1)', border: '1px solid rgba(248,113,113,0.3)', borderRadius: 10, color: '#fca5a5', fontSize: 13 }}>
                ⚠️ Recording failed: {recordingError}
              </div>
            ) : recordingChunks.length === 0 ? (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, padding: '20px', color: '#818cf8', fontSize: 14, fontWeight: 500 }}>
                <div style={{ width: 12, height: 12, borderRadius: '50%', background: '#818cf8', animation: 'pulse 1.5s infinite' }} />
                Recording active (Waiting for chunk to save...)
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div style={{ fontSize: 12, color: '#94a3b8' }}>Recording includes only audio captured after the bot joined.</div>
                {recordingChunks.map((chunk, idx) => (
                  <div key={idx} style={{ padding: '16px', borderRadius: 12, background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.05)' }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: '#e2e8f0', marginBottom: 12 }}>
                      {recordingChunks.length > 1 ? `Audio Part ${idx + 1} (5 min)` : `Full Meeting Audio`}
                    </div>
                    <audio controls style={{ width: '100%', height: 40, outline: 'none' }} src={`${BACKEND_URL}/recordings/${chunk}`} />
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>

        {/* Milestone 10.5 — Audio Processing */}
        <section style={{ marginBottom: 48, animation: 'fadeIn 0.5s ease' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
            <div>
              <div style={{ fontSize: 12, color: '#64748b', letterSpacing: '0.1em', marginBottom: 4 }}>MILESTONE 10.5</div>
              <h2 style={{ fontSize: 24, fontWeight: 700 }}>🎛️ Audio Processing</h2>
              <div style={{ fontSize: 12, color: '#64748b', marginTop: 4 }}>Cleaned audio is prepared for more accurate speech-to-text transcription.</div>
            </div>
            {session && (
              <button
                id="btn-preprocess-audio"
                onClick={handlePreprocess}
                disabled={isPreprocessing || audioFiles.original_files.length === 0}
                style={{
                  padding: '12px 24px', borderRadius: 12, border: 'none',
                  cursor: (isPreprocessing || audioFiles.original_files.length === 0) ? 'not-allowed' : 'pointer',
                  background: isPreprocessing ? '#334155' : 'linear-gradient(135deg, #10b981, #06b6d4)',
                  color: isPreprocessing ? '#64748b' : 'white',
                  fontWeight: 700, fontSize: 14, fontFamily: 'Inter, sans-serif',
                  boxShadow: isPreprocessing ? 'none' : '0 4px 20px rgba(16,185,129,0.35)',
                  display: 'flex', alignItems: 'center', gap: 8,
                }}
              >
                {isPreprocessing ? (
                  <><div style={{ width: 10, height: 10, borderRadius: '50%', background: '#64748b', animation: 'pulse 1.5s infinite' }} /> Processing...</>
                ) : '🎛️ Preprocess Audio'}
              </button>
            )}
          </div>

          {/* Status badge */}
          {session && (
            <div style={{ marginBottom: 16 }}>
              {audioFiles.preprocessing_status === 'preprocessed' && (
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '6px 14px', borderRadius: 20, background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.3)', fontSize: 12, color: '#34d399', fontWeight: 600 }}>
                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#34d399' }} /> Audio cleaned successfully
                </div>
              )}
              {audioFiles.preprocessing_status === 'preprocessing' && (
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '6px 14px', borderRadius: 20, background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.3)', fontSize: 12, color: '#818cf8', fontWeight: 600 }}>
                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#818cf8', animation: 'pulse 1.5s infinite' }} /> Processing...
                </div>
              )}
              {audioFiles.preprocessing_status === 'preprocessing_failed' && (
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '6px 14px', borderRadius: 20, background: 'rgba(248,113,113,0.1)', border: '1px solid rgba(248,113,113,0.3)', fontSize: 12, color: '#fca5a5', fontWeight: 600 }}>
                  ⚠️ Cleaning failed — using original audio
                </div>
              )}
            </div>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {!session ? (
              <div style={{ padding: '24px', borderRadius: 16, background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)', textAlign: 'center', color: '#475569', fontSize: 13 }}>
                Deploy a bot to start recording, then preprocess audio.
              </div>
            ) : audioFiles.original_files.length === 0 ? (
              <div style={{ padding: '24px', borderRadius: 16, background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)', textAlign: 'center', color: '#64748b', fontSize: 13 }}>
                No recordings found yet. Wait for the first audio chunk to save.
              </div>
            ) : (
              audioFiles.original_files.map((orig, idx) => {
                const cleanedName = orig.replace('.wav', '_clean.wav');
                const cleanedPath = audioFiles.cleaned_files.find(c => c.includes(cleanedName));
                const log = audioFiles.logs[idx];

                return (
                  <div key={idx} style={{ padding: '20px', borderRadius: 16, background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)' }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: '#e2e8f0', marginBottom: 14 }}>
                      {audioFiles.original_files.length > 1 ? `Part ${idx + 1}` : 'Full Recording'}
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                      {/* Original */}
                      <div>
                        <div style={{ fontSize: 11, color: '#64748b', fontWeight: 600, marginBottom: 8, letterSpacing: '0.05em' }}>ORIGINAL RECORDING</div>
                        <audio controls style={{ width: '100%', height: 38, outline: 'none' }} src={`${BACKEND_URL}/recordings/${orig}`} />
                        {log?.size_before_mb && <div style={{ fontSize: 11, color: '#475569', marginTop: 4 }}>Size: {log.size_before_mb} MB · Duration: {Math.floor(log.duration_before / 60)}m {Math.round(log.duration_before % 60)}s</div>}
                      </div>

                      {/* Cleaned */}
                      <div>
                        <div style={{ fontSize: 11, color: '#34d399', fontWeight: 600, marginBottom: 8, letterSpacing: '0.05em' }}>CLEANED RECORDING</div>
                        {cleanedPath ? (
                          <>
                            <audio controls style={{ width: '100%', height: 38, outline: 'none' }} src={`${BACKEND_URL}/recordings/${cleanedPath}`} />
                            {log?.size_after_mb && <div style={{ fontSize: 11, color: '#475569', marginTop: 4 }}>Size: {log.size_after_mb} MB · Duration: {Math.floor(log.duration_after / 60)}m {Math.round(log.duration_after % 60)}s</div>}
                          </>
                        ) : (
                          <div style={{ height: 38, display: 'flex', alignItems: 'center', padding: '0 12px', borderRadius: 8, background: 'rgba(0,0,0,0.2)', color: '#475569', fontSize: 12 }}>
                            {isPreprocessing ? 'Processing...' : 'Click "Preprocess Audio" to generate'}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Log error if any */}
                    {log && !log.success && log.error && (
                      <div style={{ marginTop: 12, padding: '10px 14px', borderRadius: 8, background: 'rgba(248,113,113,0.08)', border: '1px solid rgba(248,113,113,0.2)', fontSize: 12, color: '#fca5a5' }}>
                        ⚠️ {log.error}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </section>

        {/* AI Meeting Transcript Section */}
        <section style={{ marginBottom: 48, animation: 'fadeIn 0.5s ease' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
            <div>
              <div style={{ fontSize: 12, color: '#64748b', letterSpacing: '0.1em', marginBottom: 4 }}>MILESTONE 11</div>
              <h2 style={{ fontSize: 24, fontWeight: 700 }}>📜 Meeting Transcript</h2>
              <div style={{ fontSize: 12, color: '#64748b', marginTop: 4 }}>Transcript is generated from recorded meeting audio captured after the bot joined.</div>
            </div>
            {session && (
              <button
                onClick={handleTranscription}
                disabled={isTranscribing || audioFiles.original_files.length === 0}
                style={{
                  padding: '12px 24px', borderRadius: 12, border: 'none',
                  cursor: (isTranscribing || audioFiles.original_files.length === 0) ? 'not-allowed' : 'pointer',
                  background: isTranscribing ? '#334155' : 'linear-gradient(135deg, #6366f1, #a855f7)',
                  color: isTranscribing ? '#64748b' : 'white',
                  fontWeight: 700, fontSize: 14, fontFamily: 'Inter, sans-serif',
                  boxShadow: isTranscribing ? 'none' : '0 4px 20px rgba(168,85,247,0.4)',
                  display: 'flex', alignItems: 'center', gap: 8,
                }}
              >
                {isTranscribing ? (
                  <><div style={{ width: 10, height: 10, borderRadius: '50%', background: '#64748b', animation: 'pulse 1.5s infinite' }} /> {transcriptionStatus === 'preprocessing' ? 'Cleaning Audio...' : 'Transcribing...'}</>
                ) : '🎙️ Transcribe Meeting Audio'}
              </button>
            )}
          </div>

          {/* Status badge */}
          {session && transcriptionStatus !== 'not_started' && (
            <div style={{ marginBottom: 16 }}>
              {transcriptionStatus === 'transcribed' && (
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '6px 14px', borderRadius: 20, background: 'rgba(168,85,247,0.1)', border: '1px solid rgba(168,85,247,0.3)', fontSize: 12, color: '#a855f7', fontWeight: 600 }}>
                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#a855f7' }} /> Transcript ready
                </div>
              )}
              {transcriptionStatus === 'failed' && (
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '6px 14px', borderRadius: 20, background: 'rgba(248,113,113,0.1)', border: '1px solid rgba(248,113,113,0.3)', fontSize: 12, color: '#fca5a5', fontWeight: 600 }}>
                  ⚠️ Transcription failed
                </div>
              )}
            </div>
          )}

          <div style={{ padding: '24px', borderRadius: 16, background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)', backdropFilter: 'blur(10px)', maxHeight: 350, overflowY: 'auto' }}>
            {!session ? (
              <div style={{ textAlign: 'center', padding: '20px', color: '#475569', fontSize: 13 }}>Deploy a bot to capture meeting audio and transcribe it.</div>
            ) : transcriptSegments.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '20px', color: '#64748b', fontSize: 13 }}>
                {isTranscribing ? "Processing audio in the background..." : "Transcript will appear here once audio chunks are processed."}
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {transcriptSegments.map((seg, idx) => {
                  const isHighlighted = userName && seg.text.toLowerCase().includes(userName.toLowerCase());
                  return (
                    <div key={idx} style={{ padding: '12px 16px', borderRadius: 10, background: isHighlighted ? 'rgba(234,179,8,0.1)' : 'rgba(0,0,0,0.2)', border: isHighlighted ? '1px solid rgba(234,179,8,0.3)' : '1px solid rgba(255,255,255,0.05)', display: 'flex', gap: 12 }}>
                      <div style={{ fontSize: 12, color: isHighlighted ? '#eab308' : '#64748b', fontWeight: 700, minWidth: 50, paddingTop: 2 }}>{seg.timestamp_str}</div>
                      <div style={{ fontSize: 14, color: isHighlighted ? '#fde047' : '#e2e8f0', lineHeight: 1.5 }}>
                        {seg.text}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </section>

        {/* Feature Cards */}
        <section style={{ marginBottom: 48 }}>
          <div style={{ textAlign: 'center', marginBottom: 32 }}>
            <div style={{ fontSize: 12, color: '#64748b', letterSpacing: '0.1em', marginBottom: 8 }}>CAPABILITIES</div>
            <h2 style={{ fontSize: 28, fontWeight: 700 }}>What Meet Agent Does</h2>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 20 }}>
            {FEATURES.map((f, i) => (
              <div key={i} style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 16, padding: '24px', backdropFilter: 'blur(10px)' }}>
                <div style={{ fontSize: 28, marginBottom: 12 }}>{f.icon}</div>
                <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 6 }}>{f.title}</div>
                <div style={{ fontSize: 13, color: '#64748b', lineHeight: 1.6 }}>{f.desc}</div>
              </div>
            ))}
          </div>
        </section>

        {/* AI Summary Section */}
        <section style={{ marginBottom: 48 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
            <div>
              <div style={{ fontSize: 12, color: '#64748b', letterSpacing: '0.1em', marginBottom: 4 }}>MILESTONE 9</div>
              <h2 style={{ fontSize: 24, fontWeight: 700 }}>🧠 AI Meeting Summary</h2>
            </div>
            {session && (
              <button onClick={generateSummary} disabled={summaryLoading}
                style={{ padding: '12px 24px', borderRadius: 12, border: 'none', cursor: summaryLoading ? 'not-allowed' : 'pointer', background: summaryLoading ? '#334155' : 'linear-gradient(135deg, #6366f1, #22d3ee)', color: summaryLoading ? '#64748b' : 'white', fontWeight: 700, fontSize: 14, fontFamily: 'Inter, sans-serif', boxShadow: summaryLoading ? 'none' : '0 4px 20px rgba(99,102,241,0.4)' }}>
                {summaryLoading ? '⏳ Generating AI Summary...' : '✨ Generate AI Summary'}
              </button>
            )}
          </div>

          <div style={{ padding: '12px 16px', borderRadius: 10, background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.2)', fontSize: 12, color: '#818cf8', marginBottom: 24 }}>
            ℹ️ AI summary is based only on Google Meet chat messages captured after the bot joined. Previous messages may not be available.
          </div>

          {!summary && !summaryLoading && (
            <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 20, padding: '48px', textAlign: 'center', color: '#334155' }}>
              <div style={{ fontSize: 40, marginBottom: 12 }}>🧠</div>
              <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 8, color: '#475569' }}>No summary generated yet</div>
              <div style={{ fontSize: 13 }}>Deploy a bot, capture chat messages, then click "Generate AI Summary"</div>
            </div>
          )}

          {summary && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20, animation: 'fadeIn 0.5s ease' }}>

              {/* Meeting Overview */}
              <div style={{ background: 'rgba(99,102,241,0.07)', border: '1px solid rgba(99,102,241,0.2)', borderRadius: 16, padding: 24 }}>
                <div style={{ fontSize: 12, color: '#818cf8', fontWeight: 600, letterSpacing: '0.05em', marginBottom: 10 }}>📝 MEETING OVERVIEW</div>
                <p style={{ fontSize: 15, lineHeight: 1.8, color: '#e2e8f0' }}>{summary.meeting_summary}</p>
              </div>

              {/* Stats Grid */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 16 }}>
                {([['🔑', 'Key Points', summary.key_points, '#818cf8'], ['✅', 'Decisions', summary.decisions, '#4ade80'], ['📋', 'Action Items', summary.action_items, '#22d3ee'], ['⏰', 'Deadlines', summary.deadlines, '#f87171']] as [string, string, string[], string][]).map(([icon, label, items, color], i) => (
                  <div key={i} style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 14, padding: '18px' }}>
                    <div style={{ fontSize: 24, marginBottom: 8 }}>{icon}</div>
                    <div style={{ fontSize: 11, color, fontWeight: 700, marginBottom: 10, letterSpacing: '0.05em' }}>{label.toUpperCase()}</div>
                    {items.length === 0
                      ? <div style={{ fontSize: 12, color: '#334155' }}>None identified</div>
                      : items.map((pt, j) => <div key={j} style={{ fontSize: 12, color: '#cbd5e1', marginBottom: 4, paddingLeft: 8, borderLeft: `2px solid ${color}44` }}>{pt}</div>)
                    }
                  </div>
                ))}
              </div>

              {/* Unanswered Questions */}
              {summary.unanswered_questions.length > 0 && (
                <div style={{ background: 'rgba(251,191,36,0.06)', border: '1px solid rgba(251,191,36,0.2)', borderRadius: 14, padding: 20 }}>
                  <div style={{ fontSize: 12, color: '#fbbf24', fontWeight: 700, letterSpacing: '0.05em', marginBottom: 12 }}>❓ UNANSWERED QUESTIONS</div>
                  {summary.unanswered_questions.map((q, i) => (
                    <div key={i} style={{ fontSize: 13, color: '#fde68a', marginBottom: 6, paddingLeft: 10, borderLeft: '2px solid rgba(251,191,36,0.4)' }}>{q}</div>
                  ))}
                </div>
              )}

              {/* Important Messages */}
              {summary.important_messages.length > 0 && (
                <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 14, padding: 20 }}>
                  <div style={{ fontSize: 12, color: '#94a3b8', fontWeight: 700, letterSpacing: '0.05em', marginBottom: 14 }}>⭐ IMPORTANT MESSAGES</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {summary.important_messages.map((m, i) => (
                      <div key={i} style={{ padding: '12px 14px', borderRadius: 10, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}>
                        <div style={{ fontSize: 12, fontWeight: 600, color: '#818cf8', marginBottom: 4 }}>{m.sender}</div>
                        <div style={{ fontSize: 13, color: '#e2e8f0', marginBottom: 6 }}>"{m.message}"</div>
                        <div style={{ fontSize: 11, color: '#64748b' }}>📌 {m.reason}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Participant-wise Summary */}
              {summary.participant_summaries.length > 0 && (
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 14, color: '#94a3b8', letterSpacing: '0.05em' }}>👥 PARTICIPANT-WISE SUMMARY</div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 16 }}>
                    {summary.participant_summaries.map((p, i) => (
                      <div key={i} style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 16, padding: 20 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
                          <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'linear-gradient(135deg, #6366f1, #22d3ee)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, color: 'white', flexShrink: 0, fontSize: 15 }}>
                            {p.participant.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <div style={{ fontWeight: 700, fontSize: 15 }}>{p.participant}</div>
                            <div style={{ fontSize: 12, color: '#64748b' }}>{p.message_count} messages</div>
                          </div>
                        </div>
                        {([['Main Points', p.main_points, '#818cf8'], ['Questions Asked', p.questions_asked, '#fbbf24'], ['Decisions', p.decisions_contributed, '#4ade80'], ['Action Items', p.action_items, '#22d3ee'], ['Deadlines', p.deadlines_mentioned, '#f87171']] as [string, string[], string][]).map(([label, items, color]) =>
                          items.length > 0 && (
                            <div key={label} style={{ marginBottom: 10 }}>
                              <div style={{ fontSize: 11, fontWeight: 600, color, marginBottom: 4, letterSpacing: '0.04em' }}>{label.toUpperCase()}</div>
                              {items.map((pt, j) => <div key={j} style={{ fontSize: 12, color: '#94a3b8', paddingLeft: 8, borderLeft: `2px solid ${color}44`, marginBottom: 2 }}>{pt}</div>)}
                            </div>
                          )
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Limitations */}
              {summary.limitations.length > 0 && (
                <div style={{ padding: '12px 16px', borderRadius: 10, background: 'rgba(148,163,184,0.06)', border: '1px solid rgba(148,163,184,0.15)', fontSize: 12, color: '#64748b' }}>
                  ⚠️ {summary.limitations.join(' ')}
                </div>
              )}
            </div>
          )}
        </section>
      </main>

      <footer style={{ textAlign: 'center', padding: '32px', borderTop: '1px solid #0f172a', color: '#1e293b', fontSize: 12 }}>
        Meet Agent · Personal AI Meeting Assistant · MVP v1.0
      </footer>
    </div>
  );
}
