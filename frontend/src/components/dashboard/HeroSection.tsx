import { motion } from 'framer-motion';
import { Bot, Brain, Mic, Camera, FileText, MessageSquare, Sparkles, ArrowRight, Zap } from 'lucide-react';

type Page = 'home' | 'deploy' | 'active' | 'memory';

const features = [
  { icon: MessageSquare, label: 'Live Chat Monitoring', desc: 'Captures every message in real-time' },
  { icon: Mic, label: 'Audio Recording', desc: 'Records & transcribes meeting audio' },
  { icon: Camera, label: 'Slide Capture', desc: 'Screenshots presentations automatically' },
  { icon: Sparkles, label: 'AI Summary', desc: 'Generates intelligent meeting reports' },
  { icon: Brain, label: 'Meeting Memory', desc: 'Searchable archive of all meetings' },
  { icon: Zap, label: 'Auto-Reply', desc: 'Responds to chats on your behalf' },
];

const flowSteps = [
  'Deploy Bot', 'Opens Meet', 'Joins Meeting', 'Monitors Chat',
  'Records Audio', 'Captures Slides', 'AI Summary', 'Saved to Memory'
];

// CSS-based 3D floating elements for the hero
function Hero3DVisual() {
  return (
    <div className="relative w-full h-80 perspective-container">
      {/* Central AI Agent */}
      <motion.div
        className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-10"
        animate={{ y: [-8, 8, -8] }}
        transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
      >
        <div className="w-24 h-24 rounded-3xl bg-gradient-to-br from-indigo-500 via-purple-500 to-cyan-500 flex items-center justify-center shadow-2xl animate-glow">
          <Bot className="w-12 h-12 text-white" />
        </div>
        <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-16 h-3 bg-indigo-500/20 rounded-full blur-md" />
      </motion.div>

      {/* Floating Meet Window */}
      <motion.div
        className="absolute right-4 top-6 floating-card w-44"
        animate={{ y: [-4, 6, -4], rotate: [-1, 1, -1] }}
        transition={{ duration: 5, repeat: Infinity, ease: 'easeInOut', delay: 0.5 }}
      >
        <div className="flex items-center gap-2 mb-2">
          <div className="w-2 h-2 rounded-full bg-red-400" />
          <div className="w-2 h-2 rounded-full bg-amber-400" />
          <div className="w-2 h-2 rounded-full bg-green-400" />
          <span className="text-[10px] text-white/50 ml-1">Google Meet</span>
        </div>
        <div className="grid grid-cols-2 gap-1.5">
          {[1,2,3,4].map(i => (
            <div key={i} className="aspect-video rounded-md bg-white/10 flex items-center justify-center">
              <div className="w-4 h-4 rounded-full bg-white/20" />
            </div>
          ))}
        </div>
      </motion.div>

      {/* Floating Chat Bubbles */}
      <motion.div
        className="absolute left-2 top-12 floating-card px-3 py-2"
        animate={{ y: [-6, 4, -6], x: [-2, 2, -2] }}
        transition={{ duration: 4.5, repeat: Infinity, ease: 'easeInOut', delay: 1 }}
      >
        <div className="text-[10px] text-cyan-300 font-semibold mb-1">Chat</div>
        <div className="space-y-1">
          <div className="h-1.5 w-20 rounded-full bg-white/15" />
          <div className="h-1.5 w-14 rounded-full bg-cyan-400/20" />
          <div className="h-1.5 w-18 rounded-full bg-white/10" />
        </div>
      </motion.div>

      {/* Audio Waveform */}
      <motion.div
        className="absolute left-8 bottom-8 floating-card px-3 py-2"
        animate={{ y: [-3, 5, -3] }}
        transition={{ duration: 3.5, repeat: Infinity, ease: 'easeInOut', delay: 0.8 }}
      >
        <div className="text-[10px] text-emerald-300 font-semibold mb-1.5">Audio</div>
        <div className="flex items-end gap-[2px] h-5">
          {[0.3, 0.7, 0.5, 1, 0.4, 0.8, 0.6, 0.3, 0.9, 0.5, 0.7, 0.4].map((h, i) => (
            <div
              key={i}
              className="waveform-bar bg-emerald-400/60"
              style={{ animationDelay: `${i * 0.08}s`, height: `${h * 20}px` }}
            />
          ))}
        </div>
      </motion.div>

      {/* Summary Card */}
      <motion.div
        className="absolute right-6 bottom-4 floating-card w-36 px-3 py-2"
        animate={{ y: [-5, 5, -5], rotate: [1, -1, 1] }}
        transition={{ duration: 5.5, repeat: Infinity, ease: 'easeInOut', delay: 1.5 }}
      >
        <div className="text-[10px] text-purple-300 font-semibold mb-1.5">AI Report</div>
        <div className="space-y-1">
          <div className="h-1.5 w-full rounded-full bg-purple-400/20" />
          <div className="h-1.5 w-3/4 rounded-full bg-white/10" />
          <div className="flex gap-1 mt-1.5">
            <div className="h-3 w-10 rounded bg-emerald-400/20 text-[6px] text-emerald-300 flex items-center justify-center">3 actions</div>
            <div className="h-3 w-8 rounded bg-red-400/20 text-[6px] text-red-300 flex items-center justify-center">1 deadline</div>
          </div>
        </div>
      </motion.div>

      {/* Orbiting particles */}
      {[0, 1, 2].map(i => (
        <div key={i} className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2" style={{ animation: `orbit ${10 + i * 4}s linear infinite`, animationDelay: `${i * 2}s` }}>
          <div className={`w-2 h-2 rounded-full ${i === 0 ? 'bg-indigo-400' : i === 1 ? 'bg-cyan-400' : 'bg-purple-400'} opacity-60`} />
        </div>
      ))}
    </div>
  );
}

