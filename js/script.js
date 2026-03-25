/*
  =====================================================================
  LABIRINT - FISHING MAZE
  =====================================================================
  Ta datoteka vsebuje vso JavaScript logiko za igro.

  Kako igra deluje:
  1. Ko se stran nalozi, se pojavi pozdravni popup.
  2. Ko pritisnemo "Start", se kljuka zacne samodejno premikati po poti labirinta.
  3. Ko kljuka pride do konca poti, "ujame" ribo.
  4. Potem mora igralec drzati mlinzek (gumb), da potegne ribo ven.
  5. Ko je riba dovolj visoko, se izpise zmaga.

  OPOMBA ZA RAZUMEVANJE:
  - V Javi pisemo "System.out.println()" - tukaj pisemo "console.log()"
  - V Javi imamo "int x = 5" - tukaj pisemo "let x = 5" ali "const x = 5"
  - "const" pomeni, da vrednosti ne bomo spremenili (kot "final" v Javi)
  - "let" pomeni, da vrednost lahko spremenimo
  - Funkcije pisemo z "function ime() { ... }" namesto "void ime() { ... }"
  =====================================================================
*/


/* =====================================================================
   PRIDOBIVANJE ELEMENTOV IZ HTML-ja
   =====================================================================
   document.querySelector in getElementById poiščeta HTML element po
   CSS razredu (.ime) ali po ID-ju (ime brez #).
   To je podobno kot ko v Javi ustvarimo referenco na objekt.
   ===================================================================== */

const hook     = document.querySelector('.hook');       // SVG slika kljuke (premika se po labirintu)
const reelBtn  = document.getElementById('reelBtn');    // Gumb mlinčka (za vlečenje ribe)
const reelImg  = reelBtn.querySelector('img');          // Slika znotraj gumba mlinčka (da jo zavrtimo)
const svgPaths = document.querySelectorAll('.path');    // Vse 3 SVG črte poti (glow, main, shine)
const svgPath  = document.querySelector('.path-main'); // Samo glavna SVG črta (za izračun dolžine)
const zunanja  = document.getElementById('zunanja');   // Slika ribe, ki čaka zunaj (pred ulovom)


/* =====================================================================
   KONSTANTE - vrednosti, ki se nikoli ne spremenijo
   "const" je kot "final" v Javi
   ===================================================================== */

const HOOK_SIZE = 20; // Velikost slike kljuke v pikslih (20x20 px)


/* =====================================================================
   DOLŽINA SVG POTI
   =====================================================================
   getTotalLength() je vgrajena funkcija za SVG elemente.
   Vrne skupno dolžino narisane SVG črte v pikslih.

   Kako deluje animacija risanja laksa:
   - strokeDasharray = celotna dolžina  → črta je "en velik pomišljaj"
   - strokeDashoffset = celotna dolžina → ves pomišljaj je premaknjen stran = neviden
   - Ko zmanjšujemo offset → črta se začne risati od začetka
   ===================================================================== */

const totalLength = svgPath.getTotalLength(); // Skupna dolžina SVG poti v pikslih


/* =====================================================================
   SPREMENLJIVKE STANJA IGRE
   =====================================================================
   Te spremenljivke sledijo trenutnemu stanju igre.
   "let" pomeni, da vrednost lahko spremenimo med igro.
   ===================================================================== */

let reelHoldInterval = null; // Interval za ponavljanje vlečenja (dokler držimo gumb)
                              // null = interval trenutno ne teče

let traveled  = 0;    // Koliko skupne dolžine poti smo že prepotovali (v pikslih)
let index     = 0;    // Katera točka v tabeli "path" je trenutna (kje smo na poti)
let progress  = 0;    // Koliko smo napredovali ZNOTRAJ trenutnega segmenta
let speed     = 3;    // Hitrost kljuke: koliko pikslov se premakne na vsak "frame"

let animating   = false;  // Ali se kljuka trenutno samodejno premika naprej?
let animationId = null;   // ID zadnjega requestAnimationFrame klica (za preklic)
let caught      = false;  // Ali je riba že ujeta (kljuka prišla do konca)?
let phase       = 'idle'; // Trenutna faza igre:
                          //   'idle'    = igra ni aktivna
                          //   'forward' = kljuka gre naprej po labirintu
                          //   'back'    = kljuka se vrača nazaj (z ribo)
                          //   'up'      = kljuka gre navzgor (vlečenje ribe ven)
let paused      = false;  // Ali je igra na pavzi (tipka Escape)?
let stepLock    = false;  // Zaklepanje: preprečuje začetek novega koraka med animacijo
let reelRotation = 0;     // Skupna rotacija slike mlinčka (za CSS animacijo vrtenja)

