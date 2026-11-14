import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import puppeteer from 'puppeteer-core';

const CHROME_CANDIDATES = [
  process.env.CHROME_PATH, '/usr/bin/google-chrome', '/usr/bin/google-chrome-stable', '/usr/bin/chromium',
  '/usr/bin/chromium-browser', '/opt/google/chrome/chrome', '/snap/bin/chromium',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', '/Applications/Chromium.app/Contents/MacOS/Chromium',
  '/opt/homebrew/bin/chromium', '/usr/local/bin/chromium'
].filter(Boolean);

export const FFMPEG = process.env.FFMPEG_PATH || 'ffmpeg';
const CPUS = Math.max(1, os.cpus().length);
const RAM_PAGES = Math.max(1, Math.floor(os.totalmem() / (1536 * 1024 * 1024) / 2));
export const MAX_PAGES = Math.max(1, parseInt(process.env.RENDER_CONCURRENCY || '', 10) || Math.min(Math.max(2, Math.floor(CPUS / 2)), Math.max(2, RAM_PAGES)));

const browsers = new Map();
const freeSlots = [];
const waiters = [];
let active = 0;

export function chromePath() {
  return CHROME_CANDIDATES.find((p) => { try { return fs.existsSync(p); } catch { return false; } });
}

function launch() {
  return puppeteer.launch({
    executablePath: chromePath(),
    headless: true,
    args: [
      '--no-sandbox', '--disable-dev-shm-usage', '--font-render-hinting=none', '--hide-scrollbars', '--mute-audio',
      '--force-color-profile=srgb', '--disable-background-timer-throttling', '--disable-renderer-backgrounding',
      '--disable-backgrounding-occluded-windows', '--autoplay-policy=no-user-gesture-required', '--allow-file-access-from-files',
      '--enable-gpu-rasterization', '--ignore-gpu-blocklist', '--enable-unsafe-swiftshader', '--enable-webgl'
    ],
    protocolTimeout: 180000
  });
}

export async function browser(slot = 0) {
  if (browsers.has(slot)) {
    const b = await browsers.get(slot);
    if (b.connected) return b;
  }
  const p = launch();
  browsers.set(slot, p);
  return p;
}

export async function closeAll() {
  for (const p of browsers.values()) { try { (await p).close(); } catch { } }
}

for (let i = 0; i < MAX_PAGES; i++) freeSlots.push(i);

export async function acquire() {
  if (!freeSlots.length) await new Promise((resolve) => waiters.push(resolve));
  active++;
  return freeSlots.shift();
}

export function release(slot) {
  active = Math.max(0, active - 1);
  if (slot != null) freeSlots.push(slot);
  const next = waiters.shift();
  if (next) next();
}

export function stats() { return { active, queued: waiters.length, max: MAX_PAGES, browsers: browsers.size }; }

export async function openComposition(url, width, height, slot = 0, scale = 1, alpha = false) {
  const b = await browser(slot);
  const page = await b.newPage();
  await page.setViewport({ width, height, deviceScaleFactor: scale || 1 });
  if (alpha) {
    const pre = await page.createCDPSession();
    await pre.send('Emulation.setDefaultBackgroundColorOverride', { color: { r: 0, g: 0, b: 0, a: 0 } });
  }
  const logs = [];
  page.on('console', (m) => { if (m.type() === 'error' && logs.length < 40) logs.push(m.text()); });
  page.on('pageerror', (e) => { if (logs.length < 40) logs.push(String(e.message || e)); });
  page.on('requestfailed', (r) => { if (logs.length < 40) logs.push('request failed: ' + r.url().slice(0, 160)); });
  await page.goto(url, { waitUntil: 'load', timeout: 90000 });
  await page.waitForFunction('window.__AU_READY === true', { timeout: 90000, polling: 50 });
  const cdp = await page.createCDPSession();
  return { page, cdp, logs };
}

