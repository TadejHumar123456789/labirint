// =====================
//  MAZE FISHING (SMOOTH STEP, NO SKIPPING POINTS)
//  + FIX: Spacebar DOES NOT click SweetAlert OK
//  + FIX: When caught at the end -> fish faces UP
// =====================

const hook = document.querySelector('.hook');
const startBtn = document.getElementById('startBtn');
const resetBtn = document.getElementById('reset');

const svgPath = document.querySelector('.path');
const totalLength = svgPath.getTotalLength();

const zunanja = document.getElementById('zunanja');

let traveled = 0;
let index = 0;       // current point index in path
let progress = 0;    // progress inside segment (forward auto)
let speed = 3;

let animating = false;
let animationId = null;

let caught = false;
let popupShown = false;

// PHASE: 'idle' | 'forward' | 'back' | 'up'
let phase = 'idle';

// ---- REEL SETTINGS ----
let reelTargetY = -2;
let reelStepUp = 30;     // how much up per input (but animated)
let slipChance = 0.10;
let slipAmount = 4;

// ---- SMOOTH SETTINGS ----
let stepDuration = 80;   // ms for one segment step (back) / one up step
let stepLock = false;    // prevents skipping

// ---- IMAGES ----
const TUNA_DIR = {
  desno: 'img/tuna_desno.png',
  levo:  'img/tuna_levo.png',
  gor:   'img/tuna_gor.png',
  dol:   'img/tuna_dol.png'
};
const HOOK_DIR = {
  desno: 'img/hook_desno.png',
  levo:  'img/hook_levo.png',
  gor:   'img/hook_gor.png',
  dol:   'img/hook_dol.png'
};

function getDir(dx, dy) {
  if (Math.abs(dx) > Math.abs(dy)) return dx >= 0 ? 'desno' : 'levo';
  return dy >= 0 ? 'dol' : 'gor';
}
function setHookByVector(dx, dy) {
  const dir = getDir(dx, dy);
  hook.setAttribute('href', HOOK_DIR[dir]);
}
function setTunaByVector(dx, dy) {
  const dir = getDir(dx, dy);
  hook.setAttribute('href', TUNA_DIR[dir]);
}

// ---- PATH ----
const path = [
  [234, 9], [234, 14], [250, 14], [250, 62], [186, 62], [186, 94], [170, 94],
  [170, 110], [154, 110], [154, 94], [138, 94], [138, 126], [122, 126], [122, 142],
  [58, 142], [58, 158], [90, 158], [90, 174], [122, 174], [122, 190], [138, 190],
  [138, 174], [154, 174], [154, 190], [186, 190], [186, 206], [298, 206], [298, 222],
  [282, 222], [282, 238], [266, 238], [266, 254], [298, 254], [298, 238], [314, 238],
  [314, 270], [282, 270], [282, 302], [266, 302], [266, 334], [218, 334], [218, 366],
  [202, 366], [202, 334], [186, 334], [186, 302], [170, 302], [170, 334], [138, 334],
  [138, 318], [154, 318], [154, 254], [122, 254], [122, 270], [106, 270], [106, 222],
  [42, 222], [42, 270], [58, 270], [58, 254], [74, 254], [74, 286], [90, 286],
  [90, 302], [58, 302], [58, 286], [42, 286], [42, 318], [90, 318], [90, 350],
  [106, 350], [106, 382], [138, 382], [138, 366], [154, 366], [154, 350], [170, 350],
  [170, 382], [154, 382], [154, 398], [170, 398], [170, 430], [186, 430], [186, 414],
  [234, 414], [234, 430], [202, 430], [202, 446], [170, 446], [170, 478], [186, 478],
  [186, 462], [202, 462], [202, 478], [234, 478], [234, 462], [250, 462], [250, 476]
];

// ---- precompute lengths ----
const cumLen = [0];
for (let i = 0; i < path.length - 1; i++) {
  const [x1, y1] = path[i];
  const [x2, y2] = path[i + 1];
  cumLen.push(cumLen[i] + Math.hypot(x2 - x1, y2 - y1));
}

// ---- SVG INIT ----
svgPath.style.strokeDasharray = totalLength;
svgPath.style.strokeDashoffset = totalLength;

function setHookXY(x, y) {
  const hookSize = 20;
  hook.setAttribute('x', Math.round(x - hookSize / 2));
  hook.setAttribute('y', Math.round(y - hookSize / 2));
}

function updateStrokeByIndex(i) {
  traveled = cumLen[i];
  svgPath.style.strokeDashoffset = totalLength - Math.min(traveled, totalLength);
}

// ---- FORWARD AUTO MOVE ----
function moveHook() {
  if (!animating) return;

  if (index >= path.length - 1 && !caught) {
    caught = true;

    animating = false;
    if (animationId) cancelAnimationFrame(animationId);
    animationId = null;

    // ✅ FIX: When caught at the end -> show fish facing UP
    setTunaByVector(0, -1);

    if (zunanja) zunanja.style.display = 'none';

    phase = 'back';
    return;
  }

  const hookSize = 20;
  let remainingSpeed = speed;

  while (remainingSpeed > 0 && index < path.length - 1) {
    const [x1, y1] = path[index];
    const [x2, y2] = path[index + 1];

    const dx = x2 - x1;
    const dy = y2 - y1;
    const dist = Math.hypot(dx, dy);

    const step = Math.min(remainingSpeed, dist - progress);
    progress += step;
    remainingSpeed -= step;

    const t = progress / dist;

  setHookByVector(dx, dy);
hook.setAttribute('x', Math.round(x1 + dx * t - hookSize / 2));
hook.setAttribute('y', Math.round(y1 + dy * t - hookSize / 2));

    traveled += step;
    svgPath.style.strokeDashoffset = totalLength - Math.min(traveled, totalLength);

    if (progress >= dist) {
      progress = 0;
      index++;
    }
  }

  animationId = requestAnimationFrame(moveHook);
}

