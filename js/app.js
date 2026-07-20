/* MathClicks — all site logic.
   Content lives in data/topics/*.json; this file never needs editing to add lessons. */

"use strict";

// Cache-buster so students always see freshly published content
const BUST = "?t=" + Date.now();

// ---------- localStorage keys ----------
// Old "satpractice." keys are kept for best scores so nobody loses progress.

const K_THEME = "mathclicks.theme";
const K_EXAM = "mathclicks.examDate";
const K_LAST = "mathclicks.lastVisited";
const K_TRACK = "mathclicks.track";
const statusKey = (id) => "mathclicks.status." + id;
const scoreKey = (id) => "satpractice.best." + id;

// ---------- Data loading ----------

let TOPICS = [];          // published lessons, in curriculum order

const DOMAIN_ICONS = {
  "Algebra": "➗",
  "Advanced Math": "🧮",
  "Problem-Solving and Data Analysis": "📊",
  "Geometry and Trigonometry": "📐",
};
const MODULE_ICON = "📘";

async function boot() {
  const manifest = await (await fetch("data/manifest.json" + BUST)).json();
  const all = await Promise.all(
    manifest.topics.map((f) => fetch("data/topics/" + f + BUST).then((r) => r.json()))
  );
  // Students only ever see lessons marked ready by the teacher
  TOPICS = all.filter((t) => t.published);
  window.addEventListener("hashchange", route);
  initHeader();
  initFormulaPanel();
  initModal();
  route();
}

boot().catch((err) => {
  console.error("boot failed:", err);
  const main = document.getElementById("main");
  main.replaceChildren();
  const note = document.createElement("div");
  note.className = "empty-note";
  note.textContent = "Couldn't load the lessons — check your connection and refresh the page.";
  main.appendChild(note);
});

// Modules in curriculum order (first appearance wins)
function moduleList() {
  const seen = new Map();
  for (const t of TOPICS) {
    if (!seen.has(t.curriculumModule)) seen.set(t.curriculumModule, []);
    seen.get(t.curriculumModule).push(t);
  }
  return [...seen.entries()].map(([name, topics]) => ({ name, topics }));
}

const moduleSlug = (name) =>
  name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const domainSlug = moduleSlug;

const qCount = (t) => t.questions.length;
const plural = (n, word) => `${n} ${word}${n === 1 ? "" : "s"}`;
const domClass = (domain) => "dom-" + domainSlug(domain);

// A lesson's track: "igcse" if its JSON says so, otherwise SAT
const topicTrack = (t) => (t.track === "igcse" ? "igcse" : "sat");
const moduleTrack = (m) => topicTrack(m.topics[0]);

// ---------- Progress persistence (all localStorage, no accounts) ----------

function bestScore(id) {
  try { return JSON.parse(localStorage.getItem(scoreKey(id))); }
  catch { return null; }
}

function saveScore(id, correct, total) {
  const prev = bestScore(id);
  if (!prev || prev.total !== total || correct > prev.correct) {
    localStorage.setItem(scoreKey(id), JSON.stringify({ correct, total }));
  }
}

// Lesson status: null = not started, "progress", "done"
const lessonStatus = (id) => localStorage.getItem(statusKey(id));
function setLessonStatus(id, s) {
  if (s) localStorage.setItem(statusKey(id), s);
  else localStorage.removeItem(statusKey(id));
}

// A lesson counts as done if marked done, or a perfect quiz score exists
function isDone(id) {
  if (lessonStatus(id) === "done") return true;
  const b = bestScore(id);
  return !!(b && b.total > 0 && b.correct === b.total);
}

function isStarted(id) {
  return !!lessonStatus(id) || !!bestScore(id);
}

// Module status from its lessons
function moduleStatus(m) {
  if (m.topics.every((t) => isDone(t.id))) return "done";
  if (m.topics.some((t) => isStarted(t.id))) return "progress";
  return "none";
}

// Last-visited lesson (for the Resume banner / button)
function lastVisited() {
  try {
    const v = JSON.parse(localStorage.getItem(K_LAST));
    return v && TOPICS.find((t) => t.id === v.id) || null;
  } catch { return null; }
}

// ---------- Routing ----------

const main = document.getElementById("main");
let pendingScroll = null; // section to scroll to after the next home render

function route() {
  const parts = (location.hash || "#/").slice(2).split("/");
  const view = parts[0] || "home";
  window.scrollTo(0, 0);
  main.dataset.view = view;
  if (view === "module") renderModule(decodeURIComponent(parts[1] || ""));
  else if (view === "topic") renderTopic(decodeURIComponent(parts[1] || ""));
  else if (view === "modules" || view === "igcse") {
    if (view === "igcse") localStorage.setItem(K_TRACK, "igcse");
    pendingScroll = pendingScroll || "#browse";
    renderHome();
  } else renderHome();
  typeset(main);
  if (pendingScroll) {
    const target = document.querySelector(pendingScroll);
    pendingScroll = null;
    if (target) requestAnimationFrame(() =>
      target.scrollIntoView({ behavior: "smooth", block: "start" }));
  }
}

function goHome(section) {
  pendingScroll = section;
  if ((location.hash || "#/") === "#/" || location.hash.startsWith("#/modules")) route();
  else location.hash = "#/";
}

function typeset(el) {
  if (window.renderMathInElement) {
    window.renderMathInElement(el, {
      delimiters: [
        { left: "$$", right: "$$", display: true },
        { left: "$", right: "$", display: false },
      ],
      throwOnError: false,
    });
  }
}

// ---------- Small DOM helpers (textContent only — content stays plain text) ----------

function el(tag, className, text) {
  const n = document.createElement(tag);
  if (className) n.className = className;
  if (text != null) n.textContent = text;
  return n;
}

// ---------- Header: exam countdown + dark mode + quick actions ----------

function initHeader() {
  // Dark mode
  const toggle = document.getElementById("theme-toggle");
  const setIcon = () =>
    (toggle.textContent = document.documentElement.dataset.theme === "dark" ? "☀️" : "🌙");
  setIcon();
  toggle.addEventListener("click", () => {
    const dark = document.documentElement.dataset.theme === "dark";
    if (dark) delete document.documentElement.dataset.theme;
    else document.documentElement.dataset.theme = "dark";
    localStorage.setItem(K_THEME, dark ? "light" : "dark");
    setIcon();
  });

  // Exam-date countdown
  updateExamChip();
  document.getElementById("exam-chip").addEventListener("click", openExamModal);

  // "What do you need right now?" buttons
  document.getElementById("need-trick").addEventListener("click", () => goHome("#quick-wins"));
  document.getElementById("need-new").addEventListener("click", () => goHome("#browse"));
  document.getElementById("need-resume").addEventListener("click", () => {
    const last = lastVisited();
    if (last) location.hash = "#/topic/" + last.id;
    else goHome("#browse");
  });
}

