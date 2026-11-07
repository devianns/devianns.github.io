const menuButton = document.querySelector('.menu-toggle');
const siteNav = document.querySelector('#site-nav');

if (menuButton && siteNav) {
  menuButton.addEventListener('click', () => {
    const isOpen = menuButton.getAttribute('aria-expanded') === 'true';
    menuButton.setAttribute('aria-expanded', String(!isOpen));
    siteNav.classList.toggle('is-open', !isOpen);
    menuButton.querySelector('.sr-only').textContent = isOpen ? '메뉴 열기' : '메뉴 닫기';
  });

  siteNav.addEventListener('click', (event) => {
    if (event.target.closest('a')) {
      menuButton.setAttribute('aria-expanded', 'false');
      menuButton.querySelector('.sr-only').textContent = '메뉴 열기';
      siteNav.classList.remove('is-open');
    }
  });
}

const cube = document.querySelector('#archive-cube');
const scene = document.querySelector('.cube-scene');
const cubeCaption = document.querySelector('#cube-caption');
const cubeCaptionTitle = document.querySelector('#cube-caption-title');
const cubeIndex = document.querySelector('#cube-index');
const faces = [...document.querySelectorAll('.cube-face[data-face]')];
let activeFace = 0;
let yaw = -45;
let pitch = -35;
let dragState = null;
let inertiaFrame = 0;
let dragFrame = 0;
let pendingDragEvent = null;
let suppressFaceClick = false;
let clickSuppressionTimer = 0;

function renderCube() {
  if (!cube) return;
  cube.style.setProperty('--cube-turn', `${yaw}deg`);
  cube.style.setProperty('--cube-pitch', `${pitch}deg`);
  updateFacingFace();
}

function updateFaceCaption(index) {
  if (!faces.length) return;
  activeFace = ((index % faces.length) + faces.length) % faces.length;
  if (cubeCaption) cubeCaption.textContent = faces[activeFace].dataset.face;
  if (cubeCaptionTitle) cubeCaptionTitle.textContent = faces[activeFace].dataset.pageTitle || '';
  if (cubeIndex) cubeIndex.textContent = String(activeFace + 1).padStart(2, '0');
}

function updateFacingFace() {
  const x = yaw * Math.PI / 180;
  const y = pitch * Math.PI / 180;
  const cosX = Math.cos(y);
  const sinX = Math.sin(y);
  const cosY = Math.cos(x);
  const sinY = Math.sin(x);
  const facing = [cosX * cosY, -cosX * sinY, -cosX * cosY, cosX * sinY, -sinX, sinX];
  const visibleFace = facing.indexOf(Math.max(...facing));
  if (visibleFace !== activeFace) updateFaceCaption(visibleFace);
}

function rotateCube(deltaYaw, deltaPitch) {
  if (!cube) return;
  cancelAnimationFrame(inertiaFrame);
  cube.classList.remove('is-dragging', 'is-spinning');
  yaw += deltaYaw;
  pitch += deltaPitch;
  renderCube();
}

scene?.addEventListener('keydown', (event) => {
  if (event.key === 'ArrowLeft') {
    event.preventDefault();
    rotateCube(90, 0);
  } else if (event.key === 'ArrowRight') {
    event.preventDefault();
    rotateCube(-90, 0);
  } else if (event.key === 'ArrowUp') {
    event.preventDefault();
    rotateCube(0, 90);
  } else if (event.key === 'ArrowDown') {
    event.preventDefault();
    rotateCube(0, -90);
  }
});

scene?.addEventListener('pointerdown', (event) => {
  if ((event.pointerType === 'mouse' && event.button !== 0) || event.isPrimary === false || !cube) return;
  try { (event.target.closest('.cube-face') || scene).setPointerCapture(event.pointerId); } catch { /* The pointer may already have been cancelled. */ }
  cancelAnimationFrame(inertiaFrame);
  cancelAnimationFrame(dragFrame);
  dragFrame = 0;
  pendingDragEvent = null;
  cube.classList.remove('is-spinning');
  cube.classList.add('is-dragging');
  dragState = {
    pointerId: event.pointerId,
    startX: event.clientX,
    startY: event.clientY,
    lastX: event.clientX,
    lastY: event.clientY,
    lastTime: performance.now(),
    moved: false,
    velocityX: 0,
    velocityY: 0,
  };
});

function applyDrag(event) {
  if (!dragState || !event || event.pointerId !== dragState.pointerId) return;
  const now = performance.now();
  const dx = event.clientX - dragState.lastX;
  const dy = event.clientY - dragState.lastY;
  const elapsed = Math.max(1, now - dragState.lastTime);
  const verticalDelta = -dy * .42;
  yaw += dx * .42;
  pitch += verticalDelta;
  dragState.velocityX = dragState.velocityX * .6 + (dx * .42 / elapsed) * .4;
  dragState.velocityY = dragState.velocityY * .6 + (verticalDelta / elapsed) * .4;
  dragState.lastX = event.clientX;
  dragState.lastY = event.clientY;
  dragState.lastTime = now;
  renderCube();
}

document.addEventListener('pointermove', (event) => {
  if (!dragState || event.pointerId !== dragState.pointerId) return;
  if (Math.hypot(event.clientX - dragState.startX, event.clientY - dragState.startY) > 4) {
    dragState.moved = true;
    event.preventDefault();
  }
  pendingDragEvent = event;
  if (dragFrame) return;
  dragFrame = requestAnimationFrame(() => {
    dragFrame = 0;
    const latestEvent = pendingDragEvent;
    pendingDragEvent = null;
    applyDrag(latestEvent);
  });
});

function finishDrag(event) {
  if (!dragState || (event && event.pointerId !== dragState.pointerId)) return;
  if (dragFrame) {
    cancelAnimationFrame(dragFrame);
    dragFrame = 0;
    applyDrag(pendingDragEvent);
    pendingDragEvent = null;
  }
  const released = dragState;
  dragState = null;
  cube?.classList.remove('is-dragging');
  if (!released.moved) {
    cube?.classList.remove('is-spinning');
    return;
  }

  suppressFaceClick = true;
  window.clearTimeout(clickSuppressionTimer);
  clickSuppressionTimer = window.setTimeout(() => { suppressFaceClick = false; }, 450);
  cube?.classList.add('is-spinning');
  let velocityX = released.velocityX;
  let velocityY = released.velocityY;
  let lastFrame = performance.now();
  let elapsedTotal = 0;
  const coast = (time) => {
    const dt = Math.min(40, time - lastFrame);
    lastFrame = time;
    elapsedTotal += dt;
    yaw += velocityX * dt;
    pitch += velocityY * dt;
    const friction = Math.exp(-dt / 760);
    velocityX *= friction;
    velocityY *= friction;
    renderCube();
    if (elapsedTotal < 2350 && (Math.abs(velocityX) > .012 || Math.abs(velocityY) > .012)) {
      inertiaFrame = requestAnimationFrame(coast);
      return;
    }

    cube.classList.remove('is-spinning');
    renderCube();
  };
  inertiaFrame = requestAnimationFrame(coast);
}

document.addEventListener('pointerup', finishDrag);
document.addEventListener('pointercancel', finishDrag);
scene?.addEventListener('click', (event) => {
  if (!suppressFaceClick) return;
  event.preventDefault();
  event.stopImmediatePropagation();
}, true);
scene?.addEventListener('contextmenu', (event) => event.preventDefault());

document.addEventListener('dragstart', (event) => event.preventDefault());
document.addEventListener('selectstart', (event) => event.preventDefault());

const year = document.querySelector('#year');
if (year) year.textContent = String(new Date().getFullYear());
