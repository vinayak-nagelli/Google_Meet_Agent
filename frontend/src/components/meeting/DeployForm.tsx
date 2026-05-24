import { useState } from 'react';
import { motion } from 'framer-motion';
import { Bot, Link, User, Zap, FileText, Mic, Camera, ChevronDown, ChevronUp, AlertCircle, Loader2, Sparkles } from 'lucide-react';

const BACKEND_URL = 'http://localhost:8000';

interface DeployFormProps {
  onDeployed: (session: any) => void;
}

// ⚠️ IMPORTANT: InputField MUST be defined outside DeployForm.
// If defined inside, React creates a new component type on every render,
// which destroys and remounts the input on each keystroke, causing focus loss.
interface InputFieldProps {
  label: string;
  icon: any;
  name: string;
  placeholder: string;
  type?: string;
  hint?: string;
  required?: boolean;
  value: string;
  errors: Record<string, string>;
  onChange: (name: string, value: string) => void;
}

function InputField({ label, icon: Icon, name, placeholder, type = 'text', hint, required = false, value, errors, onChange }: InputFieldProps) {
  return (
    <div>
      <label className="label">
        <Icon className="w-3.5 h-3.5 inline mr-1.5 text-indigo-400" />
        {label}
        {required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      <input
        type={type}
        value={value}
        onChange={e => onChange(name, e.target.value)}
        placeholder={placeholder}
        className={`input-field ${errors[name] ? 'border-red-400 focus:ring-red-400' : ''}`}
      />
      {errors[name] && (
        <div className="flex items-center gap-1 mt-1 text-xs text-red-500">
          <AlertCircle className="w-3 h-3" /> {errors[name]}
        </div>
      )}
      {hint && !errors[name] && <p className="text-[11px] text-slate-400 mt-1">{hint}</p>}
    </div>
  );
}

export default function DeployForm({ onDeployed }: DeployFormProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showAdvanced, setShowAdvanced] = useState(false);

  const [form, setForm] = useState({
    meet_link: '',
    bot_name: 'MeetAgent',
    user_name: '',
    meeting_title: '',
    meeting_description: '',
    auto_instruction: '',
    user_context: '',
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  const set = (k: string, v: string) => {
    setForm(p => ({ ...p, [k]: v }));
    setErrors(p => ({ ...p, [k]: '' }));
  };

  const validate = () => {
    const e: Record<string, string> = {};
    if (!form.meet_link.startsWith('http')) e.meet_link = 'Enter a valid Google Meet link starting with https://';
    if (!form.user_name.trim()) e.user_name = 'Your name is required';
    if (!form.bot_name.trim()) e.bot_name = 'Bot name is required';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleDeploy = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`${BACKEND_URL}/bot/deploy`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          meet_link: form.meet_link,
          bot_name: form.bot_name,
          user_name: form.user_name,
          auto_instruction: form.auto_instruction,
          user_context: [form.meeting_title, form.meeting_description, form.user_context].filter(Boolean).join('\n'),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'Deploy failed');
      onDeployed({ ...data, meeting_title: form.meeting_title, meeting_description: form.meeting_description });
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <motion.div
      className="max-w-2xl mx-auto"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
    >
      <div className="mb-6">
        <div className="section-title">New Session</div>
        <h2 className="text-2xl font-bold text-slate-900">Deploy AI Meeting Agent</h2>
        <p className="text-sm text-slate-500 mt-1">Configure and launch your AI agent for a Google Meet session.</p>
      </div>

      <form onSubmit={handleDeploy} className="space-y-5">

        {/* Basic Meeting Info */}
        <motion.div className="glass-card space-y-4" initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
          <div className="flex items-center gap-2 pb-3 border-b border-slate-100/80">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-indigo-500 to-cyan-500 flex items-center justify-center shadow-sm">
              <Link className="w-4 h-4 text-white" />
            </div>
            <span className="font-bold text-slate-800 text-sm">Meeting Information</span>
          </div>

          <InputField label="Google Meet Link" icon={Link} name="meet_link" placeholder="https://meet.google.com/abc-defg-hij" required hint="Paste the full Google Meet URL here" value={form.meet_link} errors={errors} onChange={set} />
          <InputField label="Meeting Title" icon={FileText} name="meeting_title" placeholder="e.g. Project Sprint Review" hint="Optional — helps organize meeting memory" value={form.meeting_title} errors={errors} onChange={set} />
          <div>
            <label className="label">
              <FileText className="w-3.5 h-3.5 inline mr-1.5 text-indigo-400" />
              Meeting Purpose / Description
            </label>
            <textarea
              value={form.meeting_description}
              onChange={e => set('meeting_description', e.target.value)}
              placeholder="Briefly describe what this meeting is about..."
              rows={2}
              className="input-field resize-none"
            />
          </div>
        </motion.div>

        {/* Agent Identity */}
        <motion.div className="glass-card space-y-4" initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
          <div className="flex items-center gap-2 pb-3 border-b border-slate-100/80">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-teal-500 to-emerald-500 flex items-center justify-center shadow-sm">
              <Bot className="w-4 h-4 text-white" />
            </div>
            <span className="font-bold text-slate-800 text-sm">Agent Identity</span>
          </div>

          <InputField label="Your Name" icon={User} name="user_name" placeholder="e.g. Swapnil" required hint="The bot will alert you if your name is mentioned" value={form.user_name} errors={errors} onChange={set} />
          <InputField label="Bot Display Name" icon={Bot} name="bot_name" placeholder="MeetAgent" required hint="This name appears in the meeting chat" value={form.bot_name} errors={errors} onChange={set} />
        </motion.div>

        {/* Instructions */}
        <motion.div className="glass-card space-y-4" initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
          <div className="flex items-center gap-2 pb-3 border-b border-slate-100/80">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center shadow-sm">
              <Zap className="w-4 h-4 text-white" />
            </div>
            <span className="font-bold text-slate-800 text-sm">Auto-Reply Instructions</span>
          </div>

          <div>
            <label className="label">
              <Zap className="w-3.5 h-3.5 inline mr-1.5 text-indigo-400" />
              Auto-Reply Rule
            </label>
            <textarea
              value={form.auto_instruction}
              onChange={e => set('auto_instruction', e.target.value)}
              placeholder={`Example:\nIf someone asks about the deadline, reply: "The deadline is Friday at 5PM."`}
              rows={3}
              className="input-field resize-none"
            />
            <p className="text-[11px] text-slate-400 mt-1">Teach the bot how to respond automatically in certain situations.</p>
          </div>

          {/* Advanced */}
          <button
            type="button"
            onClick={() => setShowAdvanced(p => !p)}
            className="flex items-center gap-1.5 text-xs font-semibold text-indigo-600 hover:text-indigo-700 transition-colors"
          >
            {showAdvanced ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            {showAdvanced ? 'Hide' : 'Show'} advanced context
          </button>

          {showAdvanced && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} transition={{ duration: 0.3 }}>
              <label className="label">
                <User className="w-3.5 h-3.5 inline mr-1.5 text-indigo-400" />
                Your Context / Persona
              </label>
              <textarea
                value={form.user_context}
                onChange={e => set('user_context', e.target.value)}
                placeholder="Tell the AI who you are, your role, and any special context it should know..."
                rows={3}
                className="input-field resize-none"
              />
            </motion.div>
          )}
        </motion.div>

        {/* Capture Options */}
        <motion.div className="glass-card" initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}>
          <div className="flex items-center gap-2 pb-3 border-b border-slate-100/80 mb-4">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-500 flex items-center justify-center shadow-sm">
              <Camera className="w-4 h-4 text-white" />
            </div>
            <span className="font-bold text-slate-800 text-sm">Capture Options</span>
          </div>
          <div className="grid grid-cols-3 gap-3">
            {[
              { icon: Mic, label: 'Audio Recording', gradient: 'from-blue-50 to-cyan-50', border: 'border-blue-200', text: 'text-blue-700' },
              { icon: FileText, label: 'Transcription', gradient: 'from-emerald-50 to-teal-50', border: 'border-emerald-200', text: 'text-emerald-700' },
              { icon: Camera, label: 'Screenshots', gradient: 'from-purple-50 to-indigo-50', border: 'border-purple-200', text: 'text-purple-700' },
            ].map(({ icon: Icon, label, gradient, border, text }) => (
              <div key={label} className={`flex flex-col items-center gap-1.5 p-4 rounded-2xl border bg-gradient-to-br ${gradient} ${border} ${text}`}>
                <Icon className="w-5 h-5" />
                <span className="text-xs font-semibold text-center">{label}</span>
                <span className="text-[10px] opacity-60 font-medium">Always On</span>
              </div>
            ))}
          </div>
        </motion.div>

        {/* Error */}
        {error && (
          <motion.div
            className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }}
          >
            <AlertCircle className="w-4 h-4 flex-shrink-0" /> {error}
          </motion.div>
        )}

        {/* Deploy button */}
        <motion.button
          type="submit"
          disabled={loading}
          className="w-full flex items-center justify-center gap-2 text-white font-bold py-4 rounded-2xl shadow-lg text-base disabled:opacity-60 disabled:cursor-not-allowed transition-all duration-300"
          style={{ background: 'var(--gradient-primary)' }}
          whileHover={{ scale: 1.01, boxShadow: '0 8px 32px rgba(79,70,229,0.4)' }}
          whileTap={{ scale: 0.98 }}
        >
          {loading ? (
            <><Loader2 className="w-5 h-5 animate-spin" /> Launching Agent...</>
          ) : (
            <><Sparkles className="w-5 h-5" /> Deploy AI Agent</>
          )}
        </motion.button>
      </form>
    </motion.div>
  );
}
