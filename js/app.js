/* MathClicks — all site logic.
   Content lives in data/topics/*.json; this file never needs editing to add lessons. */

"use strict";

// Cache-buster so students always see freshly published content
const BUST = "?t=" + Date.now();

// ---------- Passcode gate (courtesy gate, not real security) ----------

const PASS_HASH = "51a12285";
const AUTH_KEY = "satpractice.auth";

function passHash(s) {
  let h = 5381;
  for (const c of s) h = (Math.imul(h, 33) ^ c.codePointAt(0)) >>> 0;
  return h.toString(16);
}

const gate = document.getElementById("gate");
const site = document.getElementById("site");

function unlock() {
  gate.classList.add("hidden");
  site.classList.remove("hidden");
  boot().catch((err) => {
    console.error("boot failed:", err);
    const main = document.getElementById("main");
    main.replaceChildren();
    const note = document.createElement("div");
    note.className = "empty-note";
    note.textContent = "Couldn't load the lessons — check your connection and refresh the page.";
    main.appendChild(note);
  });
}

if (localStorage.getItem(AUTH_KEY) === PASS_HASH) {
  unlock();
} else {
  gate.classList.remove("hidden");
  document.getElementById("gate-form").addEventListener("submit", (e) => {
    e.preventDefault();
    const val = document.getElementById("gate-input").value.trim();
    if (passHash(val) === PASS_HASH) {
      localStorage.setItem(AUTH_KEY, PASS_HASH);
      unlock();
    } else {
      document.getElementById("gate-error").classList.remove("hidden");
    }
  });
}

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
  initSearch();
  route();
}

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

// A module's accent = its lessons' domain (or "mixed" if they differ)
function moduleDomClass(topics) {
  const d = new Set(topics.map((t) => t.satDomain));
  return d.size === 1 ? domClass(topics[0].satDomain) : "dom-mixed";
}

// ---------- Best-score persistence ----------

const scoreKey = (id) => "satpractice.best." + id;

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

// ---------- Routing ----------

const main = document.getElementById("main");

function route() {
  const parts = (location.hash || "#/").slice(2).split("/");
  const view = parts[0] || "home";
  window.scrollTo(0, 0);
  main.dataset.view = view;
  if (view === "module") renderModule(decodeURIComponent(parts[1] || ""));
  else if (view === "topic") renderTopic(decodeURIComponent(parts[1] || ""));
  else if (view === "modules") renderModules();
  else if (view === "igcse") renderIgcse();
  else renderHome();
  setActiveNav(view);
  typeset(main);
}

