// Three.js hero — blue & dark particles on white, location-pin constellation
(function initHero3D() {
  const canvas = document.getElementById('hero-canvas');
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setClearColor(0x000000, 0);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 500);
  camera.position.set(0, 0, 80);

  const PARTICLE_COUNT = 200;
  const positions = new Float32Array(PARTICLE_COUNT * 3);
  const colors    = new Float32Array(PARTICLE_COUNT * 3);
  const scales    = new Float32Array(PARTICLE_COUNT);

  // Blue palette: vivid blue, navy, sky blue, near-black
  const vivid  = new THREE.Color(0x1a56db);
  const navy   = new THREE.Color(0x1e3a8a);
  const sky    = new THREE.Color(0x93c5fd);
  const dark   = new THREE.Color(0x0a0a1a);

  for (let i = 0; i < PARTICLE_COUNT; i++) {
    // Cluster particles towards the right half so they don't obscure the left-aligned text
    positions[i * 3]     = (Math.random() - 0.3) * 200;
    positions[i * 3 + 1] = (Math.random() - 0.5) * 110;
    positions[i * 3 + 2] = (Math.random() - 0.5) * 80 - 10;
    scales[i] = 0.4 + Math.random() * 1.8;

    const t = Math.random();
    const c = t < 0.35 ? vivid : t < 0.55 ? sky : t < 0.75 ? navy : dark;
    colors[i * 3]     = c.r;
    colors[i * 3 + 1] = c.g;
    colors[i * 3 + 2] = c.b;
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geo.setAttribute('color',    new THREE.BufferAttribute(colors, 3));
  geo.setAttribute('scale',    new THREE.BufferAttribute(scales, 1));

  const mat = new THREE.ShaderMaterial({
    vertexColors: true,
    transparent: true,
    depthWrite: false,
    vertexShader: `
      attribute float scale;
      varying vec3 vColor;
      void main() {
        vColor = color;
        vec4 mvPos = modelViewMatrix * vec4(position, 1.0);
        gl_PointSize = scale * (300.0 / -mvPos.z);
        gl_Position = projectionMatrix * mvPos;
      }
    `,
    fragmentShader: `
      varying vec3 vColor;
      void main() {
        float d = length(gl_PointCoord - 0.5);
        if (d > 0.5) discard;
        float alpha = 1.0 - smoothstep(0.2, 0.5, d);
        gl_FragColor = vec4(vColor, alpha * 0.55);
      }
    `
  });

  const particles = new THREE.Points(geo, mat);
  scene.add(particles);

  // Constellation lines — blue, subtle
  const lineMat = new THREE.LineBasicMaterial({ color: 0x1a56db, transparent: true, opacity: 0.07 });
  const lineGeo = new THREE.BufferGeometry();
  const lineVerts = [];
  for (let i = 0; i < 80; i++) {
    const a = Math.floor(Math.random() * PARTICLE_COUNT);
    const b = Math.floor(Math.random() * PARTICLE_COUNT);
    lineVerts.push(
      positions[a*3], positions[a*3+1], positions[a*3+2],
      positions[b*3], positions[b*3+1], positions[b*3+2]
    );
  }
  lineGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(lineVerts), 3));
  scene.add(new THREE.LineSegments(lineGeo, lineMat));

  // Mouse parallax
  let mx = 0, my = 0;
  window.addEventListener('mousemove', (e) => {
    mx = (e.clientX / window.innerWidth  - 0.5) * 2;
    my = (e.clientY / window.innerHeight - 0.5) * 2;
  });

  window.hero3DSetOpacity = (o) => { renderer.domElement.style.opacity = o; };

  let raf;
  function animate(t) {
    raf = requestAnimationFrame(animate);
    const elapsed = t * 0.001;
    particles.rotation.y = elapsed * 0.01  + mx * 0.06;
    particles.rotation.x = elapsed * 0.005 + my * 0.03;
    camera.position.x += (mx * 5 - camera.position.x) * 0.03;
    camera.position.y += (-my * 3 - camera.position.y) * 0.03;
    renderer.render(scene, camera);
  }
  animate(0);

  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });

  window.hero3DDestroy = () => {
    cancelAnimationFrame(raf);
    renderer.dispose();
  };
})();