export default function HeroSection({ onNavigate }: { onNavigate: (p: Page) => void }) {
  return (
    <div className="space-y-8">
      {/* Hero Banner */}
      <motion.div
        className="hero-gradient rounded-3xl overflow-hidden"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
      >
        <div className="relative grid md:grid-cols-2 gap-6 p-8 md:p-12 items-center">
          {/* Left: Text */}
          <div className="relative z-10">
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.2, duration: 0.5 }}
            >
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/10 text-cyan-300 text-xs font-semibold mb-4 border border-white/10">
                <Sparkles className="w-3 h-3" />
                Powered by Groq AI
              </div>
              <h1 className="text-3xl md:text-4xl font-extrabold text-white leading-tight mb-3">
                Meet<span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-300 to-indigo-300">Agent</span>
              </h1>
              <p className="text-lg text-indigo-200 font-medium mb-2">Personal AI Meeting Assistant</p>
              <p className="text-sm text-slate-300/80 leading-relaxed max-w-md mb-6">
                Deploy an AI agent that joins Google Meet, monitors chat and audio, captures presentations, and generates intelligent meeting reports.
              </p>
              <div className="flex gap-3">
                <button onClick={() => onNavigate('deploy')} className="btn-primary flex items-center gap-2 text-sm">
                  <Bot className="w-4 h-4" />
                  Deploy AI Agent
                  <ArrowRight className="w-4 h-4" />
                </button>
                <button onClick={() => onNavigate('memory')} className="btn-secondary !bg-white/10 !text-white !border-white/20 hover:!bg-white/20 text-sm">
                  <Brain className="w-4 h-4 inline mr-1.5" />
                  Meeting Memory
                </button>
              </div>
            </motion.div>
          </div>

          {/* Right: 3D Visual */}
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.4, duration: 0.6 }}
          >
            <Hero3DVisual />
          </motion.div>
        </div>
      </motion.div>

      {/* Flow Steps */}
      <motion.div
        className="glass-card"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5, duration: 0.5 }}
      >
        <div className="text-xs font-bold tracking-widest text-indigo-500 uppercase mb-4">How It Works</div>
        <div className="flex items-center overflow-x-auto pb-2 gap-0">
          {flowSteps.map((step, i) => (
            <div key={step} className="flex items-center flex-shrink-0">
              <motion.div
                className="flex flex-col items-center gap-1.5"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.6 + i * 0.08 }}
              >
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-500 to-cyan-500 flex items-center justify-center text-white text-xs font-bold shadow-md">
                  {i + 1}
                </div>
                <span className="text-[11px] font-medium text-slate-600 whitespace-nowrap px-1">{step}</span>
              </motion.div>
              {i < flowSteps.length - 1 && (
                <div className="h-0.5 w-8 mx-1 mt-[-14px] bg-gradient-to-r from-indigo-400 to-cyan-400 rounded-full opacity-40" />
              )}
            </div>
          ))}
        </div>
      </motion.div>

      {/* Feature Cards */}
      <div>
        <div className="text-xs font-bold tracking-widest text-indigo-500 uppercase mb-3">Core Features</div>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {features.map(({ icon: Icon, label, desc }, i) => (
            <motion.div
              key={label}
              className="glass-card glass-card-hover p-5 group cursor-default"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.7 + i * 0.08 }}
            >
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-100 to-cyan-100 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform duration-300">
                <Icon className="w-5 h-5 text-indigo-600" />
              </div>
              <div className="font-semibold text-slate-800 text-sm mb-1">{label}</div>
              <div className="text-xs text-slate-500">{desc}</div>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );
}
