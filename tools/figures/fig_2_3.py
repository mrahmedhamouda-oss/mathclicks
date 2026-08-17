"""Figures for lesson 2-3, Equations of Linear Functions."""
import sys
sys.path.insert(0, __file__.rsplit('/', 1)[0])
from graphsvg import Graph

figs = {}

# ---- Figure 1: slope is rise over run --------------------------------------
g = Graph(-2, 8, -2, 6, unit=26, pad_l=34, pad_r=40, pad_t=26, pad_b=32)
g.axes(xlabels=[-2, 2, 4, 6, 8], ylabels=[-2, 2, 4, 6])
g.abline(0.75, 0.25)
g.line_seg((1, 1), (5, 1), cls="g-aux")
g.line_seg((5, 1), (5, 4), cls="g-aux")
g.point(1, 1)
g.point(5, 4)
g.label(3, 1, "run = 4", cls="g-meas-b", anchor="middle", dy=19)
g.label(5, 2.5, "rise = 3", cls="g-meas", anchor="start", dx=8)
g.label(1, 1, "(1, 1)", cls="g-lbl-sm", anchor="end", dx=-8, dy=-10)
g.label(5, 4, "(5, 4)", cls="g-lbl-sm", anchor="start", dx=8, dy=-8)
g.label(0.4, 5.2, "y = &frac34;x + &frac14;", cls="g-lbl", anchor="start")
figs['f1'] = g.svg("a line through 1 comma 1 and 5 comma 4 with a slope triangle "
                   "showing a rise of 3 over a run of 4")

# ---- Figure 2: one line wearing three different forms ----------------------
g = Graph(-2, 6, -6, 4, unit=25, pad_l=40, pad_r=54, pad_t=26, pad_b=32)
g.axes(xlabels=[-2, 4, 6], ylabels=[-4, -2, 2, 4])
g.abline(2, -4)
g.point(0, -4, extra=' data-part="si"')
g.label(0, -4, "b = &minus;4", cls="g-meas-b", anchor="end", dx=-9, dy=5, extra=' data-part="si"')
g.point(3, 2, extra=' data-part="ps"')
g.label(3, 2, "(3, 2)", cls="g-grn", anchor="end", dx=-9, dy=-3, extra=' data-part="ps"')
g.line_seg((3, 2), (4, 2), cls="g-aux", extra=' data-part="ps"')
g.line_seg((4, 2), (4, 4), cls="g-aux", extra=' data-part="ps"')
g.label(4, 3, "m = 2", cls="g-grn", anchor="start", dx=7, extra=' data-part="ps"')
g.point(2, 0, extra=' data-part="st"')
g.label(2, 0, "(2, 0)", cls="g-meas", anchor="start", dx=13, dy=-7, extra=' data-part="st"')
g.label(0, -4, "(0, &minus;4)", cls="g-meas", anchor="start", dx=10, dy=18, extra=' data-part="st"')
figs['f2'] = g.svg("the line y equals 2x minus 4, with its y-intercept, the point 3 comma 2 "
                   "and both axis intercepts marked", svg_id="l23fig2")

# ---- Figure 3: what the sign of the slope does -----------------------------
panels = [
    (2, -1, "m &gt; 0", "uphill", "g-line"),
    (-1.5, 2, "m &lt; 0", "downhill", "g-line"),
    (0, 1.5, "m = 0", "flat: y = 1.5", "g-line"),
]
parts = []
for i, (m, b, tag, note, cls) in enumerate(panels):
    gg = Graph(-3, 3, -3, 3, unit=13, pad_l=12, pad_r=12, pad_t=30, pad_b=26, grid_step=0)
    gg.axes()
    gg.abline(m, b, cls=cls)
    gg.text_at(gg.w / 2, 16, tag, cls="g-meas-b")
    gg.text_at(gg.w / 2, gg.h - 8, note, cls="g-lbl-sm")
    dx = i * (gg.w + 8)
    parts.append((dx, gg))
# fourth panel: vertical line, drawn by hand because it is not a function
gg = Graph(-3, 3, -3, 3, unit=13, pad_l=12, pad_r=12, pad_t=30, pad_b=26, grid_step=0)
gg.axes()
gg.line_seg((1.5, -3), (1.5, 3))
gg.text_at(gg.w / 2, 16, "undefined", cls="g-meas")
gg.text_at(gg.w / 2, gg.h - 8, "vertical: x = 1.5", cls="g-lbl-sm")
parts.append((3 * (gg.w + 8), gg))

total_w = parts[-1][0] + parts[-1][1].w
inner = "\n  ".join(
    f'<g transform="translate({dx},0)">' + "".join(gg.parts) + "</g>" for dx, gg in parts)
figs['f3'] = (f'<svg viewBox="0 0 {total_w} {parts[0][1].h}" width="{min(total_w,340)}" role="img" '
              f'aria-label="four small graphs comparing a positive slope, a negative slope, '
              f'a zero slope and an undefined slope">\n  {inner}\n</svg>')

if __name__ == "__main__":
    for k, v in figs.items():
        print(f"@@{k}@@")
        print(v)