let reelTargetY  = -2;  // Y koordinata zmage: ko kljuka pride sem, je riba zunaj → zmaga
let reelStepUp   = 30;  // Koliko pikslov se kljuka premakne navzgor ob enem pritisku
let slipAmount   = 4;   // (rezervirano) Koliko bi kljuka zdrsnila nazaj ob spustitvi
let stepDuration = 150; // Trajanje ene animacije premika v milisekundah


/* =====================================================================
   FUNKCIJA: setHookByVector(dx, dy)
   =====================================================================
   Nastavi sliko kljuke glede na smer, v katero se premika.

   Parametra dx in dy sta razlika koordinat med dvema točkama:
   - dx > 0 → premik v desno
   - dx < 0 → premik v levo
   - dy > 0 → premik navzdol  (v SVG je y=0 zgoraj, y=484 spodaj!)
   - dy < 0 → premik navzgor

   Math.abs() vrne absolutno vrednost (brez predznaka), npr. Math.abs(-5) = 5
   Primerjamo |dx| in |dy|, da ugotovimo ali je premik bolj vodoravni ali navpičen.
   ===================================================================== */

function setHookByVector(dx, dy) {
  let slika; // Sem shranimo pot do slike

  if (Math.abs(dx) > Math.abs(dy)) {
    // Premik je bolj vodoravni (levo ali desno)
    if (dx >= 0) {
      slika = 'img/hook_desno.png'; // Kljuka gleda v desno
    } else {
      slika = 'img/hook_levo.png';  // Kljuka gleda v levo
    }
  } else {
    // Premik je bolj navpičen (gor ali dol)
    if (dy >= 0) {
      slika = 'img/hook_dol.png';  // Kljuka gleda navzdol
    } else {
      slika = 'img/hook_gor.png';  // Kljuka gleda navzgor
    }
  }

  hook.setAttribute('href', slika); // Zamenjamo sliko kljuke v HTML-ju
}


/* =====================================================================
   FUNKCIJA: setTunaByVector(dx, dy)
   =====================================================================
   Enako kot setHookByVector, samo nastavi sliko TUNE (ribe).
   Pokliče se, ko je riba ujeta in se premikamo nazaj ali navzgor.
   ===================================================================== */

function setTunaByVector(dx, dy) {
  let slika; // Sem shranimo pot do slike

  if (Math.abs(dx) > Math.abs(dy)) {
    // Premik je bolj vodoravni (levo ali desno)
    if (dx >= 0) {
      slika = 'img/tuna_desno.png'; // Tuna gleda v desno
    } else {
      slika = 'img/tuna_levo.png';  // Tuna gleda v levo
    }
  } else {
    // Premik je bolj navpičen (gor ali dol)
    if (dy >= 0) {
      slika = 'img/tuna_dol.png';  // Tuna gleda navzdol
    } else {
      slika = 'img/tuna_gor.png';  // Tuna gleda navzgor
    }
  }

  hook.setAttribute('href', slika); // Zamenjamo sliko kljuke/tune v HTML-ju
}


/* =====================================================================
   TABELA TOČK POTI: path
   =====================================================================
   Tabela vseh koordinat [x, y], skozi katere potuje kljuka.
   Kljuka gre od path[0] do path[1], potem do path[2], itd.
   Vsak par zaporednih točk je en "segment" (ravna daljica).

   Primer: [234, 9] pomeni x=234, y=9
   Koordinate so v pikslih znotraj SVG platna (484 x 484 px).
   ===================================================================== */

const path = [
  [234, 9],   [234, 14],  [250, 14],  [250, 62],  [186, 62],  [186, 94],  [170, 94],
  [170, 110], [154, 110], [154, 94],  [138, 94],  [138, 126], [122, 126], [122, 142],
  [58, 142],  [58, 158],  [90, 158],  [90, 174],  [122, 174], [122, 190], [138, 190],
  [138, 174], [154, 174], [154, 190], [186, 190], [186, 206], [298, 206], [298, 222],
  [282, 222], [282, 238], [266, 238], [266, 254], [298, 254], [298, 238], [314, 238],
  [314, 270], [282, 270], [282, 302], [266, 302], [266, 334], [218, 334], [218, 366],
  [202, 366], [202, 334], [186, 334], [186, 302], [170, 302], [170, 334], [138, 334],
  [138, 318], [154, 318], [154, 254], [122, 254], [122, 270], [106, 270], [106, 222],
  [42, 222],  [42, 270],  [58, 270],  [58, 254],  [74, 254],  [74, 286],  [90, 286],
  [90, 302],  [58, 302],  [58, 286],  [42, 286],  [42, 318],  [90, 318],  [90, 350],
  [106, 350], [106, 382], [138, 382], [138, 366], [154, 366], [154, 350], [170, 350],
  [170, 382], [154, 382], [154, 398], [170, 398], [170, 430], [186, 430], [186, 414],
  [234, 414], [234, 430], [202, 430], [202, 446], [170, 446], [170, 478], [186, 478],
  [186, 462], [202, 462], [202, 478], [234, 478], [234, 462], [250, 462], [250, 476]
];


