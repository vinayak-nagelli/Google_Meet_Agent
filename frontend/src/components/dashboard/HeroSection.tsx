import { Bot, Mic, MessageSquare, Zap, FileText, Brain, Camera, ArrowRight, CheckCircle2 } from 'lucide-react';

type Page = 'home' | 'deploy' | 'active' | 'memory';

interface HeroSectionProps {
  onNavigate: (page: Page) => void;
}

const features = [
  { icon: Bot, label: 'Auto Join', color: 'text-indigo-600 bg-indigo-50', desc: 'Joins silently, mic & cam off' },
  { icon: MessageSquare, label: 'Chat Monitor', color: 'text-teal-600 bg-teal-50', desc: 'Real-time message tracking' },
  { icon: Zap, label: 'Smart Reply', color: 'text-amber-600 bg-amber-50', desc: 'Context-aware AI responses' },
  { icon: Mic, label: 'Audio Record', color: 'text-blue-600 bg-blue-50', desc: 'Chunked WAV recording' },
  { icon: FileText, label: 'Transcript + Summary', color: 'text-emerald-600 bg-emerald-50', desc: 'Whisper + Groq AI analysis' },
  { icon: Brain, label: 'Meeting Memory', color: 'text-purple-600 bg-purple-50', desc: 'Searchable past meetings' },
];

const steps = [
  { label: 'Deploy Bot', icon: Bot },
  { label: 'Join Meeting', icon: Zap },
  { label: 'Monitor', icon: MessageSquare },
  { label: 'Assist', icon: CheckCircle2 },
  { label: 'Summarize', icon: FileText },
  { label: 'Save Memory', icon: Brain },
];

export default function HeroSection({ onNavigate }: HeroSectionProps) {
  return (
    <div className="space-y-12">
      {/* Hero */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-indigo-600 via-indigo-700 to-teal-600 p-10 text-white shadow-xl">
        {/* Decorative circles */}
        <div className="absolute -top-12 -right-12 w-48 h-48 rounded-full bg-white/5 blur-sm" />
        <div className="absolute top-8 -right-4 w-28 h-28 rounded-full bg-white/5" />
        <div className="absolute -bottom-8 -left-8 w-40 h-40 rounded-full bg-teal-500/20" />

        <div className="relative flex items-center justify-between gap-8">
          <div className="flex-1 max-w-2xl">
            <div className="inline-flex items-center gap-2 bg-white/10 backdrop-blur-sm px-3 py-1 rounded-full text-xs font-semibold mb-4 border border-white/20">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              AI-Powered · Real-time · Google Meet
            </div>
            <h1 className="text-4xl font-extrabold leading-tight mb-4">
              MeetAgent<br />
              <span className="text-teal-300">AI Meeting Assistant</span>
            </h1>
            <p className="text-white/80 text-base leading-relaxed mb-8 max-w-xl">
              An AI agent that joins Google Meet on your behalf, monitors chat and audio in real-time, responds intelligently, records the meeting, generates summaries, and stores everything in searchable memory.
            </p>
            <div className="flex gap-3 flex-wrap">
              <button
                onClick={() => onNavigate('deploy')}
                className="flex items-center gap-2 bg-white text-indigo-700 font-bold px-6 py-3 rounded-xl hover:shadow-lg hover:scale-105 transition-all duration-200 text-sm"
              >
                <Bot className="w-4 h-4" />
                Deploy AI Agent
              </button>
              <button
                onClick={() => onNavigate('memory')}
                className="flex items-center gap-2 bg-white/10 border border-white/20 text-white font-semibold px-6 py-3 rounded-xl hover:bg-white/20 transition-all duration-200 text-sm backdrop-blur-sm"
              >
                <Brain className="w-4 h-4" />
                Meeting Memory
              </button>
            </div>
          </div>

          {/* AI Robot Illustration */}
          <div className="hidden lg:flex flex-col items-center justify-center animate-float">
            <div className="relative">
              <div className="w-36 h-36 rounded-3xl bg-white/10 backdrop-blur-sm border border-white/20 flex items-center justify-center shadow-2xl">
                <Bot className="w-20 h-20 text-white" strokeWidth={1.2} />
              </div>
              {/* Orbiting dots */}
              <div className="absolute -top-2 -right-2 w-5 h-5 rounded-full bg-teal-400 flex items-center justify-center shadow-lg animate-bounce">
                <Mic className="w-3 h-3 text-white" />
              </div>
              <div className="absolute -bottom-2 -left-2 w-5 h-5 rounded-full bg-amber-400 flex items-center justify-center shadow-lg">
                <MessageSquare className="w-3 h-3 text-white" />
              </div>
              <div className="absolute top-1/2 -right-4 w-5 h-5 rounded-full bg-purple-400 flex items-center justify-center shadow-lg">
                <Camera className="w-3 h-3 text-white" />
              </div>
            </div>
            <div className="mt-4 text-center">
              <div className="text-xs text-white/60">Your AI meeting companion</div>
            </div>
          </div>
        </div>
      </div>

      {/* How it works */}
      <div className="card">
        <div className="section-title">How It Works</div>
        <h2 className="text-xl font-bold text-slate-800 mb-6">6 Steps to a Smarter Meeting</h2>
        <div className="flex items-center gap-0 overflow-x-auto pb-2">
          {steps.map((step, i) => {
            const Icon = step.icon;
            return (
              <div key={i} className="flex items-center flex-shrink-0">
                <div className={`flex flex-col items-center animate-fade-in-up stagger-${i + 1}`}>
                  <div className="w-12 h-12 rounded-xl bg-indigo-600 flex items-center justify-center shadow-sm mb-2">
                    <Icon className="w-6 h-6 text-white" />
                  </div>
                  <span className="text-xs font-semibold text-slate-700 text-center whitespace-nowrap px-2">{step.label}</span>
                </div>
                {i < steps.length - 1 && (
                  <ArrowRight className="w-5 h-5 text-slate-300 mx-1 flex-shrink-0" />
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Feature grid */}
      <div>
        <div className="section-title">Capabilities</div>
        <h2 className="text-xl font-bold text-slate-800 mb-6">Everything MeetAgent Does</h2>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {features.map((f, i) => {
            const Icon = f.icon;
            return (
              <div key={i} className={`card card-hover animate-fade-in-up stagger-${i + 1}`}>
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-3 ${f.color}`}>
                  <Icon className="w-5 h-5" />
                </div>
                <div className="font-bold text-slate-800 text-sm mb-1">{f.label}</div>
                <div className="text-xs text-slate-500 leading-relaxed">{f.desc}</div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
