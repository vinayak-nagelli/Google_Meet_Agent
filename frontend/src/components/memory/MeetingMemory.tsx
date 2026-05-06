import { useState, useEffect } from 'react';
import { Search, Calendar, Filter, ChevronDown, ChevronUp, FileText, MessageSquare, Mic, Brain, Clock, CheckSquare, AlertCircle, X, Loader2 } from 'lucide-react';

const BACKEND_URL = 'http://localhost:8000';

interface MeetingResult {
  bot_id: number; meet_link: string; bot_name: string; saved_at: string;
  summary_short: string; snippet: string; action_items: string[]; deadlines: string[];
}

interface MeetingDetail {
  bot_id: number; meet_link: string; bot_name: string; saved_at: string;
  ended_at: string; chat_messages: any[]; transcript: any[]; summary: any;
  screenshot_metadata: any[]; visual_content: any;
}

export default function MeetingMemory() {
  const [query, setQuery] = useState('');
  const [dateFilter, setDateFilter] = useState('');
  const [participantFilter, setParticipantFilter] = useState('');
  const [hasDeadline, setHasDeadline] = useState(false);
  const [hasActions, setHasActions] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [results, setResults] = useState<MeetingResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [selected, setSelected] = useState<MeetingDetail | null>(null);
  const [detailTab, setDetailTab] = useState('summary');

  // Load all meetings on mount
  useEffect(() => {
    loadAll();
  }, []);

  const loadAll = async () => {
    setLoading(true);
    setSearched(true);
    try {
      const res = await fetch(`${BACKEND_URL}/meetings/list`);
      if (res.ok) {
        const data = await res.json();
        setResults(data.meetings || []);
      }
    } catch {}
    setLoading(false);
  };

  const handleSearch = async () => {
    setLoading(true);
    setSearched(true);
    try {
      const res = await fetch(`${BACKEND_URL}/meetings/search`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query,
          date_filter: dateFilter || null,
          participant_filter: participantFilter || null,
          has_deadline: hasDeadline || null,
          has_action_items: hasActions || null,
        }),
      });
      const data = await res.json();
      setResults(data.results || []);
    } catch {}
    setLoading(false);
  };

  const openDetail = async (botId: number) => {
    try {
      const res = await fetch(`${BACKEND_URL}/meetings/${botId}`);
      if (res.ok) setSelected(await res.json());
    } catch {}
  };

  const detailTabs = [
    { id: 'summary', label: 'Summary', icon: Brain },
    { id: 'chat', label: 'Chat', icon: MessageSquare },
    { id: 'transcript', label: 'Transcript', icon: Mic },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <div className="section-title">History</div>
        <h2 className="text-2xl font-bold text-slate-900">Meeting Memory</h2>
        <p className="text-sm text-slate-500 mt-1">Search and browse all your past meetings, summaries, action items, and deadlines.</p>
      </div>

      {/* Search Box */}
      <div className="card space-y-3">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder='Search past meetings... e.g. "login page deadline"'
              value={query}
              onChange={e => setQuery(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSearch()}
              className="input-field pl-10"
            />
          </div>
          <button onClick={handleSearch} disabled={loading} className="btn-primary flex items-center gap-1.5">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
            Search
          </button>
          <button onClick={loadAll} className="btn-secondary text-sm">
            All
          </button>
        </div>

        {/* Filter toggle */}
        <button
          onClick={() => setShowFilters(p => !p)}
          className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-700"
        >
          <Filter className="w-3.5 h-3.5" />
          {showFilters ? 'Hide' : 'Show'} Filters
          {showFilters ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
        </button>

        {showFilters && (
          <div className="flex gap-4 flex-wrap items-center pt-1 border-t border-slate-100 animate-fade-in-up">
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-slate-400" />
              <input
                type="date"
                value={dateFilter}
                onChange={e => setDateFilter(e.target.value)}
                className="input-field w-auto py-1.5 text-xs"
              />
            </div>
            <input
              type="text"
              placeholder="Participant name..."
              value={participantFilter}
              onChange={e => setParticipantFilter(e.target.value)}
              className="input-field w-40 py-1.5 text-xs"
            />
            <label className="flex items-center gap-2 text-xs font-medium text-slate-600 cursor-pointer select-none">
              <input type="checkbox" checked={hasDeadline} onChange={e => setHasDeadline(e.target.checked)} className="rounded text-indigo-600" />
              Has Deadlines
            </label>
            <label className="flex items-center gap-2 text-xs font-medium text-slate-600 cursor-pointer select-none">
              <input type="checkbox" checked={hasActions} onChange={e => setHasActions(e.target.checked)} className="rounded text-indigo-600" />
              Has Action Items
            </label>
          </div>
        )}
      </div>

      {/* Results */}
      {searched && (
        <div>
          {loading ? (
            <div className="flex items-center justify-center py-16 gap-2 text-slate-400">
              <Loader2 className="w-5 h-5 animate-spin" /> Loading meetings...
            </div>
          ) : results.length === 0 ? (
            <div className="card text-center py-16">
              <Brain className="w-12 h-12 text-slate-200 mx-auto mb-3" />
              <div className="font-semibold text-slate-500 mb-1">No meetings found</div>
              <div className="text-sm text-slate-400">Run a meeting session and save it to see it here.</div>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="text-xs font-semibold text-slate-400">{results.length} meeting{results.length !== 1 ? 's' : ''} found</div>
              {results.map((m, i) => (
                <div
                  key={i}
                  onClick={() => openDetail(m.bot_id)}
                  className="card card-hover cursor-pointer border-l-4 border-l-indigo-400 animate-fade-in-up"
                  style={{ animationDelay: `${i * 0.05}s` }}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <div className="font-bold text-slate-800 text-sm">
                          {m.saved_at ? new Date(m.saved_at).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' }) : 'Unknown date'}
                        </div>
                        <span className="badge-blue">Bot: {m.bot_name}</span>
                        <div className="flex items-center gap-1 text-xs text-slate-400">
                          <Clock className="w-3 h-3" />
                          {m.saved_at ? new Date(m.saved_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : ''}
                        </div>
                      </div>
                      {m.meet_link && (
                        <div className="text-xs text-slate-400 truncate mb-2">{m.meet_link}</div>
                      )}
                      {m.summary_short && (
                        <p className="text-sm text-slate-600 line-clamp-2 mb-2">{m.summary_short}</p>
                      )}
                      {m.snippet && m.snippet !== m.summary_short && (
                        <div className="text-xs text-slate-500 bg-indigo-50 border border-indigo-100 px-3 py-2 rounded-lg italic line-clamp-2">
                          ...{m.snippet}...
                        </div>
                      )}
                    </div>
                    <div className="flex flex-col gap-1.5 flex-shrink-0">
                      {m.deadlines?.length > 0 && (
                        <span className="badge-red">
                          <AlertCircle className="w-3 h-3" />
                          {m.deadlines.length} deadline{m.deadlines.length !== 1 ? 's' : ''}
                        </span>
                      )}
                      {m.action_items?.length > 0 && (
                        <span className="badge-green">
                          <CheckSquare className="w-3 h-3" />
                          {m.action_items.length} action{m.action_items.length !== 1 ? 's' : ''}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="mt-3 text-xs text-indigo-600 font-semibold">Click to view full report →</div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Meeting Detail Modal */}
      {selected && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-start justify-center p-6 overflow-y-auto" onClick={e => { if (e.target === e.currentTarget) setSelected(null); }}>
          <div className="bg-white w-full max-w-3xl rounded-2xl shadow-2xl my-4 overflow-hidden">
            {/* Header */}
            <div className="bg-gradient-to-r from-indigo-600 to-teal-600 px-6 py-5 text-white flex items-start justify-between">
              <div>
                <div className="text-xs font-semibold opacity-75 mb-1">MEETING REPORT</div>
                <h3 className="font-bold text-xl">
                  {selected.saved_at ? new Date(selected.saved_at).toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }) : 'Meeting Detail'}
                </h3>
                <div className="text-sm opacity-80 mt-1">{selected.meet_link}</div>
              </div>
              <button onClick={() => setSelected(null)} className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors flex-shrink-0">
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Meta */}
            <div className="flex gap-6 px-6 py-3 bg-slate-50 border-b border-slate-100 flex-wrap">
              <div className="text-xs"><span className="text-slate-400 font-semibold">Bot: </span><span className="text-slate-700 font-medium">{selected.bot_name}</span></div>
              <div className="text-xs"><span className="text-slate-400 font-semibold">Started: </span><span className="text-slate-700 font-medium">{selected.saved_at ? new Date(selected.saved_at).toLocaleTimeString() : '—'}</span></div>
              {selected.ended_at && <div className="text-xs"><span className="text-slate-400 font-semibold">Ended: </span><span className="text-slate-700 font-medium">{new Date(selected.ended_at).toLocaleTimeString()}</span></div>}
            </div>

            {/* Tabs */}
            <div className="flex gap-1 px-4 pt-3 border-b border-slate-100">
              {detailTabs.map(({ id, label, icon: Icon }) => (
                <button key={id} onClick={() => setDetailTab(id)} className={`tab-btn flex items-center gap-1.5 ${detailTab === id ? 'tab-active' : 'tab-inactive'}`}>
                  <Icon className="w-3.5 h-3.5" />{label}
                </button>
              ))}
            </div>

            {/* Tab Content */}
            <div className="p-6 max-h-[60vh] overflow-y-auto">

              {/* Summary Tab */}
              {detailTab === 'summary' && (
                <div className="space-y-4">
                  {selected.summary?.meeting_summary ? (
                    <>
                      <div className="p-4 bg-indigo-50 rounded-xl border border-indigo-100">
                        <div className="text-xs font-bold text-indigo-600 mb-2">EXECUTIVE SUMMARY</div>
                        <p className="text-sm text-slate-800 leading-relaxed">{selected.summary.meeting_summary}</p>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        {selected.summary.action_items?.length > 0 && (
                          <div className="p-4 bg-emerald-50 border border-emerald-100 rounded-xl">
                            <div className="text-xs font-bold text-emerald-700 mb-2">✅ ACTION ITEMS</div>
                            {selected.summary.action_items.map((a: string, i: number) => (
                              <div key={i} className="text-xs text-slate-700 flex gap-2 mb-1.5"><span className="text-emerald-500 flex-shrink-0">•</span>{a}</div>
                            ))}
                          </div>
                        )}
                        {selected.summary.deadlines?.length > 0 && (
                          <div className="p-4 bg-red-50 border border-red-100 rounded-xl">
                            <div className="text-xs font-bold text-red-600 mb-2">📅 DEADLINES</div>
                            {selected.summary.deadlines.map((d: string, i: number) => (
                              <div key={i} className="text-xs text-slate-700 flex gap-2 mb-1.5"><span className="text-red-400 flex-shrink-0">•</span>{d}</div>
                            ))}
                          </div>
                        )}
                      </div>
                      {selected.summary.key_points?.length > 0 && (
                        <div className="p-4 bg-teal-50 border border-teal-100 rounded-xl">
                          <div className="text-xs font-bold text-teal-700 mb-2">KEY POINTS</div>
                          {selected.summary.key_points.map((k: string, i: number) => (
                            <div key={i} className="text-xs text-slate-700 flex gap-2 mb-1.5"><span className="text-teal-500 flex-shrink-0">•</span>{k}</div>
                          ))}
                        </div>
                      )}
                    </>
                  ) : (
                    <div className="text-center py-12 text-slate-400 text-sm">No summary available for this meeting.</div>
                  )}
                </div>
              )}

              {/* Chat Tab */}
              {detailTab === 'chat' && (
                <div className="space-y-3">
                  {(!selected.chat_messages?.length) ? (
                    <div className="text-center py-12 text-slate-400 text-sm">No chat messages recorded.</div>
                  ) : selected.chat_messages.map((msg, i) => (
                    <div key={i} className="flex items-start gap-2.5">
                      <div className="w-7 h-7 rounded-full bg-gradient-to-br from-indigo-400 to-teal-400 flex items-center justify-center text-xs font-bold text-white flex-shrink-0">
                        {msg.sender?.charAt(0)?.toUpperCase()}
                      </div>
                      <div>
                        <div className="flex items-baseline gap-2 mb-1">
                          <span className="text-xs font-semibold text-slate-700">{msg.sender}</span>
                          <span className="text-xs text-slate-400">{msg.timestamp}</span>
                        </div>
                        <div className="chat-bubble chat-bubble-other">{msg.message}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Transcript Tab */}
              {detailTab === 'transcript' && (
                <div className="space-y-2">
                  {(!selected.transcript?.length) ? (
                    <div className="text-center py-12 text-slate-400 text-sm">No transcript recorded.</div>
                  ) : selected.transcript.map((seg, i) => (
                    <div key={i} className="flex gap-3 p-3 rounded-xl bg-slate-50">
                      <span className="text-xs font-mono text-indigo-500 font-semibold flex-shrink-0 pt-0.5">[{seg.start}]</span>
                      <p className="text-sm text-slate-700 leading-relaxed">{seg.text}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
