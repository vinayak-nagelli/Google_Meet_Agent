import { motion } from 'framer-motion';
import { Bot, Link, User, Clock, Radio, Mic, FileText, Camera, CheckCircle2, Loader2, Circle, XCircle, Sparkles, StopCircle } from 'lucide-react';

// These keys MUST match exactly what the backend/bot emits as 'status' strings
const STATUS_STEPS = [
  { key: 'created', label: 'Created', icon: Circle },
  { key: 'launching', label: 'Launching', icon: Loader2 },
  { key: 'opened_meet', label: 'Opened Meet', icon: Link },
  { key: 'joining', label: 'Joining', icon: Bot },
  { key: 'joined', label: 'Joined', icon: CheckCircle2 },
  { key: 'monitoring_chat', label: 'Monitoring', icon: Radio },
  { key: 'stopped', label: 'Completed', icon: CheckCircle2 },
];

const STATUS_ORDER = STATUS_STEPS.map(s => s.key);

function getStepState(stepKey: string, currentStatus: string): 'done' | 'active' | 'pending' | 'failed' {
  if (currentStatus === 'failed') {
    const failedAt = STATUS_ORDER.indexOf('joining');
    const step = STATUS_ORDER.indexOf(stepKey);
    if (step < failedAt) return 'done';
    if (step === failedAt) return 'failed';
    return 'pending';
  }
  if (currentStatus === 'stopped') return 'done';
  const cur = STATUS_ORDER.indexOf(currentStatus);
  const step = STATUS_ORDER.indexOf(stepKey);
  if (cur === -1) return 'pending';
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
      label: 'Bot Status', icon: Bot,
      value: isFailed ? 'Failed' : status === 'monitoring_chat' || status === 'joined' ? 'Active' : status,
      gradient: isFailed ? 'from-red-50 to-rose-50' : 'from-indigo-50 to-blue-50',
      iconColor: isFailed ? 'from-red-500 to-rose-500' : 'from-indigo-500 to-blue-500',
      dot: isFailed ? 'status-dot-red' : 'status-dot-green',
    },
    {
      label: 'Chat Messages', icon: Radio,
      value: `${chatCount} messages`,
      gradient: 'from-teal-50 to-cyan-50', iconColor: 'from-teal-500 to-cyan-500',
      dot: chatCount > 0 ? 'status-dot-green' : 'status-dot-gray',
    },
    {
      label: 'Audio Recording', icon: Mic,
      value: isRecording ? 'Recording...' : 'Waiting',
      gradient: isRecording ? 'from-blue-50 to-sky-50' : 'from-slate-50 to-gray-50',
      iconColor: isRecording ? 'from-blue-500 to-sky-500' : 'from-slate-400 to-gray-400',
      dot: isRecording ? 'status-dot-green' : 'status-dot-gray',
    },
    {
      label: 'Transcription', icon: FileText,
      value: isTranscribing ? 'Processing...' : 'Idle',
      gradient: isTranscribing ? 'from-emerald-50 to-green-50' : 'from-slate-50 to-gray-50',
      iconColor: isTranscribing ? 'from-emerald-500 to-green-500' : 'from-slate-400 to-gray-400',
      dot: isTranscribing ? 'status-dot-amber' : 'status-dot-gray',
    },
    {
      label: 'AI Summary', icon: Sparkles,
      value: hasSummary ? 'Generated' : 'Pending',
      gradient: hasSummary ? 'from-purple-50 to-violet-50' : 'from-slate-50 to-gray-50',
      iconColor: hasSummary ? 'from-purple-500 to-violet-500' : 'from-slate-400 to-gray-400',
      dot: hasSummary ? 'status-dot-green' : 'status-dot-gray',
    },
    {
      label: 'Visual Capture', icon: Camera,
      value: visualStatus?.presentation_active ? 'Capturing' : `${visualStatus?.screenshots?.length || 0} slides`,
      gradient: visualStatus?.presentation_active ? 'from-amber-50 to-orange-50' : 'from-slate-50 to-gray-50',
      iconColor: visualStatus?.presentation_active ? 'from-amber-500 to-orange-500' : 'from-slate-400 to-gray-400',
      dot: visualStatus?.presentation_active ? 'status-dot-amber' : 'status-dot-gray',
    },
  ];

  return (
    <motion.div className="space-y-6" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.4 }}>
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
          <button onClick={onNavigateToOutputs} className="btn-secondary text-sm py-2">
            View Outputs
          </button>
          <motion.button
            onClick={onStop}
            className="btn-danger text-sm py-2 flex items-center gap-1.5"
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.97 }}
          >
            <StopCircle className="w-4 h-4" />
            Stop Bot
          </motion.button>
        </div>
      </div>

      {/* Meeting Info Card */}
      <motion.div className="glass-card" initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div>
            <div className="text-[11px] font-semibold text-slate-400 mb-1 flex items-center gap-1"><Link className="w-3 h-3" /> Meet Link</div>
            <a href={session?.meet_link} target="_blank" rel="noreferrer" className="text-sm text-indigo-600 hover:underline font-medium truncate block">
              {session?.meet_link?.replace('https://', '') || '—'}
            </a>
          </div>
          <div>
            <div className="text-[11px] font-semibold text-slate-400 mb-1 flex items-center gap-1"><Bot className="w-3 h-3" /> Bot Name</div>
            <div className="text-sm font-medium text-slate-800">{session?.bot_name || '—'}</div>
          </div>
          <div>
            <div className="text-[11px] font-semibold text-slate-400 mb-1 flex items-center gap-1"><User className="w-3 h-3" /> Your Name</div>
            <div className="text-sm font-medium text-slate-800">{session?.user_name || '—'}</div>
          </div>
          <div>
            <div className="text-[11px] font-semibold text-slate-400 mb-1 flex items-center gap-1"><Clock className="w-3 h-3" /> Started</div>
            <div className="text-sm font-medium text-slate-800">
              {session?.created_at ? new Date(session.created_at).toLocaleTimeString() : '—'}
            </div>
          </div>
        </div>
        {session?.meeting_description && (
          <div className="mt-4 pt-4 border-t border-slate-100/80">
            <div className="text-[11px] font-semibold text-slate-400 mb-1">Meeting Purpose</div>
            <div className="text-sm text-slate-700">{session.meeting_description}</div>
          </div>
        )}
      </motion.div>

      {/* Status Timeline */}
      <motion.div className="glass-card" initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
        <div className="font-bold text-slate-800 text-sm mb-5">Bot Status Timeline</div>
        <div className="flex items-center overflow-x-auto pb-1 gap-0">
          {STATUS_STEPS.map((step, i) => {
            const state = getStepState(step.key, status);
            return (
              <div key={step.key} className="flex items-center flex-shrink-0">
                <motion.div
                  className="flex flex-col items-center gap-1.5"
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.3 + i * 0.06 }}
                >
                  <div className={`w-9 h-9 rounded-full flex items-center justify-center border-2 transition-all duration-500 ${
                    state === 'done'
                      ? 'border-indigo-500 text-white shadow-md'
                      : state === 'active'
                      ? 'bg-white border-indigo-500 text-indigo-600 shadow-md'
                      : state === 'failed'
                      ? 'bg-red-100 border-red-400 text-red-600'
                      : 'bg-white border-slate-200 text-slate-300'
                  }`} style={state === 'done' ? { background: 'var(--gradient-primary)' } : {}}>
                    {state === 'done'
                      ? <CheckCircle2 className="w-4 h-4" />
                      : state === 'active'
                      ? <Loader2 className="w-4 h-4 animate-spin" />
                      : state === 'failed'
                      ? <XCircle className="w-4 h-4" />
                      : <Circle className="w-3.5 h-3.5" />
                    }
                  </div>
                  <span className={`text-[11px] font-medium whitespace-nowrap px-1 ${
                    state === 'done' ? 'text-indigo-600' :
                    state === 'active' ? 'text-indigo-700 font-bold' :
                    state === 'failed' ? 'text-red-500' :
                    'text-slate-400'
                  }`}>{step.label}</span>
                </motion.div>
                {i < STATUS_STEPS.length - 1 && (
                  <div className={`h-0.5 w-7 mx-0.5 mt-[-14px] flex-shrink-0 transition-all duration-500 rounded-full ${
                    getStepState(STATUS_STEPS[i + 1].key, status) !== 'pending'
                      ? 'bg-gradient-to-r from-indigo-400 to-cyan-400'
                      : 'bg-slate-200'
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
      </motion.div>

      {/* Live Status Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        {statusCards.map(({ label, icon: Icon, value, gradient, iconColor, dot }, i) => (
          <motion.div
            key={label}
            className={`glass-card glass-card-hover p-4 bg-gradient-to-br ${gradient}`}
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 + i * 0.05 }}
          >
            <div className="flex items-start gap-3">
              <div className={`w-9 h-9 rounded-xl bg-gradient-to-br ${iconColor} flex items-center justify-center flex-shrink-0 shadow-sm`}>
                <Icon className="w-4 h-4 text-white" />
              </div>
              <div>
                <div className="text-[11px] font-semibold text-slate-500 mb-0.5">{label}</div>
                <div className="flex items-center gap-1.5">
                  <span className={dot} />
                  <span className="text-sm font-bold text-slate-800">{value}</span>
                </div>
              </div>
            </div>
          </motion.div>
        ))}
      </div>
    </motion.div>
  );
}