function daysToExam() {
  const d = localStorage.getItem(K_EXAM);
  if (!d) return null;
  const exam = new Date(d + "T00:00:00");
  const today = new Date(); today.setHours(0, 0, 0, 0);
  return Math.round((exam - today) / 86400000);
}

function updateExamChip() {
  const label = document.getElementById("exam-chip-label");
  const days = daysToExam();
  if (days == null) label.textContent = "My exam date";
  else if (days > 1) label.textContent = `${days} days to exam`;
  else if (days === 1) label.textContent = "Exam tomorrow!";
  else if (days === 0) label.textContent = "Exam day — you've got this!";
  else label.textContent = "Exam done 🎉";
}

function openExamModal() {
  const box = el("div", "exam-modal");
  box.appendChild(el("h3", "modal-title", "📅 My exam date"));
  box.appendChild(el("p", "modal-sub",
    "Set it once — the header will count down the days for you. Saved on this device only."));
  const input = document.createElement("input");
  input.type = "date";
  input.className = "exam-input";
  input.value = localStorage.getItem(K_EXAM) || "";
  box.appendChild(input);
  const actions = el("div", "modal-actions");
  const save = el("button", "btn btn-cta", "Save");
  save.addEventListener("click", () => {
    if (input.value) localStorage.setItem(K_EXAM, input.value);
    updateExamChip();
    closeModal();
  });
  actions.appendChild(save);
  if (localStorage.getItem(K_EXAM)) {
    const clear = el("button", "btn btn-quiet", "Remove");
    clear.addEventListener("click", () => {
      localStorage.removeItem(K_EXAM);
      updateExamChip();
      closeModal();
    });
    actions.appendChild(clear);
  }
  box.appendChild(actions);
  openModal(box);
}

// ---------- Generic modal ----------

const modal = document.getElementById("modal");
const modalBody = document.getElementById("modal-body");

function initModal() {
  document.getElementById("modal-close").addEventListener("click", closeModal);
  modal.addEventListener("click", (e) => { if (e.target === modal) closeModal(); });
  document.addEventListener("keydown", (e) => {
    if (e.key !== "Escape") return;
    if (!modal.classList.contains("hidden")) closeModal();
    else if (fpanel.classList.contains("open")) closeFormulas();
  });
}

function openModal(content) {
  modalBody.replaceChildren(content);
  modal.classList.remove("hidden");
  document.body.classList.add("no-scroll");
  typeset(modalBody);
}

function closeModal() {
  modal.classList.add("hidden");
  document.body.classList.remove("no-scroll");
}

// ---------- Views ----------

function renderHome() {
  main.replaceChildren();
  main.appendChild(resumeBanner());
  main.appendChild(quickWinsSection());
  main.appendChild(browseSection());
}

// Hero: "pick up where you left off" (or a friendly first-visit default)
function resumeBanner() {
  const hero = el("section", "hero hero--dash");
  const syms = el("div", "hero-symbols");
  ["∑", "π", "√x", "x²"].forEach((s, i) =>
    syms.appendChild(el("span", "sym s" + (i + 1), s))
  );
  hero.appendChild(syms);

  const inner = el("div", "hero-inner");
  const last = lastVisited();
  const target = last || TOPICS[0];

  if (last) {
    inner.appendChild(el("div", "hero-eyebrow", "Welcome back 👋"));
    inner.appendChild(el("p", "hero-kicker", "Pick up where you left off:"));
    inner.appendChild(el("h1", "hero-title hero-title--sm", `${last.lessonCode} ${last.title}`));
  } else if (target) {
    inner.appendChild(el("div", "hero-eyebrow", "New here? 👋"));
    inner.appendChild(el("p", "hero-kicker", "Start with our most popular lesson:"));
    inner.appendChild(el("h1", "hero-title hero-title--sm", `${target.lessonCode} ${target.title}`));
  } else {
    inner.appendChild(el("div", "hero-eyebrow", "MathClicks"));
    inner.appendChild(el("h1", "hero-title hero-title--sm", "Lessons are on their way!"));
  }

  const cta = el("div", "hero-cta");
  if (target) {
    const go = el("a", "btn btn-cta", last ? "▶ Resume" : "▶ Start now");
    go.href = "#/topic/" + target.id;
    cta.appendChild(go);
  }
  const browse = el("button", "btn btn-ghost", "Browse all topics");
  browse.addEventListener("click", () => goHome("#browse"));
  cta.appendChild(browse);
  inner.appendChild(cta);
  hero.appendChild(inner);
  return hero;
}

// ---------- Quick Wins & Mental Math ----------

const TRICKS = [
  { id: "x11", icon: "✖️", cls: "qw-coral", title: "×11 Multiplication",
    sub: "Multiply by 11 in your head — instantly." },
  { id: "pct", icon: "🔄", cls: "qw-teal", title: "Percentage Swaps",
    sub: "8% of 50 is hard. 50% of 8 is easy. Same thing!" },
  { id: "odd", icon: "🟨", cls: "qw-yellow", title: "Squares = Odd Sums",
    sub: "Every square number hides a staircase of odd numbers." },
  { id: "calc", icon: "⏱️", cls: "qw-navy", title: "30-Second SAT Calculator",
    sub: "Desmos shortcuts that solve questions for you." },
];

function quickWinsSection() {
  const sec = el("section", "qw-section");
  sec.id = "quick-wins";
  sec.appendChild(el("h2", "home-sec-title", "⚡ Quick Wins & Mental Math"));
  sec.appendChild(el("p", "home-sec-sub", "Two-minute tricks that make you faster on test day."));

  const wrap = el("div", "qw-wrap");
  const row = el("div", "qw-row");
  for (const tr of TRICKS) {
    const card = el("button", "qw-card " + tr.cls);
    card.type = "button";
    card.appendChild(el("span", "qw-icon", tr.icon));
    card.appendChild(el("span", "qw-title", tr.title));
    card.appendChild(el("span", "qw-sub", tr.sub));
    card.appendChild(el("span", "qw-go", "Try it →"));
    card.addEventListener("click", () => openTrick(tr.id));
    row.appendChild(card);
  }

  const mkArrow = (dir) => {
    const b = el("button", "qw-arrow qw-arrow--" + dir, dir === "left" ? "‹" : "›");
    b.type = "button";
    b.setAttribute("aria-label", dir === "left" ? "Scroll tricks left" : "Scroll tricks right");
    b.addEventListener("click", () =>
      row.scrollBy({ left: (dir === "left" ? -1 : 1) * (row.clientWidth * 0.8), behavior: "smooth" }));
    return b;
  };
  wrap.appendChild(mkArrow("left"));
  wrap.appendChild(row);
  wrap.appendChild(mkArrow("right"));
  sec.appendChild(wrap);
  return sec;
}

