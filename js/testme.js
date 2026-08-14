/* MathClicks — Question Bank + "Test Me" custom test builder.
   Loaded on demand by js/app.js (the #/test route and the question-bank
   section on a lesson page). Relies on globals defined in app.js:
   el, typeset, plural, moduleSlug, moduleList, trackOf, TOPICS, BUST,
   gridinCorrect, celebrate. */

(function () {
  "use strict";

  const K_CFG = "mathclicks.test.cfg";
  const K_HIST = "mathclicks.test.history";
  const LETTERS = ["A", "B", "C", "D", "E"];

  const BANK_CACHE = new Map();   // topic id -> {id, questions:[…]}
  let timer = null;               // active countdown interval

  // ---------- data ----------

  async function loadBank(id) {
    if (BANK_CACHE.has(id)) return BANK_CACHE.get(id);
    let bank = { id, questions: [] };
    try {
      const r = await fetch("data/bank/" + id + ".json" + BUST);
      if (r.ok) bank = await r.json();
    } catch { /* offline or missing bank — treated as empty */ }
    BANK_CACHE.set(id, bank);
    return bank;
  }

  // Lessons that actually have a bank, in curriculum order.
  const bankTopics = (track) =>
    TOPICS.filter((t) => (t.bankCount || 0) > 0 && (!track || trackOf(t) === track));

  // ---------- small helpers ----------

  function shuffle(a) {
    const out = a.slice();
    for (let i = out.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [out[i], out[j]] = [out[j], out[i]];
    }
    return out;
  }

  const sample = (arr, n) => (n >= arr.length ? shuffle(arr) : shuffle(arr).slice(0, n));

  // "All of the above", "neither", "none of these" only make sense at the end
  // of the list, so they stay pinned last while everything else is shuffled.
  const anchored = (c) => /\b(above|below|both\s+[a-e]\b|neither|all of these|none of these)\b/i.test(c);

  function shuffleChoices(q) {
    if (q.type === "grid-in" || !Array.isArray(q.choices)) return q;
    const correct = q.choices[LETTERS.indexOf(q.answer)];
    if (correct === undefined) return q;
    const free = q.choices.filter((c) => !anchored(c));
    const pinned = q.choices.filter(anchored);
    if (free.length < 2) return q;
    const choices = shuffle(free).concat(pinned);
    return Object.assign({}, q, { choices, answer: LETTERS[choices.indexOf(correct)] });
  }

  function readCfg() {
    try { return JSON.parse(localStorage.getItem(K_CFG)) || {}; } catch { return {}; }
  }
  function saveCfg(cfg) {
    try { localStorage.setItem(K_CFG, JSON.stringify(cfg)); } catch {}
  }
  function history() {
    try { return JSON.parse(localStorage.getItem(K_HIST)) || []; } catch { return []; }
  }
  function pushHistory(entry) {
    try {
      const h = history();
      h.unshift(entry);
      localStorage.setItem(K_HIST, JSON.stringify(h.slice(0, 8)));
    } catch {}
  }

  const fmtTime = (s) =>
    `${Math.floor(s / 60)}:${String(Math.max(0, s % 60)).padStart(2, "0")}`;

  function stop() {
    if (timer) { clearInterval(timer); timer = null; }
  }

  // ---------- the builder page (#/test) ----------

  function renderPage(root) {
    stop();
    const cfg = readCfg();
    const chosen = new Set(Array.isArray(cfg.lessons) ? cfg.lessons : []);
    let perLesson = cfg.perLesson || 5;
    let mode = cfg.mode === "exam" ? "exam" : "instant";
    let minutes = cfg.minutes || 0;

    const topics = bankTopics("ap");

    root.appendChild(el("h2", "page-title", "🎯 Test Me"));
    root.appendChild(el("p", "page-sub",
      "Pick the lessons you want to be tested on and MathClicks builds a fresh test " +
      "from the question bank — different questions every time."));

    if (!topics.length) {
      root.appendChild(el("div", "empty-note",
        "The question bank is still being written — check back soon!"));
      return;
    }

    // Summary + start button live above the picker so they stay stuck to the
    // top of the screen while the student scrolls a long list of lessons.
    const bar = el("div", "tm-bar");
    const summary = el("div", "tm-summary");
    const start = el("button", "btn btn-primary", "Build my test →");
    bar.append(summary, start);
    root.appendChild(bar);

    const card = el("div", "tm-card");
    root.appendChild(card);

    // --- Step 1: lessons ---
    card.appendChild(stepHead("1", "Choose your lessons"));

    const quick = el("div", "tm-quick");
    const btnAll = el("button", "tm-mini", "Select all");
    const btnNone = el("button", "tm-mini", "Clear");
    const btnStudied = el("button", "tm-mini", "Lessons I've started");
    quick.append(btnAll, btnNone, btnStudied);
    card.appendChild(quick);

    const list = el("div", "tm-modules");
    card.appendChild(list);

    const boxes = new Map();   // topic id -> input

    for (const m of moduleList(topics)) {
      const group = el("div", "tm-module");
      const head = el("label", "tm-mod-head");
      const modBox = el("input");
      modBox.type = "checkbox";
      const label = el("span", "tm-mod-name", m.name);
      const count = el("span", "tm-mod-count", plural(m.topics.length, "lesson"));
      head.append(modBox, label, count);
      group.appendChild(head);

      const rows = el("div", "tm-lessons");
      for (const t of m.topics) {
        const row = el("label", "tm-lesson");
        const box = el("input");
        box.type = "checkbox";
        box.checked = chosen.has(t.id);
        box.addEventListener("change", () => {
          if (box.checked) chosen.add(t.id); else chosen.delete(t.id);
          syncModule();
          paintSummary();
        });
        boxes.set(t.id, box);
        row.appendChild(box);
        const nm = el("span", "tm-lesson-name");
        nm.appendChild(el("strong", null, t.lessonCode));
        nm.appendChild(document.createTextNode(" " + t.title));
        row.appendChild(nm);
        row.appendChild(el("span", "tm-lesson-count", `${t.bankCount} Q`));
        rows.appendChild(row);
      }
      group.appendChild(rows);
      list.appendChild(group);

      const syncModule = () => {
        const on = m.topics.filter((t) => chosen.has(t.id)).length;
        modBox.checked = on === m.topics.length;
        modBox.indeterminate = on > 0 && on < m.topics.length;
      };
      modBox.addEventListener("change", () => {
        for (const t of m.topics) {
          if (modBox.checked) chosen.add(t.id); else chosen.delete(t.id);
          boxes.get(t.id).checked = modBox.checked;
        }
        syncModule();
        paintSummary();
      });
      syncModule();
      group._sync = syncModule;
    }

    const syncAll = () => {
      for (const [id, box] of boxes) box.checked = chosen.has(id);
      list.querySelectorAll(".tm-module").forEach((g) => g._sync && g._sync());
      paintSummary();
    };
    btnAll.addEventListener("click", () => { topics.forEach((t) => chosen.add(t.id)); syncAll(); });
    btnNone.addEventListener("click", () => { chosen.clear(); syncAll(); });
    btnStudied.addEventListener("click", () => {
      chosen.clear();
      topics.forEach((t) => { if (localStorage.getItem("mathclicks.status." + t.id)) chosen.add(t.id); });
      if (!chosen.size) topics.forEach((t) => chosen.add(t.id));
      syncAll();
    });

    // --- Step 2: how many ---
    card.appendChild(stepHead("2", "How many questions from each lesson?"));
    const perRow = el("div", "tm-chips");
    const perOptions = [3, 5, 10, 0];
    const perBtns = perOptions.map((n) => {
      const b = el("button", "tm-chip", n === 0 ? "All" : String(n));
      b.addEventListener("click", () => {
        perLesson = n;
        perBtns.forEach((x, i) => x.classList.toggle("on", perOptions[i] === n));
        paintSummary();
      });
      perRow.appendChild(b);
      return b;
    });
    perBtns.forEach((b, i) => b.classList.toggle("on", perOptions[i] === perLesson));
    card.appendChild(perRow);

    // --- Step 3: mode + timer ---
    card.appendChild(stepHead("3", "How do you want to take it?"));
    const modeRow = el("div", "tm-modes");
    const modes = [
      ["instant", "⚡ Practice", "See if you're right after every question."],
      ["exam", "📝 Exam mode", "Answer everything first, get your score at the end."],
    ];
    const modeBtns = modes.map(([key, name, desc]) => {
      const b = el("button", "tm-mode");
      b.appendChild(el("span", "tm-mode-name", name));
      b.appendChild(el("span", "tm-mode-desc", desc));
      b.addEventListener("click", () => {
        mode = key;
        modeBtns.forEach((x, i) => x.classList.toggle("on", modes[i][0] === key));
      });
      modeRow.appendChild(b);
      return b;
    });
    modeBtns.forEach((b, i) => b.classList.toggle("on", modes[i][0] === mode));
    card.appendChild(modeRow);

    const timeRow = el("div", "tm-chips tm-time");
    timeRow.appendChild(el("span", "tm-time-label", "⏱ Time limit"));
    const timeOptions = [0, 10, 20, 30];
    const timeBtns = timeOptions.map((n) => {
      const b = el("button", "tm-chip", n === 0 ? "No limit" : n + " min");
      b.addEventListener("click", () => {
        minutes = n;
        timeBtns.forEach((x, i) => x.classList.toggle("on", timeOptions[i] === n));
      });
      timeRow.appendChild(b);
      return b;
    });
    timeBtns.forEach((b, i) => b.classList.toggle("on", timeOptions[i] === minutes));
    card.appendChild(timeRow);

    function plannedCount() {
      let n = 0;
      for (const t of topics) {
        if (!chosen.has(t.id)) continue;
        n += perLesson === 0 ? t.bankCount : Math.min(perLesson, t.bankCount);
      }
      return n;
    }
    function paintSummary() {
      const lessons = topics.filter((t) => chosen.has(t.id)).length;
      const qs = plannedCount();
      summary.textContent = lessons
        ? `${plural(lessons, "lesson")} · ${plural(qs, "question")}`
        : "Choose at least one lesson";
      start.disabled = !lessons;
    }
    paintSummary();

    start.addEventListener("click", async () => {
      const picked = topics.filter((t) => chosen.has(t.id));
      if (!picked.length) return;
      saveCfg({ lessons: [...chosen], perLesson, mode, minutes });
      start.disabled = true;
      start.textContent = "Building…";
      const questions = await buildQuestions(picked, perLesson);
      if (!questions.length) {
        start.disabled = false;
        start.textContent = "Build my test →";
        summary.textContent = "Couldn't load those questions — check your connection.";
        return;
      }
      runTest(root, { questions, mode, minutes, lessons: picked.length });
    });

    // --- past attempts ---
    const past = history();
    if (past.length) {
      root.appendChild(el("h3", "section-title", "📈 Your recent tests"));
      const hist = el("div", "tm-history");
      for (const h of past) {
        const row = el("div", "tm-hist");
        const pct = Math.round((h.correct / h.total) * 100);
        row.appendChild(el("span", "tm-hist-score " + (pct >= 80 ? "good" : pct >= 50 ? "ok" : "low"),
          `${h.correct}/${h.total}`));
        const mid = el("div", "tm-hist-mid");
        mid.appendChild(el("div", "tm-hist-title", h.label));
        mid.appendChild(el("div", "tm-hist-sub", h.when));
        row.appendChild(mid);
        row.appendChild(el("span", "tm-hist-pct", pct + "%"));
        hist.appendChild(row);
      }
      root.appendChild(hist);
    }
  }

  function stepHead(n, text) {
    const h = el("div", "tm-step");
    h.appendChild(el("span", "tm-step-n", n));
    h.appendChild(el("span", "tm-step-t", text));
    return h;
  }

  async function buildQuestions(picked, perLesson) {
    const banks = await Promise.all(picked.map((t) => loadBank(t.id)));
    const out = [];
    banks.forEach((bank, i) => {
      const t = picked[i];
      const qs = bank.questions || [];
      if (!qs.length) return;
      for (const q of sample(qs, perLesson === 0 ? qs.length : perLesson)) {
        out.push(Object.assign(shuffleChoices(q), {
          _lesson: { id: t.id, code: t.lessonCode, title: t.title },
        }));
      }
    });
    return shuffle(out);
  }

  // ---------- the test runner ----------

  function runTest(root, opts) {
    stop();
    root.replaceChildren();
    const state = {
      questions: opts.questions,
      mode: opts.mode || "instant",
      i: 0,
      answers: new Array(opts.questions.length).fill(null),  // {given, correct}
      started: Date.now(),
      remaining: (opts.minutes || 0) * 60,
      label: opts.label || `${plural(opts.lessons || 1, "lesson")} · ${plural(opts.questions.length, "question")}`,
      onExit: opts.onExit,
      // Set when the test came from one lesson's bank: the result then counts
      // as that lesson's best score, exactly like the old built-in quiz.
      scoreTopic: opts.scoreTopic || null,
    };

    const head = el("div", "tm-run-head");
    const meter = el("div", "tm-meter");
    const bar = el("div", "tm-meter-fill");
    meter.appendChild(bar);
    const clock = el("span", "tm-clock");
    head.appendChild(el("span", "tm-run-title", state.mode === "exam" ? "📝 Exam mode" : "⚡ Practice test"));
    head.appendChild(clock);
    root.appendChild(head);
    root.appendChild(meter);

    const holder = el("div");
    root.appendChild(holder);

    if (state.remaining > 0) {
      clock.textContent = "⏱ " + fmtTime(state.remaining);
      timer = setInterval(() => {
        state.remaining--;
        clock.textContent = "⏱ " + fmtTime(state.remaining);
        clock.classList.toggle("low", state.remaining <= 60);
        if (state.remaining <= 0) { stop(); finish(root, state, holder); }
      }, 1000);
    } else {
      clock.textContent = "";
    }

    state.paintMeter = () => {
      const done = state.answers.filter((a) => a !== null).length;
      bar.style.width = `${(done / state.questions.length) * 100}%`;
    };
    state.paintMeter();

    showQ(root, state, holder);
  }

  function showQ(root, state, holder) {
    const q = state.questions[state.i];
    const last = state.i === state.questions.length - 1;
    holder.replaceChildren();

    const card = el("div", "q-card");
    const top = el("div", "q-top");
    top.appendChild(el("span", "q-count", `Question ${state.i + 1} of ${state.questions.length}`));
    if (q._lesson) top.appendChild(el("span", "tm-tag", q._lesson.code));
    if (q.difficulty) top.appendChild(el("span", "diff diff-" + q.difficulty, q.difficulty));
    card.appendChild(top);
    card.appendChild(el("div", "q-prompt", q.prompt));

    const prior = state.answers[state.i];
    const actions = el("div", "q-actions");

    const goNext = () => {
      state.paintMeter();
      if (last) finish(root, state, holder);
      else { state.i++; showQ(root, state, holder); }
    };

    if (q.type === "grid-in") {
      const wrap = el("div", "gridin");
      const input = el("input");
      input.placeholder = "Your answer (e.g. 3/4 or 0.75)";
      input.autocomplete = "off";
      if (prior) input.value = prior.given;
      const check = el("button", "btn btn-primary", state.mode === "exam" ? "Save answer" : "Check");
      const submit = () => {
        const v = input.value.trim();
        if (!v) return;
        const ok = window.gridinCorrect(v, q.acceptedAnswers || []);
        state.answers[state.i] = { given: v, correct: ok };
        if (state.mode === "exam") { goNext(); return; }
        input.disabled = true;
        check.disabled = true;
        input.classList.add(ok ? "correct" : "incorrect");
        reveal(card, actions, q, ok, (q.acceptedAnswers || [])[0], last, goNext);
      };
      check.addEventListener("click", submit);
      input.addEventListener("keydown", (e) => { if (e.key === "Enter") submit(); });
      wrap.append(input, check);
      card.appendChild(wrap);
      setTimeout(() => input.focus(), 0);
    } else {
      const choices = el("div", "choices");
      const answerIdx = LETTERS.indexOf(q.answer);
      const buttons = (q.choices || []).map((text, idx) => {
        const b = el("button", "choice");
        b.appendChild(el("span", "letter", LETTERS[idx]));
        b.appendChild(el("span", null, text));
        if (prior && prior.given === LETTERS[idx]) b.classList.add("picked");
        b.addEventListener("click", () => {
          const ok = idx === answerIdx;
          state.answers[state.i] = { given: LETTERS[idx], correct: ok };
          if (state.mode === "exam") {
            buttons.forEach((x) => x.classList.remove("picked"));
            b.classList.add("picked");
            state.paintMeter();
            setTimeout(goNext, 180);
            return;
          }
          buttons.forEach((x) => (x.disabled = true));
          if (buttons[answerIdx]) buttons[answerIdx].classList.add("correct");
          if (!ok) b.classList.add("incorrect");
          reveal(card, actions, q, ok, LETTERS[answerIdx], last, goNext);
        });
        choices.appendChild(b);
        return b;
      });
      card.appendChild(choices);
    }

    // Exam mode keeps navigation open so students can skip and come back.
    if (state.mode === "exam") {
      const back = el("button", "btn btn-quiet", "← Back");
      back.disabled = state.i === 0;
      back.addEventListener("click", () => { state.i--; showQ(root, state, holder); });
      const skip = el("button", "btn btn-quiet", last ? "Finish →" : "Skip →");
      skip.addEventListener("click", goNext);
      const submitAll = el("button", "btn btn-primary", "Submit test");
      submitAll.addEventListener("click", () => finish(root, state, holder));
      actions.append(back, skip, submitAll);
      card.appendChild(actions);
    } else {
      card.appendChild(actions);
    }

    holder.appendChild(card);
    typeset(card);
  }

  function reveal(card, actions, q, ok, correctText, last, goNext) {
    const fb = el("div", "feedback " + (ok ? "good" : "bad"));
    fb.setAttribute("role", "status");
    fb.appendChild(el("div", "verdict",
      ok ? "✅ Correct!" : "❌ Incorrect" + (correctText ? ` — the answer is ${correctText}` : "")));
    if (q.explanation) fb.appendChild(el("div", null, q.explanation));
    card.insertBefore(fb, actions);
    const next = el("button", "btn btn-primary", last ? "See results" : "Next question →");
    next.addEventListener("click", goNext);
    actions.appendChild(next);
    typeset(fb);
    next.focus();
  }

  // ---------- results ----------

  function finish(root, state, holder) {
    stop();
    root.replaceChildren();
    const total = state.questions.length;
    const correct = state.answers.filter((a) => a && a.correct).length;
    const pct = Math.round((correct / total) * 100);
    const secs = Math.round((Date.now() - state.started) / 1000);

    pushHistory({
      label: state.label,
      correct, total,
      when: new Date().toLocaleDateString(undefined, { month: "short", day: "numeric" }),
    });

    if (state.scoreTopic) {
      window.saveScore(state.scoreTopic, correct, total);
      if (correct === total) {
        window.setLessonStatus(state.scoreTopic, "done");
        const btn = document.querySelector(".mark-done");
        if (btn) { btn.textContent = "✓ Done!"; btn.classList.add("is-done"); }
      }
    }

    const card = el("div", "result-card");
    card.appendChild(el("div", null, "Test complete"));
    const ring = el("div", "score-ring");
    ring.style.setProperty("--pct", pct);
    ring.style.setProperty("--ring", pct === 100 ? "#0CA678" : pct >= 70 ? "#2A3A7C" : "#E8590C");
    const inner = el("div");
    inner.appendChild(el("div", "score-num", `${correct}/${total}`));
    inner.appendChild(el("div", "score-pct", `${pct}%`));
    ring.appendChild(inner);
    card.appendChild(ring);
    card.appendChild(el("div", "result-note",
      pct === 100 ? "🏆 Perfect — every single one!"
      : pct >= 80 ? "🔥 Strong work — check the few you missed."
      : pct >= 50 ? "💪 Good effort — review the explanations below."
      : "📖 Time to revisit these lessons — the review below shows every step."));
    card.appendChild(el("div", "tm-time-taken", `⏱ Time taken: ${fmtTime(secs)}`));
    if (pct === 100 && window.celebrate) window.celebrate(card);
    root.appendChild(card);

    // Per-lesson breakdown
    const byLesson = new Map();
    state.questions.forEach((q, i) => {
      const key = q._lesson ? q._lesson.id : "—";
      if (!byLesson.has(key)) byLesson.set(key, { lesson: q._lesson, right: 0, total: 0 });
      const rec = byLesson.get(key);
      rec.total++;
      if (state.answers[i] && state.answers[i].correct) rec.right++;
    });

    if (byLesson.size > 1) {
      root.appendChild(el("h3", "section-title", "📊 How each lesson went"));
      const grid = el("div", "tm-break");
      for (const rec of byLesson.values()) {
        const p = Math.round((rec.right / rec.total) * 100);
        const row = el("div", "tm-break-row");
        const nm = el("div", "tm-break-name");
        if (rec.lesson) {
          const a = el("a", "tm-break-link", `${rec.lesson.code} ${rec.lesson.title}`);
          a.href = "#/topic/" + rec.lesson.id;
          nm.appendChild(a);
        } else nm.textContent = "Mixed";
        row.appendChild(nm);
        const track = el("div", "tm-break-bar");
        const fill = el("div", "tm-break-fill " + (p >= 80 ? "good" : p >= 50 ? "ok" : "low"));
        fill.style.width = p + "%";
        track.appendChild(fill);
        row.appendChild(track);
        row.appendChild(el("span", "tm-break-score", `${rec.right}/${rec.total}`));
        grid.appendChild(row);
      }
      root.appendChild(grid);
    }

    // Full review
    root.appendChild(el("h3", "section-title", "🔍 Review every question"));
    const review = el("div", "tm-review");
    state.questions.forEach((q, i) => {
      const a = state.answers[i];
      const ok = !!(a && a.correct);
      const item = el("details", "tm-rev " + (ok ? "ok" : a ? "bad" : "skip"));
      const sum = el("summary", "tm-rev-sum");
      sum.appendChild(el("span", "tm-rev-mark", ok ? "✅" : a ? "❌" : "•"));
      sum.appendChild(el("span", "tm-rev-q", `Q${i + 1}`));
      if (q._lesson) sum.appendChild(el("span", "tm-tag", q._lesson.code));
      sum.appendChild(el("span", "tm-rev-prompt", stripMath(q.prompt)));
      item.appendChild(sum);
      const body = el("div", "tm-rev-body");
      body.appendChild(el("div", "tm-rev-full", q.prompt));
      if (q.type === "grid-in") {
        body.appendChild(el("div", "tm-rev-line",
          `Your answer: ${a ? a.given : "— not answered —"}`));
        body.appendChild(el("div", "tm-rev-line good",
          `Correct answer: ${(q.acceptedAnswers || [])[0]}`));
      } else {
        const idx = LETTERS.indexOf(q.answer);
        body.appendChild(el("div", "tm-rev-line",
          `Your answer: ${a ? a.given + ". " + q.choices[LETTERS.indexOf(a.given)] : "— not answered —"}`));
        body.appendChild(el("div", "tm-rev-line good",
          `Correct answer: ${q.answer}. ${q.choices[idx]}`));
      }
      if (q.explanation) body.appendChild(el("div", "tm-rev-why", q.explanation));
      if (q._lesson) {
        const link = el("a", "tm-rev-link", `Revise ${q._lesson.code} ${q._lesson.title} →`);
        link.href = "#/topic/" + q._lesson.id;
        body.appendChild(link);
      }
      item.appendChild(body);
      item.addEventListener("toggle", () => { if (item.open) typeset(body); });
      review.appendChild(item);
    });
    root.appendChild(review);

    const actions = el("div", "result-actions");
    const wrong = state.questions.filter((q, i) => !state.answers[i] || !state.answers[i].correct);
    if (wrong.length) {
      const retry = el("button", "btn btn-primary", `Retry the ${wrong.length} I missed`);
      retry.addEventListener("click", () =>
        runTest(root, { questions: shuffle(wrong).map(shuffleChoices), mode: state.mode, minutes: 0, label: state.label, onExit: state.onExit }));
      actions.appendChild(retry);
    }
    const again = el("button", "btn " + (wrong.length ? "btn-quiet" : "btn-primary"), "Take it again");
    again.addEventListener("click", () =>
      runTest(root, { questions: shuffle(state.questions).map(shuffleChoices), mode: state.mode, minutes: 0, label: state.label, scoreTopic: state.scoreTopic, onExit: state.onExit }));
    actions.appendChild(again);
    const back = el("button", "btn btn-quiet", state.onExit ? "Back to the lesson" : "Build a new test");
    back.addEventListener("click", () => {
      if (state.onExit) state.onExit();
      else { root.replaceChildren(); renderPage(root); typeset(root); }
    });
    actions.appendChild(back);
    root.appendChild(actions);
    typeset(root);
  }

  // Plain-text preview for the collapsed review row
  function stripMath(s) {
    const t = String(s).replace(/\$([^$]*)\$/g, "$1").replace(/\\[a-zA-Z]+/g, "").replace(/[{}\\]/g, "");
    return t.length > 70 ? t.slice(0, 68) + "…" : t;
  }

  // ---------- lesson-page question bank ----------

  // Renders the "Question bank" launcher inside a lesson page.
  async function practice(host, topic) {
    const bank = await loadBank(topic.id);
    const qs = bank.questions || [];
    if (!qs.length) return false;

    const panel = el("div", "tm-bank");
    const info = el("div", "tm-bank-info");
    info.appendChild(el("div", "tm-bank-title", `🧠 Question bank — ${plural(qs.length, "question")}`));
    info.appendChild(el("div", "tm-bank-sub",
      "Fresh practice every time: the questions and their options are shuffled on each run."));
    panel.appendChild(info);

    const row = el("div", "tm-bank-actions");
    const runner = el("div");

    const launch = (n, mode) => {
      const picked = sample(qs, n).map((q) =>
        Object.assign(shuffleChoices(q), { _lesson: { id: topic.id, code: topic.lessonCode, title: topic.title } }));
      panel.style.display = "none";
      runner.scrollIntoView({ behavior: "smooth", block: "start" });
      runTest(runner, {
        questions: picked, mode, minutes: 0, lessons: 1,
        label: `${topic.lessonCode} ${topic.title}`,
        scoreTopic: topic.id,
        onExit: () => { runner.replaceChildren(); panel.style.display = ""; },
      });
    };

    const b10 = el("button", "btn btn-primary", "Practice 10 questions");
    b10.addEventListener("click", () => launch(Math.min(10, qs.length), "instant"));
    const bAll = el("button", "btn btn-quiet", `Practice all ${qs.length}`);
    bAll.addEventListener("click", () => launch(qs.length, "instant"));
    const bExam = el("button", "btn btn-quiet", "Exam mode");
    bExam.addEventListener("click", () => launch(Math.min(15, qs.length), "exam"));
    row.append(b10, bAll, bExam);
    panel.appendChild(row);

    host.appendChild(panel);
    host.appendChild(runner);
    return true;
  }

  // _shuffleChoices is exposed for quick console checks of the shuffling rules
  window.MathClicksTest = { renderPage, practice, stop, loadBank, _shuffleChoices: shuffleChoices };
})();
