# Brick Builder Blaster (working title)

## One-liner
The player first **builds their own level** like LEGO (walls, enemies, coins, start, finish), then controls a little brick figure to **run, shoot, and clear the level**. Finished levels get a share link to send to friends.

## Target player
- Mainly an 8-year-old (Jasper) who loves LEGO and Roblox.
- Simple controls; build and play a level within 3 minutes; no account needed.

## Two modes

### 1. Build mode
- Top-down 2D grid map (20 × 15 tiles for v1).
- Toolbar on the left; tap a tool, then click a tile to place it. Right-click or eraser to delete:
  - 🧱 Brick wall: blocks movement and bullets; breaks into small bricks after 3 hits.
  - 🟦 Solid wall: indestructible.
  - 👾 Enemy: walks slowly toward the player; touching the player costs 1 health.
  - 💎 Coin: collectible, adds to score.
  - ❤️ Health pack: restores 1 health.
  - 🚩 Start (exactly 1) and 🏁 Finish (exactly 1).
- Buttons: "Play Test", "Clear", "Save", "Share Link".

### 2. Play mode
- The player is a brick figure that starts at the Start; reaching the Finish clears the level.
- Controls:
  - Desktop: WASD or arrow keys to move; click to shoot toward the mouse.
  - Phone/tablet: virtual joystick on the left, shoot button on the right (auto-aims at the nearest enemy).
- The player has 3 health; at 0 they respawn at the Start.
- An enemy hit 2 times explodes into a pile of bricks (the most satisfying moment; make it look great).
- On clearing, show time, coins collected, and enemies defeated.

## Look and sound
- Everything is blocks in bright solid colors (red, yellow, blue, green), LEGO-style. No external art for v1; draw rectangles in code.
- Shatter effect: when something breaks, 6–10 small blocks fly out and fade away.
- Sounds: shoot, shatter, coin pickup, level clear (simple effects, e.g. made with jsfxr).

## Tech
- Pure front-end web: Vite + JavaScript + [Phaser 3](https://phaser.io/).
- A level is a JSON grid (what is in each tile), saved in the browser's localStorage.
- Share link: compress the level JSON into the URL (e.g. `?level=xxxx`); opening the link loads the level. **No backend for v1.**
- Deploy on Netlify or Vercel free static hosting.

## First version (MVP) scope
Must have:
1. Build mode: place and delete brick walls, solid walls, enemies, coins, start, finish.
2. Play mode: move, shoot, enemies chase, lose health, shatter effect, clear at the finish.
3. A "Play Test" button to switch between the two modes.
4. Save to localStorage; share link loads the level.
5. Keyboard and mouse controls work on desktop.

Not yet:
- Touch controls (v2).
- Health packs and sound (v2).
- Accounts, leaderboards, online level library (add a backend later, e.g. a small DigitalOcean server).

## Ideas for later
- Collect shattered bricks and use them to build temporary cover mid-level.
- Two-player co-op: one builds defenses, one shoots.
- 5 built-in sample levels with rising difficulty.
- Level name and author name (e.g. "by Jasper").

## Acceptance criteria (v1)
- Open the page and build a level with a start, finish, a few walls, and 2 enemies within 30 seconds.
- Tap "Play Test" and play it through once, seeing the results screen at the end.
- Copy the share link, open it in another browser, and see the same level.
