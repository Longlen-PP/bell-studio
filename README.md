# Bell Studio

Dashboard of a simulated content company: org chart, departments, idea pipeline, and products.

## Live

https://longlen-pp.github.io/bell-studio/

(Served via **GitHub Pages** — Settings → Pages → Deploy from branch → `main` / root. Pushing `main` deploys.)

## Structure

- `data.js` — **edit this file**: departments, channels, pipeline, products (the only source of truth)
- `index.html` / `style.css` / `app.js` — rendering only, no build step

This site is public — never put revenue, personal affiliate links, or account details in `data.js`.
