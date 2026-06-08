// Always start at the very top — disable browser scroll restoration
if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
window.scrollTo(0, 0);

const isMobile = window.innerWidth <= 768 || ('ontouchstart' in window && window.innerWidth < 1024);
if (isMobile) document.getElementById('loader').style.cssText = 'display:none!important';

// ── Constants ──────────────────────────────────────────────────────────────
const FRAME_COUNT = 122;
const FRAME_EXT = 'jpg';
const FRAME_SPEED = 1.45;
const IMAGE_SCALE = 1.0;
const STATS_ENTER = 0.83;
const STATS_LEAVE = 0.99;
const MARQUEE_ENTER = 0.10;
const MARQUEE_LEAVE = 0.71;

// ── DOM refs ───────────────────────────────────────────────────────────────
const loader      = document.getElementById('loader');
const loaderBar   = document.getElementById('loader-bar');
const loaderPct   = document.getElementById('loader-percent');
const canvas      = document.getElementById('canvas');
const canvasWrap  = document.getElementById('canvas-wrap');
const heroSection = document.getElementById('hero');
const scrollEl    = document.getElementById('scroll-container');
const darkOverlay = document.getElementById('dark-overlay');
const marqueeWrap = document.getElementById('marquee');
const ctx         = canvas.getContext('2d');

// ── State ──────────────────────────────────────────────────────────────────
const frames = new Array(FRAME_COUNT).fill(null);
let loadedCount = 0;
let currentFrame = 0;
let mobileZoom = 2.5;
let bgColor = 'rgb(239,237,238)';

// ── Canvas sizing ──────────────────────────────────────────────────────────
function resizeCanvas() {
  const dpr = window.devicePixelRatio || 1;
  canvas.width  = window.innerWidth  * dpr;
  canvas.height = window.innerHeight * dpr;
  canvas.style.width  = window.innerWidth  + 'px';
  canvas.style.height = window.innerHeight + 'px';
  ctx.scale(dpr, dpr);
  drawFrame(currentFrame);
}

// ── Sample bg from frame edge ──────────────────────────────────────────────
function sampleBgColor(img) {
  const tmpC = document.createElement('canvas');
  tmpC.width = img.naturalWidth; tmpC.height = img.naturalHeight;
  const tmpX = tmpC.getContext('2d');
  tmpX.drawImage(img, 0, 0);
  // Sample the very top-left pixel — always background for this video
  const px = tmpX.getImageData(0, 0, 1, 1).data;
  bgColor = `rgb(${px[0]},${px[1]},${px[2]})`;
}

// ── Draw frame ─────────────────────────────────────────────────────────────
function drawFrame(idx) {
  let img = frames[idx];
  if (!img) {
    for (let d = 1; d < 6; d++) {
      if (frames[idx - d]) { img = frames[idx - d]; break; }
      if (frames[idx + d]) { img = frames[idx + d]; break; }
    }
  }
  if (!img) return;
  const cw = window.innerWidth, ch = window.innerHeight;
  const iw = img.naturalWidth, ih = img.naturalHeight;
  const scale = (isMobile ? (cw / iw) * mobileZoom : Math.max(cw / iw, ch / ih)) * IMAGE_SCALE;
  const dw = iw * scale, dh = ih * scale;
  const dx = (cw - dw) / 2, dy = (ch - dh) / 2;
  ctx.imageSmoothingEnabled  = true;
  ctx.imageSmoothingQuality  = isMobile ? 'medium' : 'high';
  ctx.fillStyle = bgColor;
  ctx.fillRect(0, 0, cw, ch);
  ctx.drawImage(img, dx, dy, dw, dh);
}

// ── Preloader ──────────────────────────────────────────────────────────────
function loadFrame(i) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      frames[i] = img;
      loadedCount++;
      if (i % 20 === 0) sampleBgColor(img);
      const pct = Math.round((loadedCount / FRAME_COUNT) * 100);
      loaderBar.style.width = pct + '%';
      loaderPct.textContent = pct + '%';
      resolve();
    };
    img.onerror = resolve;
    img.src = `frames/frame_${String(i + 1).padStart(4, '0')}.${FRAME_EXT}`;
  });
}