// ---- SMOOTH STEP BETWEEN POINTS (NO SKIP) ----
function animatePointToPoint(fromI, toI, done) {
  stepLock = true;

  const [fx, fy] = path[fromI];
  const [tx, ty] = path[toI];

  const start = performance.now();

  function tick(now) {
    const t = Math.min(1, (now - start) / stepDuration);

    const x = fx + (tx - fx) * t;
    const y = fy + (ty - fy) * t;

    setHookXY(x, y);

    const lineLen = cumLen[fromI] + (cumLen[toI] - cumLen[fromI]) * t;
    svgPath.style.strokeDashoffset = totalLength - Math.min(lineLen, totalLength);

    if (t < 1) requestAnimationFrame(tick);
    else {
      index = toI;
      updateStrokeByIndex(index);
      stepLock = false;
      done?.();
    }
  }

  requestAnimationFrame(tick);
}

// ---- BACK ONE SEGMENT (SMOOTH) ----
function backOneSegmentSmooth() {
  if (stepLock) return;

  if (index <= 0) {
    phase = 'up';
    setTunaByVector(0, -1);
    return;
  }

  const [x1, y1] = path[index];
  const [x0, y0] = path[index - 1];

  // during back phase: face direction of movement
  setTunaByVector(x0 - x1, y0 - y1);

  animatePointToPoint(index, index - 1, () => {
    if (index <= 0) {
      phase = 'up';
      setTunaByVector(0, -1);
    }
  });
}

// ---- UP STEP (SMOOTH, STILL REQUIRES INPUT EACH STEP) ----
function upOneStepSmooth() {
  if (stepLock) return;
  stepLock = true;

  setTunaByVector(0, -1);

  const start = performance.now();
  const y0 = parseFloat(hook.getAttribute('y')); // top-left y

  let target = y0 - reelStepUp;
  if (Math.random() < slipChance) target += slipAmount;

  function tick(now) {
    const t = Math.min(1, (now - start) / stepDuration);
    const y = y0 + (target - y0) * t;

    hook.setAttribute('y', y);

    if (t < 1) requestAnimationFrame(tick);
    else {
      stepLock = false;

      const yNow = parseFloat(hook.getAttribute('y'));
      if (yNow <= reelTargetY) {
  hook.setAttribute('y', reelTargetY);
  resetRound();
}
    }
  }

  requestAnimationFrame(tick);
}



// ---- RESET ----
function resetRound() {
  caught = false;
  popupShown = false;
  phase = 'idle';
  animating = false;
  stepLock = false;
  progress = 0;

  if (animationId) cancelAnimationFrame(animationId);
  animationId = null;

  if (zunanja) zunanja.style.display = 'flex';

  hook.setAttribute('href', HOOK_DIR.dol);

  index = 0;
  traveled = 0;

  const [startX, startY] = path[0];
  setHookXY(startX, startY);

  svgPath.style.strokeDashoffset = totalLength;
}

// ---- INPUT DISPATCH ----
function handleInputStep() {
  if (!caught) return;
  if (phase === 'back') backOneSegmentSmooth();
  else if (phase === 'up') upOneStepSmooth();
}

// ---- BUTTONS ----
startBtn.addEventListener('click', () => {
  resetRound();
  animating = true;
  phase = 'forward';
  moveHook();
});

resetBtn.addEventListener('click', resetRound);

// ---- CLICK ----
document.addEventListener('click', (e) => {
  if (Swal.isVisible()) return; // ✅ ignore game input while popup open
  if (e.target.closest('button')) return;
  if (e.target.closest('.swal2-container')) return;
  handleInputStep();
});

// ---- SPACE ----
document.addEventListener('keydown', (e) => {
  if (e.code === 'Space') {
    if (Swal.isVisible()) return; // ✅ don't let Space trigger popup button
    e.preventDefault();
    handleInputStep();
  }
});

// ---- SCROLL WHEEL (UP ONLY), SMOOTH, NO SKIP ----
let wheelLock = false;

document.addEventListener('wheel', (e) => {
  if (Swal.isVisible()) return; // ✅ ignore wheel while popup open
  e.preventDefault();

  if (wheelLock) return;
  wheelLock = true;
  setTimeout(() => (wheelLock = false), stepDuration);

  const up = e.deltaY < 0;
  if (!up) return;

  if (e.target.closest('button')) return;

  handleInputStep();
}, { passive: false });


const instructionBtn = document.getElementById('navodila');

instructionBtn.addEventListener('click', (e) => {
  e.preventDefault();
  e.stopPropagation(); // da ne sproži document click "handleInputStep"

  Swal.fire({
    title: 'Instructions',
    html: `
      <div style="text-align:left; line-height:1.4">
        <p>Press Start, and when you catch a fish, hold Space to pull it to the boat.</p>
        
      </div>
    `,
    icon: 'info',
    confirmButtonText: 'OK',
    confirmButtonColor: 'rgb(35, 184, 233)',
    focusConfirm: false
  });
});