function openTrick(id) {
  const box = el("div", "trick");
  if (id === "x11") trickX11(box);
  else if (id === "pct") trickPct(box);
  else if (id === "odd") trickOdd(box);
  else trickCalc(box);
  openModal(box);
}

// ×11: split the digits, add them, tuck the sum in the middle
function trickX11(box) {
  box.appendChild(el("h3", "modal-title", "✖️ Multiply by 11 — instantly"));
  box.appendChild(el("p", "modal-sub",
    "For any two-digit number: split the digits apart, add them, and tuck the sum in the middle."));

  const ctrl = el("div", "trick-ctrl");
  const input = document.createElement("input");
  input.type = "number"; input.min = 10; input.max = 99; input.value = 45;
  input.className = "trick-input";
  input.setAttribute("aria-label", "Two-digit number");
  const btn = el("button", "btn btn-cta", "Show me");
  ctrl.appendChild(el("span", "trick-lbl", "Pick a two-digit number:"));
  ctrl.appendChild(input);
  ctrl.appendChild(btn);
  box.appendChild(ctrl);

  const out = el("div", "trick-out");
  box.appendChild(out);

  function show() {
    const n = Math.floor(Number(input.value));
    if (!(n >= 10 && n <= 99)) {
      out.replaceChildren(el("p", "trick-warn", "Pick a number from 10 to 99."));
      return;
    }
    const a = Math.floor(n / 10), b = n % 10, s = a + b;
    out.replaceChildren();
    const steps = [];
    steps.push([`1. Split the digits`, `${n} → ${a} _ ${b}`]);
    steps.push([`2. Add them`, `${a} + ${b} = ${s}`]);
    if (s < 10) {
      steps.push([`3. Tuck the sum in the middle`, `${a} ${s} ${b} → ${n * 11}`]);
    } else {
      steps.push([`3. Sum is ${s} — write ${s - 10}, carry the 1`, `(${a}+1) ${s - 10} ${b}`]);
      steps.push([`4. So the answer is`, `${n} × 11 = ${n * 11}`]);
    }
    steps.forEach(([label, math], i) => {
      const st = el("div", "trick-step");
      st.style.animationDelay = i * 0.35 + "s";
      st.appendChild(el("div", "trick-step-lbl", label));
      st.appendChild(el("div", "trick-step-math", math));
      out.appendChild(st);
    });
    const check = el("p", "trick-check", `Check it: ${n} × 11 = ${n * 11} ✓`);
    check.style.animationDelay = steps.length * 0.35 + "s";
    out.appendChild(check);
  }
  btn.addEventListener("click", show);
  input.addEventListener("keydown", (e) => { if (e.key === "Enter") show(); });
  show();
}

// a% of b = b% of a
function trickPct(box) {
  box.appendChild(el("h3", "modal-title", "🔄 Percentage Swaps"));
  box.appendChild(el("p", "modal-sub",
    "x% of y is always the same as y% of x — so flip the pair to whichever side is easier."));

  const ctrl = el("div", "trick-ctrl");
  const mk = (v) => {
    const i = document.createElement("input");
    i.type = "number"; i.value = v; i.min = 0; i.className = "trick-input";
    return i;
  };
  const a = mk(8), b = mk(50);
  ctrl.appendChild(a);
  ctrl.appendChild(el("span", "trick-lbl", "% of"));
  ctrl.appendChild(b);
  box.appendChild(ctrl);

  const out = el("div", "trick-out");
  box.appendChild(out);

  const presets = el("div", "trick-presets");
  for (const [pa, pb] of [[8, 50], [4, 75], [16, 25], [7, 300]]) {
    const p = el("button", "trick-preset", `${pa}% of ${pb}`);
    p.type = "button";
    p.addEventListener("click", () => { a.value = pa; b.value = pb; show(); });
    presets.appendChild(p);
  }
  box.appendChild(presets);

  function show() {
    const av = Number(a.value), bv = Number(b.value);
    out.replaceChildren();
    if (!isFinite(av) || !isFinite(bv)) return;
    const val = Math.round(av * bv) / 100;
    const line = el("div", "trick-step trick-step--big");
    line.appendChild(el("div", "trick-step-math",
      `${av}% of ${bv}  =  ${bv}% of ${av}  =  ${val}`));
    out.appendChild(line);
    out.appendChild(el("p", "trick-check",
      "Flip it whenever one side lands on an easy percent like 50%, 25%, or 10%."));
  }
  a.addEventListener("input", show);
  b.addEventListener("input", show);
  show();
}

// n² = sum of the first n odd numbers
function trickOdd(box) {
  box.appendChild(el("h3", "modal-title", "🟨 Square numbers are stacks of odd numbers"));
  box.appendChild(el("p", "modal-sub",
    "n² is the sum of the first n odd numbers. Each L-shaped layer adds the next odd number."));

  const ctrl = el("div", "trick-ctrl");
  const slider = document.createElement("input");
  slider.type = "range"; slider.min = 1; slider.max = 10; slider.value = 4;
  slider.setAttribute("aria-label", "n");
  const outN = el("output", "trick-n", "n = 4");
  ctrl.appendChild(outN);
  ctrl.appendChild(slider);
  box.appendChild(ctrl);

  const svgBox = el("div", "trick-svg");
  const line = el("div", "trick-step-math trick-oddline");
  box.appendChild(svgBox);
  box.appendChild(line);

  const colors = ["#FF6B5C", "#0CA678", "#FFC43D", "#3B5BDB", "#7048E8"];
  function show() {
    const n = Number(slider.value);
    outN.textContent = "n = " + n;
    const cell = 26, pad = 8, size = n * cell + pad * 2;
    let dots = "";
    for (let r = 0; r < n; r++)
      for (let c = 0; c < n; c++) {
        const ring = Math.max(r, c);
        dots += `<circle cx="${pad + c * cell + cell / 2}" cy="${pad + r * cell + cell / 2}" r="9" fill="${colors[ring % colors.length]}" opacity="0.9"/>`;
      }
    svgBox.innerHTML =
      `<svg viewBox="0 0 ${size} ${size}" style="max-width:${size}px" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="dot grid">${dots}</svg>`;
    const odds = Array.from({ length: n }, (_, k) => 2 * k + 1);
    line.textContent = `${n}² = ${odds.join(" + ")} = ${n * n}`;
  }
  slider.addEventListener("input", show);
  show();
}

