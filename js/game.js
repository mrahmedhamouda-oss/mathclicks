/* MathClicks — Mental Math Arena.
   A self-contained mental-math game with a weekly top-3 leaderboard.
   Mounted by app.js at route #/game; edit js/game-config.js for the board. */

(function () {
  "use strict";

  const CFG = window.MATHCLICKS_GAME || {};
  const LB = CFG.leaderboard || { mode: "local" };
  const BOARD_SIZE = CFG.boardSize || 10;

  const K_SEEN = "mathclicks.game.seen";     // recently asked questions
  const K_BOARD = "mathclicks.game.board";   // local leaderboard, by week
  const K_ME = "mathclicks.game.initials";   // remembered initials
  const K_MUTE = "mathclicks.game.mute";

  const MODES = {
    sprint: {
      id: "sprint", icon: "⚡", name: "60-Second Sprint",
      blurb: "Answer as many as you can before the clock runs out. A wrong answer costs 2 seconds.",
      seconds: 60,
    },
    survival: {
      id: "survival", icon: "❤️", name: "Survival",
      blurb: "No clock — but three wrong answers and you're out. How far can you climb?",
      lives: 3,
    },
  };

  // ---------------------------------------------------------------- helpers

  const rnd = (a, b) => a + Math.floor(Math.random() * (b - a + 1));
  const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
  const r2 = (x) => Math.round(x * 100) / 100;

  function shuffle(a) {
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  const fmt = (n) => {
    const v = r2(n);
    return Number.isInteger(v) ? String(v) : String(v);
  };

  function el(tag, cls, text) {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }

  const read = (k, fallback) => {
    try {
      const v = localStorage.getItem(k);
      return v == null ? fallback : JSON.parse(v);
    } catch { return fallback; }
  };
  const write = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} };

  // ------------------------------------------------------------ week keys
  // The board resets every week: entries are stored under an ISO week key,
  // so a new week simply starts with an empty board.

  function weekKey(d = new Date()) {
    const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
    const day = t.getUTCDay() || 7;          // Mon = 1 … Sun = 7
    t.setUTCDate(t.getUTCDate() + 4 - day);  // nearest Thursday
    const yearStart = new Date(Date.UTC(t.getUTCFullYear(), 0, 1));
    const week = Math.ceil(((t - yearStart) / 86400000 + 1) / 7);
    return t.getUTCFullYear() + "-W" + String(week).padStart(2, "0");
  }

  const lastWeekKey = () => {
    const d = new Date();
    d.setDate(d.getDate() - 7);
    return weekKey(d);
  };

  function mondayOf(d = new Date()) {
    const m = new Date(d);
    m.setHours(0, 0, 0, 0);
    m.setDate(m.getDate() - ((m.getDay() + 6) % 7));
    return m;
  }

  function weekLabel() {
    const start = mondayOf();
    const end = new Date(start);
    end.setDate(end.getDate() + 6);
    const o = { day: "numeric", month: "short" };
    return start.toLocaleDateString(undefined, o) + " – " + end.toLocaleDateString(undefined, o);
  }

  function resetsIn() {
    const next = mondayOf();
    next.setDate(next.getDate() + 7);
    const ms = next - new Date();
    const days = Math.floor(ms / 86400000);
    const hours = Math.floor((ms % 86400000) / 3600000);
    if (days > 0) return days + (days === 1 ? " day" : " days");
    if (hours > 0) return hours + (hours === 1 ? " hour" : " hours");
    return "less than an hour";
  }

  // ------------------------------------------------------- question bank
  // Every generator makes questions from random numbers, so the pool is
  // thousands of questions deep. `SEEN` then blocks anything asked recently.

  function distract(ans, extra) {
    const out = [];
    const add = (v) => {
      if (!Number.isFinite(v)) return;
      const w = r2(v);
      if (w === r2(ans)) return;
      if (ans >= 0 && w < 0) return;              // don't hint at negatives
      if (out.some((x) => r2(x) === w)) return;
      out.push(w);
    };
    (extra || []).forEach(add);
    const step = Math.abs(ans) < 20 ? 1 : Math.abs(ans) < 200 ? 2 : 10;
    const pool = shuffle([
      ans + step, ans - step, ans + 2 * step, ans - 2 * step,
      ans + 10, ans - 10, ans + 1, ans - 1,
      Math.round(ans / 2), ans * 2, ans + 100, ans - 100,
    ]);
    for (const v of pool) { if (out.length >= 3) break; add(v); }
    let bump = 3;
    while (out.length < 3) { add(ans + bump); bump += 4; }
    return out.slice(0, 3);
  }

  const FRACTIONS = [
    { t: "½", n: 1, d: 2 }, { t: "⅓", n: 1, d: 3 }, { t: "¼", n: 1, d: 4 },
    { t: "¾", n: 3, d: 4 }, { t: "⅔", n: 2, d: 3 }, { t: "⅕", n: 1, d: 5 },
    { t: "⅖", n: 2, d: 5 }, { t: "⅚", n: 5, d: 6 },
  ];

  // Fractions with a short, exact decimal — the ones worth knowing by heart
  const DECIMAL_FRACTIONS = [
    { t: "½", n: 1, d: 2 }, { t: "¼", n: 1, d: 4 }, { t: "¾", n: 3, d: 4 },
    { t: "⅕", n: 1, d: 5 }, { t: "⅖", n: 2, d: 5 }, { t: "⅗", n: 3, d: 5 },
    { t: "⅘", n: 4, d: 5 }, { t: "⅛", n: 1, d: 8 }, { t: "⅜", n: 3, d: 8 },
    { t: "⅝", n: 5, d: 8 }, { t: "⅞", n: 7, d: 8 }, { t: "1/10", n: 1, d: 10 },
    { t: "3/10", n: 3, d: 10 }, { t: "1/20", n: 1, d: 20 },
  ];

  // min = the level at which the generator unlocks (1 = from the very start)
  const GENS = [
    // ---- level 1: gentle warm-up
    { id: "add1", min: 1, pool: 312, cat: "Addition", make() {
      const a = rnd(11, 49), b = rnd(2, 9);
      return { text: `${a} + ${b}`, ans: a + b, wrong: [a - b, a + b + 10] };
    } },
    { id: "sub1", min: 1, pool: 296, cat: "Subtraction", make() {
      const a = rnd(13, 49), b = rnd(2, 9);
      return { text: `${a} − ${b}`, ans: a - b, wrong: [a + b, a - b - 10] };
    } },
    { id: "tab10", min: 1, pool: 81, cat: "Times tables", make() {
      const a = rnd(2, 10), b = rnd(2, 10);
      return { text: `${a} × ${b}`, ans: a * b, wrong: [a * b + a, a * b - b, a + b] };
    } },

    // ---- level 2
    { id: "add2", min: 2, pool: 4422, cat: "Addition", make() {
      const a = rnd(23, 89), b = rnd(14, 79);
      return { text: `${a} + ${b}`, ans: a + b, wrong: [a + b - 10, a - b] };
    } },
    { id: "sub2", min: 2, pool: 1320, cat: "Subtraction", make() {
      const a = rnd(45, 99), b = rnd(16, 39);
      return { text: `${a} − ${b}`, ans: a - b, wrong: [a - b + 10, a - b - 1] };
    } },
    { id: "tab12", min: 2, pool: 70, cat: "Times tables", make() {
      const a = rnd(3, 12), b = rnd(6, 12);
      return { text: `${a} × ${b}`, ans: a * b, wrong: [a * b + a, a * b - a, a * (b - 1)] };
    } },
    { id: "div1", min: 2, pool: 90, cat: "Division", make() {
      const b = rnd(2, 10), q = rnd(3, 12);
      return { text: `${b * q} ÷ ${b}`, ans: q, wrong: [q + 1, q - 1, b] };
    } },
    { id: "dbl", min: 2, pool: 113, cat: "Doubling", make() {
      const n = rnd(24, 98);
      if (Math.random() < 0.5) return { text: `Double ${n}`, ans: n * 2, wrong: [n * 2 - 10, n + 2] };
      const m = n % 2 ? n + 1 : n;
      return { text: `Half of ${m}`, ans: m / 2, wrong: [m / 2 + 1, m / 2 - 5] };
    } },

    // ---- level 3
    { id: "pct1", min: 3, pool: 76, cat: "Percentages", make() {
      const p = pick([10, 20, 25, 50]), n = rnd(2, 20) * 20;
      return { text: `${p}% of ${n}`, ans: (n * p) / 100, wrong: [(n * p) / 10, n / p] };
    } },
    { id: "frac1", min: 3, pool: 112, cat: "Fractions", make() {
      const f = pick(FRACTIONS), n = f.d * rnd(2, 15);
      return { text: `${f.t} of ${n}`, ans: (n * f.n) / f.d, wrong: [n / f.d, (n * f.n) / f.d + f.d] };
    } },
    { id: "sq1", min: 3, pool: 11, cat: "Squares", make() {
      const n = rnd(2, 12);
      return { text: `${n}²`, ans: n * n, wrong: [n * 2, n * n + n, n * n - n] };
    } },
    { id: "add3", min: 3, pool: 3000, cat: "Addition", make() {
      const a = rnd(12, 48) * 10 + rnd(0, 9), b = rnd(11, 89);
      return { text: `${a} + ${b}`, ans: a + b, wrong: [a + b - 10, a + b + 100] };
    } },

    // ---- level 4
    { id: "mul21", min: 4, pool: 119, cat: "Multiplication", make() {
      const a = rnd(13, 29), b = rnd(3, 9);
      return { text: `${a} × ${b}`, ans: a * b, wrong: [a * b + b, a * b - a, a * (b + 1)] };
    } },
    { id: "alg1", min: 4, pool: 350, cat: "Algebra", make() {
      const x = rnd(2, 15);
      if (Math.random() < 0.5) {
        const k = rnd(2, 9);
        return { text: `If ${k}x = ${k * x}, then x =`, ans: x, wrong: [k, k * x, x + k] };
      }
      const c = rnd(3, 19);
      return { text: `If x + ${c} = ${x + c}, then x =`, ans: x, wrong: [x + c, c - x, x + 1] };
    } },
    { id: "root1", min: 4, pool: 18, cat: "Square roots", make() {
      const n = rnd(3, 20);
      return { text: `√${n * n}`, ans: n, wrong: [n * n / 2, n + 1, n * 2] };
    } },
    { id: "sq2", min: 4, pool: 8, cat: "Squares", make() {
      const n = rnd(11, 18);
      return { text: `${n}²`, ans: n * n, wrong: [n * n + n, n * n - 2 * n, n * 20] };
    } },

    // ---- level 5
    { id: "pct2", min: 5, pool: 98, cat: "Percentages", make() {
      const p = pick([5, 15, 30, 40, 60, 75, 90]), n = rnd(2, 15) * 20;
      return { text: `${p}% of ${n}`, ans: (n * p) / 100, wrong: [(n * p) / 1000, n - p] };
    } },
    { id: "fdec", min: 5, pool: 14, cat: "Fractions", make() {
      const f = pick(DECIMAL_FRACTIONS);
      return { text: `${f.t} as a decimal`, ans: r2(f.n / f.d), wrong: [r2(f.n / f.d + 0.1), r2(f.d / f.n), r2(f.n / f.d - 0.05)] };
    } },
    { id: "cube", min: 5, pool: 9, cat: "Powers", make() {
      const n = rnd(2, 10);
      return { text: `${n}³`, ans: n ** 3, wrong: [n * 3, n * n, n ** 3 + n] };
    } },
    { id: "alg2", min: 5, pool: 1122, cat: "Algebra", make() {
      const x = rnd(2, 12), k = rnd(2, 7), c = rnd(3, 19);
      return { text: `If ${k}x + ${c} = ${k * x + c}, then x =`, ans: x, wrong: [x + c, k * x, x + k] };
    } },
    { id: "x11", min: 5, pool: 77, cat: "×11 trick", make() {
      const a = rnd(13, 89);
      return { text: `${a} × 11`, ans: a * 11, wrong: [a * 11 - 10, a * 10, a * 11 + 100] };
    } },

    // ---- level 6: the hard end
    { id: "mul22", min: 6, pool: 265, cat: "Multiplication", make() {
      const style = rnd(1, 3);
      if (style === 1) { const a = rnd(12, 48); return { text: `${a} × 25`, ans: a * 25, wrong: [a * 20, a * 25 + 25] }; }
      if (style === 2) { const a = rnd(12, 68); return { text: `${a} × 15`, ans: a * 15, wrong: [a * 10 + a, a * 15 - 15] }; }
      const a = rnd(11, 29), b = rnd(11, 19);
      return { text: `${a} × ${b}`, ans: a * b, wrong: [a * b + a, a * b - b] };
    } },
    { id: "pctch", min: 6, pool: 72, cat: "Percentages", make() {
      const n = rnd(2, 10) * 20, p = pick([10, 20, 25, 50]);
      const up = Math.random() < 0.5;
      const ans = up ? n + (n * p) / 100 : n - (n * p) / 100;
      return {
        text: `${n} ${up ? "increased" : "decreased"} by ${p}%`,
        ans, wrong: [up ? n - (n * p) / 100 : n + (n * p) / 100, (n * p) / 100],
      };
    } },
    { id: "sq3", min: 6, pool: 10, cat: "Squares", make() {
      const n = rnd(16, 25);
      return { text: `${n}²`, ans: n * n, wrong: [n * n - n, n * n + 2 * n, n * 25] };
    } },
    { id: "neg", min: 6, pool: 230, cat: "Negatives", make() {
      const a = rnd(3, 12), b = rnd(4, 9);
      if (Math.random() < 0.5) return { text: `−${a} × ${b}`, ans: -a * b, wrong: [a * b, -a - b, -a * b - a] };
      const c = rnd(13, 29);
      return { text: `−${a} + ${c}`, ans: c - a, wrong: [-(c - a), c + a, c - a - 1] };
    } },
    { id: "pow2", min: 6, pool: 10, cat: "Powers", make() {
      const n = rnd(3, 12);
      return { text: `2^${n}`, ans: 2 ** n, wrong: [2 * n, 2 ** n / 2, 2 ** n + 2] };
    } },
    { id: "order", min: 6, pool: 640, cat: "Order of operations", make() {
      const a = rnd(3, 12), b = rnd(2, 9), c = rnd(2, 9);
      return { text: `${a} + ${b} × ${c}`, ans: a + b * c, wrong: [(a + b) * c, a + b + c, a * b + c] };
    } },
  ];

  // --- "barely repeated": remember the last few hundred questions asked ---

  let SEEN = read(K_SEEN, []);
  if (!Array.isArray(SEEN)) SEEN = [];
  let SEEN_SET = new Set(SEEN);
  const SEEN_MAX = 600;

  function markSeen(key) {
    SEEN.push(key);
    SEEN_SET.add(key);
    if (SEEN.length > SEEN_MAX) forget(SEEN.length - SEEN_MAX + 100);
  }

  function forget(n) {
    const dropped = SEEN.splice(0, n);
    for (const k of dropped) SEEN_SET.delete(k);
  }

  // Some categories are naturally tiny — there are only seven powers of 2 worth
  // asking. Once most of one has been used, release its oldest questions so the
  // category keeps appearing instead of going extinct.
  function recycle(g) {
    const cap = Math.max(4, Math.floor(g.pool * 0.6));
    const prefix = g.id + "|";
    let n = 0;
    for (const k of SEEN) if (k.startsWith(prefix)) n++;
    if (n < cap) return;
    let toDrop = n - Math.floor(cap / 2);
    SEEN = SEEN.filter((k) => {
      if (toDrop > 0 && k.startsWith(prefix)) { toDrop--; SEEN_SET.delete(k); return false; }
      return true;
    });
  }

  const saveSeen = () => write(K_SEEN, SEEN);

  function pickGen(level) {
    const usable = GENS.filter((g) => g.min <= level);
    const bag = [];
    for (const g of usable) {
      // Deep categories get asked more often — that's what keeps a narrow one
      // like "powers of 2" (ten questions in the world) feeling fresh.
      let n = g.pool < 20 ? 1 : g.pool < 120 ? 3 : 5;
      if (g.min === level) n += 2;          // favour what just unlocked
      else if (g.min === level - 1) n += 1;
      for (let i = 0; i < n; i++) bag.push(g);
    }
    return pick(bag);
  }

  function nextQuestion(level) {
    for (let i = 0; i < 40; i++) {
      const g = pickGen(level);
      recycle(g);
      const q = g.make();
      const key = g.id + "|" + q.text;
      if (SEEN_SET.has(key)) continue;
      markSeen(key);
      return finish(g, q);
    }
    forget(200);                       // pool exhausted — let old ones back in
    const g = pickGen(level);
    const q = g.make();
    markSeen(g.id + "|" + q.text);
    return finish(g, q);
  }

  function finish(g, q) {
    const wrongs = distract(q.ans, q.wrong);
    const options = shuffle([q.ans, ...wrongs]).map(fmt);
    return { text: q.text, answer: fmt(q.ans), options, cat: g.cat };
  }

  // ------------------------------------------------------------ leaderboard

  const remoteOn = () =>
    LB.mode === "supabase" && !!LB.supabaseUrl && !!LB.supabaseKey;

  let remoteBroken = false;   // set if Supabase is unreachable → fall back

  const LocalStore = {
    all() { const b = read(K_BOARD, {}); return (b && typeof b === "object") ? b : {}; },
    top(mode, week) {
      const b = this.all();
      const rows = ((b[week] || {})[mode] || []).slice();
      rows.sort((x, y) => y.score - x.score || x.at - y.at);
      return Promise.resolve(rows.slice(0, BOARD_SIZE));
    },
    submit(entry) {
      const b = this.all();
      b[entry.week] = b[entry.week] || {};
      const rows = b[entry.week][entry.mode] || [];
      rows.push({ initials: entry.initials, score: entry.score, at: Date.now() });
      rows.sort((x, y) => y.score - x.score || x.at - y.at);
      b[entry.week][entry.mode] = rows.slice(0, 50);
      // keep the store small: only the last 8 weeks
      const weeks = Object.keys(b).sort();
      while (weeks.length > 8) delete b[weeks.shift()];
      write(K_BOARD, b);
      return Promise.resolve(true);
    },
  };

  const RemoteStore = {
    url(path) { return LB.supabaseUrl.replace(/\/$/, "") + "/rest/v1/" + path; },
    headers() {
      return {
        apikey: LB.supabaseKey,
        Authorization: "Bearer " + LB.supabaseKey,
        "Content-Type": "application/json",
      };
    },
    async top(mode, week) {
      const t = LB.table || "mm_scores";
      const q = `${t}?select=initials,score,created_at&week=eq.${encodeURIComponent(week)}` +
                `&mode=eq.${encodeURIComponent(mode)}&order=score.desc,created_at.asc&limit=${BOARD_SIZE}`;
      const res = await fetch(this.url(q), { headers: this.headers() });
      if (!res.ok) throw new Error("board fetch failed: " + res.status);
      const rows = await res.json();
      return rows.map((r) => ({ initials: r.initials, score: r.score, at: Date.parse(r.created_at) }));
    },
    async submit(entry) {
      const res = await fetch(this.url(LB.table || "mm_scores"), {
        method: "POST",
        headers: this.headers(),
        body: JSON.stringify({
          week: entry.week, mode: entry.mode,
          initials: entry.initials, score: entry.score,
        }),
      });
      if (!res.ok) throw new Error("submit failed: " + res.status);
      return true;
    },
  };

  // Remote when configured, local otherwise — and local as a safety net so a
  // dropped connection never eats a student's score.
  const Board = {
    async top(mode, week) {
      if (remoteOn() && !remoteBroken) {
        try { return await RemoteStore.top(mode, week); }
        catch (e) { console.warn("[game] leaderboard offline:", e.message); remoteBroken = true; }
      }
      return LocalStore.top(mode, week);
    },
    async submit(entry) {
      LocalStore.submit(entry);
      if (remoteOn() && !remoteBroken) {
        try { await RemoteStore.submit(entry); }
        catch (e) { console.warn("[game] submit offline:", e.message); remoteBroken = true; return false; }
        return true;
      }
      return !remoteOn();
    },
  };

  // ------------------------------------------------------------------ sound

  let audio = null;
  const muted = () => read(K_MUTE, false) === true;

  function beep(freq, dur, type) {
    if (muted()) return;
    try {
      audio = audio || new (window.AudioContext || window.webkitAudioContext)();
      const o = audio.createOscillator(), g = audio.createGain();
      o.type = type || "sine";
      o.frequency.value = freq;
      g.gain.setValueAtTime(0.06, audio.currentTime);
      g.gain.exponentialRampToValueAtTime(0.0001, audio.currentTime + dur);
      o.connect(g); g.connect(audio.destination);
      o.start(); o.stop(audio.currentTime + dur);
    } catch {}
  }
  const sndGood = () => beep(880, 0.12, "triangle");
  const sndBad = () => beep(180, 0.22, "sawtooth");
  const sndUp = () => { beep(660, 0.1); setTimeout(() => beep(990, 0.14), 90); };
  const sndEnd = () => { beep(520, 0.14); setTimeout(() => beep(392, 0.25), 140); };

  // ------------------------------------------------------------------ state

  let root = null;        // the mount point inside <main>
  let tick = null;        // sprint interval
  let game = null;        // live round state
  let boardMode = "sprint";

  function stop() {
    if (tick) { clearInterval(tick); tick = null; }
    if (game) { game = null; saveSeen(); }
    document.removeEventListener("keydown", onKey);
  }

  // ------------------------------------------------------------- start view

  function renderStart(msg) {
    stop();
    root.replaceChildren();

    const head = el("section", "mm-head");
    head.appendChild(el("div", "mm-eyebrow", "MathClicks Arena"));
    const h1 = el("h1", "mm-title", "Mental Math ");
    h1.appendChild(el("span", "mm-title-accent", "Arena"));
    head.appendChild(h1);
    head.appendChild(el("p", "mm-sub",
      "Every round starts easy and gets harder as you get them right. Top 3 each week get their initials on the board — then it wipes clean on Monday."));
    root.appendChild(head);

    if (msg) {
      const note = el("div", "mm-flash", msg);
      root.appendChild(note);
    }

    const grid = el("div", "mm-modes");
    for (const m of [MODES.sprint, MODES.survival]) {
      const card = el("button", "mm-mode mm-mode--" + m.id);
      card.type = "button";
      card.appendChild(el("span", "mm-mode-icon", m.icon));
      card.appendChild(el("span", "mm-mode-name", m.name));
      card.appendChild(el("span", "mm-mode-blurb", m.blurb));
      const best = myBest(m.id);
      card.appendChild(el("span", "mm-mode-best",
        best ? "Your best this week: " + best : "No score yet this week"));
      card.appendChild(el("span", "mm-mode-go", "Play →"));
      card.addEventListener("click", () => startGame(m.id));
      grid.appendChild(card);
    }
    root.appendChild(grid);

    const how = el("div", "mm-how");
    how.appendChild(el("strong", null, "How it works"));
    const ul = el("ul", null);
    [
      "Four choices — tap one, or press 1 · 2 · 3 · 4 on a keyboard.",
      "Correct answers raise the difficulty; a slip drops it back down.",
      "Streaks multiply your points, so accuracy beats guessing.",
      "Questions come from a pool of thousands and won't repeat for a long time.",
    ].forEach((t) => ul.appendChild(el("li", null, t)));
    how.appendChild(ul);
    root.appendChild(how);

    root.appendChild(boardPanel());
    return root;
  }

  function myBest(mode) {
    const mine = read("mathclicks.game.best." + mode, null);
    if (!mine || mine.week !== weekKey()) return null;
    return mine.score + " pts";
  }

  function noteMyBest(mode, score) {
    const cur = read("mathclicks.game.best." + mode, null);
    if (!cur || cur.week !== weekKey() || score > cur.score)
      write("mathclicks.game.best." + mode, { week: weekKey(), score });
  }

  // --------------------------------------------------------- board panel

  function boardPanel() {
    const sec = el("section", "mm-board");

    const head = el("div", "mm-board-head");
    const titles = el("div", "mm-board-titles");
    titles.appendChild(el("h2", "mm-board-title", "🏆 This week's champions"));
    titles.appendChild(el("p", "mm-board-week",
      weekLabel() + " · resets in " + resetsIn()));
    head.appendChild(titles);

    const tabs = el("div", "mm-tabs");
    for (const m of [MODES.sprint, MODES.survival]) {
      const b = el("button", "mm-tab" + (boardMode === m.id ? " is-on" : ""), m.icon + " " + m.name);
      b.type = "button";
      b.addEventListener("click", () => {
        boardMode = m.id;
        const fresh = boardPanel();
        sec.replaceWith(fresh);
      });
      tabs.appendChild(b);
    }
    head.appendChild(tabs);
    sec.appendChild(head);

    const list = el("div", "mm-board-list");
    list.appendChild(el("p", "mm-board-empty", "Loading…"));
    sec.appendChild(list);

    if (!remoteOn()) {
      sec.appendChild(el("p", "mm-board-note",
        "📱 This board is saved on this device. Ask Mr Hamouda to switch on the shared online board so the whole class competes together."));
    }

    Board.top(boardMode, weekKey()).then((rows) => {
      list.replaceChildren();
      if (!rows.length) {
        list.appendChild(el("p", "mm-board-empty",
          "Nobody has played yet this week. Be the first name up there."));
      } else {
        rows.forEach((r, i) => list.appendChild(boardRow(r, i)));
      }
      if (remoteBroken) {
        const w = el("p", "mm-board-note", "⚠️ Couldn't reach the online board — showing this device's scores instead.");
        list.appendChild(w);
      }
      Board.top(boardMode, lastWeekKey()).then((old) => {
        if (!old.length) return;
        const hof = el("div", "mm-hof");
        hof.appendChild(el("span", "mm-hof-label", "Last week"));
        old.slice(0, 3).forEach((r, i) => {
          hof.appendChild(el("span", "mm-hof-item", ["🥇", "🥈", "🥉"][i] + " " + r.initials + " · " + r.score));
        });
        sec.appendChild(hof);
      });
    });

    return sec;
  }

  function boardRow(r, i) {
    const row = el("div", "mm-row" + (i < 3 ? " mm-row--top mm-row--" + (i + 1) : ""));
    row.appendChild(el("span", "mm-rank", i < 3 ? ["🥇", "🥈", "🥉"][i] : "#" + (i + 1)));
    row.appendChild(el("span", "mm-who", r.initials));
    row.appendChild(el("span", "mm-pts", r.score + " pts"));
    return row;
  }

  // ---------------------------------------------------------------- play

  function startGame(modeId) {
    stop();
    const mode = MODES[modeId];
    game = {
      mode: modeId,
      level: 1,              // always starts easy
      run: 0,                // correct answers since the last level change
      score: 0,
      correct: 0,
      asked: 0,
      streak: 0,
      bestStreak: 0,
      bestLevel: 1,
      lives: mode.lives || 0,
      msLeft: (mode.seconds || 0) * 1000,
      qAt: 0,
      locked: false,
      q: null,
    };
    renderPlay();
    document.addEventListener("keydown", onKey);
    if (mode.seconds) {
      tick = setInterval(() => {
        if (!game) return;
        game.msLeft -= 100;
        if (game.msLeft <= 0) { game.msLeft = 0; paintTimer(); endGame(); }
        else paintTimer();
      }, 100);
    }
    nextRound();
  }

  function renderPlay() {
    root.replaceChildren();
    const mode = MODES[game.mode];

    const bar = el("div", "mm-hud");

    const left = el("div", "mm-hud-left");
    if (mode.seconds) {
      const t = el("div", "mm-timer");
      t.appendChild(el("span", "mm-timer-num", "60.0"));
      t.appendChild(el("span", "mm-timer-unit", "s"));
      left.appendChild(t);
      const track = el("div", "mm-timer-track");
      track.appendChild(el("div", "mm-timer-fill"));
      left.appendChild(track);
    } else {
      left.appendChild(el("div", "mm-lives", "❤️❤️❤️"));
      left.appendChild(el("div", "mm-hud-label", "Lives"));
    }
    bar.appendChild(left);

    const mid = el("div", "mm-hud-mid");
    mid.appendChild(el("div", "mm-score", "0"));
    mid.appendChild(el("div", "mm-hud-label", "Points"));
    bar.appendChild(mid);

    const right = el("div", "mm-hud-right");
    right.appendChild(el("div", "mm-level", "Level 1"));
    right.appendChild(el("div", "mm-streak", "🔥 0"));
    bar.appendChild(right);

    root.appendChild(bar);

    const card = el("section", "mm-card");
    card.appendChild(el("div", "mm-cat", ""));
    card.appendChild(el("div", "mm-q", ""));
    const opts = el("div", "mm-opts");
    for (let i = 0; i < 4; i++) {
      const b = el("button", "mm-opt");
      b.type = "button";
      b.appendChild(el("span", "mm-opt-key", String(i + 1)));
      b.appendChild(el("span", "mm-opt-val", ""));
      b.addEventListener("click", () => answer(i));
      opts.appendChild(b);
    }
    card.appendChild(opts);
    card.appendChild(el("div", "mm-feedback", ""));
    root.appendChild(card);

    const foot = el("div", "mm-play-foot");
    const quit = el("button", "mm-quit", "Give up");
    quit.type = "button";
    quit.addEventListener("click", () => endGame());
    const mute = el("button", "mm-mute", muted() ? "🔇 Sound off" : "🔊 Sound on");
    mute.type = "button";
    mute.addEventListener("click", () => {
      write(K_MUTE, !muted());
      mute.textContent = muted() ? "🔇 Sound off" : "🔊 Sound on";
    });
    foot.append(quit, mute);
    root.appendChild(foot);

    paintTimer();
  }

  const $ = (sel) => root.querySelector(sel);

  function paintTimer() {
    if (!game || !MODES[game.mode].seconds) return;
    const num = $(".mm-timer-num"), fill = $(".mm-timer-fill");
    if (!num) return;
    const s = game.msLeft / 1000;
    num.textContent = s.toFixed(1);
    const pct = (game.msLeft / (MODES[game.mode].seconds * 1000)) * 100;
    fill.style.width = Math.max(0, pct) + "%";
    num.parentElement.classList.toggle("is-low", s <= 10);
  }

  function paintHud() {
    const sc = $(".mm-score");
    if (sc) sc.textContent = game.score;
    const lv = $(".mm-level");
    if (lv) lv.textContent = "Level " + game.level;
    const st = $(".mm-streak");
    if (st) {
      st.textContent = "🔥 " + game.streak;
      st.classList.toggle("is-hot", game.streak >= 3);
    }
    const lives = $(".mm-lives");
    if (lives) lives.textContent = "❤️".repeat(game.lives) + "🖤".repeat(Math.max(0, 3 - game.lives));
  }

  function nextRound() {
    if (!game) return;
    game.q = nextQuestion(game.level);
    game.asked++;
    game.qAt = performance.now();
    game.locked = false;

    $(".mm-cat").textContent = game.q.cat;
    const qEl = $(".mm-q");
    qEl.textContent = game.q.text;
    qEl.classList.remove("mm-pop");
    void qEl.offsetWidth;
    qEl.classList.add("mm-pop");

    // Clear the previous answer's colours instantly, so the new question never
    // shows a lingering green/red button while the CSS transition unwinds.
    const opts = $(".mm-opts");
    opts.classList.add("mm-flip");
    const btns = root.querySelectorAll(".mm-opt");
    btns.forEach((b, i) => {
      b.className = "mm-opt";
      b.disabled = false;
      b.querySelector(".mm-opt-val").textContent = game.q.options[i];
    });
    requestAnimationFrame(() =>
      requestAnimationFrame(() => opts.classList.remove("mm-flip")));
    $(".mm-feedback").textContent = "";
    paintHud();
  }

  function answer(i) {
    if (!game || game.locked || !game.q) return;
    game.locked = true;
    const btns = root.querySelectorAll(".mm-opt");
    const chosen = game.q.options[i];
    const right = chosen === game.q.answer;
    const secs = (performance.now() - game.qAt) / 1000;

    btns.forEach((b) => { b.disabled = true; });
    btns[i].classList.add(right ? "is-right" : "is-wrong");
    if (!right) {
      btns.forEach((b, j) => {
        if (game.q.options[j] === game.q.answer) b.classList.add("is-answer");
      });
    }

    const fb = $(".mm-feedback");

    if (right) {
      game.correct++;
      game.streak++;
      game.bestStreak = Math.max(game.bestStreak, game.streak);
      const base = 10 * game.level;
      const streakBonus = Math.min(game.streak, 10) * 2;
      const speedBonus = secs < 2.5 ? 5 : secs < 4 ? 2 : 0;
      const gained = base + streakBonus + speedBonus;
      game.score += gained;
      fb.textContent = "+" + gained + (speedBonus ? " ⚡ fast!" : "") +
        (game.streak >= 3 ? "  🔥 " + game.streak + " in a row" : "");
      fb.className = "mm-feedback is-good";
      sndGood();

      game.run++;
      if (game.run >= 3 && game.level < 6) {
        game.level++;
        game.run = 0;
        game.bestLevel = Math.max(game.bestLevel, game.level);
        fb.textContent += "   ⬆ Level " + game.level;
        sndUp();
      }
    } else {
      game.streak = 0;
      game.run = 0;
      if (game.level > 1) game.level--;
      fb.textContent = "The answer was " + game.q.answer;
      fb.className = "mm-feedback is-bad";
      sndBad();
      if (MODES[game.mode].seconds) {
        game.msLeft = Math.max(0, game.msLeft - 2000);
        fb.textContent += "  −2s";
        paintTimer();
      } else {
        game.lives--;
      }
    }

    paintHud();

    const over = (!MODES[game.mode].seconds && game.lives <= 0) ||
                 (MODES[game.mode].seconds && game.msLeft <= 0);
    setTimeout(() => {
      if (!game) return;
      if (over) endGame();
      else nextRound();
    }, right ? 380 : 900);
  }

  function onKey(e) {
    if (!game) return;
    if (e.repeat) return;              // holding a key must not blast answers
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    const map = { "1": 0, "2": 1, "3": 2, "4": 3, a: 0, b: 1, c: 2, d: 3 };
    const i = map[e.key.toLowerCase()];
    if (i != null) { e.preventDefault(); answer(i); }
  }

  // ----------------------------------------------------------- end screen

  async function endGame() {
    if (!game) return;
    const final = game;
    stop();
    sndEnd();
    boardMode = final.mode;   // show the board for the mode just played
    noteMyBest(final.mode, final.score);
    saveSeen();

    root.replaceChildren();
    const wrap = el("section", "mm-over");
    wrap.appendChild(el("div", "mm-over-icon", MODES[final.mode].icon));
    wrap.appendChild(el("h1", "mm-over-title", "Time's up!"));
    if (final.mode === "survival") wrap.querySelector(".mm-over-title").textContent = "Out of lives!";
    wrap.appendChild(el("div", "mm-over-score", String(final.score)));
    wrap.appendChild(el("div", "mm-over-score-label", "points"));

    const stats = el("div", "mm-stats");
    const acc = final.asked ? Math.round((final.correct / final.asked) * 100) : 0;
    [
      ["✅", final.correct + "/" + final.asked, "Correct"],
      ["🎯", acc + "%", "Accuracy"],
      ["🔥", final.bestStreak, "Best streak"],
      ["⬆️", "Level " + final.bestLevel, "Reached"],
    ].forEach(([ic, v, l]) => {
      const s = el("div", "mm-stat");
      s.appendChild(el("span", "mm-stat-icon", ic));
      s.appendChild(el("span", "mm-stat-val", String(v)));
      s.appendChild(el("span", "mm-stat-label", l));
      stats.appendChild(s);
    });
    wrap.appendChild(stats);

    const slot = el("div", "mm-claim");
    wrap.appendChild(slot);

    const btns = el("div", "mm-over-btns");
    const again = el("button", "mm-btn mm-btn--go", "Play again");
    again.type = "button";
    again.addEventListener("click", () => startGame(final.mode));
    const back = el("button", "mm-btn", "Choose a mode");
    back.type = "button";
    back.addEventListener("click", () => renderStart());
    btns.append(again, back);
    wrap.appendChild(btns);
    root.appendChild(wrap);

    // Top 3 of the week? Then — and only then — ask for initials.
    const rows = await Board.top(final.mode, weekKey());
    const third = rows.length >= 3 ? rows[2].score : -1;
    const madeIt = final.score > 0 && (rows.length < 3 || final.score > third);

    if (madeIt) claimForm(slot, final);
    else {
      const gap = third - final.score;
      let miss;
      if (rows.length < 3) miss = "Score some points to get your initials on the board!";
      else if (final.score === 0) miss = "No points this time. Take a breath and go again!";
      else if (gap <= 30) miss = "So close! " + (gap + 1) + " more points and you're in the top 3.";
      else miss = "Top 3 starts at " + (third + 1) + " points this week. Keep climbing!";
      slot.appendChild(el("p", "mm-claim-miss", miss));
      slot.appendChild(boardPanel());
    }
  }

  const BAD_INITIALS = new Set([
    "ASS", "FUK", "FCK", "FUC", "SEX", "WTF", "FAG", "NIG", "CUM", "TIT",
    "PIS", "POO", "DIE", "KKK", "SHT", "DIK", "GAY",
  ]);

  function claimForm(slot, final) {
    slot.replaceChildren();
    const box = el("div", "mm-claim-box");
    box.appendChild(el("div", "mm-claim-crown", "🏆"));
    box.appendChild(el("h2", "mm-claim-title", "Top 3 this week!"));
    box.appendChild(el("p", "mm-claim-sub",
      "Put your initials on the board — up to 3 letters. It stays up until Monday."));

    const form = el("form", "mm-claim-form");
    const input = el("input", "mm-initials");
    input.type = "text";
    input.maxLength = 3;
    input.autocomplete = "off";
    input.placeholder = "ABC";
    input.setAttribute("aria-label", "Your initials, up to 3 letters");
    input.value = read(K_ME, "") || "";
    input.addEventListener("input", () => {
      input.value = input.value.toUpperCase().replace(/[^A-Z]/g, "");
      err.textContent = "";
    });
    const send = el("button", "mm-btn mm-btn--go", "Put me on the board");
    send.type = "submit";
    form.append(input, send);
    box.appendChild(form);

    const err = el("p", "mm-claim-err", "");
    box.appendChild(err);
    slot.appendChild(box);

    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const initials = input.value.trim().toUpperCase();
      if (!/^[A-Z]{2,3}$/.test(initials)) {
        err.textContent = "Please use 2 or 3 letters (A–Z).";
        return;
      }
      if (BAD_INITIALS.has(initials)) {
        err.textContent = "Pick different initials, please.";
        return;
      }
      write(K_ME, initials);
      send.disabled = true;
      send.textContent = "Saving…";
      const online = await Board.submit({
        week: weekKey(), mode: final.mode, initials, score: final.score,
      });
      slot.replaceChildren();
      slot.appendChild(el("p", "mm-claim-done",
        "🎉 " + initials + " is on the board with " + final.score + " points!" +
        (online ? "" : " (saved on this device)")));
      slot.appendChild(boardPanel());
    });

    setTimeout(() => input.focus(), 60);
  }

  // ---------------------------------------------------------------- mount

  function mount(container) {
    stop();
    root = el("div", "mm-arena");
    container.appendChild(root);
    boardMode = "sprint";
    renderStart();
    return root;
  }

  window.MathClicksGame = { mount, stop };
})();
