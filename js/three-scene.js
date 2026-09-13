/* ============================================================
   Hero 沉浸背景（Three.js + WebGL，单画布双通道）
   通道 1：纸白极光渐变（fbm domain-warp，柔和）
   通道 2：增长曲线场 —— 12 条浅蓝曲线向右上方流动（1→N 隐喻）
   性能：视口外暂停渲染 · DPR≤2 · reduced-motion 静态渲染单帧
   依赖：assets/vendor/three.min.js（UMD 全局 THREE，file:// 可用）
   ============================================================ */
(function () {
"use strict";

if (!window.THREE) return; /* three.min.js 未加载时静默降级 */

const prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const DPR = Math.min(window.devicePixelRatio || 1, 2);

const GLSL_FBM_2D = /* glsl */ `
float hash21(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123); }
float noise2(vec2 p){
  vec2 i = floor(p); vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash21(i), hash21(i + vec2(1.0, 0.0)), u.x),
             mix(hash21(i + vec2(0.0, 1.0)), hash21(i + vec2(1.0, 1.0)), u.x), u.y);
}
float fbm(vec2 p){
  float v = 0.0; float a = 0.5;
  for (int i = 0; i < 5; i++) {
    v += a * noise2(p);
    p = p * 2.03 + vec2(17.7);
    a *= 0.5;
  }
  return v;
}
`;

function initHeroScene() {
  const canvas = document.getElementById("hero-aurora");
  if (!canvas) return;

  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: "low-power" });
  } catch {
    canvas.remove();
    return;
  }
  renderer.setPixelRatio(DPR);
  renderer.autoClear = false;

  /* ============ 通道 1：极光底 ============ */
  const quadScene = new THREE.Scene();
  const quadCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const uniforms = {
    uTime: { value: 0 },
    uRes: { value: new THREE.Vector2(1, 1) },
    uMouse: { value: new THREE.Vector2(0, 0) },
  };
  quadScene.add(
    new THREE.Mesh(
      new THREE.PlaneGeometry(2, 2),
      new THREE.ShaderMaterial({
        uniforms,
        vertexShader: /* glsl */ `
          varying vec2 vUv;
          void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }
        `,
        fragmentShader: /* glsl */ `
          precision highp float;
          uniform float uTime;
          uniform vec2 uRes;
          uniform vec2 uMouse;
          varying vec2 vUv;
          ${GLSL_FBM_2D}
          void main(){
            vec2 uv = vUv - 0.5;
            uv.x *= uRes.x / max(uRes.y, 1.0);
            float t = uTime * 0.055;

            vec2 q = uv * 1.5 + vec2(0.0, 0.12);
            float w1 = fbm(q + vec2(t, -t * 0.55));
            float w2 = fbm(q + vec2(-t * 0.4, t * 0.7) + w1 * 0.9);
            float v = fbm(q + 2.1 * vec2(w1, w2) + uMouse * 0.14);

            vec3 paper = vec3(0.969, 0.969, 0.957);
            vec3 lav   = vec3(0.912, 0.892, 0.953);
            vec3 blue  = vec3(0.796, 0.871, 1.000);
            vec3 deep  = vec3(0.704, 0.794, 0.996);

            vec3 col = paper;
            col = mix(col, lav,  smoothstep(0.32, 0.72, v) * 0.55);
            col = mix(col, blue, smoothstep(0.46, 0.92, v) * 0.60);
            col = mix(col, deep, smoothstep(0.62, 0.97, v) * 0.35);

            float d = length(uv * vec2(0.9, 1.15));
            col = mix(col, paper, smoothstep(0.52, 1.12, d) * 0.92);

            gl_FragColor = vec4(col, 1.0);
          }
        `,
      })
    )
  );

  /* ============ 通道 2：亮色增长曲线场 ============ */
  const lineScene = new THREE.Scene();
  const lineCam = new THREE.PerspectiveCamera(40, 1, 0.1, 40);
  lineCam.position.set(0, 0.25, 5.8);

  const LINES = 12;
  const SEG = 110;
  const X_SPAN = 8.8;
  const lines = [];

  const cNear = new THREE.Color(0x9dbdf8); /* 近：雾蓝 */
  const cFar = new THREE.Color(0x4d84f0);  /* 远：品牌蓝 */

  for (let i = 0; i < LINES; i++) {
    const depth = i / (LINES - 1); /* 0=近 1=远 */
    const z = -depth * 5.2;

    const positions = new Float32Array(SEG * 3);
    const colors = new Float32Array(SEG * 3);
    const base = cNear.clone().lerp(cFar, depth);

    for (let j = 0; j < SEG; j++) {
      const x = (j / (SEG - 1) - 0.5) * X_SPAN;
      positions[j * 3] = x;
      positions[j * 3 + 1] = 0;
      positions[j * 3 + 2] = z;
      const grad = j / (SEG - 1);
      const c = base.clone().multiplyScalar(0.55 + grad * 0.65); /* 向右渐亮 */
      colors[j * 3] = c.r;
      colors[j * 3 + 1] = c.g;
      colors[j * 3 + 2] = c.b;
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    geo.setAttribute("color", new THREE.BufferAttribute(colors, 3));

    const line = new THREE.Line(
      geo,
      new THREE.LineBasicMaterial({
        vertexColors: true,
        transparent: true,
        opacity: 0.42 - depth * 0.2, /* 柔和：低透明度 */
        depthWrite: false,
      })
    );
    line.userData = { depth, phase: i * 0.42 };
    lineScene.add(line);
    lines.push(line);
  }

  const updateWaves = (t) => {
    for (const line of lines) {
      const { depth, phase } = line.userData;
      const damp = 1 - depth * 0.4;
      const arr = line.geometry.attributes.position.array;
      for (let j = 0; j < SEG; j++) {
        const x = arr[j * 3];
        const y =
          Math.sin(x * 0.92 + t * 0.72 + phase) * 0.26 * damp +
          Math.sin(x * 2.05 - t * 0.45 + phase * 1.6) * 0.13 * damp +
          Math.sin(x * 3.8 + t * 0.28 + phase * 0.6) * 0.05 * damp +
          x * 0.058; /* 右上增长趋势 */
        arr[j * 3 + 1] = y;
      }
      line.geometry.attributes.position.needsUpdate = true;
    }
  };

  const render = () => {
    renderer.clear();
    renderer.render(quadScene, quadCam);
    renderer.render(lineScene, lineCam);
  };

  /* ---- 尺寸 ---- */
  const resize = () => {
    const host = canvas.parentElement;
    const w = host.clientWidth;
    const h = host.clientHeight;
    renderer.setSize(w, h, false);
    uniforms.uRes.value.set(w, h);
    lineCam.aspect = w / h;
    lineCam.updateProjectionMatrix();
  };
  resize();
  if ("ResizeObserver" in window) {
    new ResizeObserver(resize).observe(canvas.parentElement);
  } else {
    window.addEventListener("resize", resize, { passive: true });
  }

  /* ---- 鼠标视差：极光扰动 + 曲线相机 ---- */
  const parallax = { x: 0, y: 0, tx: 0, ty: 0 };
  if (window.matchMedia("(pointer: fine)").matches) {
    window.addEventListener(
      "pointermove",
      (e) => {
        parallax.tx = (e.clientX / window.innerWidth - 0.5) * 2;
        parallax.ty = (e.clientY / window.innerHeight - 0.5) * 2;
        uniforms.uMouse.value.set(parallax.tx, parallax.ty);
      },
      { passive: true }
    );
  }

  if (prefersReduced) {
    uniforms.uTime.value = 12.0;
    updateWaves(5.0);
    lineCam.lookAt(0.7, 0.1, -2);
    render();
    return;
  }

  const clock = new THREE.Clock();
  let raf = 0;
  const loop = () => {
    const t = clock.getElapsedTime();
    uniforms.uTime.value = t;
    updateWaves(t);

    parallax.x += (parallax.tx - parallax.x) * 0.045;
    parallax.y += (parallax.ty - parallax.y) * 0.045;
    lineCam.position.x = parallax.x * 0.45;
    lineCam.position.y = 0.25 - parallax.y * 0.28;
    lineCam.lookAt(0.7, 0.1, -2);

    render();
    raf = requestAnimationFrame(loop);
  };

  const io = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting && !raf) loop();
        else if (!entry.isIntersecting && raf) {
          cancelAnimationFrame(raf);
          raf = 0;
        }
      }
    },
    { threshold: 0.02 }
  );
  io.observe(canvas);
}

initHeroScene();
})();
