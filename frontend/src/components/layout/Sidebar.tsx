import { Bot, Radio, LayoutDashboard, PlusCircle, Brain } from 'lucide-react';
import { motion } from 'framer-motion';

type Page = 'home' | 'deploy' | 'active' | 'memory';

interface SidebarProps {
  currentPage: Page;
  onNavigate: (page: Page) => void;
  hasActiveSession: boolean;
}

const navItems = [
  { id: 'home' as Page, icon: LayoutDashboard, label: 'Dashboard' },
  { id: 'deploy' as Page, icon: PlusCircle, label: 'Deploy Agent' },
  { id: 'active' as Page, icon: Radio, label: 'Active Meeting' },
  { id: 'memory' as Page, icon: Brain, label: 'Meeting Memory' },
];

export default function Sidebar({ currentPage, onNavigate, hasActiveSession }: SidebarProps) {
  return (
    <aside className="w-64 flex-shrink-0 h-screen sticky top-0 flex flex-col border-r border-slate-200/50" style={{ background: 'rgba(255,255,255,0.6)', backdropFilter: 'blur(20px)' }}>
      {/* Logo */}
      <div className="px-6 py-5 border-b border-slate-100/80">
        <div className="flex items-center gap-3">
          <motion.div
            className="w-10 h-10 rounded-2xl flex items-center justify-center shadow-lg"
            style={{ background: 'var(--gradient-primary)' }}
            whileHover={{ scale: 1.05, rotate: 5 }}
            transition={{ type: 'spring', stiffness: 400 }}
          >
            <Bot className="w-5 h-5 text-white" />
          </motion.div>
          <div>
            <div className="font-bold text-slate-900 text-sm leading-tight">MeetAgent</div>
            <div className="text-[11px] text-slate-400 leading-tight">AI Meeting Assistant</div>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-5 space-y-1">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = currentPage === item.id;
          const isDisabled = item.id === 'active' && !hasActiveSession;

          return (
            <motion.button
              key={item.id}
              onClick={() => !isDisabled && onNavigate(item.id)}
              className={`sidebar-link w-full text-left ${isActive ? 'sidebar-link-active' : 'sidebar-link-inactive'} ${isDisabled ? 'opacity-35 cursor-not-allowed' : ''}`}
              whileHover={!isDisabled ? { x: 4 } : {}}
              whileTap={!isDisabled ? { scale: 0.97 } : {}}
              transition={{ type: 'spring', stiffness: 400 }}
            >
              <Icon className="w-4 h-4 flex-shrink-0" />
              <span>{item.label}</span>
              {item.id === 'active' && hasActiveSession && (
                <span className="ml-auto w-2 h-2 rounded-full bg-emerald-400 animate-pulse-dot shadow-sm shadow-emerald-400/50" />
              )}
            </motion.button>
          );
        })}
      </nav>

      {/* Bottom info */}
      <div className="px-4 pb-5">
        <div className="rounded-2xl p-4 border border-indigo-100/80" style={{ background: 'linear-gradient(135deg, rgba(238,242,255,0.8), rgba(224,242,254,0.6))' }}>
          <div className="flex items-center gap-2 mb-1.5">
            <div className="w-5 h-5 rounded-lg bg-gradient-to-br from-indigo-500 to-cyan-500 flex items-center justify-center">
              <Bot className="w-3 h-3 text-white" />
            </div>
            <div className="text-xs font-bold text-indigo-700">Powered by Groq AI</div>
          </div>
          <div className="text-[11px] text-indigo-500/70 leading-relaxed">Whisper v3 · Llama 3.3 · Llama Vision</div>
        </div>
      </div>
    </aside>
  );
}
