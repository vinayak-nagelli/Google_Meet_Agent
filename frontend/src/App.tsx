import { useState, useEffect } from 'react'
import { Bot, Video, Activity, Loader2, CheckCircle2, AlertCircle } from 'lucide-react'

// Adjust backend URL for production
const BACKEND_URL = 'http://localhost:8000';

interface BotSession {
  id: number;
  meet_link: string;
  bot_name: string;
  status: string;
  created_at: string;
  error_message?: string;
}

function App() {
  const [meetLink, setMeetLink] = useState('')
  const [botName, setBotName] = useState('Meeting Assistant')
  const [activeBot, setActiveBot] = useState<BotSession | null>(null)
  const [loading, setLoading] = useState(false)

  const deployBot = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    try {
      const response = await fetch(`${BACKEND_URL}/bot/deploy`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ meet_link: meetLink, bot_name: botName })
      })
      
      if (!response.ok) throw new Error('Failed to deploy bot')
      
      const data = await response.json()
      setActiveBot(data)
    } catch (err) {
      console.error(err)
      alert('Error deploying bot. Is the backend running?')
    } finally {
      setLoading(false)
    }
  }

  // Polling for bot status
  useEffect(() => {
    let intervalId: ReturnType<typeof setInterval>;
    
    if (activeBot && !['joined', 'failed', 'stopped'].includes(activeBot.status)) {
      intervalId = setInterval(async () => {
        try {
          const res = await fetch(`${BACKEND_URL}/bot/status/${activeBot.id}`)
          if (res.ok) {
            const data = await res.json()
            setActiveBot(data)
          }
        } catch (err) {
          console.error("Failed to fetch status", err)
        }
      }, 2000)
    }

    return () => {
      if (intervalId) clearInterval(intervalId)
    }
  }, [activeBot])

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'created':
      case 'launching':
      case 'opened_meet':
      case 'waiting_to_join':
        return <Loader2 className="animate-spin text-blue-500" />
      case 'joined':
        return <CheckCircle2 className="text-green-500" />
      case 'failed':
      case 'stopped':
        return <AlertCircle className="text-red-500" />
      default:
        return <Activity className="text-gray-500" />
    }
  }

  return (
    <div className="min-h-screen p-8 max-w-4xl mx-auto">
      <header className="flex items-center gap-3 mb-10 pb-6 border-b border-gray-200">
        <div className="bg-blue-600 p-2 rounded-xl text-white">
          <Bot size={32} />
        </div>
        <div>
          <h1 className="text-3xl font-bold text-gray-900 tracking-tight">MeetClone</h1>
          <p className="text-gray-500 font-medium">Personal Meeting Agent MVP-1</p>
        </div>
      </header>

      <main className="grid md:grid-cols-2 gap-8">
        <section className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
          <h2 className="text-xl font-semibold mb-6 flex items-center gap-2">
            <Video className="text-blue-500" />
            Deploy New Bot
          </h2>
          
          <form onSubmit={deployBot} className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Google Meet Link
              </label>
              <input 
                type="url" 
                required
                placeholder="https://meet.google.com/abc-defg-hij"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                value={meetLink}
                onChange={e => setMeetLink(e.target.value)}
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Bot Display Name
              </label>
              <input 
                type="text" 
                required
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                value={botName}
                onChange={e => setBotName(e.target.value)}
              />
            </div>

            <button 
              type="submit" 
              disabled={loading}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 rounded-lg transition-colors flex items-center justify-center gap-2 disabled:opacity-70"
            >
              {loading ? <Loader2 className="animate-spin" size={20} /> : <Bot size={20} />}
              Deploy Bot
            </button>
          </form>
        </section>

        <section>
          <h2 className="text-xl font-semibold mb-6">Active Sessions</h2>
          
          {activeBot ? (
            <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 relative overflow-hidden">
              <div className={`absolute top-0 left-0 w-1 h-full ${
                activeBot.status === 'joined' ? 'bg-green-500' : 
                ['failed', 'stopped'].includes(activeBot.status) ? 'bg-red-500' : 'bg-blue-500'
              }`}></div>
              
              <div className="flex justify-between items-start mb-4 pl-3">
                <div>
                  <h3 className="font-semibold text-lg">{activeBot.bot_name}</h3>
                  <a href={activeBot.meet_link} target="_blank" rel="noreferrer" className="text-sm text-blue-500 hover:underline">
                    {activeBot.meet_link.split('meet.google.com/')[1] || activeBot.meet_link}
                  </a>
                </div>
                <div className="flex flex-col items-end">
                  <span className="flex items-center gap-2 text-sm font-medium bg-gray-50 px-3 py-1 rounded-full border border-gray-200">
                    {getStatusIcon(activeBot.status)}
                    {activeBot.status.toUpperCase().replace('_', ' ')}
                  </span>
                </div>
              </div>
              
              <div className="pl-3 mt-4 space-y-2">
                <div className="text-sm flex justify-between text-gray-500 border-t border-gray-100 pt-3">
                  <span>Session ID: {activeBot.id}</span>
                  <span>Started: {new Date(activeBot.created_at).toLocaleTimeString()}</span>
                </div>
                {activeBot.error_message && (
                  <div className="text-sm text-red-600 bg-red-50 p-2 rounded">
                    Error: {activeBot.error_message}
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="bg-gray-50 border border-dashed border-gray-300 rounded-2xl p-8 text-center text-gray-500 flex flex-col items-center justify-center h-48">
              <Activity className="mb-2 opacity-50" size={32} />
              <p>No active bot sessions yet.<br/>Deploy a bot to see it here.</p>
            </div>
          )}
        </section>
      </main>
    </div>
  )
}

export default App