async function preload() {
  if (isMobile) {
    loader.classList.add('hidden');
    // Load every 2nd frame in background — drawFrame handles gaps
    const evenFrames = Array.from({ length: Math.ceil(FRAME_COUNT / 2) }, (_, i) => loadFrame(i * 2));
    initScene();
    await Promise.all(evenFrames);
    return;
  }

  // Phase 1: first 10 frames fast
  const phase1 = Array.from({ length: 10 }, (_, i) => loadFrame(i));
  await Promise.all(phase1);

  // Phase 2: rest in background
  const phase2 = Array.from({ length: FRAME_COUNT - 10 }, (_, i) => loadFrame(i + 10));
  await Promise.all(phase2);

  loader.classList.add('hidden');
  initScene();
}

// ── Lenis smooth scroll ────────────────────────────────────────────────────
let lenis;
function initLenis() {
  if (isMobile) {
    // On mobile, skip Lenis entirely — native scroll is stable and ScrollTrigger handles it
    return;
  }
  lenis = new Lenis({
    duration: 0.75,
    easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
    smoothWheel: true,
    wheelMultiplier: 1.2,
  });
  lenis.on('scroll', ScrollTrigger.update);
  gsap.ticker.add((time) => lenis.raf(time * 1000));
  gsap.ticker.lagSmoothing(0);
}

// ── Nav smooth scroll ──────────────────────────────────────────────────────
let navScrolling = false;

function initNav() {
  document.querySelector('.nav-logo').addEventListener('click', (e) => {
    e.preventDefault();
    if (lenis) {
      navScrolling = true;
      lenis.scrollTo(0, {
        duration: 3.2,
        easing: (t) => t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2,
        onComplete: () => { navScrolling = false; },
      });
    } else {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  });

  document.querySelectorAll('.nav-scroll').forEach((link) => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      const target = document.querySelector(link.getAttribute('href'));
      if (target && lenis) {
        navScrolling = true;
        lenis.scrollTo(target, {
          duration: 3.2,
          easing: (t) => t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2,
          onComplete: () => { navScrolling = false; },
        });
      } else if (target) {
        target.scrollIntoView({ behavior: 'smooth' });
      }
    });
  });

  // Toggle dark-mode nav over dark-bg sections
  const header = document.querySelector('.site-header');
  ['#features', '#about'].forEach(id => {
    ScrollTrigger.create({
      trigger: id,
      start: 'top 80px',
      end: 'bottom 80px',
      onEnter:     () => header.classList.add('dark-mode'),
      onLeave:     () => header.classList.remove('dark-mode'),
      onEnterBack: () => header.classList.add('dark-mode'),
      onLeaveBack: () => header.classList.remove('dark-mode'),
    });
  });
}

// ── Scroll-reveal for page sections ───────────────────────────────────────
function initPageSectionReveals() {
  // Feature cards stagger in
  gsap.from('.feature-card', {
    y: 50, opacity: 0, stagger: 0.08, duration: 0.8, ease: 'power3.out',
    scrollTrigger: { trigger: '#features', start: 'top 75%', toggleActions: 'play none none none' }
  });
  gsap.from('#features .page-section-header', {
    y: 40, opacity: 0, duration: 0.9, ease: 'power3.out',
    scrollTrigger: { trigger: '#features', start: 'top 80%', toggleActions: 'play none none none' }
  });

  // About section
  gsap.from('#about .page-section-header, #about .about-intro', {
    y: 40, opacity: 0, stagger: 0.15, duration: 0.9, ease: 'power3.out',
    scrollTrigger: { trigger: '#about', start: 'top 75%', toggleActions: 'play none none none' }
  });
  gsap.from('.founder-card', {
    y: 50, opacity: 0, stagger: 0.15, duration: 0.9, ease: 'power3.out',
    scrollTrigger: { trigger: '.founders-grid', start: 'top 80%', toggleActions: 'play none none none' }
  });
  gsap.from('.review-card', {
    y: 40, opacity: 0, stagger: 0.12, duration: 0.85, ease: 'power3.out',
    scrollTrigger: { trigger: '.reviews-grid', start: 'top 85%', toggleActions: 'play none none none' }
  });
  gsap.from('.mission-block', {
    x: -40, opacity: 0, duration: 0.9, ease: 'power3.out',
    scrollTrigger: { trigger: '.mission-block', start: 'top 85%', toggleActions: 'play none none none' }
  });
}

// ── Hero word reveal ───────────────────────────────────────────────────────
function animateHeroWords() {
  gsap.from('.hero-heading .word', {
    y: 80, opacity: 0, stagger: 0.15, duration: 1.1, ease: 'power3.out',
    delay: 0.2
  });
  gsap.from('.hero-tagline', { y: 30, opacity: 0, duration: 1, ease: 'power3.out', delay: 0.7 });
  gsap.from('.hero-content .section-label', { opacity: 0, duration: 0.8, delay: 0.1 });
  gsap.from('.scroll-indicator', { opacity: 0, y: 20, duration: 1, delay: 1.2 });
}

