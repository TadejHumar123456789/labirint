// Glavni elementi iz DOM-a
const hook = document.querySelector('.hook');
const reelBtn = document.getElementById('reelBtn');
const reelImg = reelBtn.querySelector('img');
const svgPaths = document.querySelectorAll('.path');
const svgPath = document.querySelector('.path-main');
const zunanja = document.getElementById('zunanja');

// Skupna dolžina SVG poti
const totalLength = svgPath.getTotalLength();

// Stanje igre / animacije
let reelHoldInterval = null;
let traveled = 0;
let index = 0;
let progress = 0;
let speed = 3;

let animating = false;
let animationId = null;
let caught = false;
let phase = 'idle';
let paused = false;
let stepLock = false;
let reelRotation = 0;

// Nastavitve vlečenja ribe navzgor
let reelTargetY = -2;
let reelStepUp = 30;
let slipChance = 0.10;
let slipAmount = 4;
let stepDuration = 150;

// Slike tune glede na smer
const TUNA_DIR = {
  desno: 'img/tuna_desno.png',
  levo: 'img/tuna_levo.png',
  gor: 'img/tuna_gor.png',
  dol: 'img/tuna_dol.png'
};

// Slike kljuke glede na smer
const HOOK_DIR = {
  desno: 'img/hook_desno.png',
  levo: 'img/hook_levo.png',
  gor: 'img/hook_gor.png',
  dol: 'img/hook_dol.png'
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

const cumLen = [0];
for (let i = 0; i < path.length - 1; i++) {
  const [x1, y1] = path[i];
  const [x2, y2] = path[i + 1];
  cumLen.push(cumLen[i] + Math.hypot(x2 - x1, y2 - y1));
}

svgPaths.forEach(p => {
  p.style.strokeDasharray = totalLength;
  p.style.strokeDashoffset = totalLength;
});

function setHookXY(x, y) {
  const hookSize = 20;
  hook.setAttribute('x', Math.round(x - hookSize / 2));
  hook.setAttribute('y', Math.round(y - hookSize / 2));
}

function setAllPathOffsets(offset) {
  svgPaths.forEach(p => {
    p.style.strokeDashoffset = offset;
  });
}

function updateStrokeByIndex(i) {
  traveled = cumLen[i];
  const offset = totalLength - Math.min(traveled, totalLength);
  setAllPathOffsets(offset);
}

function moveHook() {
  if (!animating) return;

  if (paused) {
    animationId = requestAnimationFrame(moveHook);
    return;
  }

  if (index >= path.length - 1 && !caught) {
    caught = true;
    animating = false;

    if (animationId) cancelAnimationFrame(animationId);
    animationId = null;

    setTunaByVector(0, -1);

    if (zunanja) zunanja.style.display = 'none';
    if (reelBtn) reelBtn.style.display = 'block';

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
    const offset = totalLength - Math.min(traveled, totalLength);
    setAllPathOffsets(offset);

    if (progress >= dist) {
      progress = 0;
      index++;
    }
  }

  animationId = requestAnimationFrame(moveHook);
}

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
    const offset = totalLength - Math.min(lineLen, totalLength);
    setAllPathOffsets(offset);

    if (t < 1) {
      requestAnimationFrame(tick);
    } else {
      index = toI;
      updateStrokeByIndex(index);
      stepLock = false;
      done?.();
    }
  }

  requestAnimationFrame(tick);
}

function backOneSegmentSmooth() {
  if (stepLock) return;

  if (index <= 0) {
    phase = 'up';
    setTunaByVector(0, -1);
    return;
  }

  const [x1, y1] = path[index];
  const [x0, y0] = path[index - 1];

  setTunaByVector(x0 - x1, y0 - y1);

  animatePointToPoint(index, index - 1, () => {
    if (index <= 0) {
      phase = 'up';
      setTunaByVector(0, -1);
    }
  });
}

function upOneStepSmooth() {
  if (stepLock) return;
  stepLock = true;

  setTunaByVector(0, -1);

  const start = performance.now();
  const y0 = parseFloat(hook.getAttribute('y'));
  let target = y0 - reelStepUp;

  if (Math.random() < slipChance) target += slipAmount;

  function tick(now) {
    const t = Math.min(1, (now - start) / stepDuration);
    const y = y0 + (target - y0) * t;

    hook.setAttribute('y', y);

    if (t < 1) {
      requestAnimationFrame(tick);
    } else {
      stepLock = false;

      const yNow = parseFloat(hook.getAttribute('y'));

      if (yNow <= reelTargetY) {
        hook.setAttribute('y', reelTargetY);
        animating = false;
        phase = 'idle';
        stepLock = false;
        showWinPopup();
      }
    }
  }

  requestAnimationFrame(tick);
}

function handleInputStep() {
  if (!caught) return;
  if (phase === 'back') backOneSegmentSmooth();
  else if (phase === 'up') upOneStepSmooth();
}