// Desmos / calculator shortcuts for the digital SAT
function trickCalc(box) {
  box.appendChild(el("h3", "modal-title", "⏱️ 30-Second SAT Calculator Shortcuts"));
  box.appendChild(el("p", "modal-sub",
    "The digital SAT has Desmos built in. Let it do the algebra for you:"));
  const tips = [
    ["Solve any equation by graphing", "Type each side as its own graph (y = left side, y = right side). The x-value of the intersection is your answer."],
    ["Systems of equations", "Type both equations exactly as written. Click the intersection point — that's (x, y). Done."],
    ["Quadratics: roots & vertex", "Graph the quadratic and tap the gray points — Desmos labels the x-intercepts and the vertex for you."],
    ["\"Which value of x…\" questions", "Graph the equation, then just look — no factoring, no quadratic formula needed."],
    ["Mean & median instantly", "Type mean(1,4,6,6,13) or median(...) with the list from the question."],
    ["Sliders for unknown constants", "If a question has an unknown constant k, type it as a slider and drag until the condition works."],
  ];
  const list = el("div", "trick-tips");
  tips.forEach(([t, d], i) => {
    const tip = el("div", "trick-tip");
    tip.appendChild(el("div", "trick-tip-num", String(i + 1)));
    const bdy = el("div");
    bdy.appendChild(el("div", "trick-tip-title", t));
    bdy.appendChild(el("div", "trick-tip-sub", d));
    tip.appendChild(bdy);
    list.appendChild(tip);
  });
  box.appendChild(list);
}

// ---------- Topics & Modules grid ----------

function browseSection() {
  const sec = el("section", "browse-section");
  sec.id = "browse";

  const head = el("div", "browse-head");
  head.appendChild(el("h2", "home-sec-title", "📚 Topics & Modules"));

  // IGCSE / SAT track filter
  const track = localStorage.getItem(K_TRACK) === "igcse" ? "igcse" : "sat";
  const toggle = el("div", "track-toggle");
  toggle.setAttribute("role", "tablist");
  for (const [val, label] of [["sat", "SAT"], ["igcse", "IGCSE"]]) {
    const b = el("button", "track-btn track-btn--" + val + (val === track ? " active" : ""), label);
    b.type = "button";
    b.setAttribute("role", "tab");
    b.setAttribute("aria-selected", String(val === track));
    b.addEventListener("click", () => {
      localStorage.setItem(K_TRACK, val);
      pendingScroll = "#browse";
      renderHome();
      const t2 = document.querySelector(pendingScroll);
      pendingScroll = null;
      if (t2) t2.scrollIntoView({ block: "start" });
    });
    toggle.appendChild(b);
  }
  head.appendChild(toggle);
  sec.appendChild(head);

  const modules = moduleList().filter((m) => moduleTrack(m) === track);

  if (!modules.length) {
    const box = el("div", "empty-note big");
    box.appendChild(el("div", "empty-emoji", track === "igcse" ? "🚧" : "📚"));
    box.appendChild(el("div", "empty-title", "Coming soon!"));
    box.appendChild(el("p", null, track === "igcse"
      ? "IGCSE lessons are being prepared. In the meantime, the SAT track is ready for you."
      : "Lessons will appear here as we cover them in class — check back soon!"));
    sec.appendChild(box);
    return sec;
  }

  // Quick stats
  const totalQ = modules.reduce((s, m) => s + m.topics.reduce((x, t) => x + qCount(t), 0), 0);
  const lessons = modules.reduce((s, m) => s + m.topics.length, 0);
  const done = modules.reduce((s, m) => s + m.topics.filter((t) => isDone(t.id)).length, 0);
  const strip = el("div", "stats");
  strip.appendChild(el("span", "stat-chip", `📚 ${plural(lessons, "lesson")}`));
  strip.appendChild(el("span", "stat-chip", `📝 ${plural(totalQ, "question")}`));
  if (done) strip.appendChild(el("span", "stat-chip", `⭐ ${done} completed`));
  sec.appendChild(strip);

  const grid = el("div", "module-grid");
  for (const m of modules) grid.appendChild(moduleGridCard(m));
  sec.appendChild(grid);
  return sec;
}

const STATUS_LABELS = { done: "✓ Completed", progress: "In Progress", none: "Not Started" };

function moduleGridCard(m) {
  const track = moduleTrack(m);
  const a = el("a", "gcard track-" + track);
  a.href = "#/module/" + moduleSlug(m.name);

  const top = el("div", "gcard-top");
  top.appendChild(el("span", "gcard-track", track.toUpperCase()));
  const st = moduleStatus(m);
  top.appendChild(el("span", "gcard-status st-" + st, STATUS_LABELS[st]));
  a.appendChild(top);

  a.appendChild(el("div", "gcard-icon", MODULE_ICON));
  a.appendChild(el("div", "gcard-title", m.name));
  const total = m.topics.reduce((s, t) => s + qCount(t), 0);
  a.appendChild(el("div", "gcard-sub",
    `${plural(m.topics.length, "lesson")} · ${total ? plural(total, "question") : "coming soon"}`));

  const done = m.topics.filter((t) => isDone(t.id)).length;
  const bar = el("div", "mprog-bar");
  const fill = el("div", "mprog-fill");
  fill.style.width = (done / m.topics.length) * 100 + "%";
  bar.appendChild(fill);
  a.appendChild(bar);
  a.appendChild(el("div", "mprog-label", `${done}/${m.topics.length} done`));
  return a;
}

function renderModule(slug) {
  const m = moduleList().find((m) => moduleSlug(m.name) === slug);
  if (!m) return renderHome();
  main.replaceChildren();
  main.appendChild(backLink("#/", "← All topics"));
  main.appendChild(el("h2", "page-title", m.name));
  m.topics.forEach((t, i) => main.appendChild(lessonCard(t, i)));
}

