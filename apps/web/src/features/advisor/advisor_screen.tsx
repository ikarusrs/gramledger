import { useState } from 'react';
import type { FormEvent } from 'react';

type Message = { role: 'user' | 'model'; text: string };

export function AdvisorScreen() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function ask(event: FormEvent) {
    event.preventDefault();
    const message = input.trim();
    if (!message || busy) return;
    const next = [...messages, { role: 'user' as const, text: message }];
    setMessages(next);
    setInput('');
    setBusy(true);
    setError('');
    try {
      const response = await fetch('/v1/advisor/chat', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ message, history: messages.slice(-10) }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error?.message ?? 'Advisor unavailable');
      setMessages([...next, { role: 'model', text: payload.text }]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Advisor unavailable');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="page">
      <header className="page__head">
        <div>
          <h1 className="page__title">Shetkari Mitra</h1>
          <p className="page__subtitle">कृषी, पशुपालन आणि ग्रामीण जीवनासाठी विश्वासू मार्गदर्शक</p>
        </div>
      </header>
      <section className="feature-hero">
        <span className="eyebrow">AGRICULTURE ADVISOR</span>
        <h2>Ask about your farm, village, or next season.</h2>
        <p>
          Get practical guidance in Marathi or English. Share your crop, district, soil, weather,
          and what you are seeing for a more useful answer.
        </p>
      </section>
      <section className="card advisor-chat" aria-live="polite">
        {messages.length === 0 && (
          <div className="advisor-empty">
            <strong>Start with a real question</strong>
            <span>“माझ्या कापसाच्या पिकावर पांढरे डाग दिसत आहेत, काय करू?”</span>
            <span>“What vegetables can I plant in Nashik this month?”</span>
          </div>
        )}
        {messages.map((item, index) => (
          <div className={`chat-message chat-message--${item.role}`} key={`${item.role}-${index}`}>
            <span>{item.role === 'user' ? 'You' : 'Shetkari Mitra'}</span>
            <p>{item.text}</p>
          </div>
        ))}
        {busy && (
          <div className="chat-message chat-message--model">
            <span>Shetkari Mitra</span>
            <p>Thinking about your question…</p>
          </div>
        )}
        {error && <p className="form-error">{error}</p>}
        <form className="chat-form" onSubmit={ask}>
          <textarea
            value={input}
            onChange={(event) => setInput(event.target.value)}
            placeholder="Ask in Marathi or English…"
            maxLength={4000}
            rows={3}
          />
          <button className="primary-btn" disabled={busy || !input.trim()}>
            {busy ? 'Sending…' : 'Ask advisor'}
          </button>
        </form>
        <small className="muted">
          Advice is educational, not a substitute for a local agriculture officer, veterinarian,
          doctor, or emergency service.
        </small>
      </section>
    </div>
  );
}