function startReeling() {
  if (Swal.isVisible()) return;
  if (!caught) return;
  if (phase !== 'back' && phase !== 'up') return;
  if (reelHoldInterval) return;

  handleInputStep();
  reelRotation += 360;
  reelImg.style.transform = `rotate(${reelRotation}deg)`;

  reelHoldInterval = setInterval(() => {
    handleInputStep();
    reelRotation += 360;
    reelImg.style.transform = `rotate(${reelRotation}deg)`;
  }, stepDuration + 20);
}

function stopReeling() {
  if (reelHoldInterval) {
    clearInterval(reelHoldInterval);
    reelHoldInterval = null;
  }
}

function resetRound() {
  stopReeling();

  caught = false;
  paused = false;
  phase = 'idle';
  animating = false;
  stepLock = false;
  progress = 0;

  if (reelBtn) reelBtn.style.display = 'none';
  if (animationId) cancelAnimationFrame(animationId);
  animationId = null;
  if (zunanja) zunanja.style.display = 'flex';

  hook.setAttribute('href', HOOK_DIR.dol);

  index = 0;
  traveled = 0;

  const [startX, startY] = path[0];
  setHookXY(startX, startY);

  setAllPathOffsets(totalLength);
}

function startGame() {
  resetRound();
  paused = false;
  animating = true;
  phase = 'forward';
  moveHook();
}

function showInstructionsPopup() {
  Swal.fire({
    title: 'Instructions',
    html: `
      <div style="text-align:left; line-height:1.5">
        <p>1. Click <b>Start</b> to begin the maze path.</p>
        <p>2. The hook moves automatically through the maze.</p>
        <p>3. When the fish is caught, hold the <b>reel</b> in the bottom left corner to pull it up.</p>
      </div>
    `,
    showDenyButton: true,
    confirmButtonText: 'Start',
    denyButtonText: 'Back',
    confirmButtonColor: 'rgb(35, 184, 233)',
    denyButtonColor: 'rgb(35, 184, 233)',
    allowOutsideClick: false,
    allowEscapeKey: false,
    focusConfirm: false
  }).then((result) => {
    if (result.isConfirmed) {
      startGame();
    } else if (result.isDenied) {
      window.dispatchEvent(new Event('load'));
    }
  });
}

function showWinPopup() {
  Swal.fire({
    title: 'Congratulations!',
    text: 'You caught the fish!',
    icon: 'success',
    showDenyButton: true,
    confirmButtonText: 'Catch more',
    denyButtonText: 'Instructions',
    confirmButtonColor: 'rgb(35, 184, 233)',
    denyButtonColor: 'rgb(35, 184, 233)',
    allowOutsideClick: false,
    allowEscapeKey: false,
    focusConfirm: false
  }).then((result) => {
    if (result.isConfirmed) {
      startGame();
    } else if (result.isDenied) {
      showInstructionsPopup();
    }
  });
}

window.addEventListener('load', () => {
  Swal.fire({
    title: 'Welcome to fishing maze',
    html: `
      <div style="line-height:1.5; text-align:center;">
        <p>Choose an option to read the instruction or to start the game</p>
      </div>
    `,
    showDenyButton: true,
    confirmButtonText: 'Start',
    denyButtonText: 'Instructions',
    confirmButtonColor: 'rgb(35, 184, 233)',
    denyButtonColor: 'rgb(35, 184, 233)',
    allowOutsideClick: false,
    allowEscapeKey: false,
    focusConfirm: false
  }).then((result) => {
    if (result.isConfirmed) {
      startGame();
    } else if (result.isDenied) {
      showInstructionsPopup();
    }
  });
});

reelBtn.addEventListener('mousedown', (e) => {
  e.preventDefault();
  e.stopPropagation();
  startReeling();
});

reelBtn.addEventListener('touchstart', (e) => {
  e.preventDefault();
  startReeling();
}, { passive: false });

reelBtn.addEventListener('click', (e) => {
  e.preventDefault();
  e.stopPropagation();

  reelRotation += 360;
  reelImg.style.transform = `rotate(${reelRotation}deg)`;

  handleInputStep();
});

document.addEventListener('touchend', stopReeling);
document.addEventListener('touchcancel', stopReeling);
document.addEventListener('mouseup', stopReeling);
document.addEventListener('mouseleave', stopReeling);

document.addEventListener('keydown', (e) => {
  if (e.code === 'Escape') {
    if (Swal.isVisible()) return;
    if (phase !== 'forward') return;
    paused = !paused;
  }
});

zunanja.addEventListener('click', (e) => {
  e.preventDefault();
  e.stopPropagation();

  Swal.fire({
    title: 'Credits',
    html: `
      <div style="text-align:center; line-height:1.6">
        <p>Tadej Humar</p>
        <p>2025/26</p>
      </div>
    `,
    confirmButtonText: 'OK',
    confirmButtonColor: 'rgb(35, 184, 233)',
    focusConfirm: false
  });
});