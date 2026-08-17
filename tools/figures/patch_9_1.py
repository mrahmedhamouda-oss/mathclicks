"""Key Figures for lesson 9-1, Multiplying and Dividing Rational Expressions.

This lesson already has Try It Yourself and Summary sections, so only the
pictures are missing.
"""
import sys
sys.path.insert(0, __file__.rsplit('/', 1)[0])
from graphsvg import Graph

nav = [("concepts", "Concepts"), ("figures", "Key Figures"), ("examples", "Examples"),
       ("practice", "Try It Yourself"), ("summary", "Summary"), ("quiz", "Practice Quiz")]
practice = None

# ---- Figure 1: cancelling leaves a hole behind ------------------------------
g = Graph(-4, 5, -3, 8, unit=25, pad_l=38, pad_r=44, pad_t=26, pad_b=52)
g.axes(xlabels=[-4, -2, 2, 4], ylabels=[-2, 2, 4, 6])
g.abline(1, 2)
g.point(2, 4, cls="g-pt-o", r=6)
g.line_seg((2, 0), (2, 4), cls="g-aux")
g.label(2, 4, "hole at (2, 4)", cls="g-meas", anchor="end", dx=-11, dy=-4)
g.label(2, 0, "x = 2 excluded", cls="g-meas", anchor="middle", dy=35)
g.label(-3.7, 7.5, "y = (x&sup2; &minus; 4)/(x &minus; 2)", cls="g-lbl-sm", anchor="start")
g.text_at(g.w / 2, g.h - 30, "the algebra simplifies to x + 2 &hellip;", cls="g-lbl-sm")
g.text_at(g.w / 2, g.h - 12, "&hellip; but the original was never defined at x = 2", cls="g-grn")
hole_fig = g.svg("the line y equals x plus 2 with an open circle at the point 2 comma 4 marking an "
                 "excluded value")

# ---- Figure 2: multiplying is factor bookkeeping ----------------------------
CELL = 'fill="var(--sl-blue-soft)" stroke="var(--sl-blue)" stroke-width="1.6"'
GONE = 'fill="var(--sl-bad-soft)" stroke="var(--sl-bad-line)" stroke-width="1.6"'
KEEP = 'fill="var(--sl-green-soft)" stroke="var(--sl-green)" stroke-width="1.6"'
p = [
    '<text class="g-lbl-sm" x="170" y="16" text-anchor="middle">'
    '(x + 3)/(x &minus; 1) &nbsp;&times;&nbsp; (x &minus; 1)/(x + 5)</text>',
    '<text class="g-meas" x="24" y="52" text-anchor="start">top</text>',
    f'<rect x="70" y="32" width="86" height="30" rx="6" {CELL}/>',
    '<text class="g-lbl" x="113" y="52" text-anchor="middle">x + 3</text>',
    f'<rect x="166" y="32" width="86" height="30" rx="6" {GONE}/>',
    '<text class="g-lbl" x="209" y="52" text-anchor="middle">x &minus; 1</text>',
    '<line class="g-axis" x1="24" y1="76" x2="316" y2="76"/>',
    '<text class="g-meas" x="24" y="106" text-anchor="start">bottom</text>',
    f'<rect x="70" y="86" width="86" height="30" rx="6" {GONE}/>',
    '<text class="g-lbl" x="113" y="106" text-anchor="middle">x &minus; 1</text>',
    f'<rect x="166" y="86" width="86" height="30" rx="6" {CELL}/>',
    '<text class="g-lbl" x="209" y="106" text-anchor="middle">x + 5</text>',
    '<line class="g-dash" x1="166" y1="66" x2="252" y2="42"/>',
    '<line class="g-dash" x1="70" y1="112" x2="156" y2="90"/>',
    '<text class="g-lbl-sm" x="260" y="84" text-anchor="start">cancel</text>',
    f'<rect x="60" y="134" width="220" height="32" rx="8" {KEEP}/>',
    '<text class="g-grn" x="170" y="155" text-anchor="middle">= (x + 3)/(x + 5)</text>',
    '<text class="g-meas" x="170" y="188" text-anchor="middle">'
    'but still x &ne; 1 &nbsp;and&nbsp; x &ne; &minus;5</text>',
    '<text class="g-lbl-sm" x="170" y="204" text-anchor="middle">'
    'x = 1 is excluded even though its factor vanished</text>',
]
cancel_fig = ('<svg viewBox="0 0 340 216" width="340" role="img" aria-label="a diagram showing a '
              'factor of x minus 1 cancelling between the numerator and denominator while its '
              'excluded value is kept">\n  ' + "\n  ".join(p) + '\n</svg>')

figures = f"""
<figure class="fig">
<div class="fig-title">Figure 1 &mdash; what an excluded value actually looks like</div>
{hole_fig}
<figcaption><code>(x&sup2; &minus; 4)/(x &minus; 2)</code> simplifies to <code>x + 2</code>, and for
every <i>x</i> except one those two expressions agree perfectly. At <code>x = 2</code> the original
asks you to divide by zero, so it has no value there at all &mdash; the graph is a straight line with a
single point punched out of it. That missing point is why we write <b>x &ne; 2</b> alongside the
simplified answer: the simplification is only valid where the original was defined.</figcaption>
</figure>

<figure class="fig">
<div class="fig-title">Figure 2 &mdash; cancelling removes the factor, not the restriction</div>
{cancel_fig}
<figcaption>Multiplying rational expressions is bookkeeping with factors: everything on top, everything
on the bottom, then strike out matching pairs. The trap is that striking out
<code>(x &minus; 1)</code> makes it invisible in your answer while <code>x = 1</code> is still
forbidden &mdash; the original expression could never accept it. Collect every restriction from the
<i>original</i> denominators <b>before</b> you cancel anything.</figcaption>
</figure>
"""
