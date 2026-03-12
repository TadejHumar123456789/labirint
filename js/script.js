// Glavni elementi iz DOM-a
const hook = document.querySelector('.hook');          // SVG kljuka/riba, ki se premika po poti
const reelBtn = document.getElementById('reelBtn');    // gumb za navijanje
const reelImg = reelBtn.querySelector('img');          // slika mlinčka znotraj gumba
const svgPath = document.querySelector('.path');       // narisana pot v SVG
const zunanja = document.getElementById('zunanja');    // zunanja riba za credits / začetni prikaz

// Skupna dolžina SVG poti
const totalLength = svgPath.getTotalLength();

// Stanje igre / animacije
let reelHoldInterval = null;   // interval za držanje gumba pri navijanju
let traveled = 0;              // koliko poti je že prepotovane
let index = 0;                 // trenutni indeks točke v path tabeli
let progress = 0;              // napredek med dvema točkama
let speed = 3;                 // hitrost premikanja kljuke po poti

let animating = false;         // ali animacija trenutno teče
let animationId = null;        // id requestAnimationFrame
let caught = false;            // ali je riba ujeta
let phase = 'idle';            // faza igre: idle / forward / back / up
let paused = false;            // pavza med avtomatskim gibanjem
let stepLock = false;          // zaklep, da se isti korak ne izvede večkrat hkrati
let reelRotation = 0;          // trenutna rotacija slike mlinčka

// Nastavitve vlečenja ribe navzgor
let reelTargetY = -2;          // končni Y položaj, ko je riba čisto zgoraj
let reelStepUp = 30;           // koliko pikslov gre gor na en "poteg"
let slipChance = 0.10;         // verjetnost, da malo zdrsne nazaj
let slipAmount = 4;            // koliko zdrsne navzdol
let stepDuration = 150;        // trajanje enega koraka animacije

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

// Vrne smer glede na vektor premika
// Če je premik bolj vodoraven -> levo/desno
// Če je bolj navpičen -> gor/dol
function getDir(dx, dy) {
  if (Math.abs(dx) > Math.abs(dy)) return dx >= 0 ? 'desno' : 'levo';
  return dy >= 0 ? 'dol' : 'gor';
}

// Nastavi sliko kljuke glede na smer premika
function setHookByVector(dx, dy) {
  const dir = getDir(dx, dy);
  hook.setAttribute('href', HOOK_DIR[dir]);
}

// Nastavi sliko tune glede na smer premika
// POZOR: trenutno spreminja isti SVG element "hook"
function setTunaByVector(dx, dy) {
  const dir = getDir(dx, dy);
  hook.setAttribute('href', TUNA_DIR[dir]);
}

// Točke poti, po kateri se premika kljuka
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

// CumLen = cumulative length
// Za vsako točko izračuna skupno dolžino poti do tja
// To se uporablja za pravilno risanje / brisanje stroke po poti
const cumLen = [0];
for (let i = 0; i < path.length - 1; i++) {
  const [x1, y1] = path[i];
  const [x2, y2] = path[i + 1];
  cumLen.push(cumLen[i] + Math.hypot(x2 - x1, y2 - y1));
}

// Inicialno skrijemo pot
svgPath.style.strokeDasharray = totalLength;
svgPath.style.strokeDashoffset = totalLength;

// Nastavi položaj kljuke po centru
function setHookXY(x, y) {
  const hookSize = 20;
  hook.setAttribute('x', Math.round(x - hookSize / 2));
  hook.setAttribute('y', Math.round(y - hookSize / 2));
}

// Posodobi narisani del poti glede na trenutni indeks
function updateStrokeByIndex(i) {
  traveled = cumLen[i];
  svgPath.style.strokeDashoffset = totalLength - Math.min(traveled, totalLength);
}

// Glavna funkcija za avtomatsko premikanje kljuke naprej po poti
function moveHook() {
  if (!animating) return; // če animacija ne teče, nič ne naredi

  if (paused) {
    animationId = requestAnimationFrame(moveHook); // če je pavza, samo čaka
    return;
  }

  // Če smo na koncu poti in riba še ni ujeta
  if (index >= path.length - 1 && !caught) {
    caught = true;
    animating = false;

    if (animationId) cancelAnimationFrame(animationId);
    animationId = null;

    setTunaByVector(0, -1); // kljuka postane tuna obrnjena gor

    if (zunanja) zunanja.style.display = 'none';
    if (reelBtn) reelBtn.style.display = 'block';

    phase = 'back'; // zdaj gre nazaj po poti
    return;
  }

  const hookSize = 20;
  let remainingSpeed = speed;

  // V enem frame-u se lahko premakne čez več segmentov poti
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

    // Nastavi nov položaj med trenutno in naslednjo točko
    hook.setAttribute('x', Math.round(x1 + dx * t - hookSize / 2));
    hook.setAttribute('y', Math.round(y1 + dy * t - hookSize / 2));

    // Posodobi prikaz poti
    traveled += step;
    svgPath.style.strokeDashoffset = totalLength - Math.min(traveled, totalLength);

    // Če je prišel do naslednje točke, gre na naslednji segment
    if (progress >= dist) {
      progress = 0;
      index++;
    }
  }

  animationId = requestAnimationFrame(moveHook);
}

