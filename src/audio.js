/**
 * Original sound effects, synthesized in the browser with Web Audio.
 * Nothing here is sampled from another game.
 *
 * Blaster: a short triangle "pew" that slides downward, softened with a lowpass.
 * Each shot is nudged a few percent in pitch so a held trigger does not drone.
 * Footsteps: a soft brown-noise scuff plus a low sine thump, repeating while running.
 * Tank: a looping lowpassed rumble with a slow tread pulse instead of footsteps.
 * Grunt: two falling sine tones and a little breath noise. A defeat is lower, longer, and louder.
 */

export const STEP_INTERVAL = 0.38;

const MUTE_KEY = 'bbb-muted';

let muted = false;
let muteLoaded = false;
let ctx = null;
let master = null;
let loco = initialLocomotion();
let tread = null;
let noiseLoop = null;

export function initialLocomotion() {
  return { wait: 0, rumbling: false };
}

/**
 * Decide footstep and tread events for this frame.
 * A step plays as soon as running starts, then every STEP_INTERVAL.
 * The tank never steps; it only turns the rumble on and off.
 * At most one step is emitted per call, even if the frame was long.
 */
export function advanceLocomotion(state, dt, moving, riding) {
  const events = [];
  let rumbling = state.rumbling;
  const safeDt = Math.max(0, Number(dt) || 0);

  if (!moving) {
    if (rumbling) {
      rumbling = false;
      events.push('tread-off');
    }
    return { state: { wait: 0, rumbling }, events };
  }

  if (riding) {
    if (!rumbling) {
      rumbling = true;
      events.push('tread-on');
    }
    return { state: { wait: 0, rumbling }, events };
  }

  if (rumbling) {
    rumbling = false;
    events.push('tread-off');
  }

  let wait = state.wait - safeDt;
  if (wait <= 0) {
    events.push('step');
    wait = STEP_INTERVAL;
  }
  return { state: { wait, rumbling }, events };
}

/** Slight pitch wobble around 1. Stays in a narrow band so rapid fire stays pleasant. */
export function shotPitch(random = Math.random) {
  const roll = random();
  const unit = Number.isFinite(roll) ? Math.min(1, Math.max(0, roll)) : 0.5;
  return 0.94 + unit * 0.12;
}

/** A hit grunt, or a bigger lower one when the enemy is defeated. */
export function gruntSpec(defeated) {
  if (defeated) return { defeated: true, pitch: 0.78, dur: 0.34, gain: 0.16 };
  return { defeated: false, pitch: 1, dur: 0.16, gain: 0.09 };
}

function loadMute() {
  if (muteLoaded) return;
  muteLoaded = true;
  try {
    muted = localStorage.getItem(MUTE_KEY) === '1';
  } catch {
    muted = false;
  }
}

export function isMuted() {
  loadMute();
  return muted;
}

export function toggleMuted() {
  loadMute();
  muted = !muted;
  try {
    localStorage.setItem(MUTE_KEY, muted ? '1' : '0');
  } catch {
    /* private mode */
  }
  if (master) master.gain.setValueAtTime(muted ? 0 : 0.8, master.context.currentTime);
  if (muted) {
    stopTread();
    loco = initialLocomotion();
  }
  return muted;
}

function audioCtor() {
  if (typeof window === 'undefined') return null;
  return window.AudioContext || window.webkitAudioContext || null;
}

function ensureContext() {
  if (ctx) return ctx;
  const Ctor = audioCtor();
  if (!Ctor) return null;
  ctx = new Ctor();
  master = ctx.createGain();
  master.gain.value = muted ? 0 : 0.8;
  master.connect(ctx.destination);
  return ctx;
}

function whenRunning(fn) {
  loadMute();
  if (muted) return;
  const audio = ensureContext();
  if (!audio) return;
  if (audio.state === 'running') {
    fn(audio);
    return;
  }
  audio.resume().then(() => {
    if (!muted && audio.state === 'running') fn(audio);
  }).catch(() => {});
}

/** Create or resume the audio context from a user gesture. Required by iPad Safari. */
export function unlockAudio() {
  loadMute();
  const audio = ensureContext();
  if (!audio) return;
  if (audio.state !== 'running') {
    audio.resume().catch(() => {});
  }
  const buffer = audio.createBuffer(1, 1, audio.sampleRate);
  const src = audio.createBufferSource();
  src.buffer = buffer;
  src.connect(master);
  try {
    src.start();
  } catch {
    /* a second unlock in the same instant can throw */
  }
}

export function installAudio() {
  loadMute();
  const kick = () => unlockAudio();
  window.addEventListener('pointerdown', kick, { capture: true, passive: true });
  window.addEventListener('touchstart', kick, { capture: true, passive: true });
  window.addEventListener('touchend', kick, { capture: true, passive: true });
  window.addEventListener('keydown', kick, { capture: true });
}

function env(audio, peak, attack, dur) {
  const gain = audio.createGain();
  const t = audio.currentTime;
  gain.gain.setValueAtTime(0.0001, t);
  gain.gain.exponentialRampToValueAtTime(Math.max(peak, 0.0002), t + attack);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  return gain;
}