async function seekTo(cdp, t) {
  const res = await cdp.send('Runtime.evaluate', { expression: `window.AU.seek(${Number(t)})`, awaitPromise: true, returnByValue: true });
  if (res.exceptionDetails) throw new Error('seek failed at ' + t + ': ' + ((res.exceptionDetails.exception && res.exceptionDetails.exception.description) || res.exceptionDetails.text || '').slice(0, 300));
}

async function grab(cdp, opts) {
  const res = await cdp.send('Page.captureScreenshot', Object.assign({ format: 'jpeg', quality: 92, optimizeForSpeed: true, captureBeyondViewport: false, fromSurface: true }, opts || {}));
  return Buffer.from(res.data, 'base64');
}

function encoder(out, fps, opts) {
  const args = opts.alpha ? [
    '-hide_banner', '-loglevel', 'error', '-y', '-f', 'image2pipe', '-framerate', String(fps), '-c:v', 'png', '-i', '-',
    '-c:v', 'ffv1', '-level', '3', '-pix_fmt', 'bgra', '-r', String(fps), '-an', out
  ] : [
    '-hide_banner', '-loglevel', 'error', '-y', '-f', 'image2pipe', '-framerate', String(fps), '-c:v', 'mjpeg', '-i', '-',
    '-c:v', 'libx264', '-preset', opts.preset || 'veryfast', '-crf', String(opts.crf ?? 17), '-pix_fmt', 'yuv420p',
    ...(opts.threads ? ['-threads', String(opts.threads)] : []),
    '-r', String(fps), '-g', String(fps * 2), '-movflags', '+faststart', '-an', out
  ];
  const proc = spawn(FFMPEG, args, { stdio: ['pipe', 'ignore', 'pipe'] });
  let err = '';
  proc.stderr.on('data', (d) => { err += d.toString(); });
  const done = new Promise((resolve, reject) => {
    proc.on('close', (code) => (code === 0 ? resolve() : reject(new Error('ffmpeg ' + code + ': ' + err.slice(-400)))));
    proc.on('error', reject);
  });
  let failed = null;
  proc.stdin.on('error', (e) => { failed = e; });
  const exited = done.then(() => { throw new Error('ffmpeg exited early'); }, (e) => { throw e; });
  exited.catch(() => null);
  const write = (buf) => {
    if (failed) return Promise.reject(failed);
    if (proc.stdin.write(buf)) return Promise.resolve();
    return Promise.race([new Promise((resolve) => proc.stdin.once('drain', resolve)), exited]);
  };
  return { write, end: () => { proc.stdin.end(); return done; }, kill: () => proc.kill('SIGKILL') };
}

export async function renderRange(job, from, to, out, onFrame, signal) {
  const slot = await acquire();
  let session = null;
  try {
    session = await openComposition(job.url, job.width, job.height, slot, job.scale || 1, !!job.alpha);
    const enc = encoder(out, job.fps, job);
    const shot = job.alpha ? Object.assign({ format: 'png', optimizeForSpeed: false }, job.clip ? { clip: Object.assign({ scale: 1 }, job.clip) } : {}) : { quality: job.quality || 92 };
    let pending = Promise.resolve();
    try {
      for (let f = from; f < to; f++) {
        if (signal && signal.aborted) throw new Error('cancelled');
        await seekTo(session.cdp, f / job.fps);
        const buf = await grab(session.cdp, shot);
        await pending;
        pending = enc.write(buf);
        let small = null;
        if (job.preview && !job.alpha && f % (job.previewEvery || 15) === 0 && (!job.previewGate || job.previewGate())) {
          small = await grab(session.cdp, { quality: 70, clip: { x: 0, y: 0, width: job.width, height: job.height, scale: job.previewScale || 0.3 } }).catch(() => null);
        }
        if (onFrame) onFrame(f, buf, small);
      }
      await pending;
    } catch (error) {
      enc.kill();
      throw error;
    }
    await enc.end();
    return { logs: session.logs };
  } finally {
    if (session) await session.page.close().catch(() => null);
    release(slot);
  }
}