// ── Hero fades out to reveal the video canvas beneath it ──────────────────
function initHeroTransition() {
  ScrollTrigger.create({
    trigger: scrollEl,
    start: 'top top',
    end: 'bottom bottom',
    scrub: true,
    onUpdate: (self) => {
      const p = self.progress;
      const heroOpacity = Math.max(0, 1 - p * 14);
      heroSection.style.opacity = heroOpacity;
      if (window.hero3DSetOpacity) window.hero3DSetOpacity(heroOpacity);
      if (p > 0.08 && window.hero3DDestroy) {
        window.hero3DDestroy();
        window.hero3DDestroy = null;
      }
    }
  });
}

// ── Frame scroll binding ───────────────────────────────────────────────────
function initFrameScroll() {
  ScrollTrigger.create({
    trigger: scrollEl,
    start: 'top top',
    end: 'bottom bottom',
    scrub: true,
    onUpdate: (self) => {
      const accelerated = Math.min(self.progress * FRAME_SPEED, 1);
      const idx = Math.min(Math.floor(accelerated * FRAME_COUNT), FRAME_COUNT - 1);
      if (isMobile) mobileZoom = 2.5 - (1.5 * self.progress);
      if (idx !== currentFrame || isMobile) {
        currentFrame = idx;
        requestAnimationFrame(() => drawFrame(currentFrame));
      }
    }
  });
}

// ── Dark overlay ───────────────────────────────────────────────────────────
function initDarkOverlay() {
  const fade = 0.04;
  const sEnter = isMobile ? 0.76 : STATS_ENTER;
  const sLeave = isMobile ? 0.99 : STATS_LEAVE;
  ScrollTrigger.create({
    trigger: scrollEl,
    start: 'top top',
    end: 'bottom bottom',
    scrub: true,
    onUpdate: ({ progress: p }) => {
      let o = 0;
      if (p >= sEnter - fade && p <= sEnter) {
        o = (p - (sEnter - fade)) / fade;
      } else if (p > sEnter && p < sLeave) {
        o = 0.9;
      } else if (p >= sLeave && p <= sLeave + fade) {
        o = 0.9 * (1 - (p - sLeave) / fade);
      }
      darkOverlay.style.opacity = o;
    }
  });
}

// ── Marquee ────────────────────────────────────────────────────────────────
function initMarquee() {
  const speed = parseFloat(marqueeWrap.dataset.scrollSpeed) || -28;
  gsap.to(marqueeWrap.querySelector('.marquee-text'), {
    xPercent: speed,
    ease: 'none',
    scrollTrigger: { trigger: scrollEl, start: 'top top', end: 'bottom bottom', scrub: true }
  });

  ScrollTrigger.create({
    trigger: scrollEl,
    start: 'top top',
    end: 'bottom bottom',
    scrub: true,
    onUpdate: ({ progress: p }) => {
      let o = 0;
      if (p > MARQUEE_ENTER && p < MARQUEE_LEAVE) {
        const inFade  = Math.min(1, (p - MARQUEE_ENTER) / 0.04);
        const outFade = Math.min(1, (MARQUEE_LEAVE - p) / 0.04);
        o = Math.min(inFade, outFade);
      }
      marqueeWrap.style.opacity = o;
    }
  });
}

// ── Section positioning — no-op (sections are position:fixed) ─────────────
function positionSections() {}

