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

let TOPICS = [];          // in curriculum order
let DOMAINS = [];

async function boot() {
  const manifest = await (await fetch("data/manifest.json")).json();
  DOMAINS = manifest.domains;
  TOPICS = await Promise.all(
    manifest.topics.map((f) => fetch("data/topics/" + f).then((r) => r.json()))
  );
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

// ---------- Routing ----------

const main = document.getElementById("main");

function route() {
  const parts = (location.hash || "#/modules").slice(2).split("/");
  setActiveTab(parts[0]);
  window.scrollTo(0, 0);
  if (parts[0] === "domains") renderDomains();
  else if (parts[0] === "domain") renderDomain(decodeURIComponent(parts[1] || ""));
  else if (parts[0] === "module") renderModule(decodeURIComponent(parts[1] || ""));
  else if (parts[0] === "topic") renderTopic(decodeURIComponent(parts[1] || ""));
  else renderModules();
  typeset(main);
}

function setActiveTab(view) {
  const domainy = view === "domains" || view === "domain";
  document.getElementById("tab-modules").classList.toggle("active", !domainy);
  document.getElementById("tab-domains").classList.toggle("active", domainy);
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

function countBadge(n) {
  const b = el("span", "badge" + (n ? "" : " soon"), n ? plural(n, "question") : "coming soon");
  return b;
}

function lessonCard(t) {
  const a = el("a", "card");
  a.href = "#/topic/" + t.id;
  const row = el("div", "lesson-row");
  row.appendChild(el("span", "lesson-code", t.lessonCode));
  const title = el("span", "card-title", t.title);
  title.appendChild(countBadge(qCount(t)));
  row.appendChild(title);
  a.appendChild(row);
  return a;
}

// ---------- Views ----------

function renderModules() {
  main.replaceChildren();
  main.appendChild(el("h2", "page-title", "Browse by curriculum module"));
  for (const m of moduleList()) {
    const total = m.topics.reduce((s, t) => s + qCount(t), 0);
    const a = el("a", "card");
    a.href = "#/module/" + moduleSlug(m.name);
    a.appendChild(el("div", "card-title", m.name));
    a.appendChild(
      el("div", "card-sub",
        `${plural(m.topics.length, "lesson")} · ${total ? plural(total, "question") : "questions coming soon"}`)
    );
    main.appendChild(a);
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

function renderDomains() {
  main.replaceChildren();
  main.appendChild(el("h2", "page-title", "Browse by SAT Math domain"));
  for (const d of DOMAINS) {
    const topics = TOPICS.filter((t) => t.satDomain === d);
    const total = topics.reduce((s, t) => s + qCount(t), 0);
    const a = el("a", "card");
    a.href = "#/domain/" + domainSlug(d);
    a.appendChild(el("div", "card-title", d));
    a.appendChild(
      el("div", "card-sub",
        `${plural(topics.length, "lesson")} · ${total ? plural(total, "question") : "questions coming soon"}`)
    );
    main.appendChild(a);
  }
}

function renderDomain(slug) {
  const d = DOMAINS.find((d) => domainSlug(d) === slug);
  if (!d) return renderDomains();
  main.replaceChildren();
  main.appendChild(backLink("#/domains", "← All domains"));
  main.appendChild(el("h2", "page-title", d));
  // group by module, curriculum order
  for (const m of moduleList()) {
    const topics = m.topics.filter((t) => t.satDomain === d);
    if (!topics.length) continue;
    main.appendChild(el("div", "group-label", m.name));
    for (const t of topics) main.appendChild(lessonCard(t));
  }
}

function backLink(href, text) {
  const a = el("a", "back-link", text);
  a.href = href;
  return a;
}

// ---------- Quiz ----------

function renderTopic(id) {
  const t = TOPICS.find((t) => t.id === id);
  if (!t) return renderModules();

  main.replaceChildren();
  main.appendChild(backLink("#/module/" + moduleSlug(t.curriculumModule), "← " + t.curriculumModule));
  const h = el("h2", "page-title", `${t.lessonCode} ${t.title}`);
  main.appendChild(h);
  main.appendChild(el("div", "quiz-meta", `SAT domain: ${t.satDomain}`));

  if (!t.questions.length) {
    main.appendChild(
      el("div", "empty-note", "No questions here yet — this lesson is coming soon.")
    );
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
    fb.appendChild(el("div", "verdict", isCorrect ? "Correct!" : "Incorrect" + (correctText ? ` — the answer is ${correctText}` : "")));
    if (q.explanation) fb.appendChild(el("div", null, q.explanation));
    card.appendChild(fb);

    const actions = el("div", "q-actions");
    const next = el("button", "btn btn-primary",
      quiz.i + 1 < t.questions.length ? "Next question" : "See results");
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
  holder.replaceChildren();
  const card = el("div", "result-card");
  card.appendChild(el("div", null, "Lesson complete"));
  card.appendChild(el("div", "result-score", `${quiz.correct} / ${t.questions.length}`));
  const pct = Math.round((quiz.correct / t.questions.length) * 100);
  card.appendChild(el("div", "result-note",
    pct === 100 ? "Perfect score — excellent work!"
    : pct >= 70 ? "Nice work — review the ones you missed."
    : "Keep practicing — reread the explanations and try again."));
  const again = el("button", "btn btn-primary", "Try again");
  again.addEventListener("click", () => {
    quiz.i = 0; quiz.correct = 0;
    showQuestion(quiz, holder);
  });
  card.appendChild(again);
  holder.appendChild(card);
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
