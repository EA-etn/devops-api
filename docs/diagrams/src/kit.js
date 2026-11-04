// Conectores ortogonales con esquinas redondeadas entre elementos del diagrama.
// wire("a:bottom@0.5", "b:top", {label, color, dashed, mid})
(function () {
  const NS = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(NS, 'svg');
  svg.id = 'wires';
  svg.innerHTML = '<defs></defs>';
  document.body.appendChild(svg);
  const defs = svg.querySelector('defs');
  const markers = {};

  function marker(color) {
    if (markers[color]) return markers[color];
    const id = 'm' + Object.keys(markers).length;
    const m = document.createElementNS(NS, 'marker');
    m.setAttribute('id', id); m.setAttribute('viewBox', '0 0 10 10');
    m.setAttribute('refX', '8'); m.setAttribute('refY', '5');
    m.setAttribute('markerWidth', '7'); m.setAttribute('markerHeight', '7');
    m.setAttribute('orient', 'auto-start-reverse');
    m.innerHTML = `<path d="M0,0 L10,5 L0,10 z" fill="${color}"/>`;
    defs.appendChild(m);
    return (markers[color] = id);
  }

  function anchor(spec) {
    const [idSide, frac] = spec.split('@');
    const [id, side] = idSide.split(':');
    const el = document.getElementById(id);
    if (!el) throw new Error('No existe #' + id);
    const r = el.getBoundingClientRect();
    const f = frac === undefined ? 0.5 : parseFloat(frac);
    switch (side) {
      case 'top': return { x: r.left + r.width * f, y: r.top, d: 'v' };
      case 'bottom': return { x: r.left + r.width * f, y: r.bottom, d: 'v' };
      case 'left': return { x: r.left, y: r.top + r.height * f, d: 'h' };
      case 'right': return { x: r.right, y: r.top + r.height * f, d: 'h' };
    }
    throw new Error('Lado inválido: ' + side);
  }

  function route(a, b, mid) {
    const p = [[a.x, a.y]];
    if (a.d === 'v' && b.d === 'v') {
      const my = mid ?? (a.y + b.y) / 2;
      if (Math.abs(a.x - b.x) > 1) p.push([a.x, my], [b.x, my]);
    } else if (a.d === 'h' && b.d === 'h') {
      const mx = mid ?? (a.x + b.x) / 2;
      if (Math.abs(a.y - b.y) > 1) p.push([mx, a.y], [mx, b.y]);
    } else if (a.d === 'v') {
      p.push([a.x, b.y]);
    } else {
      p.push([b.x, a.y]);
    }
    p.push([b.x, b.y]);
    return p;
  }

  function rounded(pts, r = 14) {
    let d = `M${pts[0][0]},${pts[0][1]}`;
    for (let i = 1; i < pts.length - 1; i++) {
      const [x0, y0] = pts[i - 1], [x1, y1] = pts[i], [x2, y2] = pts[i + 1];
      const l1 = Math.hypot(x1 - x0, y1 - y0), l2 = Math.hypot(x2 - x1, y2 - y1);
      const rr = Math.min(r, l1 / 2, l2 / 2);
      const ax = x1 - ((x1 - x0) / l1) * rr, ay = y1 - ((y1 - y0) / l1) * rr;
      const bx = x1 + ((x2 - x1) / l2) * rr, by = y1 + ((y2 - y1) / l2) * rr;
      d += ` L${ax},${ay} Q${x1},${y1} ${bx},${by}`;
    }
    const [lx, ly] = pts[pts.length - 1];
    return d + ` L${lx},${ly}`;
  }

  // Punto medio a lo largo del recorrido (para la etiqueta)
  function midpoint(pts) {
    const seg = [];
    let total = 0;
    for (let i = 1; i < pts.length; i++) {
      const l = Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
      seg.push(l); total += l;
    }
    let t = total / 2;
    for (let i = 1; i < pts.length; i++) {
      if (t <= seg[i - 1]) {
        const k = t / seg[i - 1];
        return [pts[i - 1][0] + (pts[i][0] - pts[i - 1][0]) * k, pts[i - 1][1] + (pts[i][1] - pts[i - 1][1]) * k];
      }
      t -= seg[i - 1];
    }
    return pts[0];
  }

  window.wire = function (from, to, o = {}) {
    const a = anchor(from), b = anchor(to);
    const pts = route(a, b, o.mid);
    const color = o.color || getComputedStyle(document.documentElement).getPropertyValue('--line').trim();
    const path = document.createElementNS(NS, 'path');
    path.setAttribute('d', rounded(pts));
    path.setAttribute('fill', 'none');
    path.setAttribute('stroke', color);
    path.setAttribute('stroke-width', o.width || 2.2);
    path.setAttribute('stroke-linecap', 'round');
    if (o.dashed) path.setAttribute('stroke-dasharray', '7 7');
    if (o.arrow !== false) path.setAttribute('marker-end', `url(#${marker(color)})`);
    svg.appendChild(path);
    if (o.label) {
      const [mx, my] = o.at || midpoint(pts);
      const l = document.createElement('div');
      l.className = 'wl'; l.textContent = o.label;
      l.style.left = mx + 'px'; l.style.top = my + 'px';
      if (o.labelColor) { l.style.color = o.labelColor; l.style.borderColor = o.labelColor + '66'; }
      document.body.appendChild(l);
    }
  };
})();
