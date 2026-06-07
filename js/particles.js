(function initGeoBg() {
  const canvas = document.getElementById('particle-canvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');

  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  let W, H;

  function resize() {
    W = canvas.parentElement ? canvas.parentElement.offsetWidth  : window.innerWidth;
    H = canvas.parentElement ? canvas.parentElement.offsetHeight : window.innerHeight;
    canvas.width  = W * dpr;
    canvas.height = H * dpr;
    canvas.style.width  = W + 'px';
    canvas.style.height = H + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  resize();
  window.addEventListener('resize', resize);

  const isMobile = window.innerWidth <= 768;
  // Few large shapes that overlap enough to keep every area covered
  const COLS = isMobile ? 2 : 3;
  const ROWS = isMobile ? 3 : 3;

  function mkShapeInCell(col, row) {
    const cellW = W / COLS;
    const cellH = H / ROWS;
    const sides = Math.floor(Math.random() * 4) + 4; // 4–7 sides
    // Minimal jitter — shapes anchor to cell centres for even spread
    const jx = (Math.random() - 0.5) * cellW * 0.12;
    const jy = (Math.random() - 0.5) * cellH * 0.12;
    return {
      x:    (col + 0.5) * cellW + jx,
      y:    (row + 0.5) * cellH + jy,
      r:    Math.max(cellW, cellH) * (0.7 + Math.random() * 0.4),
      sides,
      rot:  Math.random() * Math.PI * 2,
      vx:   (Math.random() - 0.5) * 0.12,
      vy:   (Math.random() - 0.5) * 0.12,
      vrot: (Math.random() - 0.5) * 0.002,
      alpha: 0.06 + Math.random() * 0.07,
    };
  }

  const shapes = [];
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      shapes.push(mkShapeInCell(c, r));
    }
  }

  function drawPolygon(s) {
    ctx.beginPath();
    for (let i = 0; i < s.sides; i++) {
      const a = s.rot + (i / s.sides) * Math.PI * 2;
      const x = s.x + Math.cos(a) * s.r;
      const y = s.y + Math.sin(a) * s.r;
      i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.strokeStyle = `rgba(26,86,219,${s.alpha.toFixed(3)})`;
    ctx.lineWidth = 1.2;
    ctx.stroke();
  }

  function draw() {
    requestAnimationFrame(draw);
    ctx.clearRect(0, 0, W, H);

    for (const s of shapes) {
      s.x   += s.vx;
      s.y   += s.vy;
      s.rot += s.vrot;

      const m = s.r + 20;
      if (s.x < -m)    s.x = W + m;
      if (s.x > W + m) s.x = -m;
      if (s.y < -m)    s.y = H + m;
      if (s.y > H + m) s.y = -m;

      drawPolygon(s);
    }

    // Faint connecting lines between nearby shapes
    for (let i = 0; i < shapes.length; i++) {
      for (let j = i + 1; j < shapes.length; j++) {
        const dist = Math.hypot(shapes[j].x - shapes[i].x, shapes[j].y - shapes[i].y);
        if (dist < 260) {
          const alpha = (1 - dist / 260) * 0.08;
          ctx.beginPath();
          ctx.moveTo(shapes[i].x, shapes[i].y);
          ctx.lineTo(shapes[j].x, shapes[j].y);
          ctx.strokeStyle = `rgba(26,86,219,${alpha.toFixed(3)})`;
          ctx.lineWidth = 0.4;
          ctx.stroke();
        }
      }
    }
  }

  draw();
})();
