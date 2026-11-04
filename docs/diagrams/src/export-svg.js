// Se ejecuta DENTRO de la página renderizada: recorre el DOM y lo redibuja como SVG.
// Devuelve { body, fonts } — body es el contenido del <svg>, fonts los caracteres
// usados por cada fuente (para generar subconjuntos e incrustarlos).
/* eslint-disable no-undef */
module.exports = function exportSvg() {
  const out = [];
  const fonts = {};
  const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const n = (v) => Math.round(v * 100) / 100;

  // Normaliza cualquier color CSS (incluido color-mix) leyendo un píxel de un canvas
  const cv = document.createElement('canvas'); cv.width = cv.height = 1;
  const cx = cv.getContext('2d', { willReadFrequently: true });
  function color(css) {
    if (!css || css === 'transparent' || css === 'rgba(0, 0, 0, 0)') return null;
    cx.clearRect(0, 0, 1, 1); cx.fillStyle = '#000'; cx.fillStyle = css; cx.fillRect(0, 0, 1, 1);
    const [r, g, b, a] = cx.getImageData(0, 0, 1, 1).data;
    if (a === 0) return null;
    return a === 255 ? `rgb(${r},${g},${b})` : `rgba(${r},${g},${b},${n(a / 255)})`;
  }

  function fontKey(cs) {
    const fam = cs.fontFamily.split(',')[0].replace(/["']/g, '').trim();
    return `${fam}|${cs.fontWeight}`;
  }

  function box(el, cs, r) {
    const bw = parseFloat(cs.borderTopWidth) || 0;
    const fill = color(cs.backgroundColor);
    const stroke = bw ? color(cs.borderTopColor) : null;
    if (!fill && !stroke) return;
    const rad = parseFloat(cs.borderTopLeftRadius) || 0;
    const dash = cs.borderTopStyle === 'dashed' ? ' stroke-dasharray="9 7"' : '';
    const shadow = el.classList.contains('card') ? ' filter="url(#shadow)"' : '';
    const cls = el.classList.contains('soon') ? ' class="pulse"' : '';
    out.push(`<rect${cls} x="${n(r.left + bw / 2)}" y="${n(r.top + bw / 2)}" width="${n(r.width - bw)}" height="${n(r.height - bw)}" rx="${n(Math.max(0, rad - bw / 2))}"` +
      ` fill="${fill || 'none'}"${stroke ? ` stroke="${stroke}" stroke-width="${bw}"` : ''}${dash}${shadow}/>`);
  }

  function text(node) {
    const el = node.parentElement;
    const cs = getComputedStyle(el);
    let raw = node.textContent;
    if (!raw.trim()) return;
    if (cs.textTransform === 'uppercase') raw = raw.toUpperCase();
    // Agrupa los caracteres por línea (por si el texto se parte en varias líneas)
    const range = document.createRange();
    const lines = [];
    for (let i = 0; i < raw.length; i++) {
      range.setStart(node, i); range.setEnd(node, i + 1);
      const rr = range.getClientRects()[0];
      if (!rr || rr.width === 0) continue;
      let line = lines.find((l) => Math.abs(l.top - rr.top) < 3);
      if (!line) { line = { top: rr.top, h: rr.height, x: rr.left, s: '' }; lines.push(line); }
      line.s += raw[i];
    }
    const key = fontKey(cs);
    const fill = color(cs.color);
    const ls = parseFloat(cs.letterSpacing) || 0;
    for (const l of lines) {
      const s = l.s.replace(/\s+/g, ' ').trimEnd();
      if (!s.trim()) continue;
      fonts[key] = (fonts[key] || '') + s;
      const [fam, w] = key.split('|');
      out.push(`<text x="${n(l.x)}" y="${n(l.top + l.h / 2)}" dominant-baseline="central" font-family="${esc(fam)}" font-weight="${w}" font-size="${cs.fontSize}"` +
        `${ls ? ` letter-spacing="${n(ls)}"` : ''} fill="${fill}" xml:space="preserve">${esc(s)}</text>`);
    }
  }

  function icon(svg) {
    const r = svg.getBoundingClientRect();
    const c = color(getComputedStyle(svg).color);
    out.push(`<svg x="${n(r.left)}" y="${n(r.top)}" width="${n(r.width)}" height="${n(r.height)}" viewBox="0 0 24 24" fill="none" stroke="${c}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${svg.innerHTML}</svg>`);
  }

  // Cables: línea base + puntos de luz que recorren el camino
  function wires(svg) {
    const paths = [...svg.querySelectorAll('path[d^="M"]')];
    const anim = [];
    paths.forEach((p, i) => {
      const d = p.getAttribute('d');
      const stroke = p.getAttribute('stroke');
      const dash = p.getAttribute('stroke-dasharray');
      const len = p.getTotalLength();
      const dur = n(Math.max(1.4, len / 170));
      const begin = n((i * 0.45) % 3);
      out.push(`<path d="${d}" fill="none" stroke="${stroke}" stroke-width="${p.getAttribute('stroke-width')}" stroke-linecap="round" stroke-opacity="0.75"` +
        `${dash ? ` stroke-dasharray="${dash}"` : ''}${p.getAttribute('marker-end') ? ` marker-end="${p.getAttribute('marker-end')}"` : ''}/>`);
      anim.push(`<circle r="4.5" fill="${stroke}" filter="url(#glow)" opacity="0">` +
        `<animateMotion dur="${dur}s" begin="${begin}s" repeatCount="indefinite" path="${d}"/>` +
        `<animate attributeName="opacity" dur="${dur}s" begin="${begin}s" repeatCount="indefinite" values="0;1;1;0" keyTimes="0;0.12;0.85;1"/></circle>`);
    });
    out.push(`<defs>${svg.querySelector('defs').innerHTML}</defs>`);
    out.push(...anim);
  }

  const skip = new Set();
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT);
  let node = walker.currentNode;
  while ((node = walker.nextNode())) {
    if (node.nodeType === Node.TEXT_NODE) {
      if (![...skip].some((s) => s.contains(node))) text(node);
      continue;
    }
    if ([...skip].some((s) => s.contains(node))) continue;
    if (node.tagName === 'SCRIPT' || node.tagName === 'STYLE') { skip.add(node); continue; }
    if (node.id === 'wires') { wires(node); skip.add(node); continue; }
    if (node.tagName.toLowerCase() === 'svg') { icon(node); skip.add(node); continue; }
    const cs = getComputedStyle(node);
    box(node, cs, node.getBoundingClientRect());
  }
  return { body: out.join('\n'), fonts };
};