/* =====================================================================
   TABELA KUMULATIVNIH DOLŽIN: cumLen
   =====================================================================
   cumLen[i] = skupna dolžina poti od začetka do točke i (v pikslih)

   Primer (izmišljene vrednosti):
   - cumLen[0] = 0    → na začetku smo prepotovali 0 px
   - cumLen[1] = 5    → od točke 0 do točke 1 je 5 px
   - cumLen[2] = 17   → od točke 0 do točke 2 je skupno 17 px
   - ...

   Dolžino vsakega segmenta izračunamo s Pitagorovim izrekom:
   razdalja = sqrt(dx² + dy²)

   To tabelo potrebujemo, da vemo koliko laksa (SVG črte) narisati.
   ===================================================================== */

const cumLen = [0]; // Začnemo z 0 (na točki 0 smo prepotovali 0 pikslov)

for (let i = 0; i < path.length - 1; i++) { // Gremo čez vse segmente poti
  const x1 = path[i][0];     // x koordinata trenutne točke
  const y1 = path[i][1];     // y koordinata trenutne točke
  const x2 = path[i + 1][0]; // x koordinata naslednje točke
  const y2 = path[i + 1][1]; // y koordinata naslednje točke

  const dx = x2 - x1; // Razlika v x smeri
  const dy = y2 - y1; // Razlika v y smeri

  const segment = Math.sqrt(dx * dx + dy * dy); // Pitagora: dolžina tega segmenta

  cumLen.push(cumLen[i] + segment); // Dodamo: prejšnja skupna dolžina + ta segment
}


/* =====================================================================
   MEHURČNO UREJANJE (BUBBLE SORT): mehurcnoUrejevanje(tabela)
   =====================================================================
   Algoritem za urejanje tabele od najmanjšega do največjega elementa.

   Kako deluje:
   - Gremo večkrat čez tabelo
   - Vsakič primerjamo dva sosednja elementa
   - Če je levi večji od desnega, ju zamenjamo (swap)
   - Po vsakem prehodu je največji element "zbublal" na konec

   Primer:
   Začetek:        [5, 3, 8, 1]
   Po 1. prehodu:  [3, 5, 1, 8]  ← 8 je na koncu
   Po 2. prehodu:  [3, 1, 5, 8]  ← 5 je na mestu
   Po 3. prehodu:  [1, 3, 5, 8]  ← urejeno!
   ===================================================================== */

function mehurcnoUrejevanje(tabela) {
  let n = tabela.length; // Število elementov v tabeli

  for (let i = 0; i < n - 1; i++) {       // Zunanja zanka: koliko prehodov naredimo
    for (let j = 0; j < n - i - 1; j++) { // Notranja zanka: primerjamo sosednje pare
                                           // (n - i - 1 ker zadnjih i elementov je že urejenih)
      if (tabela[j] > tabela[j + 1]) {     // Če je levi element večji od desnega
        let temp      = tabela[j];         // Shranimo levi element v začasno spremenljivko
        tabela[j]     = tabela[j + 1];     // Levi dobi vrednost desnega
        tabela[j + 1] = temp;              // Desni dobi staro vrednost levega → zamenjava
      }
    }
  }
}

mehurcnoUrejevanje(cumLen); // Uredimo tabelo kumulativnih dolžin z mehurčnim urejanjem


/* =====================================================================
   INICIALIZACIJA SVG POTI (STROKE-DASH TRIK)
   =====================================================================
   Nastavimo 3 SVG poti tako, da so na začetku popolnoma nevidne.
   Ko se kljuka premika, bomo postopoma "odkrivali" črto.

   strokeDasharray  = dolžina → SVG-ju povemo, da je črta en sam velik "pomišljaj"
   strokeDashoffset = dolžina → ta pomišljaj premaknemo stran → črta je skrita
   Ko zmanjšujemo offset → črta se začne pojavljati od začetka
   ===================================================================== */

for (let i = 0; i < svgPaths.length; i++) { // Gremo čez vse 3 SVG poti
  svgPaths[i].style.strokeDasharray  = totalLength; // Celotna dolžina = en velik pomišljaj
  svgPaths[i].style.strokeDashoffset = totalLength; // Na začetku skrijemo celotno črto
}


/* =====================================================================
   FUNKCIJA: setHookXY(x, y)
   =====================================================================
   Premakne sliko kljuke na koordinate (x, y) v SVG platnu.

   V SVG atributa x in y določata ZGORNJI LEVI KOT slike,
   zato odštejemo polovico velikosti, da je SREDIŠČE slike na (x, y).

   Primer: x=100, y=50, HOOK_SIZE=20
   → setAttribute('x', 100 - 10) = 90
   → setAttribute('y', 50 - 10)  = 40
   Slika je od (90,40) do (110,60), središče je točno (100,50) ✓

   Math.round() zaokroži na celo število (piksli so cela števila).
   ===================================================================== */

