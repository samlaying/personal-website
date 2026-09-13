/* 林承列 · 个人主页 —— 交互脚本 */
(() => {
  "use strict";

  const prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)");

  /* ---- 页脚年份 ---- */
  const year = document.getElementById("year");
  if (year) {
    year.textContent = new Intl.DateTimeFormat("zh-CN", { year: "numeric" }).format(new Date());
  }

  /* ---- 滚动入场动画 ---- */
  const revealEls = document.querySelectorAll(".reveal");
  if (prefersReduced.matches || !("IntersectionObserver" in window)) {
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

  /* ---- 首屏战绩数字 count-up ---- */
  const counters = document.querySelectorAll(".count[data-count]");
  const runCount = (el) => {
    const target = Number(el.dataset.count) || 0;
    const suffix = el.dataset.suffix || "";
    const duration = 1400;
    const start = performance.now();
    const easeOut = (t) => 1 - Math.pow(1 - t, 3);
    const tick = (now) => {
      const p = Math.min((now - start) / duration, 1);
      el.textContent = Math.round(easeOut(p) * target) + suffix;
      if (p < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  };

  if (prefersReduced.matches || !("IntersectionObserver" in window)) {
    /* 保持 HTML 中的静态最终值 */
  } else {
    const countIO = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            runCount(entry.target);
            countIO.unobserve(entry.target);
          }
        }
      },
      { threshold: 0.6 }
    );
    counters.forEach((el) => countIO.observe(el));
  }

  /* ---- 导航当前区域高亮（scroll spy） ---- */
  const navLinks = Array.from(document.querySelectorAll(".nav-link"));
  const sections = navLinks
    .map((link) => document.querySelector(link.getAttribute("href")))
    .filter(Boolean);

  if (sections.length && "IntersectionObserver" in window) {
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
