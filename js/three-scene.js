/* ============================================================
   3D 沉浸场景（Three.js + WebGL 着色器）
   A. Hero 极光渐变背景 —— 纸白 × 电光蓝流体着色器，鼠标微视差
   B. 沉浸式区块 —— 噪声变形球 + 菲涅尔发光 + 粒子，可拖拽旋转
   性能：视口外暂停渲染 · DPR≤2 · reduced-motion 静态渲染单帧
   依赖：assets/vendor/three.min.js（UMD 全局 THREE，file:// 可用）
   ============================================================ */
(function () {
"use strict";

if (!window.THREE) return; /* three.min.js 未加载时静默降级 */

const prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/* ---------- 公用 GLSL ---------- */
const GLSL_SIMPLEX_3D = /* glsl */ `
vec3 mod289(vec3 x){return x - floor(x*(1.0/289.0))*289.0;}
vec4 mod289(vec4 x){return x - floor(x*(1.0/289.0))*289.0;}
vec4 permute(vec4 x){return mod289(((x*34.0)+1.0)*x);}
vec4 taylorInvSqrt(vec4 r){return 1.79284291400159 - 0.85373472095314*r;}
float snoise(vec3 v){
  const vec2 C = vec2(1.0/6.0, 1.0/3.0);
  const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);
  vec3 i = floor(v + dot(v, C.yyy));
  vec3 x0 = v - i + dot(i, C.xxx);
  vec3 g = step(x0.yzx, x0.xyz);
  vec3 l = 1.0 - g;
  vec3 i1 = min(g.xyz, l.zxy);
  vec3 i2 = max(g.xyz, l.zxy);
  vec3 x1 = x0 - i1 + C.xxx;
  vec3 x2 = x0 - i2 + C.yyy;
  vec3 x3 = x0 - D.yyy;
  i = mod289(i);
  vec4 p = permute(permute(permute(i.z + vec4(0.0, i1.z, i2.z, 1.0))
        + i.y + vec4(0.0, i1.y, i2.y, 1.0)) + i.x + vec4(0.0, i1.x, i2.x, 1.0));
  float n_ = 0.142857142857;
  vec3 ns = n_ * D.wyz - D.xzx;
  vec4 j = p - 49.0 * floor(p * ns.z * ns.z);
  vec4 x_ = floor(j * ns.z);
  vec4 y_ = floor(j - 7.0 * x_);
  vec4 x = x_ * ns.x + ns.yyyy;
  vec4 y = y_ * ns.x + ns.yyyy;
  vec4 h = 1.0 - abs(x) - abs(y);
  vec4 b0 = vec4(x.xy, y.xy);
  vec4 b1 = vec4(x.zw, y.zw);
  vec4 s0 = floor(b0) * 2.0 + 1.0;
  vec4 s1 = floor(b1) * 2.0 + 1.0;
  vec4 sh = -step(h, vec4(0.0));
  vec4 a0 = b0.xzyw + s0.xzyw * sh.xxyy;
  vec4 a1 = b1.xzyw + s1.xzyw * sh.zzww;
  vec3 p0 = vec3(a0.xy, h.x);
  vec3 p1 = vec3(a0.zw, h.y);
  vec3 p2 = vec3(a1.xy, h.z);
  vec3 p3 = vec3(a1.zw, h.w);
  vec4 norm = taylorInvSqrt(vec4(dot(p0,p0), dot(p1,p1), dot(p2,p2), dot(p3,p3)));
  p0 *= norm.x; p1 *= norm.y; p2 *= norm.z; p3 *= norm.w;
  vec4 m = max(0.6 - vec4(dot(x0,x0), dot(x1,x1), dot(x2,x2), dot(x3,x3)), 0.0);
  m = m * m;
  return 42.0 * dot(m*m, vec4(dot(p0,x0), dot(p1,x1), dot(p2,x2), dot(p3,x3)));
}
`;

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

/* ---------- 安全建 renderer ---------- */
function createRenderer(canvas, alpha) {
  try {
    return new THREE.WebGLRenderer({ canvas, antialias: true, alpha, powerPreference: "low-power" });
  } catch {
    return null;
  }
}

const DPR = Math.min(window.devicePixelRatio || 1, 2);

/* ============================================================
   A. Hero 极光背景
   ============================================================ */
function initHeroAurora() {
  const canvas = document.getElementById("hero-aurora");
  if (!canvas) return;
  const renderer = createRenderer(canvas, false);
  if (!renderer) { canvas.remove(); return; }

  renderer.setPixelRatio(DPR);
  const scene = new THREE.Scene();
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

  const uniforms = {
    uTime: { value: 0 },
    uRes: { value: new THREE.Vector2(1, 1) },
    uMouse: { value: new THREE.Vector2(0, 0) },
  };

  const material = new THREE.ShaderMaterial({
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

        /* 双层 domain-warp 流体 */
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

        /* 边缘融回纸白，保证正文区干净 */
        float d = length(uv * vec2(0.9, 1.15));
        col = mix(col, paper, smoothstep(0.52, 1.12, d) * 0.92);

        gl_FragColor = vec4(col, 1.0);
      }
    `,
  });

  scene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), material));

  const resize = () => {
    const host = canvas.parentElement;
    const w = host.clientWidth;
    const h = host.clientHeight;
    renderer.setSize(w, h, false);
    uniforms.uRes.value.set(w, h);
  };
  resize();
  if ("ResizeObserver" in window) {
    new ResizeObserver(resize).observe(canvas.parentElement);
  } else {
    window.addEventListener("resize", resize, { passive: true });
  }

  /* 鼠标微视差（ Passive，触屏忽略） */
  if (window.matchMedia("(pointer: fine)").matches) {
    window.addEventListener(
      "pointermove",
      (e) => {
        uniforms.uMouse.value.set(
          (e.clientX / window.innerWidth - 0.5) * 2,
          (e.clientY / window.innerHeight - 0.5) * 2
        );
      },
      { passive: true }
    );
  }

  if (prefersReduced) {
    uniforms.uTime.value = 12.0;
    renderer.render(scene, camera);
    return;
  }

  /* 可见才渲染 */
  const clock = new THREE.Clock();
  let raf = 0;
  const loop = () => {
    uniforms.uTime.value = clock.getElapsedTime();
    renderer.render(scene, camera);
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

/* ============================================================
   B. 沉浸式区块：噪声变形球 + 粒子
   ============================================================ */
function initVizObject() {
  const stage = document.getElementById("viz-stage");
  const canvas = document.getElementById("viz-object");
  if (!stage || !canvas) return;
  const renderer = createRenderer(canvas, true);
  if (!renderer) {
    stage.classList.add("no-webgl");
    canvas.remove();
    return;
  }

  renderer.setPixelRatio(DPR);
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 30);
  camera.position.set(0, 0, 5.4);

  /* ---- 变形球 ---- */
  const uniforms = { uTime: { value: 0 } };
  const blob = new THREE.Mesh(
    new THREE.IcosahedronGeometry(1.42, 48),
    new THREE.ShaderMaterial({
      uniforms,
      vertexShader: /* glsl */ `
        uniform float uTime;
        varying vec3 vNormal;
        varying vec3 vView;
        ${GLSL_SIMPLEX_3D}
        void main(){
          float n1 = snoise(position * 1.15 + uTime * 0.22);
          float n2 = snoise(position * 2.8  - uTime * 0.16) * 0.35;
          vec3 p = position + normal * (n1 * 0.16 + n2 * 0.06);
          vNormal = normalize(normalMatrix * normal);
          vec4 mv = modelViewMatrix * vec4(p, 1.0);
          vView = mv.xyz;
          gl_Position = projectionMatrix * mv;
        }
      `,
      fragmentShader: /* glsl */ `
        precision highp float;
        varying vec3 vNormal;
        varying vec3 vView;
        void main(){
          vec3 n = normalize(vNormal);
          vec3 v = normalize(-vView);
          float fres = pow(1.0 - max(dot(v, n), 0.0), 2.4);
          float key = max(dot(n, normalize(vec3(0.55, 0.85, 0.55))), 0.0);
          float rim = max(dot(n, normalize(vec3(-0.7, -0.2, 0.4))), 0.0);
          vec3 deep = vec3(0.075, 0.16, 0.52);
          vec3 mid  = vec3(0.23, 0.48, 1.00);
          vec3 hi   = vec3(0.66, 0.83, 1.00);
          vec3 col = mix(deep, mid, key * 0.85 + rim * 0.25);
          col = mix(col, hi, fres * 0.9);
          gl_FragColor = vec4(col, 1.0);
        }
      `,
    })
  );
  scene.add(blob);

  /* ---- 环绕粒子 ---- */
  const COUNT = 320;
  const positions = new Float32Array(COUNT * 3);
  for (let i = 0; i < COUNT; i++) {
    const r = 2.3 + Math.random() * 1.1;
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(2 * Math.random() - 1);
    positions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
    positions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta) * 0.7;
    positions[i * 3 + 2] = r * Math.cos(phi);
  }
  const pGeo = new THREE.BufferGeometry();
  pGeo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  const particles = new THREE.Points(
    pGeo,
    new THREE.PointsMaterial({
      color: 0x8ecbff,
      size: 0.028,
      transparent: true,
      opacity: 0.55,
      depthWrite: false,
    })
  );
  scene.add(particles);

  /* ---- 尺寸与构图：宽屏时球体右移，给文案留位 ---- */
  const resize = () => {
    const w = canvas.clientWidth || stage.clientWidth;
    const h = canvas.clientHeight || stage.clientHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    blob.position.x = camera.aspect > 1.05 ? 1.05 : 0;
    particles.position.x = blob.position.x;
  };
  resize();
  if ("ResizeObserver" in window) {
    new ResizeObserver(resize).observe(canvas);
  } else {
    window.addEventListener("resize", resize, { passive: true });
  }

  /* ---- 交互：自动旋转 + 指针视差 + 拖拽（含惯性） ---- */
  let dragging = false;
  let lastX = 0, lastY = 0;
  const BASE_SPIN = 0.0022; /* 基础自转（每帧） */
  let velX = 0, velY = BASE_SPIN;
  const parallax = { x: 0, y: 0, tx: 0, ty: 0 };

  canvas.style.touchAction = "none";
  canvas.addEventListener("pointerdown", (e) => {
    dragging = true;
    lastX = e.clientX;
    lastY = e.clientY;
    canvas.setPointerCapture(e.pointerId);
  });
  canvas.addEventListener("pointermove", (e) => {
    parallax.tx = (e.clientX / window.innerWidth - 0.5) * 2;
    parallax.ty = (e.clientY / window.innerHeight - 0.5) * 2;
    if (!dragging) return;
    velY = (e.clientX - lastX) * 0.006;
    velX = (e.clientY - lastY) * 0.006;
    blob.rotation.y += (e.clientX - lastX) * 0.006;
    blob.rotation.x += (e.clientY - lastY) * 0.006;
    lastX = e.clientX;
    lastY = e.clientY;
  });
  const endDrag = () => { dragging = false; };
  canvas.addEventListener("pointerup", endDrag);
  canvas.addEventListener("pointercancel", endDrag);

  if (prefersReduced) {
    uniforms.uTime.value = 3.0;
    renderer.render(scene, camera);
    return;
  }

  const clock = new THREE.Clock();
  let raf = 0;
  const loop = () => {
    const t = clock.getElapsedTime();
    uniforms.uTime.value = t;

    /* 惯性衰减 + 回归基础自转 */
    if (!dragging) {
      velY += (BASE_SPIN - velY) * 0.04;
      velX *= 0.94;
      blob.rotation.y += velY;
      blob.rotation.x += velX;
    }
    blob.rotation.z = Math.sin(t * 0.1) * 0.06;

    particles.rotation.y = t * 0.03;
    particles.rotation.x = Math.sin(t * 0.07) * 0.1;

    /* 指针视差（缓动） */
    parallax.x += (parallax.tx - parallax.x) * 0.04;
    parallax.y += (parallax.ty - parallax.y) * 0.04;
    camera.position.x = parallax.x * 0.45;
    camera.position.y = -parallax.y * 0.3;
    camera.lookAt(blob.position.x, 0, 0);

    renderer.render(scene, camera);
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
    { threshold: 0.05 }
  );
  io.observe(stage);
}

initHeroAurora();
initVizObject();
})();
