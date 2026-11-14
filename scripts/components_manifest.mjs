import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const runtime = path.join(root, 'web', 'runtime');
const sandbox = { window: {}, document: {}, console };
vm.createContext(sandbox);
for (const file of ['components.js', 'characters.js', 'models.js', 'documentary.js', 'actors.js', 'lens.js', 'toons.js', 'sets.js', 'world3d.js', 'stickman.js', 'animals.js']) {
  const p = path.join(runtime, file);
  if (fs.existsSync(p)) vm.runInContext(fs.readFileSync(p, 'utf8'), sandbox, { filename: file });
}
const reg = sandbox.window.AU_COMPONENTS;
const list = reg.list().map((m) => ({ name: m.name, category: m.category, description: m.description, params: m.params, example: m.example || '' }));
const out = { common: reg.common, components: list };
fs.writeFileSync(path.join(runtime, 'components.json'), JSON.stringify(out, null, 1));
console.log(JSON.stringify({ components: list.length, names: list.map((c) => c.name) }));
