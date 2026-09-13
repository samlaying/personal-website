/* ============================================================
   3D 沉浸场景（Three.js + WebGL 着色器）
   A. Hero 极光渐变背景 —— 纸白 × 电光蓝流体着色器，鼠标微视差
   B. 增长方法论区块 —— 3D 流动增长曲线场（向右上流动，隐喻 1→N）
      + 能力标签漂浮层，鼠标视差
   性能：视口外暂停渲染 · DPR≤2 · reduced-motion 静态渲染单帧
   依赖：assets/vendor/three.min.js（UMD 全局 THREE，file:// 可用）
   ============================================================ */
(function () {
"use strict";

if (!window.THREE) return; /* three.min.js 未加载时静默降级 */

const prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/* ---------- 公用 GLSL ---------- */
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

  /* 鼠标微视差（触屏忽略） */
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
   B. 增长方法论区块：3D 流动增长曲线场
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
  const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 40);
  camera.position.set(0, 0.55, 5.6);

  /* ---- 曲线场：LINES 行数 × 每行点数 ---- */
  const LINES = 26;
  const SEG = 120;
  const X_SPAN = 8.4;
  const lines = [];

  for (let i = 0; i < LINES; i++) {
    const depth = i / (LINES - 1); /* 0=近 1=远 */
    const z = -depth * 6.0;

    const positions = new Float32Array(SEG * 3);
    const colors = new Float32Array(SEG * 3);

    const cNear = new THREE.Color(0x8ecbff); /* 近：亮青蓝 */
    const cFar = new THREE.Color(0x1f5eff);  /* 远：电光蓝 */
    const base = cNear.clone().lerp(cFar, depth);

    for (let j = 0; j < SEG; j++) {
      const x = (j / (SEG - 1) - 0.5) * X_SPAN;
      positions[j * 3] = x;
      positions[j * 3 + 1] = 0;
      positions[j * 3 + 2] = z;

      /* 向右渐亮（增长隐喻） */
      const grad = j / (SEG - 1);
      const c = base.clone().multiplyScalar(0.32 + grad * 0.78);
      colors[j * 3] = c.r;
      colors[j * 3 + 1] = c.g;
      colors[j * 3 + 2] = c.b;
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    geo.setAttribute("color", new THREE.BufferAttribute(colors, 3));

    const mat = new THREE.LineBasicMaterial({
      vertexColors: true,
      transparent: true,
      opacity: 0.85 - depth * 0.55,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });

    const line = new THREE.Line(geo, mat);
    line.userData = { depth, phase: i * 0.37 };
    scene.add(line);
    lines.push(line);
  }

  /* ---- 波形更新：多频正弦叠加 + 右上趋势 ---- */
  const updateWaves = (t) => {
    for (const line of lines) {
      const { depth, phase } = line.userData;
      const damp = 1 - depth * 0.45;
      const arr = line.geometry.attributes.position.array;
      for (let j = 0; j < SEG; j++) {
        const x = arr[j * 3];
        const y =
          Math.sin(x * 1.05 + t * 0.85 + phase) * 0.30 * damp +
          Math.sin(x * 2.35 - t * 0.55 + phase * 1.7) * 0.16 * damp +
          Math.sin(x * 4.1 + t * 0.32 + phase * 0.6) * 0.06 * damp +
          x * 0.085; /* 右上增长趋势 */
        arr[j * 3 + 1] = y;
      }
      line.geometry.attributes.position.needsUpdate = true;
    }
  };

  /* ---- 尺寸 ---- */
  const resize = () => {
    const w = canvas.clientWidth || stage.clientWidth;
    const h = canvas.clientHeight || stage.clientHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  };
  resize();
  if ("ResizeObserver" in window) {
    new ResizeObserver(resize).observe(canvas);
  } else {
    window.addEventListener("resize", resize, { passive: true });
  }

  /* ---- 鼠标视差：相机 + 标签层 ---- */
  const parallax = { x: 0, y: 0, tx: 0, ty: 0 };
  const tagLayer = document.getElementById("tag3d-layer");
  if (window.matchMedia("(pointer: fine)").matches) {
    window.addEventListener(
      "pointermove",
      (e) => {
        parallax.tx = (e.clientX / window.innerWidth - 0.5) * 2;
        parallax.ty = (e.clientY / window.innerHeight - 0.5) * 2;
      },
      { passive: true }
    );
  }

  /* ---- 能力标签：漂浮分布（右侧区域，避开左侧文案） ---- */
  if (tagLayer) {
    const LABELS = [
      "用户访谈", "需求编码", "用户分层", "A/B 实验",
      "SQL 分群", "漏斗分析", "质量评测", "回归验证",
      "Prompt", "RAG", "冷启动", "场景模板",
    ];
    /* 黄金比例伪随机：位置可复现、分布均匀 */
    let seed = 7;
    const rand = () => {
      seed = (seed * 16807 + 11) % 2147483647;
      return seed / 2147483647;
    };
    LABELS.forEach((text, i) => {
      const el = document.createElement("span");
      el.className = "tag3d";
      el.textContent = text;
      const left = 52 + rand() * 44; /* 52%–96%：右侧 */
      const top = 12 + rand() * 74;  /* 12%–86% */
      const near = rand();
      el.style.left = left + "%";
      el.style.top = top + "%";
      el.style.opacity = (0.5 + near * 0.5).toFixed(2);
      el.style.animationDelay = (rand() * -6).toFixed(2) + "s";
      el.style.animationDuration = (5 + near * 3).toFixed(2) + "s";
      tagLayer.appendChild(el);
    });
  }

  if (prefersReduced) {
    updateWaves(3.0);
    camera.lookAt(0.6, 0.15, -2);
    renderer.render(scene, camera);
    return;
  }

  const clock = new THREE.Clock();
  let raf = 0;
  const loop = () => {
    const t = clock.getElapsedTime();
    updateWaves(t);

    parallax.x += (parallax.tx - parallax.x) * 0.045;
    parallax.y += (parallax.ty - parallax.y) * 0.045;
    camera.position.x = parallax.x * 0.5;
    camera.position.y = 0.55 - parallax.y * 0.32;
    camera.lookAt(0.6, 0.15, -2);

    if (tagLayer) {
      tagLayer.style.transform =
        `translate(${(-parallax.x * 14).toFixed(1)}px, ${(-parallax.y * 10).toFixed(1)}px)`;
    }

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