function brownBuffer(audio, seconds) {
  const length = Math.max(1, Math.floor(audio.sampleRate * seconds));
  const buffer = audio.createBuffer(1, length, audio.sampleRate);
  const data = buffer.getChannelData(0);
  let last = 0;
  for (let i = 0; i < length; i++) {
    const white = Math.random() * 2 - 1;
    last = last * 0.86 + white * 0.14;
    data[i] = last;
  }
  return buffer;
}

export function playShot() {
  whenRunning((audio) => {
    const pitch = shotPitch();
    const t = audio.currentTime;
    const dur = 0.09;
    const osc = audio.createOscillator();
    const filter = audio.createBiquadFilter();
    const gain = env(audio, 0.08, 0.01, dur);
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(640 * pitch, t);
    osc.frequency.exponentialRampToValueAtTime(220 * pitch, t + dur);
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(1600, t);
    filter.Q.value = 0.6;
    osc.connect(filter);
    filter.connect(gain);
    gain.connect(master);
    osc.start(t);
    osc.stop(t + dur + 0.02);
  });
}

function playFootstep() {
  whenRunning((audio) => {
    const pitch = 0.92 + Math.random() * 0.16;
    const t = audio.currentTime;
    const dur = 0.07;
    const src = audio.createBufferSource();
    src.buffer = brownBuffer(audio, dur);
    const filter = audio.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 480 * pitch;
    const gain = env(audio, 0.14, 0.008, dur);
    src.connect(filter);
    filter.connect(gain);
    gain.connect(master);
    src.start(t);
    src.stop(t + dur + 0.01);

    const thump = audio.createOscillator();
    thump.type = 'sine';
    thump.frequency.setValueAtTime(130 * pitch, t);
    thump.frequency.exponentialRampToValueAtTime(70, t + 0.05);
    const thumpGain = env(audio, 0.1, 0.006, 0.06);
    thump.connect(thumpGain);
    thumpGain.connect(master);
    thump.start(t);
    thump.stop(t + 0.07);
  });
}

function loopBuffer(audio) {
  if (!noiseLoop) noiseLoop = brownBuffer(audio, 1);
  return noiseLoop;
}

function startTread() {
  if (tread || muted) return false;
  const audio = ensureContext();
  if (!audio || audio.state !== 'running') return false;
  const t = audio.currentTime;
  const src = audio.createBufferSource();
  src.buffer = loopBuffer(audio);
  src.loop = true;
  const filter = audio.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = 130;
  const gain = audio.createGain();
  gain.gain.setValueAtTime(0.0001, t);
  gain.gain.exponentialRampToValueAtTime(0.07, t + 0.08);
  const wobble = audio.createOscillator();
  wobble.type = 'sine';
  wobble.frequency.value = 6.5;
  const depth = audio.createGain();
  depth.gain.value = 0.02;
  wobble.connect(depth);
  depth.connect(gain.gain);
  src.connect(filter);
  filter.connect(gain);
  gain.connect(master);
  src.start(t);
  wobble.start(t);
  tread = { src, wobble, depth, gain, audio };
  return true;
}

function stopTread() {
  if (!tread) return;
  const { src, wobble, depth, gain, audio } = tread;
  tread = null;
  const t = audio.currentTime;
  try {
    depth.disconnect();
  } catch {
    /* already stopped */
  }
  const level = Math.max(0.0001, gain.gain.value || 0.0001);
  gain.gain.cancelScheduledValues(t);
  gain.gain.setValueAtTime(level, t);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.12);
  try {
    src.stop(t + 0.14);
    wobble.stop(t + 0.14);
  } catch {
    /* stop twice */
  }
}

export function syncMoveSound(dt, moving, riding) {
  loadMute();
  const next = advanceLocomotion(loco, dt, muted ? false : !!moving, !!riding);
  loco = next.state;
  if (muted) {
    stopTread();
    return;
  }
  for (const event of next.events) {
    if (event === 'step') playFootstep();
    else if (event === 'tread-on') {
      if (!startTread()) loco = { ...loco, rumbling: false };
    } else if (event === 'tread-off') stopTread();
  }
}

export function playGrunt(defeated) {
  const spec = gruntSpec(defeated);
  whenRunning((audio) => {
    const t = audio.currentTime;
    const freqs = spec.defeated ? [150, 280] : [200, 390];
    for (const freq of freqs) {
      const osc = audio.createOscillator();
      osc.type = 'sine';
      const start = freq * spec.pitch;
      osc.frequency.setValueAtTime(start, t);
      osc.frequency.exponentialRampToValueAtTime(Math.max(40, start * 0.7), t + spec.dur);
      const gain = env(audio, spec.gain, 0.018, spec.dur);
      osc.connect(gain);
      gain.connect(master);
      osc.start(t);
      osc.stop(t + spec.dur + 0.02);
    }
    const breath = audio.createBufferSource();
    breath.buffer = brownBuffer(audio, 0.09);
    const band = audio.createBiquadFilter();
    band.type = 'bandpass';
    band.frequency.value = spec.defeated ? 420 : 760;
    band.Q.value = 0.7;
    const breathGain = env(audio, spec.defeated ? 0.07 : 0.035, 0.012, 0.09);
    breath.connect(band);
    band.connect(breathGain);
    breathGain.connect(master);
    breath.start(t);
    breath.stop(t + 0.1);
  });
}
