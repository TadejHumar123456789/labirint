const hook = document.querySelector('.hook');
const reelBtn = document.getElementById('reelBtn'); 
const reelImg = reelBtn.querySelector('img'); 
const svgPaths = document.querySelectorAll('.path'); 
const svgPath = document.querySelector('.path-main'); 
const zunanja = document.getElementById('zunanja'); 

const HOOK_SIZE = 20; 


const totalLength = svgPath.getTotalLength(); // Izračunamo skupno dolžino SVG poti v px (za stroke-dash animacijo)

let reelHoldInterval = null; // Tukaj hranimo interval, ki teče, ko držimo mlinček
let traveled = 0; // Koliko dolžine smo že prepotovali 
let index = 0; // Indeks trenutne točke v tabeli path (kje smo na poti)
let progress = 0; //od ene točke do naslednje
let speed = 3; // Hitrost premikanja kljuke naprej px/frame

let animating = false; 
let animationId = null; 
let caught = false; 
let phase = 'idle'; 
let paused = false; 
let stepLock = false; 
let reelRotation = 0; 

let reelTargetY = -2; // Ciljna Y pozicija
let reelStepUp = 30; // Koliko gre kljuka navzgor na en poteg
let slipAmount = 4; // Koliko zdrsne nazaj, če zdrsne
let stepDuration = 150; // Trajanje enega gladkega premika (ms)

const TUNA_DIR = { 
  desno: 'img/tuna_desno.png', 
  levo: 'img/tuna_levo.png', 
  gor: 'img/tuna_gor.png',
  dol: 'img/tuna_dol.png' 
}; 

const HOOK_DIR = { 
  desno: 'img/hook_desno.png', 
  levo: 'img/hook_levo.png', 
  gor: 'img/hook_gor.png', 
  dol: 'img/hook_dol.png' 
}; 

function getDir(dx, dy) { // Funkcija določi smer glede na premik v x (dx) in y (dy)
  if (Math.abs(dx) > Math.abs(dy)) { // Če je vodoravni premik večji od navpičnega
    return dx >= 0 ? 'desno' : 'levo'; // Vrni 'desno' ali 'levo' glede na znak dx
  } 
  return dy >= 0 ? 'dol' : 'gor'; // Sicer vrni 'dol' ali 'gor' glede na znak dy
} 

function setHookByVector(dx, dy) { // Funkcija nastavi sliko kljuke glede na smer vektorja
  const dir = getDir(dx, dy); // Izračunamo tekstovno smer (desno/levo/gor/dol)
  hook.setAttribute('href', HOOK_DIR[dir]); // Nastavimo pravo sliko kljuke
} 

function setTunaByVector(dx, dy) { 
  const dir = getDir(dx, dy); // Določimo smer (desno/levo/gor/dol)
  hook.setAttribute('href', TUNA_DIR[dir]); 
}