export async function render(job, emit, signal) {
  const started = Date.now();
  const total = Math.max(1, Math.round(job.duration * job.fps));
  const minChunk = job.minChunk || 40;
  const chunks = Math.max(1, Math.min(job.maxChunks || MAX_PAGES, Math.floor(total / minChunk)));
  fs.mkdirSync(path.dirname(job.out), { recursive: true });
  const per = Math.ceil(total / chunks);
  const parts = [];
  let doneFrames = 0;
  let lastEmit = 0;
  let lastPreview = 0;
  const previewMs = job.previewMs || 350;
  job = Object.assign({}, job, {
    threads: job.threads || Math.max(2, Math.floor(CPUS / Math.max(1, Math.min(MAX_PAGES, chunks + active)))),
    previewGate: () => { const now = Date.now(); if (now - lastPreview < previewMs) return false; lastPreview = now; return true; }
  });
  const tasks = [];
  for (let c = 0; c < chunks; c++) {
    const from = c * per;
    const to = Math.min(total, from + per);
    if (from >= to) continue;
    const part = chunks === 1 ? job.out : job.out.replace(/\.(mp4|mkv|mov)$/, (m) => `.part${c}${m}`);
    parts.push(part);
    tasks.push(renderRange(job, from, to, part, (f, buf, small) => {
      doneFrames++;
      const now = Date.now();
      if (now - lastEmit > 180 || doneFrames === total) {
        lastEmit = now;
        emit({ type: 'progress', frame: doneFrames, total, fps: Math.round(doneFrames / Math.max(0.001, (now - started) / 1000) * 10) / 10 });
      }
      if (small) {
        emit({ type: 'preview', frame: f, t: f / job.fps, jpeg: small.toString('base64') });
      }
    }, signal));
  }
  const results = await Promise.all(tasks);
  if (parts.length > 1) {
    const list = job.out.replace(/\.(mp4|mkv|mov)$/, '.concat.txt');
    fs.writeFileSync(list, parts.map((p) => `file '${p.replace(/'/g, "'\\''")}'`).join('\n'));
    await new Promise((resolve, reject) => {
      const proc = spawn(FFMPEG, ['-hide_banner', '-loglevel', 'error', '-y', '-f', 'concat', '-safe', '0', '-i', list, '-c', 'copy', ...(job.alpha ? [] : ['-movflags', '+faststart']), job.out]);
      let err = '';
      proc.stderr.on('data', (d) => { err += d; });
      proc.on('close', (code) => (code === 0 ? resolve() : reject(new Error('concat failed ' + err.slice(-300)))));
    });
    parts.forEach((p) => fs.rmSync(p, { force: true }));
    fs.rmSync(list, { force: true });
  }
  const logs = results.flatMap((r) => r.logs || []);
  return { out: job.out, frames: total, ms: Date.now() - started, chunks: parts.length, logs: [...new Set(logs)].slice(0, 20) };
}

export async function probe(job) {
  const slot = await acquire();
  let session = null;
  try {
    session = await openComposition(job.url, job.width, job.height, slot);
    const times = job.times || [];
    const report = await session.page.evaluate((ts) => window.AU.probe(ts), times);
    const shots = [];
    const scale = job.shotScale || 0.25;
    for (const t of job.shotTimes || []) {
      await seekTo(session.cdp, t);
      const buf = await grab(session.cdp, { quality: 80, clip: { x: 0, y: 0, width: job.width, height: job.height, scale } });
      shots.push({ t, jpeg: buf.toString('base64') });
    }
    const layers = await session.page.evaluate(() => window.AU.layers().length);
    const captions = job.captionTimes && job.captionTimes.length ? await session.page.evaluate((ts) => window.AU.captionTrack(ts), job.captionTimes) : null;
    const captionBox = job.captionBox ? await session.page.evaluate(() => window.AU.captionBox()) : null;
    let layout = null;
    if (job.layoutTimes && job.layoutTimes.length) {
      layout = [];
      for (const t of job.layoutTimes) {
        await seekTo(session.cdp, t);
        const items = await session.page.evaluate(() => window.AU.layers().filter((l) => l.visible && !l.caption).slice(0, 18)
          .map((l) => ({ id: l.id, tag: l.tag, x: Math.round(l.x), y: Math.round(l.y), w: Math.round(l.w), h: Math.round(l.h), text: l.text.slice(0, 40) })));
        layout.push({ t, items });
      }
    }
    return { report, shots, layers, captions, captionBox, layout, logs: session.logs };
  } finally {
    if (session) await session.page.close().catch(() => null);
    release(slot);
  }
}

