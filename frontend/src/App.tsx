import React, { useState } from 'react';

const BACKEND_URL = 'http://localhost:8000';

function App() {
  const [meetLink, setMeetLink] = useState('');
  const [botName, setBotName] = useState('Meeting Assistant');
  const [statusText, setStatusText] = useState('');
  const [botId, setBotId] = useState<number | null>(null);

  const deployBot = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatusText('Deploying...');
    try {
      const response = await fetch(`${BACKEND_URL}/bot/deploy`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ meet_link: meetLink, bot_name: botName })
      });
      
      if (!response.ok) throw new Error('Network error');
      const data = await response.json();
      setBotId(data.id);
      setStatusText(`Bot deployed! ID: ${data.id}, Status: ${data.status}`);
      
      // Start polling status
      pollStatus(data.id);
    } catch (error) {
      console.error(error);
      setStatusText('Error deploying bot. Is backend running?');
    }
  };

  const pollStatus = async (id: number) => {
    setInterval(async () => {
      try {
        const res = await fetch(`${BACKEND_URL}/bot/status/${id}`);
        if (res.ok) {
          const data = await res.json();
          setStatusText(`Bot ID: ${id}, Status: ${data.status}`);
        }
      } catch (e) {
        console.error(e);
      }
    }, 2000);
  };

  return (
    <div style={{ padding: '2rem', fontFamily: 'sans-serif', maxWidth: '600px', margin: '0 auto' }}>
      <h1 style={{ fontSize: '24px', fontWeight: 'bold', marginBottom: '1rem' }}>MeetClone MVP</h1>
      <form onSubmit={deployBot} style={{ display: 'flex', flexDirection: 'column', gap: '1rem', backgroundColor: '#f9fafb', padding: '1.5rem', borderRadius: '8px' }}>
        <div>
          <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>Google Meet Link:</label>
          <input 
            type="text" 
            value={meetLink} 
            onChange={e => setMeetLink(e.target.value)} 
            placeholder="https://meet.google.com/xxx-xxxx-xxx"
            style={{ width: '100%', padding: '0.5rem', border: '1px solid #ccc', borderRadius: '4px' }}
            required
          />
        </div>
        <div>
          <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>Bot Name:</label>
          <input 
            type="text" 
            value={botName} 
            onChange={e => setBotName(e.target.value)} 
            style={{ width: '100%', padding: '0.5rem', border: '1px solid #ccc', borderRadius: '4px' }}
            required
          />
        </div>
        <button type="submit" style={{ padding: '0.75rem 1rem', backgroundColor: '#3b82f6', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold', marginTop: '0.5rem' }}>
          Deploy Bot
        </button>
      </form>

      <div style={{ marginTop: '2rem', padding: '1.5rem', border: '1px solid #e5e7eb', borderRadius: '8px', backgroundColor: 'white' }}>
        <h3 style={{ margin: '0 0 1rem 0', fontSize: '18px' }}>Status Log</h3>
        <p style={{ margin: 0, color: '#4b5563' }}>{statusText || 'Ready to deploy'}</p>
      </div>
    </div>
  );
}

export default App;
