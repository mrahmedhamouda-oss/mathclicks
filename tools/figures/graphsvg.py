"""Emit cartesian-graph SVG that matches the lesson-embed.css design system.

The lesson figures use CSS classes (g-axis, g-line, g-dash, g-pt, ...) rather than
hard-coded colours so every drawing follows the reader's light/dark theme. This
helper does the coordinate arithmetic; the caller supplies the mathematics.
"""


class Graph:
    def __init__(self, xmin, xmax, ymin, ymax, unit=24, pad_l=30, pad_r=30,
                 pad_t=24, pad_b=30, grid_step=2):
        self.xmin, self.xmax, self.ymin, self.ymax = xmin, xmax, ymin, ymax
        self.u = unit
        self.grid_step = grid_step
        self.ox = pad_l - xmin * unit
        self.oy = pad_t + ymax * unit
        self.w = pad_l + (xmax - xmin) * unit + pad_r
        self.h = pad_t + (ymax - ymin) * unit + pad_b
        self.parts = []

    # --- coordinate helpers ------------------------------------------------
    def px(self, x):
        return round(self.ox + x * self.u, 2)

    def py(self, y):
        return round(self.oy - y * self.u, 2)

    def inside(self, x, y, eps=1e-9):
        return (self.xmin - eps <= x <= self.xmax + eps
                and self.ymin - eps <= y <= self.ymax + eps)

    # --- primitives --------------------------------------------------------
    def raw(self, markup):
        self.parts.append(markup)

    def axes(self, xlabels=(), ylabels=(), xlabel_dy=18, ylabel_dx=-8):
        g = []
        if self.grid_step:
            s = self.grid_step
            x = self.xmin - (self.xmin % s)
            while x <= self.xmax:
                if x != 0:
                    g.append(f'<line class="g-grid" x1="{self.px(x)}" y1="{self.py(self.ymin)}" '
                             f'x2="{self.px(x)}" y2="{self.py(self.ymax)}"/>')
                x += s
            y = self.ymin - (self.ymin % s)
            while y <= self.ymax:
                if y != 0:
                    g.append(f'<line class="g-grid" x1="{self.px(self.xmin)}" y1="{self.py(y)}" '
                             f'x2="{self.px(self.xmax)}" y2="{self.py(y)}"/>')
                y += s
        g.append(f'<line class="g-axis" x1="{self.px(self.xmin) - 6}" y1="{self.py(0)}" '
                 f'x2="{self.px(self.xmax) + 6}" y2="{self.py(0)}"/>')
        g.append(f'<line class="g-axis" x1="{self.px(0)}" y1="{self.py(self.ymin) + 6}" '
                 f'x2="{self.px(0)}" y2="{self.py(self.ymax) - 6}"/>')
        for v in xlabels:
            g.append(f'<text class="g-lbl-sm" x="{self.px(v)}" y="{self.py(0) + xlabel_dy}" '
                     f'text-anchor="middle">{fmt(v)}</text>')
        # A positive ylabel_dx puts the numbers to the right of the axis, which is
        # what you want when the interesting part of the curve sits on the left.
        yanchor = "start" if ylabel_dx > 0 else "end"
        for v in ylabels:
            g.append(f'<text class="g-lbl-sm" x="{self.px(0) + ylabel_dx}" y="{self.py(v) + 4}" '
                     f'text-anchor="{yanchor}">{fmt(v)}</text>')
        self.parts.extend(g)

    def polyline(self, pts, cls="g-line", extra=""):
        s = " ".join(f"{self.px(x)},{self.py(y)}" for x, y in pts)
        self.parts.append(f'<polyline class="{cls}" points="{s}"{extra}/>')

    def line_seg(self, p, q, cls="g-line", extra=""):
        self.parts.append(f'<line class="{cls}" x1="{self.px(p[0])}" y1="{self.py(p[1])}" '
                          f'x2="{self.px(q[0])}" y2="{self.py(q[1])}"{extra}/>')

    def abline(self, m, b, cls="g-line", extra=""):
        """Draw y = mx + b as a single segment clipped exactly to the window."""
        lo, hi = self.xmin, self.xmax
        if m != 0:
            xs = sorted(((self.ymin - b) / m, (self.ymax - b) / m))
            lo, hi = max(lo, xs[0]), min(hi, xs[1])
        elif not (self.ymin <= b <= self.ymax):
            return
        if hi <= lo:
            return
        self.line_seg((lo, m * lo + b), (hi, m * hi + b), cls, extra)

    def func(self, f, cls="g-line", samples=90, extra="", x0=None, x1=None):
        """Plot y=f(x), broken into runs that stay inside the window.

        x0/x1 restrict the plot to part of the domain -- useful for highlighting
        the stretch of a curve that lies above or below the axis.
        """
        lo = self.xmin if x0 is None else max(self.xmin, x0)
        hi = self.xmax if x1 is None else min(self.xmax, x1)
        runs, cur = [], []
        for i in range(samples + 1):
            x = lo + (hi - lo) * i / samples
            try:
                y = f(x)
            except (ValueError, ZeroDivisionError):
                y = None
            if y is None or not (self.ymin <= y <= self.ymax):
                if len(cur) > 1:
                    runs.append(cur)
                cur = []
            else:
                cur.append((x, y))
        if len(cur) > 1:
            runs.append(cur)
        for r in runs:
            self.polyline(r, cls, extra)
        return len(runs)

    def point(self, x, y, cls="g-pt", r=4.6, extra=""):
        self.parts.append(f'<circle class="{cls}" cx="{self.px(x)}" cy="{self.py(y)}" r="{r}"{extra}/>')

    def label(self, x, y, text, cls="g-lbl", anchor="start", dx=0, dy=0, halo=True, extra=""):
        c = cls + (" g-halo" if halo else "")
        self.parts.append(f'<text class="{c}" x="{self.px(x) + dx}" y="{self.py(y) + dy}" '
                          f'text-anchor="{anchor}"{extra}>{text}</text>')

    def text_at(self, xpx, ypx, text, cls="g-lbl-sm", anchor="middle", halo=True, extra=""):
        c = cls + (" g-halo" if halo else "")
        self.parts.append(f'<text class="{c}" x="{xpx}" y="{ypx}" text-anchor="{anchor}"{extra}>{text}</text>')

    def svg(self, aria, svg_id=None, width=None):
        idattr = f' id="{svg_id}"' if svg_id else ""
        w = width or min(self.w, 340)
        return (f'<svg{idattr} viewBox="0 0 {round(self.w,2)} {round(self.h,2)}" width="{w}" '
                f'role="img" aria-label="{aria}">\n  '
                + "\n  ".join(self.parts) + "\n</svg>")


def fmt(v):
    """Format a tick value with the site's minus glyph."""
    if abs(v - round(v)) < 1e-9:
        v = int(round(v))
    s = str(v)
    return s.replace("-", "&minus;")
