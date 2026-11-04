// Renderiza diagrams/*.html a PNG. Uso: node render.js <outDir> [nombre...]
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const dir = __dirname;
const iconDir = path.join(dir, 'node_modules/lucide-static/icons');
const css = fs.readFileSync(path.join(dir, 'kit.css'), 'utf8');
const kit = fs.readFileSync(path.join(dir, 'kit.js'), 'utf8');

function icons(html) {
  return html.replace(/<i data-icon="([\w-]+)"><\/i>/g, (_, n) => {
    const f = path.join(iconDir, n + '.svg');
    if (!fs.existsSync(f)) throw new Error('Icono no encontrado: ' + n);
    return fs.readFileSync(f, 'utf8').replace(/<!--[\s\S]*?-->/g, '').replace(/class="[^"]*"/, '');
  });
}

(async () => {
  const out = process.argv[2];
  const only = process.argv.slice(3);
  const files = fs.readdirSync(path.join(dir, 'diagrams')).filter(f => f.endsWith('.html'))
    .filter(f => !only.length || only.includes(path.basename(f, '.html')));
  const browser = await chromium.launch();
  for (const f of files) {
    const raw = fs.readFileSync(path.join(dir, 'diagrams', f), 'utf8');
    const [, w, h] = raw.match(/<!--\s*size:\s*(\d+)x(\d+)\s*-->/);
    const body = icons(raw);
    const html = `<!doctype html><html><head><meta charset="utf-8"><style>${css}</style>
      <style>html,body{width:${w}px;height:${h}px}</style></head><body>${body.replace(/<script>[\s\S]*<\/script>/, '')}
      <script>${kit}</script>${(body.match(/<script>[\s\S]*<\/script>/) || [''])[0]}</body></html>`;
    const page = await browser.newPage({ viewport: { width: +w, height: +h }, deviceScaleFactor: 2 });
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    await page.setContent(html, { waitUntil: 'networkidle' });
    await page.evaluate(() => document.fonts.ready);
    // Detecta elementos que se salen del lienzo
    const overflow = await page.evaluate(([W, H]) => [...document.querySelectorAll('.card,.zone,.legend,.wl')]
      .filter(e => { const r = e.getBoundingClientRect(); return r.right > W + 1 || r.bottom > H + 1 || r.left < -1 || r.top < -1; })
      .map(e => e.id || e.className), [+w, +h]);
    const name = path.basename(f, '.html');
    await page.screenshot({ path: path.join(path.resolve(out), name + '.png') });
    console.log(name, errors.length ? 'ERRORES: ' + errors.join('; ') : 'ok', overflow.length ? 'DESBORDA: ' + overflow : '');
    await page.close();
  }
  await browser.close();
})();
