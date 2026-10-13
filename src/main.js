import Phaser from 'phaser';
import './style.css';
import { GameScene } from './GameScene.js';
import { installTouch } from './touch.js';
import {
  VIEW_H,
  VIEW_W,
  clearLevel,
  encodeLevel,
  getRows,
  initLevel,
  jaspersLevel,
  level2,
  loadMessage,
  replaceLevel,
  saveNow,
  shareUrl,
  subscribe,
  summarize,
} from './level.js';

const TOOLS = ['B', 'W', 'E', 'C', 'S', 'F', 'erase'];

function formatTime(seconds) {
  const safe = Math.max(0, Number(seconds) || 0);
  const mins = Math.floor(safe / 60);
  const rem = safe - mins * 60;
  const whole = Math.floor(rem);
  const tenth = Math.floor((rem - whole) * 10);
  return `${mins}:${String(whole).padStart(2, '0')}.${tenth}`;
}

function toast(message) {
  const el = document.getElementById('toast');
  el.textContent = message;
  el.classList.add('show');
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => el.classList.remove('show'), 2400);
}

function show(id) {
  document.getElementById(id).classList.remove('hidden');
}

function hide(id) {
  document.getElementById(id).classList.add('hidden');
}

function renderHearts(health) {
  const wrap = document.getElementById('hearts');
  wrap.replaceChildren();
  for (let i = 0; i < 3; i++) {
    const heart = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    heart.setAttribute('viewBox', '0 0 24 22');
    heart.setAttribute('class', i < health ? 'heart' : 'heart empty');
    heart.setAttribute('aria-hidden', 'true');
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute(
      'd',
      'M12 21s-7-4.4-9.5-8.2C.6 10.2 1.2 6.4 4.4 5 6.5 4.1 8.6 4.8 10 6.5 11.4 4.8 13.5 4.1 15.6 5c3.2 1.4 3.8 5.2 1.9 7.8C19 16.6 12 21 12 21z',
    );
    heart.appendChild(path);
    wrap.appendChild(heart);
  }
  wrap.setAttribute('aria-label', `${Math.max(0, health)} hearts`);
}

function refreshStats() {
  const counts = summarize(getRows());
  const ready = counts.S === 1 && counts.F === 1;
  document.getElementById('stat-line').textContent = [
    `Brick walls: ${counts.B}`,
    `Solid walls: ${counts.W}`,
    `Monsters: ${counts.E + counts.M}`,
    `Coins: ${counts.C}`,
    `Start: ${counts.S === 1 ? 'yes' : 'no'}`,
    `Finish: ${counts.F === 1 ? 'yes' : 'no'}`,
  ].join('\n');
  const note = document.getElementById('ready-note');
  note.textContent = ready ? 'Ready to play test!' : 'Add one Start and one Finish.';
  note.classList.toggle('is-ready', ready);
}

function selectTool(tool) {
  for (const button of document.querySelectorAll('.tool')) {
    const on = button.dataset.tool === tool;
    button.classList.toggle('is-selected', on);
    button.setAttribute('aria-pressed', on ? 'true' : 'false');
  }
}

let game;

function scene() {
  return game?.scene.getScene('game') ?? null;
}