// Gladko animira premik od ene točke do druge
// Uporablja se pri vlečenju nazaj po poti
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

    // Posodobi tudi dolžino narisane poti med animacijo
    const lineLen = cumLen[fromI] + (cumLen[toI] - cumLen[fromI]) * t;
    svgPath.style.strokeDashoffset = totalLength - Math.min(lineLen, totalLength);

    if (t < 1) {
      requestAnimationFrame(tick);
    } else {
      index = toI;
      updateStrokeByIndex(index);
      stepLock = false;
      done?.(); // če callback obstaja, ga pokliče
    }
  }

  requestAnimationFrame(tick);
}

// Premakne ribo en segment nazaj po poti
function backOneSegmentSmooth() {
  if (stepLock) return; // če že teče drug korak, ne naredi nič

  // Če smo že na začetku poti, gremo v fazo vlečenja navzgor
  if (index <= 0) {
    phase = 'up';
    setTunaByVector(0, -1);
    return;
  }

  const [x1, y1] = path[index];
  const [x0, y0] = path[index - 1];

  // Tuna se obrne v smer nazaj
  setTunaByVector(x0 - x1, y0 - y1);

  // Gladek premik en segment nazaj
  animatePointToPoint(index, index - 1, () => {
    if (index <= 0) {
      phase = 'up';
      setTunaByVector(0, -1);
    }
  });
}

// Premakne ribo en korak navzgor proti vrhu
function upOneStepSmooth() {
  if (stepLock) return;
  stepLock = true;

  setTunaByVector(0, -1);

  const start = performance.now();
  const y0 = parseFloat(hook.getAttribute('y'));
  let target = y0 - reelStepUp;

  // Včasih riba malo zdrsne nazaj
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

      // Če pride do vrha, pokaže popup za zmago
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

// Glede na fazo igre izvede en "input step"
function handleInputStep() {
  if (!caught) return;
  if (phase === 'back') backOneSegmentSmooth();
  else if (phase === 'up') upOneStepSmooth();
}

// Začne navijanje, ko igralec drži mlinček
function startReeling() {
  if (Swal.isVisible()) return;                 // če je popup odprt, ne navija
  if (!caught) return;                         // če riba ni ujeta, ne navija
  if (phase !== 'back' && phase !== 'up') return;
  if (reelHoldInterval) return;                // če že navija, ne naredi nič

  // Takoj naredi prvi korak
  handleInputStep();
  reelRotation += 360;
  reelImg.style.transform = `rotate(${reelRotation}deg)`;

  // Nato ponavlja korake, dokler je gumb držan
  reelHoldInterval = setInterval(() => {
    handleInputStep();
    reelRotation += 360;
    reelImg.style.transform = `rotate(${reelRotation}deg)`;
  }, stepDuration + 20);
}

// Ustavi navijanje
function stopReeling() {
  if (reelHoldInterval) {
    clearInterval(reelHoldInterval);
    reelHoldInterval = null;
  }
}

// Resetira celotno rundo v začetno stanje
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

  svgPath.style.strokeDashoffset = totalLength;
}

// Začne novo igro
function startGame() {
  resetRound();
  paused = false;
  animating = true;
  phase = 'forward';
  moveHook();
}

// Pokaže popup z navodili
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

// Pokaže popup ob zmagi
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

// Ko se stran naloži, pokaže začetni popup
window.addEventListener('load', () => {
  Swal.fire({
    title: 'Welcome',
    html: `
      <div style="line-height:1.5; text-align:center;">
        <p>Choose an option:</p>
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

// Miška dol na mlinčku -> začne navijanje
reelBtn.addEventListener('mousedown', (e) => {
  e.preventDefault();
  e.stopPropagation();
  startReeling();
});

// Touch na telefonu -> začne navijanje
reelBtn.addEventListener('touchstart', (e) => {
  e.preventDefault();
  startReeling();
}, { passive: false });

// Klik na mlinček -> enkrat zavrti sliko in naredi en korak
reelBtn.addEventListener('click', (e) => {
  e.preventDefault();
  e.stopPropagation();

  reelRotation += 360;
  reelImg.style.transform = `rotate(${reelRotation}deg)`;

  handleInputStep();
});

// Ko uporabnik spusti klik / touch, se navijanje ustavi
document.addEventListener('touchend', stopReeling);
document.addEventListener('touchcancel', stopReeling);
document.addEventListener('mouseup', stopReeling);
document.addEventListener('mouseleave', stopReeling);

// Escape pavzira / od-pavzira avtomatsko premikanje naprej
document.addEventListener('keydown', (e) => {
  if (e.code === 'Escape') {
    if (Swal.isVisible()) return;     // če je popup odprt, ne pavzira
    if (phase !== 'forward') return;  // pavza deluje samo med gibanjem naprej
    paused = !paused;
  }
});

// Klik na zunanjo ribo pokaže credits
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