function positionWelcomePopup(popup) { 
  popup.style.position = 'fixed';
  popup.style.top = '80vh'; 
  popup.style.left = '50%'; 
  popup.style.transform = 'translate(-50%, -50%)'; 
  popup.style.margin = '0'; 
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

const cumLen = [0]; // Tabela skupnih dolžin: cumLen[i] = dolžina od začetka do točke i

for (let i = 0; i < path.length - 1; i++) { // Gremo po vseh segmentih 
  const x1 = path[i][0]; // Vzamemo x koordinate trenutne točke
  const y1 = path[i][1]; // Vzamemo y koordinate trenutne točke
  const x2 = path[i + 1][0]; // Vzamemo x koordinate naslednje točke
  const y2 = path[i + 1][1]; // Vzamemo y koordinate naslednje točke
 const dx = x2 - x1;
const dy = y2 - y1;
const segment = Math.sqrt(dx * dx + dy * dy);// // Izračunamo dolžino segmenta (pitagora)
  cumLen.push(cumLen[i] + segment); // Dodamo novo skupno dolžino v tabelo
} 

for (const p of svgPaths) { // Gremo čez vse SVG poti (glow/main/shine)
  p.style.strokeDasharray = totalLength; // Nastavimo dasharray na celotno dolžino (da lahko risemo črto)
  p.style.strokeDashoffset = totalLength; // Na začetku skrijemo črto (offset = polna dolžina)
} 

function setHookXY(x, y) { // Funkcija postavi kljuko tako, da je središče na (x,y)
  hook.setAttribute('x', Math.round(x - HOOK_SIZE / 2)); // Nastavimo x (zgornji levi kot) in zaokrožimo
  hook.setAttribute('y', Math.round(y - HOOK_SIZE / 2)); // Nastavimo y (zgornji levi kot) in zaokrožimo
} 

function setAllPathOffsets(offset) { // Funkcija nastavi isti strokeDashoffset za vse 3 poti
  for (const p of svgPaths) { // Gremo čez vse SVG poti
    p.style.strokeDashoffset = offset; // Nastavimo, koliko črte je še skrite
  } 
} 

function updateStrokeByIndex(i) { // Funkcija nastavi risanje laksa glede na indeks točke
  traveled = cumLen[i]; // traveled postavimo na skupno dolžino do točke i
  const offset = totalLength - Math.min(traveled, totalLength); // Izračunamo offset (koliko ostane skrito)
  setAllPathOffsets(offset); // Posodobimo vse 3 črte hkrati
} 

function moveHook() { // Funkcija, ki se klica znova in znova z requestAnimationFrame
  if (!animating) return; // Če animacija ni aktivna, takoj končamo

  if (paused) { // Če je pavza vklopljena (Esc)
    animationId = requestAnimationFrame(moveHook);
    return; // Ne premikamo kljuke, ker je pavza
  } 

  if (index >= path.length - 1 && !caught) { //na koncu
    caught = true; // Označimo, da je riba ujeta
    animating = false; // Ustavimo avtomatsko animacijo naprej

    if (animationId) cancelAnimationFrame(animationId); // Prekličemo zadnji requestAnimationFrame, če obstaja
    animationId = null; // Počistimo animacije

    setTunaByVector(0, -1); // Nastavimo sliko tuna navzgor

    if (zunanja) zunanja.style.display = 'none'; // Skrijemo zunanjo ribo 
    if (reelBtn) reelBtn.style.display = 'block'; // Pokažemo mlinček 

    phase = 'back'; // Preklopimo fazo na vračanje nazaj po poti
    return; 
  } 

  let remainingSpeed = speed; // Preostala hitrost v tem frame

  while (remainingSpeed > 0 && index < path.length - 1) { // Dokler imamo hitrost in nismo na koncu poti
    const x1 = path[index][0]; // x začetne točke segmenta
    const y1 = path[index][1]; // y začetne točke segmenta
    const x2 = path[index + 1][0]; // x končne točke segmenta
    const y2 = path[index + 1][1]; // y končne točke segmenta

    const dx = x2 - x1; // Razlika po x (smer segmenta)
    const dy = y2 - y1; // Razlika po y (smer segmenta)
	//const dist = Math.sqrt(dx * dx + dy * dy);
    const dist = Math.hypot(dx, dy); // Dolžina segmenta

    const step = Math.min(remainingSpeed, dist - progress); // Koliko se premaknemo 
    progress += step; // Povečamo napredek znotraj segmenta
    remainingSpeed -= step; // Zmanjšamo preostalo hitrost

    const t = progress / dist; 

    setHookByVector(dx, dy); // Nastavimo sliko kljuke glede na smer premikanja

    const px = x1 + dx * t; // Izračunamo trenutni x položaj na segmentu
    const py = y1 + dy * t; // Izračunamo trenutni y položaj na segmentu
    setHookXY(px, py); // Premaknemo kljuko na izračunano pozicijo

    traveled += step; // Povečamo skupno prepotovano dolžino
    const offset = totalLength - Math.min(traveled, totalLength); // Izračunamo novi offset za risanje laksa
    setAllPathOffsets(offset); // Posodobimo risanje laksa (vse 3 poti)

    if (progress >= dist) { // Če smo prišli do konca segmenta
      progress = 0; // Reset napredka znotraj segmenta
      index++; // Premaknemo se na naslednji segment (naslednjo točko)
    } 
  } 

  animationId = requestAnimationFrame(moveHook); // V naslednjem frame-u spet kličemo moveHook
} 
function animatePointToPoint(fromI, toI, done) { // Gladko premikanje kljuke od točke fromI do toI
  stepLock = true; // Zaklenemo korake, da ne prekrijemo animacije z novo

  const fx = path[fromI][0]; // Začetni x
  const fy = path[fromI][1]; // Začetni y
  const tx = path[toI][0]; // Končni x
  const ty = path[toI][1]; // Končni y
  const start = performance.now(); // Shranimo začetni čas animacije

  function tick(now) { // Notranja funkcija za vsak frame animacije
    const t = Math.min(1, (now - start) / stepDuration); //  koliko animacije je že mimo

    const x = fx + (tx - fx) * t; // Linearna interpolacija x
    const y = fy + (ty - fy) * t; // Linearna interpolacija y

    setHookXY(x, y); // Premaknemo kljuko na interpolirano pozicijo

    const lineLen = cumLen[fromI] + (cumLen[toI] - cumLen[fromI]) * t; // Izračunamo, koliko laksa naj bo narisanega
    const offset = totalLength - Math.min(lineLen, totalLength); // Offset za stroke-dash
    setAllPathOffsets(offset); // Nastavimo offset na vseh 3 črtah

    if (t < 1) { // Če animacija še ni končana
      requestAnimationFrame(tick); // Nadaljujemo v naslednjem frame-u
    } else { // Če smo končali animacijo
      index = toI; // Nastavimo trenutni indeks na ciljno točko
      updateStrokeByIndex(index); // Popravimo traveled in offset, da je čist rezultat
      stepLock = false; // Odklenemo korake
      if (typeof done === 'function') done(); // Če je done funkcija, jo pokličemo
    } 
  } 

  requestAnimationFrame(tick); // Zaženemo animacijo v prvem frame-u
} 

function backOneSegmentSmooth() { // Funkcija premakne kljuko en segment nazaj 
  if (stepLock) return; // Če je korak zaklenjen, nič ne naredimo

  if (index <= 0) { // Če smo že na začetku poti
    phase = 'up'; // Preklopimo v fazo vlečenja navzgor
    setTunaByVector(0, -1); // Tuna slika naj kaže navzgor
    return; // Končamo
  } // Konec pogoja za začetek

  const x1 = path[index][0]; // x trenutne točke
  const y1 = path[index][1]; // y trenutne točke
  const x0 = path[index - 1][0]; // x prejšnje točke
  const y0 = path[index - 1][1]; // y prejšnje točke

  setTunaByVector(x0 - x1, y0 - y1); // Nastavimo tuno glede na smer nazaj

  animatePointToPoint(index, index - 1, function () { // Animiramo nazaj en segment
    if (index <= 0) { // Če smo prišli na začetek
      phase = 'up'; // Preklopimo v up
      setTunaByVector(0, -1); // Nastavimo tuno navzgor
    } 
  }); 
}

function upOneStepSmooth() { // Funkcija premakne kljuko navzgor 
  if (stepLock) return; // Če smo zaklenjeni, ne delamo nič
  stepLock = true; // Zaklenemo, dokler se korak ne konča

  setTunaByVector(0, -1); // Tuna slika naj kaže navzgor

  const start = performance.now(); // Začetni čas animacije
  const y0 = parseFloat(hook.getAttribute('y')); // Vzamemo trenutni y atribut kljuke (zgornji levi kot)
  let target = y0 - reelStepUp; // Ciljni y je za reelStepUp višje (manjša vrednost)

 

  function tick(now) { // Funkcija za vsak frame vlečenja navzgor
    const t = Math.min(1, (now - start) / stepDuration); // za trajanje koraka
    const y = y0 + (target - y0) * t; // Izračun novega y z linearno interpolacijo

    hook.setAttribute('y', y); // Nastavimo y (premik navzgor)

    if (t < 1) { // Če animacija še ni končana
      requestAnimationFrame(tick); // Nadaljuj v naslednjem frame-u
    } else { // Če je korak končan
      stepLock = false; // Odklenemo korak

      const yNow = parseFloat(hook.getAttribute('y')); // Preberemo trenutno y vrednost
      if (yNow <= reelTargetY) { // Če smo dovolj visoko za zmago
        hook.setAttribute('y', reelTargetY); // Postavimo natančno na ciljno višino
        animating = false; // Ustavimo avtomatsko animacijo (za vsak slučaj)
        phase = 'idle'; // Fazo damo na idle
        stepLock = false; // Zagotovimo, da zaklep ni več aktiven
        showWinPopup(); // Pokažemo popup za zmago
      } 
    } 
  }

  requestAnimationFrame(tick); // Zaženemo animacijo navzgor v prvem frame-u
} 


function handleInputStep() { // Funkcija izvede en korak glede na trenutno fazo
  if (!caught) return; // Če ribe še nismo ujeli, ne vlečemo
  if (phase === 'back') backOneSegmentSmooth(); // Če smo v fazi vračanja, pojdi en segment nazaj
  else if (phase === 'up') upOneStepSmooth(); // Če smo v fazi dvigovanja, pojdi en korak gor
} 

function rotateReelOnce() { // Funkcija zavrti mlinček za en klik
  reelRotation += 360; // Povečamo rotacijo za 360 stopinj
  reelImg.style.transform = 'rotate(' + reelRotation + 'deg)'; // Nastavimo CSS transform, da se slika zavrti
} 

function startReeling() { // Funkcija začne vlečenje (držanje mlinčka)
  if (Swal.isVisible()) return; // Če je popup odprt, ne dovolimo vlečenja
  if (!caught) return; // Če še ni ujeta riba, ne vlečemo
  if (phase !== 'back' && phase !== 'up') return; // Vlečemo samo v fazah back ali up
  if (reelHoldInterval) return; // Če interval že teče, ga ne ustvarimo še enkrat

  handleInputStep(); // Takoj naredimo en korak vlečenja
  rotateReelOnce(); // Takoj zavrtimo mlinček

  reelHoldInterval = setInterval(function () { // Nastavimo interval, ki se ponavlja dokler držimo
    handleInputStep(); // Vsak interval naredimo še en korak
    rotateReelOnce(); // Vsak interval zavrtimo mlinček
  }, stepDuration + 20); // Čas intervala je malo daljši od trajanja animacije koraka
}

function stopReeling() { // Funkcija ustavi vlečenje (ko spustimo gumb)
  if (reelHoldInterval) { // Če interval obstaja
    clearInterval(reelHoldInterval); // Ustavimo interval
    reelHoldInterval = null; // Počistimo spremenljivko
  } 
} 

function resetRound() { // Funkcija resetira vse na začetno stanje
  stopReeling(); // Najprej ustavimo morebitno vlečenje

  caught = false; // Riba ni več ujeta
  paused = false; // Pavza je izklopljena
  phase = 'idle'; // Faza je idle
  animating = false; // Animacija je izklopljena
  stepLock = false; // Korak ni zaklenjen
  progress = 0; // Napredek po segmentu resetiramo

  if (reelBtn) reelBtn.style.display = 'none'; // Skrijemo mlinček
  if (animationId) cancelAnimationFrame(animationId); // Ustavimo requestAnimationFrame, če teče
  animationId = null; // Počistimo ID
  if (zunanja) zunanja.style.display = 'flex'; // Spet pokažemo zunanjo ribo

  hook.setAttribute('href', HOOK_DIR.dol); // Nastavimo sliko kljuke nazaj 

  index = 0; // Začnemo na prvi točki
  traveled = 0; // Potovalna dolžina je 0

  const startX = path[0][0]; // Začetni x
  const startY = path[0][1]; // Začetni y
  setHookXY(startX, startY); // Postavimo kljuko na start

  setAllPathOffsets(totalLength); // Skrijemo celoten laks (nič še ni narisano)
} 

function startGame() { // Funkcija začne igro )
  resetRound(); // Najprej resetiramo
  paused = false; // Prepričamo se, da pavza ni vključena
  animating = true; // Vklopimo animacijo
  phase = 'forward'; // Faza je premik naprej
  moveHook(); // Zaženemo animacijsko zanko
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
  }).then(function (result) { 
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
  }).then(function (result) { 
    if (result.isConfirmed) { 
      startGame(); 
    } else if (result.isDenied) { 
      showInstructionsPopup();
    } 
  });
} 