export async function snapshot(job) {
  const slot = await acquire();
  let session = null;
  try {
    session = await openComposition(job.url, job.width, job.height, slot);
    const out = [];
    for (const t of job.times || [job.t || 0]) {
      await seekTo(session.cdp, t);
      const buf = await grab(session.cdp, { quality: job.quality || 85, clip: { x: 0, y: 0, width: job.width, height: job.height, scale: job.scale || 1 } });
      if (job.out && (job.times || []).length <= 1) { fs.mkdirSync(path.dirname(job.out), { recursive: true }); fs.writeFileSync(job.out, buf); }
      out.push({ t, jpeg: job.out ? null : buf.toString('base64') });
    }
    return { shots: out, logs: session.logs };
  } finally {
    if (session) await session.page.close().catch(() => null);
    release(slot);
  }
}

const UA = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0 Safari/537.36';

export async function browse(job, emit) {
  const slot = await acquire();
  const b = await browser(slot);
  const page = await b.newPage();
  try {
    await page.setUserAgent(UA);
    await page.setViewport({ width: job.width || 1280, height: job.height || 800, deviceScaleFactor: 1 });
    await page.setRequestInterception(true);
    page.on('request', (r) => {
      const type = r.resourceType();
      if (type === 'media' || type === 'websocket' || type === 'eventsource') r.abort().catch(() => null); else r.continue().catch(() => null);
    });
    const cdp = await page.createCDPSession();
    await page.goto(job.url, { waitUntil: 'domcontentloaded', timeout: job.timeout || 20000 }).catch(() => null);
    await new Promise((r) => setTimeout(r, 900));
    const frames = [];
    const steps = Math.max(1, Math.min(4, job.frames || 2));
    for (let i = 0; i < steps; i++) {
      const shot = await grab(cdp, { quality: 62 }).catch(() => null);
      if (shot) {
        const frame = { i, jpeg: shot.toString('base64') };
        frames.push(frame);
        if (emit) emit({ type: 'frame', ...frame });
      }
      await page.evaluate(() => window.scrollBy(0, Math.round(window.innerHeight * 0.85))).catch(() => null);
      await new Promise((r) => setTimeout(r, 350));
    }
    const data = await page.evaluate(() => {
      const pickRoot = document.querySelector('article, main, [role=main]') || document.body;
      const clone = pickRoot.cloneNode(true);
      clone.querySelectorAll('script,style,noscript,svg,nav,footer,header,form,iframe,aside').forEach((n) => n.remove());
      const text = (clone.innerText || '').replace(/\n{3,}/g, '\n\n').trim().slice(0, 24000);
      const links = Array.from(document.querySelectorAll('a[href]')).slice(0, 400)
        .map((a) => ({ text: (a.innerText || '').trim().slice(0, 100), href: a.href }))
        .filter((l) => l.text && /^https?:/.test(l.href)).slice(0, 60);
      const meta = (n) => (document.querySelector(`meta[name="${n}"], meta[property="${n}"]`) || {}).content || '';
      return { title: document.title, url: location.href, text, links, description: meta('description') || meta('og:description'), image: meta('og:image') };
    }).catch(() => ({ title: '', url: job.url, text: '', links: [] }));
    return Object.assign(data, { frames: job.returnFrames === false ? [] : frames.slice(-1) });
  } finally {
    await page.close().catch(() => null);
    release(slot);
  }
}

