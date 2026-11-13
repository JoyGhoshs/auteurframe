import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const nm = path.join(root, 'node_modules');
const out = path.join(root, 'web', 'vendor');

const ensure = (dir) => fs.mkdirSync(dir, { recursive: true });
const copy = (from, to) => {
  ensure(path.dirname(to));
  fs.copyFileSync(from, to);
};

ensure(out);

const gsapFiles = [
  'gsap.min.js', 'SplitText.min.js', 'DrawSVGPlugin.min.js', 'MorphSVGPlugin.min.js',
  'MotionPathPlugin.min.js', 'ScrambleTextPlugin.min.js', 'TextPlugin.min.js', 'CustomEase.min.js',
  'CustomBounce.min.js', 'CustomWiggle.min.js', 'Physics2DPlugin.min.js', 'Flip.min.js', 'EasePack.min.js'
];
const gsapBundle = gsapFiles.map((name) => fs.readFileSync(path.join(nm, 'gsap', 'dist', name), 'utf8')).join('\n;\n');
fs.writeFileSync(path.join(out, 'gsap.bundle.js'), gsapBundle);

copy(path.join(nm, 'roughjs', 'bundled', 'rough.js'), path.join(out, 'rough.js'));
copy(path.join(nm, 'katex', 'dist', 'katex.min.js'), path.join(out, 'katex', 'katex.min.js'));
copy(path.join(nm, 'katex', 'dist', 'katex.min.css'), path.join(out, 'katex', 'katex.min.css'));
for (const file of fs.readdirSync(path.join(nm, 'katex', 'dist', 'fonts'))) {
  if (file.endsWith('.woff2')) copy(path.join(nm, 'katex', 'dist', 'fonts', file), path.join(out, 'katex', 'fonts', file));
}
copy(path.join(nm, 'htm', 'preact', 'standalone.module.js'), path.join(out, 'preact.js'));
if (fs.existsSync(path.join(nm, 'maplibre-gl', 'dist', 'maplibre-gl.js'))) {
  copy(path.join(nm, 'maplibre-gl', 'dist', 'maplibre-gl.js'), path.join(out, 'maplibre', 'maplibre-gl.js'));
  copy(path.join(nm, 'maplibre-gl', 'dist', 'maplibre-gl.css'), path.join(out, 'maplibre', 'maplibre-gl.css'));
}
try {
  const esbuild = await import('esbuild');
  await esbuild.build({ entryPoints: [path.join(root, 'scripts', 'bundles', 'three-entry.mjs')], bundle: true, minify: true, format: 'iife', outfile: path.join(out, 'three.min.js'), logLevel: 'silent' });
} catch (error) {
  copy(path.join(nm, 'three', 'build', 'three.min.js'), path.join(out, 'three.min.js'));
}

const iconDir = path.join(nm, 'lucide-static', 'icons');
const icons = {};
for (const file of fs.readdirSync(iconDir)) {
  if (!file.endsWith('.svg')) continue;
  const svg = fs.readFileSync(path.join(iconDir, file), 'utf8');
  const inner = svg.replace(/<!--[\s\S]*?-->/g, '').replace(/^[\s\S]*?<svg[^>]*>/, '').replace(/<\/svg>[\s\S]*$/, '').replace(/\s+/g, ' ').trim();
  icons[file.replace(/\.svg$/, '')] = inner;
}
fs.writeFileSync(path.join(out, 'lucide.js'), 'window.AU_ICONS=' + JSON.stringify(icons) + ';');
fs.writeFileSync(path.join(out, 'lucide.json'), JSON.stringify(icons));

