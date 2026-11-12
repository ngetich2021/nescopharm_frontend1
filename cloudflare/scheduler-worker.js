/**
 * Citimax ERP scheduler + outside watchdog (Cloudflare Worker, free plan).
 *
 * Cron Trigger: "* * * * *" (every minute).
 * Every minute it calls the backend's /api/system/cron, which runs the Laravel schedule
 * (health check every 5 min, 8:00am health email, reminders, low-stock alerts, etc.).
 * If the backend does not answer for 2 minutes in a row, the Worker itself emails an alert
 * (the server cannot report its own outage), repeats it every 30 minutes, and emails once
 * it is back up.
 *
 * Settings > Variables and Secrets:
 *   CRON_TOKEN      (secret)  the token whose SHA-256 is in the backend's scheduler_token_hash
 *   RESEND_API_KEY  (secret)  Resend key, to email when the backend is down
 *   ALERT_TO        (text)    e.g. "you@example.com" (comma separated for several)
 *   ALERT_FROM      (text)    e.g. "Citimax ERP <hi@mail.sendplum.com>"
 *   API_URL         (text)    optional, default https://citimax-main.laravel.cloud/api/system/cron
 * Bindings: KV namespace bound as STATE (remembers an ongoing outage between minutes).
 */

const DEFAULT_API = 'https://citimax-main.laravel.cloud/api/system/cron';
const FAILS_BEFORE_ALERT = 2;
const REPEAT_MINUTES = 30;

export default {
  async scheduled(event, env, ctx) {
    ctx.waitUntil(tick(env));
  },
  async fetch() {
    return new Response('Not found', { status: 404 });
  },
};

async function tick(env) {
  const url = env.API_URL || DEFAULT_API;
  let ok = false;
  let detail = '';
  const started = Date.now();
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'X-Cron-Token': env.CRON_TOKEN, Accept: 'application/json' },
      signal: AbortSignal.timeout(25000),
    });
    ok = res.status === 200;
    detail = ok ? 'answering' : `HTTP ${res.status}${res.status === 504 ? ' (gateway timeout - server not answering)' : res.status === 503 ? ' (database unreachable)' : ''}`;
  } catch (e) {
    detail = e && e.name === 'TimeoutError' ? 'no answer within 25 seconds' : `cannot reach the server (${e})`;
  }
  const ms = Date.now() - started;

  const state = (await env.STATE.get('outage', 'json')) || null;
  const now = Date.now();

  if (ok) {
    if (state) {
      if (state.alertedAt) {
        const mins = Math.max(1, Math.round((now - state.since) / 60000));
        await send(env, 'RECOVERED: Citimax ERP is back up',
          page('System back up', `<p>The server is answering again after about ${mins} minutes down.</p>`));
      }
      await env.STATE.delete('outage');
    }
    return;
  }

  // Down. Only write to KV when something changes (KV free plan: 1,000 writes a day).
  const s = state || { since: now, fails: 0, alertedAt: null };
  s.fails += 1;
  const due = !s.alertedAt ? s.fails >= FAILS_BEFORE_ALERT : now - s.alertedAt >= REPEAT_MINUTES * 60000;
  if (due) {
    await send(env, 'ALERT: Citimax ERP is DOWN - server not answering',
      page('System down', `<p>The Citimax ERP server is not answering: <b>${esc(detail)}</b> (${ms} ms).</p>
        <p>Down since ${fmt(s.since)} (Nairobi time). Checked from outside by Cloudflare every minute;
        this alert repeats every ${REPEAT_MINUTES} minutes until it is back up.</p>`));
    s.alertedAt = now;
    await env.STATE.put('outage', JSON.stringify(s));
  } else if (!s.alertedAt) {
    await env.STATE.put('outage', JSON.stringify(s));
  }
}

async function send(env, subject, html) {
  const to = String(env.ALERT_TO || '').split(',').map((x) => x.trim()).filter(Boolean);
  if (!to.length || !env.RESEND_API_KEY) return;
  await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: env.ALERT_FROM || 'Citimax ERP <hi@mail.sendplum.com>', to, subject, html }),
  });
}

function page(heading, body) {
  return `<div style="font-family:Arial,sans-serif;font-size:14px;color:#111"><h2 style="margin:0 0 6px">${heading}</h2>
    <p style="margin:0 0 14px;color:#555">${fmt(Date.now())} (Nairobi time)</p>${body}</div>`;
}

// dd/mm/yyyy HH:MM in Nairobi time
function fmt(ms) {
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Africa/Nairobi', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false,
  }).formatToParts(new Date(ms)).map((x) => [x.type, x.value]));
  return `${p.day}/${p.month}/${p.year} ${p.hour}:${p.minute}`;
}

function esc(s) {
  return String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
}
