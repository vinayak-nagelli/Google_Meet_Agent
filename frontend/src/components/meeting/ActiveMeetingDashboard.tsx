import { Bot, Link, User, Clock, Radio, Mic, FileText, Camera, CheckCircle2, Loader2, Circle, XCircle } from 'lucide-react';

// These keys MUST match exactly what the backend/bot emits as 'status' strings
const STATUS_STEPS = [
  { key: 'created', label: 'Created' },
  { key: 'launching', label: 'Launching' },
  { key: 'opened_meet', label: 'Opened Meet' },
  { key: 'joining', label: 'Joining' },
  { key: 'joined', label: 'Joined' },
  { key: 'monitoring_chat', label: 'Monitoring' },
  { key: 'stopped', label: 'Completed' },
];

const STATUS_ORDER = STATUS_STEPS.map(s => s.key);

function getStepState(stepKey: string, currentStatus: string): 'done' | 'active' | 'pending' | 'failed' {
  if (currentStatus === 'failed') {
    // Show steps up to 'joining' as done when failed
    const failedAt = STATUS_ORDER.indexOf('joining');
    const step = STATUS_ORDER.indexOf(stepKey);
    if (step < failedAt) return 'done';
    if (step === failedAt) return 'failed';
    return 'pending';
  }
  // 'stopped' means everything is done
  if (currentStatus === 'stopped') return 'done';
  const cur = STATUS_ORDER.indexOf(currentStatus);
  const step = STATUS_ORDER.indexOf(stepKey);
  if (cur === -1) return 'pending'; // unknown status — don't crash
  if (step < cur) return 'done';
  if (step === cur) return 'active';
  return 'pending';
}

interface ActiveMeetingDashboardProps {
  session: any;
  visualStatus: any;
  isRecording: boolean;
  isTranscribing: boolean;
  hasSummary: boolean;
  chatCount: number;
  onNavigateToOutputs: () => void;
  onStop: () => void;
}

