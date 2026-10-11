# Brick Builder Blaster

A small browser game for building a LEGO-like level, then running and blasting through it. No account and no server. The full design is in [GAME_DESIGN.md](GAME_DESIGN.md).

The game opens on **Jasper's Level 1**: a blue brick border, five coins, a green start flag, a blue finish flag, and one mad circle that starts slow and speeds up. Press that button any time to load his layout again. You can edit it in build mode.

Place brick walls, solid walls, enemies, coins, a start, and a finish. Press **Play Test** and use WASD or the arrow keys to move. Hold the mouse button to shoot toward the cursor. Red walls shatter after 3 hits. The mad circle pops into bricks after 2 hits. Touching it costs a heart. Reach the finish to see your time, coins, and enemies smashed.

Play Test does not change the level you built. Broken walls and beaten monsters come back when you return to build mode. **Save** stores the level in this browser. **Share Link** copies a URL that reloads the same level on another computer.

## Run locally

```bash
npm install
npm run dev
```

Open the URL Vite prints (usually http://localhost:5173).

To check the production build:

```bash
npm run build
npm run preview
```

`npm test` checks that a level survives the share-link encode and decode.

## Deploy to Netlify

The site is a static Vite build. Share links are query strings on `index.html`, so no redirect rules are required.

1. Push the repo to GitHub.
2. In Netlify, choose **Add new site** → **Import an existing project**.
3. Build command: `npm run build`
4. Publish directory: `dist`
5. Deploy.

From this folder with the Netlify CLI:

```bash
npm run build
npx netlify deploy --prod --dir=dist
```

## Deploy to Vercel

1. Import the GitHub repo at [vercel.com](https://vercel.com).
2. Framework preset: Vite.
3. Build command: `npm run build`
4. Output directory: `dist`
5. Deploy.

From this folder with the Vercel CLI:

```bash
npm run build
npx vercel deploy --prod
```
