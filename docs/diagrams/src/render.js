// Renderiza diagrams/*.html en PNG y en SVG animado, en español e inglés.
// Uso: node render.js <outDir> [nombre...]   →  <outDir>/{es,en}/<nombre>.{png,svg}
const { chromium } = require('playwright');
const { execFileSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');
const i18n = require('./i18n');
const exportSvg = require('./export-svg');

const dir = __dirname;
const iconDir = path.join(dir, 'node_modules/lucide-static/icons');
const css = fs.readFileSync(path.join(dir, 'kit.css'), 'utf8');
const kit = fs.readFileSync(path.join(dir, 'kit.js'), 'utf8');

// Fuentes que se incrustan en los SVG (subconjunto con solo los caracteres usados)
const FONT_FILES = {
  'Inter|500': 'Inter-Medium', 'Inter|600': 'Inter-SemiBold', 'Inter|700': 'Inter-Bold',
  'Inter Display|700': 'InterDisplay-Bold', 'Inter Display|800': 'InterDisplay-ExtraBold',
  'JetBrains Mono|500': 'JetBrainsMono-Medium', 'JetBrains Mono|600': 'JetBrainsMono-SemiBold',
  'JetBrains Mono|700': 'JetBrainsMono-SemiBold',
};
function findFont(name) {
  const out = execFileSync('fc-list', ['--format', '%{file}\n']).toString().split('\n');
  const f = out.find((p) => path.basename(p).replace(/\.(otf|ttf)$/, '') === name);
  if (!f) throw new Error('Fuente no encontrada: ' + name);
  return f;
}
function fontFaces(usage) {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'dg-'));
  return Object.entries(usage).map(([key, chars]) => {
    if (!FONT_FILES[key]) throw new Error('Sin fuente para ' + key);
    const [family, weight] = key.split('|');
    const txt = path.join(tmp, 'chars.txt'); const woff = path.join(tmp, 'f.woff2');
    fs.writeFileSync(txt, [...new Set(chars + ' ')].join(''));
    execFileSync('pyftsubset', [findFont(FONT_FILES[key]), `--text-file=${txt}`, '--flavor=woff2', `--output-file=${woff}`, '--layout-features=*']);
    const b64 = fs.readFileSync(woff).toString('base64');
    return `@font-face{font-family:'${family}';font-weight:${weight};src:url(data:font/woff2;base64,${b64}) format('woff2')}`;
  }).join('\n');
}

function translate(html, lang) {
  const dict = i18n[lang];
  if (!dict) return html;
  const tr = (t) => { const k = t.trim(); return dict[k] ? t.replace(k, dict[k]) : t; };
  for (const [k, v] of Object.entries(dict)) if (k.startsWith('<')) html = html.split(k).join(v);
  return html
    .replace(/>([^<>]+)</g, (_, t) => '>' + tr(t) + '<')
    .replace(/label: '([^']+)'/g, (_, t) => `label: '${tr(t)}'`)
    .replace(/<html lang="es">/, `<html lang="${lang}">`);
}

function icons(html) {
  return html.replace(/<i data-icon="([\w-]+)"><\/i>/g, (_, n) => {
    const f = path.join(iconDir, n + '.svg');
    if (!fs.existsSync(f)) throw new Error('Icono no encontrado: ' + n);
    return fs.readFileSync(f, 'utf8').replace(/<!--[\s\S]*?-->/g, '').replace(/class="[^"]*"/, '');
  });
}

const SVG_STYLE = `
.pulse{animation:pulse 2.4s ease-in-out infinite}
@keyframes pulse{0%,100%{opacity:1}50%{opacity:.45}}
@media (prefers-reduced-motion: reduce){.pulse{animation:none}}`;

(async () => {
  const out = path.resolve(process.argv[2]);
  const only = process.argv.slice(3);
  const files = fs.readdirSync(path.join(dir, 'diagrams')).filter((f) => f.endsWith('.html'))
    .filter((f) => !only.length || only.includes(path.basename(f, '.html')));
  const browser = await chromium.launch();
  for (const lang of ['es', 'en']) {
    fs.mkdirSync(path.join(out, lang), { recursive: true });
    for (const f of files) {
      const raw = translate(fs.readFileSync(path.join(dir, 'diagrams', f), 'utf8'), lang);
      const [, w, h] = raw.match(/<!--\s*size:\s*(\d+)x(\d+)\s*-->/);
      const body = icons(raw);
      const script = (body.match(/<script>[\s\S]*<\/script>/) || [''])[0];
      const html = `<!doctype html><html lang="${lang}"><head><meta charset="utf-8"><style>${css}</style>
        <style>html,body{width:${w}px;height:${h}px}</style></head><body>${body.replace(script, '')}
        <script>${kit}</script>${script}</body></html>`;
      const page = await browser.newPage({ viewport: { width: +w, height: +h }, deviceScaleFactor: 2 });
      const errors = [];
      page.on('pageerror', (e) => errors.push(e.message));
      await page.setContent(html, { waitUntil: 'networkidle' });
      await page.evaluate(() => document.fonts.ready);
      const name = path.basename(f, '.html');
      await page.screenshot({ path: path.join(out, lang, name + '.png') });

      const { body: svgBody, fonts } = await page.evaluate(`(${exportSvg.toString()})()`);
      const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" role="img">
<title>${name}</title>
<defs>
<style>${fontFaces(fonts)}${SVG_STYLE}</style>
<pattern id="dots" width="26" height="26" patternUnits="userSpaceOnUse"><circle cx="1.2" cy="1.2" r="1.2" fill="rgba(255,255,255,0.07)"/></pattern>
<filter id="shadow" x="-10%" y="-10%" width="120%" height="140%"><feDropShadow dx="0" dy="10" stdDeviation="12" flood-color="#000" flood-opacity="0.35"/></filter>
<filter id="glow" x="-200%" y="-200%" width="500%" height="500%"><feGaussianBlur stdDeviation="3" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
</defs>
<rect width="${w}" height="${h}" fill="#0b0d12"/>
<rect width="${w}" height="${h}" fill="url(#dots)"/>
${svgBody}
</svg>`;
      fs.writeFileSync(path.join(out, lang, name + '.svg'), svg);
      console.log(`${lang}/${name}`, errors.length ? 'ERRORES: ' + errors.join('; ') : 'ok', `svg ${(svg.length / 1024).toFixed(0)} KB`);
      await page.close();
    }
  }
  await browser.close();
})();
