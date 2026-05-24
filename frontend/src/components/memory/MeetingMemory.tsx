import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, Calendar, Filter, ChevronDown, ChevronUp, FileText, MessageSquare, Mic, Brain, Clock, CheckSquare, AlertCircle, X, Loader2, Camera, Eye, Sparkles } from 'lucide-react';

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
  const [selectedImage, setSelectedImage] = useState<string | null>(null);

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
    { id: 'screenshots', label: 'Slides', icon: Camera },
  ];

  return (
    <motion.div className="space-y-6" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
      {/* Header */}
      <div>
        <div className="section-title">History</div>
        <h2 className="text-2xl font-bold text-slate-900">Meeting Memory</h2>
        <p className="text-sm text-slate-500 mt-1">Search and browse all your past meetings, summaries, action items, and deadlines.</p>
      </div>

      {/* Search */}
      <motion.div className="glass-card space-y-3" initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
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
          <motion.button onClick={handleSearch} disabled={loading} className="btn-primary flex items-center gap-1.5" whileTap={{ scale: 0.95 }}>
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
            Search
          </motion.button>
          <button onClick={loadAll} className="btn-secondary text-sm">All</button>
        </div>

        {/* Filter toggle */}
        <button
          onClick={() => setShowFilters(p => !p)}
          className="flex items-center gap-1.5 text-xs font-semibold text-indigo-600 hover:text-indigo-700 transition-colors"
        >
          <Filter className="w-3.5 h-3.5" />
          {showFilters ? 'Hide' : 'Show'} Filters
          {showFilters ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
        </button>

        <AnimatePresence>
          {showFilters && (
            <motion.div
              className="flex gap-4 flex-wrap items-center pt-3 border-t border-slate-100/80"
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.2 }}
            >
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-slate-400" />
                <input type="date" value={dateFilter} onChange={e => setDateFilter(e.target.value)} className="input-field w-auto py-1.5 text-xs" />
              </div>
              <input
                type="text" placeholder="Participant name..."
                value={participantFilter} onChange={e => setParticipantFilter(e.target.value)}
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
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      {/* Results */}
      {searched && (
        <div>
          {loading ? (
            <div className="flex items-center justify-center py-16 gap-2 text-slate-400">
              <Loader2 className="w-5 h-5 animate-spin" /> Loading meetings...
            </div>
          ) : results.length === 0 ? (
            <motion.div className="glass-card text-center py-16" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}>
              <Brain className="w-14 h-14 text-slate-200 mx-auto mb-3" />
              <div className="font-semibold text-slate-500 mb-1">No meetings found</div>
              <div className="text-sm text-slate-400">Run a meeting session and save it to see it here.</div>
            </motion.div>
          ) : (
            <div className="space-y-3">
              <div className="text-xs font-semibold text-slate-400">{results.length} meeting{results.length !== 1 ? 's' : ''} found</div>
              {results.map((m, i) => (
                <motion.div
                  key={i}
                  onClick={() => openDetail(m.bot_id)}
                  className="glass-card glass-card-hover cursor-pointer border-l-4 border-l-indigo-400"
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.05 }}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <div className="font-bold text-slate-800 text-sm">
                          {m.saved_at ? new Date(m.saved_at).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' }) : 'Unknown date'}
                        </div>
                        <span className="badge-indigo">Bot: {m.bot_name}</span>
                        <div className="flex items-center gap-1 text-xs text-slate-400">
                          <Clock className="w-3 h-3" />
                          {m.saved_at ? new Date(m.saved_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : ''}
                        </div>
                      </div>
                      {m.meet_link && <div className="text-xs text-slate-400 truncate mb-2">{m.meet_link}</div>}
                      {m.summary_short && <p className="text-sm text-slate-600 line-clamp-2 mb-2">{m.summary_short}</p>}
                      {m.snippet && m.snippet !== m.summary_short && (
                        <div className="text-xs text-slate-500 bg-indigo-50/80 border border-indigo-100 px-3 py-2 rounded-lg italic line-clamp-2">...{m.snippet}...</div>
                      )}
                    </div>
                    <div className="flex flex-col gap-1.5 flex-shrink-0">
                      {m.deadlines?.length > 0 && (
                        <span className="badge-red"><AlertCircle className="w-3 h-3" />{m.deadlines.length} deadline{m.deadlines.length !== 1 ? 's' : ''}</span>
                      )}
                      {m.action_items?.length > 0 && (
                        <span className="badge-green"><CheckSquare className="w-3 h-3" />{m.action_items.length} action{m.action_items.length !== 1 ? 's' : ''}</span>
                      )}
                    </div>
                  </div>
                  <div className="mt-3 text-xs text-indigo-600 font-semibold">Click to view full report →</div>
                </motion.div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Meeting Detail Modal */}
      <AnimatePresence>
        {selected && (
          <motion.div
            className="fixed inset-0 bg-black/60 z-50 flex items-start justify-center p-6 overflow-y-auto backdrop-blur-sm"
            onClick={e => { if (e.target === e.currentTarget) setSelected(null); }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div
              className="w-full max-w-3xl rounded-2xl shadow-2xl my-4 overflow-hidden"
              style={{ background: 'rgba(255,255,255,0.95)', backdropFilter: 'blur(20px)' }}
              initial={{ scale: 0.95, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 20 }}
              transition={{ type: 'spring', stiffness: 300, damping: 30 }}
            >
              {/* Header */}
              <div className="px-6 py-5 text-white flex items-start justify-between" style={{ background: 'var(--gradient-primary)' }}>
                <div>
                  <div className="text-xs font-semibold opacity-75 mb-1 tracking-wider">MEETING REPORT</div>
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
              <div className="flex gap-6 px-6 py-3 bg-slate-50/80 border-b border-slate-100 flex-wrap">
                <div className="text-xs"><span className="text-slate-400 font-semibold">Bot: </span><span className="text-slate-700 font-medium">{selected.bot_name}</span></div>
                <div className="text-xs"><span className="text-slate-400 font-semibold">Started: </span><span className="text-slate-700 font-medium">{selected.saved_at ? new Date(selected.saved_at).toLocaleTimeString() : '—'}</span></div>
                {selected.ended_at && <div className="text-xs"><span className="text-slate-400 font-semibold">Ended: </span><span className="text-slate-700 font-medium">{new Date(selected.ended_at).toLocaleTimeString()}</span></div>}
              </div>

              {/* Tabs */}
              <div className="flex gap-1 px-4 pt-3 border-b border-slate-100">
                {detailTabs.map(({ id, label, icon: Icon }) => (
                  <motion.button
                    key={id}
                    onClick={() => setDetailTab(id)}
                    className={`tab-btn flex items-center gap-1.5 ${detailTab === id ? 'tab-active' : 'tab-inactive'}`}
                    whileTap={{ scale: 0.95 }}
                  >
                    <Icon className="w-3.5 h-3.5" />{label}
                  </motion.button>
                ))}
              </div>

              {/* Tab Content */}
              <div className="p-6 max-h-[60vh] overflow-y-auto">

                {/* Summary Tab */}
                {detailTab === 'summary' && (
                  <div className="space-y-4">
                    {selected.summary?.meeting_summary ? (
                      <>
                        <div className="p-4 rounded-xl border border-indigo-100" style={{ background: 'linear-gradient(135deg, rgba(238,242,255,0.8), rgba(224,242,254,0.6))' }}>
                          <div className="text-[11px] font-bold text-indigo-600 mb-2 tracking-wider">EXECUTIVE SUMMARY</div>
                          <p className="text-sm text-slate-800 leading-relaxed">{selected.summary.meeting_summary}</p>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          {selected.summary.action_items?.length > 0 && (
                            <div className="p-4 bg-emerald-50/80 border border-emerald-100 rounded-xl">
                              <div className="text-[11px] font-bold text-emerald-700 mb-2 tracking-wider">✅ ACTION ITEMS</div>
                              {selected.summary.action_items.map((a: string, i: number) => (
                                <div key={i} className="text-xs text-slate-700 flex gap-2 mb-1.5"><span className="text-emerald-500 flex-shrink-0">•</span>{a}</div>
                              ))}
                            </div>
                          )}
                          {selected.summary.deadlines?.length > 0 && (
                            <div className="p-4 bg-red-50/80 border border-red-100 rounded-xl">
                              <div className="text-[11px] font-bold text-red-600 mb-2 tracking-wider">📅 DEADLINES</div>
                              {selected.summary.deadlines.map((d: string, i: number) => (
                                <div key={i} className="text-xs text-slate-700 flex gap-2 mb-1.5"><span className="text-red-400 flex-shrink-0">•</span>{d}</div>
                              ))}
                            </div>
                          )}
                        </div>
                        {selected.summary.key_points?.length > 0 && (
                          <div className="p-4 bg-teal-50/80 border border-teal-100 rounded-xl">
                            <div className="text-[11px] font-bold text-teal-700 mb-2 tracking-wider">KEY POINTS</div>
                            {selected.summary.key_points.map((k: string, i: number) => (
                              <div key={i} className="text-xs text-slate-700 flex gap-2 mb-1.5"><span className="text-teal-500 flex-shrink-0">•</span>{k}</div>
                            ))}
                          </div>
                        )}
                        {selected.summary.decisions?.length > 0 && (
                          <div className="p-4 bg-blue-50/80 border border-blue-100 rounded-xl">
                            <div className="text-[11px] font-bold text-blue-700 mb-2 tracking-wider">DECISIONS</div>
                            {selected.summary.decisions.map((d: string, i: number) => (
                              <div key={i} className="text-xs text-slate-700 flex gap-2 mb-1.5"><span className="text-blue-500 flex-shrink-0">•</span>{d}</div>
                            ))}
                          </div>
                        )}
                        {selected.summary.participant_summaries?.length > 0 && (
                          <div className="p-4 bg-purple-50/80 border border-purple-100 rounded-xl">
                            <div className="text-[11px] font-bold text-purple-700 mb-2 tracking-wider">PARTICIPANT INSIGHTS</div>
                            {selected.summary.participant_summaries.map((p: any, i: number) => (
                              <div key={i} className="mb-3 last:mb-0">
                                <div className="font-semibold text-sm text-slate-800 flex items-center gap-2">
                                  <div className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold text-white" style={{ background: 'var(--gradient-primary)' }}>
                                    {p.participant?.charAt(0)?.toUpperCase()}
                                  </div>
                                  {p.participant} <span className="text-xs text-slate-400">({p.message_count} msgs)</span>
                                </div>
                                {p.main_points?.length > 0 && (
                                  <ul className="mt-1 ml-7 space-y-0.5">
                                    {p.main_points.map((pt: string, j: number) => <li key={j} className="text-xs text-slate-600 flex gap-1.5"><span className="text-purple-400">—</span>{pt}</li>)}
                                  </ul>
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                      </>
                    ) : (
                      <div className="text-center py-12 text-slate-400 text-sm">
                        <Sparkles className="w-10 h-10 text-slate-200 mx-auto mb-2" />
                        No summary available for this meeting.
                      </div>
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
                        <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0 shadow-sm" style={{ background: 'var(--gradient-primary)' }}>
                          {msg.sender?.charAt(0)?.toUpperCase()}
                        </div>
                        <div>
                          <div className="flex items-baseline gap-2 mb-1">
                            <span className="text-xs font-semibold text-slate-700">{msg.sender}</span>
                            <span className="text-[11px] text-slate-400">{msg.timestamp}</span>
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
                      <div key={i} className="flex gap-3 p-3 rounded-xl bg-slate-50/80 hover:bg-indigo-50/50 transition-colors">
                        <span className="text-xs font-mono text-indigo-500 font-semibold flex-shrink-0 pt-0.5">{seg.timestamp_str || seg.start || ''}</span>
                        <p className="text-sm text-slate-700 leading-relaxed">{seg.text}</p>
                      </div>
                    ))}
                  </div>
                )}

                {/* Screenshots Tab */}
                {detailTab === 'screenshots' && (
                  <div>
                    {(!selected.screenshot_metadata?.length) ? (
                      <div className="text-center py-12 text-slate-400 text-sm">
                        <Camera className="w-10 h-10 text-slate-200 mx-auto mb-2" />
                        No screenshots captured for this meeting.
                      </div>
                    ) : (
                      <>
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-4">
                          {selected.screenshot_metadata.map((shot: any, i: number) => (
                            <div
                              key={i}
                              onClick={() => setSelectedImage(`${BACKEND_URL}${shot.file_path}`)}
                              className="relative rounded-xl overflow-hidden border border-slate-200/80 cursor-pointer hover:border-indigo-400 hover:shadow-lg transition-all group"
                            >
                              <img src={`${BACKEND_URL}${shot.file_path}`} alt={`Slide ${i+1}`} className="w-full aspect-video object-contain bg-black" />
                              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-all flex items-center justify-center opacity-0 group-hover:opacity-100">
                                <Eye className="w-6 h-6 text-white" />
                              </div>
                              <div className="absolute bottom-0 left-0 right-0 px-2 py-1 bg-black/60">
                                <span className="text-[11px] text-white font-medium">Slide {i+1}</span>
                              </div>
                            </div>
                          ))}
                        </div>
                        {selected.visual_content?.screenshots?.length > 0 && (
                          <div className="space-y-3">
                            <div className="text-xs font-bold text-purple-600 tracking-wider mb-2">VISION EXTRACTION RESULTS</div>
                            {selected.visual_content.screenshots.map((vs: any, i: number) => {
                              const vr = vs.vision_result || {};
                              return (
                                <div key={i} className="border border-slate-100/80 rounded-xl p-4 bg-white/50">
                                  <div className="font-semibold text-slate-800 text-sm mb-1">{vr.slide_title || `Slide ${i+1}`}</div>
                                  {vr.main_text_blocks?.length > 0 && (
                                    <div className="text-xs text-slate-600 space-y-0.5">
                                      {vr.main_text_blocks.map((t: string, j: number) => <p key={j}>{t}</p>)}
                                    </div>
                                  )}
                                  {vr.bullet_points?.length > 0 && (
                                    <ul className="mt-1 space-y-0.5">
                                      {vr.bullet_points.map((p: string, j: number) => <li key={j} className="text-xs text-slate-600 flex gap-1.5"><span className="text-indigo-400">•</span>{p}</li>)}
                                    </ul>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </>
                    )}
                  </div>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Image Lightbox */}
      <AnimatePresence>
        {selectedImage && (
          <motion.div
            className="fixed inset-0 bg-black/90 z-[60] flex items-center justify-center p-8"
            onClick={() => setSelectedImage(null)}
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          >
            <img src={selectedImage} alt="Slide" className="max-w-full max-h-[90vh] object-contain rounded-xl shadow-2xl" />
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
