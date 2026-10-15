# Bell Studio

A dashboard for a simulated content company. Its hierarchy is department → channel → product (for shop channels) → clip.
You can add, edit and delete any of these right on the page.

## Live

https://longlen-pp.github.io/bell-studio/

(Served via **GitHub Pages** — Settings → Pages → Deploy from branch → `main` / root. Pushing `main` deploys.)

## Structure

- `data.js` — the published data everyone starts from (the source of truth until Firebase sync lands)
- `store.js` — data layer; today it keeps edits in this browser's localStorage, later it will talk to Firestore through the same interface
- `index.html` / `style.css` / `app.js` — the UI (no build step)

## Editing (Phase 1)

Edits are saved **in this browser only**. A notice at the top offers:
- **Export**, which downloads the edited data as JSON so it can be published. To publish it, Bell replaces `window.STUDIO` in `data.js` with that file and pushes.
- **Reset**, which goes back to the published data.

Product photos are links: a Google Drive share link set to "Anyone with the link", or any https image URL.

This site is public — never put revenue, personal affiliate links, or account details in it.
