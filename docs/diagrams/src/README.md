# Diagrams as code

Each diagram is an HTML file in `diagrams/` built with a tiny kit (`kit.css` + `kit.js`):

- `.zone` → a colored layer (`--c`)
- `.card` → a card with a [Lucide](https://lucide.dev/icons) icon (`<i data-icon="name"></i>`)
- `wire('a:right', 'b:left', {label})` → an orthogonal connector with rounded corners

`render.js` renders every diagram in **Spanish and English** (`i18n.js`) to:

- `../es|en/<name>.png` — static image (LinkedIn, slides)
- `../es|en/<name>.svg` — **animated** SVG for the README: light dots travel along every
  connector. `export-svg.js` measures the rendered page and redraws it as SVG, and the fonts
  (Inter, JetBrains Mono) are subset and embedded so it looks the same everywhere.

`00-social` is the repository social preview (1280×640): GitHub → Settings → Social preview.

## Regenerate

Requires Node, Python with `fonttools` + `brotli`, and the Inter / JetBrains Mono fonts installed.

```bash
cd docs/diagrams/src
npm install
npx playwright install chromium   # first time only
pip install fonttools brotli
npm run render                    # or: node render.js .. 02-pipeline
```