export default function ActiveMeetingDashboard({
  session, visualStatus, isRecording, isTranscribing, hasSummary, chatCount, onNavigateToOutputs, onStop
}: ActiveMeetingDashboardProps) {
  const status = session?.status || 'created';
  const isFailed = status === 'failed';

  const statusCards = [
    {
      label: 'Bot Status',
      icon: Bot,
      value: isFailed ? 'Failed' : status === 'monitoring' || status === 'joined' ? 'Active' : status,
      color: isFailed ? 'text-red-600 bg-red-50 border-red-100' : 'text-indigo-600 bg-indigo-50 border-indigo-100',
      dot: isFailed ? 'status-dot-red' : 'status-dot-green',
    },
    {
      label: 'Chat Messages',
      icon: Radio,
      value: `${chatCount} messages`,
      color: 'text-teal-600 bg-teal-50 border-teal-100',
      dot: chatCount > 0 ? 'status-dot-green' : 'status-dot-gray',
    },
    {
      label: 'Audio Recording',
      icon: Mic,
      value: isRecording ? 'Recording...' : 'Waiting',
      color: isRecording ? 'text-blue-600 bg-blue-50 border-blue-100' : 'text-slate-500 bg-slate-50 border-slate-100',
      dot: isRecording ? 'status-dot-green' : 'status-dot-gray',
    },
    {
      label: 'Transcription',
      icon: FileText,
      value: isTranscribing ? 'Processing...' : 'Idle',
      color: isTranscribing ? 'text-emerald-600 bg-emerald-50 border-emerald-100' : 'text-slate-500 bg-slate-50 border-slate-100',
      dot: isTranscribing ? 'status-dot-amber' : 'status-dot-gray',
    },
    {
      label: 'AI Summary',
      icon: FileText,
      value: hasSummary ? 'Generated' : 'Pending',
      color: hasSummary ? 'text-purple-600 bg-purple-50 border-purple-100' : 'text-slate-500 bg-slate-50 border-slate-100',
      dot: hasSummary ? 'status-dot-green' : 'status-dot-gray',
    },
    {
      label: 'Visual Capture',
      icon: Camera,
      value: visualStatus?.presentation_active ? 'Capturing' : `${visualStatus?.screenshots?.length || 0} slides`,
      color: visualStatus?.presentation_active ? 'text-amber-600 bg-amber-50 border-amber-100' : 'text-slate-500 bg-slate-50 border-slate-100',
      dot: visualStatus?.presentation_active ? 'status-dot-amber' : 'status-dot-gray',
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <div className="section-title">Live Session</div>
          <h2 className="text-2xl font-bold text-slate-900">
            {session?.meeting_title || 'Active Meeting'}
          </h2>
          <div className="flex items-center gap-2 mt-1">
            <span className="status-dot-green" />
            <span className="text-sm text-slate-500">Session #{session?.id}</span>
          </div>
        </div>
        <div className="flex gap-2">
          <button onClick={onNavigateToOutputs} className="btn-secondary text-sm">
            View Outputs
          </button>
          <button onClick={onStop} className="btn-danger text-sm">
            Stop Bot
          </button>
        </div>
      </div>

      {/* Meeting Info Card */}
      <div className="card">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div>
            <div className="text-xs font-semibold text-slate-400 mb-1 flex items-center gap-1"><Link className="w-3 h-3" /> Meet Link</div>
            <a href={session?.meet_link} target="_blank" rel="noreferrer" className="text-sm text-indigo-600 hover:underline font-medium truncate block">
              {session?.meet_link?.replace('https://', '') || '—'}
            </a>
          </div>
          <div>
            <div className="text-xs font-semibold text-slate-400 mb-1 flex items-center gap-1"><Bot className="w-3 h-3" /> Bot Name</div>
            <div className="text-sm font-medium text-slate-800">{session?.bot_name || '—'}</div>
          </div>
          <div>
            <div className="text-xs font-semibold text-slate-400 mb-1 flex items-center gap-1"><User className="w-3 h-3" /> Your Name</div>
            <div className="text-sm font-medium text-slate-800">{session?.user_name || '—'}</div>
          </div>
          <div>
            <div className="text-xs font-semibold text-slate-400 mb-1 flex items-center gap-1"><Clock className="w-3 h-3" /> Started</div>
            <div className="text-sm font-medium text-slate-800">
              {session?.created_at ? new Date(session.created_at).toLocaleTimeString() : '—'}
            </div>
          </div>
        </div>
        {session?.meeting_description && (
          <div className="mt-4 pt-4 border-t border-slate-100">
            <div className="text-xs font-semibold text-slate-400 mb-1">Meeting Purpose</div>
            <div className="text-sm text-slate-700">{session.meeting_description}</div>
          </div>
        )}
      </div>

      {/* Status Timeline */}
      <div className="card">
        <div className="font-bold text-slate-800 text-sm mb-5">Bot Status Timeline</div>
        <div className="flex items-center overflow-x-auto pb-1 gap-0">
          {STATUS_STEPS.map((step, i) => {
            const state = getStepState(step.key, status);
            // For failed state, show the step right before current as failed
            const isFailed_step = isFailed && step.key === 'joining';

            return (
              <div key={step.key} className="flex items-center flex-shrink-0">
                <div className="flex flex-col items-center gap-1.5">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center border-2 transition-all duration-300 ${
                    state === 'done'
                      ? 'bg-indigo-600 border-indigo-600 text-white'
                      : state === 'active'
                      ? 'bg-white border-indigo-600 text-indigo-600'
                      : state === 'failed'
                      ? 'bg-red-100 border-red-400 text-red-600'
                      : 'bg-white border-slate-200 text-slate-300'
                  }`}>
                    {state === 'done'
                      ? <CheckCircle2 className="w-4 h-4" />
                      : state === 'active'
                      ? <Loader2 className="w-4 h-4 animate-spin" />
                      : state === 'failed'
                      ? <XCircle className="w-4 h-4" />
                      : <Circle className="w-4 h-4" />
                    }
                  </div>
                  <span className={`text-xs font-medium whitespace-nowrap px-1 ${
                    state === 'done' ? 'text-indigo-600' :
                    state === 'active' ? 'text-indigo-700 font-bold' :
                    'text-slate-400'
                  }`}>{step.label}</span>
                </div>
                {i < STATUS_STEPS.length - 1 && (
                  <div className={`h-0.5 w-6 mx-0.5 mt-[-12px] flex-shrink-0 transition-all duration-300 ${
                    getStepState(STATUS_STEPS[i + 1].key, status) !== 'pending' ? 'bg-indigo-400' : 'bg-slate-200'
                  }`} />
                )}
              </div>
            );
          })}
        </div>
        {isFailed && session?.error_message && (
          <div className="mt-4 flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
            <XCircle className="w-4 h-4 flex-shrink-0" />
            {session.error_message}
          </div>
        )}
      </div>

      {/* Live Status Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        {statusCards.map(({ label, icon: Icon, value, color, dot }) => (
          <div key={label} className={`flex items-start gap-3 p-4 rounded-2xl border ${color} transition-all duration-200`}>
            <div className="w-9 h-9 rounded-xl bg-white/60 flex items-center justify-center flex-shrink-0">
              <Icon className="w-4.5 h-4.5" />
            </div>
            <div>
              <div className="text-xs font-semibold opacity-70 mb-0.5">{label}</div>
              <div className="flex items-center gap-1.5">
                <span className={dot} />
                <span className="text-sm font-bold">{value}</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