function setHookXY(x, y) {
  hook.setAttribute('x', Math.round(x - HOOK_SIZE / 2)); // Zgornji levi kot po x
  hook.setAttribute('y', Math.round(y - HOOK_SIZE / 2)); // Zgornji levi kot po y
}


/* =====================================================================
   FUNKCIJA: setAllPathOffsets(offset)
   =====================================================================
   Nastavi strokeDashoffset za vse 3 SVG poti hkrati (glow, main, shine).
   Manjši offset = več vidne črte = "laks" je bolj narisan.
   ===================================================================== */

function setAllPathOffsets(offset) {
  for (let i = 0; i < svgPaths.length; i++) { // Gremo čez vse 3 poti
    svgPaths[i].style.strokeDashoffset = offset; // Koliko črte je še skrite
  }
}


/* =====================================================================
   FUNKCIJA: updateStrokeByIndex(i)
   =====================================================================
   Posodobi vidno SVG črto (laks) glede na to, pri kateri točki
   poti se nahajamo (indeks i).

   Iz tabele cumLen preberemo skupno prepotovano dolžino do točke i
   in na tej osnovi izračunamo, koliko laksa naj bo vidnega.
   ===================================================================== */

function updateStrokeByIndex(i) {
  traveled = cumLen[i]; // Nastavimo skupno prepotovano dolžino

  // offset = koliko črte je še skrite
  // totalLength - traveled = koliko ostane skrito
  // Math.min prepreči negativen offset (če bi traveled presegel totalLength)
  const offset = totalLength - Math.min(traveled, totalLength);

  setAllPathOffsets(offset); // Posodobimo prikaz vseh 3 črt
}


/* =====================================================================
   FUNKCIJA: moveHook()
   =====================================================================
   Glavna animacijska funkcija. Kliče se znova in znova, dokler
   je animating == true.

   requestAnimationFrame(moveHook) pove brskalniku:
   "Pokliči moveHook pred naslednjim izrisovanjem zaslona (~60x/sekundo)."
   To je kot "while (animating) { ... }" v Javi, samo sinhronizirana
   z osveževanjem zaslona.

   Faze:
   1. Animacija ni aktivna → takoj končamo
   2. Igra na pavzi → čakamo (brez premika)
   3. Kljuka je na koncu poti → riba ujeta, preklopimo fazo
   4. Sicer → premaknemo kljuko naprej po poti
   ===================================================================== */

function moveHook() {
  if (!animating) return; // Animacija je bila ustavljena - končamo

  if (paused) {
    // Igra je na pavzi (Escape) - ne premikamo se,
    // ampak vseeno zahtevamo naslednji frame, da preverjamo kdaj bo pavza končana
    animationId = requestAnimationFrame(moveHook);
    return;
  }

  if (index >= path.length - 1 && !caught) {
    // Kljuka je prišla do zadnje točke poti - riba je ujeta!
    caught    = true;  // Označimo ulov
    animating = false; // Ustavimo samodejno premikanje naprej

    if (animationId) {
      cancelAnimationFrame(animationId); // Prekličemo naslednji frame
    }
    animationId = null;

    setTunaByVector(0, -1); // Tuna gleda navzgor (začetek vlečenja)

    if (zunanja) {
      zunanja.style.display = 'none'; // Skrijemo "zunanjo" ribo ob labirintu
    }
    if (reelBtn) {
      reelBtn.style.display = 'block'; // Prikažemo gumb mlinčka
    }

    phase = 'back'; // Preidemo v fazo vračanja po poti
    return;
  }

  // ---- PREMIKANJE NAPREJ PO POTI ----
  let remainingSpeed = speed; // Hitrost, ki jo še imamo v tem frame-u (px)

  // Premikamo se, dokler imamo preostalo hitrost in nismo na koncu poti
  while (remainingSpeed > 0 && index < path.length - 1) {
    const x1 = path[index][0];     // x začetne točke tega segmenta
    const y1 = path[index][1];     // y začetne točke tega segmenta
    const x2 = path[index + 1][0]; // x končne točke tega segmenta
    const y2 = path[index + 1][1]; // y končne točke tega segmenta

    const dx = x2 - x1; // Razlika po x
    const dy = y2 - y1; // Razlika po y

    const dist = Math.sqrt(dx * dx + dy * dy); // Dolžina tega segmenta (Pitagora)

    // step = koliko se premaknemo v tem koraku:
    // vzamemo manjše od (preostala hitrost) in (koliko segmenta je še ostalo)
    const step = Math.min(remainingSpeed, dist - progress);

    progress       += step; // Povečamo napredek znotraj segmenta
    remainingSpeed -= step; // Porabimo del hitrosti

    // t je delež (0.0 do 1.0): kako daleč smo na tem segmentu
    // t = 0.0 → na začetku segmenta, t = 1.0 → na koncu segmenta
    const t = progress / dist;

    setHookByVector(dx, dy); // Nastavimo smer slike kljuke

    // Izračunamo točno pozicijo kljuke z linearno interpolacijo
    // (mešanje začetne in končne točke glede na t)
    const px = x1 + dx * t; // Trenutni x položaj
    const py = y1 + dy * t; // Trenutni y položaj
    setHookXY(px, py);       // Premaknemo kljuko

    traveled += step; // Povečamo skupno prepotovano razdaljo

    // Posodobimo koliko laksa (SVG črte) je vidno
    const offset = totalLength - Math.min(traveled, totalLength);
    setAllPathOffsets(offset);

    if (progress >= dist) {
      // Prišli smo do konca tega segmenta
      progress = 0; // Reset napredka znotraj segmenta
      index++;      // Premaknemo se na naslednji segment
    }
  }

  // Zahtevamo naslednji frame - brskalnik spet pokliče moveHook
  animationId = requestAnimationFrame(moveHook);
}


