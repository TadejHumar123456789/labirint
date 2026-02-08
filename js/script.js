const hook = document.querySelector('.hook');
const startBtn = document.getElementById('startBtn');
const resetBtn = document.getElementById('reset');

const svgPath = document.querySelector('.path');
const totalLength = svgPath.getTotalLength();

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
const speed = 2; // pixels per frame
let animating = false;
let animationId = null;

function moveHook() {
 if (index >= path.length - 1) {
  const [endX, endY] = path[path.length - 1];
  const hookSize = 20;

  hook.setAttribute('x', endX - hookSize / 2);
  hook.setAttribute('y', endY - hookSize / 2);

  svgPath.style.strokeDashoffset = 0; // fully drawn
  animating = false;
  return;
}


  const [x1, y1] = path[index];
  const [x2, y2] = path[index + 1];

  const dx = x2 - x1;
  const dy = y2 - y1;
  const distance = Math.sqrt(dx * dx + dy * dy);

  progress += speed;
  traveled += speed; // 👈 track total movement

  if (progress >= distance) {
    progress = 0;
    index++;
  }
	

  const t = progress / distance;
  const newX = x1 + dx * t;
  const newY = y1 + dy * t;


 const hookSize = 20;

hook.setAttribute('x', newX - hookSize / 2);
hook.setAttribute('y', newY - hookSize / 2);
 



  // 👇 reveal path based on hook distance
  const draw = Math.min(traveled, totalLength);
  svgPath.style.strokeDashoffset = totalLength - draw;

  if (animating) animationId = requestAnimationFrame(moveHook);
}


startBtn.addEventListener('click', () => {
  if (!animating) {
    index = 0;
    progress = 0;
    animating = true;
    moveHook();
  }
});

resetBtn.addEventListener('click', () => {
  animating = false;
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