function lessonCard(t, i) {
  const a = el("a", "card " + domClass(t.satDomain));
  a.href = "#/topic/" + t.id;
  const done = isDone(t.id);
  a.appendChild(el("div", "step-dot" + (done ? " done" : ""), done ? "✓" : String(i + 1)));
  const body = el("div", "card-body");
  const title = el("div", "card-title", t.title);
  title.appendChild(countBadge(t));
  body.appendChild(title);
  const extras = [t.lessonCode, `${DOMAIN_ICONS[t.satDomain] || ""} ${t.satDomain}`];
  if (t.videos && t.videos.length) extras.push(`🎬 ${plural(t.videos.length, "video")}`);
  if (!done && lessonStatus(t.id) === "progress") extras.push("🕐 in progress");
  body.appendChild(el("div", "card-sub", extras.join(" · ")));
  a.appendChild(body);
  a.appendChild(el("span", "card-arrow", "›"));
  return a;
}

function countBadge(t) {
  const n = qCount(t);
  const best = bestScore(t.id);
  if (best && best.total === n && n > 0) {
    return el("span", "badge score", `⭐ ${best.correct}/${best.total}`);
  }
  return el("span", "badge" + (n ? "" : " soon"), n ? plural(n, "question") : "coming soon");
}

function backLink(href, text) {
  const a = el("a", "back-link", text);
  a.href = href;
  return a;
}

// ---------- Lesson page: videos + notes + quiz ----------

function youtubeId(url) {
  const m = String(url).match(
    /(?:youtube\.com\/(?:watch\?(?:.*&)?v=|embed\/|shorts\/|live\/)|youtu\.be\/)([\w-]{11})/
  );
  return m ? m[1] : null;
}

function videoCard(v) {
  const isShort = /\/shorts\//.test(String(v.url));
  const card = el("div", "video-card" + (isShort ? " video-card--short" : ""));
  const frame = el("div", "video-frame" + (isShort ? " video-frame--tall" : ""));
  const id = youtubeId(v.url);
  if (id) {
    const ifr = document.createElement("iframe");
    ifr.src = "https://www.youtube-nocookie.com/embed/" + id;
    ifr.loading = "lazy";
    ifr.allow = "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture";
    ifr.allowFullscreen = true;
    ifr.title = v.title || "Explanation video";
    frame.appendChild(ifr);
  } else {
    const vid = document.createElement("video");
    vid.src = v.url;
    vid.controls = true;
    vid.preload = "none";
    frame.appendChild(vid);
  }
  card.appendChild(frame);
  if (v.title) card.appendChild(el("div", "video-title", v.title));
  return card;
}

// ---------- Interactive lesson-notes behaviors ----------

function wireLesson(root) {
  // Collapsible examples (first one open)
  root.querySelectorAll(".example-card").forEach((card) => {
    card.querySelector(".example-header").addEventListener("click", () =>
      card.classList.toggle("open")
    );
  });
  const first = root.querySelector(".example-card");
  if (first) first.classList.add("open");

  // Vocabulary flip cards
  root.querySelectorAll(".vocab-card").forEach((c) =>
    c.addEventListener("click", () => c.classList.toggle("flipped"))
  );

  // Step-by-step reveal sequences
  root.querySelectorAll(".reveal-seq").forEach(wireRevealSeq);

  // Number line explorers
  root.querySelectorAll(".nl-explorer").forEach(initNumberLine);
}

function wireRevealSeq(seq) {
  const items = [...seq.children];
  if (!items.length) return;
  items.forEach((it) => (it.hidden = true));

  const label = (i) =>
    items[i].classList.contains("solution-display")
      ? "✨ Show the solution"
      : `👀 Show step ${i + 1} of ${items.filter((x) => !x.classList.contains("solution-display")).length}`;

  const btn = el("button", "reveal-btn", label(0));
  seq.after(btn);
  let i = 0;
  btn.addEventListener("click", () => {
    items[i].hidden = false;
    items[i].scrollIntoView({ behavior: "smooth", block: "nearest" });
    i++;
    if (i >= items.length) btn.remove();
    else btn.textContent = label(i);
  });
}

// Live number-line explorer for |x - a| (sym) c
function initNumberLine(box) {
  const controls = el("div", "nl-controls");

  const symWrap = el("label", null, "Symbol ");
  const sym = document.createElement("select");
  for (const [v, txt] of [["lt", "<"], ["le", "≤"], ["gt", ">"], ["ge", "≥"]]) {
    const o = document.createElement("option");
    o.value = v; o.textContent = txt;
    sym.appendChild(o);
  }
  symWrap.appendChild(sym);

  const mkSlider = (labelText, min, max, val) => {
    const wrap = el("label", null, labelText + " ");
    const out = el("output", null, String(val));
    const input = document.createElement("input");
    input.type = "range"; input.min = min; input.max = max; input.value = val; input.step = 1;
    wrap.appendChild(out);
    wrap.appendChild(input);
    return { wrap, input, out };
  };
  const a = mkSlider("Center a:", -4, 4, 1);
  const c = mkSlider("Distance c:", 1, 7, 3);

  const join = el("span", "nl-join", "");
  controls.appendChild(symWrap);
  controls.appendChild(a.wrap);
  controls.appendChild(c.wrap);
  controls.appendChild(join);

  const readout = el("div", "nl-readout");
  const svgBox = el("div", "nl-svg");
  box.appendChild(controls);
  box.appendChild(readout);
  box.appendChild(svgBox);

  const color = getComputedStyle(box).getPropertyValue("--dc").trim() || "#3B5BDB";

  function render() {
    const av = parseInt(a.input.value), cv = parseInt(c.input.value);
    a.out.textContent = av; c.out.textContent = cv;
    const s = sym.value;
    const between = s === "lt" || s === "le";
    const closed = s === "le" || s === "ge";
    const lo = av - cv, hi = av + cv;
    const inner = av === 0 ? "x" : av > 0 ? `x - ${av}` : `x + ${-av}`;
    const S = { lt: "<", le: "\\le", gt: ">", ge: "\\ge" }[s];
    const Sflip = { lt: ">", le: "\\ge", gt: "<", ge: "\\le" }[s];

    join.textContent = between ? "AND — between" : "OR — outside";

    const tex = between
      ? `\\left|${inner}\\right| ${S} ${cv} \\;\\Rightarrow\\; ${-cv} ${S} ${inner} ${S} ${cv} \\;\\Rightarrow\\; ${lo} ${S} x ${S} ${hi}`
      : `\\left|${inner}\\right| ${S} ${cv} \\;\\Rightarrow\\; x ${S} ${hi} \\;\\text{ or }\\; x ${Sflip} ${lo}`;
    if (window.katex) katex.render(tex, readout, { throwOnError: false });
    else readout.textContent = tex.replace(/\\left|\\right|\\;|\\le/g, "≤").replace(/\\ge/g, "≥");

    // SVG number line: x in [-12, 12]
    const W = 640, PAD = 26, AX = 46;
    const xm = (v) => PAD + ((v + 12) * (W - 2 * PAD)) / 24;
    let p = "";
    for (let v = -12; v <= 12; v++) {
      p += `<line x1="${xm(v)}" y1="${AX - 4}" x2="${xm(v)}" y2="${AX + 4}" stroke="#98a2b3" stroke-width="1"/>`;
      if (v % 2 === 0)
        p += `<text x="${xm(v)}" y="${AX + 22}" font-size="11" text-anchor="middle" fill="#667085">${v}</text>`;
    }
    const seg = (x1, x2, arrowLeft, arrowRight) => {
      let out = `<line x1="${x1}" y1="${AX}" x2="${x2}" y2="${AX}" stroke="${color}" stroke-width="6" stroke-linecap="round" opacity="0.85"/>`;
      out += `<rect x="${Math.min(x1, x2)}" y="${AX - 9}" width="${Math.abs(x2 - x1)}" height="18" rx="9" fill="${color}" opacity="0.14"/>`;
      if (arrowLeft) out += `<polygon points="${x1 - 10},${AX} ${x1 + 2},${AX - 7} ${x1 + 2},${AX + 7}" fill="${color}"/>`;
      if (arrowRight) out += `<polygon points="${x2 + 10},${AX} ${x2 - 2},${AX - 7} ${x2 - 2},${AX + 7}" fill="${color}"/>`;
      return out;
    };
    let shade = "";
    if (between) shade = seg(xm(lo), xm(hi), false, false);
    else shade = seg(xm(-12), xm(lo), true, false) + seg(xm(hi), xm(12), false, true);
    const dot = (v) =>
      `<circle cx="${xm(v)}" cy="${AX}" r="7" fill="${closed ? color : "#fff"}" stroke="${color}" stroke-width="2.5"/>`;

    svgBox.innerHTML =
      `<svg viewBox="0 0 ${W} 76" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="number line">` +
      `<line x1="${PAD - 12}" y1="${AX}" x2="${W - PAD + 12}" y2="${AX}" stroke="#98a2b3" stroke-width="2"/>` +
      p + shade + dot(lo) + dot(hi) +
      `</svg>`;
  }

  sym.addEventListener("input", render);
  a.input.addEventListener("input", render);
  c.input.addEventListener("input", render);
  render();
}

