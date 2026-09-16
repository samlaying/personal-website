/* 林承列 · 个人主页 —— 交互脚本 */
(() => {
  "use strict";

  const prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)");
  const hasIO = "IntersectionObserver" in window;

  /* ---- 页脚年份 ---- */
  const year = document.getElementById("year");
  if (year) {
    year.textContent = new Intl.DateTimeFormat("zh-CN", { year: "numeric" }).format(new Date());
  }

  /* ---- 数字补间（count-up / ab 切换共用） ---- */
  const tween = (el, to, { suffix = "", duration = 1100 } = {}) => {
    const from = Number(String(el.dataset.now ?? el.textContent).replace(/[^\d.]/g, "")) || 0;
    const start = performance.now();
    const easeOut = (t) => 1 - Math.pow(1 - t, 3);
    const tick = (now) => {
      const p = Math.min((now - start) / duration, 1);
      const val = Math.round(from + (to - from) * easeOut(p));
      el.textContent = val + suffix;
      if (p < 1) requestAnimationFrame(tick);
      else el.dataset.now = String(to);
    };
    requestAnimationFrame(tick);
  };

  /* ---- 滚动入场动画 ---- */
  const revealEls = document.querySelectorAll(".reveal");
  if (prefersReduced.matches || !hasIO) {
    revealEls.forEach((el) => el.classList.add("in"));
  } else {
    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            entry.target.classList.add("in");
            io.unobserve(entry.target);
          }
        }
      },
      { threshold: 0.1, rootMargin: "0px 0px -6% 0px" }
    );
    revealEls.forEach((el) => io.observe(el));
  }

  /* ---- 首屏战绩保持真实值，避免数字抽奖式滚动 ---- */
  document.querySelectorAll(".count[data-count]").forEach((el) => {
    el.textContent = `${el.dataset.count}${el.dataset.suffix || ""}`;
  });

  /* ---- 顶部滚动进度条 ---- */
  const progressBar = document.querySelector(".progress-bar");
  if (progressBar) {
    let ticking = false;
    const update = () => {
      const doc = document.documentElement;
      const max = doc.scrollHeight - window.innerHeight;
      const ratio = max > 0 ? Math.min(window.scrollY / max, 1) : 0;
      progressBar.style.transform = `scaleX(${ratio})`;
      ticking = false;
    };
    window.addEventListener(
      "scroll",
      () => {
        if (!ticking) {
          ticking = true;
          requestAnimationFrame(update);
        }
      },
      { passive: true }
    );
    update();
  }

  /* ---- A/B 方案切换器（快手） ---- */
  const abDemo = document.querySelector(".ab-demo");
  if (abDemo) {
    const btns = abDemo.querySelectorAll(".ab-btn");
    const panels = abDemo.querySelectorAll("[data-ab-panel]");
    const value = abDemo.querySelector("[data-ab-value]");
    const targets = { control: 11, treatment: 39 };

    btns.forEach((btn) => {
      btn.addEventListener("click", () => {
        const key = btn.dataset.ab;
        btns.forEach((b) => b.classList.toggle("is-active", b === btn));
        panels.forEach((p) => {
          p.hidden = p.dataset.abPanel !== key;
        });
        if (value) {
          if (prefersReduced.matches) value.textContent = targets[key] + "%";
          else tween(value, targets[key], { suffix: "%" });
        }
      });
    });
  }

  /* ---- Agent 对话演示（猎聘）：逐条入场 + 重放 ---- */
  const chatWindow = document.querySelector(".chat-window");
  if (chatWindow && !prefersReduced.matches && hasIO) {
    const msgs = Array.from(chatWindow.querySelectorAll(".msg"));
    const tags = Array.from(chatWindow.querySelectorAll(".chat-tag"));
    const replayBtn = document.querySelector(".chat-replay");
    let timers = [];

    const play = () => {
      timers.forEach(clearTimeout);
      timers = [];
      msgs.forEach((m) => m.classList.remove("is-in"));
      tags.forEach((t) => t.classList.remove("is-in"));
      chatWindow.classList.add("chat-armed");

      let delay = 400;
      msgs.forEach((m) => {
        delay += m.classList.contains("msg-final") ? 900 : 700;
        timers.push(setTimeout(() => m.classList.add("is-in"), delay));
      });
      tags.forEach((t, i) => {
        timers.push(setTimeout(() => t.classList.add("is-in"), delay + 350 + i * 160));
      });
    };

    const chatIO = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            play();
            chatIO.disconnect();
          }
        }
      },
      { threshold: 0.35 }
    );
    chatIO.observe(chatWindow);

    if (replayBtn) replayBtn.addEventListener("click", play);
  }

  /* ---- 猎聘三态：模糊需求 → 澄清约束 → 确认搜索 ---- */
  const chatStates = document.querySelectorAll("[data-chat-state]");
  const chatStateCopy = {
    vague: "找个懂增长的人",
    clear: "内容增长，3 年左右，最好有短视频行业经验",
    search: "约束已补全 → 生成精准搜索"
  };
  chatStates.forEach((button) => button.addEventListener("click", () => {
    const state = button.dataset.chatState;
    chatStates.forEach((item) => {
      const active = item === button;
      item.classList.toggle("is-active", active);
      item.setAttribute("aria-pressed", String(active));
    });
    const final = chatWindow?.querySelector(".msg-final");
    if (final && state === "search") final.firstChild.textContent = chatStateCopy.search;
    else if (chatWindow && state !== "search") {
      const user = chatWindow.querySelector(".msg-user");
      if (user) user.textContent = chatStateCopy[state];
    }
  }));

  /* ---- 百度步骤与预览联动 ---- */
  const baiduSteps = document.querySelectorAll("[data-step]");
  const pipeline = document.querySelector("#exp-baidu .pipeline");
  baiduSteps.forEach((button) => button.addEventListener("click", () => {
    const state = button.dataset.step;
    baiduSteps.forEach((item) => {
      const active = item === button;
      item.classList.toggle("is-active", active);
      item.setAttribute("aria-selected", String(active));
    });
    if (pipeline) pipeline.dataset.step = state;
  }));

  /* ---- Skill 流水线依次点亮（百度） ---- */
  const pipelines = document.querySelectorAll(".pipeline");
  if (pipelines.length && !prefersReduced.matches && hasIO) {
    pipelines.forEach((pipe) => {
      const nodes = Array.from(pipe.querySelectorAll(".pipe-node"));
      const links = Array.from(pipe.querySelectorAll(".pipe-link"));

      const pipeIO = new IntersectionObserver(
        (entries) => {
          for (const entry of entries) {
            if (!entry.isIntersecting) continue;
            pipeIO.disconnect();
            pipe.classList.add("pipe-armed");
            nodes.forEach((n) => n.classList.remove("is-lit"));
            links.forEach((l) => l.classList.remove("is-lit"));
            nodes.forEach((n, i) => {
              setTimeout(() => n.classList.add("is-lit"), 350 + i * 550);
            });
            links.forEach((l, i) => {
              setTimeout(() => l.classList.add("is-lit"), 350 + i * 550 + 380);
            });
          }
        },
        { threshold: 0.4 }
      );
      pipeIO.observe(pipe);
    });
  }

  /* ---- 导航当前区域高亮（scroll spy） ---- */
  const navLinks = Array.from(document.querySelectorAll(".nav-link"));
  const sections = navLinks
    .map((link) => document.querySelector(link.getAttribute("href")))
    .filter(Boolean);

  if (sections.length && hasIO) {
    const spy = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          navLinks.forEach((link) => {
            const isActive = link.getAttribute("href") === "#" + entry.target.id;
            link.classList.toggle("active", isActive);
            if (isActive) link.setAttribute("aria-current", "true");
            else link.removeAttribute("aria-current");
          });
        }
      },
      { rootMargin: "-40% 0px -55% 0px" }
    );
    sections.forEach((sec) => spy.observe(sec));
  }
})();
