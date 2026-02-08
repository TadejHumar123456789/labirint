const hook = document.querySelector('.hook');
const startBtn = document.getElementById('startBtn');
const resetBtn = document.getElementById('reset');

const svgPath = document.querySelector('.path');
const totalLength = svgPath.getTotalLength();

const HOOK_IMG = '../img/hook.png';
const TUNA_IMG = '../img/tuna.png';

let caught = false;
let reelY = null;


svgPath.style.strokeDasharray = totalLength;
svgPath.style.strokeDashoffset = totalLength;
// Path points
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

let traveled = 0;
let index = 0;
let progress = 0;
let speed = 2; // pixels per frame
let animating = false;
let animationId = null;

function moveHook() {
  if (!animating) return;

 if (index >= path.length - 1 && !caught) {
  caught = true;
hook.setAttribute('href', '../img/tuna.png');
reelBack(); // move along path back


  // start reeling upward from current Y
  reelY = parseFloat(hook.getAttribute('y'));

  requestAnimationFrame(reelUp);
  return;
}


  const hookSize = 20;

  let remainingSpeed = speed;

  while (remainingSpeed > 0 && index < path.length - 1) {
    const [x1, y1] = path[index];
    const [x2, y2] = path[index + 1];

    const dx = x2 - x1;
    const dy = y2 - y1;
    const distance = Math.hypot(dx, dy);

    const step = Math.min(remainingSpeed, distance - progress);
    progress += step;
    remainingSpeed -= step;

    const t = progress / distance;

    const newX = x1 + dx * t;
    const newY = y1 + dy * t;

    hook.setAttribute('x', Math.round(newX - hookSize / 2));
    hook.setAttribute('y', Math.round(newY - hookSize / 2));

    traveled += step;
    svgPath.style.strokeDashoffset = totalLength - Math.min(traveled, totalLength);

    if (progress >= distance) {
      progress = 0;
      index++;
    }
  }

  animationId = requestAnimationFrame(moveHook);
}

function reelBack() {
  if (index <= 0 && progress <= 0) {
    animating = false;
    return;
  }

  const hookSize = 20;
  let remainingSpeed = speed * 1.5; // can adjust speed

  while (remainingSpeed > 0 && (index > 0 || progress > 0)) {
    const [x1, y1] = path[index];
    const [x0, y0] = path[index - 1] || path[0];

    const dx = x0 - x1;
    const dy = y0 - y1;
    const distance = Math.hypot(dx, dy);

    const step = Math.min(remainingSpeed, distance - progress);
    progress += step;
    remainingSpeed -= step;

    const t = progress / distance;
    const newX = x1 + dx * t;
    const newY = y1 + dy * t;

    hook.setAttribute('x', Math.round(newX - hookSize / 2));
    hook.setAttribute('y', Math.round(newY - hookSize / 2));

    traveled -= step;
    svgPath.style.strokeDashoffset = totalLength - Math.max(traveled, 0);

    if (progress >= distance) {
      progress = 0;
      index--;
    }
  }

  requestAnimationFrame(reelBack);
}



startBtn.addEventListener('click', () => {
  if (!animating) {
    index = 0;
    progress = 0;
	traveled = 0;
    animating = true;
    moveHook();
  }
});

resetBtn.addEventListener('click', () => {
  animating = false;
  caught = false;
hook.setAttribute('href', '../img/hook.png');

  if (animationId) cancelAnimationFrame(animationId);

  index = 0;
  progress = 0;
  traveled = 0;

  const [startX, startY] = path[0];
  
  const hookSize = 20;
hook.setAttribute('x', startX - hookSize / 2);
hook.setAttribute('y', startY - hookSize / 2);


  svgPath.style.strokeDashoffset = totalLength; // 👈 hide path again
});

const settingsBtn = document.querySelector('.instruction');

settingsBtn.addEventListener('click', () => {
  Swal.fire({
    title: 'Settings',
    html: `
      <label for="speedRange">
        Speed: <strong><span id="speedValue">${speed}</span></strong>
      </label>
      <input 
        type="range" 
        id="speedRange" 
        min="0.5" 
        max="10" 
        step="0.5" 
        value="${speed}"
        style="width:100%; margin-top:10px;"
      />
    `,
    confirmButtonText: 'Done',
	confirmButtonColor: 'rgb(35, 184, 233)',
    didOpen: () => {
      const speedRange = document.getElementById('speedRange');
      const speedValue = document.getElementById('speedValue');

      speedRange.addEventListener('input', () => {
        speed = parseFloat(speedRange.value);
        speedValue.textContent = speed;
      });
    }
  });
});