// ── Section animations ─────────────────────────────────────────────────────
function setupSectionAnimations() {
  const FADE_OUT = 0.025; // fraction of total scroll for exit fade

  function updateBlur() {}

  document.querySelectorAll('.scroll-section').forEach((sec) => {
    const type    = sec.dataset.animation;
    const persist = sec.dataset.persist === 'true';
    const enter   = parseFloat((isMobile && sec.dataset.mobileEnter) ? sec.dataset.mobileEnter : sec.dataset.enter) / 100;
    const leave   = parseFloat((isMobile && sec.dataset.mobileLeave) ? sec.dataset.mobileLeave : sec.dataset.leave) / 100;
    const innerEl = sec.querySelector('.section-inner');
    const children = sec.querySelectorAll(
      '.section-label, .section-heading, .section-body, .cta-button, .cta-note, .stat'
    );

    // Build entry animation timeline
    const tl = gsap.timeline({ paused: true });

    if (innerEl) {
      // Whole card slides in as one unit — direction matches the box type
      const fromX = type === 'slide-left'  ? -110
                  : type === 'slide-right' ?  110 : 0;
      const fromY = (type === 'fade-up' || type === 'scale-up') ? 70 : 0;

      tl.fromTo(innerEl,
        { x: fromX, y: fromY, opacity: 0, scale: 0.96 },
        { x: 0, y: 0, opacity: 1, scale: 1, duration: 0.72, ease: 'power3.out' }
      );
      // Text fades in softly as the card settles
      tl.from(children,
        { opacity: 0, y: 10, stagger: 0.07, duration: 0.42, ease: 'power2.out' },
        '-=0.48'
      );
    } else {
      // Stats section — no card wrapper, animate items directly
      switch (type) {
        case 'stagger-up':
          tl.from(children, { y: 60, opacity: 0, stagger: 0.16, duration: 0.85, ease: 'power3.out' });
          break;
        default:
          tl.from(children, { y: 40, opacity: 0, stagger: 0.12, duration: 0.8, ease: 'power3.out' });
      }
    }

    let played = false;
    let secVisible = false;

    ScrollTrigger.create({
      trigger: scrollEl,
      start: 'top top',
      end: 'bottom bottom',
      scrub: false,
      onUpdate: ({ progress: p }) => {
        const visible = p >= enter && p <= leave;

        if (visible !== secVisible) {
          updateBlur(visible ? 1 : -1);
          secVisible = visible;
        }

        if (!visible) {
          sec.style.opacity = '0';
          sec.style.pointerEvents = 'none';
          if (played && !persist) {
            tl.pause(0); // reset children to from-state for clean re-entry
            played = false;
          }
          return;
        }

        // Fade out smoothly near leave boundary
        if (!persist && p >= leave - FADE_OUT) {
          const t = (p - (leave - FADE_OUT)) / FADE_OUT;
          sec.style.opacity = String(Math.max(0, 1 - t));
        } else {
          sec.style.opacity = '1';
        }
        sec.style.pointerEvents = 'auto';

        // Play entry animation once when section first enters
        if (!played) {
          tl.play(0);
          played = true;
        }
      }
    });
  });
}

// ── Counter animations — purely scroll-driven, counts up/down with scroll ──
function initCounters() {
  document.querySelectorAll('.stat-number').forEach((el) => {
    const target   = parseFloat(el.dataset.value);
    const decimals = parseInt(el.dataset.decimals || '0');
    const statSec  = el.closest('.scroll-section');
    const enter    = parseFloat((isMobile && statSec.dataset.mobileEnter) ? statSec.dataset.mobileEnter : statSec.dataset.enter) / 100;
    const leave    = parseFloat((isMobile && statSec.dataset.mobileLeave) ? statSec.dataset.mobileLeave : statSec.dataset.leave) / 100;

    ScrollTrigger.create({
      trigger: scrollEl,
      start: 'top top',
      end: 'bottom bottom',
      scrub: true,
      onUpdate: ({ progress: p }) => {
        const t   = Math.max(0, Math.min(1, (p - enter) / (leave - enter)));
        el.textContent = (target * t).toFixed(decimals);
      }
    });
  });
}

// ── Hide marquee when features section enters ─────────────────────────────
function initCanvasFadeOut() {
  ScrollTrigger.create({
    trigger: '#features',
    start: 'top bottom',
    end: 'top top',
    scrub: true,
    onUpdate: ({ progress: p }) => {
      marqueeWrap.style.opacity = Math.max(0, 1 - p * 3);
    }
  });
}

// ── Button press animation (both touch + mouse) ───────────────────────────
function initButtonEffects() {
  const btns = [
    ...document.querySelectorAll('.nav-links a'),
    document.querySelector('.nav-logo'),
    document.querySelector('.cta-appstore-btn'),
  ].filter(Boolean);

  btns.forEach((el) => {
    const fire = () => {
      el.classList.remove('btn-clicking');
      void el.offsetWidth; // restart animation if already mid-play
      el.classList.add('btn-clicking');
      el.addEventListener('animationend', () => el.classList.remove('btn-clicking'), { once: true });
    };
    el.addEventListener('mousedown', fire);
    el.addEventListener('touchstart', fire, { passive: true });
  });
}

// ── Download page — always visible, no JS animation needed ───────────────
function initCtaPage() {}