const PRIVATE_HOST = /^(localhost|0\.0\.0\.0|127\.|10\.|192\.168\.|169\.254\.|172\.(1[6-9]|2\d|3[01])\.|\[?::1\]?$|\[?f[cd][0-9a-f]{2}:|metadata\.google\.internal)/i;

function blockedUrl(u) {
  try {
    const x = new URL(u);
    if (x.protocol === 'data:' || x.protocol === 'blob:') return false;
    if (x.protocol !== 'http:' && x.protocol !== 'https:') return true;
    return PRIVATE_HOST.test(x.hostname);
  } catch { return true; }
}

function pageClean() {
  const words = /cookie|consent|gdpr|privacy choices|subscribe|newsletter|sign up|sign in|log in|accept all|we use cookies|notifications|install our app|paywall/i;
  document.documentElement.style.setProperty('overflow', 'auto', 'important');
  if (document.body) document.body.style.setProperty('overflow', 'auto', 'important');
  for (const el of Array.from(document.querySelectorAll('body *'))) {
    const cs = getComputedStyle(el);
    if (cs.position !== 'fixed' && cs.position !== 'sticky') continue;
    const r = el.getBoundingClientRect();
    const big = r.width * r.height > window.innerWidth * window.innerHeight * 0.18;
    const txt = (el.innerText || '').slice(0, 2000);
    if (words.test(txt) || big || (cs.position === 'fixed' && (+cs.zIndex || 0) > 100 && r.top > window.innerHeight * 0.4)) el.style.setProperty('display', 'none', 'important');
    else el.style.setProperty('position', 'absolute', 'important');
  }
  for (const el of Array.from(document.querySelectorAll('[class*="cookie" i],[id*="cookie" i],[class*="consent" i],[id*="consent" i],[class*="modal-backdrop" i]'))) el.style.setProperty('display', 'none', 'important');
}

function pageFind(phrases, limit) {
  const out = [];
  const nodes = [];
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, { acceptNode: (n) => (n.nodeValue.trim() && n.parentElement && n.parentElement.getClientRects().length ? 1 : 2) });
  let n;
  while ((n = walker.nextNode())) nodes.push(n);
  let flat = '';
  const map = [];
  for (const node of nodes) {
    map.push({ node, start: flat.length });
    flat += node.nodeValue;
  }
  const fold = (x) => x.toLowerCase().replace(/[‘’‛′]/g, "'").replace(/[“”″]/g, '"').replace(/[–—]/g, '-').replace(/ /g, ' ');
  const lower = fold(flat);
  const locate = (pos) => {
    let lo = 0, hi = map.length - 1;
    while (lo < hi) { const mid = (lo + hi + 1) >> 1; if (map[mid].start <= pos) lo = mid; else hi = mid - 1; }
    const m = map[lo];
    return { node: m.node, offset: Math.max(0, Math.min(m.node.nodeValue.length, pos - m.start)) };
  };
  const pattern = (q) => new RegExp(fold(q.trim()).split(/\s+/).map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('\\s+'), 'g');
  for (const phrase of phrases) {
    const q = String(phrase || '').trim();
    if (!q) continue;
    const rx = pattern(q);
    const hits = [];
    let m;
    while (hits.length < limit && (m = rx.exec(lower))) {
      try {
        const a = locate(m.index), b = locate(m.index + m[0].length);
        const range = document.createRange();
        range.setStart(a.node, a.offset);
        range.setEnd(b.node, b.offset);
        const rects = Array.from(range.getClientRects()).filter((r) => r.width > 2 && r.height > 2);
        if (!rects.length) continue;
        const lines = [];
        for (const r of rects) {
          const last = lines[lines.length - 1];
          if (last && Math.abs(last.y - r.top) < r.height * 0.5) { const x2 = Math.max(last.x + last.w, r.right); last.x = Math.min(last.x, r.left); last.w = x2 - last.x; last.h = Math.max(last.h, r.height); }
          else lines.push({ x: r.left, y: r.top, w: r.width, h: r.height });
        }
        hits.push(lines.map((l) => ({ x: l.x + window.scrollX, y: l.y + window.scrollY, w: l.w, h: l.h })));
      } catch (e) { }
    }
    out.push({ phrase, hits });
  }
  return out;
}

