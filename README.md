# GoRecall

https://joeykblack.github.io/gorecall/

This app displays a sequence from an SGF file and tests the uers on their ability to recall it.

I do not know how valuable this method of study is or if this app implements it well. You are probably better off doing tsumego.

TODO
- install as app on phone
- Fix result when sequence is shorter than selected number.
- Cleanup UI
- Joseki file with only good variations or a way to filter out bad variations 

Frameworks: Vite + PReact (JavaScript)

Progressive Web App (PWA)
-------------------------
This project now includes basic PWA support. Files added:

- `manifest.webmanifest` — app metadata for install (name, icons, start_url)
- `sw.js` — a simple service worker that caches the app shell for offline use

How to test PWA locally:

1. Build the production bundle and serve it (service workers require HTTPS or localhost):

```bash
npm run build
npm run preview
```

2. Open the preview URL in Chrome/Edge on desktop, open devtools -> Application -> Manifest to inspect the manifest. Use the Application -> Service Workers section to see if `sw.js` registered.

3. On a mobile device, open the site over HTTPS (or on localhost) and you should see an install prompt (or use the browser menu "Install app").

If you'd like a more advanced service worker (runtime caching, strategies, push notifications, or Workbox integration), I can add that.

Quick start:

```bash
npm install
npm run dev
```

Scripts:
- `npm run dev` — start dev server
- `npm run build` — build production file (single index.html in the docs folder for github.io)
- `npm run preview` — locally preview the production build
