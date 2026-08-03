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
  /* Self-check — typed answers, not multiple choice.

     Markup per question:
       <div class="gl-q" data-answer="13" data-accept="13 cm" data-why="…"><p>…</p></div>
     Add data-open="1" for a "think, then reveal" question with no typed answer.
     data-accept holds |-separated alternative spellings of the same answer. */
  build.quiz = function (host) {
    const MINUS_RE = /[−–—]/g;
    const UNIT_RE = /(cm\^2|m\^2|km\^2|km\/h|m\/s|cm|mm|km|m|deg(?:rees)?|units?|hours?|hrs?)$/;

    // put both sides into one comparable shape: ascii minus, ^2 for ², no spaces
    function norm(s) {
      return String(s)
        .replace(MINUS_RE, "-")
        .replace(/²/g, "^2").replace(/³/g, "^3")
        .replace(/×/g, "*").replace(/÷/g, "/")
        .replace(/≤/g, "<=").replace(/≥/g, ">=").replace(/≠/g, "!=")
        .replace(/°/g, "")
        .replace(/[()\s,$]/g, "")
        .toLowerCase();
    }
    // for numeric answers also drop a leading "x=" and any trailing unit
    function bare(s) {
      return norm(s).replace(/^[a-zθ]=/, "").replace(UNIT_RE, "");
    }
    const numeric = (s) => /^-?\d*\.?\d+$/.test(bare(s));
    // accept anything that rounds to the same value the answer is quoted to
    function tolerance(expectedStr, expected) {
      const dot = bare(expectedStr).indexOf(".");
      const dp = dot < 0 ? 0 : bare(expectedStr).length - dot - 1;
      // a whole-number answer is an exact value, so stay tight — a relative
      // tolerance would wrongly accept 226 for an answer of 225
      return dp > 0 ? 0.51 * Math.pow(10, -dp) : 0.05;
    }

    const qs = [...host.querySelectorAll(".gl-q")];
    const tally = e("div", "gl-score-bar");
    let asked = 0, right = 0;
    const update = () => (tally.textContent = "Score: " + right + " / " + asked + " answered");

    qs.forEach((q) => {
      [...q.querySelectorAll("ul")].forEach((ul) => ul.remove());   // drop any legacy option list
      const ans = q.dataset.answer || "";
      const why = q.dataset.why || "";
      const open = q.dataset.open === "1";
      const alts = [ans].concat((q.dataset.accept || "").split("|")).filter(Boolean);
      const isNum = !open && numeric(ans);

      const row = e("div", "gl-answer-row");
      let input = null;
      if (!open) {
        input = document.createElement("input");
        input.type = "text";
        input.className = "gl-cell ans";
        input.placeholder = "your answer";
        input.setAttribute("aria-label", "your answer");
        input.autocomplete = "off";
        row.appendChild(input);
      }
      const check = open ? null : e("button", "gl-btn", "✓ Check");
      const show = e("button", "gl-btn ghost", open ? "Show the answer" : "Show answer");
      if (check) { check.type = "button"; row.appendChild(check); }
      show.type = "button";
      row.appendChild(show);
      q.appendChild(row);

      // stays hidden until the student checks or reveals
      const fb = e("div", "gl-msg empty");
      q.appendChild(fb);
      const say = (cls, text, asHtml) => {
        fb.className = "gl-msg" + (cls ? " " + cls : "");
        if (asHtml) fb.innerHTML = text; else fb.textContent = text;
      };

      let done = false, tries = 0;

      function finish(correct) {
        done = true;
        asked++;
        if (correct) right++;
        if (input) input.disabled = true;
        if (check) check.disabled = true;
        update();
      }
      function reveal(byUser) {
        if (done) { if (byUser) say("", "Answer: " + ans + ". " + why); return; }
        if (input) input.classList.add("bad");
        say("", "<b>Answer: " + ans + "</b> " + why, true);
        finish(false);
      }
      function go() {
        if (done || !input) return;
        const got = input.value.trim();
        if (!got) { say("warn", "Type something first."); return; }
        let ok = alts.some((a) => norm(a) === norm(got) || bare(a) === bare(got));
        if (!ok && isNum && numeric(got)) {
          const exp = parseFloat(bare(ans));
          ok = Math.abs(parseFloat(bare(got)) - exp) <= tolerance(ans, exp);
        }
        if (ok) {
          input.classList.add("ok");
          say("good", "Correct. " + why);
          finish(true);
          return;
        }
        tries++;
        input.classList.add("bad");
        say("bad", tries >= 2
          ? "Still not right — press Show answer when you want it."
          : "Not quite. Check your working and try again.");
        setTimeout(() => input.classList.remove("bad"), 900);
      }

      if (input) {
        input.addEventListener("keydown", (ev) => {
          if (ev.key === "Enter") { ev.preventDefault(); go(); }
        });
      }
      if (check) check.addEventListener("click", go);
      show.addEventListener("click", () => reveal(true));
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

  /* ---------- shared machinery for the transformation and vector sketches ---------- */

  // square coordinate grid: keeps 1 unit the same length on both axes, then widens
  // the x-range so the drawing fills the canvas instead of leaving side margins
  function gridView(W, H, view) {
    const pad = 16;
    const s = Math.min((W - 2 * pad) / (view.xmax - view.xmin), (H - 2 * pad) / (view.ymax - view.ymin));
    const cx = (view.xmin + view.xmax) / 2, cy = (view.ymin + view.ymax) / 2;
    const hw = (W - 2 * pad) / (2 * s), hh = (H - 2 * pad) / (2 * s);
    return {
      s, cx, cy,
      v: { xmin: cx - hw, xmax: cx + hw, ymin: cy - hh, ymax: cy + hh },
      X: (x) => W / 2 + (x - cx) * s,
      Y: (y) => H / 2 - (y - cy) * s,
    };
  }
  // the square-grid labs read better in a near-square frame than in a very wide one
  function gridBox() {
    const b = e("div", "gl-canvas");
    b.style.maxWidth = "560px";
    b.style.margin = "0 auto";
    return b;
  }
  function drawGrid(c, P, m) {
    const v = m.v;
    const step = v.xmax - v.xmin > 20 ? 2 : 1;
    c.save();
    c.strokeStyle = P.grid; c.lineWidth = 1;
    for (let x = Math.ceil(v.xmin / step) * step; x <= v.xmax; x += step) {
      c.beginPath(); c.moveTo(m.X(x), m.Y(v.ymin)); c.lineTo(m.X(x), m.Y(v.ymax)); c.stroke();
    }
    for (let y = Math.ceil(v.ymin / step) * step; y <= v.ymax; y += step) {
      c.beginPath(); c.moveTo(m.X(v.xmin), m.Y(y)); c.lineTo(m.X(v.xmax), m.Y(y)); c.stroke();
    }
    c.strokeStyle = P.axis; c.lineWidth = 1.5;
    c.beginPath(); c.moveTo(m.X(v.xmin), m.Y(0)); c.lineTo(m.X(v.xmax), m.Y(0)); c.stroke();
    c.beginPath(); c.moveTo(m.X(0), m.Y(v.ymin)); c.lineTo(m.X(0), m.Y(v.ymax)); c.stroke();
    // numbers every 2 units so the grid stays readable on a phone
    c.fillStyle = P.text; c.font = "10px Inter, system-ui, sans-serif";
    c.textAlign = "center"; c.textBaseline = "top";
    for (let x = Math.ceil(v.xmin / 2) * 2; x <= v.xmax; x += 2) {
      if (x === 0) continue;
      c.fillText(String(x).replace("-", MINUS), m.X(x), m.Y(0) + 3);
    }
    c.textAlign = "right"; c.textBaseline = "middle";
    for (let y = Math.ceil(v.ymin / 2) * 2; y <= v.ymax; y += 2) {
      if (y === 0) continue;
      c.fillText(String(y).replace("-", MINUS), m.X(0) - 4, m.Y(y));
    }
    c.restore();
  }
  // a view that comfortably holds every point given, always including the origin
  function autoView(pts, minSpan) {
    const xs = pts.map((p) => p[0]).concat([0]);
    const ys = pts.map((p) => p[1]).concat([0]);
    const xmin = Math.min.apply(null, xs) - 1.2, xmax = Math.max.apply(null, xs) + 1.2;
    const ymin = Math.min.apply(null, ys) - 1.2, ymax = Math.max.apply(null, ys) + 1.2;
    const span = Math.max(minSpan || 9, xmax - xmin, ymax - ymin);
    const cx = (xmin + xmax) / 2, cy = (ymin + ymax) / 2;
    return { xmin: cx - span / 2, xmax: cx + span / 2, ymin: cy - span / 2, ymax: cy + span / 2 };
  }
  function drawShape(c, P, m, pts, stroke, fill, label, dash) {
    const px = pts.map((p) => [m.X(p[0]), m.Y(p[1])]);
    if (fill) fillPoly(c, px, fill);
    strokePath(c, px.concat([px[0]]), stroke, 2.2, dash);
    px.forEach((p) => dot(c, p[0], p[1], stroke, P.bg, 3.4));
    if (label) {
      const cx = px.reduce((s, p) => s + p[0], 0) / px.length;
      const cy = px.reduce((s, p) => s + p[1], 0) / px.length;
      tagOn(c, P, label, cx, cy, stroke, "center", 13);
    }
  }
  function arrow(c, m, from, to, color, width, label, P) {
    const A = [m.X(from[0]), m.Y(from[1])], B = [m.X(to[0]), m.Y(to[1])];
    strokePath(c, [A, B], color, width || 2.6);
    arrowHead(c, B[0], B[1], Math.atan2(B[1] - A[1], B[0] - A[0]), color, 8);
    if (label) tagOn(c, P, label, (A[0] + B[0]) / 2, (A[1] + B[1]) / 2 - 10, color, "center", 12.5);
  }
  const ptTxt = (p) => "(" + fmt(p[0], 3) + ", " + fmt(p[1], 3) + ")";
  const cv = (a, b) => '<span class="gl-cv"><i>' + fmt(a, 3) + "</i><i>" + fmt(b, 3) + "</i></span>";
  function factHtml(label, markup) {
    const r = e("div", "gl-fact");
    r.appendChild(e("span", "gl-fact-k", label));
    const v = html("span", "gl-fact-v", markup || "");
    r.appendChild(v);
    r.setValue = (mk) => { v.innerHTML = mk; };
    return r;
  }

  /* A transformation is held as the affine map (x, y) → (M·p + t), which is what
     lets these labs work out the SINGLE transformation equivalent to a sequence. */
  const applyTF = (T, p) => [
    T.M[0] * p[0] + T.M[1] * p[1] + T.t[0],
    T.M[2] * p[0] + T.M[3] * p[1] + T.t[1],
  ];
  // "T1 first, then T2" as one map
  function composeTF(T1, T2) {
    const A = T2.M, B = T1.M;
    return {
      M: [A[0] * B[0] + A[1] * B[2], A[0] * B[1] + A[1] * B[3],
          A[2] * B[0] + A[3] * B[2], A[2] * B[1] + A[3] * B[3]],
      t: [A[0] * T1.t[0] + A[1] * T1.t[1] + T2.t[0],
          A[2] * T1.t[0] + A[3] * T1.t[1] + T2.t[1]],
    };
  }
  const MIRRORS = [
    { value: "y=0", label: "the x-axis (y = 0)" },
    { value: "x=0", label: "the y-axis (x = 0)" },
    { value: "y=x", label: "y = x" },
    { value: "y=-x", label: "y = " + MINUS + "x" },
    { value: "x=a", label: "x = a" },
    { value: "y=b", label: "y = b" },
  ];
  function specTF(s) {
    if (s.kind === "reflect") {
      if (s.line === "y=0") return { M: [1, 0, 0, -1], t: [0, 0] };
      if (s.line === "x=0") return { M: [-1, 0, 0, 1], t: [0, 0] };
      if (s.line === "y=x") return { M: [0, 1, 1, 0], t: [0, 0] };
      if (s.line === "y=-x") return { M: [0, -1, -1, 0], t: [0, 0] };
      if (s.line === "x=a") return { M: [-1, 0, 0, 1], t: [2 * s.a, 0] };
      return { M: [1, 0, 0, -1], t: [0, 2 * s.b] };
    }
    if (s.kind === "rotate") {
      const th = s.ang * DEG;
      const co = Math.round(Math.cos(th)), si = Math.round(Math.sin(th));
      const M = [co, -si, si, co];
      return { M, t: [s.cx - (M[0] * s.cx + M[1] * s.cy), s.cy - (M[2] * s.cx + M[3] * s.cy)] };
    }
    if (s.kind === "translate") return { M: [1, 0, 0, 1], t: [s.dx, s.dy] };
    return { M: [s.k, 0, 0, s.k], t: [s.cx * (1 - s.k), s.cy * (1 - s.k)] };
  }
  const lineName = (s) =>
    s.line === "y=0" ? "the x-axis (y = 0)"
    : s.line === "x=0" ? "the y-axis (x = 0)"
    : s.line === "y=x" ? "y = x"
    : s.line === "y=-x" ? "y = " + MINUS + "x"
    : s.line === "x=a" ? "x = " + fmt(s.a, 3)
    : "y = " + fmt(s.b, 3);
  // an inverse scale factor reads better as 1/4 than as 0.25
  const kTxt = (k) => {
    const r = 1 / k;
    return Math.abs(k) < 1 && Math.abs(Math.round(r) - r) < 1e-9
      ? (k < 0 ? MINUS : "") + "1/" + Math.abs(Math.round(r))
      : fmt(k, 3);
  };
  function describeSpec(s) {
    if (s.kind === "reflect") return "Reflection in " + lineName(s);
    if (s.kind === "rotate") {
      const turn = Math.abs(s.ang) === 180 ? "" : s.ang > 0 ? " anticlockwise" : " clockwise";
      return "Rotation of " + Math.abs(s.ang) + "°" + turn + " about " + ptTxt([s.cx, s.cy]);
    }
    if (s.kind === "translate") return "Translation by the column vector " + cv(s.dx, s.dy);
    return "Enlargement, scale factor " + kTxt(s.k) + ", centre " + ptTxt([s.cx, s.cy]);
  }
  // the coordinate rule, e.g. (x, y) → (−y, x)
  function ruleTxt(T) {
    const part = (m1, m2, k) => {
      let s = "";
      if (m1) s += (m1 === 1 ? "" : m1 === -1 ? MINUS : fmt(m1, 3)) + "x";
      if (m2) s += (s && m2 > 0 ? " + " : s ? " " + MINUS + " " : m2 < 0 ? MINUS : "")
        + (Math.abs(m2) === 1 ? "" : fmt(Math.abs(m2), 3)) + "y";
      if (k) s += (s ? (k > 0 ? " + " : " " + MINUS + " ") : k < 0 ? MINUS : "") + fmt(Math.abs(k), 3);
      return s || "0";
    };
    return "(x, y) → (" + part(T.M[0], T.M[1], T.t[0]) + ", " + part(T.M[2], T.M[3], T.t[1]) + ")";
  }
  const near = (a, b) => Math.abs(a - b) < 1e-7;
  // the point that does not move: solve (I − M)p = t
  function fixedPoint(T) {
    const a = 1 - T.M[0], b = -T.M[1], c = -T.M[2], d = 1 - T.M[3];
    const det = a * d - b * c;
    if (Math.abs(det) < 1e-9) return null;
    return [(T.t[0] * d - b * T.t[1]) / det, (a * T.t[1] - c * T.t[0]) / det];
  }
  function lineEqn(p0, u) {
    if (Math.abs(u[1]) < 1e-7) return "y = " + fmt(p0[1], 3);
    if (Math.abs(u[0]) < 1e-7) return "x = " + fmt(p0[0], 3);
    const mm = u[1] / u[0], cc = p0[1] - mm * p0[0];
    const g = near(mm, 1) ? "x" : near(mm, -1) ? MINUS + "x" : fmt(mm, 3) + "x";
    return "y = " + g + (Math.abs(cc) < 1e-9 ? "" : cc > 0 ? " + " + fmt(cc, 3) : " " + MINUS + " " + fmt(-cc, 3));
  }
  /* Name the single transformation an affine map represents. */
  function classifyTF(T) {
    const a = T.M[0], b = T.M[1], c = T.M[2], d = T.M[3], t = T.t;
    if (near(a, 1) && near(b, 0) && near(c, 0) && near(d, 1)) {
      if (near(t[0], 0) && near(t[1], 0)) return { head: "The identity", body: "Every point finishes exactly where it started." };
      return { head: "Translation", body: "by the column vector " + cv(t[0], t[1]) };
    }
    if (near(b, 0) && near(c, 0) && near(a, d)) {
      const k = a, C = fixedPoint(T);
      if (near(k, -1)) {
        return { head: "Rotation of 180° about " + ptTxt(C),
                 body: "An enlargement of scale factor " + MINUS + "1 about the same centre gives this image too — either description is correct." };
      }
      return { head: "Enlargement", body: "scale factor " + kTxt(k) + ", centre " + ptTxt(C)
        + " · lengths × " + kTxt(k) + ", areas × " + kTxt(k * k) };
    }
    const det = a * d - b * c;
    if (near(det, 1)) {
      const ang = ((Math.atan2(c, a) / DEG) + 360) % 360;
      const C = fixedPoint(T);
      if (!C) return { head: "Rotation", body: "of " + fmt(ang, 1) + "° — but the centre could not be pinned down." };
      if (near(ang, 180)) return { head: "Rotation of 180° about " + ptTxt(C), body: "No direction is needed for a half turn." };
      return { head: "Rotation", body: "of " + fmt(ang, 1) + "° anticlockwise about " + ptTxt(C)
        + " — the same as " + fmt(360 - ang, 1) + "° clockwise" };
    }
    if (near(det, -1)) {
      const phi = Math.atan2(c, a) / 2;
      const u = [Math.cos(phi), Math.sin(phi)];
      const along = t[0] * u[0] + t[1] * u[1];
      const perp = [t[0] - along * u[0], t[1] - along * u[1]];
      const p0 = [perp[0] / 2, perp[1] / 2];
      if (Math.abs(along) < 1e-7) return { head: "Reflection", body: "in the line " + lineEqn(p0, u) };
      return { head: "A glide reflection", body: "reflection in " + lineEqn(p0, u) + " together with a translation of "
        + fmt(Math.abs(along), 3) + " along that line — this one cannot be written as a single reflection, rotation, translation or enlargement." };
    }
    return { head: "Not one of the four", body: "This map stretches the shape unevenly, so it is outside the IGCSE list." };
  }

  /* One transformation, editable: the same control block is reused by every lab
     below, so the student meets one consistent way of specifying a transformation. */
  function tfEditor(title, init, onChange) {
    const wrap = e("div", "gl-form-group");
    if (title) wrap.appendChild(e("div", "gl-form-title", title));
    const row = e("div", "gl-form-row");
    wrap.appendChild(row);

    const relayout = () => { layout(); onChange(); };
    const kind = picker("Type", [
      { value: "reflect", label: "Reflection" },
      { value: "rotate", label: "Rotation" },
      { value: "translate", label: "Translation" },
      { value: "enlarge", label: "Enlargement" },
    ], relayout);
    const line = picker("Mirror line", MIRRORS, relayout);
    const aF = field("a", "3", null, onChange);
    const bF = field("b", "2", null, onChange);
    const ang = picker("Angle", [
      { value: "90", label: "90° anticlockwise" },
      { value: "-90", label: "90° clockwise" },
      { value: "180", label: "180°" },
    ], onChange);
    const cxF = field("centre x", "0", null, onChange);
    const cyF = field("centre y", "0", null, onChange);
    const dxF = field("x-move", "3", null, onChange);
    const dyF = field("y-move", MINUS + "2", null, onChange);
    const kF = field("scale factor k", "2", null, onChange);

    init = init || {};
    if (init.kind) kind.sel.value = init.kind;
    if (init.line) line.sel.value = init.line;
    if (init.ang != null) ang.sel.value = String(init.ang);
    if (init.a != null) aF.set(init.a);
    if (init.b != null) bF.set(init.b);
    if (init.cx != null) cxF.set(init.cx);
    if (init.cy != null) cyF.set(init.cy);
    if (init.dx != null) dxF.set(init.dx);
    if (init.dy != null) dyF.set(init.dy);
    if (init.k != null) kF.set(init.k);

    function layout() {
      row.replaceChildren(kind.el);
      const k = kind.get();
      if (k === "reflect") {
        row.appendChild(line.el);
        if (line.get() === "x=a") row.appendChild(aF.el);
        if (line.get() === "y=b") row.appendChild(bF.el);
      } else if (k === "rotate") {
        row.appendChild(ang.el); row.appendChild(cxF.el); row.appendChild(cyF.el);
      } else if (k === "translate") {
        row.appendChild(dxF.el); row.appendChild(dyF.el);
      } else {
        row.appendChild(kF.el); row.appendChild(cxF.el); row.appendChild(cyF.el);
      }
    }
    function get() {
      const k = kind.get();
      const safe = (v, dflt) => (isFinite(v) ? v : dflt);
      if (k === "reflect") return { kind: k, line: line.get(), a: safe(aF.get(), 0), b: safe(bF.get(), 0) };
      if (k === "rotate") return { kind: k, ang: +ang.get(), cx: safe(cxF.get(), 0), cy: safe(cyF.get(), 0) };
      if (k === "translate") return { kind: k, dx: safe(dxF.get(), 0), dy: safe(dyF.get(), 0) };
      return { kind: k, k: safe(kF.get(), 1), cx: safe(cxF.get(), 0), cy: safe(cyF.get(), 0) };
    }
    layout();
    return { el: wrap, get, kind };
  }
  // guide lines that make a transformation visible: mirror, centre, translation arrow, rays
  function drawGuides(c, P, m, s, obj, img) {
    const v = m.v;
    if (s.kind === "reflect") {
      const L = s.line;
      let A, B;
      if (L === "y=0") { A = [v.xmin, 0]; B = [v.xmax, 0]; }
      else if (L === "x=0") { A = [0, v.ymin]; B = [0, v.ymax]; }
      else if (L === "y=x") { A = [v.xmin, v.xmin]; B = [v.xmax, v.xmax]; }
      else if (L === "y=-x") { A = [v.xmin, -v.xmin]; B = [v.xmax, -v.xmax]; }
      else if (L === "x=a") { A = [s.a, v.ymin]; B = [s.a, v.ymax]; }
      else { A = [v.xmin, s.b]; B = [v.xmax, s.b]; }
      strokePath(c, [[m.X(A[0]), m.Y(A[1])], [m.X(B[0]), m.Y(B[1])]], P.c4, 2, [7, 5]);
      const short = L === "y=0" ? "y = 0" : L === "x=0" ? "x = 0" : lineName(s);
      tagOn(c, P, short, m.X(B[0]) - 30, m.Y(B[1]) - 12, P.c4, "center", 12);
      obj.forEach((p, i) => strokePath(c,
        [[m.X(p[0]), m.Y(p[1])], [m.X(img[i][0]), m.Y(img[i][1])]], P.faint, 1, [4, 4]));
    } else if (s.kind === "rotate" || s.kind === "enlarge") {
      const C = [s.cx, s.cy];
      if (s.kind === "enlarge") {
        obj.forEach((p, i) => strokePath(c,
          [[m.X(C[0]), m.Y(C[1])], [m.X(img[i][0]), m.Y(img[i][1])]], P.faint, 1, [5, 4]));
      }
      dot(c, m.X(C[0]), m.Y(C[1]), P.c4, P.bg, 5);
      tagOn(c, P, "centre " + ptTxt(C), m.X(C[0]), m.Y(C[1]) + 15, P.c4, "center", 11.5);
    } else if (s.kind === "translate") {
      arrow(c, m, obj[0], img[0], P.c3, 2.4, cvPlain(s.dx, s.dy), P);
    }
  }
  const cvPlain = (a, b) => "(" + fmt(a, 3) + ", " + fmt(b, 3) + ")";
  const OBJ = [[1, 1], [4, 1], [1, 3]];
  function mapTable(obj, img, head) {
    const box = e("div", "gl-scroll");
    const tb = e("table", "gl-table");
    const h = e("tr");
    h.appendChild(e("th", null, "Object"));
    h.appendChild(e("th", null, head || "Image"));
    tb.appendChild(h);
    obj.forEach((p, i) => {
      const r = e("tr");
      r.appendChild(e("td", "gl-td-x", ptTxt(p)));
      r.appendChild(e("td", null, ptTxt(img[i])));
      tb.appendChild(r);
    });
    box.appendChild(tb);
    return box;
  }

  /* 36 · Transformation explorer — all four, on one grid, with the full description */
  build.tformlab = function (host) {
    const panel = e("div", "gl-panel");
    const form = e("div", "gl-form");
    const cvBox = gridBox();
    const canvas = document.createElement("canvas");
    cvBox.appendChild(canvas);
    const facts = e("div", "gl-facts");
    const tableBox = e("div");
    const msg = e("div", "gl-msg");

    const ed = tfEditor("Choose a transformation", { kind: "reflect", line: "y=x" }, upd);
    form.appendChild(ed.el);
    const fDesc = factHtml("Described fully");
    const fRule = factHtml("Coordinate rule");
    const fInv = factHtml("Invariant points");
    [fDesc, fRule, fInv].forEach((f) => facts.appendChild(f));
    panel.appendChild(form); panel.appendChild(cvBox); panel.appendChild(facts);
    panel.appendChild(tableBox); panel.appendChild(msg);
    host.appendChild(panel);

    let cur = ed.get(), T = specTF(cur), img = OBJ.map((p) => applyTF(T, p));

    const sketch = new Sketch(canvas, {
      ratio: 0.72, minH: 250, maxH: 360,
      render(c, W, H, P) {
        const extra = cur.kind === "rotate" || cur.kind === "enlarge" ? [[cur.cx, cur.cy]] : [];
        const m = gridView(W, H, autoView(OBJ.concat(img).concat(extra), 10));
        drawGrid(c, P, m);
        drawGuides(c, P, m, cur, OBJ, img);
        drawShape(c, P, m, OBJ, P.c1, P.soft, "A");
        drawShape(c, P, m, img, P.c2, P.soft3, "A′");
      },
    });

    function upd() {
      cur = ed.get();
      T = specTF(cur);
      img = OBJ.map((p) => applyTF(T, p));
      sketch.draw();
      fDesc.setValue(describeSpec(cur));
      fRule.setValue(ruleTxt(T));
      fInv.setValue(
        cur.kind === "reflect" ? "every point on " + lineName(cur)
        : cur.kind === "translate" ? "none — every point moves"
        : "just the centre " + ptTxt([cur.cx, cur.cy]));
      tableBox.replaceChildren(mapTable(OBJ, img));
      msg.className = "gl-msg good";
      msg.textContent =
        cur.kind === "reflect" ? "Same size, same shape, but mirrored. The marks are for the EQUATION of the mirror line — never a description in words."
        : cur.kind === "rotate" ? "Same size, same shape, turned. Three things are needed every time: angle, direction, centre."
        : cur.kind === "translate" ? "Same size, same shape, same way up. Describe it with a column vector only — never as a coordinate."
        : "Shape is the same, size is not. Lengths are multiplied by k and areas by k². A scale factor between 0 and 1 still counts as an enlargement, and a negative one flips the shape to the far side of the centre.";
    }
    upd();
  };

  /* 37 · Finding the centre — perpendicular bisectors and rays */
  build.centrelab = function (host) {
    const MODES = [
      { key: "rot", label: "Centre of rotation" },
      { key: "enl", label: "Centre of enlargement" },
    ];
    let mode = "rot";
    const st = { cx: 3, cy: 3, ang: 90, k: 2 };

    const panel = e("div", "gl-panel");
    const chips = chipRow(MODES, (it) => { mode = it.key; layout(); }, 0);
    const controls = e("div", "gl-controls");
    const cvBox = gridBox();
    const canvas = document.createElement("canvas");
    cvBox.appendChild(canvas);
    const steps = e("div", "gl-steps");
    const msg = e("div", "gl-msg");

    const cxS = slider("Centre x", -4, 6, 1, st.cx, (v) => { st.cx = v; upd(); });
    const cyS = slider("Centre y", -4, 6, 1, st.cy, (v) => { st.cy = v; upd(); });
    const kS = slider("Scale factor k", -2, 3, 0.5, st.k, (v) => { st.k = v; upd(); });
    const angChips = chipRow([
      { label: "90° anticlockwise", ang: 90 },
      { label: "90° clockwise", ang: -90 },
      { label: "180°", ang: 180 },
    ], (it) => { st.ang = it.ang; upd(); }, 0);

    panel.appendChild(chips.el); panel.appendChild(angChips.el); panel.appendChild(controls);
    panel.appendChild(cvBox); panel.appendChild(steps); panel.appendChild(msg);
    host.appendChild(panel);

    let img = OBJ.slice();

    function currentSpec() {
      return mode === "rot"
        ? { kind: "rotate", ang: st.ang, cx: st.cx, cy: st.cy }
        : { kind: "enlarge", k: st.k, cx: st.cx, cy: st.cy };
    }
    const mid = (p, q) => [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2];

    const sketch = new Sketch(canvas, {
      ratio: 0.75, minH: 260, maxH: 370,
      render(c, W, H, P) {
        const m = gridView(W, H, autoView(OBJ.concat(img).concat([[st.cx, st.cy]]), 11));
        drawGrid(c, P, m);
        if (mode === "rot") {
          // join each vertex to its image, then draw the perpendicular bisector of that join
          OBJ.forEach((p, i) => {
            const q = img[i];
            if (Math.hypot(q[0] - p[0], q[1] - p[1]) < 1e-6) return;
            strokePath(c, [[m.X(p[0]), m.Y(p[1])], [m.X(q[0]), m.Y(q[1])]], P.faint, 1.4, [5, 4]);
            const M2 = mid(p, q);
            const dx = q[0] - p[0], dy = q[1] - p[1], L = Math.hypot(dx, dy);
            const ux = -dy / L, uy = dx / L, R = 40;
            strokePath(c, [
              [m.X(M2[0] - ux * R), m.Y(M2[1] - uy * R)],
              [m.X(M2[0] + ux * R), m.Y(M2[1] + uy * R)],
            ], P.c5, 1.6, [8, 5]);
            dot(c, m.X(M2[0]), m.Y(M2[1]), P.c5, P.bg, 3);
          });
        } else {
          OBJ.forEach((p, i) => {
            const q = img[i];
            const dx = q[0] - p[0], dy = q[1] - p[1], L = Math.hypot(dx, dy);
            if (L < 1e-6) return;                       // k = 1, or a vertex sitting on the centre
            const R = 40;
            strokePath(c, [
              [m.X(p[0] - (dx / L) * R), m.Y(p[1] - (dy / L) * R)],
              [m.X(p[0] + (dx / L) * R), m.Y(p[1] + (dy / L) * R)],
            ], P.c5, 1.4, [7, 5]);
          });
        }
        drawShape(c, P, m, OBJ, P.c1, P.soft, "A");
        drawShape(c, P, m, img, P.c2, P.soft3, "A′");
        dot(c, m.X(st.cx), m.Y(st.cy), P.c4, P.bg, 6);
        tagOn(c, P, "centre " + ptTxt([st.cx, st.cy]), m.X(st.cx), m.Y(st.cy) + 16, P.c4, "center", 12);
      },
    });

    function step(n, title, body) {
      const d = e("div", "gl-step");
      d.appendChild(e("span", "gl-step-n", "Step " + n));
      d.appendChild(html("div", "gl-step-b", "<b>" + title + "</b><br>" + body));
      return d;
    }
    function layout() {
      angChips.el.style.display = mode === "rot" ? "" : "none";
      controls.replaceChildren.apply(controls, mode === "rot" ? [cxS.el, cyS.el] : [cxS.el, cyS.el, kS.el]);
      upd();
    }
    function upd() {
      const s = currentSpec();
      img = OBJ.map((p) => applyTF(specTF(s), p));
      sketch.draw();
      steps.replaceChildren();
      if (mode === "rot") {
        steps.appendChild(step(1, "Join matching vertices",
          "Each dashed grey line joins a vertex of A to the matching vertex of A′."));
        steps.appendChild(step(2, "Draw the perpendicular bisector of each join",
          "Those are the pink lines. Every point on one of them is the same distance from the vertex and its image."));
        steps.appendChild(step(3, "Where they cross is the centre",
          "All of them pass through <b>" + ptTxt([st.cx, st.cy]) + "</b> — move the sliders and watch the crossing point follow."));
        steps.appendChild(step(4, "Then find the angle and direction",
          "Compare one vertex with its image, measured from the centre. Here the turn is <b>"
          + Math.abs(st.ang) + "°" + (Math.abs(st.ang) === 180 ? "" : st.ang > 0 ? " anticlockwise" : " clockwise") + "</b>."));
        msg.className = "gl-msg good";
        msg.textContent = "Two bisectors are enough in the exam — the third is a check. Tracing paper is allowed and is often faster, but the construction is what earns the method mark.";
      } else {
        steps.appendChild(step(1, "Draw a ray through each pair",
          "Join a vertex of A to the matching vertex of A′ and extend the line both ways — the pink rays."));
        steps.appendChild(step(2, "The rays all meet at the centre",
          "They cross at <b>" + ptTxt([st.cx, st.cy]) + "</b>."));
        steps.appendChild(step(3, "Get the scale factor from a pair of matching lengths",
          "image length ÷ object length = <b>" + fmt(st.k, 3) + "</b>" + (st.k < 0 ? " — negative, so the image is on the other side of the centre and upside down." : ".")));
        steps.appendChild(step(4, "Check with the distances from the centre",
          "distance from centre to image = " + fmt(st.k, 3) + " × distance from centre to object."));
        const odd = Math.abs(st.k - 1) < 1e-9 || Math.abs(st.k) < 1e-9;
        msg.className = "gl-msg " + (odd || (st.k > 0 && st.k < 1) ? "warn" : "good");
        msg.textContent = odd
          ? (Math.abs(st.k) < 1e-9
            ? "A scale factor of 0 collapses the whole shape onto the centre — slide k away from 0."
            : "A scale factor of 1 leaves the shape exactly where it is, so there are no rays to draw and no centre to find.")
          : st.k > 0 && st.k < 1
            ? "The image is smaller — but in IGCSE this is still an ENLARGEMENT, with a scale factor between 0 and 1. Never call it a reduction."
            : "Areas are multiplied by k² = " + fmt(st.k * st.k, 3) + ", not by k.";
      }
    }
    layout();
  };

  /* 38 · Describe it fully — a self-marking drill */
  build.describelab = function (host) {
    const panel = e("div", "gl-panel");
    const prompt = html("div", "gl-prompt",
      "Triangle <b>A</b> maps onto triangle <b>A′</b>. Build the single transformation you think it is, then press Check. "
      + "Your answer is judged on where it sends the shape, so any correct wording of the same transformation is accepted.");
    const cvBox = gridBox();
    const canvas = document.createElement("canvas");
    cvBox.appendChild(canvas);
    const tableBox = e("div");
    const form = e("div", "gl-form");
    const bar = e("div", "gl-bar");
    const msg = e("div", "gl-msg");

    const POOL = [
      { kind: "reflect", line: "y=x" },
      { kind: "reflect", line: "y=-x" },
      { kind: "reflect", line: "x=0" },
      { kind: "reflect", line: "y=0" },
      { kind: "reflect", line: "x=a", a: 3 },
      { kind: "reflect", line: "y=b", b: 2 },
      { kind: "rotate", ang: 90, cx: 0, cy: 0 },
      { kind: "rotate", ang: -90, cx: 0, cy: 0 },
      { kind: "rotate", ang: 180, cx: 0, cy: 0 },
      { kind: "rotate", ang: 90, cx: 2, cy: 1 },
      { kind: "rotate", ang: -90, cx: -1, cy: 2 },
      { kind: "rotate", ang: 180, cx: 1, cy: 1 },
      { kind: "translate", dx: 4, dy: -3 },
      { kind: "translate", dx: -5, dy: 2 },
      { kind: "enlarge", k: 2, cx: 0, cy: 0 },
      { kind: "enlarge", k: 3, cx: 1, cy: 1 },
      { kind: "enlarge", k: 0.5, cx: 0, cy: 0 },
      { kind: "enlarge", k: -1, cx: 0, cy: 0 },
      { kind: "enlarge", k: -2, cx: 0, cy: 0 },
    ];
    let secret = POOL[0], img = OBJ.slice(), done = false;

    const ed = tfEditor("Your description", { kind: "reflect", line: "y=x" }, () => {});
    form.appendChild(ed.el);
    const check = e("button", "gl-btn", "✓ Check");
    const show = e("button", "gl-btn ghost", "Show answer");
    const next = e("button", "gl-btn ghost", "New pair ↻");
    [check, show, next].forEach((b) => { b.type = "button"; bar.appendChild(b); });

    panel.appendChild(prompt); panel.appendChild(cvBox); panel.appendChild(tableBox);
    panel.appendChild(form); panel.appendChild(bar); panel.appendChild(msg);
    host.appendChild(panel);

    const sketch = new Sketch(canvas, {
      ratio: 0.72, minH: 250, maxH: 360,
      render(c, W, H, P) {
        const m = gridView(W, H, autoView(OBJ.concat(img), 11));
        drawGrid(c, P, m);
        drawShape(c, P, m, OBJ, P.c1, P.soft, "A");
        drawShape(c, P, m, img, P.c2, P.soft3, "A′");
      },
    });

    const same = (p, q) => Math.abs(p[0] - q[0]) < 1e-6 && Math.abs(p[1] - q[1]) < 1e-6;
    function fresh() {
      let pick = secret;
      while (pick === secret) pick = POOL[Math.floor(Math.random() * POOL.length)];
      secret = pick;
      img = OBJ.map((p) => applyTF(specTF(secret), p));
      done = false;
      check.disabled = false;
      sketch.draw();
      tableBox.replaceChildren(mapTable(OBJ, img, "Image A′"));
      msg.className = "gl-msg";
      msg.textContent = "Same size? Same way up? Mirrored? Turned? Work through the routine, then set the controls to match.";
    }
    check.addEventListener("click", () => {
      if (done) return;
      const guess = ed.get();
      const G = specTF(guess);
      const got = OBJ.map((p) => applyTF(G, p));
      if (got.every((p, i) => same(p, img[i]))) {
        msg.className = "gl-msg good";
        msg.innerHTML = "Correct — <b>" + describeSpec(secret) + "</b>. Every vertex lands on its image.";
        done = true;
        check.disabled = true;
      } else if (guess.kind === secret.kind) {
        msg.className = "gl-msg warn";
        msg.textContent = "Right type, wrong details. Check the "
          + (guess.kind === "reflect" ? "equation of the mirror line"
             : guess.kind === "rotate" ? "angle, the direction and the centre"
             : guess.kind === "translate" ? "two components of the vector"
             : "scale factor and the centre") + ".";
      } else {
        msg.className = "gl-msg bad";
        msg.textContent = "Not that type. Is the image the same size as the object? If not it is an enlargement. "
          + "If it is the same size: same way up → translation, mirrored → reflection, turned → rotation.";
      }
    });
    show.addEventListener("click", () => {
      msg.className = "gl-msg";
      msg.innerHTML = "<b>" + describeSpec(secret) + "</b> — rule " + ruleTxt(specTF(secret));
      done = true;
      check.disabled = true;
    });
    next.addEventListener("click", fresh);
    fresh();
  };

  /* 39 · Two transformations, one grid — and the single transformation that replaces them */
  build.combolab = function (host) {
    const MODES = [
      { key: "seq", label: "One after the other" },
      { key: "order", label: "Does the order matter?" },
    ];
    let mode = "seq";

    const panel = e("div", "gl-panel");
    const chips = chipRow(MODES, (it) => { mode = it.key; upd(); }, 0);
    const form = e("div", "gl-form");
    const cvBox = gridBox();
    const canvas = document.createElement("canvas");
    cvBox.appendChild(canvas);
    const facts = e("div", "gl-facts");
    const tableBox = e("div");
    const msg = e("div", "gl-msg");

    const ed1 = tfEditor("Transformation 1 (done first)", { kind: "rotate", ang: 90, cx: 0, cy: 0 }, upd);
    const ed2 = tfEditor("Transformation 2 (done second)", { kind: "reflect", line: "y=0" }, upd);
    form.appendChild(ed1.el); form.appendChild(ed2.el);

    const fEach = factHtml("Rule of each step");
    const fRule = factHtml("Combined rule");
    const fSingle = factHtml("Single equivalent transformation");
    const fWhy = factHtml("Reflection count");
    [fEach, fRule, fSingle, fWhy].forEach((f) => facts.appendChild(f));

    panel.appendChild(chips.el); panel.appendChild(form); panel.appendChild(cvBox);
    panel.appendChild(facts); panel.appendChild(tableBox); panel.appendChild(msg);
    host.appendChild(panel);

    let s1 = ed1.get(), s2 = ed2.get();
    let mid1 = OBJ.slice(), fin = OBJ.slice(), swapped = OBJ.slice();

    const sketch = new Sketch(canvas, {
      ratio: 0.75, minH: 260, maxH: 380,
      render(c, W, H, P) {
        const all = mode === "seq" ? OBJ.concat(mid1).concat(fin) : OBJ.concat(fin).concat(swapped);
        const m = gridView(W, H, autoView(all, 12));
        drawGrid(c, P, m);
        drawShape(c, P, m, OBJ, P.c1, P.soft, "A");
        if (mode === "seq") {
          drawShape(c, P, m, mid1, P.c3, null, "B", [6, 4]);
          drawShape(c, P, m, fin, P.c2, P.soft3, "C");
        } else {
          drawShape(c, P, m, fin, P.c2, P.soft3, "1 then 2");
          drawShape(c, P, m, swapped, P.c5, null, "2 then 1", [6, 4]);
        }
      },
    });

    function upd() {
      s1 = ed1.get(); s2 = ed2.get();
      const T1 = specTF(s1), T2 = specTF(s2);
      const T = composeTF(T1, T2), Tr = composeTF(T2, T1);
      mid1 = OBJ.map((p) => applyTF(T1, p));
      fin = OBJ.map((p) => applyTF(T, p));
      swapped = OBJ.map((p) => applyTF(Tr, p));
      sketch.draw();

      const reflections = (s1.kind === "reflect" ? 1 : 0) + (s2.kind === "reflect" ? 1 : 0);
      const cls = classifyTF(T);
      fEach.setValue("1 · " + ruleTxt(T1) + " &nbsp; 2 · " + ruleTxt(T2));
      fRule.setValue(ruleTxt(T));
      fSingle.setValue("<b>" + cls.head + "</b> " + cls.body);
      fWhy.setValue(reflections + (reflections === 1 ? " reflection — an odd number, so the answer must be a reflection"
        : reflections === 0 ? " reflections — the shape keeps its sense, so expect a translation, rotation or enlargement"
        : " reflections — an even number, so the shape is the right way round again"));

      const box = e("div", "gl-scroll");
      const tb = e("table", "gl-table");
      const h = e("tr");
      (mode === "seq" ? ["Object A", "After 1 (B)", "After 2 (C)"] : ["Object A", "1 then 2", "2 then 1"])
        .forEach((t) => h.appendChild(e("th", null, t)));
      tb.appendChild(h);
      OBJ.forEach((p, i) => {
        const r = e("tr");
        r.appendChild(e("td", "gl-td-x", ptTxt(p)));
        r.appendChild(e("td", null, ptTxt(mode === "seq" ? mid1[i] : fin[i])));
        r.appendChild(e("td", null, ptTxt(mode === "seq" ? fin[i] : swapped[i])));
        tb.appendChild(r);
      });
      box.appendChild(tb);
      tableBox.replaceChildren(box);

      if (mode === "seq") {
        msg.className = "gl-msg good";
        msg.textContent = "Track every vertex through the sequence, then describe the finish in ONE transformation. "
          + "Naming two transformations scores nothing.";
      } else {
        const agree = fin.every((p, i) => Math.abs(p[0] - swapped[i][0]) < 1e-6 && Math.abs(p[1] - swapped[i][1]) < 1e-6);
        msg.className = "gl-msg " + (agree ? "good" : "warn");
        msg.textContent = agree
          ? "These two happen to commute — both orders land on the same image. Two translations always do; most other pairs do not."
          : "The two orders give different images, so the order genuinely matters. In a 'show that' question, write down BOTH images and say explicitly that they differ.";
      }
    }
    upd();
  };

  /* 40 · Two mirrors — parallel gives a translation of 2d, crossing gives a rotation of 2θ */
  build.mirrorlab = function (host) {
    const MODES = [
      { key: "par", label: "Parallel mirrors" },
      { key: "cross", label: "Intersecting mirrors" },
    ];
    let mode = "par";
    const st = { a: 1, b: 4, t1: 0, t2: 45 };

    const panel = e("div", "gl-panel");
    const chips = chipRow(MODES, (it) => { mode = it.key; layout(); }, 0);
    const controls = e("div", "gl-controls");
    const cvBox = gridBox();
    const canvas = document.createElement("canvas");
    cvBox.appendChild(canvas);
    const facts = e("div", "gl-facts");
    const msg = e("div", "gl-msg");

    const aS = slider("First mirror  x =", -4, 4, 1, st.a, (v) => { st.a = v; upd(); });
    const bS = slider("Second mirror  x =", -4, 6, 1, st.b, (v) => { st.b = v; upd(); });
    const t1S = slider("First mirror through O at (°)", 0, 170, 5, st.t1, (v) => { st.t1 = v; upd(); });
    const t2S = slider("Second mirror through O at (°)", 0, 170, 5, st.t2, (v) => { st.t2 = v; upd(); });

    const fFirst = factHtml("Between the mirrors");
    const fResult = factHtml("Single equivalent transformation");
    [fFirst, fResult].forEach((f) => facts.appendChild(f));

    panel.appendChild(chips.el); panel.appendChild(controls); panel.appendChild(cvBox);
    panel.appendChild(facts); panel.appendChild(msg);
    host.appendChild(panel);

    const SHAPE = [[-2, 1], [0, 1], [-2, 2]];
    let one = SHAPE.slice(), two = SHAPE.slice();

    // reflection in the line through the origin at angle th (degrees)
    function reflectAt(th) {
      const c2 = Math.cos(2 * th * DEG), s2 = Math.sin(2 * th * DEG);
      return { M: [c2, s2, s2, -c2], t: [0, 0] };
    }
    function pair() {
      if (mode === "par") return [specTF({ kind: "reflect", line: "x=a", a: st.a }), specTF({ kind: "reflect", line: "x=a", a: st.b })];
      return [reflectAt(st.t1), reflectAt(st.t2)];
    }

    const sketch = new Sketch(canvas, {
      ratio: 0.75, minH: 260, maxH: 370,
      render(c, W, H, P) {
        const m = gridView(W, H, autoView(SHAPE.concat(one).concat(two), 12));
        const v = m.v;
        drawGrid(c, P, m);
        if (mode === "par") {
          [[st.a, P.c4], [st.b, P.c5]].forEach(([x, colr]) => {
            strokePath(c, [[m.X(x), m.Y(v.ymin)], [m.X(x), m.Y(v.ymax)]], colr, 2, [7, 5]);
            tagOn(c, P, "x = " + fmt(x), m.X(x), m.Y(v.ymax) + 14, colr, "center", 11.5);
          });
        } else {
          [[st.t1, P.c4], [st.t2, P.c5]].forEach(([th, colr]) => {
            const dx = Math.cos(th * DEG) * 40, dy = Math.sin(th * DEG) * 40;
            strokePath(c, [[m.X(-dx), m.Y(-dy)], [m.X(dx), m.Y(dy)]], colr, 2, [7, 5]);
            tagOn(c, P, th + "°", m.X(Math.cos(th * DEG) * v.xmax * 0.7),
              m.Y(Math.sin(th * DEG) * v.xmax * 0.7) - 10, colr, "center", 11.5);
          });
        }
        drawShape(c, P, m, SHAPE, P.c1, P.soft, "A");
        drawShape(c, P, m, one, P.c3, null, "B", [6, 4]);
        drawShape(c, P, m, two, P.c2, P.soft3, "C");
      },
    });

    function layout() {
      controls.replaceChildren.apply(controls, mode === "par" ? [aS.el, bS.el] : [t1S.el, t2S.el]);
      upd();
    }
    function upd() {
      const [T1, T2] = pair();
      one = SHAPE.map((p) => applyTF(T1, p));
      two = SHAPE.map((p) => applyTF(composeTF(T1, T2), p));
      sketch.draw();
      const cls = classifyTF(composeTF(T1, T2));
      if (mode === "par") {
        const d = st.b - st.a;
        fFirst.setValue("distance d = " + fmt(st.b) + " − " + fmt(st.a) + " = <b>" + fmt(d) + "</b>");
        fResult.setValue("<b>" + cls.head + "</b> " + cls.body + " — that is 2d = 2 × " + fmt(d) + " = <b>" + fmt(2 * d) + "</b>");
        msg.className = "gl-msg good";
        msg.textContent = "Two reflections in parallel mirrors always give a TRANSLATION of twice the gap, in the direction from the first mirror towards the second. Swap the sliders over and the translation reverses.";
      } else {
        const th = st.t2 - st.t1;
        fFirst.setValue("angle between them θ = " + fmt(th) + "°");
        fResult.setValue("<b>" + cls.head + "</b> " + cls.body + " — that is 2θ = <b>" + fmt(2 * th) + "°</b>");
        msg.className = "gl-msg good";
        msg.textContent = "Two reflections in mirrors that cross at θ always give a ROTATION of 2θ about the crossing point. Perpendicular mirrors (θ = 90°) therefore give a half turn — which is why reflecting in both axes is the same as a 180° rotation about the origin.";
      }
    }
    layout();
  };

  /* 41 · Inverses — undo one transformation, or undo a whole sequence */
  build.invlab = function (host) {
    const MODES = [
      { key: "one", label: "Undo one" },
      { key: "two", label: "Undo a sequence" },
    ];
    let mode = "one";

    const panel = e("div", "gl-panel");
    const chips = chipRow(MODES, (it) => { mode = it.key; layout(); }, 0);
    const form = e("div", "gl-form");
    const steps = e("div", "gl-steps");
    const msg = e("div", "gl-msg");

    const ed1 = tfEditor("Transformation P (done first)", { kind: "translate", dx: 3, dy: -2 }, upd);
    const ed2 = tfEditor("Transformation Q (done second)", { kind: "enlarge", k: 4, cx: 0, cy: 0 }, upd);

    panel.appendChild(chips.el); panel.appendChild(form); panel.appendChild(steps); panel.appendChild(msg);
    host.appendChild(panel);

    function inverseSpec(s) {
      if (s.kind === "reflect") return Object.assign({}, s);                 // its own inverse
      if (s.kind === "rotate") return Object.assign({}, s, { ang: -s.ang });
      if (s.kind === "translate") return { kind: "translate", dx: -s.dx, dy: -s.dy };
      return Object.assign({}, s, { k: s.k === 0 ? 0 : 1 / s.k });
    }
    function step(n, title, body) {
      const d = e("div", "gl-step");
      d.appendChild(e("span", "gl-step-n", n));
      d.appendChild(html("div", "gl-step-b", "<b>" + title + "</b><br>" + body));
      return d;
    }
    function layout() {
      form.replaceChildren.apply(form, mode === "one" ? [ed1.el] : [ed1.el, ed2.el]);
      upd();
    }
    function upd() {
      const p = ed1.get(), q = ed2.get();
      const pi = inverseSpec(p), qi = inverseSpec(q);
      steps.replaceChildren();
      if (mode === "one") {
        steps.appendChild(step("P", "You did", describeSpec(p)));
        steps.appendChild(step("P⁻¹", "To undo it", "<b>" + describeSpec(pi) + "</b>"));
        const back = composeTF(specTF(p), specTF(pi));
        const cls = classifyTF(back);
        steps.appendChild(step("✓", "P then P⁻¹ gives", cls.head.toLowerCase() === "the identity"
          ? "the identity — every point is back where it started." : cls.head + " " + cls.body));
        msg.className = "gl-msg good";
        msg.textContent = p.kind === "reflect"
          ? "A reflection is its own inverse: reflect twice in the same mirror and nothing has moved."
          : "Same kind of transformation, reversed: opposite direction, opposite vector, or the reciprocal scale factor — about the same centre or line.";
      } else {
        steps.appendChild(step("1", "The sequence you did", describeSpec(p) + "<br>then " + describeSpec(q)));
        steps.appendChild(step("2", "Undo the LAST one first", "<b>" + describeSpec(qi) + "</b>"));
        steps.appendChild(step("3", "Then undo the first", "<b>" + describeSpec(pi) + "</b>"));
        const back = composeTF(composeTF(specTF(p), specTF(q)), composeTF(specTF(qi), specTF(pi)));
        const cls = classifyTF(back);
        steps.appendChild(step("✓", "All four together give", cls.head + (cls.head === "The identity" ? " — every point is back at its start." : " " + cls.body)));
        msg.className = "gl-msg good";
        msg.textContent = "Shoes and socks: to undo \"P then Q\" you apply Q⁻¹ first and P⁻¹ second. Doing the inverses in the original order does not get you back.";
      }
    }
    layout();
  };

  /* ---------- vectors ---------- */

  function gcd(a, b) { a = Math.abs(a); b = Math.abs(b); while (b) { const t = a % b; a = b; b = t; } return a || 1; }
  function fracTxt(n, d) {
    if (d < 0) { n = -n; d = -d; }
    const g = gcd(n, d);
    n /= g; d /= g;
    if (n === 0) return "0";
    return d === 1 ? String(n).replace("-", MINUS) : String(n).replace("-", MINUS) + "/" + d;
  }
  // "⅓a + ⅔b" style, written with plain fractions
  function linTxt(n1, d1, n2, d2, x, y) {
    const term = (n, d, name) => {
      if (n === 0) return "";
      const f = fracTxt(Math.abs(n), d);
      return (f === "1" ? "" : f) + name;
    };
    const t1 = term(n1, d1, x), t2 = term(n2, d2, y);
    if (!t1 && !t2) return "0";
    if (!t1) return (n2 < 0 ? MINUS : "") + t2;
    if (!t2) return (n1 < 0 ? MINUS : "") + t1;
    return (n1 < 0 ? MINUS : "") + t1 + (n2 < 0 ? " " + MINUS + " " : " + ") + t2;
  }

  // "2a", "−b", "0.5a" — never "1a" or "−1b"
  const scaled = (k, name) => (k === 1 ? "" : k === -1 ? MINUS : fmt(k, 2)) + name;

  /* 42 · Column vectors — add, scale, and find the magnitude */
  build.veclab = function (host) {
    const panel = e("div", "gl-panel");
    const form = e("div", "gl-form");
    const cvBox = gridBox();
    const canvas = document.createElement("canvas");
    cvBox.appendChild(canvas);
    const facts = e("div", "gl-facts");
    const steps = e("div", "gl-steps");
    const msg = e("div", "gl-msg");

    const a1 = field("a  top", "4", null, upd), a2 = field("a  bottom", MINUS + "1", null, upd);
    const b1 = field("b  top", MINUS + "3", null, upd), b2 = field("b  bottom", "5", null, upd);
    const mF = field("m", "2", null, upd), nF = field("n", MINUS + "1", null, upd);

    function group(title, items) {
      const g = e("div", "gl-form-group");
      g.appendChild(e("div", "gl-form-title", title));
      const row = e("div", "gl-form-row");
      items.forEach((i) => row.appendChild(i));
      g.appendChild(row);
      return g;
    }
    form.appendChild(group("The two vectors", [a1.el, a2.el, b1.el, b2.el]));
    form.appendChild(group("The combination  m a + n b", [mF.el, nF.el]));

    const fRes = factHtml("m a + n b");
    const fMag = factHtml("Its magnitude");
    [fRes, fMag].forEach((f) => facts.appendChild(f));

    panel.appendChild(form); panel.appendChild(cvBox); panel.appendChild(facts);
    panel.appendChild(steps); panel.appendChild(msg);
    host.appendChild(panel);

    let A = [4, -1], B = [-3, 5], m = 2, n = -1, mA = [8, -2], res = [5, 3];

    const sketch = new Sketch(canvas, {
      ratio: 0.72, minH: 250, maxH: 360,
      render(c, W, H, P) {
        const mp = gridView(W, H, autoView([mA, res, [0, 0]], 12));
        drawGrid(c, P, mp);
        // nose to tail: m·a from the origin, then n·b from the end of it
        arrow(c, mp, [0, 0], mA, P.c1, 2.8, scaled(m, "a"), P);
        arrow(c, mp, mA, res, P.c3, 2.8, scaled(n, "b"), P);
        arrow(c, mp, [0, 0], res, P.c2, 3.2, null, P);
        tagOn(c, P, "m a + n b", mp.X(res[0] / 2) + 14, mp.Y(res[1] / 2) + 14, P.c2, "center", 12.5);
        dot(c, mp.X(0), mp.Y(0), P.strong, P.bg, 4);
        tagOn(c, P, "O", mp.X(0) - 12, mp.Y(0) + 12, P.strong, "center", 12);
      },
    });

    function step(n2, title, body) {
      const d = e("div", "gl-step");
      d.appendChild(e("span", "gl-step-n", "Step " + n2));
      d.appendChild(html("div", "gl-step-b", "<b>" + title + "</b><br>" + body));
      return d;
    }
    function upd() {
      const g = (f, dflt) => (isFinite(f.get()) ? f.get() : dflt);
      A = [g(a1, 0), g(a2, 0)]; B = [g(b1, 0), g(b2, 0)];
      m = g(mF, 1); n = g(nF, 1);
      mA = [m * A[0], m * A[1]];
      const nB = [n * B[0], n * B[1]];
      res = [mA[0] + nB[0], mA[1] + nB[1]];
      sketch.draw();
      const len = Math.hypot(res[0], res[1]);
      const nAbs = Math.abs(n) === 1 ? "" : fmt(Math.abs(n), 2);
      fRes.setValue((m === 1 ? "" : fmt(m, 2)) + cv(A[0], A[1]) + (n < 0 ? " " + MINUS + " " : " + ") + nAbs
        + cv(B[0], B[1]) + " = " + cv(res[0], res[1]));
      fMag.setValue("|m a + n b| = " + fmt(len, 3) + (Math.abs(len - Math.round(len)) < 1e-9 ? "" : "  (" + fmt(len, 2) + " to 3 s.f.)"));
      steps.replaceChildren();
      steps.appendChild(step(1, "Scale each vector first",
        scaled(m, "a") + " = " + cv(mA[0], mA[1]) + " and " + scaled(n, "b") + " = " + cv(nB[0], nB[1])));
      steps.appendChild(step(2, "Add component by component",
        "top: " + fmt(mA[0], 3) + " + (" + fmt(nB[0], 3) + ") = <b>" + fmt(res[0], 3) + "</b><br>"
        + "bottom: " + fmt(mA[1], 3) + " + (" + fmt(nB[1], 3) + ") = <b>" + fmt(res[1], 3) + "</b>"));
      steps.appendChild(step(3, "Only now take the magnitude",
        "√(" + fmt(res[0], 3) + "² + " + fmt(res[1], 3) + "²) = √" + fmt(res[0] * res[0] + res[1] * res[1], 3)
        + " = <b>" + fmt(len, 3) + "</b>"));
      msg.className = "gl-msg good";
      msg.textContent = "Do the vector arithmetic first and the magnitude last. |m a + n b| is not m|a| + n|b| — try a = (4, −1), b = (−3, 5) with m = 2, n = −1 and compare the two.";
    }
    upd();
  };

  /* 43 · Route finding — write any vector in terms of a and b */
  build.routelab = function (host) {
    const TARGETS = [
      { key: "AB", label: "AB" },
      { key: "OM", label: "OM  (M midpoint of AB)" },
      { key: "OC", label: "OC  (diagonal)" },
      { key: "BC", label: "BC" },
      { key: "OP", label: "OP  (P divides AB)" },
      { key: "BP", label: "BP" },
    ];
    const RATIOS = [
      { label: "1 : 1", m: 1, n: 1 },
      { label: "1 : 2", m: 1, n: 2 },
      { label: "2 : 1", m: 2, n: 1 },
      { label: "1 : 3", m: 1, n: 3 },
      { label: "3 : 1", m: 3, n: 1 },
    ];
    let target = "AB", r = RATIOS[1];

    const panel = e("div", "gl-panel");
    const chips = chipRow(TARGETS, (it) => { target = it.key; upd(); }, 0);
    const rchips = chipRow(RATIOS.map((x) => ({ label: "AP : PB = " + x.label, r: x })), (it) => { r = it.r; upd(); }, 1);
    const cvBox = gridBox();
    const canvas = document.createElement("canvas");
    cvBox.appendChild(canvas);
    const steps = e("div", "gl-steps");
    const facts = e("div", "gl-facts");
    const msg = e("div", "gl-msg");

    const fAns = factHtml("Answer");
    const fCheck = factHtml("Coefficient check");
    [fAns, fCheck].forEach((f) => facts.appendChild(f));

    panel.appendChild(chips.el); panel.appendChild(rchips.el); panel.appendChild(cvBox);
    panel.appendChild(steps); panel.appendChild(facts); panel.appendChild(msg);
    host.appendChild(panel);

    const a = [4, 1], b = [1, 3];                       // OA and OB, chosen to draw clearly
    const O = [0, 0], A = a, B = b, C = [a[0] + b[0], a[1] + b[1]];
    const lerp = (p, q, t) => [p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t];

    const sketch = new Sketch(canvas, {
      ratio: 0.7, minH: 250, maxH: 350,
      render(c, W, H, P) {
        const mp = gridView(W, H, autoView([O, A, B, C], 8));
        drawGrid(c, P, mp);
        const t = r.m / (r.m + r.n);
        const M = lerp(A, B, 0.5), Pt = lerp(A, B, t);
        // the parallelogram OACB
        strokePath(c, [O, A, C, B, O].map((p) => [mp.X(p[0]), mp.Y(p[1])]), P.faint, 1.6);
        arrow(c, mp, O, A, P.c1, 2.8, "a", P);
        arrow(c, mp, O, B, P.c3, 2.8, "b", P);
        // highlight the route being asked for
        const route = {
          AB: [[A, B]], OM: [[O, A], [A, M]], OC: [[O, A], [A, C]],
          BC: [[B, C]], OP: [[O, A], [A, Pt]], BP: [[B, O], [O, A], [A, Pt]],
        }[target];
        route.forEach((seg) => arrow(c, mp, seg[0], seg[1], P.c2, 2.6, null, P));
        [[O, "O"], [A, "A"], [B, "B"], [C, "C"]].forEach(([p, n]) =>
          tagOn(c, P, n, mp.X(p[0]) + 12, mp.Y(p[1]) - 10, P.strong, "center", 12.5));
        if (target === "OM") { dot(c, mp.X(M[0]), mp.Y(M[1]), P.c2, P.bg, 4); tagOn(c, P, "M", mp.X(M[0]) + 12, mp.Y(M[1]) + 12, P.c2, "center", 12); }
        if (target === "OP" || target === "BP") { dot(c, mp.X(Pt[0]), mp.Y(Pt[1]), P.c2, P.bg, 4); tagOn(c, P, "P", mp.X(Pt[0]) + 12, mp.Y(Pt[1]) + 12, P.c2, "center", 12); }
      },
    });

    function step(n, title, body) {
      const d = e("div", "gl-step");
      d.appendChild(e("span", "gl-step-n", n));
      d.appendChild(html("div", "gl-step-b", "<b>" + title + "</b><br>" + body));
      return d;
    }
    function upd() {
      rchips.el.style.display = target === "OP" || target === "BP" ? "" : "none";
      sketch.draw();
      steps.replaceChildren();
      const den = r.m + r.n, mm = r.m, nn = r.n;
      let ans = "", coefs = null, route = "", work = [];
      if (target === "AB") {
        route = "A → O → B";
        work = ["AB = AO + OB", "AO is the reverse of OA, so AO = −a", "AB = −a + b"];
        ans = "b − a"; coefs = [[-1, 1], [1, 1]];
      } else if (target === "OM") {
        route = "O → A → M";
        work = ["OM = OA + AM", "M is the midpoint, so AM = ½AB = ½(b − a)", "OM = a + ½b − ½a"];
        ans = "½a + ½b, that is ½(a + b)"; coefs = [[1, 2], [1, 2]];
      } else if (target === "OC") {
        route = "O → A → C";
        work = ["OC = OA + AC", "OACB is a parallelogram, so AC = OB = b", "OC = a + b"];
        ans = "a + b"; coefs = [[1, 1], [1, 1]];
      } else if (target === "BC") {
        route = "B → C";
        work = ["BC is the side opposite OA in the parallelogram", "Equal vectors have the same length and direction", "BC = OA"];
        ans = "a"; coefs = [[1, 1], [0, 1]];
      } else if (target === "OP") {
        route = "O → A → P";
        work = ["OP = OA + AP",
          "AP : PB = " + mm + " : " + nn + ", so P is " + fracTxt(mm, den) + " of the way from A to B",
          "AP = " + fracTxt(mm, den) + "(b − a)",
          "OP = a " + MINUS + " " + fracTxt(mm, den) + "a + " + fracTxt(mm, den) + "b"];
        ans = linTxt(nn, den, mm, den, "a", "b"); coefs = [[nn, den], [mm, den]];
      } else {
        route = "B → O → A → P";
        work = ["BP = BO + OP", "BO = −b, and OP = " + linTxt(nn, den, mm, den, "a", "b"),
          "BP = −b + " + linTxt(nn, den, mm, den, "a", "b")];
        ans = linTxt(nn, den, mm - den, den, "a", "b"); coefs = null;
      }
      steps.appendChild(step("Route", "Walk a chain of known vectors", route
        + " — the letters at the joins cancel, which is the check that the route is legal."));
      work.forEach((w, i) => steps.appendChild(step(i + 1, i === work.length - 1 ? "Collect like terms" : "Build the chain", w)));
      fAns.setValue("<b>" + (target === "AB" ? "AB" : target) + " = " + ans + "</b>");
      if (coefs) {
        const sum = coefs[0][0] / coefs[0][1] + coefs[1][0] / coefs[1][1];
        fCheck.setValue(Math.abs(sum - 1) < 1e-9
          ? fracTxt(coefs[0][0], coefs[0][1]) + " + " + fracTxt(coefs[1][0], coefs[1][1]) + " = 1 ✓ — so this point really does lie on AB"
          : "the coefficients add to " + fmt(sum, 3) + ", so this vector is not a point on AB (it is a displacement)");
      } else {
        fCheck.setValue("BP is a displacement, not a point on AB, so the add-to-1 check does not apply here.");
      }
      msg.className = "gl-msg good";
      msg.textContent = target === "OP"
        ? "Notice the swap: for AP : PB = m : n the coefficient of a is n/(m+n) and the coefficient of b is m/(m+n)."
        : "Every route question is the same idea — go from the start to the end using only vectors you know, taking a minus sign whenever you travel backwards along one.";
    }
    upd();
  };

  /* 44 · Parallel, or collinear? — the proof that earns the marks */
  build.collinlab = function (host) {
    const panel = e("div", "gl-panel");
    const form = e("div", "gl-form");
    const steps = e("div", "gl-steps");
    const msg = e("div", "gl-msg");

    const p1 = field("OX:  a ×", "1", null, upd), p2 = field("b ×", "2", null, upd);
    const q1 = field("OY:  a ×", "3", null, upd), q2 = field("b ×", "6", null, upd);
    const g = e("div", "gl-form-group");
    g.appendChild(e("div", "gl-form-title", "Two vectors from the same point O"));
    const row = e("div", "gl-form-row");
    [p1, p2, q1, q2].forEach((f) => row.appendChild(f.el));
    g.appendChild(row);
    form.appendChild(g);

    panel.appendChild(form); panel.appendChild(steps); panel.appendChild(msg);
    host.appendChild(panel);

    function step(n, title, body) {
      const d = e("div", "gl-step");
      d.appendChild(e("span", "gl-step-n", n));
      d.appendChild(html("div", "gl-step-b", "<b>" + title + "</b><br>" + body));
      return d;
    }
    const vec = (x, y) => linTxt(x, 1, y, 1, "a", "b");
    function upd() {
      const g0 = (f) => (isFinite(f.get()) ? f.get() : 0);
      const X = [g0(p1), g0(p2)], Y = [g0(q1), g0(q2)];
      steps.replaceChildren();
      steps.appendChild(step("1", "The two vectors", "OX = " + vec(X[0], X[1]) + " &nbsp;·&nbsp; OY = " + vec(Y[0], Y[1])));
      if ((X[0] === 0 && X[1] === 0) || (Y[0] === 0 && Y[1] === 0)) {
        msg.className = "gl-msg warn";
        msg.textContent = "One of the vectors is zero — give both a non-zero multiple of a or b.";
        return;
      }
      // is Y a multiple of X?
      const k = X[0] !== 0 ? Y[0] / X[0] : Y[1] / X[1];
      const ok = Math.abs(Y[0] - k * X[0]) < 1e-9 && Math.abs(Y[1] - k * X[1]) < 1e-9;
      if (ok) {
        steps.appendChild(step("2", "Try to factorise one out of the other",
          "OY = " + vec(Y[0], Y[1]) + " = " + fmt(k, 3) + "(" + vec(X[0], X[1]) + ") = " + fmt(k, 3) + " OX"));
        steps.appendChild(step("3", "State BOTH parts of the reason",
          "OY is a scalar multiple of OX, so OX and OY are <b>parallel</b>; they also share the <b>common point O</b>."));
        const XY = [Y[0] - X[0], Y[1] - X[1]];
        const ratio = Math.abs(k - 1) < 1e-9 ? "the two points coincide" : "OX : XY = 1 : " + fmt(k - 1, 3);
        steps.appendChild(step("4", "Conclude, then read off the ratio",
          "O, X and Y lie on a straight line. XY = OY − OX = " + vec(XY[0], XY[1]) + ", so " + ratio + "."));
        msg.className = "gl-msg good";
        msg.textContent = "The final mark is for the words: parallel AND a common point. Algebra on its own is not a complete proof of collinearity.";
      } else {
        steps.appendChild(step("2", "Try to factorise one out of the other",
          "Comparing the a terms needs " + (X[0] !== 0 ? fmt(Y[0] / X[0], 3) : "…")
          + ", but the b terms need " + (X[1] !== 0 ? fmt(Y[1] / X[1], 3) : "…") + " — no single scalar works."));
        steps.appendChild(step("3", "So what can you say?",
          "OY is <b>not</b> a scalar multiple of OX, so the two vectors are not parallel and O, X, Y are <b>not</b> collinear."));
        msg.className = "gl-msg warn";
        msg.textContent = "Try OX = a + 2b with OY = 3a + 6b — the same factor must work for BOTH letters before you can claim the vectors are parallel.";
      }
    }
    upd();
  };

  /* ---------- exact fractions, so the intersection algebra reads like the mark scheme ---------- */

  function frac(n, d) {
    n = Math.round(n); d = Math.round(d);
    if (d < 0) { n = -n; d = -d; }
    const g = gcd(n, d) || 1;
    return { n: n / g, d: d / g };
  }
  const frA = (p, q) => frac(p.n * q.d + q.n * p.d, p.d * q.d);
  const frS = (p, q) => frac(p.n * q.d - q.n * p.d, p.d * q.d);
  const frM = (p, q) => frac(p.n * q.n, p.d * q.d);
  const frD = (p, q) => frac(p.n * q.d, p.d * q.n);
  const frV = (p) => p.n / p.d;
  const frT = (p) => (p.d === 1 ? String(p.n).replace("-", MINUS) : String(p.n).replace("-", MINUS) + "/" + p.d);
  const ONE = frac(1, 1);
  // "1/3a + 1/3b"
  const frLin = (p, q, x, y) => linTxt(p.n, p.d, q.n, q.d, x || "a", y || "b");
  const FRACS = [
    { label: "1/4", f: frac(1, 4) }, { label: "1/3", f: frac(1, 3) },
    { label: "1/2", f: frac(1, 2) }, { label: "2/3", f: frac(2, 3) },
    { label: "3/4", f: frac(3, 4) },
  ];

  /* 45 · Where two lines meet — comparing coefficients with two parameters */
  build.meetlab = function (host) {
    let m = FRACS[2].f, n = FRACS[2].f;

    const panel = e("div", "gl-panel");
    const prompt = html("div", "gl-prompt",
      "In triangle <b>OAB</b>, <b>M</b> lies on <b>OA</b> and <b>N</b> lies on <b>AB</b>. "
      + "The lines <b>BM</b> and <b>ON</b> cross at <b>X</b>. Move M and N and watch the two-parameter method run.");
    const mChips = chipRow(FRACS.map((o) => ({ label: "OM = " + o.label + " OA", f: o.f })), (it) => { m = it.f; upd(); }, 2);
    const nChips = chipRow(FRACS.map((o) => ({ label: "AN = " + o.label + " AB", f: o.f })), (it) => { n = it.f; upd(); }, 2);
    const cvBox = gridBox();
    const canvas = document.createElement("canvas");
    cvBox.appendChild(canvas);
    const steps = e("div", "gl-steps");
    const facts = e("div", "gl-facts");
    const msg = e("div", "gl-msg");

    const fOX = factHtml("OX in terms of a and b");
    const fRatio = factHtml("Ratio along ON");
    [fOX, fRatio].forEach((f) => facts.appendChild(f));

    panel.appendChild(prompt); panel.appendChild(mChips.el); panel.appendChild(nChips.el);
    panel.appendChild(cvBox); panel.appendChild(steps); panel.appendChild(facts); panel.appendChild(msg);
    host.appendChild(panel);

    const O = [0, 0], A = [5, 1], B = [1, 4];
    const at = (P, k) => [P[0] * k, P[1] * k];
    const lerp = (P, Q, k) => [P[0] + (Q[0] - P[0]) * k, P[1] + (Q[1] - P[1]) * k];

    // t is the fraction of ON at which the two lines cross:  t = m / (1 − n + mn)
    const tOf = () => frD(m, frA(frS(ONE, n), frM(m, n)));

    const sketch = new Sketch(canvas, {
      ratio: 0.72, minH: 250, maxH: 350,
      render(c, W, H, P) {
        const mp = gridView(W, H, autoView([O, A, B], 7));
        drawGrid(c, P, mp);
        const M = at(A, frV(m)), N = lerp(A, B, frV(n)), X = at(N, frV(tOf()));
        strokePath(c, [O, A, B, O].map((p) => [mp.X(p[0]), mp.Y(p[1])]), P.faint, 1.8);
        arrow(c, mp, O, A, P.c1, 2.4, "a", P);
        arrow(c, mp, O, B, P.c3, 2.4, "b", P);
        strokePath(c, [[mp.X(B[0]), mp.Y(B[1])], [mp.X(M[0]), mp.Y(M[1])]], P.c2, 2.2, [6, 4]);
        strokePath(c, [[mp.X(O[0]), mp.Y(O[1])], [mp.X(N[0]), mp.Y(N[1])]], P.c5, 2.2, [6, 4]);
        [[O, "O"], [A, "A"], [B, "B"]].forEach(([p, nm]) =>
          tagOn(c, P, nm, mp.X(p[0]) + 11, mp.Y(p[1]) - 9, P.strong, "center", 12.5));
        dot(c, mp.X(M[0]), mp.Y(M[1]), P.c2, P.bg, 4);
        tagOn(c, P, "M", mp.X(M[0]), mp.Y(M[1]) + 14, P.c2, "center", 12);
        dot(c, mp.X(N[0]), mp.Y(N[1]), P.c5, P.bg, 4);
        tagOn(c, P, "N", mp.X(N[0]) + 13, mp.Y(N[1]), P.c5, "center", 12);
        dot(c, mp.X(X[0]), mp.Y(X[1]), P.c4, P.bg, 5.5);
        tagOn(c, P, "X", mp.X(X[0]) - 13, mp.Y(X[1]) + 11, P.c4, "center", 13);
      },
    });

    function step(k, title, body) {
      const d = e("div", "gl-step");
      d.appendChild(e("span", "gl-step-n", k));
      d.appendChild(html("div", "gl-step-b", "<b>" + title + "</b><br>" + body));
      return d;
    }
    function upd() {
      sketch.draw();
      const t = tOf(), s = frS(ONE, frM(t, n));
      const oneN = frS(ONE, n);
      const ox = frM(t, oneN), oy = frM(t, n);
      steps.replaceChildren();
      steps.appendChild(step("1", "Write down the two lines",
        "OM = " + frT(m) + "a &nbsp;·&nbsp; ON = OA + " + frT(n) + "AB = a + " + frT(n) + "(b − a) = <b>" + frLin(oneN, n) + "</b>"));
      steps.appendChild(step("2", "X lies on ON — use the parameter t",
        "OX = t × ON = " + frT(oneN) + "t a + " + frT(n) + "t b"));
      steps.appendChild(step("3", "X also lies on BM — use a DIFFERENT parameter s",
        "BM = BO + OM = " + frT(m) + "a − b, so OX = b + s(" + frT(m) + "a − b) = " + frT(m) + "s a + (1 − s) b"));
      steps.appendChild(step("4", "Compare the coefficients — valid because a and b are not parallel",
        "a terms: &nbsp;" + frT(oneN) + "t = " + frT(m) + "s<br>b terms: &nbsp;" + frT(n) + "t = 1 − s"));
      steps.appendChild(step("5", "Solve the pair",
        "From the b equation, s = 1 − " + frT(n) + "t. Substituting into the a equation gives "
        + "t = " + frT(m) + " ÷ (1 − " + frT(n) + " + " + frT(m) + "×" + frT(n) + ") = <b>t = " + frT(t) + "</b> &nbsp;(and s = " + frT(s) + ")"));
      steps.appendChild(step("6", "Substitute back",
        "OX = " + frT(t) + " × (" + frLin(oneN, n) + ") = <b>OX = " + frLin(ox, oy) + "</b>"));
      fOX.setValue("<b>OX = " + frLin(ox, oy) + "</b>");
      fRatio.setValue("OX = " + frT(t) + " ON, so OX : XN = " + frT(t) + " : " + frT(frS(ONE, t))
        + " = <b>" + t.n + " : " + (t.d - t.n) + "</b>");
      msg.className = "gl-msg " + (frV(m) === 0.5 && frV(n) === 0.5 ? "good" : "");
      msg.textContent = frV(m) === 0.5 && frV(n) === 0.5
        ? "Both midpoints: BM and ON are medians, X is the centroid, and OX : XN = 2 : 1 — the split every median makes."
        : "Two different parameters is the whole trick. X sits at a different fraction along each line, so using t for both throws away every mark in the part.";
    }
    upd();
  };

  const plural = (n, w) => n + " " + w + (n === 1 ? "" : "s");

  /* 46 · Area ratios — same height, or similar triangles */
  build.arealab = function (host) {
    const MODES = [
      { key: "height", label: "Same height" },
      { key: "similar", label: "Similar triangles" },
    ];
    let mode = "height";
    const RATIOS = [
      { label: "1 : 1", m: 1, n: 1 }, { label: "1 : 2", m: 1, n: 2 },
      { label: "2 : 1", m: 2, n: 1 }, { label: "3 : 1", m: 3, n: 1 },
      { label: "1 : 3", m: 1, n: 3 },
    ];
    let r = RATIOS[3], k = FRACS[2].f;

    const panel = e("div", "gl-panel");
    const chips = chipRow(MODES, (it) => { mode = it.key; layout(); }, 0);
    const rChips = chipRow(RATIOS.map((x) => ({ label: "AC : CB = " + x.label, r: x })), (it) => { r = it.r; upd(); }, 3);
    const kChips = chipRow(FRACS.map((o) => ({ label: "OP = " + o.label + " OA", f: o.f })), (it) => { k = it.f; upd(); }, 2);
    const form = e("div", "gl-form");
    const area = field("Area of triangle OAB (cm²)", "32", "wide", upd);
    const g = e("div", "gl-form-group");
    g.appendChild(e("div", "gl-form-title", "The whole triangle"));
    const row = e("div", "gl-form-row");
    row.appendChild(area.el);
    g.appendChild(row);
    form.appendChild(g);
    const cvBox = gridBox();
    const canvas = document.createElement("canvas");
    cvBox.appendChild(canvas);
    const steps = e("div", "gl-steps");
    const msg = e("div", "gl-msg");

    panel.appendChild(chips.el); panel.appendChild(rChips.el); panel.appendChild(kChips.el);
    panel.appendChild(form); panel.appendChild(cvBox); panel.appendChild(steps); panel.appendChild(msg);
    host.appendChild(panel);

    const O = [0, 0], A = [5, 1], B = [1, 4];
    const lerp = (P, Q, u) => [P[0] + (Q[0] - P[0]) * u, P[1] + (Q[1] - P[1]) * u];

    const sketch = new Sketch(canvas, {
      ratio: 0.72, minH: 240, maxH: 340,
      render(c, W, H, P) {
        const mp = gridView(W, H, autoView([O, A, B], 7));
        drawGrid(c, P, mp);
        const px = (p) => [mp.X(p[0]), mp.Y(p[1])];
        if (mode === "height") {
          const C = lerp(A, B, r.m / (r.m + r.n));
          fillPoly(c, [O, A, C].map(px), P.soft);
          fillPoly(c, [O, C, B].map(px), P.soft3);
          strokePath(c, [O, A, B, O].map(px), P.faint, 1.8);
          strokePath(c, [px(O), px(C)], P.c4, 2, [6, 4]);
          tagOn(c, P, "OAC", px(lerp(lerp(O, A, 0.5), C, 0.45))[0], px(lerp(lerp(O, A, 0.5), C, 0.45))[1], P.c1, "center", 12);
          tagOn(c, P, "OCB", px(lerp(lerp(O, B, 0.5), C, 0.45))[0], px(lerp(lerp(O, B, 0.5), C, 0.45))[1], P.c2, "center", 12);
          dot(c, ...px(C), P.c4, P.bg, 4.5);
          tagOn(c, P, "C", px(C)[0] + 13, px(C)[1] - 8, P.c4, "center", 12);
        } else {
          const u = frV(k);
          const Pp = lerp(O, A, u), Q = lerp(O, B, u);
          fillPoly(c, [O, A, B].map(px), P.soft3);
          fillPoly(c, [O, Pp, Q].map(px), P.soft);
          strokePath(c, [O, A, B, O].map(px), P.faint, 1.8);
          strokePath(c, [O, Pp, Q, O].map(px), P.c1, 2.2);
          dot(c, ...px(Pp), P.c1, P.bg, 4); dot(c, ...px(Q), P.c1, P.bg, 4);
          tagOn(c, P, "P", px(Pp)[0], px(Pp)[1] + 14, P.c1, "center", 12);
          tagOn(c, P, "Q", px(Q)[0] - 13, px(Q)[1], P.c1, "center", 12);
        }
        [[O, "O"], [A, "A"], [B, "B"]].forEach(([p, nm]) =>
          tagOn(c, P, nm, px(p)[0] + 11, px(p)[1] - 9, P.strong, "center", 12.5));
      },
    });

    function step(t, title, body) {
      const d = e("div", "gl-step");
      d.appendChild(e("span", "gl-step-n", t));
      d.appendChild(html("div", "gl-step-b", "<b>" + title + "</b><br>" + body));
      return d;
    }
    function layout() {
      rChips.el.style.display = mode === "height" ? "" : "none";
      kChips.el.style.display = mode === "similar" ? "" : "none";
      upd();
    }
    function upd() {
      sketch.draw();
      steps.replaceChildren();
      const T = isFinite(area.get()) && area.get() > 0 ? area.get() : 32;
      if (mode === "height") {
        const tot = r.m + r.n;
        steps.appendChild(step("1", "Spot the shared height",
          "Triangles OAC and OCB both have their apex at O and their bases on the same line AB, so they have the <b>same perpendicular height</b>."));
        steps.appendChild(step("2", "So the areas follow the bases",
          "area OAC : area OCB = AC : CB = <b>" + r.m + " : " + r.n + "</b>"));
        steps.appendChild(step("3", "Split the whole triangle",
          "OAC takes " + plural(r.m, "part") + " out of " + tot + ": &nbsp;" + fracTxt(r.m, tot) + " × " + fmt(T, 3)
          + " = <b>" + fmt((T * r.m) / tot, 3) + " cm²</b><br>OCB takes the other " + plural(r.n, "part") + ": <b>"
          + fmt((T * r.n) / tot, 3) + " cm²</b>"));
        steps.appendChild(step("✎", "The words that earn the mark",
          "\"The two triangles have the same perpendicular height from O to AB, so their areas are in the same ratio as their bases.\""));
        msg.className = "gl-msg good";
        msg.textContent = "Use the BASE ratio here — no squaring. Squaring belongs to similar triangles, which is the other tab.";
      } else {
        const u = frV(k), kk = frT(k);
        steps.appendChild(step("1", "Write the two vectors",
          "OP = " + kk + "a and OQ = " + kk + "b, so PQ = OQ − OP = " + kk + "(b − a) = " + kk + " × AB"));
        steps.appendChild(step("2", "So the triangles are similar",
          "PQ is a scalar multiple of AB, so PQ is parallel to AB and triangle OPQ is an enlargement of triangle OAB with scale factor " + kk + "."));
        steps.appendChild(step("3", "Lengths, then areas",
          "lengths OPQ : OAB = " + kk + " : 1 = <b>" + k.n + " : " + k.d + "</b><br>areas = the SQUARE of that = <b>"
          + (k.n * k.n) + " : " + (k.d * k.d) + "</b>"));
        steps.appendChild(step("4", "Put a number on it",
          "area OPQ = " + fracTxt(k.n * k.n, k.d * k.d) + " × " + fmt(T, 3) + " = <b>" + fmt(T * u * u, 3) + " cm²</b>"));
        msg.className = "gl-msg warn";
        msg.textContent = "Similar triangles square the length ratio. Mixing this up with the same-height rule is the classic slip — check which situation you are in before writing an area ratio.";
      }
    }
    layout();
  };

  /* 47 · Comparing coefficients — two unknowns, two equations */
  build.coefflab = function (host) {
    const panel = e("div", "gl-panel");
    const eq = html("div", "gl-eq", "(p₁x + q₁y) a + (p₂x + q₂y) b = r₁ a + r₂ b");
    const prompt = html("div", "gl-prompt",
      "Valid only because <b>a</b> and <b>b</b> are not parallel — that is why the question always says so.");
    const form = e("div", "gl-form");
    const steps = e("div", "gl-steps");
    const msg = e("div", "gl-msg");

    const p1 = field("x in the a part", "2", null, upd), q1 = field("y in the a part", "1", null, upd);
    const p2 = field("x in the b part", "1", null, upd), q2 = field("y in the b part", MINUS + "3", null, upd);
    const r1 = field("a on the right", "8", null, upd), r2 = field("b on the right", MINUS + "3", null, upd);

    function group(title, items) {
      const g = e("div", "gl-form-group");
      g.appendChild(e("div", "gl-form-title", title));
      const row = e("div", "gl-form-row");
      items.forEach((i) => row.appendChild(i));
      g.appendChild(row);
      return g;
    }
    form.appendChild(group("Left-hand side", [p1.el, q1.el, p2.el, q2.el]));
    form.appendChild(group("Right-hand side", [r1.el, r2.el]));
    panel.appendChild(eq); panel.appendChild(prompt); panel.appendChild(form);
    panel.appendChild(steps); panel.appendChild(msg);
    host.appendChild(panel);

    function step(t, title, body) {
      const d = e("div", "gl-step");
      d.appendChild(e("span", "gl-step-n", t));
      d.appendChild(html("div", "gl-step-b", "<b>" + title + "</b><br>" + body));
      return d;
    }
    // "2x + y", tidily
    function side(px, qy) {
      const a = px === 0 ? "" : (px === 1 ? "" : px === -1 ? MINUS : fmt(px, 3)) + "x";
      let b = "";
      if (qy !== 0) {
        const mag = Math.abs(qy) === 1 ? "" : fmt(Math.abs(qy), 3);
        b = (a ? (qy > 0 ? " + " : " " + MINUS + " ") : qy < 0 ? MINUS : "") + mag + "y";
      }
      return (a + b) || "0";
    }
    function upd() {
      const v = (f) => (isFinite(f.get()) ? f.get() : 0);
      const P1 = v(p1), Q1 = v(q1), P2 = v(p2), Q2 = v(q2), R1 = v(r1), R2 = v(r2);
      steps.replaceChildren();
      steps.appendChild(step("1", "Compare the a terms",
        side(P1, Q1) + " = " + fmt(R1, 3)));
      steps.appendChild(step("2", "Compare the b terms",
        side(P2, Q2) + " = " + fmt(R2, 3)));
      const det = P1 * Q2 - Q1 * P2;
      if (Math.abs(det) < 1e-9) {
        msg.className = "gl-msg warn";
        msg.textContent = "These two equations are not independent, so x and y cannot be pinned down. Change one of the coefficients.";
        return;
      }
      const x = (R1 * Q2 - Q1 * R2) / det, y = (P1 * R2 - R1 * P2) / det;
      steps.appendChild(step("3", "Solve the pair simultaneously",
        "Eliminating y: (" + fmt(P1, 3) + "×" + fmt(Q2, 3) + " − " + fmt(Q1, 3) + "×" + fmt(P2, 3) + ")x = "
        + fmt(R1, 3) + "×" + fmt(Q2, 3) + " − " + fmt(Q1, 3) + "×" + fmt(R2, 3)
        + " &nbsp;⟹&nbsp; " + fmt(det, 3) + "x = " + fmt(R1 * Q2 - Q1 * R2, 3)));
      steps.appendChild(step("4", "The two answers",
        "<b>x = " + fmt(x, 4) + "</b> and <b>y = " + fmt(y, 4) + "</b>"));
      steps.appendChild(step("✓", "Check both equations",
        side(P1, Q1) + " = " + fmt(P1 * x + Q1 * y, 3) + " ✓ &nbsp;·&nbsp; "
        + side(P2, Q2) + " = " + fmt(P2 * x + Q2 * y, 3) + " ✓"));
      msg.className = "gl-msg good";
      msg.textContent = "One vector equation carries two ordinary equations — one from the a terms and one from the b terms. That is the whole method, and it is what unlocks intersections too.";
    }
    upd();
  };

  /* ---------- a plain x–y chart frame for the statistics labs ---------- */

  function chart(W, H, o) {
    const padL = o.padL == null ? 46 : o.padL, padR = 16, padT = 16, padB = o.padB == null ? 40 : o.padB;
    return {
      o, padL, padR, padT, padB,
      X: (x) => padL + ((x - o.xmin) / (o.xmax - o.xmin)) * (W - padL - padR),
      Y: (y) => H - padB - ((y - o.ymin) / (o.ymax - o.ymin)) * (H - padT - padB),
    };
  }
  function drawAxes(c, W, H, P, m) {
    const o = m.o;
    c.save();
    c.strokeStyle = P.grid; c.lineWidth = 1;
    for (let x = o.xmin; x <= o.xmax + 1e-9; x += o.stepx) {
      c.beginPath(); c.moveTo(m.X(x), m.Y(o.ymin)); c.lineTo(m.X(x), m.Y(o.ymax)); c.stroke();
    }
    for (let y = o.ymin; y <= o.ymax + 1e-9; y += o.stepy) {
      c.beginPath(); c.moveTo(m.X(o.xmin), m.Y(y)); c.lineTo(m.X(o.xmax), m.Y(y)); c.stroke();
    }
    c.strokeStyle = P.axis; c.lineWidth = 1.5;
    c.beginPath(); c.moveTo(m.X(o.xmin), m.Y(o.ymin)); c.lineTo(m.X(o.xmax), m.Y(o.ymin)); c.stroke();
    c.beginPath(); c.moveTo(m.X(o.xmin), m.Y(o.ymin)); c.lineTo(m.X(o.xmin), m.Y(o.ymax)); c.stroke();
    c.fillStyle = P.text; c.font = "10px Inter, system-ui, sans-serif";
    c.textAlign = "center"; c.textBaseline = "top";
    for (let x = o.xmin; x <= o.xmax + 1e-9; x += o.stepx) c.fillText(fmt(x, 2), m.X(x), m.Y(o.ymin) + 5);
    c.textAlign = "right"; c.textBaseline = "middle";
    for (let y = o.ymin; y <= o.ymax + 1e-9; y += o.stepy) c.fillText(fmt(y, 2), m.X(o.xmin) - 5, m.Y(y));
    c.fillStyle = P.strong; c.font = "700 11px Inter, system-ui, sans-serif";
    if (o.xlab) { c.textAlign = "center"; c.textBaseline = "alphabetic"; c.fillText(o.xlab, (m.X(o.xmin) + m.X(o.xmax)) / 2, H - 8); }
    if (o.ylab) {
      c.save(); c.translate(11, (m.Y(o.ymin) + m.Y(o.ymax)) / 2); c.rotate(-Math.PI / 2);
      c.textAlign = "center"; c.textBaseline = "middle"; c.fillText(o.ylab, 0, 0); c.restore();
    }
    c.restore();
  }
  // least-squares line, which is what a well-drawn line of best fit approximates
  function bestFit(pts) {
    const n = pts.length;
    const mx = pts.reduce((s, p) => s + p[0], 0) / n, my = pts.reduce((s, p) => s + p[1], 0) / n;
    let sxy = 0, sxx = 0, syy = 0;
    pts.forEach((p) => { sxy += (p[0] - mx) * (p[1] - my); sxx += (p[0] - mx) ** 2; syy += (p[1] - my) ** 2; });
    return { m: sxy / sxx, c: my - (sxy / sxx) * mx, mx, my, r: sxy / Math.sqrt(sxx * syy) };
  }

  /* 48 · Scatter diagrams, correlation and the line of best fit */
  build.scatterlab = function (host) {
    const SETS = [
      { label: "Revision vs score", xlab: "hours of revision", ylab: "test score (%)",
        pts: [[1,35],[2,42],[3,44],[4,51],[5,56],[6,62],[7,66],[8,71],[9,78],[10,82]],
        ctx: "students who revised for longer tended to score higher marks" },
      { label: "Car age vs value", xlab: "age (years)", ylab: "value ($1000s)",
        pts: [[1,17],[2,15],[3,13.5],[4,11.5],[5,10],[6,8.5],[7,7],[8,6]],
        ctx: "older cars are worth less" },
      { label: "Weak positive", xlab: "hours of sleep", ylab: "test score (%)",
        pts: [[4,48],[5,72],[6,55],[6,68],[7,60],[7,79],[8,66],[8,58],[9,81],[10,70]],
        ctx: "students who slept longer tended to score a little higher, but the link is loose" },
      { label: "No correlation", xlab: "shoe size", ylab: "test score (%)",
        pts: [[3,62],[4,48],[4,77],[5,55],[6,70],[6,44],[7,80],[8,52],[8,68],[9,59]],
        ctx: "shoe size tells you nothing about the test score" },
    ];
    let set = SETS[0], at = 6;

    const panel = e("div", "gl-panel");
    const chips = chipRow(SETS.map((s) => ({ label: s.label, s })), (it) => { set = it.s; reset(); }, 0);
    const controls = e("div", "gl-controls");
    const cvBox = e("div", "gl-canvas");
    const canvas = document.createElement("canvas");
    cvBox.appendChild(canvas);
    const facts = e("div", "gl-facts");
    const msg = e("div", "gl-msg");

    const fCorr = factHtml("Correlation");
    const fLine = factHtml("Line of best fit");
    const fRead = factHtml("Estimate from the line");
    [fCorr, fLine, fRead].forEach((f) => facts.appendChild(f));

    let atS = null;
    panel.appendChild(chips.el); panel.appendChild(controls); panel.appendChild(cvBox);
    panel.appendChild(facts); panel.appendChild(msg);
    host.appendChild(panel);

    const view = () => {
      const xs = set.pts.map((p) => p[0]), ys = set.pts.map((p) => p[1]);
      const xmin = 0, xmax = Math.ceil(Math.max.apply(null, xs) * 1.4);
      const ymax = Math.ceil(Math.max.apply(null, ys) * 1.15 / 10) * 10;
      return { xmin, xmax, ymin: 0, ymax, stepx: niceStep(xmax), stepy: niceStep(ymax),
               xlab: set.xlab, ylab: set.ylab };
    };

    const sketch = new Sketch(canvas, {
      ratio: 0.68, minH: 240, maxH: 330,
      render(c, W, H, P) {
        const o = view();
        const m = chart(W, H, o);
        drawAxes(c, W, H, P, m);
        const f = bestFit(set.pts);
        const strong = Math.abs(f.r) > 0.85;
        // line of best fit across the data range only
        const x0 = Math.min.apply(null, set.pts.map((p) => p[0])), x1 = Math.max.apply(null, set.pts.map((p) => p[0]));
        if (strong || Math.abs(f.r) > 0.4) {
          strokePath(c, [[m.X(x0), m.Y(f.m * x0 + f.c)], [m.X(x1), m.Y(f.m * x1 + f.c)]], P.c2, 2.4);
          // the dashed part beyond the data is where extrapolation starts
          strokePath(c, [[m.X(x1), m.Y(f.m * x1 + f.c)], [m.X(o.xmax), m.Y(f.m * o.xmax + f.c)]], P.c2, 1.6, [6, 4]);
        }
        set.pts.forEach((p) => dot(c, m.X(p[0]), m.Y(p[1]), P.c1, P.bg, 4));
        dot(c, m.X(f.mx), m.Y(f.my), P.c4, P.bg, 5.5);
        tagOn(c, P, "mean point", m.X(f.mx), m.Y(f.my) - 14, P.c4, "center", 11);
        // the reading lines
        const yAt = f.m * at + f.c;
        if (strong || Math.abs(f.r) > 0.4) {
          strokePath(c, [[m.X(at), m.Y(o.ymin)], [m.X(at), m.Y(yAt)]], P.c3, 1.8, [5, 4]);
          strokePath(c, [[m.X(o.xmin), m.Y(yAt)], [m.X(at), m.Y(yAt)]], P.c3, 1.8, [5, 4]);
          dot(c, m.X(at), m.Y(yAt), P.c3, P.bg, 4.5);
        }
      },
    });

    function reset() {
      const xs = set.pts.map((p) => p[0]);
      const lo = Math.min.apply(null, xs), hi = Math.max.apply(null, xs);
      controls.replaceChildren();
      at = Math.round((lo + hi) / 2);
      atS = slider("Read the line at " + set.xlab, lo, Math.round(hi * 1.4), 1, at, (v) => { at = v; upd(); });
      controls.appendChild(atS.el);
      upd();
    }
    function upd() {
      sketch.draw();
      const f = bestFit(set.pts);
      const xs = set.pts.map((p) => p[0]);
      const hi = Math.max.apply(null, xs), lo = Math.min.apply(null, xs);
      const strength = Math.abs(f.r) > 0.85 ? "strong" : Math.abs(f.r) > 0.4 ? "weak" : "no";
      const dirn = f.r > 0 ? "positive" : "negative";
      fCorr.setValue(strength === "no" ? "<b>No correlation</b> — the points show no pattern"
        : "<b>" + strength[0].toUpperCase() + strength.slice(1) + " " + dirn + " correlation</b> — " + set.ctx);
      if (strength === "no") {
        fLine.setValue("A line of best fit should not be drawn — there is no trend to follow.");
        fRead.setValue("—");
        msg.className = "gl-msg warn";
        msg.textContent = "With no correlation there is no line and no prediction. Saying \"no correlation\" IS the answer to \"describe the correlation\".";
        return;
      }
      fLine.setValue("gradient " + fmt(f.m, 2) + ", intercept " + fmt(f.c, 1)
        + " · it passes through the mean point (" + fmt(f.mx, 1) + ", " + fmt(f.my, 1) + ")");
      const y = f.m * at + f.c;
      const out = at > hi || at < lo;
      fRead.setValue("at " + fmt(at, 2) + " " + set.xlab.split(" ")[0] + " → <b>" + fmt(y, 1) + "</b>"
        + (out ? " &nbsp;— <b>extrapolation</b>" : " &nbsp;— interpolation, reliable"));
      msg.className = "gl-msg " + (out ? "warn" : "good");
      msg.textContent = out
        ? "That reading is outside the data (which runs from " + lo + " to " + hi + "), so it is extrapolation — the trend may not continue, and the estimate is unreliable. Exams award the mark for saying exactly that."
        : "A full-mark description gives strength AND direction AND the meaning in context. Correlation is still not cause: something else may be driving both variables.";
    }
    reset();
  };

  /* 49 · Histograms — frequency density and area */
  build.histlab = function (host) {
    const BOUNDS = [0, 10, 20, 40, 70, 100];
    const freqs = [15, 25, 30, 18, 12];
    let from = 20, to = 25;

    const panel = e("div", "gl-panel");
    const prompt = html("div", "gl-prompt",
      "Type any frequencies you like — the class widths are unequal, so the bar heights must be the <b>frequency density</b>.");
    const inputs = e("div", "gl-inputs");
    const cvBox = e("div", "gl-canvas");
    const canvas = document.createElement("canvas");
    cvBox.appendChild(canvas);
    const tableBox = e("div");
    const form = e("div", "gl-form");
    const facts = e("div", "gl-facts");
    const msg = e("div", "gl-msg");

    const fields = freqs.map((f, i) => {
      const fd = field(BOUNDS[i] + "–" + BOUNDS[i + 1], String(f), null, upd);
      inputs.appendChild(fd.el);
      return fd;
    });
    const fromF = field("from", String(from), null, upd);
    const toF = field("to", String(to), null, upd);
    const g = e("div", "gl-form-group");
    g.appendChild(e("div", "gl-form-title", "Estimate the number in part of a class"));
    const row = e("div", "gl-form-row");
    row.appendChild(fromF.el); row.appendChild(toF.el);
    g.appendChild(row); form.appendChild(g);

    const fTotal = factHtml("Total frequency");
    const fModal = factHtml("Modal class");
    const fPart = factHtml("Estimated number in that range");
    [fTotal, fModal, fPart].forEach((f) => facts.appendChild(f));

    panel.appendChild(prompt); panel.appendChild(inputs); panel.appendChild(cvBox);
    panel.appendChild(tableBox); panel.appendChild(form); panel.appendChild(facts); panel.appendChild(msg);
    host.appendChild(panel);

    const vals = () => fields.map((f) => (isFinite(f.get()) && f.get() >= 0 ? f.get() : 0));
    const dens = () => vals().map((v, i) => v / (BOUNDS[i + 1] - BOUNDS[i]));

    const sketch = new Sketch(canvas, {
      ratio: 0.6, minH: 220, maxH: 320,
      render(c, W, H, P) {
        const d = dens();
        const ymax = Math.max(0.5, Math.ceil(Math.max.apply(null, d) * 1.2 * 2) / 2);
        const m = chart(W, H, { xmin: 0, xmax: BOUNDS[BOUNDS.length - 1], ymin: 0, ymax,
          stepx: 10, stepy: niceStep(ymax), xlab: "time (minutes)", ylab: "frequency density" });
        drawAxes(c, W, H, P, m);
        d.forEach((h, i) => {
          const x0 = m.X(BOUNDS[i]), x1 = m.X(BOUNDS[i + 1]), y0 = m.Y(0), y1 = m.Y(h);
          c.save();
          c.fillStyle = P.soft; c.fillRect(x0, y1, x1 - x0, y0 - y1);
          c.strokeStyle = P.c1; c.lineWidth = 2; c.strokeRect(x0, y1, x1 - x0, y0 - y1);
          c.restore();
          if (h > 0) tagOn(c, P, fmt(h, 2), (x0 + x1) / 2, y1 - 9, P.c1, "center", 10.5);
        });
        // the slice being estimated
        const a = Math.min(fromF.get(), toF.get()), b = Math.max(fromF.get(), toF.get());
        if (isFinite(a) && isFinite(b) && b > a) {
          c.save();
          c.fillStyle = P.soft3;
          c.fillRect(m.X(Math.max(a, 0)), m.Y(m.o.ymax), m.X(Math.min(b, BOUNDS[BOUNDS.length - 1])) - m.X(Math.max(a, 0)), m.Y(0) - m.Y(m.o.ymax));
          c.restore();
        }
      },
    });

    function upd() {
      sketch.draw();
      const v = vals(), d = dens();
      const box = e("div", "gl-scroll");
      const tb = e("table", "gl-table");
      const head = e("tr");
      ["Class", "Frequency", "Width", "Frequency density"].forEach((t) => head.appendChild(e("th", null, t)));
      tb.appendChild(head);
      v.forEach((f, i) => {
        const r = e("tr");
        r.appendChild(e("td", "gl-td-x", BOUNDS[i] + " < t ≤ " + BOUNDS[i + 1]));
        r.appendChild(e("td", null, fmt(f, 2)));
        r.appendChild(e("td", null, String(BOUNDS[i + 1] - BOUNDS[i])));
        r.appendChild(e("td", null, fmt(d[i], 3)));
        tb.appendChild(r);
      });
      box.appendChild(tb);
      tableBox.replaceChildren(box);

      const total = v.reduce((s, x) => s + x, 0);
      const best = d.indexOf(Math.max.apply(null, d));
      fTotal.setValue(fmt(total, 2) + " values");
      fModal.setValue(BOUNDS[best] + " < t ≤ " + BOUNDS[best + 1]
        + " — the tallest bar, i.e. the greatest frequency <b>density</b>");
      const a = Math.min(fromF.get(), toF.get()), b = Math.max(fromF.get(), toF.get());
      if (!isFinite(a) || !isFinite(b) || b <= a) {
        fPart.setValue("enter a range");
      } else {
        let n = 0, parts = [];
        d.forEach((h, i) => {
          const lo = Math.max(a, BOUNDS[i]), hi = Math.min(b, BOUNDS[i + 1]);
          if (hi > lo) { n += h * (hi - lo); parts.push(fmt(h, 3) + " × " + fmt(hi - lo, 2)); }
        });
        fPart.setValue(parts.join(" + ") + " = <b>" + fmt(n, 2) + "</b>, so about " + Math.round(n) + " values");
      }
      msg.className = "gl-msg good";
      msg.textContent = "Frequency is the AREA of a bar, not its height. The widest class here can hold the most values while having one of the shortest bars — which is exactly why plotting frequency instead of density scores zero.";
    }
    upd();
  };

  /* 50 · Cumulative frequency, quartiles and the box plot */
  build.cumfreqlab = function (host) {
    const BOUNDS = [0, 10, 20, 30, 40, 50, 60, 70];
    const start = [4, 10, 18, 28, 22, 12, 6];
    let pct = 50;

    const panel = e("div", "gl-panel");
    const prompt = html("div", "gl-prompt",
      "Cumulative frequency is a running total plotted against the <b>upper</b> class boundary. Slide the percentile to read values off the curve.");
    const inputs = e("div", "gl-inputs");
    const controls = e("div", "gl-controls");
    const cvBox = e("div", "gl-canvas");
    const canvas = document.createElement("canvas");
    cvBox.appendChild(canvas);
    const facts = e("div", "gl-facts");
    const msg = e("div", "gl-msg");

    const fields = start.map((f, i) => {
      const fd = field(BOUNDS[i] + "–" + BOUNDS[i + 1], String(f), null, upd);
      inputs.appendChild(fd.el);
      return fd;
    });
    const pS = slider("Percentile", 1, 99, 1, pct, (v) => { pct = v; upd(); });
    controls.appendChild(pS.el);

    const fCF = factHtml("Cumulative frequencies");
    const fQ = factHtml("Median and quartiles");
    const fIQR = factHtml("Interquartile range");
    const fPct = factHtml("Percentile reading");
    [fCF, fQ, fIQR, fPct].forEach((f) => facts.appendChild(f));

    panel.appendChild(prompt); panel.appendChild(inputs); panel.appendChild(controls);
    panel.appendChild(cvBox); panel.appendChild(facts); panel.appendChild(msg);
    host.appendChild(panel);

    const vals = () => fields.map((f) => (isFinite(f.get()) && f.get() >= 0 ? f.get() : 0));
    function cum() {
      const v = vals(); const out = [0]; let s = 0;
      v.forEach((x) => { s += x; out.push(s); });
      return out;                                     // out[i] is the CF at BOUNDS[i]
    }
    // read a value off the curve by linear interpolation, the way a student reads a graph
    function readAt(cf) {
      const cu = cum(), n = cu[cu.length - 1];
      if (n <= 0) return null;
      for (let i = 1; i < cu.length; i++) {
        if (cf <= cu[i]) {
          const span = cu[i] - cu[i - 1];
          const t = span === 0 ? 0 : (cf - cu[i - 1]) / span;
          return BOUNDS[i - 1] + t * (BOUNDS[i] - BOUNDS[i - 1]);
        }
      }
      return BOUNDS[BOUNDS.length - 1];
    }

    const sketch = new Sketch(canvas, {
      ratio: 0.68, minH: 250, maxH: 340,
      render(c, W, H, P) {
        const cu = cum(), n = cu[cu.length - 1];
        const ymax = Math.max(10, Math.ceil(n / 10) * 10);
        const m = chart(W, H, { xmin: 0, xmax: BOUNDS[BOUNDS.length - 1], ymin: 0, ymax,
          stepx: 10, stepy: niceStep(ymax), xlab: "mark", ylab: "cumulative frequency" });
        drawAxes(c, W, H, P, m);
        const pts = cu.map((v, i) => [m.X(BOUNDS[i]), m.Y(v)]);
        strokePath(c, pts, P.c1, 2.6);
        pts.forEach((p) => dot(c, p[0], p[1], P.c1, P.bg, 3.5));
        // quartile reading lines
        [[n / 4, "Q₁", P.c3], [n / 2, "median", P.c2], [(3 * n) / 4, "Q₃", P.c5]].forEach(([cf, lab, colr]) => {
          const x = readAt(cf);
          if (x == null) return;
          strokePath(c, [[m.X(0), m.Y(cf)], [m.X(x), m.Y(cf)]], colr, 1.5, [5, 4]);
          strokePath(c, [[m.X(x), m.Y(cf)], [m.X(x), m.Y(0)]], colr, 1.5, [5, 4]);
          // label at the reading point itself, so the three do not collide on the axis
          tagOn(c, P, lab + " " + fmt(x, 1), m.X(x) + 30, m.Y(cf) - 9, colr, "center", 10.5);
        });
      },
    });

    function upd() {
      sketch.draw();
      const cu = cum(), n = cu[cu.length - 1];
      fCF.setValue(cu.slice(1).map((v, i) => "≤" + BOUNDS[i + 1] + ": " + fmt(v, 2)).join(" · "));
      if (n <= 0) { fQ.setValue("enter some frequencies"); return; }
      const q1 = readAt(n / 4), med = readAt(n / 2), q3 = readAt((3 * n) / 4);
      fQ.setValue("read across from " + fmt(n / 4, 2) + ", " + fmt(n / 2, 2) + " and " + fmt((3 * n) / 4, 2)
        + " → Q₁ ≈ <b>" + fmt(q1, 1) + "</b>, median ≈ <b>" + fmt(med, 1) + "</b>, Q₃ ≈ <b>" + fmt(q3, 1) + "</b>");
      fIQR.setValue("Q₃ − Q₁ = " + fmt(q3, 1) + " − " + fmt(q1, 1) + " = <b>" + fmt(q3 - q1, 1) + "</b>");
      const cf = (pct / 100) * n, x = readAt(cf);
      fPct.setValue("the " + pct + "th percentile: read across from " + fmt(cf, 2) + " → <b>" + fmt(x, 1)
        + "</b>, so " + pct + "% scored " + fmt(x, 1) + " or less &nbsp;·&nbsp; " + fmt(n - cf, 2) + " scored more");
      msg.className = "gl-msg good";
      msg.textContent = "On a curve you read across from n ÷ 2, not (n + 1) ÷ 2 — the curve is a continuous model. Draw your reading lines on the paper: a correct line earns the method mark even if the value is slightly out.";
    }
    upd();
  };

  /* 51 · Averages and spread from a list */
  build.meanlab = function (host) {
    const panel = e("div", "gl-panel");
    const form = e("div", "gl-form");
    const steps = e("div", "gl-steps");
    const facts = e("div", "gl-facts");
    const msg = e("div", "gl-msg");

    const listF = document.createElement("input");
    listF.type = "text";
    listF.className = "gl-cell ans";
    listF.value = "3, 5, 6, 8, 11, 12, 14, 15, 18, 20, 25";
    listF.style.maxWidth = "none";
    listF.addEventListener("input", upd);
    const g = e("div", "gl-form-group");
    g.appendChild(e("div", "gl-form-title", "Your data — separate the values with commas"));
    const row = e("div", "gl-form-row");
    row.appendChild(listF);
    g.appendChild(row); form.appendChild(g);

    const fMean = factHtml("Mean");
    const fMed = factHtml("Median");
    const fMode = factHtml("Mode");
    const fSpread = factHtml("Range and IQR");
    [fMean, fMed, fMode, fSpread].forEach((f) => facts.appendChild(f));

    panel.appendChild(form); panel.appendChild(steps); panel.appendChild(facts); panel.appendChild(msg);
    host.appendChild(panel);

    function step(k, title, body) {
      const d = e("div", "gl-step");
      d.appendChild(e("span", "gl-step-n", k));
      d.appendChild(html("div", "gl-step-b", "<b>" + title + "</b><br>" + body));
      return d;
    }
    const medOf = (a) => {
      const k = a.length;
      return k === 0 ? null : k % 2 ? a[(k - 1) / 2] : (a[k / 2 - 1] + a[k / 2]) / 2;
    };
    function upd() {
      const nums = listF.value.split(/[,\s]+/).map((s) => parseFloat(s.replace(/−/g, "-")))
        .filter((x) => isFinite(x));
      steps.replaceChildren();
      if (nums.length < 2) {
        msg.className = "gl-msg warn";
        msg.textContent = "Type at least two numbers, separated by commas.";
        return;
      }
      const a = nums.slice().sort((p, q) => p - q);
      const n = a.length, sum = a.reduce((s, x) => s + x, 0);
      steps.appendChild(step("1", "Put the values in order first",
        a.join(", ") + " &nbsp;(n = " + n + ")"));
      steps.appendChild(step("2", "Mean = total ÷ how many",
        fmt(sum, 3) + " ÷ " + n + " = <b>" + fmt(sum / n, 3) + "</b>"));
      const pos = (n + 1) / 2;
      steps.appendChild(step("3", "Median sits at position (n + 1) ÷ 2",
        "(" + n + " + 1) ÷ 2 = " + fmt(pos, 1) + (Number.isInteger(pos)
          ? ", so the " + pos + "th value" : ", so the mean of the " + Math.floor(pos) + "th and " + Math.ceil(pos) + "th values")
        + " → <b>" + fmt(medOf(a), 3) + "</b>"));
      const half = Math.floor(n / 2);
      const lower = a.slice(0, half), upper = a.slice(n % 2 ? half + 1 : half);
      const q1 = medOf(lower), q3 = medOf(upper);
      steps.appendChild(step("4", "Quartiles are the medians of the two halves",
        "lower half " + lower.join(", ") + " → Q₁ = <b>" + fmt(q1, 3) + "</b><br>"
        + "upper half " + upper.join(", ") + " → Q₃ = <b>" + fmt(q3, 3) + "</b>"
        + (n % 2 ? "<br>(with an odd n the median itself is left out of both halves)" : "")));
      const counts = {};
      a.forEach((x) => { counts[x] = (counts[x] || 0) + 1; });
      const top = Math.max.apply(null, Object.values(counts));
      const modes = Object.keys(counts).filter((k) => counts[k] === top).map(Number);
      fMean.setValue(fmt(sum / n, 3));
      fMed.setValue(fmt(medOf(a), 3));
      fMode.setValue(top === 1 ? "no mode — every value appears once"
        : modes.join(", ") + " (appearing " + top + " times)");
      fSpread.setValue("range = " + fmt(a[n - 1], 3) + " − " + fmt(a[0], 3) + " = <b>" + fmt(a[n - 1] - a[0], 3)
        + "</b> · IQR = " + fmt(q3, 3) + " − " + fmt(q1, 3) + " = <b>" + fmt(q3 - q1, 3) + "</b>");
      msg.className = "gl-msg good";
      msg.textContent = "Add one huge value to the list and watch: the mean and the range jump, the median and the IQR barely move. That is exactly why the median and IQR are used when there are outliers.";
    }
    upd();
  };

  /* 52 · Mean from a frequency table — discrete values or grouped classes */
  build.freqmeanlab = function (host) {
    const MODES = [
      { key: "discrete", label: "Discrete values" },
      { key: "grouped", label: "Grouped classes" },
    ];
    let mode = "discrete";
    const XS = [0, 1, 2, 3, 4];
    const DF = [5, 8, 4, 2, 1];
    const CB = [0, 10, 20, 30, 40, 50];
    const GF = [4, 9, 12, 7, 3];

    const panel = e("div", "gl-panel");
    const chips = chipRow(MODES, (it) => { mode = it.key; layout(); }, 0);
    const inputs = e("div", "gl-inputs");
    const tableBox = e("div");
    const facts = e("div", "gl-facts");
    const msg = e("div", "gl-msg");

    const dFields = DF.map((f, i) => field("x = " + XS[i], String(f), null, upd));
    const gFields = GF.map((f, i) => field(CB[i] + "–" + CB[i + 1], String(f), null, upd));

    const fSum = factHtml("Σf and Σfx");
    const fMean = factHtml("Mean");
    const fMed = factHtml("Median");
    const fMode = factHtml("Mode / modal class");
    [fSum, fMean, fMed, fMode].forEach((f) => facts.appendChild(f));

    panel.appendChild(chips.el); panel.appendChild(inputs); panel.appendChild(tableBox);
    panel.appendChild(facts); panel.appendChild(msg);
    host.appendChild(panel);

    function layout() {
      inputs.replaceChildren.apply(inputs, (mode === "discrete" ? dFields : gFields).map((f) => f.el));
      upd();
    }
    function upd() {
      const grouped = mode === "grouped";
      const fs = (grouped ? gFields : dFields).map((f) => (isFinite(f.get()) && f.get() >= 0 ? f.get() : 0));
      const xs = grouped ? CB.slice(0, -1).map((b, i) => (b + CB[i + 1]) / 2) : XS;
      const labels = grouped ? CB.slice(0, -1).map((b, i) => b + " < t ≤ " + CB[i + 1]) : XS.map(String);

      const box = e("div", "gl-scroll");
      const tb = e("table", "gl-table");
      const head = e("tr");
      [grouped ? "Class" : "Value x", "Frequency f", grouped ? "Midpoint x" : "f × x", grouped ? "f × x" : "Cumulative f"]
        .forEach((t) => head.appendChild(e("th", null, t)));
      if (grouped) head.appendChild(e("th", null, "Cumulative f"));
      tb.appendChild(head);
      let sf = 0, sfx = 0;
      const cums = [];
      fs.forEach((f, i) => {
        sf += f; sfx += f * xs[i]; cums.push(sf);
        const r = e("tr");
        r.appendChild(e("td", "gl-td-x", labels[i]));
        r.appendChild(e("td", null, fmt(f, 2)));
        if (grouped) r.appendChild(e("td", null, fmt(xs[i], 2)));
        r.appendChild(e("td", null, fmt(f * xs[i], 2)));
        r.appendChild(e("td", null, fmt(sf, 2)));
        tb.appendChild(r);
      });
      const tot = e("tr");
      tot.appendChild(e("td", "gl-td-x", "Total"));
      tot.appendChild(e("td", "gl-td-ok", fmt(sf, 2)));
      if (grouped) tot.appendChild(e("td", null, ""));
      tot.appendChild(e("td", "gl-td-ok", fmt(sfx, 2)));
      tot.appendChild(e("td", null, ""));
      tb.appendChild(tot);
      box.appendChild(tb);
      tableBox.replaceChildren(box);

      if (sf <= 0) { fMean.setValue("enter some frequencies"); return; }
      fSum.setValue("Σf = " + fmt(sf, 2) + " · Σfx = " + fmt(sfx, 2));
      fMean.setValue((grouped ? "estimated mean = " : "mean = ") + "Σfx ÷ Σf = " + fmt(sfx, 2) + " ÷ " + fmt(sf, 2)
        + " = <b>" + fmt(sfx / sf, 3) + "</b>" + (grouped ? " — an <b>estimate</b>, because every value is treated as sitting at the midpoint" : ""));
      // median position, then the row it falls in
      const pos = (sf + 1) / 2;
      let idx = cums.findIndex((c) => c >= pos);
      if (idx < 0) idx = fs.length - 1;
      fMed.setValue(grouped
        ? "the " + fmt(pos, 1) + "th value falls in <b>" + labels[idx] + "</b> — the class containing the median"
        : "the " + fmt(pos, 1) + "th value → median = <b>" + fmt(xs[idx], 2) + "</b>");
      const best = fs.indexOf(Math.max.apply(null, fs));
      fMode.setValue(grouped ? "modal class = <b>" + labels[best] + "</b>"
        : "mode = <b>" + fmt(xs[best], 2) + "</b> — the value, not its frequency (" + fmt(fs[best], 2) + ")");
      msg.className = "gl-msg " + (grouped ? "warn" : "good");
      msg.textContent = grouped
        ? "Once data is grouped the original values are gone, so the mean can only be estimated — and the word \"estimate\" often carries its own mark."
        : "The mode is the VALUE with the highest frequency, not the frequency itself. Writing the frequency is a guaranteed lost mark.";
    }
    layout();
  };

  /* 53 · Comparing two datasets with box plots */
  build.boxlab = function (host) {
    const A = [12, 28, 40, 52, 68], B = [20, 34, 42, 50, 62];
    const panel = e("div", "gl-panel");
    const prompt = html("div", "gl-prompt",
      "Enter the five-number summary of each dataset — minimum, Q₁, median, Q₃, maximum — and compare one average with one measure of spread.");
    const form = e("div", "gl-form");
    const cvBox = e("div", "gl-canvas");
    const canvas = document.createElement("canvas");
    cvBox.appendChild(canvas);
    const facts = e("div", "gl-facts");
    const msg = e("div", "gl-msg");

    const NAMES = ["min", "Q₁", "median", "Q₃", "max"];
    const aF = A.map((v, i) => field(NAMES[i], String(v), null, upd));
    const bF = B.map((v, i) => field(NAMES[i], String(v), null, upd));
    function group(title, items) {
      const g = e("div", "gl-form-group");
      g.appendChild(e("div", "gl-form-title", title));
      const row = e("div", "gl-form-row");
      items.forEach((i) => row.appendChild(i.el));
      g.appendChild(row);
      return g;
    }
    form.appendChild(group("Class A", aF));
    form.appendChild(group("Class B", bF));

    const fA = factHtml("Class A");
    const fB = factHtml("Class B");
    const fSay = factHtml("The comparison that earns the marks");
    [fA, fB, fSay].forEach((f) => facts.appendChild(f));

    panel.appendChild(prompt); panel.appendChild(form); panel.appendChild(cvBox);
    panel.appendChild(facts); panel.appendChild(msg);
    host.appendChild(panel);

    const read = (fs) => fs.map((f) => (isFinite(f.get()) ? f.get() : 0));

    const sketch = new Sketch(canvas, {
      ratio: 0.5, minH: 190, maxH: 260,
      render(c, W, H, P) {
        const a = read(aF), b = read(bF);
        const all = a.concat(b);
        const lo = Math.min.apply(null, all), hi = Math.max.apply(null, all);
        const pad = Math.max(2, (hi - lo) * 0.1);
        const m = chart(W, H, { xmin: Math.floor((lo - pad) / 10) * 10, xmax: Math.ceil((hi + pad) / 10) * 10,
          ymin: 0, ymax: 2, stepx: 10, stepy: 1, padL: 62, xlab: "score" });
        // axis only along the bottom
        c.save();
        c.strokeStyle = P.grid; c.lineWidth = 1;
        for (let x = m.o.xmin; x <= m.o.xmax + 1e-9; x += 10) {
          c.beginPath(); c.moveTo(m.X(x), m.Y(0)); c.lineTo(m.X(x), m.Y(2)); c.stroke();
        }
        c.strokeStyle = P.axis; c.lineWidth = 1.5;
        c.beginPath(); c.moveTo(m.X(m.o.xmin), m.Y(0)); c.lineTo(m.X(m.o.xmax), m.Y(0)); c.stroke();
        c.fillStyle = P.text; c.font = "10px Inter, system-ui, sans-serif";
        c.textAlign = "center"; c.textBaseline = "top";
        for (let x = m.o.xmin; x <= m.o.xmax + 1e-9; x += 10) c.fillText(String(x), m.X(x), m.Y(0) + 5);
        c.restore();
        [[a, 1.45, P.c1, "A"], [b, 0.75, P.c2, "B"]].forEach(([d, y, colr, nm]) => {
          const h = 0.22;
          const yc = m.Y(y), yt = m.Y(y + h), yb = m.Y(y - h);
          strokePath(c, [[m.X(d[0]), yt], [m.X(d[0]), yb]], colr, 2);       // min whisker cap
          strokePath(c, [[m.X(d[4]), yt], [m.X(d[4]), yb]], colr, 2);       // max whisker cap
          strokePath(c, [[m.X(d[0]), yc], [m.X(d[1]), yc]], colr, 1.6);
          strokePath(c, [[m.X(d[3]), yc], [m.X(d[4]), yc]], colr, 1.6);
          c.save();
          c.fillStyle = P.soft; c.fillRect(m.X(d[1]), yt, m.X(d[3]) - m.X(d[1]), yb - yt);
          c.strokeStyle = colr; c.lineWidth = 2; c.strokeRect(m.X(d[1]), yt, m.X(d[3]) - m.X(d[1]), yb - yt);
          c.restore();
          strokePath(c, [[m.X(d[2]), yt], [m.X(d[2]), yb]], colr, 2.6);
          tagOn(c, P, nm, m.X(m.o.xmin) - 20, yc, colr, "center", 13);
        });
      },
    });

    function upd() {
      sketch.draw();
      const a = read(aF), b = read(bF);
      const iqrA = a[3] - a[1], iqrB = b[3] - b[1];
      fA.setValue("median " + fmt(a[2], 2) + " · IQR " + fmt(a[3], 2) + " − " + fmt(a[1], 2) + " = <b>" + fmt(iqrA, 2)
        + "</b> · range " + fmt(a[4] - a[0], 2));
      fB.setValue("median " + fmt(b[2], 2) + " · IQR " + fmt(b[3], 2) + " − " + fmt(b[1], 2) + " = <b>" + fmt(iqrB, 2)
        + "</b> · range " + fmt(b[4] - b[0], 2));
      const higher = a[2] === b[2] ? null : a[2] > b[2] ? "A" : "B";
      const tighter = iqrA === iqrB ? null : iqrA < iqrB ? "A" : "B";
      fSay.setValue(
        (higher ? "Class " + higher + " has the higher median (" + fmt(Math.max(a[2], b[2]), 2) + " against "
          + fmt(Math.min(a[2], b[2]), 2) + "), so Class " + higher + " scored better on average. "
          : "The two medians are equal, so on average the two classes scored the same. ")
        + (tighter ? "Class " + tighter + " has the smaller interquartile range (" + fmt(Math.min(iqrA, iqrB), 2)
          + " against " + fmt(Math.max(iqrA, iqrB), 2) + "), so its scores are more consistent."
          : "The interquartile ranges are equal, so the two are equally consistent."));
      msg.className = "gl-msg good";
      msg.textContent = "One average AND one measure of spread, each said in context — that is the full-mark answer. Quoting only the medians throws away half the marks.";
    }
    upd();
  };

  /* ---------- Venn diagram drawing, shared by the set labs ---------- */

  // two circles side by side inside the canvas
  function twoSet(W, H) {
    // the frame must fit the canvas: it is 4.2r wide and 3r tall
    const r = Math.min((W - 10) / 4.2, (H - 10) / 3);
    const cy = H / 2;
    return { r, cy, ax: W / 2 - r * 0.62, bx: W / 2 + r * 0.62,
             box: [W / 2 - r * 2.1, cy - r * 1.5, r * 4.2, r * 3] };
  }
  function frameE(c, P, b, label) {
    c.save();
    c.strokeStyle = P.axis; c.lineWidth = 1.4;
    (c.roundRect ? c.roundRect(b[0], b[1], b[2], b[3], 8) : c.rect(b[0], b[1], b[2], b[3]));
    c.stroke();
    c.restore();
    tag(c, label || "ℰ", b[0] + 14, b[1] + 13, P.text, "center", 12);
  }
  function circle(c, x, y, r, colr, w) {
    c.save();
    c.strokeStyle = colr; c.lineWidth = w || 2;
    c.beginPath(); c.arc(x, y, r, 0, 7); c.stroke();
    c.restore();
  }
  // shade a region described by a predicate over (inA, inB[, inC])
  function shadeRegion(c, P, box, test, colr) {
    c.save();
    c.beginPath();
    (c.roundRect ? c.roundRect(box[0], box[1], box[2], box[3], 8) : c.rect(box[0], box[1], box[2], box[3]));
    c.clip();
    c.fillStyle = colr;
    const step = 3;
    for (let x = box[0]; x < box[0] + box[2]; x += step) {
      for (let y = box[1]; y < box[1] + box[3]; y += step) {
        if (test(x + step / 2, y + step / 2)) c.fillRect(x, y, step, step);
      }
    }
    c.restore();
  }
  const inCircle = (x, y, cx, cy, r) => (x - cx) ** 2 + (y - cy) ** 2 <= r * r;

  const setTxt = (arr) => (arr.length ? "{" + arr.join(", ") + "}" : "∅");
  function parseSet(s) {
    return [...new Set(String(s).split(/[,\s]+/).map((t) => t.trim()).filter(Boolean))];
  }
  const sortSet = (a) => a.slice().sort((p, q) => {
    const np = parseFloat(p), nq = parseFloat(q);
    return isFinite(np) && isFinite(nq) ? np - nq : String(p).localeCompare(String(q));
  });

  /* 54 · Set notation — build any region and see it shaded */
  build.setlab = function (host) {
    const OPS = [
      { key: "AuB", label: "A ∪ B", test: (a, b) => a || b, words: "in A or B or both" },
      { key: "AnB", label: "A ∩ B", test: (a, b) => a && b, words: "in both A and B" },
      { key: "Ac", label: "A′", test: (a) => !a, words: "everything not in A" },
      { key: "AuBc", label: "(A ∪ B)′", test: (a, b) => !(a || b), words: "outside both circles" },
      { key: "AcnB", label: "A′ ∩ B", test: (a, b) => !a && b, words: "in B but not in A" },
      { key: "AnBc", label: "A ∩ B′", test: (a, b) => a && !b, words: "in A but not in B" },
      { key: "AcuBc", label: "A′ ∪ B′", test: (a, b) => !a || !b, words: "everything except the overlap" },
    ];
    let op = OPS[0];

    const panel = e("div", "gl-panel");
    const form = e("div", "gl-form");
    const chips = chipRow(OPS.map((o) => ({ label: o.label, o })), (it) => { op = it.o; upd(); }, 0);
    const cvBox = e("div", "gl-canvas");
    const canvas = document.createElement("canvas");
    cvBox.appendChild(canvas);
    const facts = e("div", "gl-facts");
    const msg = e("div", "gl-msg");

    const uF = field("ℰ", "1,2,3,4,5,6,7,8,9,10,11,12", "wide", upd);
    uF.input.style.width = "260px";
    const aF = field("A", "3,6,9,12", "wide", upd);
    aF.input.style.width = "150px";
    const bF = field("B", "2,4,6,8,10,12", "wide", upd);
    bF.input.style.width = "150px";
    const g = e("div", "gl-form-group");
    g.appendChild(e("div", "gl-form-title", "The universal set and the two sets"));
    const row = e("div", "gl-form-row");
    [uF, aF, bF].forEach((f) => row.appendChild(f.el));
    g.appendChild(row); form.appendChild(g);

    const fRegion = factHtml("The region you picked");
    const fCount = factHtml("How many");
    const fCheck = factHtml("Counting formula");
    [fRegion, fCount, fCheck].forEach((f) => facts.appendChild(f));

    panel.appendChild(form); panel.appendChild(chips.el); panel.appendChild(cvBox);
    panel.appendChild(facts); panel.appendChild(msg);
    host.appendChild(panel);

    const sets = () => {
      const U = parseSet(uF.input.value), A = parseSet(aF.input.value).filter((x) => U.includes(x));
      const B = parseSet(bF.input.value).filter((x) => U.includes(x));
      return { U, A, B };
    };

    const sketch = new Sketch(canvas, {
      ratio: 0.62, minH: 220, maxH: 300,
      render(c, W, H, P) {
        const { U, A, B } = sets();
        const g2 = twoSet(W, H);
        const inA = (x, y) => inCircle(x, y, g2.ax, g2.cy, g2.r);
        const inB = (x, y) => inCircle(x, y, g2.bx, g2.cy, g2.r);
        shadeRegion(c, P, g2.box, (x, y) => op.test(inA(x, y), inB(x, y)), P.soft3);
        frameE(c, P, g2.box);
        circle(c, g2.ax, g2.cy, g2.r, P.c1, 2.2);
        circle(c, g2.bx, g2.cy, g2.r, P.c3, 2.2);
        tag(c, "A", g2.ax - g2.r * 0.75, g2.cy - g2.r * 0.85, P.c1, "center", 13);
        tag(c, "B", g2.bx + g2.r * 0.75, g2.cy - g2.r * 0.85, P.c3, "center", 13);
        // place the elements in their regions
        const put = (list, cx, cy, wide) => {
          const per = Math.max(1, Math.ceil(Math.sqrt(list.length)));
          list.forEach((v, i) => {
            const col = i % per, rw = Math.floor(i / per);
            tag(c, String(v), cx + (col - (per - 1) / 2) * (wide || 17), cy + (rw - (Math.ceil(list.length / per) - 1) / 2) * 15,
              P.strong, "center", 11.5);
          });
        };
        const onlyA = sortSet(A.filter((x) => !B.includes(x)));
        const both = sortSet(A.filter((x) => B.includes(x)));
        const onlyB = sortSet(B.filter((x) => !A.includes(x)));
        const none = sortSet(U.filter((x) => !A.includes(x) && !B.includes(x)));
        put(onlyA, g2.ax - g2.r * 0.45, g2.cy);
        put(both, (g2.ax + g2.bx) / 2, g2.cy);
        put(onlyB, g2.bx + g2.r * 0.45, g2.cy);
        put(none, g2.box[0] + g2.box[2] - 34, g2.box[1] + 22);
      },
    });

    function upd() {
      sketch.draw();
      const { U, A, B } = sets();
      const inA = (x) => A.includes(x), inB = (x) => B.includes(x);
      const result = sortSet(U.filter((x) => op.test(inA(x), inB(x))));
      fRegion.setValue("<b>" + op.label + "</b> = " + setTxt(result) + " &nbsp;— " + op.words);
      fCount.setValue("n(" + op.label + ") = <b>" + result.length + "</b> &nbsp;·&nbsp; n(ℰ) = " + U.length
        + ", n(A) = " + A.length + ", n(B) = " + B.length);
      const bothN = A.filter((x) => B.includes(x)).length;
      fCheck.setValue("n(A ∪ B) = n(A) + n(B) − n(A ∩ B) = " + A.length + " + " + B.length + " − " + bothN
        + " = <b>" + (A.length + B.length - bothN) + "</b>");
      msg.className = "gl-msg good";
      msg.textContent = "Read the notation from the inside out, and leave the dash until last: (A ∪ B)′ means \"find A ∪ B, then take everything else\". Compare it with A′ ∪ B′ on the chips above — they are not the same region.";
    }
    upd();
  };

  /* 55 · Two-set counting problems, including the unknown-x kind */
  build.vennlab = function (host) {
    const KNOWN = [
      { value: "both", label: "I know how many are in both" },
      { value: "neither", label: "I know how many are in neither" },
    ];
    const panel = e("div", "gl-panel");
    const prompt = html("div", "gl-prompt",
      "The classic question: totals for each set, and one more fact. Everything else follows from n(A ∪ B) = n(A) + n(B) − n(A ∩ B).");
    const form = e("div", "gl-form");
    const cvBox = e("div", "gl-canvas");
    const canvas = document.createElement("canvas");
    cvBox.appendChild(canvas);
    const steps = e("div", "gl-steps");
    const msg = e("div", "gl-msg");

    const eF = field("n(ℰ)", "30", null, upd);
    const aF = field("n(A)", "18", null, upd);
    const bF = field("n(B)", "15", null, upd);
    const which = picker("The extra fact", KNOWN, upd);
    const kF = field("its value", "7", null, upd);
    const g = e("div", "gl-form-group");
    g.appendChild(e("div", "gl-form-title", "What the question tells you"));
    const row = e("div", "gl-form-row");
    [eF, aF, bF, which, kF].forEach((f) => row.appendChild(f.el));
    g.appendChild(row); form.appendChild(g);

    panel.appendChild(prompt); panel.appendChild(form); panel.appendChild(cvBox);
    panel.appendChild(steps); panel.appendChild(msg);
    host.appendChild(panel);

    let regions = { onlyA: 11, both: 7, onlyB: 8, none: 4 };

    const sketch = new Sketch(canvas, {
      ratio: 0.6, minH: 210, maxH: 290,
      render(c, W, H, P) {
        const g2 = twoSet(W, H);
        frameE(c, P, g2.box);
        circle(c, g2.ax, g2.cy, g2.r, P.c1, 2.2);
        circle(c, g2.bx, g2.cy, g2.r, P.c3, 2.2);
        tag(c, "A", g2.ax - g2.r * 0.75, g2.cy - g2.r * 0.85, P.c1, "center", 13);
        tag(c, "B", g2.bx + g2.r * 0.75, g2.cy - g2.r * 0.85, P.c3, "center", 13);
        const put = (v, x, y, colr) => tagOn(c, P, fmt(v, 2), x, y, colr || P.strong, "center", 15);
        put(regions.onlyA, g2.ax - g2.r * 0.45, g2.cy, P.c1);
        put(regions.both, (g2.ax + g2.bx) / 2, g2.cy, P.c4);
        put(regions.onlyB, g2.bx + g2.r * 0.45, g2.cy, P.c3);
        put(regions.none, g2.box[0] + g2.box[2] - 28, g2.box[1] + 20, P.text);
      },
    });

    function step(k, title, body) {
      const d = e("div", "gl-step");
      d.appendChild(e("span", "gl-step-n", k));
      d.appendChild(html("div", "gl-step-b", "<b>" + title + "</b><br>" + body));
      return d;
    }
    function upd() {
      const nE = eF.get(), nA = aF.get(), nB = bF.get(), k = kF.get();
      steps.replaceChildren();
      if (![nE, nA, nB, k].every(isFinite)) {
        msg.className = "gl-msg warn"; msg.textContent = "Fill in all four numbers."; return;
      }
      let both, none;
      if (which.get() === "both") {
        both = k;
        const union = nA + nB - both;
        none = nE - union;
        steps.appendChild(step("1", "Start in the middle", "n(A ∩ B) = <b>" + fmt(both, 2) + "</b> goes in the overlap."));
        steps.appendChild(step("2", "Subtract to get the \"only\" regions",
          "A only = " + fmt(nA, 2) + " − " + fmt(both, 2) + " = <b>" + fmt(nA - both, 2) + "</b><br>"
          + "B only = " + fmt(nB, 2) + " − " + fmt(both, 2) + " = <b>" + fmt(nB - both, 2) + "</b>"));
        steps.appendChild(step("3", "At least one",
          "n(A ∪ B) = " + fmt(nA, 2) + " + " + fmt(nB, 2) + " − " + fmt(both, 2) + " = <b>" + fmt(union, 2) + "</b>"));
        steps.appendChild(step("4", "Neither",
          "n((A ∪ B)′) = n(ℰ) − n(A ∪ B) = " + fmt(nE, 2) + " − " + fmt(union, 2) + " = <b>" + fmt(none, 2) + "</b>"));
      } else {
        none = k;
        const union = nE - none;
        both = nA + nB - union;
        steps.appendChild(step("1", "Call the overlap x",
          "Every region in terms of x: A only = " + fmt(nA, 2) + " − x, both = x, B only = " + fmt(nB, 2) + " − x, neither = " + fmt(none, 2)));
        steps.appendChild(step("2", "Add all four regions and set the total to n(ℰ)",
          "(" + fmt(nA, 2) + " − x) + x + (" + fmt(nB, 2) + " − x) + " + fmt(none, 2) + " = " + fmt(nE, 2)));
        steps.appendChild(step("3", "Solve",
          fmt(nA + nB + none, 2) + " − x = " + fmt(nE, 2) + " &nbsp;⟹&nbsp; x = <b>" + fmt(both, 2) + "</b>"));
        steps.appendChild(step("4", "Fill the diagram in",
          "A only = <b>" + fmt(nA - both, 2) + "</b> · both = <b>" + fmt(both, 2) + "</b> · B only = <b>"
          + fmt(nB - both, 2) + "</b> · neither = <b>" + fmt(none, 2) + "</b>"));
      }
      regions = { onlyA: nA - both, both, onlyB: nB - both, none };
      sketch.draw();
      const total = regions.onlyA + regions.both + regions.onlyB + regions.none;
      const bad = [regions.onlyA, regions.both, regions.onlyB, regions.none].some((v) => v < 0);
      msg.className = "gl-msg " + (bad ? "bad" : "good");
      msg.textContent = bad
        ? "One region has come out negative, so these numbers cannot all be true together — check the values in the question."
        : "Check: " + fmt(regions.onlyA, 2) + " + " + fmt(regions.both, 2) + " + " + fmt(regions.onlyB, 2)
          + " + " + fmt(regions.none, 2) + " = " + fmt(total, 2) + " = n(ℰ) ✓. Always finish by adding every region — if it misses, the overlap has been counted twice.";
    }
    upd();
  };

  /* 56 · Three sets — and why n(A ∩ B) is not the region between A and B */
  build.venn3lab = function (host) {
    const R = { a: 8, b: 7, c: 2, ab: 6, ac: 5, bc: 3, abc: 4, out: 5 };
    const QUERIES = [
      { key: "A", label: "n(A)", parts: ["a", "ab", "ac", "abc"], words: "everything inside circle A" },
      { key: "AnB", label: "n(A ∩ B)", parts: ["ab", "abc"], words: "in A and B — the pair region AND the centre" },
      { key: "AnBnCc", label: "n(A ∩ B ∩ C′)", parts: ["ab"], words: "in A and B but NOT in C — the pair region alone" },
      { key: "AnBnC", label: "n(A ∩ B ∩ C)", parts: ["abc"], words: "in all three — the centre" },
      { key: "union", label: "n(A ∪ B ∪ C)", parts: ["a", "b", "c", "ab", "ac", "bc", "abc"], words: "in at least one set" },
      { key: "Cc", label: "n(C′)", parts: ["a", "b", "ab", "out"], words: "everything outside circle C" },
    ];
    let q = QUERIES[0];

    const panel = e("div", "gl-panel");
    const prompt = html("div", "gl-prompt",
      "Fill the eight regions from the centre outwards, then pick a query — the regions it uses light up.");
    const inputs = e("div", "gl-inputs");
    const chips = chipRow(QUERIES.map((x) => ({ label: x.label, q: x })), (it) => { q = it.q; upd(); }, 0);
    const cvBox = e("div", "gl-canvas");
    const canvas = document.createElement("canvas");
    cvBox.appendChild(canvas);
    const facts = e("div", "gl-facts");
    const msg = e("div", "gl-msg");

    const LABS = { abc: "all three", ab: "A,B only", ac: "A,C only", bc: "B,C only",
                   a: "A only", b: "B only", c: "C only", out: "none" };
    const fields = {};
    ["abc", "ab", "ac", "bc", "a", "b", "c", "out"].forEach((k) => {
      fields[k] = field(LABS[k], String(R[k]), null, upd);
      inputs.appendChild(fields[k].el);
    });

    const fTotal = factHtml("n(ℰ)");
    const fAns = factHtml("Your query");
    [fTotal, fAns].forEach((f) => facts.appendChild(f));

    panel.appendChild(prompt); panel.appendChild(inputs); panel.appendChild(chips.el);
    panel.appendChild(cvBox); panel.appendChild(facts); panel.appendChild(msg);
    host.appendChild(panel);

    const val = (k) => (isFinite(fields[k].get()) ? fields[k].get() : 0);

    const sketch = new Sketch(canvas, {
      ratio: 0.82, minH: 260, maxH: 360,
      render(c, W, H, P) {
        const r = Math.min((W - 10) / 4.8, (H - 10) / 4.0);   // the frame is 4.8r by 4.0r
        const cx = W / 2, cy = H / 2 + r * 0.18;
        const d = r * 0.62;
        const A = [cx - d, cy - d * 0.55], B = [cx + d, cy - d * 0.55], C = [cx, cy + d];
        const box = [cx - r * 2.4, cy - r * 2.1, r * 4.8, r * 4.0];
        const inA = (x, y) => inCircle(x, y, A[0], A[1], r);
        const inB = (x, y) => inCircle(x, y, B[0], B[1], r);
        const inC = (x, y) => inCircle(x, y, C[0], C[1], r);
        const member = { a: (x, y) => inA(x, y) && !inB(x, y) && !inC(x, y),
                         b: (x, y) => !inA(x, y) && inB(x, y) && !inC(x, y),
                         c: (x, y) => !inA(x, y) && !inB(x, y) && inC(x, y),
                         ab: (x, y) => inA(x, y) && inB(x, y) && !inC(x, y),
                         ac: (x, y) => inA(x, y) && !inB(x, y) && inC(x, y),
                         bc: (x, y) => !inA(x, y) && inB(x, y) && inC(x, y),
                         abc: (x, y) => inA(x, y) && inB(x, y) && inC(x, y),
                         out: (x, y) => !inA(x, y) && !inB(x, y) && !inC(x, y) };
        shadeRegion(c, P, box, (x, y) => q.parts.some((k) => member[k](x, y)), P.soft3);
        frameE(c, P, box);
        circle(c, A[0], A[1], r, P.c1, 2.2);
        circle(c, B[0], B[1], r, P.c3, 2.2);
        circle(c, C[0], C[1], r, P.c5, 2.2);
        tag(c, "A", A[0] - r * 0.85, A[1] - r * 0.8, P.c1, "center", 13);
        tag(c, "B", B[0] + r * 0.85, B[1] - r * 0.8, P.c3, "center", 13);
        tag(c, "C", C[0] - r * 0.9, C[1] + r * 0.85, P.c5, "center", 13);
        const at = {
          abc: [cx, cy - d * 0.02],
          ab: [cx, A[1] - r * 0.42],
          ac: [cx - d * 0.95, cy + d * 0.34],
          bc: [cx + d * 0.95, cy + d * 0.34],
          a: [A[0] - r * 0.5, A[1] - r * 0.22],
          b: [B[0] + r * 0.5, B[1] - r * 0.22],
          c: [C[0], C[1] + r * 0.55],
          out: [box[0] + box[2] - 26, box[1] + 20],
        };
        Object.keys(at).forEach((k) => {
          const on = q.parts.includes(k);
          tagOn(c, P, fmt(val(k), 2), at[k][0], at[k][1], on ? P.c2 : P.strong, "center", on ? 15 : 13);
        });
      },
    });

    function upd() {
      sketch.draw();
      const all = ["a", "b", "c", "ab", "ac", "bc", "abc", "out"];
      const total = all.reduce((s, k) => s + val(k), 0);
      fTotal.setValue(all.map((k) => fmt(val(k), 2)).join(" + ") + " = <b>" + fmt(total, 2) + "</b>");
      const sum = q.parts.reduce((s, k) => s + val(k), 0);
      fAns.setValue("<b>" + q.label + "</b> = " + q.parts.map((k) => fmt(val(k), 2)).join(" + ")
        + " = <b>" + fmt(sum, 2) + "</b> &nbsp;— " + q.words);
      msg.className = "gl-msg " + (q.key === "AnB" ? "warn" : "good");
      msg.textContent = q.key === "AnB"
        ? "This is the single biggest trap: n(A ∩ B) INCLUDES the centre. The region drawn between A and B on its own is n(A ∩ B ∩ C′) — compare the next chip."
        : "Fill a three-set diagram from the centre outwards: the centre first, then each pair region as \"pair total minus centre\", then each single region as \"set total minus everything already placed\".";
    }
    upd();
  };

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
  font-family:ui-monospace,Menlo,Consolas,monospace;min-width:44px;white-space:nowrap}
.gl-table .gl-td-x{background:var(--chip-bg);font-weight:800}
.gl-table .gl-td-undef{color:var(--bad,#dc2626);font-weight:700;font-size:.78rem}
.gl-table .gl-td-blank{background:transparent;border:none}
.gl-table .gl-td-ok{background:var(--good-soft,#f0fdf4);color:var(--good-deep,#15803d);font-weight:800}
.gl-cell{width:52px;padding:.25rem;border:1.5px solid var(--line);border-radius:6px;text-align:center;
  font-family:ui-monospace,Menlo,Consolas,monospace;font-size:.86rem;background:var(--card);color:var(--ink)}
.gl-cell.wide{width:62px}
.gl-cell.ans{width:auto;flex:1 1 140px;min-width:120px;max-width:260px;text-align:left;padding:.42rem .7rem;font-size:.92rem}
.gl-cell:disabled{opacity:.7;cursor:default}
.gl-answer-row{display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin:10px 0 0}
.gl-answer-row .gl-btn{flex:none;padding:.42rem .85rem}
.gl-q{margin:0 0 20px;padding:0 0 4px;border-bottom:1px dashed var(--line)}
.gl-q:last-of-type{border-bottom:none}
.gl-msg.empty{display:none}
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
.gl-cv{display:inline-grid;grid-auto-rows:1.05em;place-items:center;vertical-align:middle;
  border-left:2px solid currentColor;border-right:2px solid currentColor;border-radius:5px;
  padding:3px 7px;margin:0 3px;font-family:ui-monospace,Menlo,Consolas,monospace;font-size:.82em;line-height:1.05}
.gl-cv i{font-style:normal}
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