/* =====================================================================
   FUNKCIJA: animatePointToPoint(fromI, toI, done)
   =====================================================================
   Gladko animira premik kljuke od točke fromI do točke toI v tabeli path.
   Ko animacija konča, pokliče funkcijo "done" (povratni klic).

   Parametri:
   - fromI: indeks začetne točke v tabeli path
   - toI:   indeks ciljne točke v tabeli path
   - done:  funkcija, ki se pokliče ko animacija konča

   Linearna interpolacija: vrednost = začetek + (konec - začetek) * t
   kjer t gre od 0.0 (začetek) do 1.0 (konec).

   performance.now() vrne čas v ms od zagona brskalnika.
   ===================================================================== */

function animatePointToPoint(fromI, toI, done) {
  stepLock = true; // Zaklenemo, da ne bi začeli nove animacije medtem

  const fx = path[fromI][0]; // Začetni x
  const fy = path[fromI][1]; // Začetni y
  const tx = path[toI][0];   // Ciljni x
  const ty = path[toI][1];   // Ciljni y

  const start = performance.now(); // Shranimo čas začetka animacije

  function tick(now) { // "now" je trenutni čas v ms, poda ga requestAnimationFrame
    // t gre od 0 do 1, Math.min zagotovi, da ne preseže 1
    const t = Math.min(1, (now - start) / stepDuration);

    // Linearna interpolacija: določimo kje je kljuka med fromI in toI
    const x = fx + (tx - fx) * t;
    const y = fy + (ty - fy) * t;
    setHookXY(x, y); // Premaknemo kljuko

    // Izračunamo koliko laksa naj bo narisanega
    const lineLen = cumLen[fromI] + (cumLen[toI] - cumLen[fromI]) * t;
    const offset  = totalLength - Math.min(lineLen, totalLength);
    setAllPathOffsets(offset); // Posodobimo vidno črto

    if (t < 1) {
      requestAnimationFrame(tick); // Animacija še teče - zahtevamo naslednji frame
    } else {
      // Animacija je končana
      index = toI;                // Nastavimo indeks na ciljno točko
      updateStrokeByIndex(index); // Popravimo natančen prikaz laksa
      stepLock = false;           // Odklenemo za naslednji korak
      if (done) {
        done(); // Pokličemo povratno funkcijo, če je bila podana
      }
    }
  }

  requestAnimationFrame(tick); // Zaženemo animacijo
}


/* =====================================================================
   FUNKCIJA: backOneSegmentSmooth()
   =====================================================================
   Premakne kljuko (z ujeto ribo) EN SEGMENT NAZAJ po poti.
   Kliče se, ko drži mlinček in je faza 'back'.

   Ko index doseže 0 (začetek poti), preklopimo v fazo 'up'
   (kljuka gre navzgor ven iz labirinta).
   ===================================================================== */

function backOneSegmentSmooth() {
  if (stepLock) return; // Prejšnji korak še teče - ne začnemo novega

  if (index <= 0) {
    // Smo na začetku poti - ne moremo več nazaj, gremo navzgor
    phase = 'up';
    setTunaByVector(0, -1); // Tuna gleda navzgor
    return;
  }

  // Izračunamo smer premika NAZAJ (od trenutne do prejšnje točke)
  const x1 = path[index][0];     // x trenutne točke
  const y1 = path[index][1];     // y trenutne točke
  const x0 = path[index - 1][0]; // x prejšnje točke
  const y0 = path[index - 1][1]; // y prejšnje točke

  setTunaByVector(x0 - x1, y0 - y1); // Nastavimo smer tune (gleda tja, kamor gremo)

  // Animiramo premik en segment nazaj
  animatePointToPoint(index, index - 1, function () {
    // Ta koda se izvede, ko animacija konča
    if (index <= 0) {
      // Zdaj smo na začetku - preklopimo v navzgor
      phase = 'up';
      setTunaByVector(0, -1);
    }
  });
}


