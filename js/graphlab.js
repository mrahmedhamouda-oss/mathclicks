/* MathClicks GraphLab — interactive graph widgets for the IGCSE graph lessons.
   Loaded on demand by a lesson fragment, then GraphLab.mount(lessonRoot) wires
   every element carrying a data-lab="…" attribute. Safe to mount many times. */
(function () {
  if (window.GraphLab) return;

  // ---------- theme-aware palette ----------

  const isDark = () => document.documentElement.dataset.theme === "dark";
  const SERIES = {
    light: { c1: "#3B5BDB", c2: "#E8590C", c3: "#0CA678", c4: "#7048E8", c5: "#D6336C" },
    dark:  { c1: "#8CA8FF", c2: "#FFA94D", c3: "#63E6BE", c4: "#B197FC", c5: "#FF8FAB" },
  };
  function pal() {
    const d = isDark();
    const s = d ? SERIES.dark : SERIES.light;
    return Object.assign({
      bg:     d ? "#151B36" : "#ffffff",
      grid:   d ? "#28315A" : "#eaeef8",
      grid2:  d ? "#39447A" : "#d8e0f2",
      axis:   d ? "#93A0C8" : "#7d88ab",
      text:   d ? "#9AA6CC" : "#5c6785",
      strong: d ? "#E8ECFA" : "#16213e",
      soft:   d ? "rgba(140,168,255,.16)" : "rgba(59,91,219,.10)",
      soft2:  d ? "rgba(99,230,190,.16)"  : "rgba(12,166,120,.11)",
      soft3:  d ? "rgba(255,169,77,.16)"  : "rgba(232,89,12,.11)",
      faint:  d ? "#3A4470" : "#c9d3ea",
    }, s);
  }
  // A colour may be given as a palette token ("c1", "soft", …) or a literal CSS colour,
  // so themes can be swapped without rebuilding the widget.
  const col = (P, v, fallback) => (v == null ? fallback : P[v] || v);

  // ---------- number helpers ----------

  const MINUS = "−";
  function fmt(n, dp) {
    if (!isFinite(n)) return "undefined";
    const r = Number(n.toFixed(dp == null ? 2 : dp));
    let s = String(Math.abs(r) < 1e-9 ? 0 : r);
    return s.replace("-", MINUS);
  }
  const sup = { 2: "²", 3: "³" };
  function niceStep(span) {
    const raw = span / 9;
    const p = Math.pow(10, Math.floor(Math.log10(raw)));
    const n = raw / p;
    return (n < 1.5 ? 1 : n < 3 ? 2 : n < 7 ? 5 : 10) * p;
  }

  // ---------- tiny DOM helpers ----------

  function e(tag, cls, txt) {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (txt != null) n.textContent = txt;
    return n;
  }
  function html(tag, cls, markup) {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (markup != null) n.innerHTML = markup;
    return n;
  }

  function slider(label, min, max, step, val, onInput) {
    const wrap = e("label", "gl-slider");
    const head = e("span", "gl-slider-head");
    head.appendChild(e("span", "gl-slider-name", label));
    const out = e("output", "gl-slider-val", fmt(val));
    head.appendChild(out);
    const input = document.createElement("input");
    input.type = "range";
    input.min = min; input.max = max; input.step = step; input.value = val;
    wrap.appendChild(head);
    wrap.appendChild(input);
    const fire = () => { out.textContent = fmt(+input.value); onInput(+input.value); };
    input.addEventListener("input", fire);
    return { el: wrap, input, out, set(v) { input.value = v; out.textContent = fmt(+v); } };
  }

  function chipRow(items, onPick, activeIndex) {
    const row = e("div", "gl-chips");
    const btns = items.map((it, i) => {
      const b = e("button", "gl-chip", it.label);
      b.type = "button";
      if (it.color) b.style.setProperty("--chip-c", it.color);
      b.addEventListener("click", () => {
        btns.forEach((x) => x.classList.remove("on"));
        b.classList.add("on");
        onPick(it, i);
      });
      row.appendChild(b);
      return b;
    });
    if (activeIndex != null && btns[activeIndex]) btns[activeIndex].classList.add("on");
    return { el: row, btns };
  }

  function factRow(label, value, cls) {
    const r = e("div", "gl-fact" + (cls ? " " + cls : ""));
    r.appendChild(e("span", "gl-fact-k", label));
    const v = e("span", "gl-fact-v", value);
    r.appendChild(v);
    r.setValue = (t) => { v.textContent = t; };
    return r;
  }

  // ---------- the plot ----------

  const live = [];

  function Plot(canvas, opts) {
    this.cv = canvas;
    this.o = Object.assign({ xmin: -6, xmax: 6, ymin: -6, ymax: 6, ratio: 0.62 }, opts || {});
    this.hover = null;
    const self = this;

    canvas.addEventListener("pointermove", (ev) => {
      const r = canvas.getBoundingClientRect();
      self.hover = { px: ev.clientX - r.left, py: ev.clientY - r.top };
      self.draw();
    });
    canvas.addEventListener("pointerleave", () => { self.hover = null; self.draw(); });
    canvas.addEventListener("click", (ev) => {
      if (!self.o.onClick) return;
      const r = canvas.getBoundingClientRect();
      self.o.onClick(self.ux(ev.clientX - r.left), self.uy(ev.clientY - r.top));
    });

    if (window.ResizeObserver) {
      this.ro = new ResizeObserver(() => self.draw());
      this.ro.observe(canvas.parentNode || canvas);
    }
    live.push(this);
    this.draw();
  }

  Plot.prototype.set = function (o) { Object.assign(this.o, o); this.draw(); };

  Plot.prototype.geom = function () {
    const o = this.o;
    const cssW = Math.max(220, (this.cv.parentNode ? this.cv.parentNode.clientWidth : 320) - 2);
    const cssH = Math.round(Math.min(o.maxH || 340, Math.max(o.minH || 210, cssW * o.ratio)));
    return {
      cssW, cssH,
      padL: o.ylab ? 52 : 34,
      padR: 16,
      padT: 14,
      padB: o.xlab ? 42 : 26,
    };
  };

  Plot.prototype.X = function (x) {
    const g = this.g, o = this.o;
    return g.padL + ((x - o.xmin) / (o.xmax - o.xmin)) * (g.cssW - g.padL - g.padR);
  };
  Plot.prototype.Y = function (y) {
    const g = this.g, o = this.o;
    return g.cssH - g.padB - ((y - o.ymin) / (o.ymax - o.ymin)) * (g.cssH - g.padT - g.padB);
  };
  Plot.prototype.ux = function (px) {
    const g = this.g, o = this.o;
    return o.xmin + ((px - g.padL) / (g.cssW - g.padL - g.padR)) * (o.xmax - o.xmin);
  };
  Plot.prototype.uy = function (py) {
    const g = this.g, o = this.o;
    return o.ymin + ((g.cssH - g.padB - py) / (g.cssH - g.padT - g.padB)) * (o.ymax - o.ymin);
  };

  Plot.prototype.draw = function () {
    const cv = this.cv;
    if (!cv.isConnected) return;
    const o = this.o, P = pal();
    const g = this.g = this.geom();
    const dpr = window.devicePixelRatio || 1;
    cv.style.width = g.cssW + "px";
    cv.style.height = g.cssH + "px";
    cv.width = Math.round(g.cssW * dpr);
    cv.height = Math.round(g.cssH * dpr);
    const c = cv.getContext("2d");
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
    c.clearRect(0, 0, g.cssW, g.cssH);
    c.fillStyle = P.bg;
    c.fillRect(0, 0, g.cssW, g.cssH);

    const X = this.X.bind(this), Y = this.Y.bind(this);
    const sx = o.stepx || niceStep(o.xmax - o.xmin);
    const sy = o.stepy || niceStep(o.ymax - o.ymin);

    // shaded bands (domain / range highlights)
    (o.bands || []).forEach((b) => {
      c.fillStyle = col(P, b.color, P.soft);
      if (b.axis === "y") c.fillRect(X(o.xmin), Y(Math.min(b.to, o.ymax)), g.cssW - g.padL - g.padR, Math.abs(Y(Math.min(b.to, o.ymax)) - Y(Math.max(b.from, o.ymin))));
      else c.fillRect(X(Math.max(b.from, o.xmin)), Y(o.ymax), Math.abs(X(Math.min(b.to, o.xmax)) - X(Math.max(b.from, o.xmin))), g.cssH - g.padT - g.padB);
    });

    // grid
    c.lineWidth = 1;
    c.strokeStyle = P.grid;
    for (let x = Math.ceil(o.xmin / sx) * sx; x <= o.xmax + 1e-9; x += sx) {
      c.beginPath(); c.moveTo(X(x), Y(o.ymin)); c.lineTo(X(x), Y(o.ymax)); c.stroke();
    }
    for (let y = Math.ceil(o.ymin / sy) * sy; y <= o.ymax + 1e-9; y += sy) {
      c.beginPath(); c.moveTo(X(o.xmin), Y(y)); c.lineTo(X(o.xmax), Y(y)); c.stroke();
    }

    // shaded area under a curve (e.g. distance = area under a speed–time graph)
    (o.fills || []).forEach((fl) => {
      const a = fl.from == null ? o.xmin : fl.from;
      const b = fl.to == null ? o.xmax : fl.to;
      const base = fl.base == null ? 0 : fl.base;
      c.fillStyle = col(P, fl.color, P.soft);
      c.beginPath();
      c.moveTo(X(a), Y(base));
      for (let i = 0; i <= 300; i++) {
        const xv = a + ((b - a) * i) / 300;
        const yv = fl.f(xv);
        c.lineTo(X(xv), Y(isFinite(yv) ? Math.max(o.ymin, Math.min(o.ymax, yv)) : base));
      }
      c.lineTo(X(b), Y(base));
      c.closePath();
      c.fill();
    });

    // axes
    c.strokeStyle = P.axis; c.lineWidth = 1.5;
    if (o.ymin <= 0 && o.ymax >= 0) { c.beginPath(); c.moveTo(X(o.xmin), Y(0)); c.lineTo(X(o.xmax), Y(0)); c.stroke(); }
    if (o.xmin <= 0 && o.xmax >= 0) { c.beginPath(); c.moveTo(X(0), Y(o.ymin)); c.lineTo(X(0), Y(o.ymax)); c.stroke(); }

    // tick numbers
    c.fillStyle = P.text; c.font = "11px Inter, system-ui, sans-serif";
    c.textAlign = "center"; c.textBaseline = "top";
    const y0 = Math.min(Math.max(Y(0), g.padT), g.cssH - g.padB);
    for (let x = Math.ceil(o.xmin / sx) * sx; x <= o.xmax + 1e-9; x += sx) {
      if (Math.abs(x) < 1e-9) continue;
      c.fillText(fmt(x), X(x), y0 + 4);
    }
    c.textAlign = "right"; c.textBaseline = "middle";
    const x0 = Math.min(Math.max(X(0), g.padL), g.cssW - g.padR);
    for (let y = Math.ceil(o.ymin / sy) * sy; y <= o.ymax + 1e-9; y += sy) {
      if (Math.abs(y) < 1e-9) continue;
      c.fillText(fmt(y), x0 - 5, Y(y));
    }
    c.textAlign = "left"; c.textBaseline = "alphabetic";
    c.fillStyle = P.strong; c.font = "700 12px Inter, system-ui, sans-serif";
    if (o.xlab) {
      c.textAlign = "center";
      c.fillText(o.xlab, (g.padL + g.cssW - g.padR) / 2, g.cssH - 8);
    } else {
      c.fillText("x", X(o.xmax) - 9, y0 - 7);
    }
    if (o.ylab) {
      c.save();
      c.translate(13, (g.padT + g.cssH - g.padB) / 2);
      c.rotate(-Math.PI / 2);
      c.textAlign = "center";
      c.fillText(o.ylab, 0, 0);
      c.restore();
    } else {
      c.textAlign = "left";
      c.fillText("y", x0 + 7, Y(o.ymax) + 12);
    }
    c.textAlign = "left";

    // asymptotes / guide lines
    (o.guides || []).forEach((a) => {
      c.save(); c.setLineDash([6, 5]);
      c.strokeStyle = col(P, a.color, P.axis); c.lineWidth = a.width || 1.4;
      c.beginPath();
      if (a.x != null) { c.moveTo(X(a.x), Y(o.ymin)); c.lineTo(X(a.x), Y(o.ymax)); }
      else { c.moveTo(X(o.xmin), Y(a.y)); c.lineTo(X(o.xmax), Y(a.y)); }
      c.stroke(); c.restore();
      if (a.label) {
        c.fillStyle = col(P, a.color, P.text);
        c.font = "700 11px Inter, system-ui, sans-serif";
        if (a.x != null) c.fillText(a.label, X(a.x) + 5, Y(o.ymax) + 13);
        else c.fillText(a.label, X(o.xmin) + 5, Y(a.y) - 5);
      }
    });

    // curves
    (o.curves || []).forEach((cu) => {
      if (cu.hidden) return;
      c.strokeStyle = col(P, cu.color, P.c1);
      c.lineWidth = cu.width || 2.6;
      c.save();
      if (cu.dash) c.setLineDash([7, 5]);
      c.beginPath();
      const N = Math.max(400, Math.round(g.cssW * 2));
      const a0 = cu.from == null ? o.xmin : cu.from;
      const a1 = cu.to == null ? o.xmax : cu.to;
      let started = false, prev = null;
      for (let i = 0; i <= N; i++) {
        const xv = a0 + ((a1 - a0) * i) / N;
        const yv = cu.f(xv);
        const inside = isFinite(yv) && yv >= o.ymin - (o.ymax - o.ymin) && yv <= o.ymax + (o.ymax - o.ymin);
        const jump = prev != null && Math.abs(yv - prev) > (o.ymax - o.ymin) * 0.55;
        if (!inside || jump) { started = false; prev = isFinite(yv) ? yv : null; continue; }
        const py = Math.max(-2000, Math.min(2000, Y(yv)));
        if (!started) { c.moveTo(X(xv), py); started = true; } else { c.lineTo(X(xv), py); }
        prev = yv;
      }
      c.stroke();
      c.restore();
      if (cu.label && cu.lx != null) {
        c.fillStyle = col(P, cu.color, P.c1);
        c.font = "700 12px Inter, system-ui, sans-serif";
        c.textAlign = "left";
        c.fillText(cu.label, X(cu.lx), Y(cu.ly));
      }
    });

    // straight segments given by their two endpoints (chords, tangents, rise/run)
    (o.segs || []).forEach((s) => {
      c.save();
      c.strokeStyle = col(P, s.color, P.c2);
      c.lineWidth = s.width || 2;
      if (s.dash) c.setLineDash([6, 4]);
      c.beginPath(); c.moveTo(X(s.x1), Y(s.y1)); c.lineTo(X(s.x2), Y(s.y2)); c.stroke();
      c.restore();
      if (s.label) {
        c.fillStyle = col(P, s.color, P.c2);
        c.font = "700 11px Inter, system-ui, sans-serif";
        c.textAlign = "center";
        c.fillText(s.label, (X(s.x1) + X(s.x2)) / 2, (Y(s.y1) + Y(s.y2)) / 2 + (s.dy || -6));
        c.textAlign = "left";
      }
    });

    // points
    (o.points || []).forEach((p) => {
      if (p.x < o.xmin || p.x > o.xmax || p.y < o.ymin || p.y > o.ymax) return;
      c.fillStyle = col(P, p.color, P.c2);
      c.strokeStyle = P.bg; c.lineWidth = 2;
      c.beginPath(); c.arc(X(p.x), Y(p.y), p.r || 5, 0, 7);
      c.fill(); c.stroke();
      if (p.label) {
        c.fillStyle = col(P, p.labelColor, P.strong);
        c.font = "700 11px Inter, system-ui, sans-serif";
        c.textAlign = p.align || "left";
        c.fillText(p.label, X(p.x) + (p.align === "right" ? -8 : 8), Y(p.y) + (p.dy == null ? -9 : p.dy));
      }
    });

    // hover crosshair + read-out
    if (this.hover && o.trace) {
      const hx = this.ux(this.hover.px);
      if (hx > o.xmin && hx < o.xmax) {
        const cu = (o.curves || []).filter((k) => !k.hidden && k.trace !== false)[0];
        const hy = cu ? cu.f(hx) : null;
        c.save();
        c.setLineDash([3, 4]); c.strokeStyle = P.axis; c.lineWidth = 1;
        c.beginPath(); c.moveTo(this.hover.px, g.padT); c.lineTo(this.hover.px, g.cssH - g.padB); c.stroke();
        c.restore();
        if (hy != null && isFinite(hy) && hy > o.ymin && hy < o.ymax) {
          c.fillStyle = col(P, cu.color, P.c1);
          c.beginPath(); c.arc(X(hx), Y(hy), 4.5, 0, 7); c.fill();
          const txt = "(" + fmt(hx, 1) + ", " + fmt(hy, 1) + ")";
          c.font = "700 11px Inter, system-ui, sans-serif";
          const w = c.measureText(txt).width + 12;
          let bx = X(hx) + 10, by = Y(hy) - 30;
          if (bx + w > g.cssW - 4) bx = X(hx) - w - 10;
          if (by < 2) by = Y(hy) + 12;
          c.fillStyle = P.bg; c.strokeStyle = col(P, cu.color, P.c1); c.lineWidth = 1.2;
          c.beginPath();
          (c.roundRect ? c.roundRect(bx, by, w, 20, 6) : c.rect(bx, by, w, 20));
          c.fill(); c.stroke();
          c.fillStyle = P.strong; c.textAlign = "left";
          c.fillText(txt, bx + 6, by + 14);
        }
      }
    }
  };

  // redraw everything when the theme flips; drop plots whose canvas is gone
  function redrawAll() {
    for (let i = live.length - 1; i >= 0; i--) {
      if (!live[i].cv.isConnected) { if (live[i].ro) live[i].ro.disconnect(); live.splice(i, 1); }
      else live[i].draw();
    }
  }
  new MutationObserver(redrawAll).observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
  window.addEventListener("resize", redrawAll);

  // ---------- numeric intersections ----------

  function crossings(f, g, xmin, xmax, tol) {
    const N = 1600, span = xmax - xmin, out = [];
    const h = (x) => f(x) - g(x);
    // a root of h is genuine only if h really is ~0 there (guards asymptote jumps)
    const genuine = (x) => {
      const v = h(x);
      return isFinite(v) && Math.abs(v) < 1e-6 * (1 + Math.abs(f(x)));
    };
    // "touch" = h keeps the same sign either side, i.e. a tangent / repeated root
    const kindAt = (x) => {
      const d = span / 400;
      const a = h(x - d), b = h(x + d);
      return isFinite(a) && isFinite(b) && a * b > 0 ? "touch" : "cross";
    };
    const push = (x) => {
      if (x < xmin || x > xmax) return;
      if (out.some((o) => Math.abs(o.x - x) < span / 200)) return;
      out.push({ x, kind: kindAt(x) });
    };
    let px = xmin, ph = h(xmin);
    if (ph === 0) push(xmin);
    for (let i = 1; i <= N; i++) {
      const x = xmin + (span * i) / N;
      const v = h(x);
      if (isFinite(ph) && isFinite(v) && Math.abs(v - ph) < 1e6) {
        if (v === 0) {
          push(x);                                  // sample landed exactly on a root
        } else if (ph !== 0 && ph * v < 0) {
          let a = px, b = x, fa = ph;
          for (let k = 0; k < 60; k++) {
            const m = (a + b) / 2, fm = h(m);
            if (fa * fm <= 0) b = m; else { a = m; fa = fm; }
          }
          const r = (a + b) / 2;
          if (genuine(r)) push(r);                  // not just a jump across an asymptote
        }
      }
      px = x; ph = v;
    }
    if (!out.length) {
      // look for a "just touching" tangent: a local minimum of |h| close to zero
      let best = null;
      for (let i = 1; i < N; i++) {
        const x = xmin + ((xmax - xmin) * i) / N;
        const v = Math.abs(h(x));
        if (isFinite(v) && (!best || v < best.v)) best = { x, v };
      }
      if (best && best.v < (tol || 0.02)) out.push({ x: best.x, kind: "touch" });
    }
    return out;
  }

  // ---------- widget builders ----------

  const build = {};

  /* 1 · Parabola explorer — sliders for a, b, c with live features */
  build.quadlab = function (host) {
    const st = { a: 1, b: -2, c: -3, show: true };
    const panel = e("div", "gl-panel");
    const controls = e("div", "gl-controls");
    const cvBox = e("div", "gl-canvas");
    const cv = document.createElement("canvas");
    cvBox.appendChild(cv);
    const facts = e("div", "gl-facts");

    const eqn = e("div", "gl-eq");
    const shape = factRow("Shape", "");
    const yint = factRow("y-intercept", "");
    const disc = factRow("Discriminant b² − 4ac", "");
    const roots = factRow("Roots", "");
    const sym = factRow("Line of symmetry", "");
    const vert = factRow("Turning point", "");
    const csq = factRow("Completed square", "");
    [shape, yint, disc, roots, sym, vert, csq].forEach((f) => facts.appendChild(f));

    const sa = slider("a", -3, 3, 0.25, st.a, (v) => { st.a = v || 0.25; if (!v) { st.a = 0.25; sa.set(0.25); } upd(); });
    const sb = slider("b", -6, 6, 0.5, st.b, (v) => { st.b = v; upd(); });
    const sc = slider("c", -8, 8, 0.5, st.c, (v) => { st.c = v; upd(); });
    controls.appendChild(sa.el); controls.appendChild(sb.el); controls.appendChild(sc.el);

    const toggles = chipRow([{ label: "Show key features" }], () => {}, 0);
    toggles.btns[0].addEventListener("click", () => {
      st.show = toggles.btns[0].classList.contains("on");
      upd();
    });
    const reset = e("button", "gl-btn ghost", "Reset to y = x² − 2x − 3");
    reset.type = "button";
    reset.addEventListener("click", () => {
      st.a = 1; st.b = -2; st.c = -3; sa.set(1); sb.set(-2); sc.set(-3); upd();
    });
    const bar = e("div", "gl-bar");
    bar.appendChild(toggles.el); bar.appendChild(reset);

    panel.appendChild(eqn);
    panel.appendChild(controls);
    panel.appendChild(cvBox);
    panel.appendChild(bar);
    panel.appendChild(facts);
    host.appendChild(panel);

    const plot = new Plot(cv, { xmin: -7, xmax: 7, ymin: -8, ymax: 10, trace: true });

    function upd() {
      const a = st.a, b = st.b, c = st.c;
      const f = (x) => a * x * x + b * x + c;
      const d = b * b - 4 * a * c;
      const hx = -b / (2 * a), hy = f(hx);
      const term = (v, s) => (v === 0 ? "" : (v < 0 ? " " + MINUS + " " : " + ") + (Math.abs(v) === 1 && s ? "" : fmt(Math.abs(v))) + s);
      const lead = a === 1 ? "" : a === -1 ? MINUS : fmt(a);
      eqn.textContent = "y = " + lead + "x²" + term(b, "x") + term(c, "");

      const pts = [], guides = [];
      if (st.show) {
        guides.push({ x: hx, label: "x = " + fmt(hx), color: "c4" });
        pts.push({ x: 0, y: c, label: "(0, " + fmt(c) + ")", color: "c3", align: "right", dy: 4 });
        pts.push({ x: hx, y: hy, label: (a > 0 ? "min " : "max ") + "(" + fmt(hx) + ", " + fmt(hy) + ")", color: "c2", dy: a > 0 ? 17 : -10 });
        if (d >= 0) {
          const r1 = (-b - Math.sqrt(d)) / (2 * a), r2 = (-b + Math.sqrt(d)) / (2 * a);
          pts.push({ x: r1, y: 0, color: "c5", r: 4.5 });
          if (Math.abs(r1 - r2) > 1e-9) pts.push({ x: r2, y: 0, color: "c5", r: 4.5 });
        }
      }
      plot.set({ curves: [{ f, color: "c1" }], points: pts, guides });

      shape.setValue(a > 0 ? "a > 0 → opens upwards (∪), minimum" : "a < 0 → opens downwards (∩), maximum");
      yint.setValue("(0, " + fmt(c) + ")");
      disc.setValue(fmt(d) + (d > 0 ? "  → two roots" : d === 0 ? "  → one repeated root" : "  → no real roots"));
      if (d > 0) {
        const r1 = (-b - Math.sqrt(d)) / (2 * a), r2 = (-b + Math.sqrt(d)) / (2 * a);
        roots.setValue("x = " + fmt(Math.min(r1, r2)) + "  and  x = " + fmt(Math.max(r1, r2)));
      } else if (Math.abs(d) < 1e-9) roots.setValue("x = " + fmt(hx) + " (repeated — the curve touches the axis)");
      else roots.setValue("none — the curve never reaches the x-axis");
      sym.setValue("x = " + MINUS + "b/(2a) = " + fmt(hx));
      vert.setValue("(" + fmt(hx) + ", " + fmt(hy) + ")  — a " + (a > 0 ? "minimum" : "maximum"));
      const lead2 = a === 1 ? "" : a === -1 ? MINUS : fmt(a);
      const bracket = hx === 0 ? "x²" :
        "(x" + (hx < 0 ? " + " : " " + MINUS + " ") + fmt(Math.abs(hx)) + ")²";
      csq.setValue("y = " + lead2 + bracket + (hy === 0 ? "" : (hy < 0 ? " " + MINUS + " " : " + ") + fmt(Math.abs(hy))));
    }
    upd();
  };

  /* 2 · Table-of-values trainer */
  build.tablelab = function (host) {
    const TASKS = [
      { eq: "y = x² − 2x − 3", f: (x) => x * x - 2 * x - 3, xs: [-2, -1, 0, 1, 2, 3, 4], ymin: -6, ymax: 7 },
      { eq: "y = x² − 4", f: (x) => x * x - 4, xs: [-3, -2, -1, 0, 1, 2, 3], ymin: -6, ymax: 7 },
      { eq: "y = 5 − x²", f: (x) => 5 - x * x, xs: [-3, -2, -1, 0, 1, 2, 3], ymin: -6, ymax: 7 },
      { eq: "y = x² + 2x − 1", f: (x) => x * x + 2 * x - 1, xs: [-4, -3, -2, -1, 0, 1, 2], ymin: -4, ymax: 8 },
    ];
    let ti = 0, task = TASKS[0];

    const panel = e("div", "gl-panel");
    const head = e("div", "gl-eq");
    const tblWrap = e("div", "gl-scroll");
    const table = e("table", "gl-table");
    const bar = e("div", "gl-bar");
    const msg = e("div", "gl-msg");
    const cvBox = e("div", "gl-canvas");
    const cv = document.createElement("canvas");
    cvBox.appendChild(cv);

    const check = e("button", "gl-btn", "✓ Check my table");
    check.type = "button";
    const plotBtn = e("button", "gl-btn ghost", "📈 Plot my points");
    plotBtn.type = "button";
    const next = e("button", "gl-btn ghost", "↻ New table");
    next.type = "button";
    bar.appendChild(check); bar.appendChild(plotBtn); bar.appendChild(next);

    panel.appendChild(head);
    panel.appendChild(tblWrap);
    panel.appendChild(bar);
    panel.appendChild(msg);
    panel.appendChild(cvBox);
    host.appendChild(panel);
    tblWrap.appendChild(table);

    const plot = new Plot(cv, { xmin: -5, xmax: 5, ymin: -6, ymax: 8, trace: true });
    let inputs = [];

    function render() {
      head.textContent = "Complete the table for  " + task.eq;
      table.replaceChildren();
      const r1 = e("tr"), r2 = e("tr");
      r1.appendChild(e("th", null, "x"));
      r2.appendChild(e("th", null, "y"));
      inputs = task.xs.map((x) => {
        r1.appendChild(e("td", "gl-td-x", fmt(x)));
        const td = e("td");
        const inp = document.createElement("input");
        inp.type = "text";
        inp.inputMode = "numeric";
        inp.className = "gl-cell";
        inp.setAttribute("aria-label", "y when x = " + x);
        td.appendChild(inp);
        r2.appendChild(td);
        return inp;
      });
      table.appendChild(r1); table.appendChild(r2);
      msg.className = "gl-msg";
      msg.textContent = "";
      plot.set({ curves: [{ f: task.f, color: "c1", hidden: true }], points: [], ymin: task.ymin, ymax: task.ymax });
    }

    check.addEventListener("click", () => {
      let right = 0, blank = 0;
      inputs.forEach((inp, i) => {
        const want = task.f(task.xs[i]);
        const got = parseFloat(String(inp.value).replace(/−/g, "-").trim());
        inp.classList.remove("ok", "bad");
        if (inp.value.trim() === "") { blank++; return; }
        if (Math.abs(got - want) < 1e-6) { inp.classList.add("ok"); right++; }
        else inp.classList.add("bad");
      });
      const total = inputs.length;
      if (blank) {
        msg.className = "gl-msg warn";
        msg.textContent = "Fill in every cell first — " + blank + " still empty.";
      } else if (right === total) {
        msg.className = "gl-msg good";
        msg.textContent = "All " + total + " correct! Notice how the y-values are symmetric about the turning point.";
      } else {
        msg.className = "gl-msg bad";
        msg.textContent = right + " of " + total + " correct. Check the red cells — remember (−3)² = 9, not −9.";
      }
    });

    plotBtn.addEventListener("click", () => {
      const pts = [];
      inputs.forEach((inp, i) => {
        const v = parseFloat(String(inp.value).replace(/−/g, "-").trim());
        if (isFinite(v)) {
          const ok = Math.abs(v - task.f(task.xs[i])) < 1e-6;
          pts.push({ x: task.xs[i], y: v, color: ok ? "c3" : "c5", r: 5 });
        }
      });
      plot.set({ curves: [{ f: task.f, color: "c1" }], points: pts });
      msg.className = "gl-msg";
      msg.textContent = pts.length
        ? "Green dots sit on the true curve; pink dots do not. Join correct points with a smooth freehand curve — never a ruler."
        : "Type some y-values first, then plot them.";
    });

    next.addEventListener("click", () => { ti = (ti + 1) % TASKS.length; task = TASKS[ti]; render(); });
    render();
  };

  /* 3 · Click-the-feature game */
  build.featurelab = function (host) {
    const f = (x) => x * x - 2 * x - 3;
    const TARGETS = [
      { q: "Click the <b>y-intercept</b>.", x: 0, y: -3, tip: "The y-intercept is where the curve crosses the y-axis — put x = 0." },
      { q: "Click the <b>turning point</b>.", x: 1, y: -4, tip: "The vertex sits on the line of symmetry, x = −b/(2a) = 1." },
      { q: "Click the <b>positive root</b>.", x: 3, y: 0, tip: "Roots are where y = 0. Factorising: (x + 1)(x − 3) = 0." },
      { q: "Click the <b>negative root</b>.", x: -1, y: 0, tip: "The other solution of (x + 1)(x − 3) = 0." },
      { q: "Click the point where <b>x = 2</b> on the curve.", x: 2, y: -3, tip: "Go up from x = 2 until you meet the curve, then across." },
    ];
    let i = 0, score = 0, tries = 0;

    const panel = e("div", "gl-panel");
    const prompt = html("div", "gl-prompt", "");
    const cvBox = e("div", "gl-canvas");
    const cv = document.createElement("canvas");
    cvBox.appendChild(cv);
    const msg = e("div", "gl-msg");
    const bar = e("div", "gl-bar");
    const skip = e("button", "gl-btn ghost", "Show me →");
    skip.type = "button";
    const scoreTag = e("span", "gl-score", "Score 0 / 0");
    bar.appendChild(skip); bar.appendChild(scoreTag);

    panel.appendChild(html("div", "gl-eq", "y = x² − 2x − 3"));
    panel.appendChild(prompt);
    panel.appendChild(cvBox);
    panel.appendChild(msg);
    panel.appendChild(bar);
    host.appendChild(panel);

    const plot = new Plot(cv, {
      xmin: -4, xmax: 5, ymin: -6, ymax: 7,
      curves: [{ f, color: "c1" }],
      onClick: guess,
    });

    function show() {
      prompt.innerHTML = "<span class='gl-pill'>" + (i + 1) + " / " + TARGETS.length + "</span> " + TARGETS[i].q;
      plot.set({ curves: [{ f, color: "c1" }], points: [] });
      msg.className = "gl-msg"; msg.textContent = "Click straight on the graph.";
    }
    function guess(x, y) {
      const t = TARGETS[i];
      tries++;
      const near = Math.abs(x - t.x) < 0.7 && Math.abs(y - t.y) < 0.9;
      if (near) {
        score++;
        msg.className = "gl-msg good";
        msg.textContent = "Correct — (" + fmt(t.x) + ", " + fmt(t.y) + "). " + t.tip;
        plot.set({ points: [{ x: t.x, y: t.y, color: "c3", label: "(" + fmt(t.x) + ", " + fmt(t.y) + ")" }] });
        setTimeout(nextQ, 1400);
      } else {
        msg.className = "gl-msg bad";
        msg.textContent = "Not quite — you clicked near (" + fmt(x, 1) + ", " + fmt(y, 1) + "). " + t.tip;
      }
      scoreTag.textContent = "Score " + score + " / " + tries;
    }
    function nextQ() {
      i = (i + 1) % TARGETS.length;
      show();
    }
    skip.addEventListener("click", () => {
      const t = TARGETS[i];
      plot.set({ points: [{ x: t.x, y: t.y, color: "c2", label: "(" + fmt(t.x) + ", " + fmt(t.y) + ")" }] });
      msg.className = "gl-msg warn";
      msg.textContent = t.tip;
      setTimeout(nextQ, 1600);
    });
    show();
  };

  /* 4 · Reciprocal explorer */
  build.reciplab = function (host) {
    const st = { a: 6, k: 0 };
    const panel = e("div", "gl-panel");
    const eqn = e("div", "gl-eq");
    const controls = e("div", "gl-controls");
    const cvBox = e("div", "gl-canvas");
    const cv = document.createElement("canvas");
    cvBox.appendChild(cv);
    const facts = e("div", "gl-facts");
    const quad = factRow("Branches", "");
    const va = factRow("Vertical asymptote", "");
    const ha = factRow("Horizontal asymptote", "");
    [quad, va, ha].forEach((r) => facts.appendChild(r));
    const tblWrap = e("div", "gl-scroll");
    const table = e("table", "gl-table");
    tblWrap.appendChild(table);

    const sa = slider("a", -12, 12, 1, st.a, (v) => { st.a = v === 0 ? 1 : v; if (v === 0) sa.set(1); upd(); });
    const sk = slider("k  (shift up/down)", -4, 4, 1, st.k, (v) => { st.k = v; upd(); });
    controls.appendChild(sa.el); controls.appendChild(sk.el);

    panel.appendChild(eqn);
    panel.appendChild(controls);
    panel.appendChild(cvBox);
    panel.appendChild(facts);
    panel.appendChild(tblWrap);
    host.appendChild(panel);

    const plot = new Plot(cv, { xmin: -9, xmax: 9, ymin: -9, ymax: 9, trace: true });
    const XS = [-6, -3, -1, -0.5, 0, 0.5, 1, 3, 6];

    function upd() {
      const a = st.a, k = st.k;
      const f = (x) => a / x + k;
      eqn.textContent = "y = " + fmt(a) + "/x" + (k === 0 ? "" : (k > 0 ? " + " : " " + MINUS + " ") + fmt(Math.abs(k)));
      plot.set({
        curves: [{ f, color: "c1" }],
        guides: [{ x: 0, label: "x = 0" }, { y: k, label: "y = " + fmt(k) }],
        points: [],
      });
      quad.setValue(a > 0 ? "1st & 3rd quadrants (top-right and bottom-left)" : "2nd & 4th quadrants (top-left and bottom-right)");
      va.setValue("x = 0 — the function is undefined there, so leave a gap");
      ha.setValue("y = " + fmt(k) + (k === 0 ? " (the x-axis)" : " — the whole curve has slid " + (k > 0 ? "up" : "down") + " by " + fmt(Math.abs(k))));

      table.replaceChildren();
      const r1 = e("tr"), r2 = e("tr");
      r1.appendChild(e("th", null, "x"));
      r2.appendChild(e("th", null, "y"));
      XS.forEach((x) => {
        r1.appendChild(e("td", "gl-td-x", fmt(x)));
        const y = x === 0 ? null : a / x + k;
        const td = e("td", y == null ? "gl-td-undef" : null, y == null ? "undefined" : fmt(y, 2));
        r2.appendChild(td);
      });
      table.appendChild(r1); table.appendChild(r2);
    }
    upd();
  };

  /* 5 · Solve graphically — slide a line across a fixed curve */
  build.solvelab = function (host) {
    const curveName = host.dataset.curve || "q1";
    const CURVES = {
      q1: { label: "y = x² − 2x − 3", f: (x) => x * x - 2 * x - 3, xmin: -4, xmax: 6, ymin: -7, ymax: 9 },
      q2: { label: "y = x² − 2", f: (x) => x * x - 2, xmin: -4, xmax: 4, ymin: -6, ymax: 9 },
    };
    const cu = CURVES[curveName] || CURVES.q1;
    const st = { m: 0, c: 0 };

    const panel = e("div", "gl-panel");
    const eqn = e("div", "gl-eq");
    const controls = e("div", "gl-controls");
    const cvBox = e("div", "gl-canvas");
    const cv = document.createElement("canvas");
    cvBox.appendChild(cv);
    const verdict = e("div", "gl-msg");
    const facts = e("div", "gl-facts");
    const cnt = factRow("Intersections", "");
    const sol = factRow("Solutions (x to 1 d.p.)", "");
    const eq2 = factRow("Equation being solved", "");
    [cnt, sol, eq2].forEach((r) => facts.appendChild(r));

    const sm = slider("gradient m", -4, 4, 0.5, st.m, (v) => { st.m = v; upd(); });
    const sc = slider("intercept c", -8, 8, 0.5, st.c, (v) => { st.c = v; upd(); });
    controls.appendChild(sm.el); controls.appendChild(sc.el);

    const presets = chipRow([
      { label: "y = 0  (find the roots)" },
      { label: "y = 2" },
      { label: "y = x + 2" },
      { label: "y = " + MINUS + "4" },
    ], (it, i) => {
      const setv = [[0, 0], [0, 2], [1, 2], [0, -4]][i];
      st.m = setv[0]; st.c = setv[1];
      sm.set(st.m); sc.set(st.c); upd();
    }, 0);

    panel.appendChild(eqn);
    panel.appendChild(presets.el);
    panel.appendChild(controls);
    panel.appendChild(cvBox);
    panel.appendChild(verdict);
    panel.appendChild(facts);
    host.appendChild(panel);

    const plot = new Plot(cv, { xmin: cu.xmin, xmax: cu.xmax, ymin: cu.ymin, ymax: cu.ymax, trace: true });

    function lineText(m, c) {
      if (m === 0) return "y = " + fmt(c);
      const mt = m === 1 ? "x" : m === -1 ? MINUS + "x" : fmt(m) + "x";
      return "y = " + mt + (c === 0 ? "" : (c > 0 ? " + " : " " + MINUS + " ") + fmt(Math.abs(c)));
    }

    function upd() {
      const g = (x) => st.m * x + st.c;
      eqn.textContent = cu.label + "   with   " + lineText(st.m, st.c);
      const hits = crossings(cu.f, g, cu.xmin, cu.xmax, 0.03);
      const pts = hits.map((h) => ({ x: h.x, y: cu.f(h.x), color: "c5", label: "x = " + fmt(h.x, 1), dy: -10 }));
      plot.set({
        curves: [{ f: cu.f, color: "c1" }, { f: g, color: "c2", width: 2, trace: false }],
        points: pts,
      });
      cnt.setValue(hits.length === 0 ? "none" : hits.length === 1 && hits[0].kind === "touch"
        ? "1 — the line is a tangent (repeated solution)" : String(hits.length));
      sol.setValue(hits.length ? hits.map((h) => "x = " + fmt(h.x, 1)).join("   and   ") : "no real solutions");
      // ax² + bx + c = mx + k  →  the equation the intersections solve
      eq2.setValue(cu.label.replace("y = ", "") + " = " + lineText(st.m, st.c).replace("y = ", ""));
      if (hits.length === 2) {
        verdict.className = "gl-msg good";
        verdict.textContent = "The line cuts the curve twice → two solutions. Read the x-coordinates, never the y.";
      } else if (hits.length === 1) {
        verdict.className = "gl-msg warn";
        verdict.textContent = "The line just touches the curve → one repeated solution. This line is a tangent.";
      } else {
        verdict.className = "gl-msg bad";
        verdict.textContent = "The line misses the curve → no real solutions.";
      }
    }
    upd();
  };

  /* 6 · Difference machine — linear, quadratic or neither */
  build.difflab = function (host) {
    const SETS = [
      { name: "A", xs: [1, 2, 3, 4, 5], ys: [4, 7, 10, 13, 16] },
      { name: "B", xs: [1, 2, 3, 4, 5], ys: [1, 4, 9, 16, 25] },
      { name: "C", xs: [1, 2, 3, 4, 5], ys: [12, 6, 4, 3, 2.4] },
      { name: "D", xs: [1, 2, 3, 4, 5], ys: [2, 5, 10, 17, 26] },
    ];
    let ys = SETS[0].ys.slice();

    const panel = e("div", "gl-panel");
    const lead = e("div", "gl-eq", "Type five y-values (x goes up in equal steps of 1)");
    const row = e("div", "gl-inputs");
    const bar = e("div", "gl-bar");
    const out = e("div", "gl-scroll");
    const verdict = e("div", "gl-msg");
    const cvBox = e("div", "gl-canvas");
    const cv = document.createElement("canvas");
    cvBox.appendChild(cv);

    const inputs = ys.map((v) => {
      const i = document.createElement("input");
      i.type = "text"; i.inputMode = "numeric"; i.className = "gl-cell wide"; i.value = v;
      i.addEventListener("input", upd);
      row.appendChild(i);
      return i;
    });
    const chips = chipRow(SETS.map((s) => ({ label: "Set " + s.name })), (it, i) => {
      SETS[i].ys.forEach((v, k) => (inputs[k].value = v));
      upd();
    }, 0);

    bar.appendChild(chips.el);
    panel.appendChild(lead);
    panel.appendChild(row);
    panel.appendChild(bar);
    panel.appendChild(out);
    panel.appendChild(verdict);
    panel.appendChild(cvBox);
    host.appendChild(panel);

    const plot = new Plot(cv, { xmin: 0, xmax: 6, ymin: -2, ymax: 28, ratio: 0.5 });

    function upd() {
      const v = inputs.map((i) => parseFloat(String(i.value).replace(/−/g, "-")));
      if (v.some((x) => !isFinite(x))) {
        verdict.className = "gl-msg warn";
        verdict.textContent = "Enter a number in every box.";
        return;
      }
      const d1 = [], d2 = [];
      for (let i = 1; i < v.length; i++) d1.push(v[i] - v[i - 1]);
      for (let i = 1; i < d1.length; i++) d2.push(d1[i] - d1[i - 1]);
      const same = (arr) => arr.every((x) => Math.abs(x - arr[0]) < 1e-9);

      const tbl = e("table", "gl-table diff");
      const mk = (label, cells, offset, cls) => {
        const tr = e("tr");
        tr.appendChild(e("th", null, label));
        for (let i = 0; i < offset; i++) tr.appendChild(e("td", "gl-td-blank", ""));
        cells.forEach((c) => tr.appendChild(e("td", cls, (c > 0 ? "+" : c < 0 ? MINUS : "") + fmt(Math.abs(c)))));
        return tr;
      };
      const trx = e("tr");
      trx.appendChild(e("th", null, "x"));
      [1, 2, 3, 4, 5].forEach((x) => trx.appendChild(e("td", "gl-td-x", String(x))));
      const trY = e("tr");
      trY.appendChild(e("th", null, "y"));
      v.forEach((y) => trY.appendChild(e("td", null, fmt(y))));
      tbl.appendChild(trx); tbl.appendChild(trY);
      tbl.appendChild(mk("1st diff", d1, 1, same(d1) ? "gl-td-ok" : ""));
      tbl.appendChild(mk("2nd diff", d2, 2, same(d2) && !same(d1) ? "gl-td-ok" : ""));
      out.replaceChildren(tbl);

      if (same(d1)) {
        verdict.className = "gl-msg good";
        verdict.textContent = "Constant 1st differences (" + fmt(d1[0]) + ") → LINEAR. Straight line, y = " + fmt(d1[0]) + "x + " + fmt(v[0] - d1[0]) + ".";
      } else if (same(d2)) {
        verdict.className = "gl-msg good";
        verdict.textContent = "1st differences change but 2nd differences are constant (" + fmt(d2[0]) + ") → QUADRATIC. The x² coefficient is half the 2nd difference: a = " + fmt(d2[0] / 2) + ".";
      } else {
        const prod = v.map((y, i) => y * (i + 1));
        const constProduct = prod.every((p) => Math.abs(p - prod[0]) < 1e-6);
        verdict.className = "gl-msg warn";
        verdict.textContent = constProduct
          ? "Neither difference is constant, but x × y is always " + fmt(prod[0]) + " → RECIPROCAL, y = " + fmt(prod[0]) + "/x."
          : "Neither 1st nor 2nd differences are constant → some other non-linear relationship.";
      }

      const lo = Math.min.apply(null, v), hi = Math.max.apply(null, v);
      plot.set({
        ymin: Math.min(-1, lo - 2), ymax: hi + 3,
        curves: [],
        points: v.map((y, i) => ({ x: i + 1, y, color: "c1", r: 5 })),
      });
    }
    upd();
  };

  /* 7 · Intersection explorer — curve + movable line, with the algebra */
  build.interlab = function (host) {
    const CURVES = [
      { label: "y = x²", f: (x) => x * x, alg: (m, c) => "x² " + (m ? (m > 0 ? MINUS + " " + fmt(m) : "+ " + fmt(-m)) + "x " : "") + (c > 0 ? MINUS + " " + fmt(c) : c < 0 ? "+ " + fmt(-c) : "") + " = 0", view: { xmin: -4, xmax: 4, ymin: -3, ymax: 10 } },
      { label: "y = x² − 4x + 5", f: (x) => x * x - 4 * x + 5, view: { xmin: -1, xmax: 6, ymin: -2, ymax: 9 } },
      { label: "y = 4/x", f: (x) => 4 / x, view: { xmin: -7, xmax: 7, ymin: -7, ymax: 7 }, asym: true },
      { label: "y = x³ − 4x", f: (x) => x * x * x - 4 * x, view: { xmin: -3.2, xmax: 3.2, ymin: -8, ymax: 8 } },
      { label: "y = 2ˣ", f: (x) => Math.pow(2, x), view: { xmin: -4, xmax: 4, ymin: -2, ymax: 10 }, asym0: true },
    ];
    const st = { i: 0, m: 1, c: 2 };

    const panel = e("div", "gl-panel");
    const chips = chipRow(CURVES.map((c) => ({ label: c.label })), (it, i) => { st.i = i; upd(true); }, 0);
    const eqn = e("div", "gl-eq");
    const controls = e("div", "gl-controls");
    const cvBox = e("div", "gl-canvas");
    const cv = document.createElement("canvas");
    cvBox.appendChild(cv);
    const verdict = e("div", "gl-msg");
    const facts = e("div", "gl-facts");
    const n = factRow("How many solutions?", "");
    const pairs = factRow("Solution pairs", "");
    const meaning = factRow("What it means", "");
    [n, pairs, meaning].forEach((r) => facts.appendChild(r));

    const sm = slider("gradient m", -4, 4, 0.25, st.m, (v) => { st.m = v; upd(); });
    const sc = slider("intercept c", -8, 8, 0.25, st.c, (v) => { st.c = v; upd(); });
    controls.appendChild(sm.el); controls.appendChild(sc.el);

    panel.appendChild(chips.el);
    panel.appendChild(eqn);
    panel.appendChild(controls);
    panel.appendChild(cvBox);
    panel.appendChild(verdict);
    panel.appendChild(facts);
    host.appendChild(panel);

    const plot = new Plot(cv, Object.assign({ trace: true }, CURVES[0].view));

    function lineText(m, c) {
      if (m === 0) return "y = " + fmt(c);
      const mt = m === 1 ? "x" : m === -1 ? MINUS + "x" : fmt(m) + "x";
      return "y = " + mt + (c === 0 ? "" : (c > 0 ? " + " : " " + MINUS + " ") + fmt(Math.abs(c)));
    }

    function upd(reset) {
      const cu = CURVES[st.i];
      if (reset) plot.set(cu.view);
      const g = (x) => st.m * x + st.c;
      const v = cu.view;
      eqn.textContent = cu.label + "     and     " + lineText(st.m, st.c);
      const hits = crossings(cu.f, g, v.xmin, v.xmax, 0.03);
      const pts = hits.map((h) => ({
        x: h.x, y: g(h.x), color: "c5",
        label: "(" + fmt(h.x, 1) + ", " + fmt(g(h.x), 1) + ")", dy: -10,
      }));
      plot.set({
        curves: [{ f: cu.f, color: "c1" }, { f: g, color: "c2", width: 2, trace: false }],
        points: pts,
        guides: cu.asym ? [{ x: 0 }, { y: 0 }] : cu.asym0 ? [{ y: 0 }] : [],
      });
      const touch = hits.length === 1 && hits[0].kind === "touch";
      n.setValue(hits.length === 0 ? "0 — no real solutions" : touch ? "1 repeated solution" : hits.length + (hits.length === 1 ? " solution" : " solution pairs"));
      pairs.setValue(hits.length
        ? hits.map((h) => "x = " + fmt(h.x, 1) + ", y = " + fmt(g(h.x), 1)).join("     ")
        : "—");
      meaning.setValue(hits.length
        ? "Each crossing point satisfies BOTH equations, so its coordinates are one solution pair."
        : "The graphs never meet, so no pair of values satisfies both equations.");
      if (touch) {
        verdict.className = "gl-msg warn";
        verdict.textContent = "Tangent! The line just touches the curve — the resulting quadratic has a repeated root (discriminant = 0).";
      } else if (hits.length) {
        verdict.className = "gl-msg good";
        verdict.textContent = "Give answers in pairs — keep each x with its own y. Never mix them up.";
      } else {
        verdict.className = "gl-msg bad";
        verdict.textContent = "No intersection → the simultaneous equations have no real solution.";
      }
    }
    upd(true);
  };

  /* 8 · Tangent challenge — slide c until the line just touches */
  build.tangentlab = function (host) {
    const f = (x) => x * x - 4 * x + 5;   // minimum at (2, 1)
    const st = { c: 4 };
    const panel = e("div", "gl-panel");
    panel.appendChild(html("div", "gl-prompt",
      "<b>Challenge.</b> The curve is y = x² − 4x + 5. Slide the horizontal line y = c until it <b>just touches</b> the curve — the discriminant meter tells you how close you are."));
    const controls = e("div", "gl-controls");
    const cvBox = e("div", "gl-canvas");
    const cv = document.createElement("canvas");
    cvBox.appendChild(cv);
    const meterWrap = e("div", "gl-meter");
    const fill = e("div", "gl-meter-fill");
    meterWrap.appendChild(fill);
    const msg = e("div", "gl-msg");
    const algebra = e("div", "gl-algebra");

    const sc = slider("c", -2, 8, 0.25, st.c, (v) => { st.c = v; upd(); });
    controls.appendChild(sc.el);
    panel.appendChild(controls);
    panel.appendChild(cvBox);
    panel.appendChild(meterWrap);
    panel.appendChild(msg);
    panel.appendChild(algebra);
    host.appendChild(panel);

    const plot = new Plot(cv, { xmin: -1, xmax: 5, ymin: -2, ymax: 9, trace: true });

    function upd() {
      const c = st.c;
      const g = () => c;
      // x² − 4x + 5 = c  →  x² − 4x + (5 − c) = 0, D = 16 − 4(5−c) = 4c − 4
      const D = 4 * c - 4;
      const hits = crossings(f, g, -1, 5, 0.02);
      plot.set({
        curves: [{ f, color: "c1" }, { f: g, color: "c2", width: 2, dash: true, trace: false }],
        points: hits.map((h) => ({ x: h.x, y: c, color: "c5", label: "x = " + fmt(h.x, 1), dy: -10 })),
      });
      const p = Math.max(0, Math.min(100, 100 - Math.min(100, Math.abs(D) * 12)));
      fill.style.width = p + "%";
      fill.style.background = Math.abs(D) < 0.001 ? "var(--good, #16a34a)" : Math.abs(D) < 2 ? "#f5a623" : "var(--bad, #dc2626)";
      algebra.innerHTML =
        "x² − 4x + 5 = " + fmt(c) + " → x² − 4x + (" + fmt(5 - c) + ") = 0" +
        "<br>Discriminant D = b² − 4ac = 16 − 4(" + fmt(5 - c) + ") = <b>" + fmt(D) + "</b>";
      if (Math.abs(D) < 0.001) {
        msg.className = "gl-msg good";
        msg.textContent = "Perfect — c = 1. The line is a tangent at the minimum (2, 1): one repeated solution, D = 0.";
      } else if (D < 0) {
        msg.className = "gl-msg bad";
        msg.textContent = "D < 0 — the line passes below the curve. No real solutions. Raise c.";
      } else {
        msg.className = "gl-msg warn";
        msg.textContent = "D > 0 — the line cuts the curve twice. Lower c until the two crossings merge into one.";
      }
    }
    upd();
  };

  /* 9 · Family of curves — toggle the four standard shapes */
  build.familylab = function (host) {
    const FAM = [
      { label: "Quadratic  y = x² − 2", f: (x) => x * x - 2, key: "c1", on: true,
        note: "Parabola — one turning point, symmetrical, highest power 2." },
      { label: "Cubic  y = ½x³", f: (x) => 0.5 * x * x * x, key: "c3", on: true,
        note: "S-shape — opposite ends go opposite ways, up to 2 turning points." },
      { label: "Reciprocal  y = 3/x", f: (x) => 3 / x, key: "c2", on: true,
        note: "Two branches, asymptotes x = 0 and y = 0, never crosses either axis." },
      { label: "Exponential  y = 2ˣ", f: (x) => Math.pow(2, x), key: "c4", on: true,
        note: "Always positive, passes through (0, 1), asymptote y = 0." },
    ];
    const panel = e("div", "gl-panel");
    const row = e("div", "gl-chips");
    const cvBox = e("div", "gl-canvas");
    const cv = document.createElement("canvas");
    cvBox.appendChild(cv);
    const note = e("div", "gl-msg");
    const P = pal();
    const btns = FAM.map((fam, i) => {
      const b = e("button", "gl-chip on", fam.label);
      b.type = "button";
      b.style.setProperty("--chip-c", P[fam.key]);
      b.addEventListener("click", () => {
        fam.on = !fam.on;
        b.classList.toggle("on", fam.on);
        note.className = "gl-msg" + (fam.on ? " good" : "");
        note.textContent = fam.on ? fam.note : "";
        upd();
      });
      row.appendChild(b);
      return b;
    });
    panel.appendChild(row);
    panel.appendChild(cvBox);
    panel.appendChild(note);
    host.appendChild(panel);
    note.textContent = "Tap a name to show or hide that curve — compare the shapes on one set of axes.";

    const plot = new Plot(cv, { xmin: -4, xmax: 4, ymin: -6, ymax: 9, trace: true });
    function upd() {
      plot.set({
        curves: FAM.filter((f) => f.on).map((f) => ({ f: f.f, color: f.key })),
        guides: FAM[2].on ? [{ x: 0 }, { y: 0 }] : [],
      });
    }
    upd();
  };

  /* 10 · Match the equation to its graph */
  build.matchlab = function (host) {
    const CARDS = [
      { eq: "y = x² − 3", f: (x) => x * x - 3, why: "Highest power 2 → parabola." },
      { eq: "y = x³ − 4x", f: (x) => x * x * x - 4 * x, why: "Highest power 3 → S-shaped cubic with three roots." },
      { eq: "y = 4/x", f: (x) => 4 / x, why: "x on the bottom → two hyperbola branches." },
      { eq: "y = 2ˣ", f: (x) => Math.pow(2, x), why: "x in the power → exponential through (0, 1)." },
      { eq: "y = 2x + 1", f: (x) => 2 * x + 1, why: "Highest power 1 → straight line." },
      { eq: "y = 6 − x²", f: (x) => 6 - x * x, why: "Negative x² → parabola opening downwards." },
    ];
    let order = CARDS.map((_, i) => i);
    let picked = null, done = 0, wrong = 0;

    const panel = e("div", "gl-panel");
    const lead = html("div", "gl-prompt", "<b>Match them up.</b> Click an equation, then click the graph it belongs to.");
    const eqRow = e("div", "gl-chips wrap");
    const grid = e("div", "gl-grid");
    const msg = e("div", "gl-msg");
    const again = e("button", "gl-btn ghost", "↻ Shuffle and play again");
    again.type = "button";
    panel.appendChild(lead);
    panel.appendChild(eqRow);
    panel.appendChild(grid);
    panel.appendChild(msg);
    panel.appendChild(again);
    host.appendChild(panel);

    function start() {
      picked = null; done = 0; wrong = 0;
      order = CARDS.map((_, i) => i).sort(() => Math.random() - 0.5);
      eqRow.replaceChildren();
      grid.replaceChildren();
      msg.className = "gl-msg";
      msg.textContent = "";
      const eqBtns = CARDS.map((c, i) => {
        const b = e("button", "gl-chip", c.eq);
        b.type = "button";
        b.addEventListener("click", () => {
          if (b.classList.contains("used")) return;
          eqBtns.forEach((x) => x.classList.remove("on"));
          b.classList.add("on");
          picked = { i, b };
        });
        eqRow.appendChild(b);
        return b;
      });
      order.forEach((ci) => {
        const cell = e("div", "gl-cell-plot");
        const cv = document.createElement("canvas");
        const box = e("div", "gl-canvas mini");
        box.appendChild(cv);
        cell.appendChild(box);
        grid.appendChild(cell);
        new Plot(cv, {
          xmin: -4, xmax: 4, ymin: -7, ymax: 8, ratio: 0.8, minH: 130, maxH: 190,
          stepx: 2, stepy: 2,
          curves: [{ f: CARDS[ci].f, color: "c1" }],
        });
        cell.addEventListener("click", () => {
          if (cell.classList.contains("solved") || !picked) return;
          if (picked.i === ci) {
            cell.classList.add("solved");
            cell.appendChild(e("div", "gl-tick", CARDS[ci].eq));
            picked.b.classList.add("used");
            picked.b.classList.remove("on");
            picked = null;
            done++;
            msg.className = "gl-msg good";
            msg.textContent = CARDS[ci].why + (done === CARDS.length ? "  — all matched! Mistakes: " + wrong : "");
          } else {
            wrong++;
            cell.classList.add("shake");
            setTimeout(() => cell.classList.remove("shake"), 400);
            msg.className = "gl-msg bad";
            msg.textContent = "Not that one — count the highest power of x and look at the ends of the curve.";
          }
        });
      });
    }
    again.addEventListener("click", start);
    start();
  };

  /* 11 · Domain & range explorer */
  build.domlab = function (host) {
    const FUNCS = [
      { label: "y = x²", f: (x) => x * x, view: { xmin: -5, xmax: 5, ymin: -2, ymax: 12 }, restrict: true },
      { label: "y = 3x − 1", f: (x) => 3 * x - 1, view: { xmin: -5, xmax: 5, ymin: -8, ymax: 8 }, restrict: true },
      { label: "y = 4/x", f: (x) => 4 / x, view: { xmin: -7, xmax: 7, ymin: -7, ymax: 7 },
        fixed: { d: "x ≠ 0", r: "y ≠ 0", why: "You cannot divide by zero, and the curve never reaches the x-axis." } },
      { label: "y = 2ˣ", f: (x) => Math.pow(2, x), view: { xmin: -4, xmax: 4, ymin: -2, ymax: 10 },
        fixed: { d: "all real x", r: "y > 0", why: "Every power of 2 is positive — the curve stays above its asymptote y = 0." } },
      { label: "y = √x", f: (x) => (x < 0 ? NaN : Math.sqrt(x)), view: { xmin: -3, xmax: 9, ymin: -2, ymax: 5 },
        fixed: { d: "x ≥ 0", r: "y ≥ 0", why: "No real square root of a negative number." } },
    ];
    const st = { i: 0, lo: -1, hi: 3 };

    const panel = e("div", "gl-panel");
    const chips = chipRow(FUNCS.map((f) => ({ label: f.label })), (it, i) => { st.i = i; upd(true); }, 0);
    const controls = e("div", "gl-controls");
    const cvBox = e("div", "gl-canvas");
    const cv = document.createElement("canvas");
    cvBox.appendChild(cv);
    const facts = e("div", "gl-facts");
    const dm = factRow("Domain", "");
    const rg = factRow("Range", "");
    const why = factRow("Why", "");
    [dm, rg, why].forEach((r) => facts.appendChild(r));

    const slo = slider("domain from", -5, 5, 0.5, st.lo, (v) => { st.lo = v; if (st.lo > st.hi) { st.hi = st.lo; shi.set(st.hi); } upd(); });
    const shi = slider("domain to", -5, 5, 0.5, st.hi, (v) => { st.hi = v; if (st.hi < st.lo) { st.lo = st.hi; slo.set(st.lo); } upd(); });
    controls.appendChild(slo.el); controls.appendChild(shi.el);

    panel.appendChild(chips.el);
    panel.appendChild(controls);
    panel.appendChild(cvBox);
    panel.appendChild(facts);
    host.appendChild(panel);

    const plot = new Plot(cv, Object.assign({ trace: true }, FUNCS[0].view));

    function upd(reset) {
      const fn = FUNCS[st.i];
      if (reset) plot.set(fn.view);
      controls.style.display = fn.restrict ? "" : "none";
      if (!fn.restrict) {
        plot.set({
          curves: [{ f: fn.f, color: "c1" }], bands: [], points: [],
          guides: fn.label.indexOf("4/x") >= 0 ? [{ x: 0 }, { y: 0 }] : fn.label.indexOf("2") === 4 ? [{ y: 0 }] : [],
        });
        dm.setValue(fn.fixed.d);
        rg.setValue(fn.fixed.r);
        why.setValue(fn.fixed.why);
        return;
      }
      // sample the restricted piece to find the real range (turning points included)
      let lo = Infinity, hi = -Infinity, ylo = 0, yhi = 0;
      for (let i = 0; i <= 400; i++) {
        const x = st.lo + ((st.hi - st.lo) * i) / 400;
        const y = fn.f(x);
        if (y < lo) { lo = y; ylo = x; }
        if (y > hi) { hi = y; yhi = x; }
      }
      plot.set({
        curves: [{ f: fn.f, color: "c1" }],
        bands: [
          { axis: "x", from: st.lo, to: st.hi, color: "soft" },
          { axis: "y", from: lo, to: hi, color: "soft2" },
        ],
        points: [
          { x: st.lo, y: fn.f(st.lo), color: "c2", r: 4.5 },
          { x: st.hi, y: fn.f(st.hi), color: "c2", r: 4.5 },
          { x: ylo, y: lo, color: "c3", r: 4.5, label: "min " + fmt(lo), dy: 16 },
          { x: yhi, y: hi, color: "c3", r: 4.5, label: "max " + fmt(hi), dy: -10 },
        ],
      });
      dm.setValue(fmt(st.lo) + " ≤ x ≤ " + fmt(st.hi) + "   (blue band, read left–right)");
      rg.setValue(fmt(lo) + " ≤ y ≤ " + fmt(hi) + "   (green band, read bottom–top)");
      const inside = fn.label === "y = x²" && st.lo < 0 && st.hi > 0;
      why.setValue(inside
        ? "The turning point (0, 0) lies INSIDE the domain, so the minimum comes from the vertex — not from an endpoint."
        : "No turning point inside this domain, so the smallest and largest y-values are at the endpoints.");
    }
    upd(true);
  };

  /* 12 · Markup-driven self-check quiz */
  build.quiz = function (host) {
    const qs = [...host.querySelectorAll(".gl-q")];
    const tally = e("div", "gl-score-bar");
    let asked = 0, right = 0;
    const update = () => (tally.textContent = "Score: " + right + " / " + asked + " answered");
    qs.forEach((q) => {
      const ans = q.dataset.answer;
      const why = q.dataset.why || "";
      const opts = [...q.querySelectorAll("li")];
      const fb = e("div", "gl-msg");
      q.appendChild(fb);
      let locked = false;
      opts.forEach((li) => {
        li.setAttribute("role", "button");
        li.tabIndex = 0;
        li.classList.add("gl-opt");
        const pick = () => {
          if (locked) return;
          locked = true;
          asked++;
          const ok = li.dataset.k === ans;
          if (ok) { right++; li.classList.add("ok"); }
          else {
            li.classList.add("bad");
            const good = opts.find((o) => o.dataset.k === ans);
            if (good) good.classList.add("ok");
          }
          fb.className = "gl-msg " + (ok ? "good" : "bad");
          fb.textContent = (ok ? "Correct. " : "Not quite. ") + why;
          update();
        };
        li.addEventListener("click", pick);
        li.addEventListener("keydown", (ev) => { if (ev.key === "Enter" || ev.key === " ") { ev.preventDefault(); pick(); } });
      });
    });
    host.appendChild(tally);
    update();
  };

  // ---------- shared form helpers for the calculator-style labs ----------

  const num = (v) => parseFloat(String(v).replace(/−/g, "-").trim());

  function field(label, val, width, onInput) {
    const wrap = e("label", "gl-field");
    wrap.appendChild(e("span", "gl-field-name", label));
    const input = document.createElement("input");
    input.type = "text";
    input.inputMode = "decimal";
    input.className = "gl-cell" + (width === "wide" ? " wide" : "");
    if (val != null) input.value = val;
    if (onInput) input.addEventListener("input", onInput);
    wrap.appendChild(input);
    return { el: wrap, input, get: () => num(input.value), set: (v) => { input.value = v; } };
  }

  function picker(label, options, onChange) {
    const wrap = e("label", "gl-field");
    if (label) wrap.appendChild(e("span", "gl-field-name", label));
    const sel = document.createElement("select");
    sel.className = "gl-select";
    options.forEach((o) => {
      const opt = document.createElement("option");
      opt.value = o.value != null ? o.value : o;
      opt.textContent = o.label != null ? o.label : o;
      sel.appendChild(opt);
    });
    if (onChange) sel.addEventListener("change", onChange);
    wrap.appendChild(sel);
    return { el: wrap, sel, get: () => sel.value };
  }

  /* 13 · Speed–distance–time calculator */
  build.sdtlab = function (host) {
    const panel = e("div", "gl-panel");
    const modes = [
      { key: "speed", label: "Find the speed" },
      { key: "distance", label: "Find the distance" },
      { key: "time", label: "Find the time" },
    ];
    let mode = "speed";

    const chips = chipRow(modes, (it) => { mode = it.key; layout(); }, 0);
    const form = e("div", "gl-form");
    const out = e("div", "gl-algebra");
    const msg = e("div", "gl-msg");

    const dVal = field("Distance", "315", null, calc);
    const dUnit = picker("", [{ value: "km", label: "km" }, { value: "m", label: "m" }], calc);
    const th = field("Time — hours", "2", null, calc);
    const tm = field("minutes", "30", null, calc);
    const ts = field("seconds", "0", null, calc);
    const sVal = field("Speed", "60", null, calc);
    const sUnit = picker("", [{ value: "kmh", label: "km/h" }, { value: "ms", label: "m/s" }], calc);

    panel.appendChild(chips.el);
    panel.appendChild(form);
    panel.appendChild(out);
    panel.appendChild(msg);
    host.appendChild(panel);

    function group(title, items) {
      const g = e("div", "gl-form-group");
      g.appendChild(e("div", "gl-form-title", title));
      const row = e("div", "gl-form-row");
      items.forEach((i) => row.appendChild(i));
      g.appendChild(row);
      return g;
    }

    function layout() {
      form.replaceChildren();
      if (mode !== "distance") form.appendChild(group("Distance travelled", [dVal.el, dUnit.el]));
      if (mode !== "time") form.appendChild(group("Time taken", [th.el, tm.el, ts.el]));
      if (mode !== "speed") form.appendChild(group("Speed", [sVal.el, sUnit.el]));
      calc();
    }

    function calc() {
      const metres = dVal.get() * (dUnit.get() === "km" ? 1000 : 1);
      const secs = (th.get() || 0) * 3600 + (tm.get() || 0) * 60 + (ts.get() || 0);
      const ms = sVal.get() * (sUnit.get() === "kmh" ? 1 / 3.6 : 1);
      const hhmm = (t) => {
        const h = Math.floor(t / 3600), m = Math.floor((t % 3600) / 60), s = Math.round(t % 60);
        return (h ? h + " h " : "") + (m ? m + " min " : "") + (s || (!h && !m) ? s + " s" : "");
      };
      msg.className = "gl-msg";
      if (mode === "speed") {
        if (!isFinite(metres) || !isFinite(secs) || secs <= 0) {
          msg.className = "gl-msg warn";
          msg.textContent = "Enter a distance and a time greater than zero.";
          out.textContent = ""; return;
        }
        const v = metres / secs;
        out.innerHTML =
          "speed = distance ÷ time" +
          "<br>time = " + fmt(secs / 3600, 4).replace(/0+$/, "") + " h = " + fmt(secs) + " s" +
          "<br><b>= " + fmt(v * 3.6) + " km/h &nbsp;=&nbsp; " + fmt(v) + " m/s</b>";
        msg.className = "gl-msg good";
        msg.textContent = "Cover S on the triangle: D is above T, so you divide.";
      } else if (mode === "distance") {
        if (!isFinite(ms) || !isFinite(secs)) { msg.className = "gl-msg warn"; msg.textContent = "Enter a speed and a time."; out.textContent = ""; return; }
        const d = ms * secs;
        out.innerHTML =
          "distance = speed × time" +
          "<br>= " + fmt(ms) + " m/s × " + fmt(secs) + " s" +
          "<br><b>= " + fmt(d) + " m &nbsp;=&nbsp; " + fmt(d / 1000) + " km</b>";
        msg.className = "gl-msg good";
        msg.textContent = "Cover D: S and T sit side by side, so you multiply.";
      } else {
        if (!isFinite(ms) || ms <= 0 || !isFinite(metres)) { msg.className = "gl-msg warn"; msg.textContent = "Enter a distance and a speed greater than zero."; out.textContent = ""; return; }
        const t = metres / ms;
        out.innerHTML =
          "time = distance ÷ speed" +
          "<br>= " + fmt(metres) + " m ÷ " + fmt(ms) + " m/s" +
          "<br><b>= " + fmt(t) + " s = " + hhmm(t) + " = " + fmt(t / 3600) + " h</b>";
        msg.className = "gl-msg good";
        msg.textContent = "Remember: 2 h 30 min is 2.5 h, never 2.30.";
      }
    }
    layout();
  };

  /* 14 · Distance–time journey builder */
  build.journeylab = function (host) {
    const st = { v1: 50, t1: 2, stop: 1, v2: 50 };
    const panel = e("div", "gl-panel");
    const controls = e("div", "gl-controls");
    const cvBox = e("div", "gl-canvas");
    const cv = document.createElement("canvas");
    cvBox.appendChild(cv);
    const facts = e("div", "gl-facts");
    const fOut = factRow("Outward leg", "");
    const fStop = factRow("Middle section", "");
    const fBack = factRow("Return leg", "");
    const fTot = factRow("Total distance travelled", "");
    const fAvg = factRow("Average speed (total ÷ total)", "");
    [fOut, fStop, fBack, fTot, fAvg].forEach((r) => facts.appendChild(r));
    const msg = e("div", "gl-msg");

    const s1 = slider("outward speed (km/h)", 10, 100, 5, st.v1, (v) => { st.v1 = v; upd(); });
    const s2 = slider("outward time (hours)", 0.5, 4, 0.5, st.t1, (v) => { st.t1 = v; upd(); });
    const s3 = slider("stop length (hours)", 0, 3, 0.5, st.stop, (v) => { st.stop = v; upd(); });
    const s4 = slider("return speed (km/h)", 10, 100, 5, st.v2, (v) => { st.v2 = v; upd(); });
    [s1, s2, s3, s4].forEach((s) => controls.appendChild(s.el));

    panel.appendChild(controls);
    panel.appendChild(cvBox);
    panel.appendChild(msg);
    panel.appendChild(facts);
    host.appendChild(panel);

    const plot = new Plot(cv, { xmin: 0, xmax: 6, ymin: 0, ymax: 120, xlab: "Time (hours)", ylab: "Distance from home (km)", trace: true });

    function upd() {
      const D = st.v1 * st.t1;
      const tBack = D / st.v2;
      const T = st.t1 + st.stop + tBack;
      const f = (t) => {
        if (t <= st.t1) return st.v1 * t;
        if (t <= st.t1 + st.stop) return D;
        return Math.max(0, D - st.v2 * (t - st.t1 - st.stop));
      };
      const xmax = Math.max(1, Math.ceil(T * 2) / 2);
      const ymax = Math.max(20, Math.ceil(D / 20) * 20 + 20);
      plot.set({
        xmin: 0, xmax, ymin: 0, ymax,
        curves: [{ f, color: "c1", from: 0, to: T }],
        points: [
          { x: st.t1, y: D, color: "c2", r: 4.5 },
          { x: st.t1 + st.stop, y: D, color: "c2", r: 4.5 },
          { x: T, y: 0, color: "c3", r: 4.5 },
        ],
      });
      fOut.setValue(fmt(D) + " km in " + fmt(st.t1) + " h → gradient = " + fmt(st.v1) + " km/h");
      fStop.setValue(st.stop === 0
        ? "no stop — the traveller turns straight round"
        : "flat for " + fmt(st.stop) + " h → gradient 0, so STOPPED (not steady speed)");
      fBack.setValue(fmt(D) + " km back in " + fmt(tBack) + " h → gradient = " + MINUS + fmt(st.v2) + " km/h (the sign only shows direction)");
      fTot.setValue(fmt(2 * D) + " km  in a total time of " + fmt(T) + " h");
      fAvg.setValue(fmt((2 * D) / T) + " km/h");
      if (st.stop > 0) {
        msg.className = "gl-msg warn";
        msg.textContent = "The average speed (" + fmt((2 * D) / T) + " km/h) is lower than either travelling speed, because the stopped time still counts in the total time.";
      } else {
        msg.className = "gl-msg good";
        msg.textContent = "With no stop the average speed sits between the two travelling speeds.";
      }
    }
    upd();
  };

  /* 15 · Speed–time graph builder — gradient is acceleration, area is distance */
  build.stlab = function (host) {
    const st = { v: 20, ta: 10, tc: 30, td: 20 };
    const panel = e("div", "gl-panel");
    const controls = e("div", "gl-controls");
    const cvBox = e("div", "gl-canvas");
    const cv = document.createElement("canvas");
    cvBox.appendChild(cv);
    const facts = e("div", "gl-facts");
    const fa = factRow("Acceleration (first section)", "");
    const fd = factRow("Deceleration (last section)", "");
    const fpieces = factRow("Area, piece by piece", "");
    const ftot = factRow("Total distance = total area", "");
    const ftrap = factRow("Check as one trapezium", "");
    [fa, fd, fpieces, ftot, ftrap].forEach((r) => facts.appendChild(r));
    const msg = html("div", "gl-msg", "");

    const sv = slider("top speed (m/s)", 5, 40, 5, st.v, (v) => { st.v = v; upd(); });
    const sa = slider("time speeding up (s)", 2, 30, 2, st.ta, (v) => { st.ta = v; upd(); });
    const sc = slider("time at constant speed (s)", 0, 40, 5, st.tc, (v) => { st.tc = v; upd(); });
    const sd = slider("time slowing down (s)", 2, 40, 2, st.td, (v) => { st.td = v; upd(); });
    [sv, sa, sc, sd].forEach((s) => controls.appendChild(s.el));

    panel.appendChild(controls);
    panel.appendChild(cvBox);
    panel.appendChild(msg);
    panel.appendChild(facts);
    host.appendChild(panel);

    const plot = new Plot(cv, { xmin: 0, xmax: 60, ymin: 0, ymax: 25, xlab: "Time (s)", ylab: "Speed (m/s)", trace: true });

    function upd() {
      const { v, ta, tc, td } = st;
      const T = ta + tc + td;
      const f = (t) => {
        if (t <= ta) return (v * t) / ta;
        if (t <= ta + tc) return v;
        if (t <= T) return v - (v * (t - ta - tc)) / td;
        return 0;
      };
      const A1 = 0.5 * ta * v, A2 = tc * v, A3 = 0.5 * td * v;
      plot.set({
        xmin: 0, xmax: Math.ceil(T / 10) * 10 || 10, ymin: 0, ymax: Math.ceil((v * 1.25) / 5) * 5,
        curves: [{ f, color: "c1", from: 0, to: T }],
        fills: [{ f, from: 0, to: T, color: "soft" }],
        points: [{ x: ta, y: v, color: "c2", r: 4.5 }, { x: ta + tc, y: v, color: "c2", r: 4.5 }],
      });
      fa.setValue("(" + fmt(v) + " − 0) ÷ " + fmt(ta) + " = " + fmt(v / ta) + " m/s²");
      fd.setValue("(0 − " + fmt(v) + ") ÷ " + fmt(td) + " = " + MINUS + fmt(v / td) + " m/s², i.e. a deceleration of " + fmt(v / td) + " m/s²");
      fpieces.setValue("triangle ½×" + fmt(ta) + "×" + fmt(v) + " = " + fmt(A1) + " m · rectangle " + fmt(tc) + "×" + fmt(v) + " = " + fmt(A2) + " m · triangle ½×" + fmt(td) + "×" + fmt(v) + " = " + fmt(A3) + " m");
      ftot.setValue(fmt(A1) + " + " + fmt(A2) + " + " + fmt(A3) + " = " + fmt(A1 + A2 + A3) + " m");
      ftrap.setValue("½(" + fmt(tc) + " + " + fmt(T) + ") × " + fmt(v) + " = " + fmt(0.5 * (tc + T) * v) + " m ✔");
      msg.className = "gl-msg good";
      msg.innerHTML = "<b>Gradient = acceleration. Area = distance.</b> The shaded region is the " + fmt(A1 + A2 + A3) + " m travelled — reading the gradient when the question wants distance is the classic error here.";
    }
    upd();
  };

  /* 16 · Is it direct proportion? — ratio checker */
  build.proplab = function (host) {
    const SETS = [
      { name: "A", xs: [2, 4, 6, 8], ys: [7, 14, 21, 28] },
      { name: "B", xs: [2, 4, 6, 8], ys: [9, 15, 21, 27] },
      { name: "C", xs: [1, 2, 5, 10], ys: [2.5, 5, 12.5, 25] },
    ];
    const panel = e("div", "gl-panel");
    const lead = e("div", "gl-eq", "Type the pairs, then read the y ÷ x row");
    const scroll = e("div", "gl-scroll");
    const bar = e("div", "gl-bar");
    const verdict = e("div", "gl-msg");
    const cvBox = e("div", "gl-canvas");
    const cv = document.createElement("canvas");
    cvBox.appendChild(cv);

    const table = e("table", "gl-table");
    scroll.appendChild(table);
    const chips = chipRow(SETS.map((s) => ({ label: "Set " + s.name })), (it, i) => load(SETS[i]), 0);
    bar.appendChild(chips.el);

    panel.appendChild(lead);
    panel.appendChild(scroll);
    panel.appendChild(bar);
    panel.appendChild(verdict);
    panel.appendChild(cvBox);
    host.appendChild(panel);

    const plot = new Plot(cv, { xmin: 0, xmax: 10, ymin: 0, ymax: 30, xlab: "x", ylab: "y", ratio: 0.55 });
    let xin = [], yin = [];

    function render(set) {
      table.replaceChildren();
      const r1 = e("tr"), r2 = e("tr"), r3 = e("tr");
      r1.appendChild(e("th", null, "x"));
      r2.appendChild(e("th", null, "y"));
      r3.appendChild(e("th", null, "y ÷ x"));
      xin = []; yin = [];
      set.xs.forEach((x, i) => {
        const mk = (v, store) => {
          const td = e("td");
          const inp = document.createElement("input");
          inp.type = "text"; inp.inputMode = "decimal"; inp.className = "gl-cell"; inp.value = v;
          inp.addEventListener("input", upd);
          td.appendChild(inp);
          store.push(inp);
          return td;
        };
        r1.appendChild(mk(x, xin));
        r2.appendChild(mk(set.ys[i], yin));
        r3.appendChild(e("td", "gl-ratio", ""));
      });
      table.appendChild(r1); table.appendChild(r2); table.appendChild(r3);
      upd();
    }
    const load = (set) => render(set);

    function upd() {
      const xs = xin.map((i) => num(i.value));
      const ys = yin.map((i) => num(i.value));
      if (xs.some((v) => !isFinite(v)) || ys.some((v) => !isFinite(v))) {
        verdict.className = "gl-msg warn";
        verdict.textContent = "Fill in every box with a number.";
        return;
      }
      const ratios = xs.map((x, i) => (x === 0 ? NaN : ys[i] / x));
      const cells = table.querySelectorAll(".gl-ratio");
      const same = ratios.every((r) => isFinite(r) && Math.abs(r - ratios[0]) < 1e-9);
      ratios.forEach((r, i) => {
        cells[i].textContent = isFinite(r) ? fmt(r, 3) : "—";
        cells[i].classList.toggle("gl-td-ok", same);
      });
      const k = ratios[0];
      const lo = Math.min.apply(null, ys), hi = Math.max.apply(null, ys);
      plot.set({
        xmax: Math.max.apply(null, xs) * 1.2 || 10,
        ymax: Math.max(hi * 1.25, 5),
        curves: same ? [{ f: (x) => k * x, color: "c3" }] : [],
        points: xs.map((x, i) => ({ x, y: ys[i], color: same ? "c3" : "c5", r: 5 })),
      });
      if (same) {
        verdict.className = "gl-msg good";
        verdict.textContent = "y ÷ x is always " + fmt(k, 3) + " → DIRECT PROPORTION, y = " + fmt(k, 3) + "x. The graph is a straight line through the origin.";
      } else {
        const d = ys.map((y, i) => (i ? y - ys[i - 1] : null)).slice(1);
        const dx = xs.map((x, i) => (i ? x - xs[i - 1] : null)).slice(1);
        const linear = d.every((v, i) => Math.abs(v / dx[i] - d[0] / dx[0]) < 1e-9);
        verdict.className = "gl-msg bad";
        verdict.textContent = linear
          ? "y ÷ x is not constant, so this is NOT proportional — but the steps are even, so it is still linear (a straight line that misses the origin)."
          : "y ÷ x is not constant, so this is not direct proportion.";
      }
    }
    render(SETS[0]);
  };

  /* 17 · Proportion explorer — every form of y ∝ … */
  build.proportionlab = function (host) {
    const TYPES = [
      { label: "y ∝ x", eq: "y = kx", g: (x) => x, test: "y ÷ x", note: "x doubles → y doubles", pow: 1, inv: false },
      { label: "y ∝ x²", eq: "y = kx²", g: (x) => x * x, test: "y ÷ x²", note: "x doubles → y × 4", pow: 2, inv: false },
      { label: "y ∝ x³", eq: "y = kx³", g: (x) => x * x * x, test: "y ÷ x³", note: "x doubles → y × 8", pow: 3, inv: false },
      { label: "y ∝ √x", eq: "y = k√x", g: (x) => Math.sqrt(x), test: "y ÷ √x", note: "x × 4 → y doubles", pow: 0.5, inv: false },
      { label: "y ∝ 1/x", eq: "y = k/x", g: (x) => 1 / x, test: "x × y", note: "x doubles → y halves", pow: 1, inv: true },
      { label: "y ∝ 1/x²", eq: "y = k/x²", g: (x) => 1 / (x * x), test: "x² × y", note: "x doubles → y ÷ 4", pow: 2, inv: true },
      { label: "y ∝ 1/√x", eq: "y = k/√x", g: (x) => 1 / Math.sqrt(x), test: "√x × y", note: "x × 4 → y halves", pow: 0.5, inv: true },
    ];
    const st = { i: 0, k: 6 };
    const panel = e("div", "gl-panel");
    const chips = chipRow(TYPES.map((t) => ({ label: t.label })), (it, i) => { st.i = i; upd(); }, 0);
    const eqn = e("div", "gl-eq");
    const controls = e("div", "gl-controls");
    const cvBox = e("div", "gl-canvas");
    const cv = document.createElement("canvas");
    cvBox.appendChild(cv);
    const facts = e("div", "gl-facts");
    const fEq = factRow("Equation", "");
    const fTest = factRow("What stays constant", "");
    const fRule = factRow("Scale-factor rule", "");
    const fOrigin = factRow("Graph", "");
    [fEq, fTest, fRule, fOrigin].forEach((r) => facts.appendChild(r));
    const scroll = e("div", "gl-scroll");
    const table = e("table", "gl-table");
    scroll.appendChild(table);

    const sk = slider("k", 1, 24, 1, st.k, (v) => { st.k = v; upd(); });
    controls.appendChild(sk.el);

    panel.appendChild(chips.el);
    panel.appendChild(eqn);
    panel.appendChild(controls);
    panel.appendChild(cvBox);
    panel.appendChild(facts);
    panel.appendChild(scroll);
    host.appendChild(panel);

    const plot = new Plot(cv, { xmin: 0, xmax: 8, ymin: 0, ymax: 24, xlab: "x", ylab: "y", trace: true });
    const XS = [1, 2, 3, 4, 6, 8];

    function upd() {
      const t = TYPES[st.i], k = st.k;
      const f = (x) => (x <= 0 ? NaN : k * t.g(x));
      eqn.textContent = t.eq.replace("k", String(k));
      plot.set({
        curves: [{ f, color: t.inv ? "c2" : "c1", from: 0.05 }],
        points: XS.map((x) => ({ x, y: f(x), color: "c3", r: 4 })),
        guides: t.inv ? [{ y: 0 }] : [],
        ymax: Math.max(6, Math.min(60, Math.ceil(f(t.inv ? 1 : 8) / 6) * 6 + 6)),
      });
      fEq.setValue(t.eq + "  with k = " + k);
      fTest.setValue(t.test + " = " + k + " for every pair");
      fRule.setValue(t.note);
      fOrigin.setValue(t.inv
        ? "A curve that never touches either axis — the axes are asymptotes."
        : "Passes through the origin (0, 0): when x = 0, y = 0.");
      table.replaceChildren();
      const r1 = e("tr"), r2 = e("tr"), r3 = e("tr");
      r1.appendChild(e("th", null, "x"));
      r2.appendChild(e("th", null, "y"));
      r3.appendChild(e("th", null, t.test));
      XS.forEach((x) => {
        const y = f(x);
        r1.appendChild(e("td", "gl-td-x", fmt(x)));
        r2.appendChild(e("td", null, fmt(y, 3)));
        r3.appendChild(e("td", "gl-td-ok", fmt(k)));
      });
      table.appendChild(r1); table.appendChild(r2); table.appendChild(r3);
    }
    upd();
  };

  /* 18 · The four-step proportion solver */
  build.steplab = function (host) {
    const TYPES = [
      { label: "y ∝ x", eq: "y = kx", g: (x) => x, inv: (y, k) => y / k, sub: (a) => "k × " + fmt(a) },
      { label: "y ∝ x²", eq: "y = kx²", g: (x) => x * x, inv: (y, k) => Math.sqrt(y / k), sub: (a) => "k × " + fmt(a) + "² = k × " + fmt(a * a) },
      { label: "y ∝ √x", eq: "y = k√x", g: (x) => Math.sqrt(x), inv: (y, k) => (y / k) * (y / k), sub: (a) => "k × √" + fmt(a) + " = k × " + fmt(Math.sqrt(a), 3) },
      { label: "y ∝ 1/x", eq: "y = k/x", g: (x) => 1 / x, inv: (y, k) => k / y, sub: (a) => "k ÷ " + fmt(a) },
      { label: "y ∝ 1/x²", eq: "y = k/x²", g: (x) => 1 / (x * x), inv: (y, k) => Math.sqrt(k / y), sub: (a) => "k ÷ " + fmt(a) + "² = k ÷ " + fmt(a * a) },
    ];
    let ti = 0;
    const panel = e("div", "gl-panel");
    const chips = chipRow(TYPES.map((t) => ({ label: t.label })), (it, i) => { ti = i; upd(); }, 0);
    const form = e("div", "gl-form-row");
    const steps = e("div", "gl-steps");
    const msg = e("div", "gl-msg");

    const x1 = field("known x", "3", null, upd);
    const y1 = field("known y", "12", null, upd);
    const mode = picker("then find", [{ value: "y", label: "y from a new x" }, { value: "x", label: "x from a new y" }], upd);
    const q = field("new value", "7", null, upd);
    [x1.el, y1.el, mode.el, q.el].forEach((n) => form.appendChild(n));

    panel.appendChild(chips.el);
    panel.appendChild(form);
    panel.appendChild(steps);
    panel.appendChild(msg);
    host.appendChild(panel);

    function step(n, title, body) {
      const d = e("div", "gl-step");
      d.appendChild(e("span", "gl-step-n", "Step " + n));
      d.appendChild(html("div", "gl-step-b", "<b>" + title + "</b><br>" + body));
      return d;
    }

    function upd() {
      const t = TYPES[ti];
      const a = x1.get(), b = y1.get(), v = q.get();
      steps.replaceChildren();
      if (!isFinite(a) || !isFinite(b) || !isFinite(v) || a <= 0) {
        msg.className = "gl-msg warn";
        msg.textContent = "Enter positive numbers in all three boxes.";
        return;
      }
      const k = b / t.g(a);
      const full = t.eq.replace("k", fmt(k, 4));
      steps.appendChild(step(1, "Write the equation with k", t.eq));
      steps.appendChild(step(2, "Substitute the known pair to find k",
        "x = " + fmt(a) + ", y = " + fmt(b) + " → " + fmt(b) + " = " + t.sub(a) + " → <b>k = " + fmt(k, 4) + "</b>"));
      steps.appendChild(step(3, "Write the complete formula", "<b>" + full + "</b>"));
      if (mode.get() === "y") {
        const ans = k * t.g(v);
        steps.appendChild(step(4, "Use the formula", "x = " + fmt(v) + " → y = " + t.sub(v).replace(/k/g, fmt(k, 4)) + " = <b>" + fmt(ans, 3) + "</b>"));
        msg.className = "gl-msg good";
        msg.textContent = (t.label.indexOf("1/") >= 0
          ? "Sense check: x went " + (v > a ? "up" : "down") + ", so y should go " + (v > a ? "down" : "up") + " — and it went from " + fmt(b) + " to " + fmt(ans, 3) + "."
          : "Sense check: x went " + (v > a ? "up" : "down") + ", so y should go the same way — from " + fmt(b) + " to " + fmt(ans, 3) + ".");
      } else {
        const ans = t.inv(v, k);
        steps.appendChild(step(4, "Rearrange and solve", "y = " + fmt(v) + " → x = <b>" + fmt(ans, 3) + "</b>"));
        msg.className = "gl-msg good";
        msg.textContent = "If the working involved x², remember x = ±… but a length, mass or distance must be positive.";
      }
      steps.appendChild(step("★", "Never skip step 3", "Writing the full formula " + full + " earns marks on its own."));
    }
    upd();
  };

  /* 18b · Which relationship is it? — every constant test at once */
  build.spotlab = function (host) {
    const SETS = [
      { xs: [1, 2, 3, 4], ys: [6, 12, 18, 24], key: "direct", eq: "y = 6x" },
      { xs: [1, 2, 3, 4], ys: [24, 12, 8, 6], key: "inverse", eq: "y = 24/x" },
      { xs: [1, 2, 3, 4], ys: [5, 20, 45, 80], key: "square", eq: "y = 5x²" },
      { xs: [2, 4, 5, 8], ys: [40, 10, 6.4, 2.5], key: "invsquare", eq: "y = 160/x²" },
      { xs: [1, 2, 3, 4], ys: [3, 5, 7, 9], key: "none", eq: "y = 2x + 1 — linear, but not proportional" },
    ];
    const CHOICES = [
      { key: "direct", label: "Direct  y = kx" },
      { key: "square", label: "Direct square  y = kx²" },
      { key: "inverse", label: "Inverse  y = k/x" },
      { key: "invsquare", label: "Inverse square  y = k/x²" },
      { key: "none", label: "None of these" },
    ];
    let si = 0, revealed = false, right = 0, asked = 0;

    const panel = e("div", "gl-panel");
    const lead = e("div", "gl-eq", "Which relationship connects x and y?");
    const scroll = e("div", "gl-scroll");
    const table = e("table", "gl-table");
    scroll.appendChild(table);
    const choiceRow = e("div", "gl-chips wrap");
    const msg = e("div", "gl-msg");
    const bar = e("div", "gl-bar");
    const reveal = e("button", "gl-btn ghost", "Show every test");
    reveal.type = "button";
    const next = e("button", "gl-btn ghost", "↻ Next data set");
    next.type = "button";
    const score = e("span", "gl-score", "Score 0 / 0");
    bar.appendChild(reveal); bar.appendChild(next); bar.appendChild(score);
    const cvBox = e("div", "gl-canvas");
    const cv = document.createElement("canvas");
    cvBox.appendChild(cv);

    panel.appendChild(lead);
    panel.appendChild(scroll);
    panel.appendChild(choiceRow);
    panel.appendChild(msg);
    panel.appendChild(bar);
    panel.appendChild(cvBox);
    host.appendChild(panel);

    const plot = new Plot(cv, { xmin: 0, xmax: 9, ymin: 0, ymax: 90, xlab: "x", ylab: "y", ratio: 0.5 });

    CHOICES.forEach((ch) => {
      const b = e("button", "gl-chip", ch.label);
      b.type = "button";
      b.addEventListener("click", () => {
        if (revealed) return;
        revealed = true; asked++;
        const ok = ch.key === SETS[si].key;
        if (ok) right++;
        b.classList.add(ok ? "on" : "used");
        msg.className = "gl-msg " + (ok ? "good" : "bad");
        msg.textContent = (ok ? "Correct — " : "Not quite — the answer is " + labelOf(SETS[si].key) + ". ") + SETS[si].eq + ". Look at which test row is constant.";
        score.textContent = "Score " + right + " / " + asked;
        render(true);
      });
      choiceRow.appendChild(b);
    });
    const labelOf = (k) => (CHOICES.find((c) => c.key === k) || {}).label;

    reveal.addEventListener("click", () => { revealed = true; render(true); });
    next.addEventListener("click", () => {
      si = (si + 1) % SETS.length;
      revealed = false;
      msg.className = "gl-msg";
      msg.textContent = "Work out the tests in your head first, then pick.";
      [...choiceRow.children].forEach((b) => b.classList.remove("on", "used"));
      render(false);
    });

    function render(showTests) {
      const s = SETS[si];
      const rows = [
        ["x", s.xs.map((x) => fmt(x)), "gl-td-x"],
        ["y", s.ys.map((y) => fmt(y)), null],
      ];
      if (showTests) {
        const tests = [
          ["y ÷ x", s.xs.map((x, i) => s.ys[i] / x)],
          ["x × y", s.xs.map((x, i) => s.ys[i] * x)],
          ["y ÷ x²", s.xs.map((x, i) => s.ys[i] / (x * x))],
          ["x² × y", s.xs.map((x, i) => s.ys[i] * x * x)],
        ];
        tests.forEach((t) => {
          const same = t[1].every((v) => Math.abs(v - t[1][0]) < 1e-6);
          rows.push([t[0], t[1].map((v) => fmt(v, 3)), same ? "gl-td-ok" : null]);
        });
      }
      table.replaceChildren();
      rows.forEach((r) => {
        const tr = e("tr");
        tr.appendChild(e("th", null, r[0]));
        r[1].forEach((v) => tr.appendChild(e("td", r[2], v)));
        table.appendChild(tr);
      });
      plot.set({
        xmax: Math.max.apply(null, s.xs) * 1.25,
        ymax: Math.max.apply(null, s.ys) * 1.25,
        curves: [],
        points: s.xs.map((x, i) => ({ x, y: s.ys[i], color: "c1", r: 5 })),
      });
    }
    msg.textContent = "Work out the tests in your head first, then pick.";
    render(false);
  };

  /* 19 · The function machine */
  build.machinelab = function (host) {
    const FNS = [
      { label: "f(x) = 3x − 5", f: (x) => 3 * x - 5, words: "multiply by 3, then subtract 5", solve: (k) => [(k + 5) / 3] },
      { label: "f(x) = 2x + 1", f: (x) => 2 * x + 1, words: "multiply by 2, then add 1", solve: (k) => [(k - 1) / 2] },
      { label: "f(x) = x² − 2x", f: (x) => x * x - 2 * x, words: "square it, then subtract twice the input",
        solve: (k) => { const d = 4 + 4 * k; return d < 0 ? [] : d === 0 ? [1] : [1 - Math.sqrt(d) / 2, 1 + Math.sqrt(d) / 2]; } },
      { label: "f(x) = (x − 1)/2", f: (x) => (x - 1) / 2, words: "subtract 1, then halve", solve: (k) => [2 * k + 1] },
    ];
    let fi = 0, reverse = false;
    const panel = e("div", "gl-panel");
    const chips = chipRow(FNS.map((f) => ({ label: f.label })), (it, i) => { fi = i; upd(); }, 0);
    const dir = chipRow([{ label: "Forwards: put x in" }, { label: "Backwards: solve f(x) = k" }], (it, i) => { reverse = i === 1; upd(); }, 0);
    const machine = e("div", "gl-machine");
    const inBox = e("div", "gl-mbox io");
    const rule = e("div", "gl-mbox");
    const outBox = e("div", "gl-mbox io");
    machine.appendChild(inBox);
    machine.appendChild(e("div", "gl-marrow", "→"));
    machine.appendChild(rule);
    machine.appendChild(e("div", "gl-marrow", "→"));
    machine.appendChild(outBox);
    const controls = e("div", "gl-controls");
    const working = e("div", "gl-algebra");
    const msg = e("div", "gl-msg");

    const sx = slider("value", -6, 10, 1, 4, () => upd());
    controls.appendChild(sx.el);

    panel.appendChild(chips.el);
    panel.appendChild(dir.el);
    panel.appendChild(machine);
    panel.appendChild(controls);
    panel.appendChild(working);
    panel.appendChild(msg);
    host.appendChild(panel);

    function upd() {
      const fn = FNS[fi];
      const v = +sx.input.value;
      rule.textContent = fn.words;
      if (!reverse) {
        inBox.textContent = "input x = " + fmt(v);
        const out = fn.f(v);
        outBox.textContent = "output " + fmt(out);
        working.innerHTML = "f(" + fmt(v) + ") = " + fn.label.replace("f(x) = ", "").replace(/x/g, "(" + fmt(v) + ")") + " = <b>" + fmt(out) + "</b>";
        msg.className = "gl-msg good";
        msg.textContent = "Every x in the rule is replaced by the input — in brackets, so the signs stay right.";
      } else {
        inBox.textContent = "input x = ?";
        outBox.textContent = "output " + fmt(v);
        const sols = fn.solve(v).filter((s) => isFinite(s));
        working.innerHTML = fn.label.replace("f(x) = ", "") + " = " + fmt(v) +
          "<br>→ " + (sols.length ? "<b>x = " + sols.map((s) => fmt(s, 3)).join(" or x = ") + "</b>" : "<b>no real solution</b>");
        msg.className = "gl-msg warn";
        msg.textContent = "This is f(x) = " + fmt(v) + ", not f(" + fmt(v) + "). You are given the output and must find the input — and a quadratic rule usually has two answers.";
      }
    }
    upd();
  };

  /* 20 · Evaluation trainer */
  build.evallab = function (host) {
    const QS = [
      { f: "f(x) = 3x − 5", at: 4, val: 7, why: "3(4) − 5 = 12 − 5 = 7." },
      { f: "f(x) = 3x − 5", at: -2, val: -11, why: "3(−2) − 5 = −6 − 5 = −11." },
      { f: "f(x) = x² − 2x", at: 3, val: 3, why: "(3)² − 2(3) = 9 − 6 = 3." },
      { f: "f(x) = x² − 2x", at: -1, val: 3, why: "(−1)² − 2(−1) = 1 + 2 = 3 — brackets keep both signs right." },
      { f: "f(x) = x² − 4x + 1", at: 0, val: 1, why: "0 − 0 + 1 = 1." },
      { f: "f(x) = x² − 4x + 1", at: -2, val: 13, why: "(−2)² − 4(−2) + 1 = 4 + 8 + 1 = 13." },
      { f: "f(x) = 5 − 2x", at: -3, val: 11, why: "5 − 2(−3) = 5 + 6 = 11." },
      { f: "f(x) = x³ + x", at: -2, val: -10, why: "(−2)³ + (−2) = −8 − 2 = −10." },
    ];
    let i = 0, right = 0, asked = 0;
    const panel = e("div", "gl-panel");
    const eqn = e("div", "gl-eq");
    const prompt = e("div", "gl-prompt");
    const row = e("div", "gl-form-row");
    const answer = field("your answer", "", null, null);
    const check = e("button", "gl-btn", "✓ Check");
    check.type = "button";
    const skip = e("button", "gl-btn ghost", "Next →");
    skip.type = "button";
    row.appendChild(answer.el); row.appendChild(check); row.appendChild(skip);
    const msg = e("div", "gl-msg");
    const score = e("div", "gl-score-bar", "Score: 0 / 0");

    panel.appendChild(eqn);
    panel.appendChild(prompt);
    panel.appendChild(row);
    panel.appendChild(msg);
    panel.appendChild(score);
    host.appendChild(panel);

    answer.input.addEventListener("keydown", (ev) => { if (ev.key === "Enter") { ev.preventDefault(); go(); } });
    check.addEventListener("click", go);
    skip.addEventListener("click", () => { i = (i + 1) % QS.length; show(); });

    function show() {
      const q = QS[i];
      eqn.textContent = q.f;
      prompt.textContent = "Work out f(" + fmt(q.at) + ").";
      answer.input.value = "";
      answer.input.classList.remove("ok", "bad");
      msg.className = "gl-msg";
      msg.textContent = "Type the value and press Check (or Enter).";
      answer.input.focus({ preventScroll: true });
    }
    function go() {
      const q = QS[i], v = answer.get();
      if (!isFinite(v)) { msg.className = "gl-msg warn"; msg.textContent = "Type a number first."; return; }
      asked++;
      if (Math.abs(v - q.val) < 1e-9) {
        right++;
        answer.input.classList.add("ok");
        msg.className = "gl-msg good";
        msg.textContent = "Correct — " + q.why;
        setTimeout(() => { i = (i + 1) % QS.length; show(); }, 1500);
      } else {
        answer.input.classList.add("bad");
        msg.className = "gl-msg bad";
        msg.textContent = "Not quite. f(" + fmt(q.at) + ") = " + fmt(q.val) + ". " + q.why;
      }
      score.textContent = "Score: " + right + " / " + asked;
    }
    show();
  };

  /* 21 · Vertical line test */
  build.vltlab = function (host) {
    const RELS = [
      { label: "y = x²", branches: [(x) => x * x], fn: true, why: "Every input has exactly one output." },
      { label: "x = y²", branches: [(x) => (x >= 0 ? Math.sqrt(x) : NaN), (x) => (x >= 0 ? -Math.sqrt(x) : NaN)], fn: false,
        why: "For x > 0 there are two outputs, +√x and −√x, so it is not a function." },
      { label: "y = 2x + 1", branches: [(x) => 2 * x + 1], fn: true, why: "A straight line always passes the test." },
      { label: "x² + y² = 9", branches: [(x) => (Math.abs(x) <= 3 ? Math.sqrt(9 - x * x) : NaN), (x) => (Math.abs(x) <= 3 ? -Math.sqrt(9 - x * x) : NaN)], fn: false,
        why: "A circle fails — a vertical line through it meets it twice." },
      { label: "y = 1/x", branches: [(x) => (Math.abs(x) < 1e-9 ? NaN : 1 / x)], fn: true,
        why: "One output everywhere it is defined; at x = 0 there is simply no output at all." },
    ];
    let ri = 0, lineX = 2;
    const panel = e("div", "gl-panel");
    const chips = chipRow(RELS.map((r) => ({ label: r.label })), (it, i) => { ri = i; upd(); }, 0);
    const controls = e("div", "gl-controls");
    const cvBox = e("div", "gl-canvas");
    const cv = document.createElement("canvas");
    cvBox.appendChild(cv);
    const msg = e("div", "gl-msg");
    const facts = e("div", "gl-facts");
    const fHits = factRow("The line meets the graph", "");
    const fVerdict = factRow("Verdict", "");
    [fHits, fVerdict].forEach((r) => facts.appendChild(r));

    const sl = slider("vertical line at x =", -4, 4, 0.25, lineX, (v) => { lineX = v; upd(); });
    controls.appendChild(sl.el);

    panel.appendChild(chips.el);
    panel.appendChild(controls);
    panel.appendChild(cvBox);
    panel.appendChild(msg);
    panel.appendChild(facts);
    host.appendChild(panel);

    const plot = new Plot(cv, { xmin: -4.5, xmax: 4.5, ymin: -5, ymax: 6 });

    function upd() {
      const r = RELS[ri];
      const hits = r.branches.map((b) => b(lineX)).filter((y) => isFinite(y) && y > -5 && y < 6);
      plot.set({
        curves: r.branches.map((b) => ({ f: b, color: r.fn ? "c1" : "c2" })),
        guides: [{ x: lineX, color: "c4", label: "x = " + fmt(lineX) }],
        points: hits.map((y) => ({ x: lineX, y, color: "c4", r: 5 })),
      });
      fHits.setValue(hits.length + (hits.length === 1 ? " point here" : " points here") +
        (hits.length ? "  (y = " + hits.map((y) => fmt(y, 2)).join(", ") + ")" : ""));
      fVerdict.setValue(r.fn ? r.label + " IS a function ✔  — " + r.why : r.label + " is NOT a function ✗  — " + r.why);
      if (hits.length > 1) {
        msg.className = "gl-msg bad";
        msg.textContent = "Two outputs for one input — this fails the vertical line test, so it is not a function.";
      } else {
        msg.className = "gl-msg good";
        msg.textContent = r.fn
          ? "One output (or none) for this input. Slide the line right across — if it never meets the graph twice, it is a function."
          : "Keep sliding — find an x where the line meets the graph twice.";
      }
    }
    upd();
  };

  /* 22 · Composite and inverse functions */
  build.compinvlab = function (host) {
    const FNS = [
      { label: "2x + 1", f: (x) => 2 * x + 1, a: 2, b: 1, sub: (s) => "2(" + s + ") + 1" },
      { label: "3x − 5", f: (x) => 3 * x - 5, a: 3, b: -5, sub: (s) => "3(" + s + ") − 5" },
      { label: "x²", f: (x) => x * x, sub: (s) => "(" + s + ")²" },
      { label: "x + 4", f: (x) => x + 4, a: 1, b: 4, sub: (s) => "(" + s + ") + 4" },
      { label: "x/2", f: (x) => x / 2, a: 0.5, b: 0, sub: (s) => "(" + s + ") ÷ 2" },
    ];
    let fi = 0, gi = 2, xv = 3;
    const panel = e("div", "gl-panel");
    const row = e("div", "gl-form-row");
    const pf = picker("f(x) =", FNS.map((f, i) => ({ value: i, label: f.label })), () => { fi = +pf.get(); upd(); });
    const pg = picker("g(x) =", FNS.map((f, i) => ({ value: i, label: f.label })), () => { gi = +pg.get(); upd(); });
    pg.sel.value = "2";
    const px = field("x =", "3", null, () => { xv = px.get(); upd(); });
    [pf.el, pg.el, px.el].forEach((n) => row.appendChild(n));
    const two = e("div", "gl-two");
    const boxFG = e("div", "gl-subcard");
    const boxGF = e("div", "gl-subcard");
    two.appendChild(boxFG); two.appendChild(boxGF);
    const invBox = e("div", "gl-subcard");
    const msg = e("div", "gl-msg");

    panel.appendChild(row);
    panel.appendChild(two);
    panel.appendChild(invBox);
    panel.appendChild(msg);
    host.appendChild(panel);

    function upd() {
      const f = FNS[fi], g = FNS[gi], x = xv;
      if (!isFinite(x)) { msg.className = "gl-msg warn"; msg.textContent = "Type a number for x."; return; }
      const gx = g.f(x), fgx = f.f(gx);
      const fx = f.f(x), gfx = g.f(fx);
      boxFG.innerHTML = "<div class='gl-subhead'>fg(" + fmt(x) + ") — inner function first</div>" +
        "g(" + fmt(x) + ") = " + g.sub(fmt(x)) + " = <b>" + fmt(gx) + "</b><br>" +
        "then f(" + fmt(gx) + ") = " + f.sub(fmt(gx)) + " = <b>" + fmt(fgx) + "</b>";
      boxGF.innerHTML = "<div class='gl-subhead'>gf(" + fmt(x) + ") — the other order</div>" +
        "f(" + fmt(x) + ") = " + f.sub(fmt(x)) + " = <b>" + fmt(fx) + "</b><br>" +
        "then g(" + fmt(fx) + ") = " + g.sub(fmt(fx)) + " = <b>" + fmt(gfx) + "</b>";
      if (f.a != null) {
        const inv = (y) => (y - f.b) / f.a;
        invBox.innerHTML = "<div class='gl-subhead'>The inverse f⁻¹(x)</div>" +
          "y = " + f.label + " → swap: x = " + f.sub("y") + " → make y the subject:<br>" +
          "<b>f⁻¹(x) = (x " + (f.b < 0 ? "+ " + fmt(-f.b) : MINUS + " " + fmt(f.b)) + ") ÷ " + fmt(f.a) + "</b><br>" +
          "Check: f(" + fmt(x) + ") = " + fmt(fx) + " and f⁻¹(" + fmt(fx) + ") = " + fmt(inv(fx)) + " ✔ — the inverse takes you back.";
      } else {
        invBox.innerHTML = "<div class='gl-subhead'>The inverse f⁻¹(x)</div>" +
          "f(x) = x² has no single inverse over all real numbers — both " + fmt(x) + " and " + MINUS + fmt(x) +
          " give the same output, so the domain must be restricted first. Pick a linear f to see the method.";
      }
      msg.className = fgx === gfx ? "gl-msg warn" : "gl-msg good";
      msg.textContent = fgx === gfx
        ? "Here fg(" + fmt(x) + ") and gf(" + fmt(x) + ") happen to agree — but that is a coincidence for this x, not a rule."
        : "fg(" + fmt(x) + ") = " + fmt(fgx) + " but gf(" + fmt(x) + ") = " + fmt(gfx) + " — order matters! Work right to left, from the function nearest the x.";
    }
    upd();
  };

  /* 23 · Tangent and chord — gradient of a curve */
  build.gradlab = function (host) {
    const CURVES = [
      { label: "y = x²", f: (x) => x * x, d: (x) => 2 * x, dlabel: "dy/dx = 2x", view: { xmin: -1, xmax: 5, ymin: -5, ymax: 14 } },
      { label: "y = x³ − 4x", f: (x) => x * x * x - 4 * x, d: (x) => 3 * x * x - 4, dlabel: "dy/dx = 3x² − 4", view: { xmin: -3, xmax: 3, ymin: -8, ymax: 8 } },
      { label: "y = x² − 4x + 3", f: (x) => x * x - 4 * x + 3, d: (x) => 2 * x - 4, dlabel: "dy/dx = 2x − 4", view: { xmin: -1, xmax: 5, ymin: -3, ymax: 9 } },
    ];
    const st = { i: 0, a: 2, h: 2 };
    const panel = e("div", "gl-panel");
    const chips = chipRow(CURVES.map((c) => ({ label: c.label })), (it, i) => { st.i = i; upd(true); }, 0);
    const controls = e("div", "gl-controls");
    const cvBox = e("div", "gl-canvas");
    const cv = document.createElement("canvas");
    cvBox.appendChild(cv);
    const facts = e("div", "gl-facts");
    const fChord = factRow("Chord gradient (average rate)", "");
    const fTan = factRow("Tangent gradient (rate at the point)", "");
    const fDeriv = factRow("By differentiation", "");
    const fGap = factRow("Difference", "");
    [fChord, fTan, fDeriv, fGap].forEach((r) => facts.appendChild(r));
    const msg = e("div", "gl-msg");

    const sa = slider("point at x =", -2.5, 4.5, 0.25, st.a, (v) => { st.a = v; upd(); });
    const sh = slider("chord reaches x + h, h =", 0.25, 3, 0.25, st.h, (v) => { st.h = v; upd(); });
    controls.appendChild(sa.el); controls.appendChild(sh.el);

    panel.appendChild(chips.el);
    panel.appendChild(controls);
    panel.appendChild(cvBox);
    panel.appendChild(msg);
    panel.appendChild(facts);
    host.appendChild(panel);

    const plot = new Plot(cv, Object.assign({ trace: true }, CURVES[0].view));

    function upd(reset) {
      const cu = CURVES[st.i];
      const v = cu.view;
      if (reset) { plot.set(v); sa.input.min = v.xmin + 0.5; sa.input.max = v.xmax - 1; }
      const a = Math.min(Math.max(st.a, v.xmin + 0.25), v.xmax - 0.25);
      const b = a + st.h;
      const fa = cu.f(a), fb = cu.f(b);
      const mTan = cu.d(a);
      const mChord = (fb - fa) / (b - a);
      const tan = (x) => fa + mTan * (x - a);
      const chord = (x) => fa + mChord * (x - a);
      plot.set({
        curves: [
          { f: cu.f, color: "c1" },
          { f: tan, color: "c2", width: 2, trace: false },
          { f: chord, color: "c3", width: 2, dash: true, trace: false, from: a, to: b },
        ],
        segs: [
          { x1: a, y1: fa, x2: b, y2: fa, color: "c3", width: 1.5, dash: true, label: "run " + fmt(b - a) },
          { x1: b, y1: fa, x2: b, y2: fb, color: "c3", width: 1.5, dash: true, label: "rise " + fmt(fb - fa) },
        ],
        points: [
          { x: a, y: fa, color: "c2", label: "(" + fmt(a) + ", " + fmt(fa) + ")", dy: -10 },
          { x: b, y: fb, color: "c3", r: 4.5 },
        ],
      });
      fChord.setValue("(" + fmt(fb) + " − " + fmt(fa) + ") ÷ " + fmt(b - a) + " = " + fmt(mChord));
      fTan.setValue(fmt(mTan) + (mTan > 0 ? "  — the curve is rising here" : mTan < 0 ? "  — the curve is falling here" : "  — the curve is level here"));
      fDeriv.setValue(cu.dlabel + " → at x = " + fmt(a) + ", gradient = " + fmt(mTan));
      fGap.setValue(fmt(Math.abs(mChord - mTan)) + "  (chord − tangent)");
      if (st.h <= 0.5) {
        msg.className = "gl-msg good";
        msg.textContent = "With h small the chord has almost become the tangent — that is exactly what differentiation does: it shrinks h to zero.";
      } else {
        msg.className = "gl-msg warn";
        msg.textContent = "The chord gives the AVERAGE rate of change over the interval; the tangent gives the rate at the single point. Shrink h and watch them meet.";
      }
    }
    upd(true);
  };

  /* 24 · Derivative explorer — y and dy/dx on the same axes */
  build.derivlab = function (host) {
    const st = { a: 1, b: -3, c: -9, d: 5 };
    const panel = e("div", "gl-panel");
    const eqn = e("div", "gl-eq");
    const controls = e("div", "gl-controls");
    const cvBox = e("div", "gl-canvas");
    const cv = document.createElement("canvas");
    cvBox.appendChild(cv);
    const facts = e("div", "gl-facts");
    const fD = factRow("dy/dx", "");
    const fD2 = factRow("d²y/dx²", "");
    const fStat = factRow("Stationary points (dy/dx = 0)", "");
    const fNat = factRow("Nature", "");
    [fD, fD2, fStat, fNat].forEach((r) => facts.appendChild(r));
    const msg = e("div", "gl-msg");

    const sa = slider("x³ coefficient a", -2, 2, 1, st.a, (v) => { st.a = v; upd(); });
    const sb = slider("x² coefficient b", -6, 6, 1, st.b, (v) => { st.b = v; upd(); });
    const sc = slider("x coefficient c", -12, 12, 1, st.c, (v) => { st.c = v; upd(); });
    const sd = slider("constant d", -10, 10, 1, st.d, (v) => { st.d = v; upd(); });
    [sa, sb, sc, sd].forEach((s) => controls.appendChild(s.el));

    panel.appendChild(eqn);
    panel.appendChild(controls);
    panel.appendChild(cvBox);
    panel.appendChild(msg);
    panel.appendChild(facts);
    host.appendChild(panel);

    const plot = new Plot(cv, { xmin: -4, xmax: 5, ymin: -30, ymax: 30, trace: true });

    const term = (v, s) => (v === 0 ? "" : (v < 0 ? " " + MINUS + " " : " + ") + (Math.abs(v) === 1 && s ? "" : fmt(Math.abs(v))) + s);
    function poly(a, b, c, d) {
      const lead = a === 0 ? "" : (a === 1 ? "x³" : a === -1 ? MINUS + "x³" : fmt(a) + "x³");
      let s = lead + term(b, "x²") + term(c, "x") + term(d, "");
      s = s.replace(/^ \+ /, "").replace(/^ − /, MINUS);
      return s || "0";
    }

    function upd() {
      const { a, b, c, d } = st;
      const f = (x) => a * x * x * x + b * x * x + c * x + d;
      const df = (x) => 3 * a * x * x + 2 * b * x + c;
      const d2f = (x) => 6 * a * x + 2 * b;
      eqn.textContent = "y = " + poly(a, b, c, d);
      fD.setValue("dy/dx = " + poly(0, 3 * a, 2 * b, c).replace("x²", "x²"));
      fD2.setValue("d²y/dx² = " + (6 * a === 0 ? fmt(2 * b) : poly(0, 0, 6 * a, 2 * b)));

      // solve dy/dx = 0
      let roots = [];
      if (a === 0) { if (b !== 0) roots = [-c / (2 * b)]; }
      else {
        const A = 3 * a, B = 2 * b, C = c, D = B * B - 4 * A * C;
        if (D > 0) roots = [(-B - Math.sqrt(D)) / (2 * A), (-B + Math.sqrt(D)) / (2 * A)].sort((p, q) => p - q);
        else if (Math.abs(D) < 1e-12) roots = [-B / (2 * A)];
      }
      const pts = [], guides = [];
      roots.forEach((r) => {
        const nature = d2f(r) > 0 ? "min" : d2f(r) < 0 ? "max" : "point of inflection";
        pts.push({ x: r, y: f(r), color: d2f(r) > 0 ? "c3" : "c5", label: nature + " (" + fmt(r) + ", " + fmt(f(r)) + ")", dy: d2f(r) > 0 ? 17 : -10 });
        pts.push({ x: r, y: 0, color: "c2", r: 3.5 });
        guides.push({ x: r, color: "faint" });
      });
      const ys = [];
      for (let i = 0; i <= 40; i++) { const x = -4 + (9 * i) / 40; ys.push(f(x)); }
      const lo = Math.min.apply(null, ys), hi = Math.max.apply(null, ys);
      plot.set({
        ymin: Math.max(-80, Math.min(-5, lo - 4)), ymax: Math.min(80, Math.max(5, hi + 4)),
        curves: [{ f, color: "c1" }, { f: df, color: "c2", width: 2, dash: true, trace: false }],
        points: pts, guides,
      });
      fStat.setValue(roots.length
        ? roots.map((r) => "x = " + fmt(r) + " → (" + fmt(r) + ", " + fmt(f(r)) + ")").join("     ")
        : "none — dy/dx is never zero, so the curve never levels off");
      fNat.setValue(roots.length
        ? roots.map((r) => "at x = " + fmt(r) + ": d²y/dx² = " + fmt(d2f(r)) + " → " + (d2f(r) > 0 ? "MINIMUM" : d2f(r) < 0 ? "MAXIMUM" : "inflection")).join("     ")
        : "—");
      msg.className = "gl-msg good";
      msg.textContent = "Blue is y, dashed orange is dy/dx. Where the dashed line CROSSES the x-axis, the blue curve has a turning point — that is what solving dy/dx = 0 means.";
    }
    upd();
  };

  /* 25 · Stationary point trainer */
  build.statlab = function (host) {
    const QS = [
      { y: "y = x² − 6x + 5", f: (x) => x * x - 6 * x + 5, d: "dy/dx = 2x − 6", roots: [3], d2: "d²y/dx² = 2",
        nat: ["2 > 0 → minimum"], view: { xmin: -1, xmax: 7, ymin: -6, ymax: 10 } },
      { y: "y = 8 + 2x − x²", f: (x) => 8 + 2 * x - x * x, d: "dy/dx = 2 − 2x", roots: [1], d2: "d²y/dx² = −2",
        nat: ["−2 < 0 → maximum"], view: { xmin: -3, xmax: 5, ymin: -4, ymax: 12 } },
      { y: "y = x³ − 3x² − 9x + 5", f: (x) => x * x * x - 3 * x * x - 9 * x + 5, d: "dy/dx = 3x² − 6x − 9 = 3(x − 3)(x + 1)", roots: [-1, 3], d2: "d²y/dx² = 6x − 6",
        nat: ["at x = −1: −12 < 0 → maximum", "at x = 3: 12 > 0 → minimum"], view: { xmin: -3, xmax: 5, ymin: -28, ymax: 18 } },
      { y: "y = x³ − 12x", f: (x) => x * x * x - 12 * x, d: "dy/dx = 3x² − 12 = 3(x − 2)(x + 2)", roots: [-2, 2], d2: "d²y/dx² = 6x",
        nat: ["at x = −2: −12 < 0 → maximum", "at x = 2: 12 > 0 → minimum"], view: { xmin: -4, xmax: 4, ymin: -20, ymax: 20 } },
    ];
    let qi = 0, shown = 0;
    const panel = e("div", "gl-panel");
    const chips = chipRow(QS.map((q, i) => ({ label: "Q" + (i + 1) })), (it, i) => { qi = i; shown = 0; render(); }, 0);
    const eqn = e("div", "gl-eq");
    const steps = e("div", "gl-steps");
    const bar = e("div", "gl-bar");
    const next = e("button", "gl-btn", "👀 Reveal the next step");
    next.type = "button";
    bar.appendChild(next);
    const cvBox = e("div", "gl-canvas");
    const cv = document.createElement("canvas");
    cvBox.appendChild(cv);

    panel.appendChild(chips.el);
    panel.appendChild(eqn);
    panel.appendChild(bar);
    panel.appendChild(steps);
    panel.appendChild(cvBox);
    host.appendChild(panel);

    const plot = new Plot(cv, Object.assign({ trace: true }, QS[0].view));
    next.addEventListener("click", () => { shown++; render(); });

    function line(n, title, body) {
      const d = e("div", "gl-step");
      d.appendChild(e("span", "gl-step-n", "Step " + n));
      d.appendChild(html("div", "gl-step-b", "<b>" + title + "</b><br>" + body));
      return d;
    }

    function render() {
      const q = QS[qi];
      eqn.textContent = "Find the stationary points of  " + q.y + "  and state the nature of each.";
      const all = [
        ["1", "Differentiate", q.d],
        ["2", "Set dy/dx = 0 and solve", "x = " + q.roots.map((r) => fmt(r)).join(" or x = ")],
        ["3", "Put each x back into the ORIGINAL equation", q.roots.map((r) => "x = " + fmt(r) + " → y = " + fmt(q.f(r))).join("<br>")],
        ["4", "Write the coordinates", q.roots.map((r) => "(" + fmt(r) + ", " + fmt(q.f(r)) + ")").join("  and  ")],
        ["5", "Decide the nature", q.d2 + "<br>" + q.nat.join("<br>")],
      ];
      steps.replaceChildren();
      all.slice(0, shown).forEach((s) => steps.appendChild(line(s[0], s[1], s[2])));
      next.style.display = shown >= all.length ? "none" : "";
      if (!shown) steps.appendChild(html("div", "gl-msg", "Try it on paper first, then reveal the steps one at a time."));
      plot.set(Object.assign({
        curves: [{ f: q.f, color: "c1" }],
        points: shown >= 4 ? q.roots.map((r) => ({
          x: r, y: q.f(r),
          color: q.nat.join(" ").indexOf("minimum") >= 0 && (q.roots.length === 1 ? q.nat[0].indexOf("min") >= 0 : r === Math.max.apply(null, q.roots)) ? "c3" : "c5",
          label: "(" + fmt(r) + ", " + fmt(q.f(r)) + ")", dy: -10,
        })) : [],
        segs: shown >= 4 ? q.roots.map((r) => ({
          x1: r - (q.view.xmax - q.view.xmin) / 12, y1: q.f(r),
          x2: r + (q.view.xmax - q.view.xmin) / 12, y2: q.f(r),
          color: "c2", width: 2,
        })) : [],
      }, q.view));
    }
    render();
  };


  // ---------- free-form sketch canvas (diagrams that are not x–y plots) ----------
  /* Same lifecycle as Plot: theme-aware, resize-aware, auto-dropped when detached.
     opts.render(ctx, W, H, palette) does the drawing in CSS pixels. */
  function Sketch(canvas, opts) {
    this.cv = canvas;
    this.o = Object.assign({ ratio: 0.62, minH: 210, maxH: 340 }, opts || {});
    const self = this;
    if (window.ResizeObserver) {
      this.ro = new ResizeObserver(() => self.draw());
      this.ro.observe(canvas.parentNode || canvas);
    }
    live.push(this);
    this.draw();
  }
  Sketch.prototype.set = function (o) { Object.assign(this.o, o); this.draw(); };
  Sketch.prototype.draw = function () {
    const cv = this.cv, o = this.o;
    if (!cv.isConnected) return;
    const W = Math.max(220, (cv.parentNode ? cv.parentNode.clientWidth : 320) - 2);
    const H = Math.round(Math.min(o.maxH, Math.max(o.minH, W * o.ratio)));
    const dpr = window.devicePixelRatio || 1;
    cv.style.width = W + "px";
    cv.style.height = H + "px";
    cv.width = Math.round(W * dpr);
    cv.height = Math.round(H * dpr);
    const c = cv.getContext("2d");
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
    const P = pal();
    c.clearRect(0, 0, W, H);
    c.fillStyle = P.bg;
    c.fillRect(0, 0, W, H);
    if (o.render) o.render(c, W, H, P);
  };

  // ---------- drawing helpers shared by the geometry sketches ----------

  const DEG = Math.PI / 180;

  function strokePath(c, pts, color, width, dash) {
    if (pts.length < 2) return;
    c.save();
    c.strokeStyle = color;
    c.lineWidth = width || 2;
    c.lineJoin = "round";
    if (dash) c.setLineDash(dash);
    c.beginPath();
    c.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length; i++) c.lineTo(pts[i][0], pts[i][1]);
    c.stroke();
    c.restore();
  }
  function fillPoly(c, pts, color) {
    c.save();
    c.fillStyle = color;
    c.beginPath();
    c.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length; i++) c.lineTo(pts[i][0], pts[i][1]);
    c.closePath();
    c.fill();
    c.restore();
  }
  function tag(c, txt, x, y, color, align, size) {
    c.save();
    c.fillStyle = color;
    c.font = "700 " + (size || 12) + "px Inter, system-ui, sans-serif";
    c.textAlign = align || "center";
    c.textBaseline = "middle";
    c.fillText(txt, x, y);
    c.restore();
  }
  // same as tag(), but paints the panel background behind the text so a label
  // that lands on top of an edge is still readable
  function tagOn(c, P, txt, x, y, color, align, size) {
    const s = size || 12;
    c.save();
    c.font = "700 " + s + "px Inter, system-ui, sans-serif";
    const w = c.measureText(txt).width + 8;
    const left = align === "right" ? x - w + 4 : align === "left" ? x - 4 : x - w / 2;
    c.fillStyle = P.bg;
    c.globalAlpha = 0.85;
    c.beginPath();
    (c.roundRect ? c.roundRect(left, y - s * 0.75, w, s * 1.5, 5) : c.rect(left, y - s * 0.75, w, s * 1.5));
    c.fill();
    c.restore();
    tag(c, txt, x, y, color, align, s);
  }
  function dot(c, x, y, color, bg, r) {
    c.save();
    c.fillStyle = color;
    c.strokeStyle = bg;
    c.lineWidth = 2;
    c.beginPath();
    c.arc(x, y, r || 4.5, 0, 7);
    c.fill();
    c.stroke();
    c.restore();
  }
  // right-angle square at B, opening towards A and C
  function rightAngle(c, B, A, C, color, size) {
    const s = size || 12;
    const u = unit(B, A), v = unit(B, C);
    strokePath(c, [
      [B[0] + u[0] * s, B[1] + u[1] * s],
      [B[0] + (u[0] + v[0]) * s, B[1] + (u[1] + v[1]) * s],
      [B[0] + v[0] * s, B[1] + v[1] * s],
    ], color, 1.6);
  }
  function unit(from, to) {
    const dx = to[0] - from[0], dy = to[1] - from[1];
    const L = Math.hypot(dx, dy) || 1;
    return [dx / L, dy / L];
  }
  // arc of an angle at vertex V, sweeping from screen-angle a0 to a1 (radians, canvas convention)
  function arcMark(c, V, r, a0, a1, color, width) {
    c.save();
    c.strokeStyle = color;
    c.lineWidth = width || 2;
    c.beginPath();
    c.arc(V[0], V[1], r, a0, a1);
    c.stroke();
    c.restore();
  }
  function arrowHead(c, x, y, ang, color, size) {
    const s = size || 7;
    c.save();
    c.fillStyle = color;
    c.translate(x, y);
    c.rotate(ang);
    c.beginPath();
    c.moveTo(0, 0);
    c.lineTo(-s, -s * 0.55);
    c.lineTo(-s, s * 0.55);
    c.closePath();
    c.fill();
    c.restore();
  }

  /* 27 · Right-angled triangle solver — pick the ratio, see the working */
  build.trilab = function (host) {
    const MODES = [
      { key: "side", label: "Find a side" },
      { key: "angle", label: "Find an angle" },
    ];
    let mode = "side";

    const panel = e("div", "gl-panel");
    const chips = chipRow(MODES, (it) => { mode = it.key; layout(); }, 0);
    const form = e("div", "gl-form");
    const cvBox = e("div", "gl-canvas");
    const canvas = document.createElement("canvas");
    cvBox.appendChild(canvas);
    const steps = e("div", "gl-steps");
    const msg = e("div", "gl-msg");

    // "find a side" inputs
    const angA = field("Angle θ (°)", "35", null, upd);
    const known = picker("You know the", [
      { value: "H", label: "hypotenuse" },
      { value: "O", label: "opposite" },
      { value: "A", label: "adjacent" },
    ], upd);
    const knownLen = field("its length", "12", null, upd);
    const want = picker("You want the", [
      { value: "O", label: "opposite" },
      { value: "A", label: "adjacent" },
      { value: "H", label: "hypotenuse" },
    ], upd);

    // "find an angle" inputs
    const s1 = picker("First side", [
      { value: "O", label: "opposite" },
      { value: "A", label: "adjacent" },
      { value: "H", label: "hypotenuse" },
    ], upd);
    const l1 = field("length", "5", null, upd);
    const s2 = picker("Second side", [
      { value: "A", label: "adjacent" },
      { value: "O", label: "opposite" },
      { value: "H", label: "hypotenuse" },
    ], upd);
    const l2 = field("length", "8", null, upd);

    panel.appendChild(chips.el);
    panel.appendChild(form);
    panel.appendChild(cvBox);
    panel.appendChild(steps);
    panel.appendChild(msg);
    host.appendChild(panel);

    let shape = { theta: 35, O: 6.88, A: 9.83, H: 12, want: "O" };

    const sketch = new Sketch(canvas, {
      ratio: 0.58, minH: 210, maxH: 300,
      render(c, W, H, P) {
        const th = shape.theta * DEG;
        // fit the triangle: right angle bottom-right, θ at bottom-left
        const padX = 58, padY = 42;
        const availW = W - padX * 2, availH = H - padY * 2;
        const ratio = Math.tan(Math.min(Math.max(th, 6 * DEG), 84 * DEG));
        let bw = availW, bh = bw * ratio;
        if (bh > availH) { bh = availH; bw = bh / ratio; }
        const Ax = (W - bw) / 2, By = (H + bh) / 2;
        const A = [Ax, By];                 // θ vertex
        const B = [Ax + bw, By];            // right angle
        const C = [Ax + bw, By - bh];       // top

        fillPoly(c, [A, B, C], P.soft);
        strokePath(c, [A, B, C, A], P.c1, 2.4);
        rightAngle(c, B, A, C, P.axis, 13);
        arcMark(c, A, 30, -th, 0, P.c2, 2.4);
        tag(c, "θ = " + fmt(shape.theta, 1) + "°", A[0] + 44, By - 14, P.c2, "left", 12);

        const lab = (key, txt, x, y, align) => {
          const hot = (mode === "side" && key === shape.want);
          tagOn(c, P, txt, x, y, hot ? P.c2 : P.strong, align, hot ? 13 : 12);
        };
        lab("A", "adj = " + fmt(shape.A, 2), (A[0] + B[0]) / 2, By + 18, "center");
        lab("O", "opp = " + fmt(shape.O, 2), B[0] + 8, (B[1] + C[1]) / 2, "left");
        lab("H", "hyp = " + fmt(shape.H, 2), (A[0] + C[0]) / 2 - 10, (A[1] + C[1]) / 2 - 12, "right");
        dot(c, A[0], A[1], P.c2, P.bg);
      },
    });

    function group(title, items) {
      const g = e("div", "gl-form-group");
      g.appendChild(e("div", "gl-form-title", title));
      const row = e("div", "gl-form-row");
      items.forEach((i) => row.appendChild(i));
      g.appendChild(row);
      return g;
    }

    function layout() {
      form.replaceChildren();
      if (mode === "side") {
        form.appendChild(group("What the question gives you", [angA.el, known.el, knownLen.el]));
        form.appendChild(group("What it asks for", [want.el]));
      } else {
        form.appendChild(group("The two sides you know", [s1.el, l1.el, s2.el, l2.el]));
      }
      upd();
    }

    const NAME = { O: "opposite", A: "adjacent", H: "hypotenuse" };
    // which ratio links two of the three sides
    function ratioFor(a, b) {
      const s = [a, b].sort().join("");
      if (s === "HO") return { name: "sin", soh: "SOH", top: "O", bot: "H" };
      if (s === "AH") return { name: "cos", soh: "CAH", top: "A", bot: "H" };
      return { name: "tan", soh: "TOA", top: "O", bot: "A" };
    }

    function step(n, title, body) {
      const d = e("div", "gl-step");
      d.appendChild(e("span", "gl-step-n", "Step " + n));
      d.appendChild(html("div", "gl-step-b", "<b>" + title + "</b><br>" + body));
      return d;
    }

    function upd() {
      steps.replaceChildren();
      msg.className = "gl-msg";
      if (mode === "side") {
        const th = angA.get(), L = knownLen.get(), k = known.get(), w = want.get();
        if (!isFinite(th) || th <= 0 || th >= 90) {
          msg.className = "gl-msg warn";
          msg.textContent = "The angle must be between 0° and 90° — the other two angles of a right-angled triangle are always acute.";
          return;
        }
        if (!isFinite(L) || L <= 0) {
          msg.className = "gl-msg warn";
          msg.textContent = "Enter a positive length for the side you know.";
          return;
        }
        if (k === w) {
          msg.className = "gl-msg warn";
          msg.textContent = "You already know that side — choose a different one to find.";
          return;
        }
        // build the full triangle from the one known side
        const t = th * DEG;
        let H;
        if (k === "H") H = L;
        else if (k === "O") H = L / Math.sin(t);
        else H = L / Math.cos(t);
        const O = H * Math.sin(t), A = H * Math.cos(t);
        shape = { theta: th, O, A, H, want: w };
        sketch.draw();

        const r = ratioFor(k, w);
        const val = { O, A, H };
        const unknownOnTop = (r.top === w);
        const eq = r.name + " " + fmt(th, 1) + "° = " + NAME[r.top].slice(0, 3) + " / " + NAME[r.bot].slice(0, 3);
        const rv = r.name === "sin" ? Math.sin(t) : r.name === "cos" ? Math.cos(t) : Math.tan(t);

        steps.appendChild(step(1, "Label the sides against θ",
          "You know the <b>" + NAME[k] + "</b> (" + fmt(L, 3) + ") and want the <b>" + NAME[w] + "</b>."));
        steps.appendChild(step(2, "Pick the ratio joining those two",
          "That pair is <b>" + r.soh + "</b> → " + eq));
        steps.appendChild(step(3, "Substitute",
          fmt(rv, 4) + " = " + (unknownOnTop ? "x / " + fmt(L, 3) : fmt(L, 3) + " / x")));
        steps.appendChild(step(4, unknownOnTop ? "Unknown on top → multiply" : "Unknown on the bottom → divide",
          unknownOnTop
            ? "x = " + fmt(L, 3) + " × " + r.name + " " + fmt(th, 1) + "° = <b>" + fmt(val[w], 3) + "</b>"
            : "x = " + fmt(L, 3) + " ÷ " + r.name + " " + fmt(th, 1) + "° = <b>" + fmt(val[w], 3) + "</b>"));

        msg.className = "gl-msg good";
        msg.textContent = "Sense check: the hypotenuse (" + fmt(H, 2) + ") is the longest side here, and it is. "
          + (w === "H" ? "Finding the hypotenuse always means dividing." : "");
      } else {
        const a = s1.get(), b = s2.get(), la = l1.get(), lb = l2.get();
        if (a === b) {
          msg.className = "gl-msg warn";
          msg.textContent = "Choose two different sides — you need a ratio of two distinct sides.";
          return;
        }
        if (!isFinite(la) || !isFinite(lb) || la <= 0 || lb <= 0) {
          msg.className = "gl-msg warn";
          msg.textContent = "Enter a positive length for each side.";
          return;
        }
        const val = {}; val[a] = la; val[b] = lb;
        const r = ratioFor(a, b);
        const top = val[r.top], bot = val[r.bot];
        if (r.bot === "H" && top > bot) {
          msg.className = "gl-msg warn";
          msg.textContent = "The hypotenuse must be the longest side — " + fmt(top, 3)
            + " cannot be " + NAME[r.top] + " when the hypotenuse is only " + fmt(bot, 3) + ".";
          return;
        }
        const q = top / bot;
        const th = (r.name === "sin" ? Math.asin(q) : r.name === "cos" ? Math.acos(q) : Math.atan(q)) / DEG;
        // complete the triangle for the picture
        const t = th * DEG;
        let H;
        if (val.H != null) H = val.H;
        else if (val.O != null) H = val.O / Math.sin(t);
        else H = val.A / Math.cos(t);
        shape = { theta: th, O: H * Math.sin(t), A: H * Math.cos(t), H, want: null };
        sketch.draw();

        steps.appendChild(step(1, "Label the two sides you know",
          NAME[a] + " = " + fmt(la, 3) + ", " + NAME[b] + " = " + fmt(lb, 3)));
        steps.appendChild(step(2, "That pair gives the ratio",
          "<b>" + r.soh + "</b> → " + r.name + " θ = " + fmt(top, 3) + " / " + fmt(bot, 3) + " = " + fmt(q, 4)));
        steps.appendChild(step(3, "Use the inverse function",
          "θ = " + r.name + "⁻¹(" + fmt(q, 4) + ") = <b>" + fmt(th, 1) + "°</b>"));
        msg.className = "gl-msg good";
        msg.textContent = "Use " + r.name + "⁻¹, not " + r.name + " — and give the angle to 1 decimal place.";
      }
    }
    layout();
  };

  /* 28 · Exact values — the two special triangles, on demand */
  build.exactlab = function (host) {
    const ANGLES = [0, 30, 45, 60, 90];
    const EXACT = {
      0:  { sin: "0", cos: "1", tan: "0" },
      30: { sin: "1/2", cos: "√3/2", tan: "√3/3" },
      45: { sin: "√2/2", cos: "√2/2", tan: "1" },
      60: { sin: "√3/2", cos: "1/2", tan: "√3" },
      90: { sin: "1", cos: "0", tan: "undefined" },
    };
    let ang = 30;

    const panel = e("div", "gl-panel");
    const chips = chipRow(ANGLES.map((a) => ({ label: a + "°", a })), (it) => { ang = it.a; upd(); }, 1);
    const cvBox = e("div", "gl-canvas");
    const canvas = document.createElement("canvas");
    cvBox.appendChild(canvas);
    const facts = e("div", "gl-facts");
    const msg = e("div", "gl-msg");

    const fSin = factRow("sin", "", "");
    const fCos = factRow("cos", "", "");
    const fTan = factRow("tan", "", "");
    [fSin, fCos, fTan].forEach((f) => facts.appendChild(f));

    panel.appendChild(chips.el);
    panel.appendChild(cvBox);
    panel.appendChild(facts);
    panel.appendChild(msg);
    host.appendChild(panel);

    const sketch = new Sketch(canvas, {
      ratio: 0.5, minH: 180, maxH: 260,
      render(c, W, H, P) {
        const use45 = (ang === 45);
        const pad = 46;
        // 30-60-90 has legs 1 (short) and √3; 45-45-90 has legs 1 and 1
        const legA = use45 ? 1 : Math.sqrt(3);   // horizontal
        const legB = 1;                          // vertical
        const scale = Math.min((W - pad * 2) / legA, (H - pad * 2) / legB);
        const bw = legA * scale, bh = legB * scale;
        const x0 = (W - bw) / 2, y1 = (H + bh) / 2;
        const A = [x0, y1], B = [x0 + bw, y1], C = [x0 + bw, y1 - bh];

        fillPoly(c, [A, B, C], use45 ? P.soft2 : P.soft);
        strokePath(c, [A, B, C, A], use45 ? P.c3 : P.c1, 2.4);
        rightAngle(c, B, A, C, P.axis, 13);

        const angA = use45 ? 45 : 30;   // angle at the left vertex
        const angC = use45 ? 45 : 60;   // angle at the top vertex
        const thA = Math.atan2(bh, bw);
        arcMark(c, A, 26, -thA, 0, P.c2, 2.2);
        tag(c, angA + "°", A[0] + 38, y1 - 11, P.c2, "left", 12);
        arcMark(c, C, 24, Math.PI / 2, Math.PI / 2 + (Math.PI / 2 - thA), P.c2, 2.2);
        tag(c, angC + "°", C[0] - 30, C[1] + 26, P.c2, "right", 12);

        tag(c, use45 ? "1" : "√3", (A[0] + B[0]) / 2, y1 + 18, P.strong, "center", 13);
        tag(c, "1", B[0] + 12, (B[1] + C[1]) / 2, P.strong, "left", 13);
        tag(c, use45 ? "√2" : "2", (A[0] + C[0]) / 2 - 10, (A[1] + C[1]) / 2 - 12, P.strong, "right", 13);
        tag(c, use45 ? "Isosceles right-angled triangle, legs 1"
                     : "Half an equilateral triangle of side 2",
            W / 2, 18, P.text, "center", 11.5);
      },
    });

    function upd() {
      const ex = EXACT[ang];
      const t = ang * DEG;
      const dec = (v) => (isFinite(v) ? fmt(v, 4) : "undefined");
      fSin.setValue(ex.sin + "   =  " + dec(Math.sin(t)));
      fCos.setValue(ex.cos + "   =  " + dec(Math.cos(t)));
      fTan.setValue(ex.tan + (ang === 90 ? "" : "   =  " + dec(Math.tan(t))));
      sketch.draw();
      msg.className = "gl-msg good";
      if (ang === 0 || ang === 90) {
        msg.textContent = "0° and 90° are the ends of the range — read them off the sine and cosine curves rather than a triangle. tan 90° is undefined because cos 90° = 0.";
      } else if (ang === 45) {
        msg.textContent = "From the isosceles triangle: sin 45° = cos 45° = 1/√2 = √2/2, and tan 45° = 1 because the two legs are equal.";
      } else {
        msg.textContent = "From half an equilateral triangle of side 2: the short leg is 1, and Pythagoras gives the other leg as √3. Read sin, cos and tan straight off it.";
      }
    }
    upd();
  };

  /* 29 · Sine / cosine / tangent curve — every solution in 0° ≤ x ≤ 360° */
  build.wavelab = function (host) {
    const FNS = {
      sin: { f: (x) => Math.sin(x * DEG), color: "c1", label: "y = sin x" },
      cos: { f: (x) => Math.cos(x * DEG), color: "c3", label: "y = cos x" },
      tan: { f: (x) => Math.tan(x * DEG), color: "c4", label: "y = tan x" },
    };
    let key = "sin", k = 0.5;

    const panel = e("div", "gl-panel");
    const chips = chipRow(
      [{ label: "sine", k: "sin" }, { label: "cosine", k: "cos" }, { label: "tangent", k: "tan" }],
      (it) => { key = it.k; kS.set(clampK()); upd(); }, 0);
    const controls = e("div", "gl-controls");
    const cvBox = e("div", "gl-canvas");
    const canvas = document.createElement("canvas");
    cvBox.appendChild(canvas);
    const steps = e("div", "gl-steps");
    const msg = e("div", "gl-msg");

    const kS = slider("k in  f(x) = k", -1, 1, 0.05, 0.5, (v) => { k = v; upd(); });
    controls.appendChild(kS.el);

    panel.appendChild(chips.el);
    panel.appendChild(controls);
    panel.appendChild(cvBox);
    panel.appendChild(steps);
    panel.appendChild(msg);
    host.appendChild(panel);

    const plot = new Plot(canvas, { xmin: 0, xmax: 360, ymin: -1.4, ymax: 1.4, stepx: 45, stepy: 0.5, ratio: 0.5, minH: 200, maxH: 290 });

    function clampK() {
      if (key === "tan") { kS.input.min = -4; kS.input.max = 4; kS.input.step = 0.1; return Math.max(-4, Math.min(4, k)); }
      kS.input.min = -1; kS.input.max = 1; kS.input.step = 0.05;
      k = Math.max(-1, Math.min(1, k));
      return k;
    }

    function step(n, title, body) {
      const d = e("div", "gl-step");
      d.appendChild(e("span", "gl-step-n", n));
      d.appendChild(html("div", "gl-step-b", "<b>" + title + "</b><br>" + body));
      return d;
    }

    // all solutions of f(x) = k in [0, 360]
    function solutions() {
      if (key === "sin") {
        const p = Math.asin(Math.max(-1, Math.min(1, k))) / DEG;   // −90 … 90
        const raw = [p, 180 - p];
        return raw.map((x) => (x + 360) % 360).filter((x) => x <= 360).sort((a, b) => a - b);
      }
      if (key === "cos") {
        const p = Math.acos(Math.max(-1, Math.min(1, k))) / DEG;   // 0 … 180
        const raw = [p, 360 - p];
        return [...new Set(raw.map((x) => Math.round(x * 1e6) / 1e6))].sort((a, b) => a - b);
      }
      const p = Math.atan(k) / DEG;                                 // −90 … 90
      return [p, p + 180, p + 360].map((x) => x).filter((x) => x >= 0 && x <= 360).sort((a, b) => a - b);
    }

    function upd() {
      k = clampK();
      const F = FNS[key];
      const sols = solutions();
      const ymax = key === "tan" ? 4.4 : 1.4;
      plot.set({
        ymin: -ymax, ymax, stepy: key === "tan" ? 1 : 0.5,
        curves: [
          { f: F.f, color: F.color, label: F.label, lx: 8, ly: ymax * 0.82 },
          { f: () => k, color: "c2", width: 1.8, dash: true },
        ],
        guides: key === "tan" ? [{ x: 90, color: "faint" }, { x: 270, color: "faint" }] : [],
        points: sols.map((x) => ({ x, y: k, color: "c2", label: fmt(x, 1) + "°", dy: -11 })),
      });

      steps.replaceChildren();
      const nm = key;
      steps.appendChild(step("1", "Ask the calculator for the principal value",
        "x = " + nm + "⁻¹(" + fmt(k, 3) + ") = <b>" + fmt(sols.length ? (key === "cos" ? sols[0] : (key === "sin" ? (Math.asin(k) / DEG) : (Math.atan(k) / DEG))) : NaN, 1) + "°</b>"));
      steps.appendChild(step("2", "Use the symmetry of the curve",
        key === "sin" ? "sin θ = sin(180° − θ) — reflect in the line x = 90°."
        : key === "cos" ? "cos θ = cos(360° − θ) — reflect in the line x = 180°."
        : "tan repeats every 180°, so add 180° to get the next one."));
      steps.appendChild(step("3", "Keep the ones inside 0° ≤ x ≤ 360°",
        "<b>x = " + sols.map((s) => fmt(s, 1) + "°").join(" or ") + "</b>"));

      msg.className = "gl-msg good";
      msg.textContent = "The calculator gives you only the first of these — " + sols.length
        + " value" + (sols.length === 1 ? "" : "s") + " in the range here. Drag k and watch the crossings move.";
    }
    upd();
  };

  /* 30 · Sine rule / cosine rule solver, including the ambiguous case */
  build.rulelab = function (host) {
    const MODES = [
      { key: "sine-side", label: "Sine rule — find a side" },
      { key: "sine-angle", label: "Sine rule — find an angle" },
      { key: "cos-side", label: "Cosine rule — find a side" },
      { key: "cos-angle", label: "Cosine rule — find an angle" },
    ];
    let mode = "sine-side";

    const panel = e("div", "gl-panel");
    const chips = chipRow(MODES, (it) => { mode = it.key; layout(); }, 0);
    const form = e("div", "gl-form");
    const steps = e("div", "gl-steps");
    const msg = e("div", "gl-msg");

    const fA = field("angle A (°)", "40", null, upd);
    const fB = field("angle B (°)", "75", null, upd);
    const fa = field("side a", "8", null, upd);
    const fb = field("side b", "11", null, upd);
    const fc = field("side c", "10", null, upd);
    const fC = field("angle C (°)", "50", null, upd);

    panel.appendChild(chips.el);
    panel.appendChild(form);
    panel.appendChild(steps);
    panel.appendChild(msg);
    host.appendChild(panel);

    function group(title, items) {
      const g = e("div", "gl-form-group");
      g.appendChild(e("div", "gl-form-title", title));
      const row = e("div", "gl-form-row");
      items.forEach((i) => row.appendChild(i));
      g.appendChild(row);
      return g;
    }
    function step(n, title, body) {
      const d = e("div", "gl-step");
      d.appendChild(e("span", "gl-step-n", "Step " + n));
      d.appendChild(html("div", "gl-step-b", "<b>" + title + "</b><br>" + body));
      return d;
    }

    function layout() {
      form.replaceChildren();
      if (mode === "sine-side") form.appendChild(group("Matching pair a / sin A, plus the angle B opposite the side you want", [fa.el, fA.el, fB.el]));
      else if (mode === "sine-angle") form.appendChild(group("Matching pair a / sin A, plus the side b opposite the angle you want", [fa.el, fA.el, fb.el]));
      else if (mode === "cos-side") form.appendChild(group("Two sides and the angle between them", [fb.el, fc.el, fA.el]));
      else form.appendChild(group("All three sides — angle C is opposite side c", [fa.el, fb.el, fc.el]));
      upd();
    }

    function upd() {
      steps.replaceChildren();
      msg.className = "gl-msg";
      const A = fA.get(), B = fB.get(), a = fa.get(), b = fb.get(), c = fc.get();

      if (mode === "sine-side") {
        if (![a, A, B].every(isFinite) || a <= 0 || A <= 0 || B <= 0 || A + B >= 180) {
          msg.className = "gl-msg warn";
          msg.textContent = "Enter a positive side and two angles that add to less than 180°.";
          return;
        }
        const out = (a * Math.sin(B * DEG)) / Math.sin(A * DEG);
        steps.appendChild(step(1, "Write the sine rule the side way up", "a / sin A = b / sin B"));
        steps.appendChild(step(2, "Substitute",
          fmt(a, 3) + " / sin " + fmt(A, 1) + "° = b / sin " + fmt(B, 1) + "°"));
        steps.appendChild(step(3, "Rearrange and calculate",
          "b = " + fmt(a, 3) + " × sin " + fmt(B, 1) + "° ÷ sin " + fmt(A, 1) + "° = <b>" + fmt(out, 3) + "</b>"));
        msg.className = "gl-msg good";
        msg.textContent = "Sense check: the bigger angle faces the bigger side. B is "
          + (B > A ? "bigger" : "smaller") + " than A, so b should be "
          + (B > A ? "longer" : "shorter") + " than a — and " + fmt(out, 2) + " vs " + fmt(a, 2) + ". ✔";
      } else if (mode === "sine-angle") {
        if (![a, A, b].every(isFinite) || a <= 0 || b <= 0 || A <= 0 || A >= 180) {
          msg.className = "gl-msg warn";
          msg.textContent = "Enter two positive sides and an angle between 0° and 180°.";
          return;
        }
        const sinB = (b * Math.sin(A * DEG)) / a;
        if (sinB > 1) {
          steps.appendChild(step(1, "Write the sine rule the angle way up", "sin B / b = sin A / a"));
          steps.appendChild(step(2, "Substitute", "sin B = " + fmt(b, 3) + " × sin " + fmt(A, 1) + "° ÷ " + fmt(a, 3) + " = " + fmt(sinB, 4)));
          msg.className = "gl-msg bad";
          msg.textContent = "sin B came out greater than 1, which is impossible — no triangle exists with these measurements. Check the numbers.";
          return;
        }
        const B1 = Math.asin(sinB) / DEG;
        const B2 = 180 - B1;
        const ok2 = A + B2 < 180 && Math.abs(B2 - B1) > 1e-6;
        steps.appendChild(step(1, "Write the sine rule the angle way up", "sin B / b = sin A / a"));
        steps.appendChild(step(2, "Substitute",
          "sin B = " + fmt(b, 3) + " × sin " + fmt(A, 1) + "° ÷ " + fmt(a, 3) + " = " + fmt(sinB, 4)));
        steps.appendChild(step(3, "Inverse sine for the first answer", "B = sin⁻¹(" + fmt(sinB, 4) + ") = <b>" + fmt(B1, 1) + "°</b>"));
        steps.appendChild(step(4, "Test the obtuse alternative",
          "sin θ = sin(180° − θ), so try B = 180° − " + fmt(B1, 1) + "° = " + fmt(B2, 1) + "°.<br>"
          + "A + B = " + fmt(A, 1) + "° + " + fmt(B2, 1) + "° = " + fmt(A + B2, 1) + "° — "
          + (ok2 ? "still under 180°, so this triangle <b>also exists</b>." : "that is not under 180°, so this one is <b>rejected</b>.")));
        msg.className = "gl-msg " + (ok2 ? "good" : "");
        msg.textContent = ok2
          ? "Ambiguous case: B = " + fmt(B1, 1) + "° or " + fmt(B2, 1) + "°. Both triangles are valid — give both unless the question rules one out."
          : "Only one triangle here: B = " + fmt(B1, 1) + "°. Always test 180° − θ anyway; sometimes it fits.";
      } else if (mode === "cos-side") {
        if (![b, c, A].every(isFinite) || b <= 0 || c <= 0 || A <= 0 || A >= 180) {
          msg.className = "gl-msg warn";
          msg.textContent = "Enter two positive sides and an included angle between 0° and 180°.";
          return;
        }
        const a2 = b * b + c * c - 2 * b * c * Math.cos(A * DEG);
        const out = Math.sqrt(a2);
        steps.appendChild(step(1, "Write the cosine rule", "a² = b² + c² − 2bc cos A"));
        steps.appendChild(step(2, "Substitute",
          "a² = " + fmt(b, 3) + "² + " + fmt(c, 3) + "² − 2 × " + fmt(b, 3) + " × " + fmt(c, 3) + " × cos " + fmt(A, 1) + "°"));
        steps.appendChild(step(3, "Work out the right-hand side",
          "a² = " + fmt(b * b, 3) + " + " + fmt(c * c, 3) + " − " + fmt(2 * b * c * Math.cos(A * DEG), 3) + " = " + fmt(a2, 4)));
        steps.appendChild(step(4, "Square root — last of all", "a = √" + fmt(a2, 4) + " = <b>" + fmt(out, 3) + "</b>"));
        msg.className = "gl-msg good";
        msg.textContent = A > 90
          ? "A is obtuse, so cos A is negative and the −2bc cos A term ADDS on — side a comes out longer than either b or c."
          : "Do the whole right-hand side before you square root. Square-rooting each term separately is the classic error.";
      } else {
        if (![a, b, c].every(isFinite) || a <= 0 || b <= 0 || c <= 0) {
          msg.className = "gl-msg warn";
          msg.textContent = "Enter three positive side lengths.";
          return;
        }
        if (a + b <= c || a + c <= b || b + c <= a) {
          msg.className = "gl-msg bad";
          msg.textContent = "Those three lengths cannot form a triangle — each side must be shorter than the other two added together.";
          return;
        }
        const cosC = (a * a + b * b - c * c) / (2 * a * b);
        const C = Math.acos(Math.max(-1, Math.min(1, cosC))) / DEG;
        steps.appendChild(step(1, "Rearrange the cosine rule for the angle", "cos C = (a² + b² − c²) / (2ab)"));
        steps.appendChild(step(2, "Substitute",
          "cos C = (" + fmt(a * a, 3) + " + " + fmt(b * b, 3) + " − " + fmt(c * c, 3) + ") / (2 × " + fmt(a, 3) + " × " + fmt(b, 3) + ")"));
        steps.appendChild(step(3, "Simplify", "cos C = " + fmt(a * a + b * b - c * c, 3) + " / " + fmt(2 * a * b, 3) + " = " + fmt(cosC, 4)));
        steps.appendChild(step(4, "Inverse cosine", "C = cos⁻¹(" + fmt(cosC, 4) + ") = <b>" + fmt(C, 1) + "°</b>"));
        msg.className = "gl-msg good";
        msg.textContent = cosC < 0
          ? "cos C is negative, so C is obtuse — the calculator returns it correctly between 90° and 180°. C is opposite the longest side, so it must be the largest angle. ✔"
          : "cos C is positive, so C is acute. C is opposite side c; check it is the largest angle only if c is the longest side.";
      }
    }
    layout();
  };

  /* 31 · Cuboid explorer — face diagonal, space diagonal, angle with the base */
  build.cuboidlab = function (host) {
    const st = { l: 8, w: 6, h: 5, stage: 2 };

    const panel = e("div", "gl-panel");
    const controls = e("div", "gl-controls");
    const cvBox = e("div", "gl-canvas");
    const canvas = document.createElement("canvas");
    cvBox.appendChild(canvas);
    const stageChips = chipRow([
      { label: "1 · the cuboid", s: 0 },
      { label: "2 · base diagonal", s: 1 },
      { label: "3 · space diagonal", s: 2 },
      { label: "4 · angle with base", s: 3 },
    ], (it) => { st.stage = it.s; render(); }, 2);
    const steps = e("div", "gl-steps");
    const msg = e("div", "gl-msg");

    const sl = slider("length AB", 1, 14, 0.5, st.l, (v) => { st.l = v; render(); });
    const sw = slider("width BF", 1, 14, 0.5, st.w, (v) => { st.w = v; render(); });
    const sh = slider("height FG", 1, 14, 0.5, st.h, (v) => { st.h = v; render(); });
    [sl, sw, sh].forEach((s) => controls.appendChild(s.el));

    panel.appendChild(controls);
    panel.appendChild(stageChips.el);
    panel.appendChild(cvBox);
    panel.appendChild(steps);
    panel.appendChild(msg);
    host.appendChild(panel);

    const sketch = new Sketch(canvas, {
      ratio: 0.66, minH: 230, maxH: 330,
      render(c, W, H, P) {
        const { l, w, h } = st;
        // isometric-ish projection: x right, y up, z back-right
        const span = Math.max(l + w * 0.55, h + w * 0.45);
        const u = Math.min((W - 96) / (l + w * 0.55), (H - 72) / (h + w * 0.45));
        const dz = [w * 0.55 * u, -w * 0.45 * u];
        const ox = (W - (l * u + dz[0])) / 2;
        const oy = (H + (h * u + Math.abs(dz[1]))) / 2 - Math.abs(dz[1]) * 0.5;
        const p = (x, y, z) => [ox + x * u + z * dz[0] / w, oy - y * u + z * dz[1] / w];

        const A = p(0, 0, 0), B = p(l, 0, 0), Fb = p(l, 0, w), Eb = p(0, 0, w);
        const D = p(0, h, 0), Cc = p(l, h, 0), G = p(l, h, w), Hh = p(0, h, w);

        fillPoly(c, [A, B, Fb, Eb], P.soft);
        // hidden edges from E
        strokePath(c, [A, Eb], P.faint, 1.8, [5, 4]);
        strokePath(c, [Eb, Fb], P.faint, 1.8, [5, 4]);
        strokePath(c, [Eb, Hh], P.faint, 1.8, [5, 4]);
        // visible edges
        strokePath(c, [A, B, Cc, D, A], P.c1, 2.2);
        strokePath(c, [B, Fb, G, Cc], P.c1, 2.2);
        strokePath(c, [D, Hh, G], P.c1, 2.2);

        const base = Math.hypot(l, w), space = Math.hypot(l, w, h);
        if (st.stage >= 1) {
          strokePath(c, [A, Fb], P.c3, 2.6);
          tagOn(c, P, "AF = " + fmt(base, 2), (A[0] + Fb[0]) / 2, (A[1] + Fb[1]) / 2 + 15, P.c3, "center", 12);
        }
        if (st.stage >= 2) {
          strokePath(c, [A, G], P.c2, 3);
          tagOn(c, P, "AG = " + fmt(space, 2), (A[0] + G[0]) / 2 - 6, (A[1] + G[1]) / 2 - 12, P.c2, "center", 12.5);
          strokePath(c, [Fb, G], P.c2, 2, [5, 4]);
        }
        if (st.stage >= 3) {
          const a0 = Math.atan2(G[1] - A[1], G[0] - A[0]);
          const a1 = Math.atan2(Fb[1] - A[1], Fb[0] - A[0]);
          arcMark(c, A, 34, Math.min(a0, a1), Math.max(a0, a1), P.c5, 2.4);
          tagOn(c, P, fmt(Math.atan2(h, base) / DEG, 1) + "°", A[0] + 50, A[1] - 16, P.c5, "left", 12.5);
        }

        // vertex labels + edge lengths
        dot(c, A[0], A[1], P.c1, P.bg); tag(c, "A", A[0] - 12, A[1] + 8, P.strong, "center", 12);
        dot(c, B[0], B[1], P.c1, P.bg); tag(c, "B", B[0] + 4, B[1] + 14, P.strong, "center", 12);
        dot(c, Fb[0], Fb[1], P.c1, P.bg); tag(c, "F", Fb[0] + 13, Fb[1] + 6, P.strong, "center", 12);
        dot(c, G[0], G[1], P.c2, P.bg); tag(c, "G", G[0] + 13, G[1] - 4, P.c2, "center", 12);
        tag(c, fmt(l, 1), (A[0] + B[0]) / 2, A[1] + 15, P.text, "center", 11);
        tag(c, fmt(w, 1), (B[0] + Fb[0]) / 2 + 4, (B[1] + Fb[1]) / 2 + 12, P.text, "center", 11);
        tag(c, fmt(h, 1), Fb[0] + 15, (Fb[1] + G[1]) / 2, P.text, "left", 11);
      },
    });

    function step(n, title, body) {
      const d = e("div", "gl-step");
      d.appendChild(e("span", "gl-step-n", "Step " + n));
      d.appendChild(html("div", "gl-step-b", "<b>" + title + "</b><br>" + body));
      return d;
    }

    function render() {
      const { l, w, h } = st;
      const base = Math.hypot(l, w), space = Math.hypot(l, w, h);
      const ang = Math.atan2(h, base) / DEG;
      sketch.draw();
      steps.replaceChildren();
      msg.className = "gl-msg good";

      if (st.stage === 0) {
        steps.appendChild(step("★", "Find the right-angled triangle first",
          "Nothing new happens in 3D — you are still only ever using Pythagoras and SOH CAH TOA. Click through stages 2, 3 and 4."));
        msg.textContent = "Every vertical edge meets the horizontal base at 90°. That is what makes the triangles right-angled.";
        return;
      }
      steps.appendChild(step(1, "Base diagonal — triangle ABF, right-angled at B",
        "AF² = AB² + BF² = " + fmt(l, 1) + "² + " + fmt(w, 1) + "² = " + fmt(l * l, 2) + " + " + fmt(w * w, 2)
        + " = " + fmt(l * l + w * w, 2) + " → <b>AF = " + fmt(base, 3) + "</b>"));
      if (st.stage >= 2) {
        steps.appendChild(step(2, "Space diagonal — triangle AFG, right-angled at F",
          "FG is vertical, so AG² = AF² + FG² = " + fmt(base * base, 2) + " + " + fmt(h * h, 2)
          + " = " + fmt(space * space, 2) + " → <b>AG = " + fmt(space, 3) + "</b>"));
        steps.appendChild(step("★", "The one-line shortcut (cuboids only)",
          "AG = √(l² + w² + h²) = √" + fmt(space * space, 2) + " = <b>" + fmt(space, 3) + "</b> — same answer."));
      }
      if (st.stage >= 3) {
        steps.appendChild(step(3, "Angle between AG and the base",
          "The projection of AG onto the base is AF, so the angle is ∠GAF.<br>"
          + "tan ∠GAF = FG / AF = " + fmt(h, 1) + " / " + fmt(base, 3) + " = " + fmt(h / base, 4)
          + " → <b>" + fmt(ang, 1) + "°</b>"));
        msg.textContent = "The angle with the base is always under 90°. Here it is " + fmt(ang, 1)
          + "° — raise the height slider and watch it climb towards 90° without ever reaching it.";
        return;
      }
      msg.textContent = "AG = " + fmt(space, 3) + " is the longest straight line that fits inside the cuboid — longer than any edge or face diagonal. Check: the longest edge is " + fmt(Math.max(l, w, h), 1) + ".";
    }
    render();
  };

  /* 32 · Square-based pyramid — half a side vs half a diagonal */
  build.pyramidlab = function (host) {
    const st = { s: 6, h: 8, show: "edge" };

    const panel = e("div", "gl-panel");
    const controls = e("div", "gl-controls");
    const chips = chipRow([
      { label: "Slant edge VA", k: "edge" },
      { label: "Slant height VN", k: "height" },
      { label: "Angle edge / base", k: "aedge" },
      { label: "Angle face / base", k: "aface" },
    ], (it) => { st.show = it.k; render(); }, 0);
    const cvBox = e("div", "gl-canvas");
    const canvas = document.createElement("canvas");
    cvBox.appendChild(canvas);
    const steps = e("div", "gl-steps");
    const msg = e("div", "gl-msg");

    const ss = slider("base side s", 2, 14, 0.5, st.s, (v) => { st.s = v; render(); });
    const sh = slider("vertical height h", 2, 16, 0.5, st.h, (v) => { st.h = v; render(); });
    [ss, sh].forEach((x) => controls.appendChild(x.el));

    panel.appendChild(controls);
    panel.appendChild(chips.el);
    panel.appendChild(cvBox);
    panel.appendChild(steps);
    panel.appendChild(msg);
    host.appendChild(panel);

    const sketch = new Sketch(canvas, {
      ratio: 0.68, minH: 240, maxH: 340,
      render(c, W, H, P) {
        const { s, h } = st;
        const u = Math.min((W - 100) / (s * 1.55), (H - 70) / (h + s * 0.5));
        const dz = [s * 0.55 * u, -s * 0.42 * u];
        const ox = (W - (s * u + dz[0])) / 2;
        const oy = (H + h * u * 0.55 + s * 0.42 * u) / 2 + s * 0.1 * u;
        const p = (x, y, z) => [ox + x * u + (z / s) * dz[0], oy - y * u + (z / s) * dz[1]];

        const A = p(0, 0, 0), B = p(s, 0, 0), C = p(s, 0, s), D = p(0, 0, s);
        const M = p(s / 2, 0, s / 2), V = p(s / 2, h, s / 2), N = p(s / 2, 0, 0);

        fillPoly(c, [A, B, C, D], P.soft);
        strokePath(c, [A, B, C], P.c1, 2.2);
        strokePath(c, [C, D, A], P.faint, 1.8, [5, 4]);
        strokePath(c, [A, V], P.c1, 2.2);
        strokePath(c, [B, V], P.c1, 2.2);
        strokePath(c, [C, V], P.c1, 2.2);
        strokePath(c, [D, V], P.faint, 1.8, [5, 4]);
        strokePath(c, [M, V], P.c2, 2.2, [6, 4]);          // vertical height
        rightAngle(c, M, V, A, P.axis, 10);

        const half = s / 2, diag = (s * Math.SQRT2) / 2;
        if (st.show === "edge" || st.show === "aedge") {
          strokePath(c, [A, M], P.c5, 2.4, [5, 4]);
          strokePath(c, [A, V], P.c5, 3);
          tagOn(c, P, "MA = " + fmt(diag, 2), A[0] + (M[0] - A[0]) * 0.72, A[1] + (M[1] - A[1]) * 0.72 + 15, P.c5, "center", 11.5);
          tagOn(c, P, "VA = " + fmt(Math.hypot(h, diag), 2), (A[0] + V[0]) / 2 - 12, (A[1] + V[1]) / 2, P.c5, "right", 12);
          if (st.show === "aedge") {
            const a0 = Math.atan2(V[1] - A[1], V[0] - A[0]);
            const a1 = Math.atan2(M[1] - A[1], M[0] - A[0]);
            arcMark(c, A, 30, Math.min(a0, a1), Math.max(a0, a1), P.c5, 2.4);
            const mid = (Math.min(a0, a1) + Math.max(a0, a1)) / 2;
            tagOn(c, P, fmt(Math.atan2(h, diag) / DEG, 1) + "°", A[0] + Math.cos(mid) * 52, A[1] + Math.sin(mid) * 52, P.c5, "center", 12);
          }
        } else {
          strokePath(c, [M, N], P.c3, 2.4, [5, 4]);
          strokePath(c, [N, V], P.c3, 3);
          dot(c, N[0], N[1], P.c3, P.bg);
          tag(c, "N", N[0] - 4, N[1] + 15, P.c3, "center", 12);
          // sit MN's label near M's end of the segment so it clears the angle arc at N
          tagOn(c, P, "MN = " + fmt(half, 2), N[0] + (M[0] - N[0]) * 0.9 + 30, N[1] + (M[1] - N[1]) * 0.9 + 22, P.c3, "center", 11.5);
          tagOn(c, P, "VN = " + fmt(Math.hypot(h, half), 2), (N[0] + V[0]) / 2 - 10, (N[1] + V[1]) / 2, P.c3, "right", 12);
          if (st.show === "aface") {
            const a0 = Math.atan2(V[1] - N[1], V[0] - N[0]);
            const a1 = Math.atan2(M[1] - N[1], M[0] - N[0]);
            arcMark(c, N, 28, Math.min(a0, a1), Math.max(a0, a1), P.c3, 2.4);
            const mid = (Math.min(a0, a1) + Math.max(a0, a1)) / 2;   // put the reading just outside the arc
            tagOn(c, P, fmt(Math.atan2(h, half) / DEG, 1) + "°", N[0] - 34, N[1] - 30, P.c3, "center", 12);
          }
        }

        dot(c, V[0], V[1], P.c2, P.bg); tag(c, "V", V[0], V[1] - 14, P.c2, "center", 12.5);
        dot(c, M[0], M[1], P.c2, P.bg); tag(c, "M", M[0] + 12, M[1] + 8, P.c2, "center", 12);
        dot(c, A[0], A[1], P.c1, P.bg); tag(c, "A", A[0] - 12, A[1] + 8, P.strong, "center", 12);
        dot(c, B[0], B[1], P.c1, P.bg); tag(c, "B", B[0] + 6, B[1] + 14, P.strong, "center", 12);
        dot(c, C[0], C[1], P.c1, P.bg); tag(c, "C", C[0] + 13, C[1] + 4, P.strong, "center", 12);
        tagOn(c, P, "h = " + fmt(h, 1), M[0] + 10, (M[1] + V[1]) / 2, P.c2, "left", 11.5);
      },
    });

    function step(n, title, body) {
      const d = e("div", "gl-step");
      d.appendChild(e("span", "gl-step-n", "Step " + n));
      d.appendChild(html("div", "gl-step-b", "<b>" + title + "</b><br>" + body));
      return d;
    }

    function render() {
      const { s, h } = st;
      const half = s / 2, diag = (s * Math.SQRT2) / 2;
      const VA = Math.hypot(h, diag), VN = Math.hypot(h, half);
      const aEdge = Math.atan2(h, diag) / DEG, aFace = Math.atan2(h, half) / DEG;
      sketch.draw();
      steps.replaceChildren();
      msg.className = "gl-msg good";

      if (st.show === "edge") {
        steps.appendChild(step(1, "Half the base diagonal", "AC = √(" + fmt(s, 1) + "² + " + fmt(s, 1) + "²) = √" + fmt(2 * s * s, 2) + " = " + fmt(s * Math.SQRT2, 3) + ", so MA = <b>" + fmt(diag, 3) + "</b>"));
        steps.appendChild(step(2, "Triangle VMA is right-angled at M", "VA² = VM² + MA² = " + fmt(h, 1) + "² + " + fmt(diag, 3) + "² = " + fmt(h * h, 2) + " + " + fmt(diag * diag, 2) + " = " + fmt(VA * VA, 3)));
        steps.appendChild(step(3, "Square root", "VA = <b>" + fmt(VA, 3) + "</b>"));
        msg.textContent = "The slant EDGE runs from the apex to a corner, so it uses half the DIAGONAL. Keep MA as an exact surd where you can — (s√2/2)² is exact.";
      } else if (st.show === "height") {
        steps.appendChild(step(1, "Half a base side", "MN = s / 2 = " + fmt(s, 1) + " / 2 = <b>" + fmt(half, 3) + "</b>"));
        steps.appendChild(step(2, "Triangle VMN is right-angled at M", "VN² = VM² + MN² = " + fmt(h * h, 2) + " + " + fmt(half * half, 2) + " = " + fmt(VN * VN, 3)));
        steps.appendChild(step(3, "Square root", "VN = <b>" + fmt(VN, 3) + "</b>"));
        msg.textContent = "The slant HEIGHT runs from the apex to the MIDPOINT of a base edge, so it uses half a SIDE. VN = " + fmt(VN, 3) + " is shorter than the slant edge VA = " + fmt(VA, 3) + ". ✔";
      } else if (st.show === "aedge") {
        steps.appendChild(step(1, "Project VA onto the base", "The projection is MA, so the angle wanted is ∠VAM."));
        steps.appendChild(step(2, "Use tan in triangle VMA", "tan ∠VAM = VM / MA = " + fmt(h, 1) + " / " + fmt(diag, 3) + " = " + fmt(h / diag, 4)));
        steps.appendChild(step(3, "Inverse tan", "∠VAM = <b>" + fmt(aEdge, 1) + "°</b>"));
        msg.textContent = "Half a DIAGONAL (" + fmt(diag, 2) + ") — not half a side. Using half a side by mistake would give " + fmt(aFace, 1) + "° instead of " + fmt(aEdge, 1) + "°.";
      } else {
        steps.appendChild(step(1, "The two planes meet along AB", "Let N be the midpoint of AB. VN ⟂ AB and MN ⟂ AB, so the angle is ∠VNM."));
        steps.appendChild(step(2, "Use tan in triangle VMN", "tan ∠VNM = VM / MN = " + fmt(h, 1) + " / " + fmt(half, 3) + " = " + fmt(h / half, 4)));
        steps.appendChild(step(3, "Inverse tan", "∠VNM = <b>" + fmt(aFace, 1) + "°</b>"));
        msg.textContent = "Half a SIDE (" + fmt(half, 2) + ") for a FACE angle. Face " + fmt(aFace, 1) + "° > edge " + fmt(aEdge, 1) + "° — the face leans back more steeply than the edge, always.";
      }
    }
    render();
  };

  /* 33 · Scale converter — ratio ↔ statement, map ↔ real, and areas */
  build.scalelab = function (host) {
    const panel = e("div", "gl-panel");
    const MODES = [
      { key: "toreal", label: "Map → real" },
      { key: "tomap", label: "Real → map" },
      { key: "area", label: "Areas" },
    ];
    let mode = "toreal";

    const chips = chipRow(MODES, (it) => { mode = it.key; layout(); }, 0);
    const form = e("div", "gl-form");
    const steps = e("div", "gl-steps");
    const msg = e("div", "gl-msg");

    const ratio = field("Scale  1 :", "50000", "wide", upd);
    const mapLen = field("Map length", "6", null, upd);
    const mapUnit = picker("", [{ value: "cm", label: "cm" }, { value: "mm", label: "mm" }], upd);
    const realLen = field("Real distance", "1.75", null, upd);
    const realUnit = picker("", [{ value: "km", label: "km" }, { value: "m", label: "m" }, { value: "cm", label: "cm" }], upd);
    const mapArea = field("Map area (cm²)", "8", null, upd);

    panel.appendChild(chips.el);
    panel.appendChild(form);
    panel.appendChild(steps);
    panel.appendChild(msg);
    host.appendChild(panel);

    function group(title, items) {
      const g = e("div", "gl-form-group");
      g.appendChild(e("div", "gl-form-title", title));
      const row = e("div", "gl-form-row");
      items.forEach((i) => row.appendChild(i));
      g.appendChild(row);
      return g;
    }
    function step(n, title, body) {
      const d = e("div", "gl-step");
      d.appendChild(e("span", "gl-step-n", "Step " + n));
      d.appendChild(html("div", "gl-step-b", "<b>" + title + "</b><br>" + body));
      return d;
    }
    function layout() {
      form.replaceChildren();
      form.appendChild(group("The scale", [ratio.el]));
      if (mode === "toreal") form.appendChild(group("Measured on the map", [mapLen.el, mapUnit.el]));
      else if (mode === "tomap") form.appendChild(group("The real distance", [realLen.el, realUnit.el]));
      else form.appendChild(group("Area measured on the map", [mapArea.el]));
      upd();
    }
    // a sensible unit for a length given in cm
    function pretty(cm) {
      if (Math.abs(cm) >= 100000) return fmt(cm / 100000, 4) + " km";
      if (Math.abs(cm) >= 100) return fmt(cm / 100, 3) + " m";
      return fmt(cm, 3) + " cm";
    }
    // map scales are usually quoted in km once you are past 100 m, so give both
    function bothUnits(cm) {
      const p = pretty(cm);
      return Math.abs(cm) >= 10000 && Math.abs(cm) < 100000
        ? p + " = " + fmt(cm / 100000, 4) + " km"
        : p;
    }

    function upd() {
      steps.replaceChildren();
      msg.className = "gl-msg";
      const n = ratio.get();
      if (!isFinite(n) || n <= 1) {
        msg.className = "gl-msg warn";
        msg.textContent = "Enter the right-hand number of the scale, e.g. 50000 for 1 : 50 000. It must be bigger than 1.";
        return;
      }
      const oneCm = n;                     // 1 cm on the map = n cm in real life
      const statement = "1 cm represents " + bothUnits(oneCm);
      steps.appendChild(step(1, "Read the ratio as a statement",
        "1 : " + fmt(n, 0) + " means 1 cm on the map = " + fmt(n, 0) + " cm in real life.<br><b>" + statement + "</b>"));

      if (mode === "toreal") {
        const L = mapLen.get();
        if (!isFinite(L) || L <= 0) { msg.className = "gl-msg warn"; msg.textContent = "Enter a positive map length."; return; }
        const cmOnMap = mapUnit.get() === "mm" ? L / 10 : L;
        const realCm = cmOnMap * n;
        steps.appendChild(step(2, "Map → real means MULTIPLY",
          fmt(cmOnMap, 3) + " cm × " + fmt(n, 0) + " = " + fmt(realCm, 0) + " cm"));
        steps.appendChild(step(3, "Convert to a sensible unit", "<b>" + pretty(realCm) + "</b>"));
        msg.className = "gl-msg good";
        msg.textContent = "Real distances are always bigger than map distances. Faster route: use the statement instead of the ratio — "
          + fmt(cmOnMap, 3) + " × (" + bothUnits(oneCm) + ") gives the same answer in one step.";
      } else if (mode === "tomap") {
        const L = realLen.get();
        if (!isFinite(L) || L <= 0) { msg.className = "gl-msg warn"; msg.textContent = "Enter a positive real distance."; return; }
        const u = realUnit.get();
        const realCm = L * (u === "km" ? 100000 : u === "m" ? 100 : 1);
        const onMap = realCm / n;
        steps.appendChild(step(2, "Put the real distance into centimetres first",
          fmt(L, 4) + " " + u + " = <b>" + fmt(realCm, 0) + " cm</b>"));
        steps.appendChild(step(3, "Real → map means DIVIDE",
          fmt(realCm, 0) + " ÷ " + fmt(n, 0) + " = <b>" + fmt(onMap, 3) + " cm</b> on the map"));
        msg.className = "gl-msg good";
        msg.textContent = "Converting to a common unit before dividing is the whole game — divide 1.75 by 250 without converting and you get 0.007 cm, which is nonsense.";
      } else {
        const Am = mapArea.get();
        if (!isFinite(Am) || Am <= 0) { msg.className = "gl-msg warn"; msg.textContent = "Enter a positive map area in cm²."; return; }
        const kmPerCm = n / 100000;
        const kmSqPerCmSq = kmPerCm * kmPerCm;
        steps.appendChild(step(2, "Lengths scale by this factor",
          "1 cm represents " + fmt(kmPerCm, 5) + " km"));
        steps.appendChild(step(3, "So AREAS scale by the SQUARE of it",
          "1 cm² represents " + fmt(kmPerCm, 5) + "² = <b>" + fmt(kmSqPerCmSq, 6) + " km²</b>"));
        steps.appendChild(step(4, "Multiply by the map area",
          fmt(Am, 3) + " × " + fmt(kmSqPerCmSq, 6) + " = <b>" + fmt(Am * kmSqPerCmSq, 4) + " km²</b>"));
        msg.className = "gl-msg good";
        msg.textContent = "Scaling the area by the LENGTH factor is the classic slip. If lengths scale by n, areas scale by n² (and volumes by n³).";
      }
    }
    layout();
  };

  /* 34 · Bearing dial — three figures, clockwise from North, plus the back bearing */
  build.bearinglab = function (host) {
    let bearing = 62;
    const panel = e("div", "gl-panel");
    const controls = e("div", "gl-controls");
    const cvBox = e("div", "gl-canvas");
    const canvas = document.createElement("canvas");
    cvBox.appendChild(canvas);
    const facts = e("div", "gl-facts");
    const msg = e("div", "gl-msg");

    const bS = slider("Bearing of B from A", 0, 359, 1, bearing, (v) => { bearing = v; upd(); });
    controls.appendChild(bS.el);
    const fThree = factRow("Written properly", "");
    const fCompass = factRow("Nearest compass point", "");
    const fBack = factRow("Back bearing (A from B)", "");
    [fThree, fCompass, fBack].forEach((f) => facts.appendChild(f));

    panel.appendChild(controls);
    panel.appendChild(cvBox);
    panel.appendChild(facts);
    panel.appendChild(msg);
    host.appendChild(panel);

    const three = (b) => String(Math.round(b) % 360).padStart(3, "0") + "°";
    const POINTS = ["N", "NNE", "NE", "ENE", "E", "ESE", "SE", "SSE", "S", "SSW", "SW", "WSW", "W", "WNW", "NW", "NNW"];

    // canvas angle for a bearing: 0° is straight up, then clockwise
    const scr = (b) => (b - 90) * DEG;

    const sketch = new Sketch(canvas, {
      ratio: 0.74, minH: 250, maxH: 340,
      render(c, W, H, P) {
        const cx = W / 2, cy = H / 2 + 6;
        const R = Math.min(W, H) / 2 - 34;

        // compass rose
        c.save();
        c.strokeStyle = P.grid2; c.lineWidth = 1;
        c.beginPath(); c.arc(cx, cy, R, 0, 7); c.stroke();
        for (let a = 0; a < 360; a += 15) {
          const big = a % 45 === 0;
          const s = scr(a);
          const r0 = R - (big ? 11 : 6);
          c.strokeStyle = big ? P.axis : P.grid2;
          c.lineWidth = big ? 1.4 : 1;
          c.beginPath();
          c.moveTo(cx + Math.cos(s) * r0, cy + Math.sin(s) * r0);
          c.lineTo(cx + Math.cos(s) * R, cy + Math.sin(s) * R);
          c.stroke();
        }
        c.restore();
        ["N", "E", "S", "W"].forEach((n, i) => {
          const s = scr(i * 90);
          tag(c, n, cx + Math.cos(s) * (R + 16), cy + Math.sin(s) * (R + 16), P.text, "center", 11.5);
        });

        // North line at A
        strokePath(c, [[cx, cy], [cx, cy - R]], P.c1, 2.2);
        arrowHead(c, cx, cy - R, -Math.PI / 2, P.c1, 8);
        tag(c, "N", cx - 13, cy - R + 8, P.c1, "center", 12.5);

        // the clockwise arc from North
        const sweep = bearing * DEG;
        c.save();
        c.strokeStyle = P.c3; c.lineWidth = 2.6;
        c.beginPath();
        c.arc(cx, cy, R * 0.42, scr(0), scr(0) + sweep);
        c.stroke();
        c.restore();
        const mid = scr(bearing / 2);
        tagOn(c, P, three(bearing), cx + Math.cos(mid) * (R * 0.42 + 20), cy + Math.sin(mid) * (R * 0.42 + 20), P.c3, "center", 13);

        // A → B
        const s = scr(bearing);
        const Bx = cx + Math.cos(s) * R * 0.92, By = cy + Math.sin(s) * R * 0.92;
        strokePath(c, [[cx, cy], [Bx, By]], P.c2, 2.8);
        arrowHead(c, Bx, By, s, P.c2, 8);
        // North line at B (parallel — that is why the back bearing works)
        strokePath(c, [[Bx, By], [Bx, By - R * 0.5]], P.c1, 1.8, [6, 4]);
        tag(c, "N", Bx - 12, By - R * 0.5 + 6, P.c1, "center", 11);

        dot(c, cx, cy, P.strong, P.bg, 5); tag(c, "A", cx - 15, cy + 13, P.strong, "center", 12.5);
        dot(c, Bx, By, P.c2, P.bg, 5); tag(c, "B", Bx + 14, By + 6, P.c2, "center", 12.5);
      },
    });

    function upd() {
      sketch.draw();
      const back = bearing < 180 ? bearing + 180 : bearing - 180;
      fThree.setValue(three(bearing) + "  — three figures, always");
      fCompass.setValue(POINTS[Math.round(bearing / 22.5) % 16]);
      fBack.setValue(three(back) + "   (" + (bearing < 180 ? "under 180°, so ADD 180" : "180° or more, so SUBTRACT 180") + ")");
      msg.className = "gl-msg good";
      msg.textContent = bearing < 180
        ? "The bearing is under 180°, so add: " + Math.round(bearing) + " + 180 = " + Math.round(back) + "."
        : "Adding would give " + (Math.round(bearing) + 180) + "°, which is not a valid bearing — so subtract instead: " + Math.round(bearing) + " − 180 = " + Math.round(back) + ".";
    }
    upd();
  };

  /* 35 · Two-leg journey — resultant distance and bearing */
  build.navlab = function (host) {
    const st = { d1: 8, b1: 60, d2: 6, b2: 150 };

    const panel = e("div", "gl-panel");
    const form = e("div", "gl-form");
    const cvBox = e("div", "gl-canvas");
    const canvas = document.createElement("canvas");
    cvBox.appendChild(canvas);
    const steps = e("div", "gl-steps");
    const msg = e("div", "gl-msg");

    const d1 = field("Leg 1 distance", "8", null, upd);
    const b1 = field("on bearing (°)", "60", null, upd);
    const d2 = field("Leg 2 distance", "6", null, upd);
    const b2 = field("on bearing (°)", "150", null, upd);

    const g1 = e("div", "gl-form-group");
    g1.appendChild(e("div", "gl-form-title", "P → Q"));
    const r1 = e("div", "gl-form-row"); r1.appendChild(d1.el); r1.appendChild(b1.el); g1.appendChild(r1);
    const g2 = e("div", "gl-form-group");
    g2.appendChild(e("div", "gl-form-title", "Q → R"));
    const r2 = e("div", "gl-form-row"); r2.appendChild(d2.el); r2.appendChild(b2.el); g2.appendChild(r2);
    form.appendChild(g1); form.appendChild(g2);

    panel.appendChild(form);
    panel.appendChild(cvBox);
    panel.appendChild(steps);
    panel.appendChild(msg);
    host.appendChild(panel);

    // world coordinates: east = +x, north = +y
    function pts() {
      const P0 = { x: 0, y: 0 };
      const Q = { x: st.d1 * Math.sin(st.b1 * DEG), y: st.d1 * Math.cos(st.b1 * DEG) };
      const R = { x: Q.x + st.d2 * Math.sin(st.b2 * DEG), y: Q.y + st.d2 * Math.cos(st.b2 * DEG) };
      return { P0, Q, R };
    }

    const sketch = new Sketch(canvas, {
      ratio: 0.72, minH: 250, maxH: 350,
      render(c, W, H, P) {
        const { P0, Q, R } = pts();
        const xs = [P0.x, Q.x, R.x], ys = [P0.y, Q.y, R.y];
        const pad = 52;
        const spanX = Math.max(...xs) - Math.min(...xs) || 1;
        const spanY = Math.max(...ys) - Math.min(...ys) || 1;
        const u = Math.min((W - pad * 2) / spanX, (H - pad * 2) / spanY);
        const cxm = (Math.max(...xs) + Math.min(...xs)) / 2;
        const cym = (Math.max(...ys) + Math.min(...ys)) / 2;
        const sc = (p) => [W / 2 + (p.x - cxm) * u, H / 2 - (p.y - cym) * u];
        const sp = sc(P0), sq = sc(Q), sr = sc(R);

        // North lines
        [[sp, "P"], [sq, "Q"]].forEach(([s]) => strokePath(c, [s, [s[0], s[1] - 46]], P.c1, 1.6, [6, 4]));
        tag(c, "N", sp[0] - 11, sp[1] - 42, P.c1, "center", 11);
        tag(c, "N", sq[0] - 11, sq[1] - 42, P.c1, "center", 11);

        strokePath(c, [sp, sq], P.c2, 2.8);
        strokePath(c, [sq, sr], P.c2, 2.8);
        strokePath(c, [sp, sr], P.c3, 2.6, [7, 5]);

        tagOn(c, P, fmt(st.d1, 2), (sp[0] + sq[0]) / 2 - 10, (sp[1] + sq[1]) / 2 - 10, P.c2, "center", 11.5);
        tagOn(c, P, fmt(st.d2, 2), (sq[0] + sr[0]) / 2 + 14, (sq[1] + sr[1]) / 2, P.c2, "center", 11.5);
        const PR = Math.hypot(R.x, R.y);
        tagOn(c, P, "PR = " + fmt(PR, 3), (sp[0] + sr[0]) / 2, (sp[1] + sr[1]) / 2 + 16, P.c3, "center", 12);

        // the turn at Q — a right angle gets the square, anything else an arc
        const turn = ((st.b2 - st.b1) % 360 + 360) % 360;
        if (Math.abs(turn - 90) < 0.5) rightAngle(c, sq, sp, sr, P.c5, 11);

        dot(c, sp[0], sp[1], P.strong, P.bg, 5); tag(c, "P", sp[0] - 14, sp[1] + 10, P.strong, "center", 12.5);
        dot(c, sq[0], sq[1], P.strong, P.bg, 5); tag(c, "Q", sq[0] + 14, sq[1] - 4, P.strong, "center", 12.5);
        dot(c, sr[0], sr[1], P.c3, P.bg, 5); tag(c, "R", sr[0] + 14, sr[1] + 6, P.c3, "center", 12.5);
      },
    });

    function step(n, title, body) {
      const d = e("div", "gl-step");
      d.appendChild(e("span", "gl-step-n", "Step " + n));
      d.appendChild(html("div", "gl-step-b", "<b>" + title + "</b><br>" + body));
      return d;
    }

    function upd() {
      const v = { d1: d1.get(), b1: b1.get(), d2: d2.get(), b2: b2.get() };
      steps.replaceChildren();
      msg.className = "gl-msg";
      if (!Object.values(v).every(isFinite) || v.d1 <= 0 || v.d2 <= 0) {
        msg.className = "gl-msg warn";
        msg.textContent = "Enter positive distances and a bearing between 0° and 360° for each leg.";
        return;
      }
      Object.assign(st, { d1: v.d1, d2: v.d2, b1: ((v.b1 % 360) + 360) % 360, b2: ((v.b2 % 360) + 360) % 360 });
      sketch.draw();

      const { R } = pts();
      const PR = Math.hypot(R.x, R.y);
      let bPR = (Math.atan2(R.x, R.y) / DEG + 360) % 360;   // atan2(east, north) = bearing
      const turn = ((st.b2 - st.b1) % 360 + 360) % 360;
      const interior = turn <= 180 ? 180 - turn : turn - 180;

      steps.appendChild(step(1, "Find the angle inside the triangle at Q",
        "The bearing turns from " + String(Math.round(st.b1)).padStart(3, "0") + "° to "
        + String(Math.round(st.b2)).padStart(3, "0") + "°, a change of " + fmt(turn, 1) + "°.<br>"
        + "Because the North lines are parallel, the interior angle PQR = <b>" + fmt(interior, 1) + "°</b>"
        + (Math.abs(interior - 90) < 0.5 ? " — a right angle, so Pythagoras works." : " — not 90°, so use the cosine rule.")));

      if (Math.abs(interior - 90) < 0.5) {
        steps.appendChild(step(2, "Pythagoras for PR",
          "PR² = " + fmt(st.d1, 2) + "² + " + fmt(st.d2, 2) + "² = " + fmt(st.d1 * st.d1, 2) + " + "
          + fmt(st.d2 * st.d2, 2) + " = " + fmt(PR * PR, 3) + " → <b>PR = " + fmt(PR, 3) + "</b>"));
      } else {
        steps.appendChild(step(2, "Cosine rule for PR",
          "PR² = " + fmt(st.d1, 2) + "² + " + fmt(st.d2, 2) + "² − 2 × " + fmt(st.d1, 2) + " × " + fmt(st.d2, 2)
          + " × cos " + fmt(interior, 1) + "° = " + fmt(PR * PR, 3) + " → <b>PR = " + fmt(PR, 3) + "</b>"));
      }
      const inner = ((bPR - st.b1) % 360 + 360) % 360;
      const innerSigned = inner > 180 ? inner - 360 : inner;
      steps.appendChild(step(3, "Angle QPR inside the triangle",
        "Trigonometry (or the sine rule) gives ∠QPR = <b>" + fmt(Math.abs(innerSigned), 1) + "°</b>."));
      steps.appendChild(step(4, "Turn that into a bearing",
        "Measure from P's North line: " + String(Math.round(st.b1)).padStart(3, "0") + "° "
        + (innerSigned >= 0 ? "+ " : "− ") + fmt(Math.abs(innerSigned), 1) + "° = <b>"
        + String(Math.round(bPR)).padStart(3, "0") + "°</b> — the bearing of R from P."));
      steps.appendChild(step("★", "And back the other way",
        "Bearing of P from R = " + String(Math.round(bPR < 180 ? bPR + 180 : bPR - 180)).padStart(3, "0") + "°"));

      msg.className = "gl-msg good";
      msg.textContent = "An angle inside the triangle is never the answer on its own — you always have to combine it with a North line. Try 8 km on 060° then 6 km on 150° for the classic right-angled version.";
    }
    upd();
  };

  // ---------- styles (injected once) ----------

  function injectCSS() {
    if (document.getElementById("graphlab-css")) return;
    const s = document.createElement("style");
    s.id = "graphlab-css";
    s.textContent = `
.gl-panel{background:var(--card);border:1px solid var(--line);border-radius:14px;padding:14px;margin:14px 0;box-shadow:var(--shadow)}
.gl-eq{font-family:var(--font-head);font-weight:800;color:var(--dc,#3B5BDB);font-size:1.02rem;margin:0 0 10px;letter-spacing:.01em}
.gl-prompt{font-size:.95rem;color:var(--ink);margin:0 0 10px;line-height:1.6}
.gl-pill{display:inline-block;background:var(--dc,#3B5BDB);color:#fff;border-radius:999px;padding:1px 9px;font-size:.72rem;font-weight:800;margin-right:6px}
.gl-controls{display:grid;grid-template-columns:repeat(auto-fit,minmax(190px,1fr));gap:10px 16px;margin:6px 0 12px}
.gl-slider{display:block;font-size:.85rem;color:var(--muted)}
.gl-slider-head{display:flex;justify-content:space-between;align-items:baseline;margin-bottom:2px}
.gl-slider-name{font-weight:700;color:var(--ink)}
.gl-slider-val{font-family:ui-monospace,Menlo,Consolas,monospace;font-weight:800;color:var(--dc,#3B5BDB);background:var(--chip-bg);border-radius:6px;padding:0 7px}
.gl-slider input[type=range]{width:100%;accent-color:var(--dc,#3B5BDB);margin:0}
.gl-canvas{width:100%;line-height:0;border:1px solid var(--line);border-radius:12px;overflow:hidden;background:var(--card)}
.gl-canvas canvas{display:block;touch-action:pan-y}
.gl-canvas.mini{border-radius:10px}
.gl-bar{display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin:10px 0}
.gl-btn{font-family:var(--font-head);font-weight:800;font-size:.85rem;border-radius:10px;padding:.45rem .9rem;cursor:pointer;border:1.5px solid var(--dc,#3B5BDB);background:var(--dc,#3B5BDB);color:#fff;transition:filter .15s,transform .15s}
.gl-btn:hover{filter:brightness(1.06);transform:translateY(-1px)}
.gl-btn.ghost{background:transparent;color:var(--dc,#3B5BDB)}
.gl-chips{display:flex;gap:7px;overflow-x:auto;padding-bottom:3px;margin-bottom:10px}
.gl-chips.wrap{flex-wrap:wrap;overflow:visible}
.gl-chip{font-size:.8rem;font-weight:700;white-space:nowrap;border-radius:999px;padding:.34rem .8rem;cursor:pointer;
  border:1.5px solid var(--line);background:var(--card);color:var(--muted);transition:.15s}
.gl-chip:hover{border-color:var(--chip-c,var(--dc,#3B5BDB));color:var(--ink)}
.gl-chip.on{background:var(--chip-c,var(--dc,#3B5BDB));border-color:var(--chip-c,var(--dc,#3B5BDB));color:#fff}
.gl-chip.used{opacity:.35;text-decoration:line-through;cursor:default}
.gl-facts{display:grid;gap:6px;margin-top:10px}
.gl-fact{display:flex;flex-wrap:wrap;gap:4px 10px;justify-content:space-between;align-items:baseline;
  background:var(--chip-bg);border-radius:9px;padding:.42rem .7rem;font-size:.86rem}
.gl-fact-k{color:var(--muted);font-weight:700}
.gl-fact-v{color:var(--ink);font-weight:700;font-family:ui-monospace,Menlo,Consolas,monospace;text-align:right}
.gl-msg{font-size:.87rem;line-height:1.55;color:var(--muted);margin:8px 0 0;padding:.5rem .7rem;border-radius:9px;background:var(--chip-bg)}
.gl-msg.good{background:var(--good-soft,#f0fdf4);color:var(--good-deep,#15803d)}
.gl-msg.bad{background:var(--bad-soft,#fef2f2);color:var(--bad-deep,#b91c1c)}
.gl-msg.warn{background:var(--gold-soft,#fef2e0);color:var(--gold-deep,#8a5d00)}
.gl-scroll{overflow-x:auto;margin:6px 0}
.gl-table{border-collapse:collapse;font-size:.87rem;min-width:100%}
.gl-table th{background:var(--dc,#3B5BDB);color:#fff;padding:.4rem .7rem;text-align:center;font-weight:800;white-space:nowrap}
.gl-table td{border:1px solid var(--line);padding:.3rem .45rem;text-align:center;color:var(--ink);
  font-family:ui-monospace,Menlo,Consolas,monospace;min-width:44px}
.gl-table .gl-td-x{background:var(--chip-bg);font-weight:800}
.gl-table .gl-td-undef{color:var(--bad,#dc2626);font-weight:700;font-size:.78rem}
.gl-table .gl-td-blank{background:transparent;border:none}
.gl-table .gl-td-ok{background:var(--good-soft,#f0fdf4);color:var(--good-deep,#15803d);font-weight:800}
.gl-cell{width:52px;padding:.25rem;border:1.5px solid var(--line);border-radius:6px;text-align:center;
  font-family:ui-monospace,Menlo,Consolas,monospace;font-size:.86rem;background:var(--card);color:var(--ink)}
.gl-cell.wide{width:62px}
.gl-cell:focus{outline:2px solid var(--dc,#3B5BDB);outline-offset:1px}
.gl-cell.ok{border-color:var(--good,#16a34a);background:var(--good-soft,#f0fdf4)}
.gl-cell.bad{border-color:var(--bad,#dc2626);background:var(--bad-soft,#fef2f2)}
.gl-inputs{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:10px}
.gl-score{margin-left:auto;font-weight:800;font-size:.82rem;color:var(--dc,#3B5BDB);background:var(--chip-bg);border-radius:999px;padding:.25rem .75rem}
.gl-meter{height:9px;border-radius:999px;background:var(--chip-bg);overflow:hidden;margin:10px 0 4px}
.gl-meter-fill{height:100%;width:0;border-radius:999px;transition:width .18s}
.gl-algebra{font-size:.86rem;font-family:ui-monospace,Menlo,Consolas,monospace;color:var(--ink);
  background:var(--chip-bg);border-radius:9px;padding:.5rem .7rem;margin-top:8px;line-height:1.7}
.gl-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:9px;margin:10px 0}
.gl-cell-plot{position:relative;border:2px solid transparent;border-radius:12px;cursor:pointer;transition:.15s}
.gl-cell-plot:hover{border-color:var(--dc,#3B5BDB)}
.gl-cell-plot.solved{border-color:var(--good,#16a34a)}
.gl-cell-plot.shake{animation:glshake .35s}
@keyframes glshake{25%{transform:translateX(-5px)}75%{transform:translateX(5px)}}
.gl-tick{position:absolute;inset:auto 0 0 0;background:var(--good,#16a34a);color:#fff;font-size:.75rem;
  font-weight:800;text-align:center;padding:.15rem 0;border-radius:0 0 9px 9px}
.gl-q{margin:0 0 14px;padding:0 0 4px}
.gl-q>p{margin:0 0 8px;font-weight:600;color:var(--ink);font-size:.93rem}
.gl-q ul{list-style:none;margin:0;padding:0;display:grid;gap:6px}
.gl-opt{border:1.5px solid var(--line);border-radius:10px;padding:.45rem .75rem;cursor:pointer;
  font-size:.88rem;color:var(--ink);background:var(--card);transition:.15s}
.gl-opt:hover{border-color:var(--dc,#3B5BDB)}
.gl-opt.ok{border-color:var(--good,#16a34a);background:var(--good-soft,#f0fdf4);font-weight:700}
.gl-opt.bad{border-color:var(--bad,#dc2626);background:var(--bad-soft,#fef2f2)}
.gl-score-bar{margin-top:6px;font-weight:800;color:var(--dc,#3B5BDB);font-size:.88rem}
.gl-form{display:grid;gap:10px;margin-bottom:10px}
.gl-form-group{background:var(--chip-bg);border-radius:11px;padding:.5rem .7rem}
.gl-form-title{font-size:.75rem;font-weight:800;text-transform:uppercase;letter-spacing:.05em;color:var(--muted);margin-bottom:5px}
.gl-form-row{display:flex;flex-wrap:wrap;gap:10px;align-items:flex-end;margin-bottom:10px}
.gl-field{display:flex;flex-direction:column;gap:3px;font-size:.78rem;color:var(--muted);font-weight:700}
.gl-field-name{white-space:nowrap}
.gl-select{padding:.28rem .4rem;border:1.5px solid var(--line);border-radius:7px;background:var(--card);
  color:var(--ink);font:inherit;font-size:.85rem;font-weight:600}
.gl-machine{display:flex;align-items:center;justify-content:center;gap:8px;flex-wrap:wrap;margin:12px 0}
.gl-mbox{background:var(--dc,#3B5BDB);color:#fff;border-radius:10px;padding:.6rem 1rem;
  font-family:ui-monospace,Menlo,Consolas,monospace;font-weight:800;font-size:.9rem;text-align:center}
.gl-mbox.io{background:var(--chip-bg);color:var(--dc,#3B5BDB);border:2px solid var(--dc,#3B5BDB)}
.gl-marrow{color:var(--gold-deep,#dd8f12);font-size:1.3rem;font-weight:900}
.gl-steps{display:grid;gap:7px;margin:8px 0}
.gl-step{display:flex;gap:9px;align-items:flex-start;background:var(--chip-bg);border-radius:10px;padding:.5rem .7rem}
.gl-step-n{flex:none;background:var(--dc,#3B5BDB);color:#fff;border-radius:6px;padding:.1rem .45rem;
  font-size:.66rem;font-weight:800;letter-spacing:.04em;margin-top:2px;white-space:nowrap}
.gl-step-b{font-size:.87rem;line-height:1.6;color:var(--ink);min-width:0;overflow-x:auto}
.gl-step-b b{color:var(--navy)}
.gl-subcard{background:var(--chip-bg);border-radius:11px;padding:.65rem .8rem;font-size:.87rem;
  line-height:1.7;color:var(--ink);overflow-x:auto}
.gl-subcard b{color:var(--dc,#3B5BDB)}
.gl-subhead{font-weight:800;color:var(--navy);font-size:.8rem;text-transform:uppercase;letter-spacing:.04em;margin-bottom:4px}
.gl-two{display:grid;grid-template-columns:1fr 1fr;gap:9px;margin:4px 0 9px}
@media(max-width:640px){.gl-two{grid-template-columns:1fr}}
.gl-table .gl-ratio{font-weight:800}
`;
    document.head.appendChild(s);
  }

  // ---------- public API ----------

  window.GraphLab = {
    mount(root) {
      if (!root) return;
      injectCSS();
      root.querySelectorAll("[data-lab]").forEach((host) => {
        if (host.dataset.glReady) return;
        const fn = build[host.dataset.lab];
        if (!fn) return;
        host.dataset.glReady = "1";
        try { fn(host); } catch (err) { console.error("GraphLab widget failed:", host.dataset.lab, err); }
      });
      redrawAll();
    },
    Plot,
    pal,
  };
})();
