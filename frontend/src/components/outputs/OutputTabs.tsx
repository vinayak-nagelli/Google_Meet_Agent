import { useState, useRef, useEffect } from 'react';
import { MessageSquare, Bell, Send, FileText, Mic, Sparkles, Camera, Loader2, ChevronDown, ChevronUp, Eye } from 'lucide-react';

const BACKEND_URL = 'http://localhost:8000';

const TABS = [
  { id: 'chat', label: 'Live Chat', icon: MessageSquare },
  { id: 'alerts', label: 'Alerts', icon: Bell },
  { id: 'reply', label: 'Reply', icon: Send },
  { id: 'transcript', label: 'Transcript', icon: FileText },
  { id: 'audio', label: 'Audio', icon: Mic },
  { id: 'summary', label: 'AI Summary', icon: Sparkles },
  { id: 'screenshots', label: 'Visual', icon: Camera },
];

interface OutputTabsProps {
  session: any;
  chats: any[];
  alerts: any[];
  transcript: any[];
  audioFiles: any;
  summary: any;
  visualStatus: any;
  visualData: any;
  summaryLoading: boolean;
  isExtracting: boolean;
  onGenerateSummary: () => void;
  onProcessVisual: () => void;
  onSaveMemory: () => void;
}

function timeColor(t: string) {
  return 'text-slate-400';
}