/* =====================================================================
   FUNKCIJA: upOneStepSmooth()
   =====================================================================
   Premakne kljuko (z ujeto ribo) NAVZGOR za en korak (reelStepUp pikslov).
   Kliče se, ko drži mlinček in je faza 'up'.

   Ko kljuka doseže ciljno višino (reelTargetY), je igra zmagana.

   OPOMBA: v SVG je y = 0 ZGORAJ, y = 484 SPODAJ.
   Torej "navzgor" pomeni manjšo vrednost y!
   ===================================================================== */

function upOneStepSmooth() {
  if (stepLock) return; // Prejšnji korak še teče
  stepLock = true;      // Zaklenemo

  setTunaByVector(0, -1); // Tuna gleda navzgor

  const start = performance.now(); // Začetni čas animacije

  // parseFloat pretvori besedilo v decimalno число (npr. "40.5" → 40.5)
  const y0 = parseFloat(hook.getAttribute('y')); // Trenutni y zgornjega levega kota kljuke

  // Ciljni y: reelStepUp pikslov višje (manjša vrednost = višje v SVG)
  let target = y0 - reelStepUp;

  function tick(now) { // Funkcija za vsak frame premika navzgor
    const t = Math.min(1, (now - start) / stepDuration); // Delež animacije (0 do 1)

    // Linearna interpolacija y koordinate
    const y = y0 + (target - y0) * t;
    hook.setAttribute('y', y); // Premaknemo kljuko navzgor

    if (t < 1) {
      requestAnimationFrame(tick); // Animacija še teče
    } else {
      // Korak je končan
      stepLock = false;

      const yNow = parseFloat(hook.getAttribute('y')); // Preberemo končni y

      if (yNow <= reelTargetY) {
        // Kljuka je dovolj visoko - ZMAGA!
        hook.setAttribute('y', reelTargetY); // Postavimo natančno na ciljno višino
        animating = false;  // Ustavimo animacijo
        phase     = 'idle'; // Faza nazaj na idle
        stepLock  = false;
        showWinPopup();     // Pokažemo okno zmage
      }
    }
  }

  requestAnimationFrame(tick); // Zaženemo animacijo navzgor
}


/* =====================================================================
   FUNKCIJA: handleInputStep()
   =====================================================================
   Izvede en korak vlečenja glede na trenutno fazo igre.
   Kliče se ob vsakem "koraku" mlinčka.
   ===================================================================== */

function handleInputStep() {
  if (!caught) return; // Riba še ni ujeta - ne moremo vlečiti

  if (phase === 'back') {
    backOneSegmentSmooth(); // Vračamo se po poti
  } else if (phase === 'up') {
    upOneStepSmooth(); // Vlečemo navzgor
  }
}


/* =====================================================================
   FUNKCIJA: rotateReelOnce()
   =====================================================================
   Zavrti sliko mlinčka za 360 stopinj (en polni obrat).
   Vsak klic doda 360° k skupni rotaciji.
   CSS transform: rotate() opravi dejansko vrtenje slike.
   ===================================================================== */

function rotateReelOnce() {
  reelRotation += 360; // Dodamo en polni obrat
  reelImg.style.transform = 'rotate(' + reelRotation + 'deg)'; // Zavrtimo sliko
}


/* =====================================================================
   FUNKCIJA: startReeling()
   =====================================================================
   Začne kontinuirano vlečenje ribe, dokler držimo gumb mlinčka.

   setInterval(funkcija, čas) je "timer":
   vsake "čas" milisekund pokliče podano funkcijo.
   ===================================================================== */

function startReeling() {
  if (Swal.isVisible()) return;                          // Popup je odprt - ne vlečemo
  if (!caught) return;                                   // Riba ni ujeta - ne vlečemo
  if (phase !== 'back' && phase !== 'up') return;        // Napačna faza
  if (reelHoldInterval) return;                          // Interval že teče - ne podvajamo

  handleInputStep(); // Takoj naredimo prvi korak
  rotateReelOnce();  // Takoj zavrtimo mlinček

  // Nastavimo ponavljajoči interval za čas, ko držimo gumb
  reelHoldInterval = setInterval(function () {
    handleInputStep(); // Vsak interval: en korak vlečenja
    rotateReelOnce();  // Vsak interval: en obrat mlinčka
  }, stepDuration + 20); // Čakamo malo dlje kot traja animacija enega koraka
}


