/* MathClicks — all site logic.
   Content lives in data/topics/*.json; this file never needs editing to add lessons. */

"use strict";

// Cache-buster so students always see freshly published content
const BUST = "?t=" + Date.now();

// ---------- localStorage keys ----------
// Old "satpractice." keys are kept for best scores so nobody loses progress.

const K_THEME = "mathclicks.theme";
const K_EXAM = "mathclicks.examDate";
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
  // IGCSE strands
  "Coordinate Geometry": "📐",
  "Graphs & Functions": "📈",
};
const MODULE_ICON = "📘";

// Track helpers: existing SAT/American-Pathway lessons have no `track` field.
const trackOf = (t) => t.track || "ap";
const apTopics = () => TOPICS.filter((t) => trackOf(t) === "ap");
const igcseTopics = () => TOPICS.filter((t) => trackOf(t) === "igcse");

async function boot() {
  const manifest = await (await fetch("data/manifest.json" + BUST)).json();
  const all = await Promise.all(
    manifest.topics.map((f) => fetch("data/topics/" + f + BUST).then((r) => r.json()))
  );
  // Students only ever see lessons marked ready by the teacher
  TOPICS = all.filter((t) => t.published);
  window.addEventListener("hashchange", route);
  initHeader();
  initSearch();
  initFormulaPanel();
  initModal();
  initChat();
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
function moduleList(list = TOPICS) {
  const seen = new Map();
  for (const t of list) {
    if (!seen.has(t.curriculumModule)) seen.set(t.curriculumModule, []);
    seen.get(t.curriculumModule).push(t);
  }
  return [...seen.entries()].map(([name, topics]) => ({ name, topics }));
}

const moduleSlug = (name) =>
  name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const domainSlug = moduleSlug;

const qCount = (t) => t.questions.length;
const pastPaperCount = (t) =>
  (t.pastPapers || []).reduce((s, p) => s + (p.items ? p.items.length : 0), 0);
const plural = (n, word) => `${n} ${word}${n === 1 ? "" : "s"}`;
const domClass = (domain) => "dom-" + domainSlug(domain);

// A module's accent = its lessons' domain (or "mixed" if they differ)
function moduleDomClass(topics) {
  const d = new Set(topics.map((t) => t.satDomain));
  return d.size === 1 ? domClass(topics[0].satDomain) : "dom-mixed";
}

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

// ---------- Routing ----------

const main = document.getElementById("main");

function route() {
  const parts = (location.hash || "#/").slice(2).split("/");
  const view = parts[0] || "home";
  window.scrollTo(0, 0);
  main.dataset.view = view === "about" ? "home" : view;
  if (view === "module") renderModule(decodeURIComponent(parts[1] || ""));
  else if (view === "topic") renderTopic(decodeURIComponent(parts[1] || ""));
  else if (view === "modules") renderModules();
  else if (view === "igcse") renderIgcse();
  else renderHome();
  setActiveNav(view);
  typeset(main);
  if (view === "about") {
    const target = document.getElementById("about");
    if (target) requestAnimationFrame(() =>
      target.scrollIntoView({ behavior: "smooth", block: "start" }));
  }
}

function setActiveNav(view) {
  const topicViews = new Set(["modules", "module", "topic"]);
  document.querySelectorAll(".nav-link").forEach((a) => {
    const nav = a.dataset.nav;
    let active;
    if (nav === "topics") active = topicViews.has(view);
    else if (nav === "about") active = view === "about";
    else active = view === "home";
    a.classList.toggle("active", active);
  });
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

// ---------- Header: exam countdown + dark mode ----------

function initHeader() {
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

  updateExamChip();
  document.getElementById("exam-chip").addEventListener("click", openExamModal);
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
  if (days == null) label.textContent = "Exam date";
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
    else if (chat.classList.contains("open")) closeChat();
    else if (!document.getElementById("search-overlay").classList.contains("hidden"))
      document.getElementById("search-close").click();
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

// ---------- Stats + badges ----------

function ppVideoCount(t) {
  return (t.pastPapers || []).reduce(
    (s, p) => s + (p.items || []).filter((it) => it.video && it.video.trim()).length, 0);
}

function statsStrip(topics) {
  const totalQ = topics.reduce((s, t) => s + qCount(t), 0);
  const totalPP = topics.reduce((s, t) => s + pastPaperCount(t), 0);
  const totalV = topics.reduce(
    (s, t) => s + (t.videos ? t.videos.length : 0) + ppVideoCount(t), 0);
  const done = topics.filter((t) => isDone(t.id)).length;
  const strip = el("div", "stats");
  const chip = (label) => strip.appendChild(el("span", "stat-chip", label));
  chip(`📚 ${plural(topics.length, "lesson")}`);
  if (totalQ) chip(`📝 ${plural(totalQ, "question")}`);
  if (totalPP) chip(`📄 ${plural(totalPP, "past-paper Q")}`);
  chip(`🎬 ${plural(totalV, "video")}`);
  if (done) chip(`⭐ ${done} completed`);
  return strip;
}

function countBadge(t) {
  const n = qCount(t);
  const best = bestScore(t.id);
  if (best && best.total === n && n > 0) {
    return el("span", "badge score", `⭐ ${best.correct}/${best.total}`);
  }
  if (n) return el("span", "badge", plural(n, "question"));
  const pp = pastPaperCount(t);
  if (pp) return el("span", "badge", `${pp} past-paper Qs`);
  return el("span", "badge soon", "coming soon");
}

function moduleCard(m) {
  const a = el("a", "card " + moduleDomClass(m.topics));
  a.href = "#/module/" + moduleSlug(m.name);
  a.appendChild(el("div", "card-icon", MODULE_ICON));
  const body = el("div", "card-body");
  body.appendChild(el("div", "card-title", m.name));
  body.appendChild(el("div", "card-sub", subLine(m.topics)));
  const done = m.topics.filter((t) => isDone(t.id)).length;
  const prog = el("div", "mprog");
  const bar = el("div", "mprog-bar");
  const fill = el("div", "mprog-fill");
  fill.style.width = (done / m.topics.length) * 100 + "%";
  bar.appendChild(fill);
  prog.appendChild(bar);
  prog.appendChild(el("span", "mprog-label", `${done}/${m.topics.length} done`));
  body.appendChild(prog);
  a.appendChild(body);
  a.appendChild(el("span", "card-arrow", "›"));
  return a;
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
  const extras = [`${DOMAIN_ICONS[t.satDomain] || ""} ${t.satDomain}`];
  const vids = (t.videos ? t.videos.length : 0) + ppVideoCount(t);
  if (vids) extras.push(`🎬 ${plural(vids, "video")}`);
  if (!done && lessonStatus(t.id) === "progress") extras.push("🕐 in progress");
  body.appendChild(el("div", "card-sub", extras.join(" · ")));
  a.appendChild(body);
  a.appendChild(el("span", "card-arrow", "›"));
  return a;
}

function subLine(topics) {
  const total = topics.reduce((s, t) => s + qCount(t), 0);
  if (total) return `${plural(topics.length, "lesson")} · ${plural(total, "question")}`;
  const pp = topics.reduce((s, t) => s + pastPaperCount(t), 0);
  return `${plural(topics.length, "lesson")} · ${pp ? plural(pp, "past-paper Q") : "questions coming soon"}`;
}

// ---------- Home ----------

function renderHome() {
  main.replaceChildren();
  main.appendChild(heroSection());
  main.appendChild(subjectsSection());
  main.appendChild(quickWinsSection());
  main.appendChild(howItWorksSection());
  main.appendChild(aboutSection());
  main.appendChild(ctaSection());
  wireReveal();
}

// ----- Hero with the logo as an orbiting "planet" -----

function heroSection() {
  const hero = el("section", "hero");
  hero.appendChild(el("div", "hero-glow hero-glow--blue"));
  hero.appendChild(el("div", "hero-glow hero-glow--gold"));

  const inner = el("div", "hero-inner");

  const copy = el("div", "hero-copy");
  copy.appendChild(el("div", "hero-eyebrow", "IGCSE & American Pathway math, one click at a time"));
  const h1 = el("h1", "hero-title", "Math finally ");
  h1.appendChild(el("span", "hero-click", "clicks."));
  copy.appendChild(h1);
  copy.appendChild(el("p", "hero-sub",
    "Clear video lessons, worked examples, and instant-feedback practice — built by Mr Hamouda to make the ideas click, not just get memorized."));
  const cta = el("div", "hero-cta");
  const explore = el("a", "btn btn-cta", "Explore Topics →");
  explore.href = "#/modules";
  const yt = el("a", "btn btn-ghost", "▶ Watch on YouTube");
  yt.href = "https://www.youtube.com/channel/UC6QrK419Gg5w1SXzlBbYXCw";
  yt.target = "_blank"; yt.rel = "noopener";
  const ask = el("button", "btn btn-ghost", "💬 Ask Mr Hamouda");
  ask.addEventListener("click", () => openChat());
  cta.append(explore, yt, ask);
  copy.appendChild(cta);
  inner.appendChild(copy);

  inner.appendChild(heroPlanet());
  hero.appendChild(inner);
  return hero;
}

function heroPlanet() {
  const wrap = el("div", "hero-planet");
  const stage = el("div", "planet-stage");
  stage.appendChild(el("div", "planet-ring"));
  stage.appendChild(el("div", "planet-ring planet-ring--inner"));
  const core = el("div", "planet-core");
  const img = el("img", "planet-logo");
  img.src = "assets/mathclicks-icon.png";
  img.alt = "MathClicks";
  core.appendChild(img);
  stage.appendChild(core);
  const orbit = el("div", "planet-orbit");
  ["π", "Σ", "∞", "√", "∫", "×"].forEach((s, i) => {
    const chip = el("div", "orbit-chip oc" + i);
    chip.appendChild(el("span", null, s));
    orbit.appendChild(chip);
  });
  stage.appendChild(orbit);
  wrap.appendChild(stage);
  return wrap;
}

// ----- "Two tracks, one clear path" -----

function subjectsSection() {
  const sec = el("section", "home-sec reveal");
  sec.id = "tracks";
  const head = el("div", "sec-head");
  head.appendChild(el("div", "sec-eyebrow blue", "What you'll study"));
  head.appendChild(el("h2", "sec-title", "Two tracks, one clear path"));
  sec.appendChild(head);

  const grid = el("div", "subject-grid");
  const ap = apTopics();
  const totalQ = ap.reduce((s, t) => s + qCount(t), 0);
  const done = ap.filter((t) => isDone(t.id)).length;
  const apChips = [`📚 ${plural(ap.length, "lesson")}`, `📝 ${plural(totalQ, "question")}`];
  if (done) apChips.push(`⭐ ${done} completed`);

  const ig = igcseTopics();
  const igPapers = ig.reduce((s, t) => s + pastPaperCount(t), 0);
  const igChips = ig.length
    ? [`📚 ${plural(ig.length, "lesson")}`, `📝 ${plural(igPapers, "past-paper Q")}`]
    : [];

  grid.appendChild(subjectCard({
    cls: "igcse", href: "#/igcse", glyph: "∠", title: "IGCSE Math",
    desc: "Cambridge IGCSE 0580 — clear notes with worked examples, then real past-paper questions with mark schemes and video walkthroughs.",
    chips: igChips, cta: "View IGCSE topics →", soon: !ig.length,
  }));
  grid.appendChild(subjectCard({
    cls: "ap", href: "#/modules", glyph: "Σ", title: "American Pathway",
    desc: "Algebra 2 & Geometry for the American Pathway — taught with the strategy and speed the test rewards.",
    chips: apChips, cta: "Start practicing →",
  }));
  sec.appendChild(grid);
  return sec;
}

function subjectCard(o) {
  const a = el("a", "subject " + o.cls);
  a.href = o.href;
  a.appendChild(el("div", "subject-icon", o.glyph));
  a.appendChild(el("div", "subject-title", o.title));
  a.appendChild(el("div", "subject-sub", o.desc));
  if (o.chips && o.chips.length) {
    const meta = el("div", "subject-meta");
    for (const c of o.chips) meta.appendChild(el("span", "subject-chip", c));
    a.appendChild(meta);
  }
  a.appendChild(el("span", "subject-go", o.cta));
  if (o.soon) a.appendChild(el("span", "soon-badge", "Coming soon"));
  return a;
}

// ----- "Three clicks to clarity" -----

function howItWorksSection() {
  const sec = el("section", "home-sec reveal");
  const head = el("div", "sec-head");
  head.appendChild(el("div", "sec-eyebrow gold", "How it works"));
  head.appendChild(el("h2", "sec-title", "Three clicks to clarity"));
  sec.appendChild(head);

  const grid = el("div", "steps-grid");
  const steps = [
    ["1", "Pick a topic", "Choose from every IGCSE or American Pathway math topic, organized clearly.", "blue"],
    ["2", "Watch & learn", "A short video walkthrough plus interactive notes for every lesson.", "gold"],
    ["3", "Practice & master", "Answer instant-feedback questions and mark each lesson done.", "blue"],
  ];
  for (const [n, title, desc, tone] of steps) {
    const step = el("div", "step-item");
    step.appendChild(el("div", "step-badge " + tone, n));
    step.appendChild(el("h3", "step-title", title));
    step.appendChild(el("p", "step-desc", desc));
    grid.appendChild(step);
  }
  sec.appendChild(grid);
  return sec;
}

// ----- About (teacher photo supplied later) -----

function aboutSection() {
  const sec = el("section", "about-sec reveal");
  sec.id = "about";
  const inner = el("div", "about-inner");

  const photo = el("div", "about-photo");
  const img = document.createElement("img");
  img.src = "assets/teacher.jpg";
  img.alt = "Mr Ahmed Hamouda";
  img.loading = "lazy";
  img.addEventListener("error", () => {
    img.remove();
    photo.classList.add("is-placeholder");
    photo.appendChild(el("span", "about-photo-emoji", "🧑🏻‍🏫"));
    photo.appendChild(el("span", "about-photo-note", "Photo coming soon"));
  });
  photo.appendChild(img);
  inner.appendChild(photo);

  const body = el("div", "about-body");
  body.appendChild(el("div", "sec-eyebrow blue", "Meet your teacher"));
  body.appendChild(el("h2", "sec-title", "Mr Ahmed Hamouda"));
  body.appendChild(el("p", "about-text",
    "I teach IGCSE and American Pathway math with one goal: make the ideas click, not just the answers. Every lesson breaks a topic into small, worked steps so you build real understanding — and the confidence to solve anything on test day."));
  const links = el("div", "about-links");
  const yt = el("a", "about-link", "▶ YouTube");
  yt.href = "https://www.youtube.com/channel/UC6QrK419Gg5w1SXzlBbYXCw";
  yt.target = "_blank"; yt.rel = "noopener";
  const tk = el("a", "about-link", "♪ TikTok");
  tk.href = "https://www.tiktok.com/@apple.user3799222";
  tk.target = "_blank"; tk.rel = "noopener";
  links.append(yt, tk);
  body.appendChild(links);
  inner.appendChild(body);

  sec.appendChild(inner);
  return sec;
}

// ----- Closing CTA band -----

function ctaSection() {
  const sec = el("section", "cta-sec reveal");
  const band = el("div", "cta-band");
  band.appendChild(el("div", "cta-glow"));
  band.appendChild(el("h2", "cta-title", "Ready to click into math?"));
  band.appendChild(el("p", "cta-sub", "Pick a topic and start your first lesson right now."));
  const btn = el("a", "btn btn-cta", "Browse All Topics");
  btn.href = "#/modules";
  band.appendChild(btn);
  sec.appendChild(band);
  return sec;
}

// Scroll-reveal: fade+rise sections in the first time they enter view
function wireReveal() {
  const els = main.querySelectorAll(".reveal");
  if (!("IntersectionObserver" in window)) {
    els.forEach((e) => e.classList.add("in"));
    return;
  }
  const obs = new IntersectionObserver((entries) => {
    for (const e of entries) {
      if (e.isIntersecting) { e.target.classList.add("in"); obs.unobserve(e.target); }
    }
  }, { threshold: 0.12 });
  els.forEach((e) => obs.observe(e));
}

function renderIgcse() {
  main.replaceChildren();
  main.appendChild(backLink("#/", "← Home"));
  main.appendChild(el("h2", "page-title", "IGCSE Math"));
  main.appendChild(el("p", "page-sub", "Cambridge IGCSE 0580 (Extended) — pick a module to begin."));
  const ig = igcseTopics();
  if (!ig.length) {
    const box = el("div", "empty-note big");
    box.appendChild(el("div", "empty-emoji", "🚧"));
    box.appendChild(el("div", "empty-title", "Coming soon!"));
    box.appendChild(el("p", null,
      "IGCSE lessons are being prepared. In the meantime, SAT Prep is ready for you."));
    const b = el("a", "btn btn-cta", "Browse SAT Topics");
    b.href = "#/modules";
    box.appendChild(b);
    main.appendChild(box);
    return;
  }
  main.appendChild(statsStrip(ig));
  for (const m of moduleList(ig)) main.appendChild(moduleCard(m));
}

function renderModules() {
  main.replaceChildren();
  main.appendChild(backLink("#/", "← Home"));
  main.appendChild(el("h2", "page-title", "American Pathway"));
  main.appendChild(el("p", "page-sub", "Algebra 2 & Geometry — pick a module to begin."));
  const ap = apTopics();
  if (!ap.length) {
    main.appendChild(el("div", "empty-note", "Lessons will appear here as we cover them in class — check back soon!"));
    return;
  }
  main.appendChild(statsStrip(ap));
  for (const m of moduleList(ap)) main.appendChild(moduleCard(m));
}

function renderModule(slug) {
  const m = moduleList().find((m) => moduleSlug(m.name) === slug);
  if (!m) return renderModules();
  const igcse = trackOf(m.topics[0]) === "igcse";
  main.replaceChildren();
  main.appendChild(igcse
    ? backLink("#/igcse", "← All IGCSE modules")
    : backLink("#/modules", "← All modules"));
  main.appendChild(el("h2", "page-title", m.name));
  m.topics.forEach((t, i) => main.appendChild(lessonCard(t, i)));
}

function backLink(href, text) {
  const a = el("a", "back-link", text);
  a.href = href;
  return a;
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
    if (s < 10) steps.push([`3. Tuck the sum in the middle`, `${a} ${s} ${b} → ${n * 11}`]);
    else {
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

// ---------- Lesson search overlay ----------

function initSearch() {
  const overlay = document.getElementById("search-overlay");
  const input = document.getElementById("search-input");
  const results = document.getElementById("search-results");

  function renderResults(q) {
    results.replaceChildren();
    q = q.trim().toLowerCase();
    const hits = TOPICS.filter((t) =>
      !q ||
      t.title.toLowerCase().includes(q) ||
      t.lessonCode.toLowerCase().includes(q) ||
      t.curriculumModule.toLowerCase().includes(q)
    ).slice(0, 12);
    if (!hits.length) {
      results.appendChild(el("div", "search-empty",
        q ? "No lessons match — try a different word." : "No lessons published yet."));
      return;
    }
    for (const t of hits) {
      const a = el("a", "search-hit " + domClass(t.satDomain));
      a.href = "#/topic/" + t.id;
      a.appendChild(el("span", "hit-code", t.lessonCode));
      const b = el("div", "hit-body");
      b.appendChild(el("div", "hit-title", t.title));
      b.appendChild(el("div", "hit-sub", t.curriculumModule));
      a.appendChild(b);
      results.appendChild(a);
    }
  }

  const open = () => {
    overlay.classList.remove("hidden");
    document.body.classList.add("no-scroll");
    input.value = "";
    renderResults("");
    setTimeout(() => input.focus(), 0);
  };
  const close = () => {
    overlay.classList.add("hidden");
    document.body.classList.remove("no-scroll");
  };

  document.getElementById("nav-search").addEventListener("click", open);
  document.getElementById("search-close").addEventListener("click", close);
  overlay.addEventListener("click", (e) => { if (e.target === overlay) close(); });
  input.addEventListener("input", () => renderResults(input.value));
  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      const first = results.querySelector("a");
      if (first) first.click();
    }
  });
  results.addEventListener("click", (e) => { if (e.target.closest("a")) close(); });
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

function wireLesson(root) {
  root.querySelectorAll(".example-card").forEach((card) => {
    card.querySelector(".example-header").addEventListener("click", () =>
      card.classList.toggle("open")
    );
  });
  const first = root.querySelector(".example-card");
  if (first) first.classList.add("open");
  root.querySelectorAll(".vocab-card").forEach((c) =>
    c.addEventListener("click", () => c.classList.toggle("flipped"))
  );
  root.querySelectorAll(".reveal-seq").forEach(wireRevealSeq);
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
      p + shade + dot(lo) + dot(hi) + `</svg>`;
  }
  sym.addEventListener("input", render);
  a.input.addEventListener("input", render);
  c.input.addEventListener("input", render);
  render();
}

function renderTopic(id) {
  const t = TOPICS.find((t) => t.id === id);
  if (!t) return renderModules();

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

  if (t.videos && t.videos.length) {
    main.appendChild(el("h3", "section-title", "🎬 Watch the explanation"));
    const row = el("div", "video-row");
    for (const v of t.videos) row.appendChild(videoCard(v));
    main.appendChild(row);
  } else if (!t.lessonHtml) {
    main.appendChild(el("h3", "section-title", "🎬 Watch the explanation"));
    main.appendChild(el("div", "empty-note", "Explanation video coming soon."));
  }

  if (t.lessonHtml) {
    main.appendChild(el("h3", "section-title", "📖 Learn the lesson"));
    const box = el("div", "lesson-content " + domClass(t.satDomain));
    main.appendChild(box);
    fetch("data/" + t.lessonHtml + BUST)
      .then((r) => r.text())
      .then((html) => {
        box.innerHTML = html;
        box.querySelectorAll("script").forEach((s) => {
          const ns = document.createElement("script");
          if (s.src) { ns.src = s.src; } else { ns.textContent = s.textContent; }
          document.head.appendChild(ns).parentNode.removeChild(ns);
        });
        wireLesson(box);
        typeset(box);
      });
  }

  if (t.pastPapers && t.pastPapers.length) {
    renderPastPapers(t);
  }

  if (t.questions.length) {
    main.appendChild(el("h3", "section-title", "📝 Test your understanding"));
    const quiz = { topic: t, i: 0, correct: 0 };
    const holder = el("div");
    main.appendChild(holder);
    showQuestion(quiz, holder);
  } else if (!t.pastPapers || !t.pastPapers.length) {
    main.appendChild(el("h3", "section-title", "📝 Test your understanding"));
    main.appendChild(el("div", "empty-note", "Quiz questions coming soon."));
  }
}

// ---------- Past-paper practice (image question + hidden mark scheme + video slot) ----------

function renderPastPapers(t) {
  main.appendChild(el("h3", "section-title", "📄 Past-paper practice"));
  main.appendChild(el("p", "page-sub",
    "Real Cambridge questions. Try each one first, then reveal the mark scheme and watch the walkthrough."));

  for (const paper of t.pastPapers) {
    const items = paper.items || [];
    const banner = el("div", "pp-banner");
    const bl = el("div");
    bl.appendChild(el("strong", null, paper.paper));
    if (paper.blurb) bl.appendChild(el("div", "pp-banner-sub", paper.blurb));
    banner.appendChild(bl);
    banner.appendChild(el("span", "pp-banner-count", plural(items.length, "question")));
    main.appendChild(banner);

    items.forEach((it, i) => main.appendChild(pastPaperCard(paper, it, i)));
  }
}

function pastPaperCard(paper, it, i) {
  const card = el("div", "pp-card");

  const head = el("div", "pp-head");
  head.appendChild(el("span", "pp-num", `${paper.paper.replace("Paper ", "P")} · ${it.n}`));
  if (it.code) head.appendChild(el("span", "pp-code", it.code));
  if (it.tag) head.appendChild(el("span", "pp-tag", it.tag));
  card.appendChild(head);

  if (it.q) {
    const img = el("img", "pp-img");
    img.src = it.q;
    img.loading = "lazy";
    img.alt = `${it.code || it.n} question`;
    card.appendChild(img);
  }

  // Action row: mark-scheme toggle + video toggle
  const actions = el("div", "pp-actions");
  const hasVideo = it.video && it.video.trim();

  let msWrap = null;
  if (it.ms) {
    const msBtn = el("button", "pp-btn", "Show mark scheme ▾");
    msBtn.type = "button";
    msWrap = el("div", "pp-panel");
    const msImg = el("img", "pp-ms-img");
    msImg.loading = "lazy";
    msImg.alt = `${it.code || it.n} mark scheme`;
    let loaded = false;
    msBtn.addEventListener("click", () => {
      const open = msWrap.classList.toggle("open");
      if (open && !loaded) { msImg.src = it.ms; msWrap.appendChild(msImg); loaded = true; }
      msBtn.textContent = open ? "Hide mark scheme ▴" : "Show mark scheme ▾";
    });
    actions.appendChild(msBtn);
  }

  let vidWrap = null;
  const vidBtn = el("button", "pp-btn pp-btn--video" + (hasVideo ? "" : " is-soon"),
    hasVideo ? "🎬 Watch explanation ▾" : "🎬 Video — coming soon");
  vidBtn.type = "button";
  vidWrap = el("div", "pp-panel");
  if (hasVideo) {
    let built = false;
    vidBtn.addEventListener("click", () => {
      const open = vidWrap.classList.toggle("open");
      if (open && !built) { vidWrap.appendChild(videoCard({ url: it.video })); built = true; }
      vidBtn.textContent = open ? "🎬 Hide explanation ▴" : "🎬 Watch explanation ▾";
    });
  } else {
    vidBtn.disabled = true;
    vidBtn.title = "A video walkthrough will be added here soon.";
  }
  actions.appendChild(vidBtn);
  card.appendChild(actions);

  if (msWrap) card.appendChild(msWrap);
  card.appendChild(vidWrap);
  return card;
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

  if (pct === 100) {
    setLessonStatus(t.id, "done");
    const btn = document.querySelector(".mark-done");
    if (btn) { btn.textContent = "✓ Done!"; btn.classList.add("is-done"); }
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
  body.querySelectorAll(".fgroup > details:first-of-type").forEach((d) => (d.open = true));
  typeset(body);
}

function openFormulas() {
  if (!formulasBuilt) { buildFormulas(); formulasBuilt = true; }
  closeChat();
  fpanel.classList.add("open");
  fpanel.setAttribute("aria-hidden", "false");
  document.getElementById("fpanel-backdrop").classList.remove("hidden");
}

function closeFormulas() {
  fpanel.classList.remove("open");
  fpanel.setAttribute("aria-hidden", "true");
  document.getElementById("fpanel-backdrop").classList.add("hidden");
}

// ==========================================================================
//  Ask Mr Hamouda — a math-only tutor bot that runs entirely in the browser
//  (no server, no API key). It solves and explains; it refuses non-math.
// ==========================================================================

const chat = document.getElementById("chat");
let chatStarted = false;

function initChat() {
  document.getElementById("ask-fab").addEventListener("click", () => {
    if (chat.classList.contains("open")) closeChat();
    else openChat();
  });
  document.getElementById("chat-close").addEventListener("click", closeChat);
  document.getElementById("chat-backdrop").addEventListener("click", closeChat);
  document.getElementById("chat-form").addEventListener("submit", (e) => {
    e.preventDefault();
    const input = document.getElementById("chat-input");
    const text = input.value.trim();
    if (!text) return;
    input.value = "";
    sendUserMessage(text);
  });
}

function openChat() {
  closeFormulas();
  chat.classList.add("open");
  chat.setAttribute("aria-hidden", "false");
  document.getElementById("chat-backdrop").classList.remove("hidden");
  if (!chatStarted) {
    chatStarted = true;
    botSay(
      "Hi, I'm <strong>Mr Hamouda</strong> 👋 your math helper. Ask me to solve an equation, work out a percentage, or explain a formula. " +
      "I only do <strong>math</strong> — try one of these:"
    );
    renderChips([
      "Solve 3x + 5 = 20",
      "Solve x^2 - 5x + 6 = 0",
      "What is 15% of 80?",
      "Explain the quadratic formula",
      "Area of a circle radius 7",
    ]);
  }
  setTimeout(() => document.getElementById("chat-input").focus(), 250);
}

function closeChat() {
  chat.classList.remove("open");
  chat.setAttribute("aria-hidden", "true");
  document.getElementById("chat-backdrop").classList.add("hidden");
}

function chatLog() { return document.getElementById("chat-log"); }

function appendBubble(who, node) {
  const row = el("div", "msg msg-" + who);
  if (who === "bot") row.appendChild(el("span", "msg-avatar", "🧑🏻‍🏫"));
  const bubble = el("div", "bubble");
  if (typeof node === "string") bubble.innerHTML = node;
  else bubble.appendChild(node);
  row.appendChild(bubble);
  chatLog().appendChild(row);
  typeset(bubble);
  chatLog().scrollTop = chatLog().scrollHeight;
  return row;
}

function botSay(html) { appendBubble("bot", html); }

function renderChips(list) {
  const holder = document.getElementById("chat-chips");
  holder.replaceChildren();
  for (const text of list) {
    const c = el("button", "chat-chip", text);
    c.type = "button";
    c.addEventListener("click", () => sendUserMessage(text));
    holder.appendChild(c);
  }
}

function sendUserMessage(text) {
  appendBubble("user", document.createTextNode(text));
  document.getElementById("chat-chips").replaceChildren();
  // Small "typing…" delay so it feels like a person is thinking
  const typing = appendBubble("bot", '<span class="typing"><i></i><i></i><i></i></span>');
  setTimeout(() => {
    typing.remove();
    const ans = answerMath(text);
    botSay(ans.html);
    if (ans.chips) renderChips(ans.chips);
  }, 380 + Math.random() * 320);
}

// ---------- The math brain ----------

const MATH_WORDS = /\b(solve|simplify|factor(is|iz)?e?|expand|evaluate|calculate|compute|equation|inequalit|expression|formula|theorem|sum|difference|product|quotient|add|plus|minus|subtract|multiply|times|divide|fraction|decimal|percent|percentage|ratio|proportion|average|mean|median|mode|range|probabilit|exponent|power|squared?|cubed?|root|sqrt|radical|quadratic|linear|polynomial|function|graph|slope|gradient|intercept|parabola|vertex|coordinate|absolute value|area|perimeter|circumference|radius|diameter|volume|surface area|triangle|rectangle|circle|polygon|trapezoid|parallelogram|rhombus|angle|degrees?|radian|sine?|cosine?|tangent|trig|trigonometry|pythagoras|pythagorean|hypotenuse|geometry|algebra|calculus|derivative|integral|logarithm|\blog\b|\bln\b|sequence|series|arithmetic|geometric|prime|factorial|gcd|lcm|integer|numerator|denominator|value of|how many|nth term|simultaneous|matrix|vector)\b/i;

const NON_MATH = /\b(weather|forecast|joke|song|lyrics|movie|film|football|soccer|basketball|game score|instagram|snapchat|dating|girlfriend|boyfriend|recipe|cook|food|pizza|president|election|politic|news|stock|crypto|bitcoin|write.{0,12}(essay|story|poem)|python|javascript|html|css|\bcode\b|programming|history of|capital of|translate|who won|your age|how old are you|love you|marry)\b/i;

function isGreeting(s) { return /^\s*(hi|hey|hello|yo|salam|as-salamu|good (morning|afternoon|evening)|howdy)\b/i.test(s); }
function isThanks(s) { return /\b(thanks|thank you|thx|shukran|shokran)\b/i.test(s); }
function isIdentity(s) { return /\b(who are you|what are you|your name|are you (a )?(bot|robot|ai|human|real))\b/i.test(s); }

function hasMathSignal(s) {
  return /[0-9]/.test(s) || /[=+\-*/^√%<>]/.test(s) || /\bx\b|\by\b/.test(s) || MATH_WORDS.test(s);
}

function answerMath(raw) {
  const s = raw.trim();

  if (isIdentity(s))
    return { html: "I'm <strong>Mr Hamouda</strong>, your built-in math tutor 🧑🏻‍🏫. I can solve equations, crunch numbers, and explain formulas — one click at a time." };
  if (isThanks(s))
    return { html: "You're welcome! 😊 Got another math question for me?" };
  if (isGreeting(s) && !hasMathSignal(s))
    return { html: "Hey! 👋 Ask me a math question — an equation to solve, a percentage, an area, or a formula to explain." };

  // Math-only gate
  if (NON_MATH.test(s) || !hasMathSignal(s)) {
    return {
      html: "I'm just the <strong>math</strong> helper 📐 — I can't help with that one. But ask me anything in math and I'm all yours! Try “solve 2x − 4 = 10” or “explain SOH CAH TOA”.",
    };
  }

  // Try each solver in order of specificity
  return (
    tryGeometry(s) ||
    tryConcept(s) ||
    tryPercent(s) ||
    tryEquation(s) ||
    tryArithmetic(s) ||
    fallbackMath(s)
  );
}

// ----- Geometry with actual numbers -----

function grabNum(s, re) { const m = s.match(re); return m ? parseFloat(m[1]) : null; }
const approx = (v) => `≈ ${fmt(Math.round(v * 100) / 100)}`;

function tryGeometry(s) {
  const t = s.toLowerCase();
  let r = grabNum(t, /radius\s*(?:of|=|:|is)?\s*([\d.]+)/);
  if (r == null) {
    const d = grabNum(t, /diameter\s*(?:of|=|:|is)?\s*([\d.]+)/);
    if (d != null) r = d / 2;
  }
  if (/circle/.test(t) && r != null) {
    if (/circumference|perimeter/.test(t)) {
      const v = 2 * Math.PI * r;
      return { html: `Circumference $= 2\\pi r$:<div class="ans">$2\\pi(${fmt(r)}) = ${fmt(v)}$ &nbsp;(${approx(v)})</div>`,
        chips: ["Area of a circle radius 5", "Explain the distance formula"] };
    }
    if (/area/.test(t)) {
      const v = Math.PI * r * r;
      return { html: `Area of a circle $= \\pi r^2$:<div class="ans">$\\pi\\,(${fmt(r)})^2 = ${fmt(r * r)}\\pi$ &nbsp;(${approx(v)})</div>`,
        chips: ["Circumference of circle radius 5", "Volume of a sphere radius 3"] };
    }
  }
  // Sphere volume
  if (/sphere/.test(t) && r != null && /volume/.test(t)) {
    const v = 4 / 3 * Math.PI * r ** 3;
    return { html: `Volume of a sphere $= \\tfrac{4}{3}\\pi r^3$:<div class="ans">$\\tfrac{4}{3}\\pi(${fmt(r)})^3 = ${approx(v).slice(2)}$</div>` };
  }
  // Rectangle "area of rectangle 5 by 8" / "5 x 8"
  let m;
  if (/rectangle/.test(t) && /area/.test(t) &&
      (m = t.match(/([\d.]+)\s*(?:by|x|×|\*)\s*([\d.]+)/))) {
    const a = parseFloat(m[1]), b = parseFloat(m[2]);
    return { html: `Area of a rectangle $= \\text{length}\\times\\text{width}$:<div class="ans">$${fmt(a)}\\times ${fmt(b)} = ${fmt(a * b)}$</div>` };
  }
  // Triangle area from base & height
  if (/triangle/.test(t) && /area/.test(t)) {
    const b = grabNum(t, /base\s*(?:of|=|:|is)?\s*([\d.]+)/);
    const h = grabNum(t, /height\s*(?:of|=|:|is)?\s*([\d.]+)/);
    if (b != null && h != null)
      return { html: `Area of a triangle $= \\tfrac{1}{2}bh$:<div class="ans">$\\tfrac{1}{2}\\times ${fmt(b)}\\times ${fmt(h)} = ${fmt(0.5 * b * h)}$</div>` };
  }
  return null;
}

// ----- Expression evaluator (safe; no eval) -----

function preprocessExpr(str) {
  let e = str.toLowerCase();
  e = e.replace(/√/g, "sqrt").replace(/×/g, "*").replace(/÷/g, "/").replace(/π/g, "pi");
  e = e.replace(/\^/g, "**");                 // exponent
  e = e.replace(/\bpi\b/g, String(Math.PI)).replace(/\be\b/g, String(Math.E));
  // implicit multiplication: 2( -> 2*(, )( -> )*(, 2x -> 2*x handled at var stage
  e = e.replace(/(\d)\s*\(/g, "$1*(").replace(/\)\s*\(/g, ")*(");
  return e;
}

const FUNCS = {
  sqrt: Math.sqrt, cbrt: Math.cbrt, abs: Math.abs,
  ln: Math.log, log: (x) => Math.log10(x), exp: Math.exp,
  sin: (x) => Math.sin(x * Math.PI / 180),
  cos: (x) => Math.cos(x * Math.PI / 180),
  tan: (x) => Math.tan(x * Math.PI / 180),
  asin: (x) => Math.asin(x) * 180 / Math.PI,
  acos: (x) => Math.acos(x) * 180 / Math.PI,
  atan: (x) => Math.atan(x) * 180 / Math.PI,
};

// Tokenize + shunting-yard evaluate. `vars` maps a variable letter to a number.
function evalExpr(input, vars) {
  const e = preprocessExpr(input);
  const tokens = [];
  const re = /\s*([A-Za-z_]+|\d+\.?\d*|\.\d+|\*\*|[+\-*/()])/g;
  let m, last = null;
  while ((m = re.exec(e)) !== null) {
    let tok = m[1];
    // unary minus → 0 - x
    if (tok === "-" && (last === null || last === "(" || last === "+" || last === "-" || last === "*" || last === "/" || last === "**")) {
      tokens.push("0"); tokens.push("-");
      last = "-"; continue;
    }
    tokens.push(tok);
    last = tok;
  }
  const prec = { "+": 1, "-": 1, "*": 2, "/": 2, "**": 3 };
  const rightAssoc = { "**": true };
  const out = [], ops = [];
  for (let i = 0; i < tokens.length; i++) {
    const tok = tokens[i];
    if (/^(\d|\.)/.test(tok)) out.push(parseFloat(tok));
    else if (/^[A-Za-z_]+$/.test(tok)) {
      if (tok in FUNCS) ops.push(tok);
      else if (vars && tok in vars) out.push(vars[tok]);
      else throw new Error("unknown: " + tok);
    } else if (tok in prec) {
      while (ops.length) {
        const top = ops[ops.length - 1];
        if (top in FUNCS) { out.push(ops.pop()); continue; }
        if (top in prec && (prec[top] > prec[tok] || (prec[top] === prec[tok] && !rightAssoc[tok]))) out.push(ops.pop());
        else break;
      }
      ops.push(tok);
    } else if (tok === "(") ops.push(tok);
    else if (tok === ")") {
      while (ops.length && ops[ops.length - 1] !== "(") out.push(ops.pop());
      if (!ops.length) throw new Error("mismatched )");
      ops.pop();
      if (ops.length && ops[ops.length - 1] in FUNCS) out.push(ops.pop());
    }
  }
  while (ops.length) {
    const op = ops.pop();
    if (op === "(") throw new Error("mismatched (");
    out.push(op);
  }
  const st = [];
  for (const tok of out) {
    if (typeof tok === "number") st.push(tok);
    else if (tok in FUNCS) st.push(FUNCS[tok](st.pop()));
    else {
      const b = st.pop(), a = st.pop();
      if (a === undefined || b === undefined) throw new Error("bad expr");
      st.push(tok === "+" ? a + b : tok === "-" ? a - b : tok === "*" ? a * b : tok === "/" ? a / b : Math.pow(a, b));
    }
  }
  if (st.length !== 1 || !isFinite(st[0])) throw new Error("no result");
  return st[0];
}

const fmt = (n) => {
  if (!isFinite(n)) return String(n);
  const r = Math.round(n * 1e10) / 1e10;
  return Number.isInteger(r) ? String(r) : String(parseFloat(r.toFixed(6)));
};

const escTex = (s) => s.replace(/\*\*/g, "^").replace(/\*/g, "\\times ").replace(/([a-zA-Z0-9_.]+)\/([a-zA-Z0-9_.]+)/g, "\\frac{$1}{$2}");

// ----- Arithmetic / expression questions -----

function tryArithmetic(s) {
  // strip question words, keep the math expression
  let expr = s.replace(/^(what('| i)?s|whats|calculate|evaluate|work out|compute|find|how much is|the value of|value of)\b/gi, "");
  expr = expr.replace(/[?=]+\s*$/g, "").replace(/[?]/g, "").trim();
  if (!/[0-9)]/.test(expr) || !/[+\-*/^√]/.test(expr) && !/(sqrt|sin|cos|tan|log|ln)/i.test(expr)) return null;
  if (/[a-wyz]/i.test(expr.replace(/sqrt|sin|cos|tan|log|ln|exp|abs|pi|cbrt|asin|acos|atan/gi, ""))) return null; // has stray variables
  try {
    const val = evalExpr(expr);
    const tex = escTex(preprocessExpr(expr).replace(/([0-9.]+)(?=e[+-])/gi, "$1"));
    return {
      html: `Here you go 👇<div class="ans">$${escTex(expr)} = ${fmt(val)}$</div>`,
      chips: ["√144", "2^10", "15% of 80", "Explain PEMDAS"],
    };
  } catch { return null; }
}

// ----- Percentages -----

function tryPercent(s) {
  let m;
  // X% of Y
  if ((m = s.match(/([\d.]+)\s*(?:%|percent)\s*of\s*([\d.]+)/i))) {
    const p = parseFloat(m[1]), y = parseFloat(m[2]), v = p / 100 * y;
    return {
      html: `<strong>${fmt(p)}% of ${fmt(y)}</strong> means ${fmt(p)}/100 × ${fmt(y)}.<div class="ans">$\\dfrac{${fmt(p)}}{100}\\times ${fmt(y)} = ${fmt(v)}$</div>💡 Tip: ${fmt(p)}% of ${fmt(y)} equals ${fmt(y)}% of ${fmt(p)} — flip whichever is easier!`,
      chips: ["25% of 80", "12 is what percent of 48?", "Increase 60 by 15%"],
    };
  }
  // X is what percent of Y
  if ((m = s.match(/([\d.]+)\s*is\s*what\s*percent\s*of\s*([\d.]+)/i))) {
    const x = parseFloat(m[1]), y = parseFloat(m[2]), v = x / y * 100;
    return {
      html: `Divide and multiply by 100:<div class="ans">$\\dfrac{${fmt(x)}}{${fmt(y)}}\\times 100 = ${fmt(v)}\\%$</div>`,
      chips: ["9 is what percent of 60?", "40% of 25"],
    };
  }
  // increase / decrease Y by X%
  if ((m = s.match(/(increase|decrease|raise|reduce)\s*([\d.]+)\s*by\s*([\d.]+)\s*%?/i))) {
    const up = /incre|raise/i.test(m[1]);
    const y = parseFloat(m[2]), p = parseFloat(m[3]);
    const v = y * (1 + (up ? 1 : -1) * p / 100);
    return {
      html: `${up ? "Increasing" : "Decreasing"} ${fmt(y)} by ${fmt(p)}%:<div class="ans">$${fmt(y)}\\times\\left(1 ${up ? "+" : "-"} \\dfrac{${fmt(p)}}{100}\\right) = ${fmt(v)}$</div>`,
      chips: ["Increase 200 by 10%", "Decrease 90 by 30%"],
    };
  }
  return null;
}

// ----- Equations (linear + quadratic) via function sampling -----

function detectVar(s) {
  const m = s.replace(/sqrt|sin|cos|tan|log|ln|exp|abs|pi|cbrt|asin|acos|atan/gi, " ").match(/[a-z]/i);
  return m ? m[0].toLowerCase() : "x";
}

function tryEquation(s) {
  let body = s.replace(/^(solve|find|what('| i)?s|whats|the value of|value of|for)\b/gi, " ");
  body = body.replace(/\bfor\s+[a-z]\b/gi, " ").replace(/[?]/g, "").trim();
  if (!body.includes("=")) return null;
  const sides = body.split("=");
  if (sides.length !== 2) return null;
  const v = detectVar(body);

  // make expressions evaluable: insert * between coefficient/var and var/paren
  const prep = (str) => str
    .replace(new RegExp("(\\d|\\))\\s*" + v, "gi"), "$1*" + v)
    .replace(new RegExp(v + "\\s*(\\d|\\()", "gi"), v + "*$1");

  const L = prep(sides[0]), R = prep(sides[1]);
  const f = (x) => {
    const vars = {}; vars[v] = x;
    return evalExpr(L, vars) - evalExpr(R, vars);
  };
  let f0, f1, fm1, f2;
  try { f0 = f(0); f1 = f(1); fm1 = f(-1); f2 = f(2); }
  catch { return null; }
  if (![f0, f1, fm1, f2].every(isFinite)) return null;

  // quadratic coefficients
  const a = (f1 + fm1) / 2 - f0;
  const b = (f1 - fm1) / 2;
  const c = f0;
  const predict2 = 4 * a + 2 * b + c;
  if (Math.abs(predict2 - f2) > 1e-6) return null; // not polynomial ≤ 2

  const V = v.toUpperCase() === v ? v : v; // keep as typed lower
  if (Math.abs(a) < 1e-9) {
    // linear: b*x + c = 0
    if (Math.abs(b) < 1e-9)
      return { html: Math.abs(c) < 1e-9
        ? "That equation is true for <strong>every</strong> value — infinitely many solutions. ♾️"
        : "That equation has <strong>no solution</strong> — the two sides can never be equal." };
    const x = -c / b;
    return {
      html:
        `Let's isolate <strong>${v}</strong> step by step:` +
        `<div class="ans">$${escTex(prep(sides[0]))} = ${escTex(prep(sides[1]))}$<br>` +
        `Move everything to one side: $${fmtCoef(b)}${v} ${signed(c)} = 0$<br>` +
        `So $${v} = \\dfrac{${fmt(-c)}}{${fmt(b)}} = \\mathbf{${fmt(x)}}$</div>`,
      chips: ["Solve 5x - 2 = 3x + 8", "Solve x/3 + 1 = 4", "Solve x^2 = 49"],
    };
  }

  // quadratic: a x^2 + b x + c = 0
  const D = b * b - 4 * a * c;
  const head = `Standard form: $${fmtCoef(a)}${v}^2 ${signedCoef(b, v)} ${signed(c)} = 0$<br>` +
    `Discriminant: $b^2-4ac = (${fmt(b)})^2 - 4(${fmt(a)})(${fmt(c)}) = ${fmt(D)}$<br>`;
  if (D < -1e-9)
    return { html: `<div class="ans">${head}Since the discriminant is negative, there are <strong>no real solutions</strong> (the parabola never crosses the x-axis).</div>`,
      chips: ["Solve x^2 + 1 = 0", "Explain the discriminant"] };
  const sqrtD = Math.sqrt(Math.max(D, 0));
  const r1 = (-b + sqrtD) / (2 * a), r2 = (-b - sqrtD) / (2 * a);
  const roots = Math.abs(D) < 1e-9
    ? `One (repeated) solution: $${v} = ${fmt(r1)}$`
    : `Two solutions: $${v} = ${fmt(r1)}$ or $${v} = ${fmt(r2)}$`;
  return {
    html: `<div class="ans">${head}$${v} = \\dfrac{-b \\pm \\sqrt{${fmt(D)}}}{2a} = \\dfrac{${fmt(-b)} \\pm ${fmt(sqrtD)}}{${fmt(2 * a)}}$<br><strong>${roots}</strong></div>`,
    chips: ["Solve x^2 - 7x + 12 = 0", "Explain completing the square"],
  };
}

const fmtCoef = (a) => (a === 1 ? "" : a === -1 ? "-" : fmt(a));
const signed = (n) => (n >= 0 ? "+ " + fmt(n) : "- " + fmt(-n));
const signedCoef = (b, v) => (b >= 0 ? "+ " + fmtCoef(b) + v : "- " + fmtCoef(-b) + v);

// ----- Concept knowledge base -----

const CONCEPTS = [
  { k: /quadratic formula/i, t: "Quadratic formula",
    html: "For $ax^2+bx+c=0$:<div class=\"ans\">$x = \\dfrac{-b \\pm \\sqrt{b^2-4ac}}{2a}$</div>The $\\pm$ gives the two roots. The part under the root, $b^2-4ac$, is the <strong>discriminant</strong> — it tells you how many real roots there are." },
  { k: /discriminant/i, t: "Discriminant",
    html: "The discriminant is $b^2-4ac$ (the bit under the square root in the quadratic formula):<div class=\"ans\">$>0$ → two real roots<br>$=0$ → one repeated root<br>$<0$ → no real roots</div>" },
  { k: /complet(e|ing) the square/i, t: "Completing the square",
    html: "Turn $x^2+bx+c$ into a perfect square:<div class=\"ans\">$x^2+bx = \\left(x+\\tfrac{b}{2}\\right)^2 - \\left(\\tfrac{b}{2}\\right)^2$</div>Add $\\left(\\tfrac{b}{2}\\right)^2$ to complete the square, then subtract it back to keep things equal." },
  { k: /pythagoras|pythagorean|hypotenuse/i, t: "Pythagorean theorem",
    html: "In a right triangle, the square of the hypotenuse equals the sum of the squares of the other two sides:<div class=\"ans\">$a^2 + b^2 = c^2$</div>where $c$ is the side opposite the right angle." },
  { k: /soh ?cah ?toa|trig(onometry)? ratio|sine.*cosine.*tangent|what is (sin|cos|tan)/i, t: "Trig ratios",
    html: "For a right triangle (O = opposite, A = adjacent, H = hypotenuse):<div class=\"ans\">$\\sin\\theta=\\dfrac{O}{H},\\quad \\cos\\theta=\\dfrac{A}{H},\\quad \\tan\\theta=\\dfrac{O}{A}$</div>Remember it as <strong>SOH-CAH-TOA</strong>." },
  { k: /sine rule|law of sines/i, t: "Sine rule",
    html: "<div class=\"ans\">$\\dfrac{a}{\\sin A}=\\dfrac{b}{\\sin B}=\\dfrac{c}{\\sin C}$</div>Use it when you know an angle and its opposite side." },
  { k: /cosine rule|law of cosines/i, t: "Cosine rule",
    html: "<div class=\"ans\">$c^2 = a^2 + b^2 - 2ab\\cos C$</div>Use it with two sides and the angle between them, or all three sides." },
  { k: /area of a? ?circle/i, t: "Area of a circle",
    html: "<div class=\"ans\">$A = \\pi r^2$</div>where $r$ is the radius. The circumference is $C = 2\\pi r$." },
  { k: /area of a? ?triangle/i, t: "Area of a triangle",
    html: "<div class=\"ans\">$A = \\tfrac{1}{2}\\,b\\,h$</div>base times height, halved. With two sides and the included angle: $A=\\tfrac12 ab\\sin C$." },
  { k: /area of a? ?(rectangle|square)/i, t: "Area of a rectangle",
    html: "<div class=\"ans\">$A = \\text{length} \\times \\text{width}$</div>For a square, that's just $A = s^2$." },
  { k: /(volume|surface area) of a? ?sphere/i, t: "Sphere",
    html: "<div class=\"ans\">$V = \\tfrac{4}{3}\\pi r^3,\\qquad SA = 4\\pi r^2$</div>" },
  { k: /(volume) of a? ?cylinder/i, t: "Volume of a cylinder",
    html: "<div class=\"ans\">$V = \\pi r^2 h$</div>area of the circular base times the height." },
  { k: /slope|gradient/i, t: "Slope of a line",
    html: "<div class=\"ans\">$m = \\dfrac{y_2 - y_1}{x_2 - x_1}$</div>rise over run. In $y = mx + b$, $m$ is the slope and $b$ is the y-intercept." },
  { k: /distance formula/i, t: "Distance formula",
    html: "<div class=\"ans\">$d = \\sqrt{(x_2-x_1)^2 + (y_2-y_1)^2}$</div>It's just the Pythagorean theorem on the coordinate plane." },
  { k: /midpoint/i, t: "Midpoint",
    html: "<div class=\"ans\">$\\left(\\dfrac{x_1+x_2}{2},\\ \\dfrac{y_1+y_2}{2}\\right)$</div>average the x's and average the y's." },
  { k: /difference of squares/i, t: "Difference of squares",
    html: "<div class=\"ans\">$a^2 - b^2 = (a-b)(a+b)$</div>" },
  { k: /laws? of (indices|exponents)|exponent rules/i, t: "Exponent rules",
    html: "<div class=\"ans\">$x^a x^b = x^{a+b},\\quad \\dfrac{x^a}{x^b}=x^{a-b},\\quad (x^a)^b = x^{ab}$<br>$x^{-a}=\\dfrac{1}{x^a},\\quad x^0 = 1,\\quad x^{1/n}=\\sqrt[n]{x}$</div>" },
  { k: /pemdas|bidmas|order of operations/i, t: "Order of operations",
    html: "Work in this order:<div class=\"ans\"><strong>P</strong>arentheses → <strong>E</strong>xponents → <strong>M</strong>ultiply/<strong>D</strong>ivide (left→right) → <strong>A</strong>dd/<strong>S</strong>ubtract (left→right)</div>" },
  { k: /compound interest/i, t: "Compound interest",
    html: "<div class=\"ans\">$A = P\\left(1 + \\dfrac{r}{100}\\right)^n$</div>$P$ = principal, $r$ = rate per period (%), $n$ = number of periods." },
  { k: /nth term|arithmetic sequence/i, t: "Arithmetic sequence",
    html: "The nth term of an arithmetic sequence:<div class=\"ans\">$a_n = a + (n-1)d$</div>$a$ = first term, $d$ = common difference." },
  { k: /(mean|average) (and|,|&|vs).*(median|mode)|what is the (mean|median|mode)/i, t: "Mean, median, mode",
    html: "<div class=\"ans\"><strong>Mean</strong> = sum ÷ count<br><strong>Median</strong> = middle value when sorted<br><strong>Mode</strong> = most frequent value</div>" },
  { k: /probabilit/i, t: "Probability",
    html: "<div class=\"ans\">$P(\\text{event}) = \\dfrac{\\text{favorable outcomes}}{\\text{total outcomes}}$</div>Always between 0 (impossible) and 1 (certain)." },
  { k: /interior angles?.*polygon|angles? of a polygon/i, t: "Angles of a polygon",
    html: "Sum of interior angles of an $n$-sided polygon:<div class=\"ans\">$(n-2)\\times 180^\\circ$</div>" },
];

function tryConcept(s) {
  for (const c of CONCEPTS) {
    if (c.k.test(s)) {
      const html = `<strong>${c.t}</strong><br>${c.html}`;
      const related = relatedLesson(c.t);
      return { html: html + related, chips: ["Solve x^2 - 5x + 6 = 0", "Area of a circle radius 5", "What is 20% of 150?"] };
    }
  }
  return null;
}

// Point students to a published lesson if its title/topic matches the concept
function relatedLesson(topic) {
  const words = topic.toLowerCase().split(/\W+/).filter((w) => w.length > 3);
  const hit = TOPICS.find((t) => {
    const hay = (t.title + " " + t.curriculumModule).toLowerCase();
    return words.some((w) => hay.includes(w));
  });
  if (!hit) return "";
  return `<div class="ans-lesson">📚 We have a lesson on this: <a href="#/topic/${hit.id}" onclick="closeChat()">${hit.lessonCode} ${hit.title}</a></div>`;
}

function fallbackMath(s) {
  return {
    html: "That looks like math, but I couldn't crunch it as written 🤔. I'm best at:" +
      "<ul class=\"bot-list\"><li>solving equations — “solve 2x + 3 = 11”</li><li>arithmetic — “(12 + 5) × 3”</li><li>percentages — “18% of 250”</li><li>explaining formulas — “explain the sine rule”</li></ul>Try rephrasing and I'll give it another go!",
    chips: ["Solve 4x - 7 = 9", "√169", "Explain Pythagoras"],
  };
}
