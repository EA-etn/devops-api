# Diagramas como código

Cada diagrama es un HTML en `diagrams/` que usa un pequeño kit (`kit.css` + `kit.js`):

- `.zone` → capa con color (`--c`)
- `.card` → tarjeta con icono de [Lucide](https://lucide.dev/icons) (`<i data-icon="nombre">`)
- `wire('a:right', 'b:left', {label})` → conector con esquinas redondeadas

Para regenerar los PNG en `docs/diagrams/`:

```bash
cd docs/diagrams/src
npm install
npx playwright install chromium   # solo la primera vez
npm run render
```