/* =====================================================================
   FUNKCIJA: stopReeling()
   =====================================================================
   Ustavi vlečenje ribe, ko spustimo gumb mlinčka.
   clearInterval zaustavi interval, ki smo ga ustvarili s setInterval.
   ===================================================================== */

function stopReeling() {
  if (reelHoldInterval) {
    clearInterval(reelHoldInterval); // Ustavimo interval
    reelHoldInterval = null;         // Počistimo spremenljivko
  }
}


/* =====================================================================
   FUNKCIJA: resetRound()
   =====================================================================
   Ponastavi igro na začetno stanje:
   - kljuka gre nazaj na start
   - laks se skrije
   - vse spremenljivke stanja se ponastavijo
   ===================================================================== */

function resetRound() {
  stopReeling(); // Najprej ustavimo morebitno tekoče vlečenje

  // Ponastavimo vse spremenljivke stanja
  caught    = false;
  paused    = false;
  phase     = 'idle';
  animating = false;
  stepLock  = false;
  progress  = 0;

  if (reelBtn) {
    reelBtn.style.display = 'none'; // Skrijemo gumb mlinčka
  }
  if (animationId) {
    cancelAnimationFrame(animationId); // Ustavimo tekoči frame (če obstaja)
  }
  animationId = null;

  if (zunanja) {
    zunanja.style.display = 'flex'; // Spet pokažemo zunanjo ribo
  }

  hook.setAttribute('href', 'img/hook_dol.png'); // Kljuka gleda navzdol (začetna slika)

  // Postavimo kljuko na začetno točko poti
  index    = 0;
  traveled = 0;

  const startX = path[0][0]; // x prve točke v poti
  const startY = path[0][1]; // y prve točke v poti
  setHookXY(startX, startY); // Premaknemo kljuko na start

  setAllPathOffsets(totalLength); // Skrijemo celotno SVG črto (laks ni narisan)
}


/* =====================================================================
   FUNKCIJA: startGame()
   =====================================================================
   Začne novo igro:
   1. Ponastavi vse na začetno stanje
   2. Vklopi animacijo
   3. Zažene premikanje kljuke naprej po labirintu
   ===================================================================== */

function startGame() {
  resetRound();         // Ponastavimo
  paused    = false;    // Prepričamo se, da ni pavze
  animating = true;     // Vklopimo animacijo
  phase     = 'forward'; // Faza: kljuka gre naprej po labirintu
  moveHook();           // Zaženemo animacijsko zanko
}


/* =====================================================================
   FUNKCIJA: showInstructionsPopup()
   =====================================================================
   Prikaže popup z navodili za igro.
   Uporablja knjižnico SweetAlert2 (Swal) - to je že vključena v HTML.
   ===================================================================== */

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
    showDenyButton:     true,
    confirmButtonText:  'Start',
    denyButtonText:     'Back',
    confirmButtonColor: 'rgb(35, 184, 233)',
    denyButtonColor:    'rgb(35, 184, 233)',
    allowOutsideClick:  false,
    allowEscapeKey:     false,
    focusConfirm:       false
  }).then(function (result) {
    // .then() se izvede, ko uporabnik zapre popup
    if (result.isConfirmed) {
      startGame(); // Pritisnili so "Start"
    } else if (result.isDenied) {
      window.dispatchEvent(new Event('load')); // Pritisnili so "Back" - nazaj na dobrodošlico
    }
  });
}


/* =====================================================================
   FUNKCIJA: showWinPopup()
   =====================================================================
   Prikaže popup za zmago, ko je riba uspešno izvlečena.
   ===================================================================== */

function showWinPopup() {
  Swal.fire({
    title:              'Congratulations!',
    text:               'You caught the fish!',
    icon:               'success',
    showDenyButton:     true,
    confirmButtonText:  'Catch more',
    denyButtonText:     'Instructions',
    confirmButtonColor: 'rgb(35, 184, 233)',
    denyButtonColor:    'rgb(35, 184, 233)',
    allowOutsideClick:  false,
    allowEscapeKey:     false,
    focusConfirm:       false
  }).then(function (result) {
    if (result.isConfirmed) {
      startGame(); // Igramo znova
    } else if (result.isDenied) {
      showInstructionsPopup(); // Gremo na navodila
    }
  });
}


/* =====================================================================
   DOGODEK: window 'load'
   =====================================================================
   Ko se stran popolnoma naloži, se ta koda izvede.
   Prikaže se pozdravni popup z možnostjo Start ali Navodila.

   addEventListener('load', ...) je kot registracija posluša za
   dogodek "stran je naložena".
   ===================================================================== */