const fontPackages = [
  ['@fontsource-variable/inter', ['index.css']],
  ['@fontsource-variable/space-grotesk', ['index.css']],
  ['@fontsource-variable/fraunces', ['index.css', 'wght-italic.css']],
  ['@fontsource-variable/bricolage-grotesque', ['index.css']],
  ['@fontsource-variable/jetbrains-mono', ['index.css']],
  ['@fontsource/dm-serif-display', ['index.css', '400-italic.css']],
  ['@fontsource/instrument-serif', ['index.css', '400-italic.css']],
  ['@fontsource/archivo-black', ['index.css']],
  ['@fontsource/bebas-neue', ['index.css']],
  ['@fontsource-variable/caveat', ['index.css']],
  ['@fontsource/permanent-marker', ['index.css']],
  ['@fontsource-variable/syne', ['index.css']],
  ['@fontsource-variable/unbounded', ['index.css']],
  ['@fontsource-variable/playfair-display', ['index.css', 'wght-italic.css']],
  ['@fontsource/press-start-2p', ['index.css']],
  ['@fontsource-variable/manrope', ['index.css']],
  ['@fontsource/anton', ['index.css']],
  ['@fontsource-variable/dm-sans', ['index.css']],
  ['@fontsource-variable/newsreader', ['index.css', 'wght-italic.css']],
  ['@fontsource/kalam', ['index.css', '700.css']],
  ['@fontsource/space-mono', ['index.css', '700.css']],
  ['@fontsource-variable/big-shoulders-display', ['index.css']],
];
const keep = /-(latin|latin-ext)-/;
const fontOut = path.join(out, 'fonts');
ensure(fontOut);
const faces = [];
const families = new Set();
for (const [pkg, cssFiles] of fontPackages) {
  for (const cssFile of cssFiles) {
    const cssPath = path.join(nm, pkg, cssFile);
    if (!fs.existsSync(cssPath)) continue;
    const css = fs.readFileSync(cssPath, 'utf8');
    for (const block of css.match(/@font-face\s*{[^}]*}/g) || []) {
      const urlMatch = block.match(/url\(\.\/files\/([^)]+\.woff2)\)/);
      if (!urlMatch || !keep.test(urlMatch[1])) continue;
      const file = urlMatch[1];
      copy(path.join(nm, pkg, 'files', file), path.join(fontOut, file));
      const family = (block.match(/font-family:\s*'([^']+)'/) || [])[1];
      if (family) families.add(family);
      faces.push(block.replace(/src:[^;]+;/, `src: url(/vendor/fonts/${file}) format('woff2');`).replace('font-display: swap;', 'font-display: block;'));
    }
  }
}
const intl = path.join(root, 'assets', 'fonts-intl');
if (fs.existsSync(intl)) {
  const intlOut = path.join(fontOut, 'intl');
  fs.mkdirSync(intlOut, { recursive: true });
  for (const file of fs.readdirSync(path.join(intl, 'files'))) copy(path.join(intl, 'files', file), path.join(intlOut, file));
  copy(path.join(intl, 'fonts-intl.css'), path.join(out, 'fonts-intl.css'));
  copy(path.join(intl, 'fonts-catalog.json'), path.join(out, 'fonts-catalog.json'));
}
const localFonts = path.join(root, 'assets', 'fonts');
if (fs.existsSync(localFonts) && !fs.existsSync(intl)) {
  for (const file of fs.readdirSync(localFonts)) {
    if (!/^Noto/.test(file)) continue;
    copy(path.join(localFonts, file), path.join(fontOut, file));
    const family = file.replace(/\.ttf$/, '').replace(/([a-z])([A-Z])/g, '$1 $2').replace('KR', ' KR').replace('JP', ' JP').replace('SC', ' SC').replace(/\s+/g, ' ').trim();
    families.add(family);
    faces.push(`@font-face {\n  font-family: '${family}';\n  font-style: normal;\n  font-display: block;\n  font-weight: 100 900;\n  src: url(/vendor/fonts/${file}) format('truetype');\n}`);
  }
}
fs.writeFileSync(path.join(out, 'fonts.css'), faces.join('\n\n') + '\n');
fs.writeFileSync(path.join(out, 'fonts.json'), JSON.stringify([...families].sort(), null, 1));
console.log(JSON.stringify({ icons: Object.keys(icons).length, faces: faces.length, families: [...families] }));

const LIBS = [
  { id: 'd3', file: 'd3/dist/d3.min.js', global: 'd3', version: '7.9.0', use: 'scales, shapes, geo projections, force layouts, hierarchy; drive with tl or AU.onFrame' },
  { id: 'pixi', file: 'pixi.js/dist/pixi.min.js', global: 'PIXI', version: '7.4.2', use: 'GPU 2D sprites, particles, filters; create Application with autoStart false and call app.render() inside AU.onFrame' },
  { id: 'p5', file: 'p5/lib/p5.min.js', global: 'p5', version: '1.9.4', use: 'generative drawing; instance mode, noLoop(), draw from t inside AU.onFrame via sketch.redraw()' },
  { id: 'anime', file: 'animejs/lib/anime.min.js', global: 'anime', version: '3.2.2', use: 'alternative tween engine; autoplay false and anim.seek(t*1000) in AU.onFrame' },
  { id: 'matter', file: 'matter-js/build/matter.min.js', global: 'Matter', version: '0.19.0', use: '2D physics; pre-simulate with fixed dt at build time, store positions per frame, read them in AU.onFrame' },
  { id: 'lottie', file: 'lottie-web/build/player/lottie.min.js', global: 'lottie', version: '5.12.2', use: 'play Lottie JSON from assets; autoplay false, goToAndStop(t*1000) in AU.onFrame' },
  { id: 'chroma', file: 'chroma-js/chroma.min.js', global: 'chroma', version: '2.4.2', use: 'colour scales and interpolation derived from theme tokens' },
  { id: 'simplex', file: 'simplex-noise/simplex-noise.js', global: 'SimplexNoise', version: '2.4.0', use: 'seeded organic noise for flow fields, wobble, terrain; new SimplexNoise(ctx.rand)' },
  { id: 'paper', file: 'paper/dist/paper-full.min.js', global: 'paper', version: '0.12.17', use: 'vector scene graph and boolean path ops on a canvas; redraw from t in AU.onFrame' },
  { id: 'flubber', file: 'flubber/build/flubber.min.js', global: 'flubber', version: '0.4.2', use: 'smooth morphs between any two SVG shapes; interpolator(t) inside AU.onFrame' },
  { id: 'three', file: 'three/build/three.min.js', global: 'THREE', version: '0.158.0', use: 'real 3D; prefer the AU.three(selector, setup) helper which renders per frame' },
  { id: 'rough', file: 'roughjs/bundled/rough.js', global: 'rough', version: '4.6.6', use: 'hand-drawn shapes; prefer AU.rough helper with boil option' },
  { id: 'katex', file: 'katex/dist/katex.min.js', global: 'katex', version: '0.19', use: 'math typesetting; prefer AU.math helper' },
];
const libOut = path.join(out, 'lib');
fs.mkdirSync(libOut, { recursive: true });
const catalog = [];
for (const lib of LIBS) {
  const src = path.join(nm, lib.file);
  if (!fs.existsSync(src)) continue;
  const name = lib.id + '.js';
  copy(src, path.join(libOut, name));
  catalog.push({ id: lib.id, global: lib.global, version: lib.version, url: '/vendor/lib/' + name, use: lib.use, bytes: fs.statSync(src).size });
}
fs.writeFileSync(path.join(out, 'libraries.json'), JSON.stringify(catalog, null, 1));
console.log(JSON.stringify({ libraries: catalog.map((l) => l.id) }));
