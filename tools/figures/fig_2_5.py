"""Figures for lesson 2-5, Solving Systems of Equations Algebraically."""
import sys
sys.path.insert(0, __file__.rsplit('/', 1)[0])
from graphsvg import Graph

figs = {}

# ---- Figure 1: the three things a linear system can do ---------------------
def mini(lines, tag, note, part):
    g = Graph(-4, 4, -4, 4, unit=15, pad_l=14, pad_r=14, pad_t=32, pad_b=42, grid_step=0)
    g.axes()
    for m, b, cls in lines:
        g.abline(m, b, cls=cls)
    g.text_at(g.w / 2, 17, tag, cls="g-meas-b")
    for i, ln in enumerate(note):
        g.text_at(g.w / 2, g.h - 26 + i * 15, ln, cls="g-lbl-sm")
    return g, part


panels = [
    mini([(2, -1, "g-line"), (-1, 5, "g-arc")], "one solution",
         ["lines cross once", "(2, 3)"], "one"),
    mini([(2, -1, "g-line"), (2, 3, "g-arc")], "no solution",
         ["parallel &mdash; same slope,", "different intercept"], "none"),
    mini([(2, -1, "g-line"), (2, -1, "g-dash")], "infinitely many",
         ["one line drawn twice &mdash;", "every point works"], "many"),
]
# mark the intersection on the first panel
panels[0][0].point(2, 3)

gap = 10
parts, x = [], 0
for g, part in panels:
    parts.append((x, g, part))
    x += g.w + gap
total_w = x - gap
inner = "\n  ".join(
    f'<g transform="translate({dx},0)" data-part="{part}">' + "".join(g.parts) + "</g>"
    for dx, g, part in parts)
figs['f1'] = (f'<svg id="l25fig1" viewBox="0 0 {total_w} {panels[0][0].h}" width="340" role="img" '
              f'aria-label="three small graphs showing a system with one solution, a system with '
              f'no solution and a system with infinitely many solutions">\n  {inner}\n</svg>')

# ---- Figure 2: the worked example, seen as an intersection ------------------
g = Graph(-7, 3, -8, 3, unit=22, pad_l=34, pad_r=54, pad_t=26, pad_b=32)
# the action is left of the y-axis here, so the y numbers go on the right
g.axes(xlabels=[-6, -4, -2], ylabels=[-8, -6, -4, -2], ylabel_dx=9)
g.abline(8 / 3, 1 / 3)                     # 8x - 3y = -1
g.abline(-0.5, -6, cls="g-arc")            # x + 2y = -12
g.point(-2, -5, r=5.4)
g.label(-2, -5, "(&minus;2, &minus;5)", cls="g-meas", anchor="end", dx=-8, dy=16)
g.label(-6.8, -1.4, "x + 2y = &minus;12", cls="g-grn", anchor="start")
g.label(1.4, 2.6, "8x &minus; 3y = &minus;1", cls="g-lbl-sm", anchor="start")
figs['f2'] = g.svg("the lines 8x minus 3y equals negative 1 and x plus 2y equals negative 12 "
                   "crossing at the point negative 2, negative 5")

if __name__ == "__main__":
    for k, v in figs.items():
        print(f"@@{k}@@")
        print(v)