window.addEventListener('load', function () {
  Swal.fire({
    title: 'Welcome to fishing maze',
    html: `
      <div style="line-height:1.5; text-align:center;">
        <p>Choose an option to read the instruction or to start the game</p>
      </div>
    `,
    width:      '30vw',                      // Širina popupa (30% širine okna)
    background: '#d9d9d9',                   // Barva ozadja popupa
    backdrop:   'rgba(128, 128, 128, 0.75)', // Polprozorno ozadje za popupom
    didOpen: function () {
      // Ta koda se izvede takoj, ko se popup odpre
      const popup = Swal.getPopup();
      if (popup) {
        popup.style.height    = '30vh';
        popup.style.maxHeight = '30vh';
        popup.style.maxWidth  = '30vw';
        popup.style.margin    = '0';
        popup.style.padding   = '20px';
        popup.style.boxSizing = 'border-box';
        popup.style.overflowY = 'auto'; // Drsnik, če je vsebina previsoka
      }
    },
    showDenyButton:     true,
    confirmButtonText:  'Start',
    denyButtonText:     'Instructions',
    confirmButtonColor: 'rgb(35, 184, 233)',
    denyButtonColor:    'rgb(35, 184, 233)',
    allowOutsideClick:  false,
    allowEscapeKey:     false,
    focusConfirm:       false
  }).then(function (result) {
    if (result.isConfirmed) {
      startGame(); // Pritisnili so "Start"
    } else if (result.isDenied) {
      showInstructionsPopup(); // Pritisnili so "Instructions"
    }
  });
});


/* =====================================================================
   DOGODKI NA GUMBU MLINČKA (reelBtn)
   =====================================================================
   addEventListener doda "poslušalca" na gumb - reagiramo na klike in dotike.
   To je kot dodajanje ActionListenerja gumbu v Javi Swing.

   e.preventDefault()  → preprečimo privzeto obnašanje brskalnika (npr. scroll)
   e.stopPropagation() → preprečimo, da bi se klik "razširil" na starše elemente
   ===================================================================== */

// Ko pritisnemo gumb z miško (začetek pritiska - še ne spustimo)
reelBtn.addEventListener('mousedown', function (e) {
  e.preventDefault();  // Preprečimo označevanje besedila itd.
  e.stopPropagation(); // Ne dovolimo širjenja
  startReeling();      // Začnemo vlečenje
});

// Ko se dotaknemo gumba na mobilnem zaslonu
reelBtn.addEventListener('touchstart', function (e) {
  e.preventDefault(); // Preprečimo scroll strani ob dotiku
  startReeling();     // Začnemo vlečenje
}, { passive: false }); // passive: false je POTREBNO, da preventDefault deluje na touch

// Ko enkrat kliknemo gumb (en klik brez držanja)
reelBtn.addEventListener('click', function (e) {
  e.preventDefault();  // Preprečimo privzeto obnašanje
  e.stopPropagation(); // Ne dovolimo širjenja
  rotateReelOnce();    // Zavrtimo mlinček enkrat
  handleInputStep();   // En korak vlečenja
});


/* =====================================================================
   DOGODKI ZA USTAVITEV VLEČENJA
   =====================================================================
   Ko spustimo miško ali dotik (kjerkoli na strani), ustavimo vlečenje.
   ===================================================================== */

document.addEventListener('touchend',    stopReeling); // Spustili smo dotik
document.addEventListener('touchcancel', stopReeling); // Dotik je bil prekinjen
document.addEventListener('mouseup',     stopReeling); // Spustili smo gumb miške
document.addEventListener('mouseleave',  stopReeling); // Miška je zapustila okno brskalnika


/* =====================================================================
   DOGODEK: tipkovnica (keydown)
   =====================================================================
   Reagiramo na pritisk tipke Escape za pavzo igre.
   Pavza deluje samo med fazo 'forward' (kljuka gre naprej po poti).
   ===================================================================== */

document.addEventListener('keydown', function (e) {
  if (e.code === 'Escape') {         // Je bila pritisnjena tipka Escape?
    if (Swal.isVisible()) return;    // Popup je odprt - ne pavziramo
    if (phase !== 'forward') return; // Pavza deluje samo med premikanjem naprej
    paused = !paused;                // Preklopimo pavzo (true → false ali false → true)
  }
});


/* =====================================================================
   DOGODEK: klik na zunanjo ribo (zunanja)
   =====================================================================
   Ko kliknemo sliko ribe ob labirintu, se prikaže popup s podatki
   o avtorju (krediti).
   ===================================================================== */

zunanja.addEventListener('click', function (e) {
  e.preventDefault();  // Preprečimo privzeto obnašanje
  e.stopPropagation(); // Ne dovolimo širjenja klika

  Swal.fire({
    title: 'Credits',
    html: `
      <div style="text-align:center; line-height:1.6">
        <p>Tadej Humar</p>
        <p>2025/26</p>
      </div>
    `,
    confirmButtonText:  'OK',
    confirmButtonColor: 'rgb(35, 184, 233)',
    focusConfirm:       false
  });
});