window.addEventListener('load', function () { 
  Swal.fire({
    title: 'Welcome to fishing maze', 
    html: `
      <div style="line-height:1.5; text-align:center;">
        <p>Choose an option to read the instruction or to start the game</p>
      </div>
    `, 
    width: '30vw', 
    background: '#d9d9d9', 
    backdrop: 'rgba(128, 128, 128, 0.75)', 
    didOpen: function () {
      const popup = Swal.getPopup(); 
      if (popup) {
        popup.style.height = '30vh';
        popup.style.maxHeight = '30vh'; 
        popup.style.maxWidth = '30vw'; 
        popup.style.margin = '0'; 
        popup.style.padding = '20px';
        popup.style.boxSizing = 'border-box'; 
        popup.style.overflowY = 'auto'; 
      } 
    }, 
    showDenyButton: true, 
    confirmButtonText: 'Start', 
    denyButtonText: 'Instructions', 
    confirmButtonColor: 'rgb(35, 184, 233)',
    denyButtonColor: 'rgb(35, 184, 233)', 
    allowOutsideClick: false, 
    allowEscapeKey: false, 
    focusConfirm: false 
  }).then(function (result) { 
    if (result.isConfirmed) {
      startGame(); 
    } else if (result.isDenied) { 
      showInstructionsPopup();
    } 
  }); 
}); 