export default function OutputTabs({
  session, chats, alerts, transcript, audioFiles, summary,
  visualStatus, visualData, summaryLoading, isExtracting,
  onGenerateSummary, onProcessVisual, onSaveMemory
}: OutputTabsProps) {
  const [tab, setTab] = useState('chat');
  const [replyText, setReplyText] = useState('');
  const [sending, setSending] = useState(false);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [expandedSummaryKeys, setExpandedSummaryKeys] = useState<string[]>(['key_points', 'action_items', 'deadlines']);
  const chatRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (tab === 'chat' && chatRef.current) {
      chatRef.current.scrollTop = chatRef.current.scrollHeight;
    }
  }, [chats, tab]);

  const sendReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!session || !replyText.trim()) return;
    setSending(true);
    try {
      await fetch(`${BACKEND_URL}/bot/${session.id}/send-message`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: replyText }),
      });
      setReplyText('');
    } catch {}
    setSending(false);
  };

  const toggleSummaryKey = (k: string) => {
    setExpandedSummaryKeys(p => p.includes(k) ? p.filter(x => x !== k) : [...p, k]);
  };

  return (
    <div>
      {/* Tab Bar */}
      <div className="flex gap-1.5 overflow-x-auto pb-1 mb-5 flex-nowrap">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={`tab-btn flex items-center gap-1.5 flex-shrink-0 ${tab === id ? 'tab-active' : 'tab-inactive'}`}
          >
            <Icon className="w-3.5 h-3.5" />
            {label}
            {id === 'alerts' && alerts.length > 0 && (
              <span className="ml-1 px-1.5 py-0.5 rounded-full bg-red-500 text-white text-xs font-bold min-w-[18px] text-center">
                {alerts.length}
              </span>
            )}
          </button>
        ))}
      </div>

      <div className="card min-h-96">

        {/* CHAT */}
        {tab === 'chat' && (
          <div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-slate-800">Live Chat</h3>
              <span className="badge-blue">{chats.length} messages</span>
            </div>
            <div ref={chatRef} className="space-y-3 max-h-96 overflow-y-auto pr-1">
              {chats.length === 0 ? (
                <div className="text-center py-12 text-slate-400 text-sm">No chat messages yet. Bot will capture them once it joins.</div>
              ) : (
                chats.map((msg, i) => (
                  <div key={i} className="flex items-start gap-2.5 animate-fade-in-up">
                    <div className="w-7 h-7 rounded-full bg-gradient-to-br from-indigo-400 to-teal-400 flex items-center justify-center text-xs font-bold text-white flex-shrink-0 mt-0.5">
                      {msg.sender?.charAt(0)?.toUpperCase() || '?'}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-baseline gap-2 mb-1">
                        <span className="text-xs font-semibold text-slate-700">{msg.sender}</span>
                        <span className={`text-xs ${timeColor(msg.timestamp)}`}>{msg.timestamp}</span>
                      </div>
                      <div className="chat-bubble chat-bubble-other">{msg.message}</div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* ALERTS */}
        {tab === 'alerts' && (
          <div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-slate-800">Alerts</h3>
              {alerts.length > 0 && <span className="badge-red">{alerts.length} alerts</span>}
            </div>
            <div className="space-y-3 max-h-96 overflow-y-auto">
              {alerts.length === 0 ? (
                <div className="text-center py-12 text-slate-400 text-sm">No alerts yet.</div>
              ) : (
                alerts.map((a, i) => (
                  <div key={i} className={`p-4 rounded-xl border animate-fade-in-up ${
                    a.type === 'name_mention' || a.type === 'name_mention_audio'
                      ? 'bg-amber-50 border-amber-200'
                      : 'bg-blue-50 border-blue-200'
                  }`}>
                    <div className="flex items-center gap-2 mb-1">
                      <Bell className={`w-3.5 h-3.5 ${a.type?.includes('mention') ? 'text-amber-600' : 'text-blue-600'}`} />
                      <span className="text-xs font-bold text-slate-700">{a.sender}</span>
                      <span className="text-xs text-slate-400 ml-auto">{a.timestamp}</span>
                    </div>
                    <div className="text-sm font-semibold text-slate-800 mb-1">{a.message}</div>
                    {a.original_message && (
                      <div className="text-xs text-slate-500 bg-white/60 p-2 rounded-lg border border-white mt-1">"{a.original_message}"</div>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* REPLY */}
        {tab === 'reply' && (
          <div>
            <h3 className="font-bold text-slate-800 mb-4">Send Manual Reply</h3>
            <form onSubmit={sendReply} className="flex gap-2 mb-6">
              <input
                className="input-field flex-1"
                placeholder="Type a message to send in the meeting chat..."
                value={replyText}
                onChange={e => setReplyText(e.target.value)}
              />
              <button type="submit" disabled={sending || !replyText.trim()} className="btn-primary flex items-center gap-1.5">
                {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                Send
              </button>
            </form>
            <div className="text-xs text-slate-400 text-center">Messages appear instantly in the meeting chat window.</div>
          </div>
        )}

        {/* TRANSCRIPT */}
        {tab === 'transcript' && (
          <div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-slate-800">Audio Transcript</h3>
              <span className="badge-green">{transcript.length} segments</span>
            </div>
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {transcript.length === 0 ? (
                <div className="text-center py-12 text-slate-400 text-sm">Transcript is generated automatically after audio chunks are processed.</div>
              ) : (
                transcript.map((seg, i) => (
                  <div key={i} className="flex gap-3 p-3 rounded-xl bg-slate-50 hover:bg-slate-100 transition-colors">
                    <span className="text-xs font-mono text-indigo-500 font-semibold flex-shrink-0 pt-0.5">[{seg.start}]</span>
                    <p className="text-sm text-slate-700 leading-relaxed">{seg.text}</p>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* AUDIO */}
        {tab === 'audio' && (
          <div>
            <h3 className="font-bold text-slate-800 mb-4">Audio Recordings</h3>
            {(!audioFiles?.chunks || audioFiles.chunks.length === 0) ? (
              <div className="text-center py-12 text-slate-400 text-sm">Audio chunks will appear here once the bot starts recording.</div>
            ) : (
              <div className="space-y-3 max-h-96 overflow-y-auto">
                {audioFiles.chunks.map((chunk: string, i: number) => {
                  const cleanedName = chunk.replace('.wav', '_clean.wav');
                  const hasCleaned = audioFiles.cleaned_chunks?.includes(cleanedName);
                  return (
                    <div key={i} className="p-4 rounded-xl border border-slate-100 bg-slate-50">
                      <div className="flex items-center gap-2 mb-3">
                        <Mic className="w-4 h-4 text-blue-600" />
                        <span className="text-xs font-semibold text-slate-700">Chunk {i + 1}</span>
                        {hasCleaned && <span className="badge-green">Cleaned</span>}
                      </div>
                      <div className="space-y-1.5">
                        <div>
                          <div className="text-xs text-slate-400 mb-1">Original</div>
                          <audio controls className="w-full h-8" src={`${BACKEND_URL}/recordings/${chunk}`} />
                        </div>
                        {hasCleaned && (
                          <div>
                            <div className="text-xs text-slate-400 mb-1">Cleaned ✨</div>
                            <audio controls className="w-full h-8" src={`${BACKEND_URL}/recordings/cleaned/${cleanedName}`} />
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* AI SUMMARY */}
        {tab === 'summary' && (
          <div>
            <div className="flex items-center justify-between mb-5">
              <h3 className="font-bold text-slate-800">AI Meeting Summary</h3>
              <div className="flex gap-2">
                {summary && (
                  <button onClick={onSaveMemory} className="btn-secondary text-xs py-1.5 px-3">
                    💾 Save to Memory
                  </button>
                )}
                <button
                  onClick={onGenerateSummary}
                  disabled={summaryLoading}
                  className="btn-primary text-xs py-1.5 px-4 flex items-center gap-1.5"
                >
                  {summaryLoading ? <><Loader2 className="w-3.5 h-3.5 animate-spin" />Generating...</> : <><Sparkles className="w-3.5 h-3.5" />Generate Summary</>}
                </button>
              </div>
            </div>

            {!summary ? (
              <div className="text-center py-12 text-slate-400 text-sm">
                Click "Generate Summary" to analyze the meeting chat and transcript with Groq AI.
              </div>
            ) : (
              <div className="space-y-3 max-h-[500px] overflow-y-auto">
                {summary.meeting_summary && (
                  <div className="p-4 bg-indigo-50 border border-indigo-100 rounded-xl">
                    <div className="text-xs font-bold text-indigo-600 mb-2 tracking-wider">EXECUTIVE SUMMARY</div>
                    <p className="text-sm text-slate-800 leading-relaxed">{summary.meeting_summary}</p>
                  </div>
                )}

                {([
                  { key: 'key_points', label: 'Key Points', color: 'text-teal-700 bg-teal-50 border-teal-100', dotColor: 'bg-teal-500' },
                  { key: 'decisions', label: 'Decisions Made', color: 'text-blue-700 bg-blue-50 border-blue-100', dotColor: 'bg-blue-500' },
                  { key: 'action_items', label: 'Action Items', color: 'text-emerald-700 bg-emerald-50 border-emerald-100', dotColor: 'bg-emerald-500' },
                  { key: 'deadlines', label: 'Deadlines', color: 'text-red-700 bg-red-50 border-red-100', dotColor: 'bg-red-500' },
                ] as any[]).map(({ key, label, color, dotColor }) => {
                  const items = summary[key] || [];
                  if (!items.length) return null;
                  const open = expandedSummaryKeys.includes(key);
                  return (
                    <div key={key} className={`border rounded-xl overflow-hidden ${color.split(' ').filter((c: string) => c.startsWith('border')).join(' ')}`}>
                      <button
                        onClick={() => toggleSummaryKey(key)}
                        className={`w-full flex items-center justify-between px-4 py-3 ${color}`}
                      >
                        <div className="flex items-center gap-2">
                          <span className={`w-2 h-2 rounded-full ${dotColor}`} />
                          <span className="text-xs font-bold tracking-wider">{label.toUpperCase()}</span>
                          <span className="text-xs opacity-70">({items.length})</span>
                        </div>
                        {open ? <ChevronUp className="w-4 h-4 opacity-60" /> : <ChevronDown className="w-4 h-4 opacity-60" />}
                      </button>
                      {open && (
                        <div className="bg-white/60 px-4 py-3 space-y-1.5">
                          {items.map((item: string, i: number) => (
                            <div key={i} className="flex items-start gap-2">
                              <span className={`w-1.5 h-1.5 rounded-full ${dotColor} mt-1.5 flex-shrink-0`} />
                              <p className="text-sm text-slate-700">{item}</p>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* SCREENSHOTS / VISUAL */}
        {tab === 'screenshots' && (
          <div>
            <div className="flex items-center justify-between mb-5">
              <div>
                <h3 className="font-bold text-slate-800">Visual Capture</h3>
                <div className="flex items-center gap-2 mt-1">
                  {visualStatus?.presentation_active ? (
                    <span className="badge-amber"><span className="status-dot-amber" /> Capturing Slides</span>
                  ) : (
                    <span className="badge-blue">{visualStatus?.screenshots?.length || 0} slides captured</span>
                  )}
                </div>
              </div>
              {(visualStatus?.screenshots?.length || 0) > 0 && (
                <button
                  onClick={onProcessVisual}
                  disabled={isExtracting}
                  className="btn-primary text-xs py-1.5 px-4 flex items-center gap-1.5"
                >
                  {isExtracting ? <><Loader2 className="w-3.5 h-3.5 animate-spin" />Extracting...</> : <><Eye className="w-3.5 h-3.5" />Extract Text</>}
                </button>
              )}
            </div>

            {/* Screenshot Gallery */}
            {(!visualStatus?.screenshots?.length) ? (
              <div className="text-center py-12 text-slate-400 text-sm">Screenshots are captured automatically when screen sharing is detected.</div>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-6">
                {visualStatus.screenshots.map((shot: any, i: number) => (
                  <div
                    key={i}
                    onClick={() => setSelectedImage(`${BACKEND_URL}${shot.file_path}`)}
                    className="relative rounded-xl overflow-hidden border border-slate-200 cursor-pointer hover:border-indigo-400 hover:shadow-md transition-all group"
                  >
                    <img src={`${BACKEND_URL}${shot.file_path}`} alt={`Slide ${i + 1}`} className="w-full aspect-video object-contain bg-black" />
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-all flex items-center justify-center opacity-0 group-hover:opacity-100">
                      <Eye className="w-6 h-6 text-white" />
                    </div>
                    <div className="absolute bottom-0 left-0 right-0 px-2 py-1 bg-black/60 flex justify-between">
                      <span className="text-xs text-white font-medium">Slide {i + 1}</span>
                      <span className="text-xs text-white/70">{shot.captured_at}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Vision Extraction Results */}
            {visualData?.status && visualData.status !== 'not_started' && visualData.screenshots?.length > 0 && (
              <div className="space-y-4">
                <div className="flex items-center gap-3 mb-2">
                  <div className="font-bold text-slate-800 text-sm">Groq Vision Extraction Results</div>
                  <span className="badge-purple">
                    {visualData.processed_count} processed · {visualData.skipped_count} skipped
                  </span>
                </div>
                {visualData.screenshots.map((res: any, i: number) => {
                  const vr = res.vision_result || {};
                  return (
                    <div key={i} className="border border-slate-100 rounded-xl overflow-hidden">
                      <div className="flex gap-0">
                        <div
                          className="w-28 flex-shrink-0 bg-black cursor-pointer hover:opacity-90 transition-opacity"
                          onClick={() => setSelectedImage(`${BACKEND_URL}${res.file_path}`)}
                        >
                          <img src={`${BACKEND_URL}${res.file_path}`} alt="thumb" className="w-full h-full object-contain" />
                        </div>
                        <div className="flex-1 p-4">
                          <div className="text-xs text-slate-400 mb-1">{res.captured_at}</div>
                          <div className="font-semibold text-slate-800 text-sm mb-2">{vr.slide_title || 'Untitled Slide'}</div>
                          {res.error && <div className="text-xs text-red-500">⚠️ {res.error}</div>}
                        </div>
                      </div>
                      {!res.error && (vr.bullet_points?.length || vr.main_text_blocks?.length || vr.urls?.length || vr.visible_dates?.length) ? (
                        <div className="border-t border-slate-100 px-4 py-3 bg-slate-50 grid grid-cols-2 gap-3">
                          {vr.main_text_blocks?.length > 0 && (
                            <div>
                              <div className="text-xs font-bold text-purple-600 mb-1">MAIN TEXT</div>
                              {vr.main_text_blocks.map((t: string, j: number) => <p key={j} className="text-xs text-slate-600 leading-relaxed">{t}</p>)}
                            </div>
                          )}
                          {vr.bullet_points?.length > 0 && (
                            <div>
                              <div className="text-xs font-bold text-slate-500 mb-1">KEY POINTS</div>
                              <ul className="space-y-0.5">
                                {vr.bullet_points.map((p: string, j: number) => <li key={j} className="text-xs text-slate-600 flex gap-1.5"><span className="text-indigo-400 flex-shrink-0">•</span>{p}</li>)}
                              </ul>
                            </div>
                          )}
                          {vr.visible_dates?.length > 0 && (
                            <div>
                              <div className="text-xs font-bold text-amber-600 mb-1">DATES</div>
                              <div className="flex flex-wrap gap-1">{vr.visible_dates.map((d: string, j: number) => <span key={j} className="badge-amber">{d}</span>)}</div>
                            </div>
                          )}
                          {vr.urls?.length > 0 && (
                            <div>
                              <div className="text-xs font-bold text-blue-600 mb-1">LINKS</div>
                              {vr.urls.map((u: string, j: number) => <div key={j} className="text-xs text-blue-600 truncate">{u}</div>)}
                            </div>
                          )}
                        </div>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Image Modal */}
      {selectedImage && (
        <div
          className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-8"
          onClick={() => setSelectedImage(null)}
        >
          <div className="relative max-w-full max-h-full">
            <img src={selectedImage} alt="Slide" className="max-w-full max-h-[90vh] object-contain rounded-xl shadow-2xl" />
            <button
              className="absolute -top-10 right-0 text-white font-bold text-base px-3 py-1 bg-white/10 rounded-lg hover:bg-white/20 transition-colors"
              onClick={() => setSelectedImage(null)}
            >Close ✕</button>
          </div>
        </div>
      )}
    </div>
  );
}
