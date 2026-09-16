(() => {
  "use strict";
  document.documentElement.classList.add("js");
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
  function pulse(element) {
    if (!element || reduced.matches || !element.animate) return;
    const running = element.getAnimations();
    const current = getComputedStyle(element);
    const start = running.length
      ? { opacity: current.opacity, transform: current.transform }
      : { opacity: 0.8, transform: "translateY(6px)" };
    running.forEach((animation) => animation.cancel());
    element.animate([start, { opacity: 1, transform: "translateY(0)" }], {
      duration: 240,
      easing: "cubic-bezier(.23,1,.32,1)",
    });
  }
  reduced.addEventListener("change", () => {
    if (reduced.matches)
      document.getAnimations().forEach((animation) => animation.cancel());
  });
  function selectButtons(selector, key, value) {
    document
      .querySelectorAll(selector)
      .forEach((button) =>
        button.setAttribute(
          "aria-pressed",
          String(button.dataset[key] === String(value)),
        ),
      );
  }
  const diagnoses = {
    retention: [
      "完播表现",
      "完播偏弱，先检查前 3 秒留存。",
      "如果开头流失集中，优先检查吸引力；如果流失发生在后段，再检查叙事节奏。",
      "下一步：对照开头与后段表现，确认问题后再改写。",
      "检查前 3 秒留存，再区分开头与节奏",
    ],
    engagement: [
      "互动表现",
      "互动偏弱，先检查用户是否有回应动机。",
      "内容是否提出值得讨论的问题？先区分缺少回应契机与内容本身不相关，避免一律要求增加互动话术。",
      "下一步：检查内容与结尾，选择与主题相关的回应邀请。",
      "检查内容相关性与回应契机，再选择引导方式",
    ],
    click: [
      "点击表现",
      "点击偏弱，先检查封面传达的内容预期。",
      "标题、封面与正文承诺是否一致？先检查用户能否理解内容价值，再决定是否调整表达。",
      "下一步：对照封面与内容，明确用户点开后会获得什么。",
      "检查标题、封面与内容承诺是否一致",
    ],
  };
  let ksMode = "after",
    metric = "retention";
  function renderKs() {
    const d = diagnoses[metric],
      before = ksMode === "before";
    selectButtons("[data-ks-mode]", "ksMode", ksMode);
    selectButtons("[data-metric]", "metric", metric);
    document.getElementById("ks-label").textContent = before
      ? "通用入口 / 等待用户提问"
      : "主动诊断 / " + d[0];
    document.getElementById("ks-title").textContent = before
      ? "关于作品数据的问题，都可以问我。"
      : d[1];
    document.getElementById("ks-copy").textContent = before
      ? "用户需要先理解指标，再组织问题。查看不同维度时，入口仍然给出相同邀请。"
      : d[2];
    document.getElementById("ks-action").textContent = before
      ? "下一步：由用户自行决定问什么。"
      : d[3];
    document.getElementById("ks-reason").textContent = before
      ? "入口存在，但理解数据和组织问题的成本仍留给了用户。"
      : "把“问什么”的负担，转成一个可继续探索的问题。";
    document.getElementById("ks-rule").textContent = d[4];
    pulse(document.querySelector(".diagnosis"));
  }
  document.querySelectorAll("[data-ks-mode]").forEach((b) =>
    b.addEventListener("click", () => {
      ksMode = b.dataset.ksMode;
      renderKs();
    }),
  );
  document.querySelectorAll("[data-metric]").forEach((b) =>
    b.addEventListener("click", () => {
      metric = b.dataset.metric;
      renderKs();
    }),
  );
  let lpStep = 0;
  const judgments = [
    "“增长”可能指不同能力方向。先定位缺失约束，避免过早搜索。",
    "优先询问会改变搜索方向的条件，让下一步回答能够形成可执行画像。",
    "保留“左右”和“最好”的弹性，避免把偏好误当成硬性筛选条件。",
  ];
  function renderLp() {
    selectButtons("[data-lp-step]", "lpStep", lpStep);
    document.querySelectorAll("[data-message]").forEach((m) => {
      m.hidden = Number(m.dataset.message) > lpStep;
    });
    const fields = {
      content: "内容增长",
      industry: "短视频",
      years: "3 年左右",
    };
    document
      .querySelectorAll("[data-field]")
      .forEach(
        (f) =>
          (f.textContent = lpStep === 2 ? fields[f.dataset.field] : "待确认"),
      );
    document.getElementById("lp-judgment").textContent = judgments[lpStep];
    document.getElementById("lp-ready").textContent =
      lpStep === 2 ? "条件已确认 → 可以搜索" : "条件未完整 → 暂不搜索";
    document.getElementById("lp-progress").textContent =
      `步骤 ${lpStep + 1} / 3`;
    document.getElementById("lp-next").disabled = lpStep === 2;
    pulse(document.querySelector(".conditions"));
  }
  document.querySelectorAll("[data-lp-step]").forEach((b) =>
    b.addEventListener("click", () => {
      lpStep = Number(b.dataset.lpStep);
      renderLp();
    }),
  );
  document.getElementById("lp-next").addEventListener("click", () => {
    lpStep = Math.min(2, lpStep + 1);
    renderLp();
  });
  document.getElementById("lp-reset").addEventListener("click", () => {
    lpStep = 0;
    renderLp();
  });
  document.getElementById("lp-all").addEventListener("click", () => {
    lpStep = 2;
    renderLp();
  });
  renderLp();
  let bdStep = 1;
  const features = { records: true, status: true, reminders: true };
  const names = {
    records: "跟进记录",
    status: "状态流转",
    reminders: "到期提醒",
  };
  function renderBd() {
    selectButtons("[data-bd-step]", "bdStep", bdStep);
    document.getElementById("bd-options").hidden = bdStep !== 1;
    document.getElementById("bd-stage").textContent = [
      "原始业务诉求",
      "确认 AI 理解的业务规则",
      "检查可以运行的业务流程",
    ][bdStep];
    document.getElementById("bd-preview-label").textContent = [
      "仅按字面理解",
      "计划预览",
      "应用预览",
    ][bdStep];
    document
      .querySelectorAll("[data-preview]")
      .forEach(
        (p) => (p.hidden = bdStep === 0 || !features[p.dataset.preview]),
      );
    const chosen = Object.keys(features).filter((k) => features[k]);
    document.getElementById("bd-summary").textContent =
      bdStep === 0
        ? "原始输入没有明确字段、跟进状态和提醒规则。"
        : chosen.length
          ? "计划包含：" + chosen.map((k) => names[k]).join("、") + "。"
          : "计划只保留客户信息，尚未加入跟进流程。";
    document.getElementById("crm-empty").hidden =
      bdStep !== 0 && chosen.length > 0;
    document.getElementById("bd-judgment").textContent = [
      "同一个“客户跟进”诉求，可能被理解成一张客户表。页面可运行，还不足以证明业务可用。",
      "增加确认步骤会增加操作成本，因此用可理解的选择项，让用户检查 AI 的补全是否符合业务。",
      "在预览中检查状态能否流转、记录是否完整、提醒是否符合当前阶段，而不只看页面有没有生成。",
    ][bdStep];
    pulse(document.querySelector(".crm-card"));
  }
  document.querySelectorAll("[data-bd-step]").forEach((b) =>
    b.addEventListener("click", () => {
      bdStep = Number(b.dataset.bdStep);
      renderBd();
    }),
  );
  document.querySelectorAll("[data-feature]").forEach((input) =>
    input.addEventListener("change", () => {
      features[input.dataset.feature] = input.checked;
      renderBd();
    }),
  );
  document.getElementById("crm-status").addEventListener("change", (event) => {
    document.getElementById("crm-reminder").textContent =
      event.target.value === "已完成"
        ? "当前已完成，无需继续跟进提醒"
        : "到期时提醒负责人";
    pulse(document.querySelector(".reminder"));
  });
  renderBd();
  if ("IntersectionObserver" in window && !reduced.matches) {
    const observer = new IntersectionObserver(
      (entries) =>
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            pulse(entry.target);
            observer.unobserve(entry.target);
          }
        }),
      { threshold: 0.15 },
    );
    document
      .querySelectorAll(".case-head,.outcomes,.methods")
      .forEach((element) => observer.observe(element));
  }
})();