reelBtn.addEventListener('mousedown', function (e) { // Ko pritisnemo miško na mlinček
  e.preventDefault(); // Preprečimo privzeto obnašanje
  e.stopPropagation(); // Ustavimo širjenje dogodka naprej
  startReeling(); // Začnemo vlečenje
});

reelBtn.addEventListener('touchstart', function (e) { // Ko se dotaknemo mlinčka na telefonu
  e.preventDefault(); // Preprečimo premikanje strani (scroll) ipd.
  startReeling(); // Začnemo vlečenje
}, { passive: false }); // Passive false je potrebno, da preventDefault deluje

reelBtn.addEventListener('click', function (e) { // Ko kliknemo mlinček (posamičen klik)
  e.preventDefault(); // Preprečimo privzeto obnašanje
  e.stopPropagation(); // Ustavimo širjenje dogodka
  rotateReelOnce(); // Zavrtimo mlinček enkrat
  handleInputStep(); // Naredimo en korak vlečenja
});

document.addEventListener('touchend', stopReeling); // Ko spustimo dotik, ustavimo vlečenje
document.addEventListener('touchcancel', stopReeling); // Če se dotik prekine, ustavimo vlečenje
document.addEventListener('mouseup', stopReeling); // Ko spustimo gumb miške, ustavimo vlečenje
document.addEventListener('mouseleave', stopReeling); // Ko miška zapusti okno, ustavimo vlečenje

document.addEventListener('keydown', function (e) { // Ko pritisnemo tipko
  if (e.code === 'Escape') { // Če je tipka Escape
    if (Swal.isVisible()) return; // Če je popup odprt, ne pavziramo
    if (phase !== 'forward') return; // Pavza deluje samo med premikom naprej
    paused = !paused; // Preklopimo stanje pavze (true/false)
  } 
});

zunanja.addEventListener('click', function (e) { // Ko kliknemo zunanjo ribo (krediti)
  e.preventDefault(); // Preprečimo privzeto obnašanje
  e.stopPropagation(); // Ustavimo širjenje klika

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
