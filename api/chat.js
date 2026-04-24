const RATE_LIMIT = 20;
const WINDOW_MS = 60 * 60 * 1000;
const MAX_HISTORY = 20;
const MAX_MESSAGE_LEN = 2000;

const rateLimitStore = new Map();

const SYSTEM_PROMPT =
  "You are Kyle, responding via instant message on a nostalgic MySpace-themed website in 2026. " +
  "You run marketing at Rooftop Power Co (a solar/roofing/HVAC company in RI, MA, CT) and are " +
  "building handled., an AI-powered front office for home service contractors with three agents: " +
  "Ava (speed-to-lead and booking), Stella (reviews, referrals, reactivation), and Scout (analytics). " +
  "You have a wife Jessica and three sons Weston (7), Luke (4), and Cole (1). You live in Alabama, " +
  "play hockey twice a week, and have an Exercise Physiology degree from CSUN. Talk like you're on " +
  "AIM in 2026: lowercase mostly, short messages, occasional lol or haha, but still informative if " +
  "someone asks about your work. Don't use em dashes. Keep responses under 3 sentences unless someone " +
  "asks for real detail. If someone asks something wildly off-topic, deflect playfully.";

function getClientIp(req) {
  const xff = req.headers['x-forwarded-for'];
  if (typeof xff === 'string' && xff.length > 0) {
    return xff.split(',')[0].trim();
  }
  return (req.socket && req.socket.remoteAddress) || 'unknown';
}

function checkRateLimit(ip) {
  const now = Date.now();
  const prior = rateLimitStore.get(ip) || [];
  const recent = prior.filter((t) => now - t < WINDOW_MS);
  if (recent.length >= RATE_LIMIT) {
    rateLimitStore.set(ip, recent);
    return false;
  }
  recent.push(now);
  rateLimitStore.set(ip, recent);
  return true;
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'method not allowed' });
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    return res.status(500).json({ error: 'server not configured' });
  }

  const ip = getClientIp(req);
  if (!checkRateLimit(ip)) {
    return res.status(429).json({ error: "okay we get it, give it a sec" });
  }

  const body = req.body || {};
  const incoming = Array.isArray(body.messages) ? body.messages : null;
  if (!incoming || incoming.length === 0) {
    return res.status(400).json({ error: 'messages array required' });
  }

  const messages = incoming
    .slice(-MAX_HISTORY)
    .map((m) => ({
      role: m && m.role === 'assistant' ? 'assistant' : 'user',
      content:
        m && typeof m.content === 'string' ? m.content.slice(0, MAX_MESSAGE_LEN) : '',
    }))
    .filter((m) => m.content.length > 0);

  if (messages.length === 0 || messages[0].role !== 'user') {
    return res.status(400).json({ error: 'invalid messages' });
  }

  try {
    const upstream = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 300,
        system: SYSTEM_PROMPT,
        messages,
      }),
    });

    if (!upstream.ok) {
      const errText = await upstream.text().catch(() => '');
      console.error('anthropic error', upstream.status, errText.slice(0, 500));
      return res.status(502).json({ error: 'brb, connection flaked' });
    }

    const data = await upstream.json();
    const reply = (data.content || [])
      .filter((b) => b && b.type === 'text')
      .map((b) => b.text)
      .join('')
      .trim();

    if (!reply) {
      return res.status(502).json({ error: 'got nothing back, try again' });
    }

    return res.status(200).json({ reply });
  } catch (err) {
    console.error('chat proxy error', err);
    return res.status(500).json({ error: 'server hiccup, try again' });
  }
};
