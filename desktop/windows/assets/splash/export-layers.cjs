const fs = require('fs');
const path = require('path');

const dir = __dirname;
const repo = process.env.AUTEUR_REPO || path.resolve(dir, '..', '..', '..', '..');
const puppeteer = require(path.join(repo, 'node_modules', 'puppeteer-core'));
const fonts = path.join(repo, 'web', 'vendor', 'fonts');
const chrome = process.env.CHROME_PATH || ['/usr/bin/google-chrome', '/usr/bin/chromium', 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'].find((p) => fs.existsSync(p));
const svg = fs.readFileSync(path.join(dir, 'splash-master.svg'), 'utf8');
const font = (file) => 'data:font/woff2;base64,' + fs.readFileSync(path.join(fonts, file)).toString('base64');
const ALL = ['L-left', 'L-bg', 'L-orbit', 'L-links', 'L-ends', 'L-strip', 'L-lens', 'v1', 'v2', 'v3', 'v4', 'v5', 'v6', 'v7', 'L-labels'];
const LAYERS = { bg: ['L-bg'], lens: ['L-lens'], labels: ['L-labels'], v1: ['v1'], v2: ['v2'], v3: ['v3'], v4: ['v4'], v5: ['v5'], v6: ['v6'], v7: ['v7'] };

(async () => {
  const b = await puppeteer.launch({ executablePath: chrome, headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage'] });
  const page = await b.newPage();
  await page.setViewport({ width: 1520, height: 920 });
  const css = `@font-face { font-family: 'Bricolage Grotesque'; src: url(${font('bricolage-grotesque-latin-wght-normal.woff2')}) format('woff2'); font-weight: 200 800; }
    html, body { margin: 0; background: transparent; } svg { display: block; }`;
  await page.setContent(`<html><head><style>${css}</style><style id="vis"></style></head><body>${svg}</body></html>`);
  await page.evaluate(() => document.fonts.ready);
  const out = path.join(dir, 'layers');
  fs.mkdirSync(out, { recursive: true });
  for (const [name, keep] of Object.entries(LAYERS)) {
    const hide = ALL.filter((id) => !keep.includes(id)).map((id) => '#' + id).join(',');
    await page.evaluate((h) => { document.getElementById('vis').textContent = h + ' { display: none !important; }'; }, hide);
    await page.screenshot({ path: path.join(out, name + '.png'), omitBackground: true });
  }
  const hideAllButStrip = ALL.filter((id) => id !== 'L-strip').map((id) => '#' + id).join(',');
  for (let k = 0; k < 4; k++) {
    await page.evaluate((h, dx) => { document.getElementById('vis').textContent = h + ' { display: none !important; } #L-strip-pull { transform: translateX(' + dx + 'px); }'; }, hideAllButStrip, -26 * k);
    await page.screenshot({ path: path.join(out, 'strip' + k + '.png'), omitBackground: true });
  }
  fs.rmSync(path.join(out, 'strip.png'), { force: true });
  await page.evaluate(() => { document.getElementById('vis').textContent = ''; });
  await page.screenshot({ path: path.join(dir, 'splash-master-preview.png'), omitBackground: true });
  await b.close();
  console.log('exported', Object.keys(LAYERS).length, 'layers');
})();