function renderTopic(id) {
  const t = TOPICS.find((t) => t.id === id);
  if (!t) return renderHome();

  // Remember for the Resume banner + mark in progress
  localStorage.setItem(K_LAST, JSON.stringify({ id: t.id }));
  if (!lessonStatus(t.id)) setLessonStatus(t.id, "progress");

  main.replaceChildren();
  main.appendChild(backLink("#/module/" + moduleSlug(t.curriculumModule), "← " + t.curriculumModule));

  const titleRow = el("div", "topic-title-row");
  titleRow.appendChild(el("h2", "page-title", `${t.lessonCode} ${t.title}`));
  titleRow.appendChild(markDoneButton(t));
  main.appendChild(titleRow);

  const chips = el("div", "meta-chips " + domClass(t.satDomain));
  chips.appendChild(el("span", "chip", `${DOMAIN_ICONS[t.satDomain] || ""} ${t.satDomain}`));
  chips.appendChild(el("span", "chip plain", t.curriculumModule));
  main.appendChild(chips);

  // Explanation videos
  if (t.videos && t.videos.length) {
    main.appendChild(el("h3", "section-title", "🎬 Watch the explanation"));
    const row = el("div", "video-row");
    for (const v of t.videos) row.appendChild(videoCard(v));
    main.appendChild(row);
  } else if (!t.lessonHtml) {
    main.appendChild(el("h3", "section-title", "🎬 Watch the explanation"));
    main.appendChild(el("div", "empty-note", "Explanation video coming soon."));
  }

  // Interactive lesson notes
  if (t.lessonHtml) {
    main.appendChild(el("h3", "section-title", "📖 Learn the lesson"));
    const box = el("div", "lesson-content " + domClass(t.satDomain));
    main.appendChild(box);
    fetch("data/" + t.lessonHtml + BUST)
      .then((r) => r.text())
      .then((html) => {
        box.innerHTML = html;
        // Re-execute inline scripts (innerHTML doesn't run them)
        box.querySelectorAll("script").forEach((s) => {
          const ns = document.createElement("script");
          if (s.src) { ns.src = s.src; } else { ns.textContent = s.textContent; }
          document.head.appendChild(ns).parentNode.removeChild(ns);
        });
        wireLesson(box);
        typeset(box);
      });
  }

  // Quiz
  main.appendChild(el("h3", "section-title", "📝 Test your understanding"));
  if (!t.questions.length) {
    main.appendChild(el("div", "empty-note", "Quiz questions coming soon."));
    return;
  }

  const quiz = { topic: t, i: 0, correct: 0 };
  const holder = el("div");
  main.appendChild(holder);
  showQuestion(quiz, holder);
}

function markDoneButton(t) {
  const btn = el("button", "mark-done");
  btn.type = "button";
  const paint = () => {
    const done = lessonStatus(t.id) === "done";
    btn.textContent = done ? "✓ Done!" : "Mark as done ✓";
    btn.classList.toggle("is-done", done);
    btn.title = done ? "Tap to un-mark" : "Finished this lesson? Mark it done";
  };
  btn.addEventListener("click", () => {
    setLessonStatus(t.id, lessonStatus(t.id) === "done" ? "progress" : "done");
    paint();
  });
  paint();
  return btn;
}