async function boot() {
  installTouch();
  await initLevel();

  const message = loadMessage();
  if (message.banner) {
    const banner = document.getElementById('banner');
    banner.textContent = message.banner;
    banner.classList.remove('hidden');
  }

  window.addEventListener('bbb-tool', (event) => selectTool(event.detail));
  const helpWalls = document.getElementById('help-walls');
  const helpHearts = document.getElementById('help-hearts');
  const helpGoal = document.getElementById('help-goal');
  const level1Help = {
    walls: helpWalls.textContent,
    hearts: helpHearts.textContent,
    goal: helpGoal.textContent,
  };
  const level2Help = {
    walls: 'Blue walls make the maze. Shoot the red gate to open it. A red brick hides a bonus coin.',
    hearts: 'Purple monsters take 3 hits. They chase when they see you. You run faster, so back up and shoot.',
    goal: 'Follow the coins to the blue flag.',
  };
  function showHelp(campaign) {
    const help = campaign === 2 ? level2Help : level1Help;
    helpWalls.textContent = help.walls;
    helpHearts.textContent = help.hearts;
    helpGoal.textContent = help.goal;
  }

  window.addEventListener('bbb-mode', (event) => {
    const detail = typeof event.detail === 'string' ? { mode: event.detail, campaign: 0 } : event.detail;
    document.body.dataset.mode = detail.mode;
    const pill = document.getElementById('mode-pill');
    if (detail.mode !== 'play') pill.textContent = 'Building';
    else if (detail.campaign === 2) pill.textContent = 'Level 2';
    else pill.textContent = 'Playing';
    showHelp(detail.mode === 'play' ? detail.campaign : 1);
  });
  window.addEventListener('bbb-toast', (event) => toast(event.detail));
  window.addEventListener('bbb-hide-results', () => hide('results'));
  window.addEventListener('bbb-hud', (event) => {
    const hud = event.detail;
    renderHearts(hud.health);
    document.getElementById('hud-coins').textContent = `Coins ${hud.coins}`;
    document.getElementById('hud-enemies').textContent = `Smashed ${hud.smashed}`;
    document.getElementById('hud-time').textContent = formatTime(hud.time);
  });
  window.addEventListener('bbb-results', (event) => {
    const stats = event.detail;
    const levelTwo = stats.campaign === 2;
    document.getElementById('results-eyebrow').textContent = levelTwo ? 'Level 2 clear' : 'Level clear';
    document.getElementById('results-title').textContent = levelTwo ? 'You beat the maze!' : 'You did it!';
    document.getElementById('btn-next').classList.toggle('hidden', stats.campaign !== 1);
    document.getElementById('results-time').textContent = formatTime(stats.time);
    document.getElementById('results-coins').textContent =
      `Coins collected: ${stats.coins} / ${stats.coinsTotal}`;
    document.getElementById('results-enemies').textContent =
      `Monsters smashed: ${stats.smashed} / ${stats.enemyTotal}`;
    show('results');
  });

  for (const button of document.querySelectorAll('.tool')) {
    button.addEventListener('click', () => scene()?.setTool(button.dataset.tool));
  }

  document.getElementById('btn-play').addEventListener('click', () => {
    scene()?.enterPlay();
  });
  document.getElementById('btn-back').addEventListener('click', () => scene()?.backToBuild());
  document.getElementById('btn-again').addEventListener('click', () => scene()?.enterPlay());
  document.getElementById('btn-results-back').addEventListener('click', () => scene()?.backToBuild());

  let confirmAction = null;
  function ask(title, body, yesLabel, action) {
    document.getElementById('confirm-title').textContent = title;
    document.getElementById('confirm-body').textContent = body;
    const yes = document.getElementById('confirm-yes');
    yes.textContent = yesLabel;
    yes.classList.toggle('btn-danger', yesLabel === 'Clear it');
    confirmAction = action;
    show('confirm');
  }
  document.getElementById('btn-clear').addEventListener('click', () => {
    ask('Clear the whole level?', 'This erases every brick, monster, and coin.', 'Clear it', () => {
      clearLevel();
      toast('Level cleared.');
    });
  });
  document.getElementById('btn-jasper').addEventListener('click', () => {
    ask(
      "Load Jasper's Level 1?",
      'This replaces the level you are building. You can still edit it afterward.',
      'Load it',
      () => {
        replaceLevel(jaspersLevel());
        toast("Jasper's Level 1 loaded. Change anything you like.");
      },
    );
  });
  document.getElementById('btn-level2').addEventListener('click', () => {
    ask(
      'Load Level 2?',
      'This maze replaces the level you are building. You can still edit it afterward.',
      'Load it',
      () => {
        replaceLevel(level2());
        toast('Level 2 loaded. Purple monsters take 3 hits.');
      },
    );
  });
  document.getElementById('btn-next').addEventListener('click', () => {
    replaceLevel(level2());
    hide('results');
    if (scene()?.enterPlay()) toast('Level 2! Follow the coins through the maze.');
  });
  document.getElementById('confirm-no').addEventListener('click', () => {
    confirmAction = null;
    hide('confirm');
  });
  document.getElementById('confirm-yes').addEventListener('click', () => {
    const action = confirmAction;
    confirmAction = null;
    hide('confirm');
    action?.();
  });

  document.getElementById('btn-save').addEventListener('click', () => {
    saveNow();
    toast('Saved in this browser!');
  });

  document.getElementById('btn-share-close').addEventListener('click', () => hide('share'));
  document.getElementById('btn-share').addEventListener('click', async () => {
    const button = document.getElementById('btn-share');
    button.disabled = true;
    try {
      const code = await encodeLevel(getRows());
      const url = shareUrl(code);
      const input = document.getElementById('share-url');
      input.value = url;
      show('share');
      input.focus();
      input.select();
      await copyShareLink(false);
    } catch (error) {
      console.error(error);
      toast('Could not make a share link.');
    } finally {
      button.disabled = false;
    }
  });
  document.getElementById('btn-copy').addEventListener('click', () => copyShareLink(true));

  async function copyShareLink(selectAgain) {
    const input = document.getElementById('share-url');
    if (selectAgain) {
      input.focus();
      input.select();
    }
    try {
      await navigator.clipboard.writeText(input.value);
      toast('Link copied. Send it to a friend!');
    } catch {
      toast('Copy the link in the box.');
    }
  }

  window.addEventListener('keydown', (event) => {
    if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) return;
    if (document.body.dataset.mode !== 'build' || event.repeat) return;
    const index = '1234567'.indexOf(event.key);
    if (index === -1) return;
    scene()?.setTool(TOOLS[index]);
  });

  subscribe(() => refreshStats());
  refreshStats();
  renderHearts(3);

  document.getElementById('game').addEventListener('contextmenu', (event) => event.preventDefault());

  game = new Phaser.Game({
    type: Phaser.AUTO,
    parent: 'game',
    width: VIEW_W,
    height: VIEW_H,
    backgroundColor: '#7f93a6',
    banner: false,
    scale: {
      mode: Phaser.Scale.FIT,
      autoCenter: Phaser.Scale.CENTER_BOTH,
    },
    scene: [GameScene],
    audio: { noAudio: true },
  });

  const refresh = () => game.scale.refresh();
  requestAnimationFrame(() => requestAnimationFrame(refresh));
  setTimeout(refresh, 60);
  window.addEventListener('resize', refresh);

  if (message.toast) toast(message.toast);
}

boot().catch((error) => {
  console.error(error);
  toast('The game could not start. Reload the page.');
});
