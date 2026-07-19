/* 10SAT Math Practice — all site logic.
   Content lives in data/topics/*.json; this file never needs editing to add lessons. */

"use strict";

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
  boot();
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
  const manifest = await (await fetch("data/manifest.json")).json();
  const all = await Promise.all(
    manifest.topics.map((f) => fetch("data/topics/" + f).then((r) => r.json()))
  );
  // Students only ever see lessons marked ready by the teacher
  TOPICS = all.filter((t) => t.published);
  window.addEventListener("hashchange", route);
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
  const parts = (location.hash || "#/modules").slice(2).split("/");
  window.scrollTo(0, 0);
  if (parts[0] === "module") renderModule(decodeURIComponent(parts[1] || ""));
  else if (parts[0] === "topic") renderTopic(decodeURIComponent(parts[1] || ""));
  else renderModules();
  typeset(main);
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

function bigCard(href, domCls, icon, title, sub) {
  const a = el("a", "card " + domCls);
  a.href = href;
  a.appendChild(el("div", "card-icon", icon));
  const body = el("div", "card-body");
  body.appendChild(el("div", "card-title", title));
  body.appendChild(el("div", "card-sub", sub));
  a.appendChild(body);
  a.appendChild(el("span", "card-arrow", "›"));
  return a;
}

function lessonCard(t) {
  const a = el("a", "card " + domClass(t.satDomain));
  a.href = "#/topic/" + t.id;
  a.appendChild(el("div", "card-icon", DOMAIN_ICONS[t.satDomain] || "📘"));
  const body = el("div", "card-body");
  const title = el("div", "card-title", t.title);
  title.appendChild(countBadge(t));
  body.appendChild(title);
  const extras = [t.lessonCode];
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

function renderModules() {
  main.replaceChildren();
  main.appendChild(el("h2", "page-title", "Lessons"));
  if (!TOPICS.length) {
    main.appendChild(el("div", "empty-note", "Lessons will appear here as we cover them in class — check back soon!"));
    return;
  }
  main.appendChild(statsStrip());
  for (const m of moduleList()) {
    main.appendChild(
      bigCard("#/module/" + moduleSlug(m.name), moduleDomClass(m.topics), MODULE_ICON, m.name, subLine(m.topics))
    );
  }
}

function renderModule(slug) {
  const m = moduleList().find((m) => moduleSlug(m.name) === slug);
  if (!m) return renderModules();
  main.replaceChildren();
  main.appendChild(backLink("#/modules", "← All modules"));
  main.appendChild(el("h2", "page-title", m.name));
  for (const t of m.topics) main.appendChild(lessonCard(t));
}

function backLink(href, text) {
  const a = el("a", "back-link", text);
  a.href = href;
  return a;
}

// ---------- Lesson page: videos + quiz ----------

function youtubeId(url) {
  const m = String(url).match(
    /(?:youtube\.com\/(?:watch\?(?:.*&)?v=|embed\/|shorts\/|live\/)|youtu\.be\/)([\w-]{11})/
  );
  return m ? m[1] : null;
}

function videoCard(v) {
  const card = el("div", "video-card");
  const frame = el("div", "video-frame");
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
  main.appendChild(el("h3", "section-title", "🎬 Watch the explanation"));
  if (t.videos && t.videos.length) {
    for (const v of t.videos) main.appendChild(videoCard(v));
  } else {
    main.appendChild(el("div", "empty-note", "Explanation video coming soon."));
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
  ring.style.setProperty("--ring", pct === 100 ? "#16a34a" : pct >= 70 ? "#4f46e5" : "#d97706");
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
