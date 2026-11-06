# NOVA STUDIO portfolio (static)
Run locally: `python3 -m http.server 8080` in this folder → http://localhost:8080 (ES modules need http, not file://).
Deploy: upload the folder as-is (GitHub Pages / Netlify / Vercel); all paths are relative.
Edit content: `js/config.js` (SITE + PROJECTS; optional `image` per project).
Capture mode: `index.html?capture=1` → window.__setTime(t), __setScroll(0..1), __setPointer(x,y), __setIntro(0..1), __setActive(i), __openDetail(i), window.__ready.
