import http from 'node:http';
import { render, probe, snapshot, browse, capture, stats, chromePath, browser, closeAll, MAX_PAGES } from './capture.mjs';

const PORT = parseInt(process.env.RENDERER_PORT || '8790', 10);
const HOST = process.env.RENDERER_HOST || '127.0.0.1';
const jobs = new Map();

function readBody(req) {
  return new Promise((resolve, reject) => {
    let raw = '';
    req.on('data', (c) => { raw += c; if (raw.length > 20e6) reject(new Error('body too large')); });
    req.on('end', () => { try { resolve(raw ? JSON.parse(raw) : {}); } catch (e) { reject(e); } });
    req.on('error', reject);
  });
}

function json(res, code, data) {
  res.writeHead(code, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(data));
}

function stream(res) {
  res.writeHead(200, { 'Content-Type': 'application/x-ndjson', 'Cache-Control': 'no-cache', 'X-Accel-Buffering': 'no' });
  return (obj) => { try { res.write(JSON.stringify(obj) + '\n'); } catch { } };
}

const LOOPBACK = new Set(['127.0.0.1', 'localhost', '[::1]', '::1']);

function hostName(value) {
  const v = String(value || '').trim().toLowerCase();
  if (v.startsWith('[')) return v.slice(0, v.indexOf(']') + 1);
  return v.split(':')[0];
}

function guard(req) {
  if (!LOOPBACK.has(hostName(req.headers.host))) return 'host not allowed';
  if (req.headers.origin || req.headers['sec-fetch-site'] || req.headers['sec-fetch-mode']) return 'browser requests are not accepted';
  if (req.method === 'POST' && !String(req.headers['content-type'] || '').toLowerCase().startsWith('application/json')) return 'content type must be application/json';
  return null;
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${HOST}`);
  const blocked = guard(req);
  if (blocked) return json(res, 403, { error: blocked });
  try {
    if (req.method === 'GET' && url.pathname === '/health') {
      return json(res, 200, { ok: true, chrome: chromePath() || null, pages: stats(), max: MAX_PAGES, jobs: jobs.size });
    }
    if (req.method === 'POST' && url.pathname === '/render') {
      const job = await readBody(req);
      const emit = stream(res);
      const controller = new AbortController();
      const id = job.id || String(Date.now());
      jobs.set(id, controller);
      res.on('close', () => { if (!res.writableEnded) controller.abort(); });
      try {
        const result = await render(job, emit, controller.signal);
        emit({ type: 'done', ...result });
      } catch (e) {
        emit({ type: 'error', error: String(e && e.message || e) });
      } finally {
        jobs.delete(id);
        res.end();
      }
      return;
    }
    if (req.method === 'POST' && url.pathname === '/cancel') {
      const body = await readBody(req);
      const c = jobs.get(body.id);
      if (c) c.abort();
      return json(res, 200, { ok: !!c });
    }
    if (req.method === 'POST' && url.pathname === '/probe') {
      const job = await readBody(req);
      return json(res, 200, await probe(job));
    }
    if (req.method === 'POST' && url.pathname === '/snapshot') {
      const job = await readBody(req);
      return json(res, 200, await snapshot(job));
    }
    if (req.method === 'POST' && url.pathname === '/capture') {
      const job = await readBody(req);
      return json(res, 200, await capture(job));
    }
    if (req.method === 'POST' && url.pathname === '/browse') {
      const job = await readBody(req);
      return json(res, 200, await browse(job));
    }
    json(res, 404, { error: 'not found' });
  } catch (e) {
    if (!res.headersSent) json(res, 500, { error: String(e && e.message || e) });
    else res.end();
  }
});

server.requestTimeout = 0;
server.headersTimeout = 0;
server.listen(PORT, HOST, async () => {
  try { await browser(); } catch (e) { console.error('chrome launch failed', e.message); }
  console.log(JSON.stringify({ renderer: `http://${HOST}:${PORT}`, chrome: chromePath(), pages: MAX_PAGES }));
});

const shutdown = async () => {
  await closeAll();
  process.exit(0);
};
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
