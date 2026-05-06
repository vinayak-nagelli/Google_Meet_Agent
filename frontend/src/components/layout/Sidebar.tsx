import { Bot, Radio, LayoutDashboard, PlusCircle, Brain, ChevronRight } from 'lucide-react';

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
    <aside className="w-60 flex-shrink-0 h-screen sticky top-0 bg-white border-r border-slate-100 flex flex-col">
      {/* Logo */}
      <div className="px-6 py-5 border-b border-slate-100">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-600 to-teal-500 flex items-center justify-center shadow-sm">
            <Bot className="w-5 h-5 text-white" />
          </div>
          <div>
            <div className="font-bold text-slate-900 text-sm leading-tight">MeetAgent</div>
            <div className="text-xs text-slate-400 leading-tight">AI Meeting Assistant</div>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-1">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = currentPage === item.id;
          const isDisabled = item.id === 'active' && !hasActiveSession;

          return (
            <button
              key={item.id}
              onClick={() => !isDisabled && onNavigate(item.id)}
              className={`sidebar-link w-full text-left ${isActive ? 'sidebar-link-active' : 'sidebar-link-inactive'} ${isDisabled ? 'opacity-40 cursor-not-allowed' : ''}`}
            >
              <Icon className="w-4 h-4 flex-shrink-0" />
              <span>{item.label}</span>
              {item.id === 'active' && hasActiveSession && (
                <span className="ml-auto w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              )}
            </button>
          );
        })}
      </nav>

      {/* Bottom info */}
      <div className="px-4 pb-5">
        <div className="bg-indigo-50 rounded-xl p-3.5 border border-indigo-100">
          <div className="text-xs font-semibold text-indigo-700 mb-1">Powered by Groq AI</div>
          <div className="text-xs text-indigo-500 leading-relaxed">Llama 4 Vision · Whisper · LLaMA 3.3</div>
        </div>
      </div>
    </aside>
  );
}