function showQuestion(quiz, holder) {
  const t = quiz.topic;
  const q = t.questions[quiz.i];

  holder.replaceChildren();

  const progress = el("div", "progress");
  const bar = el("div");
  bar.style.width = `${(quiz.i / t.questions.length) * 100}%`;
  progress.appendChild(bar);
  holder.appendChild(progress);

  const card = el("div", "q-card");
  const top = el("div", "q-top");
  top.appendChild(el("span", "q-count", `Question ${quiz.i + 1} of ${t.questions.length}`));
  if (q.difficulty) top.appendChild(el("span", "diff diff-" + q.difficulty, q.difficulty));
  card.appendChild(top);

  card.appendChild(el("div", "q-prompt", q.prompt));
  if (q.image) {
    const img = el("img", "q-image");
    img.src = q.image;
    img.loading = "lazy";
    img.alt = "question diagram";
    card.appendChild(img);
  }

  const done = (isCorrect, correctText) => {
    if (isCorrect) quiz.correct++;
    const fb = el("div", "feedback " + (isCorrect ? "good" : "bad"));
    fb.appendChild(el("div", "verdict",
      isCorrect ? "✅ Correct!" : "❌ Incorrect" + (correctText ? ` — the answer is ${correctText}` : "")));
    if (q.explanation) fb.appendChild(el("div", null, q.explanation));
    card.appendChild(fb);

    const actions = el("div", "q-actions");
    const next = el("button", "btn btn-primary",
      quiz.i + 1 < t.questions.length ? "Next question →" : "See results");
    next.addEventListener("click", () => {
      quiz.i++;
      if (quiz.i < t.questions.length) showQuestion(quiz, holder);
      else showResults(quiz, holder);
    });
    actions.appendChild(next);
    card.appendChild(actions);
    typeset(fb);
    next.focus();
  };

  if (q.type === "grid-in") {
    const wrap = el("div", "gridin");
    const input = el("input");
    input.placeholder = "Your answer (e.g. 3/4 or 0.75)";
    input.autocomplete = "off";
    input.inputMode = "text";
    const check = el("button", "btn btn-primary", "Check");
    const submit = () => {
      if (!input.value.trim()) return;
      input.disabled = true;
      check.disabled = true;
      const ok = gridinCorrect(input.value, q.acceptedAnswers);
      input.classList.add(ok ? "correct" : "incorrect");
      done(ok, q.acceptedAnswers[0]);
    };
    check.addEventListener("click", submit);
    input.addEventListener("keydown", (e) => { if (e.key === "Enter") submit(); });
    wrap.appendChild(input);
    wrap.appendChild(check);
    card.appendChild(wrap);
    setTimeout(() => input.focus(), 0);
  } else {
    const letters = ["A", "B", "C", "D", "E"];
    const choices = el("div", "choices");
    const buttons = q.choices.map((text, idx) => {
      const b = el("button", "choice");
      b.appendChild(el("span", "letter", letters[idx]));
      b.appendChild(el("span", null, text));
      b.addEventListener("click", () => {
        const answerIdx = letters.indexOf(q.answer);
        buttons.forEach((btn) => (btn.disabled = true));
        buttons[answerIdx].classList.add("correct");
        const ok = idx === answerIdx;
        if (!ok) b.classList.add("incorrect");
        done(ok, letters[answerIdx]);
      });
      choices.appendChild(b);
      return b;
    });
    card.appendChild(choices);
  }

  holder.appendChild(card);
  typeset(card);
}

function showResults(quiz, holder) {
  const t = quiz.topic;
  saveScore(t.id, quiz.correct, t.questions.length);

  holder.replaceChildren();
  const card = el("div", "result-card");
  const pct = Math.round((quiz.correct / t.questions.length) * 100);

  // Perfect score = lesson done (also updates the header button if visible)
  if (pct === 100) {
    setLessonStatus(t.id, "done");
    const btn = document.querySelector(".mark-done");
    if (btn) {
      btn.textContent = "✓ Done!";
      btn.classList.add("is-done");
    }
  }

  card.appendChild(el("div", null, "Quiz complete"));

  const ring = el("div", "score-ring");
  ring.style.setProperty("--pct", pct);
  ring.style.setProperty("--ring", pct === 100 ? "#0CA678" : pct >= 70 ? "#2A3A7C" : "#E8590C");
  const inner = el("div");
  inner.appendChild(el("div", "score-num", `${quiz.correct}/${t.questions.length}`));
  inner.appendChild(el("div", "score-pct", `${pct}%`));
  ring.appendChild(inner);
  card.appendChild(ring);

  card.appendChild(el("div", "result-note",
    pct === 100 ? "🏆 Perfect score — excellent work!"
    : pct >= 70 ? "💪 Nice work — review the ones you missed."
    : "📖 Keep practicing — rewatch the video and try again."));

  const actions = el("div", "result-actions");
  const again = el("button", "btn btn-primary", "Try again");
  again.addEventListener("click", () => {
    quiz.i = 0; quiz.correct = 0;
    showQuestion(quiz, holder);
  });
  const back = el("a", "btn btn-quiet", "More lessons");
  back.href = "#/module/" + moduleSlug(t.curriculumModule);
  actions.appendChild(again);
  actions.appendChild(back);
  card.appendChild(actions);

  if (pct === 100) celebrate(card);
  holder.appendChild(card);
}

function celebrate(card) {
  const emoji = ["🎉", "⭐", "🎊", "✨", "🏆"];
  for (let i = 0; i < 14; i++) {
    const s = el("span", "confetti", emoji[i % emoji.length]);
    s.style.left = Math.random() * 96 + "%";
    s.style.animationDelay = Math.random() * 0.7 + "s";
    card.appendChild(s);
  }
}

// ---------- Grid-in answer checking ----------
// Accepts exact string matches and numeric equivalents (3/4 === 0.75 === .75)

function parseNumeric(s) {
  s = s.trim().replace(/\s+/g, "");
  const frac = s.match(/^(-?\d+(?:\.\d+)?)\/(-?\d+(?:\.\d+)?)$/);
  if (frac) {
    const den = parseFloat(frac[2]);
    return den === 0 ? NaN : parseFloat(frac[1]) / den;
  }
  if (/^-?(\d+\.?\d*|\.\d+)$/.test(s)) return parseFloat(s);
  return NaN;
}

function gridinCorrect(given, accepted) {
  const g = given.trim().replace(/\s+/g, "");
  const gNum = parseNumeric(g);
  return accepted.some((a) => {
    const aStr = String(a).trim().replace(/\s+/g, "");
    if (g.toLowerCase() === aStr.toLowerCase()) return true;
    const aNum = parseNumeric(aStr);
    return !isNaN(gNum) && !isNaN(aNum) && Math.abs(gNum - aNum) < 1e-9;
  });
}

// ---------- Formula sheet (floating panel) ----------