function setActiveNav(view) {
  const topicViews = new Set(["modules", "module", "topic"]);
  document.querySelectorAll(".nav-link").forEach((a) => {
    const active = a.dataset.nav === "topics" ? topicViews.has(view) : view === "home";
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

function statsStrip() {
  const totalQ = TOPICS.reduce((s, t) => s + qCount(t), 0);
  const totalV = TOPICS.reduce((s, t) => s + (t.videos ? t.videos.length : 0), 0);
  const done = TOPICS.filter((t) => bestScore(t.id)).length;
  const strip = el("div", "stats");
  const chip = (label) => strip.appendChild(el("span", "stat-chip", label));
  chip(`📚 ${plural(TOPICS.length, "lesson")}`);
  chip(`📝 ${plural(totalQ, "question")}`);
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
  return el("span", "badge" + (n ? "" : " soon"), n ? plural(n, "question") : "coming soon");
}

function moduleCard(m) {
  const a = el("a", "card " + moduleDomClass(m.topics));
  a.href = "#/module/" + moduleSlug(m.name);
  a.appendChild(el("div", "card-icon", MODULE_ICON));
  const body = el("div", "card-body");
  body.appendChild(el("div", "card-title", m.name));
  body.appendChild(el("div", "card-sub", subLine(m.topics)));
  const done = m.topics.filter((t) => bestScore(t.id)).length;
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
  const done = bestScore(t.id);
  a.appendChild(el("div", "step-dot" + (done ? " done" : ""), done ? "✓" : String(i + 1)));
  const body = el("div", "card-body");
  const title = el("div", "card-title", t.title);
  title.appendChild(countBadge(t));
  body.appendChild(title);
  const extras = [t.lessonCode, `${DOMAIN_ICONS[t.satDomain] || ""} ${t.satDomain}`];
  if (t.videos && t.videos.length) extras.push(`🎬 ${plural(t.videos.length, "video")}`);
  body.appendChild(el("div", "card-sub", extras.join(" · ")));
  a.appendChild(body);
  a.appendChild(el("span", "card-arrow", "›"));
  return a;
}

function subLine(topics) {
  const total = topics.reduce((s, t) => s + qCount(t), 0);
  return `${plural(topics.length, "lesson")} · ${total ? plural(total, "question") : "questions coming soon"}`;
}

// ---------- Views ----------

function renderHome() {
  main.replaceChildren();

  // Hero
  const hero = el("section", "hero");
  const syms = el("div", "hero-symbols");
  ["∑", "π", "√x", "÷", "x²", "∞", "θ"].forEach((s, i) =>
    syms.appendChild(el("span", "sym s" + (i + 1), s))
  );
  hero.appendChild(syms);
  const inner = el("div", "hero-inner");
  inner.appendChild(el("div", "hero-eyebrow", "MathClicks"));
  const h1 = el("h1", "hero-title", "Now it's your turn to ");
  h1.appendChild(el("span", "hero-click", "click it."));
  inner.appendChild(h1);
  inner.appendChild(el("p", "hero-sub",
    "Short video explanations, interactive notes, and instant-feedback quizzes — built for IGCSE and SAT math students."));
  const cta = el("div", "hero-cta");
  const browse = el("a", "btn btn-cta", "Browse Topics →");
  browse.href = "#/modules";
  cta.appendChild(browse);
  inner.appendChild(cta);
  hero.appendChild(inner);
  main.appendChild(hero);

  // Feature strip
  const feats = el("div", "features");
  for (const [icon, title, sub] of [
    ["🎬", "Watch", "Short video explanations"],
    ["🧠", "Learn", "Interactive lesson notes"],
    ["⚡", "Practice", "Quizzes with instant feedback"],
  ]) {
    const f = el("div", "feature");
    f.appendChild(el("div", "feature-icon", icon));
    const b = el("div");
    b.appendChild(el("div", "feature-title", title));
    b.appendChild(el("div", "feature-sub", sub));
    f.appendChild(b);
    feats.appendChild(f);
  }
  main.appendChild(feats);

  // Subject areas
  main.appendChild(el("h2", "home-sec-title", "Pick your path"));
  const grid = el("div", "subject-grid");

  const totalQ = TOPICS.reduce((s, t) => s + qCount(t), 0);
  const done = TOPICS.filter((t) => bestScore(t.id)).length;
  const satChips = [`📚 ${plural(TOPICS.length, "lesson")}`, `📝 ${plural(totalQ, "question")}`];
  if (done) satChips.push(`⭐ ${done} completed`);
  grid.appendChild(subjectCard({
    cls: "sat", href: "#/modules", icon: "🎯", title: "American Pathway",
    sub: "",
    chips: satChips, cta: "Start practicing →",
  }));
  grid.appendChild(subjectCard({
    cls: "igcse", href: "#/igcse", icon: "📘", title: "IGCSE Math",
    sub: "New lessons are on the way — stay tuned!",
    chips: [], cta: "Peek inside →", soon: true,
  }));
  main.appendChild(grid);
}

function subjectCard(o) {
  const a = el("a", "subject " + o.cls);
  a.href = o.href;
  a.appendChild(el("div", "subject-icon", o.icon));
  a.appendChild(el("div", "subject-title", o.title));
  a.appendChild(el("div", "subject-sub", o.sub));
  const meta = el("div", "subject-meta");
  for (const c of o.chips) meta.appendChild(el("span", "subject-chip", c));
  a.appendChild(meta);
  a.appendChild(el("span", "subject-go", o.cta));
  if (o.soon) a.appendChild(el("span", "soon-badge", "Coming soon"));
  return a;
}

function renderIgcse() {
  main.replaceChildren();
  main.appendChild(backLink("#/", "← Home"));
  main.appendChild(el("h2", "page-title", "IGCSE Math"));
  const box = el("div", "empty-note big");
  box.appendChild(el("div", "empty-emoji", "🚧"));
  box.appendChild(el("div", "empty-title", "Coming soon!"));
  box.appendChild(el("p", null,
    "IGCSE lessons are being prepared. In the meantime, SAT Prep is ready for you."));
  const b = el("a", "btn btn-cta", "Browse SAT Topics");
  b.href = "#/modules";
  box.appendChild(b);
  main.appendChild(box);
}

function renderModules() {
  main.replaceChildren();
  main.appendChild(backLink("#/", "← Home"));
  main.appendChild(el("h2", "page-title", "SAT Prep"));
  main.appendChild(el("p", "page-sub", "American Pathway — pick a module to begin."));
  if (!TOPICS.length) {
    main.appendChild(el("div", "empty-note", "Lessons will appear here as we cover them in class — check back soon!"));
    return;
  }
  main.appendChild(statsStrip());
  for (const m of moduleList()) main.appendChild(moduleCard(m));
}

function renderModule(slug) {
  const m = moduleList().find((m) => moduleSlug(m.name) === slug);
  if (!m) return renderModules();
  main.replaceChildren();
  main.appendChild(backLink("#/modules", "← All modules"));
  main.appendChild(el("h2", "page-title", m.name));
  m.topics.forEach((t, i) => main.appendChild(lessonCard(t, i)));
}

function backLink(href, text) {
  const a = el("a", "back-link", text);
  a.href = href;
  return a;
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
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !overlay.classList.contains("hidden")) close();
  });
  input.addEventListener("input", () => renderResults(input.value));
  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      const first = results.querySelector("a");
      if (first) first.click();
    }
  });
  results.addEventListener("click", (e) => { if (e.target.closest("a")) close(); });
}

// ---------- Lesson page: videos + quiz ----------

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
    ifr.allow = "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture";
    ifr.allowFullscreen = true;
    ifr.title = v.title || "Explanation video";
    frame.appendChild(ifr);
  } else {
    const vid = document.createElement("video");
    vid.src = v.url;
    vid.controls = true;
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
  if (!t) return renderModules();

  main.replaceChildren();
  main.appendChild(backLink("#/module/" + moduleSlug(t.curriculumModule), "← " + t.curriculumModule));
  main.appendChild(el("h2", "page-title", `${t.lessonCode} ${t.title}`));

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