function pageImages(min) {
  const seen = new Set();
  const out = [];
  const abs = (u) => { try { return new URL(u, location.href).href; } catch (e) { return ''; } };
  const add = (url, w, h, alt, kind) => {
    url = abs(url);
    if (!/^https?:/.test(url) || seen.has(url)) return;
    if (w && h && Math.max(w, h) < min) return;
    if (/sprite|pixel|tracking|spacer|blank\.gif|1x1|wordmark|tagline|favicon|\/static\/images\/|badge|avatar|emoji/i.test(url)) return;
    seen.add(url);
    out.push({ url, w: w || null, h: h || null, alt: (alt || '').trim().slice(0, 140), kind });
  };
  const best = (srcset) => {
    let pick = '', size = 0;
    for (const part of String(srcset || '').split(',')) {
      const bits = part.trim().split(/\s+/);
      const v = parseFloat(bits[1]) || 1;
      if (bits[0] && v >= size) { size = v; pick = bits[0]; }
    }
    return pick;
  };
  const meta = (k) => (document.querySelector(`meta[property="${k}"], meta[name="${k}"]`) || {}).content;
  if (meta('og:image')) add(meta('og:image'), 0, 0, meta('og:title') || document.title, 'og');
  if (meta('twitter:image')) add(meta('twitter:image'), 0, 0, document.title, 'og');
  for (const img of Array.from(document.images)) {
    const pic = img.closest('picture');
    const src = (pic && best((pic.querySelector('source') || {}).srcset)) || best(img.srcset) || img.currentSrc || img.src || img.dataset.src || img.dataset.original;
    add(src, img.naturalWidth, img.naturalHeight, img.alt || img.title, 'img');
  }
  for (const a of Array.from(document.querySelectorAll('a[href]'))) {
    if (/\.(jpe?g|png|webp|gif|svg)(\?|$)/i.test(a.href)) add(a.href, 0, 0, a.innerText || a.title, 'link');
  }
  let count = 0;
  for (const el of Array.from(document.querySelectorAll('body *'))) {
    if (count > 400) break;
    const r = el.getBoundingClientRect();
    if (r.width < min * 0.5 || r.height < min * 0.3) continue;
    const bg = getComputedStyle(el).backgroundImage;
    const m = bg && bg.match(/url\(["']?([^"')]+)["']?\)/);
    if (m) { add(m[1], Math.round(r.width), Math.round(r.height), el.getAttribute('aria-label') || '', 'css'); count++; }
  }
  return out.slice(0, 120);
}

async function autoscroll(page, steps) {
  for (let i = 0; i < steps; i++) {
    const more = await page.evaluate(() => { window.scrollBy(0, Math.round(window.innerHeight * 0.9)); return window.scrollY + window.innerHeight < document.documentElement.scrollHeight - 4; }).catch(() => false);
    await new Promise((r) => setTimeout(r, 260));
    if (!more) break;
  }
  await page.evaluate(() => window.scrollTo(0, 0)).catch(() => null);
  await new Promise((r) => setTimeout(r, 300));
}