// ── Hide nav when download section is visible ─────────────────────────────
function initNavHide() {
  const header = document.querySelector('.site-header');
  ScrollTrigger.create({
    trigger: '#download',
    start: 'top 80%',
    onEnter: () => gsap.to(header, { yPercent: -100, duration: 0.5, ease: 'power2.inOut' }),
    onLeaveBack: () => gsap.to(header, { yPercent: 0, duration: 0.5, ease: 'power2.inOut' }),
  });
}

// ── Pause on each end page for 2 s before allowing further scroll ─────────
function initSectionSnap() {
  if (!lenis) return; // mobile uses native scroll — no snap needed
  let locked = false;

  const lockOn = (el) => {
    if (locked || navScrolling) return;
    locked = true;

    lenis.scrollTo(el, {
      offset: 0,
      duration: 0.35,
      easing: (t) => 1 - Math.pow(1 - t, 3),
      lock: true,
      force: true,
      onComplete: () => {
        lenis.stop();
        setTimeout(() => {
          lenis.start();
          locked = false;
        }, 800);
      },
    });
  };

  ['#features', '#about', '#download'].forEach((id) => {
    const el = document.querySelector(id);
    if (!el) return;
    ScrollTrigger.create({
      trigger: el,
      start: 'top 90%',
      end: 'bottom 10%',
      onEnter:     () => lockOn(el),
      onEnterBack: () => lockOn(el),
    });
  });
}

// ── Mobile scene — no video scrubbing, native scroll ─────────────────────
function initMobileScene() {
  // Fix iOS --vh custom property
  function setVh() {
    document.documentElement.style.setProperty('--vh', `${window.innerHeight * 0.01}px`);
  }
  setVh();
  window.addEventListener('resize', setVh);

  // Smooth nav scroll for anchor links
  initNav();

  // Animate page sections on scroll using IntersectionObserver (no GSAP needed)
  const revealEls = document.querySelectorAll(
    '.feature-card, #features .page-section-header, #about .page-section-header, .founder-card, .mission-block'
  );
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(e => {
      if (e.isIntersecting) {
        e.target.style.transition = 'opacity 0.6s ease, transform 0.6s ease';
        e.target.style.opacity = '1';
        e.target.style.transform = 'none';
        observer.unobserve(e.target);
      }
    });
  }, { threshold: 0.15 });
  revealEls.forEach(el => {
    el.style.opacity = '0';
    el.style.transform = 'translateY(24px)';
    observer.observe(el);
  });
}

// ── Init all ───────────────────────────────────────────────────────────────
function setSectionHeights() {
  const h = window.innerHeight + 'px';
  ['features', 'about', 'download'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.style.height = h;
  });
}

function initScene() {
  gsap.registerPlugin(ScrollTrigger);
  resizeCanvas();
  document.documentElement.style.setProperty('--vh', `${window.innerHeight * 0.01}px`);
  setSectionHeights();
  let resizeTimer;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      resizeCanvas();
      document.documentElement.style.setProperty('--vh', `${window.innerHeight * 0.01}px`);
      setSectionHeights();
      ScrollTrigger.refresh();
    }, 120);
  });

  initLenis();
  initNav();
  animateHeroWords();
  positionSections();
  initHeroTransition();
  initFrameScroll();
  initDarkOverlay();
  initMarquee();
  setupSectionAnimations();
  initCounters();
  initCanvasFadeOut();
  initCtaPage();
  initNavHide();
  initPageSectionReveals();
  initSectionSnap();
  initButtonEffects();

  ScrollTrigger.refresh();

  // ── Mobile: hard-lock elastic overscroll ──────────────────────────────────
  // iOS ignores overscroll-behavior in many cases, so we block it in JS.
  // We prevent touchmove default only when the user is already at the very
  // top or bottom of the page — this stops the whole page lifting/dropping.
  if (isMobile) {
    let touchStartY = 0;

    window.addEventListener('touchstart', (e) => {
      touchStartY = e.touches[0].clientY;
    }, { passive: true });

    window.addEventListener('touchmove', (e) => {
      const dy = e.touches[0].clientY - touchStartY;
      const scrollTop = window.scrollY;
      const maxScroll = document.documentElement.scrollHeight - window.innerHeight;
      const atTop    = scrollTop <= 0   && dy > 0; // finger dragging down at top
      const atBottom = scrollTop >= maxScroll - 2 && dy < 0; // finger dragging up at bottom
      if (atTop || atBottom) e.preventDefault();
    }, { passive: false });
  }
}

preload();