const FORMULA_GROUPS = [
  {
    name: "SAT · Reference & Essentials", cls: "fg-sat",
    sections: [
      ["Area & Perimeter", [
        ["Circle", "$A = \\pi r^2$ · $C = 2\\pi r$"],
        ["Rectangle", "$A = \\ell w$"],
        ["Triangle", "$A = \\tfrac{1}{2}bh$"],
        ["Trapezoid", "$A = \\tfrac{1}{2}(b_1 + b_2)h$"],
      ]],
      ["Triangles", [
        ["Pythagorean theorem", "$a^2 + b^2 = c^2$"],
        ["45°–45°–90°", "$x,\\; x,\\; x\\sqrt{2}$"],
        ["30°–60°–90°", "$x,\\; x\\sqrt{3},\\; 2x$"],
        ["Angles of a triangle", "sum $= 180^\\circ$"],
      ]],
      ["Volume", [
        ["Box", "$V = \\ell w h$"],
        ["Cylinder", "$V = \\pi r^2 h$"],
        ["Sphere", "$V = \\tfrac{4}{3}\\pi r^3$"],
        ["Cone", "$V = \\tfrac{1}{3}\\pi r^2 h$"],
        ["Pyramid", "$V = \\tfrac{1}{3}\\ell w h$"],
      ]],
      ["Lines & Slope", [
        ["Slope", "$m = \\dfrac{y_2 - y_1}{x_2 - x_1}$"],
        ["Slope-intercept", "$y = mx + b$"],
        ["Midpoint", "$\\left(\\tfrac{x_1+x_2}{2},\\; \\tfrac{y_1+y_2}{2}\\right)$"],
        ["Distance", "$d = \\sqrt{(x_2-x_1)^2 + (y_2-y_1)^2}$"],
      ]],
      ["Quadratics", [
        ["Quadratic formula", "$x = \\dfrac{-b \\pm \\sqrt{b^2 - 4ac}}{2a}$"],
        ["Vertex x-coordinate", "$x = -\\dfrac{b}{2a}$"],
        ["Discriminant", "$b^2 - 4ac$ (0 → one root, + → two, − → none)"],
        ["Difference of squares", "$a^2 - b^2 = (a-b)(a+b)$"],
      ]],
      ["Exponents & Radicals", [
        ["Product / quotient", "$x^a x^b = x^{a+b}$ · $\\dfrac{x^a}{x^b} = x^{a-b}$"],
        ["Power of a power", "$(x^a)^b = x^{ab}$"],
        ["Negative & fractional", "$x^{-a} = \\tfrac{1}{x^a}$ · $x^{a/b} = \\sqrt[b]{x^a}$"],
      ]],
      ["Percent & Data", [
        ["Percent change", "$\\dfrac{\\text{new} - \\text{old}}{\\text{old}} \\times 100\\%$"],
        ["Average", "$\\text{mean} = \\dfrac{\\text{sum}}{\\text{count}}$"],
        ["Growth / decay", "$y = a(1 \\pm r)^t$"],
        ["Probability", "$P = \\dfrac{\\text{favorable}}{\\text{total}}$"],
      ]],
    ],
  },
  {
    name: "IGCSE · Quick Reference", cls: "fg-igcse",
    sections: [
      ["Number", [
        ["Compound interest", "$A = P\\left(1 + \\tfrac{r}{100}\\right)^n$"],
        ["Speed–distance–time", "$s = \\dfrac{d}{t}$"],
        ["Density", "$\\rho = \\dfrac{m}{V}$"],
      ]],
      ["Algebra", [
        ["Quadratic formula", "$x = \\dfrac{-b \\pm \\sqrt{b^2 - 4ac}}{2a}$"],
        ["Laws of indices", "$x^a x^b = x^{a+b}$ · $(x^a)^b = x^{ab}$"],
        ["nth term (linear)", "$a + (n-1)d$"],
      ]],
      ["Mensuration", [
        ["Arc length", "$\\dfrac{\\theta}{360} \\times 2\\pi r$"],
        ["Sector area", "$\\dfrac{\\theta}{360} \\times \\pi r^2$"],
        ["Cylinder", "$V = \\pi r^2 h$, curved $SA = 2\\pi r h$"],
        ["Cone", "$V = \\tfrac{1}{3}\\pi r^2 h$, curved $SA = \\pi r \\ell$"],
        ["Sphere", "$V = \\tfrac{4}{3}\\pi r^3$, $SA = 4\\pi r^2$"],
      ]],
      ["Trigonometry", [
        ["SOH CAH TOA", "$\\sin = \\tfrac{O}{H}$ · $\\cos = \\tfrac{A}{H}$ · $\\tan = \\tfrac{O}{A}$"],
        ["Sine rule", "$\\dfrac{a}{\\sin A} = \\dfrac{b}{\\sin B} = \\dfrac{c}{\\sin C}$"],
        ["Cosine rule", "$a^2 = b^2 + c^2 - 2bc\\cos A$"],
        ["Area of a triangle", "$A = \\tfrac{1}{2}ab\\sin C$"],
      ]],
    ],
  },
];

const fpanel = document.getElementById("fpanel");
let formulasBuilt = false;

function initFormulaPanel() {
  document.getElementById("fab").addEventListener("click", () => {
    if (fpanel.classList.contains("open")) closeFormulas();
    else openFormulas();
  });
  document.getElementById("fpanel-close").addEventListener("click", closeFormulas);
  document.getElementById("fpanel-backdrop").addEventListener("click", closeFormulas);
}

function buildFormulas() {
  const body = document.getElementById("fpanel-body");
  for (const group of FORMULA_GROUPS) {
    const g = el("div", "fgroup " + group.cls);
    g.appendChild(el("div", "fgroup-name", group.name));
    for (const [title, rows] of group.sections) {
      const d = document.createElement("details");
      d.className = "fsec";
      const s = document.createElement("summary");
      s.textContent = title;
      d.appendChild(s);
      for (const [label, tex] of rows) {
        const row = el("div", "frow");
        row.appendChild(el("span", "frow-label", label));
        row.appendChild(el("span", "frow-math", tex));
        d.appendChild(row);
      }
      g.appendChild(d);
    }
    body.appendChild(g);
  }
  // Open the first section of each group so the panel never looks empty
  body.querySelectorAll(".fgroup > details:first-of-type").forEach((d) => (d.open = true));
  typeset(body);
}

function openFormulas() {
  // Built once and kept in the DOM, so scroll position survives while browsing
  if (!formulasBuilt) { buildFormulas(); formulasBuilt = true; }
  fpanel.classList.add("open");
  fpanel.setAttribute("aria-hidden", "false");
  document.getElementById("fpanel-backdrop").classList.remove("hidden");
}

function closeFormulas() {
  fpanel.classList.remove("open");
  fpanel.setAttribute("aria-hidden", "true");
  document.getElementById("fpanel-backdrop").classList.add("hidden");
}