export async function capture(job) {
  if (blockedUrl(job.url || '')) throw new Error('only public http and https pages can be captured');
  const slot = await acquire();
  const b = await browser(slot);
  const page = await b.newPage();
  try {
    const width = Math.max(320, Math.min(2560, job.width || 1440));
    const height = Math.max(320, Math.min(2400, job.height || 900));
    const scale = Math.max(1, Math.min(2, +job.scale || 1));
    await page.setUserAgent(UA);
    await page.setViewport({ width, height, deviceScaleFactor: scale });
    if (job.dark) await page.emulateMediaFeatures([{ name: 'prefers-color-scheme', value: 'dark' }]);
    await page.setRequestInterception(true);
    page.on('request', (r) => {
      const type = r.resourceType();
      if (blockedUrl(r.url()) || type === 'media' || type === 'websocket' || type === 'eventsource') r.abort().catch(() => null); else r.continue().catch(() => null);
    });
    const resp = await page.goto(job.url, { waitUntil: 'networkidle2', timeout: job.timeout || 30000 }).catch(() => null);
    if (blockedUrl(page.url())) throw new Error('the page redirected to a private address');
    await new Promise((r) => setTimeout(r, Math.max(0, Math.min(8000, job.wait == null ? 1200 : job.wait))));
    if (job.clean !== false) await page.evaluate(pageClean).catch(() => null);
    if (job.hide && [].concat(job.hide).length) await page.evaluate((sels) => sels.forEach((s) => { try { document.querySelectorAll(s).forEach((n) => n.style.setProperty('display', 'none', 'important')); } catch (e) { } }), [].concat(job.hide)).catch(() => null);
    if (job.full || job.images) await autoscroll(page, job.full ? 16 : 6);
    if (job.clean !== false) await page.evaluate(pageClean).catch(() => null);
    await page.evaluate(`window.__auFind = ${pageFind.toString()}`).catch(() => null);
    const phrases = [].concat(job.find || []).filter(Boolean).slice(0, 12);
    const focus = job.scrollTo || (!job.full && !job.selector ? phrases[0] : null);
    if (focus) {
      await page.evaluate((q) => {
        const hit = window.__auFind([q], 1);
        const box = hit[0] && hit[0].hits[0] && hit[0].hits[0][0];
        if (box) window.scrollTo(0, Math.max(0, box.y - window.innerHeight * 0.38));
      }, focus).catch(() => null);
      await new Promise((r) => setTimeout(r, 500));
    }
    const origin = await page.evaluate(() => ({ x: window.scrollX, y: window.scrollY, w: window.innerWidth, h: window.innerHeight, docH: document.documentElement.scrollHeight })).catch(() => ({ x: 0, y: 0, w: width, h: height, docH: height }));
    let png;
    let shotW = origin.w, shotH = origin.h;
    let base = { x: origin.x, y: origin.y };
    if (job.selector) {
      const el = await page.$(job.selector);
      if (!el) throw new Error(`no element matches ${job.selector}`);
      await el.evaluate((node) => node.scrollIntoView({ block: 'center' }));
      await new Promise((r) => setTimeout(r, 300));
      const rect = await el.evaluate((node) => { const r = node.getBoundingClientRect(); return { x: r.left + window.scrollX, y: r.top + window.scrollY, w: r.width, h: r.height }; });
      png = await el.screenshot({ type: 'png' });
      base = { x: rect.x, y: rect.y };
      shotW = rect.w; shotH = rect.h;
    } else if (job.full) {
      const maxH = Math.min(origin.docH, job.maxHeight || 9000);
      await page.evaluate(() => window.scrollTo(0, 0));
      png = await page.screenshot({ type: 'png', clip: { x: 0, y: 0, width: origin.w, height: maxH }, captureBeyondViewport: true });
      base = { x: 0, y: 0 };
      shotH = maxH;
    } else {
      png = await page.screenshot({ type: 'png' });
    }
    const found = phrases.length ? await page.evaluate((ph) => window.__auFind(ph, 3), phrases).catch(() => []) : [];
    const pct = (v, total) => Math.round((v / total) * 10000) / 100;
    const boxes = found.map((f) => ({ phrase: f.phrase, hits: f.hits.map((lines) => lines.map((l) => [pct(l.x - base.x, shotW), pct(l.y - base.y, shotH), pct(l.w, shotW), pct(l.h, shotH)])
      .filter((bx) => bx[1] + bx[3] > 0 && bx[1] < 100 && bx[0] < 100)).filter((lines) => lines.length) }));
    const images = job.images ? await page.evaluate(pageImages, job.minImage || 220).catch(() => []) : [];
    const data = await page.evaluate(() => {
      const meta = (k) => (document.querySelector(`meta[name="${k}"], meta[property="${k}"]`) || {}).content || '';
      return { title: document.title, url: location.href, description: meta('description') || meta('og:description'), site: meta('og:site_name') };
    }).catch(() => ({ title: '', url: job.url }));
    return Object.assign(data, { status: resp ? resp.status() : null, png: png.toString('base64'), width: Math.round(shotW), height: Math.round(shotH), scale, boxes, images });
  } finally {
    await page.close().catch(() => null);
    release(slot);
  }
}
