"""Key Figures + Try It Yourself for lesson 4-1, Polynomial Functions."""
import sys
sys.path.insert(0, __file__.rsplit('/', 1)[0])
from graphsvg import Graph

nav = [("concepts", "Concepts"), ("figures", "Key Figures"), ("examples", "Examples"),
       ("grapher", "Polynomial Grapher"), ("practice", "Try It Yourself"),
       ("quiz", "Practice Quiz")]


def panel(f, tag, arrows, part):
    g = Graph(-2.4, 2.4, -4, 4, unit=22, pad_l=10, pad_r=10, pad_t=34, pad_b=40, grid_step=0)
    g.axes()
    g.func(f, samples=160)
    g.text_at(g.w / 2, 14, tag[0], cls="g-meas-b")
    g.text_at(g.w / 2, 27, tag[1], cls="g-lbl-sm")
    g.text_at(g.w / 2, g.h - 22, arrows, cls="g-meas")
    g.text_at(g.w / 2, g.h - 7, tag[2], cls="g-lbl-sm")
    return g, part


panels = [
    panel(lambda x: x * x, ("even degree", "a &gt; 0", "up and up"), "&uarr; &nbsp; &uarr;", "ep"),
    panel(lambda x: -x * x, ("even degree", "a &lt; 0", "down and down"), "&darr; &nbsp; &darr;", "en"),
    panel(lambda x: x ** 3, ("odd degree", "a &gt; 0", "down then up"), "&darr; &nbsp; &uarr;", "op"),
    panel(lambda x: -x ** 3, ("odd degree", "a &lt; 0", "up then down"), "&uarr; &nbsp; &darr;", "on"),
]
gap = 6
parts, x = [], 0
for g, part in panels:
    parts.append((x, g, part))
    x += g.w + gap
total_w = x - gap
inner = "\n  ".join(
    f'<g transform="translate({dx},0)" data-part="{part}">' + "".join(g.parts) + "</g>"
    for dx, g, part in parts)
end_fig = (f'<svg id="l41fig1" viewBox="0 0 {total_w} {panels[0][0].h}" width="340" role="img" '
           f'aria-label="four small graphs showing the four end behaviour cases for even and odd '
           f'degree with positive and negative leading coefficient">\n  {inner}\n</svg>')

# ---- Figure 2: what the degree limits ---------------------------------------
g = Graph(-3, 3, -4, 4, unit=32, pad_l=38, pad_r=38, pad_t=26, pad_b=46)
g.axes(xlabels=[-2, 2], ylabels=[-2, 2])
g.func(lambda x: x ** 3 - 3 * x, samples=200)
for r in (-3 ** 0.5, 0, 3 ** 0.5):
    g.point(r, 0, r=5)
g.point(-1, 2, cls="g-pt-o", r=5.4)
g.point(1, -2, cls="g-pt-o", r=5.4)
g.label(-1, 2, "turn", cls="g-meas", anchor="end", dx=-8, dy=-4)
g.label(1, -2, "turn", cls="g-meas", anchor="start", dx=8, dy=10)
g.label(0.9, 3.4, "y = x&sup3; &minus; 3x", cls="g-lbl-sm", anchor="middle")
g.text_at(g.w / 2, g.h - 24, "degree 3 &rarr; at most 3 x-intercepts (it has 3)", cls="g-lbl-sm")
g.text_at(g.w / 2, g.h - 8, "and at most 3 &minus; 1 = 2 turning points (it has 2)", cls="g-lbl-sm")
deg_fig = g.svg("the cubic y equals x cubed minus 3x with its three x-intercepts and two turning "
                "points marked")

figures = f"""
<figure class="fig">
<div class="fig-title">Figure 1 &mdash; the four end behaviours, at a glance</div>
{end_fig}
<div class="fig-legend">
  <span class="fig-chip" onclick="figHi(this,'l41fig1','ep')">even, a &gt; 0</span>
  <span class="fig-chip" onclick="figHi(this,'l41fig1','en')">even, a &lt; 0</span>
  <span class="fig-chip" onclick="figHi(this,'l41fig1','op')">odd, a &gt; 0</span>
  <span class="fig-chip" onclick="figHi(this,'l41fig1','on')">odd, a &lt; 0</span>
</div>
<figcaption>Only two things decide what the far ends of a polynomial do: whether the <b>degree</b> is
even or odd, and whether the <b>leading coefficient</b> is positive or negative. Nothing else in the
polynomial matters out there, because for very large |x| the leading term dwarfs every other term.
Even degree means the two ends agree with each other; odd degree means they disagree. A negative
leading coefficient flips the whole picture upside down.</figcaption>
</figure>

<figure class="fig">
<div class="fig-title">Figure 2 &mdash; what the degree lets you predict</div>
{deg_fig}
<figcaption>The degree is a ceiling on two counts. A degree-<i>n</i> polynomial can cross the
<i>x</i>-axis at most <i>n</i> times, and can change direction at most <i>n</i> &minus; 1 times. This
cubic hits both ceilings. Ceilings are not guarantees, though &mdash; <code>y = x&sup3;</code> has
degree 3 but only one <i>x</i>-intercept and no turning points at all.</figcaption>
</figure>
"""

practice = """
<p>Answer each on paper before revealing. Problem 3 is the one that most often loses a mark.</p>

<div class="try-box"><h4>Problem 1</h4><div class="prob">State the degree and leading coefficient of f(x) = 7 &minus; 2x&sup3; + x&sup2;, then describe its end behaviour.</div>
<button class="reveal-btn" onclick="reveal(this)">Show Solution</button><div class="reveal-body">
<div class="solution-step"><span class="num">1</span><span class="math">f(x) = &minus;2x&sup3; + x&sup2; + 7</span><span class="reason">Rewrite in standard form, greatest degree first</span></div>
<div class="solution-step"><span class="num">2</span><span class="math">degree 3, leading coefficient &minus;2</span><span class="reason">The leading coefficient belongs to the highest-degree term, not the first term written</span></div>
<div class="solution-step"><span class="num">3</span><span class="math">odd degree, a &lt; 0</span><span class="reason">Fourth panel of Figure 1</span></div>
<div class="answer-box">As x &rarr; &minus;&infin;, f(x) &rarr; +&infin;; as x &rarr; +&infin;, f(x) &rarr; &minus;&infin;</div>
<div class="warning-box"><strong>The trap:</strong> reading the leading coefficient as 7 because it is written first. Always put the polynomial in standard form before naming anything.</div>
</div></div>

<div class="try-box"><h4>Problem 2</h4><div class="prob">Is g(x) = 4x&sup2; &minus; 3&radic;x + 1 a polynomial? Explain.</div>
<button class="reveal-btn" onclick="reveal(this)">Show Solution</button><div class="reveal-body">
<div class="solution-step"><span class="num">1</span><span class="math">&radic;x = x^(1/2)</span><span class="reason">Rewrite the radical as a power</span></div>
<div class="solution-step"><span class="num">2</span><span class="math">1/2 is not a non-negative integer</span><span class="reason">Every exponent in a polynomial must be a whole number &ge; 0</span></div>
<div class="answer-box">No &mdash; the term &minus;3&radic;x has exponent 1/2, so g is not a polynomial</div>
<div class="check-box"><strong>The same test rules out</strong> negative exponents such as x&#8315;&sup2; (which is 1/x&sup2;), and variables in a denominator. 4x&sup2; + 1 on its own would be fine.</div>
</div></div>

<div class="try-box"><h4>Problem 3</h4><div class="prob">Find the degree and leading coefficient of h(x) = (2x &minus; 1)&sup2;(x + 5).</div>
<button class="reveal-btn" onclick="reveal(this)">Show Solution</button><div class="reveal-body">
<div class="solution-step"><span class="num">1</span><span class="math">degrees add: 2 + 1 = 3</span><span class="reason">(2x &minus; 1)&sup2; contributes degree 2 and (x + 5) contributes degree 1</span></div>
<div class="solution-step"><span class="num">2</span><span class="math">leading terms: (2x)&sup2; &middot; x = 4x&sup3;</span><span class="reason">Multiply only the highest-degree term from each factor</span></div>
<div class="answer-box">Degree 3, leading coefficient 4</div>
<div class="check-box"><strong>You do not need to expand.</strong> Multiplying the leading terms is enough, and it is far quicker. If you did expand you would get 4x&sup3; + 16x&sup2; &minus; 19x + 5 &mdash; same answer, much more work.</div>
</div></div>

<div class="try-box"><h4>Problem 4</h4><div class="prob">A polynomial has degree 5. What is the greatest number of x-intercepts and turning points it can have?</div>
<button class="reveal-btn" onclick="reveal(this)">Show Solution</button><div class="reveal-body">
<div class="solution-step"><span class="num">1</span><span class="math">x-intercepts &le; degree = 5</span><span class="reason">A degree-n polynomial has at most n real zeros</span></div>
<div class="solution-step"><span class="num">2</span><span class="math">turning points &le; degree &minus; 1 = 4</span><span class="reason">Direction can change at most n &minus; 1 times</span></div>
<div class="answer-box">At most 5 x-intercepts and at most 4 turning points</div>
<div class="check-box"><strong>These are ceilings, not counts.</strong> y = x&#8309; has degree 5 with just one x-intercept and no turning points &mdash; see the note under Figure 2.</div>
</div></div>

<div class="try-box"><h4>Problem 5</h4><div class="prob">A polynomial function of odd degree has a negative leading coefficient. Must it have at least one real zero? Why?</div>
<button class="reveal-btn" onclick="reveal(this)">Show Solution</button><div class="reveal-body">
<div class="solution-step"><span class="num">1</span><span class="math">as x &rarr; &minus;&infin;, f(x) &rarr; +&infin;</span><span class="reason">Odd degree with a &lt; 0 rises on the left</span></div>
<div class="solution-step"><span class="num">2</span><span class="math">as x &rarr; +&infin;, f(x) &rarr; &minus;&infin;</span><span class="reason">And falls on the right</span></div>
<div class="solution-step"><span class="num">3</span><span class="math">it is above the axis somewhere and below it somewhere</span><span class="reason">A polynomial graph is unbroken, so it has to pass through 0 in between</span></div>
<div class="answer-box">Yes &mdash; every odd-degree polynomial has at least one real zero</div>
<div class="check-box"><strong>Compare with even degree:</strong> y = x&sup2; + 1 never crosses the axis, because both ends go the same way and the whole curve can sit above 0. That option is not available to an odd-degree polynomial.</div>
</div></div>

<div class="try-box"><h4>Problem 6</h4><div class="prob">Evaluate f(x) = 2x&#8308; &minus; x&sup2; + 3 at x = &minus;2, and say whether f(&minus;x) = f(x).</div>
<button class="reveal-btn" onclick="reveal(this)">Show Solution</button><div class="reveal-body">
<div class="solution-step"><span class="num">1</span><span class="math">f(&minus;2) = 2(&minus;2)&#8308; &minus; (&minus;2)&sup2; + 3</span><span class="reason">Substitute, keeping the brackets</span></div>
<div class="solution-step"><span class="num">2</span><span class="math">= 2(16) &minus; 4 + 3 = 31</span><span class="reason">(&minus;2)&#8308; = 16 and (&minus;2)&sup2; = 4 &mdash; both positive</span></div>
<div class="solution-step"><span class="num">3</span><span class="math">f(2) = 2(16) &minus; 4 + 3 = 31 as well</span><span class="reason">Every exponent is even, so the sign of x does not matter</span></div>
<div class="answer-box">f(&minus;2) = 31, and f(&minus;x) = f(x) &mdash; the graph is symmetric about the y-axis</div>
<div class="warning-box"><strong>Bracket discipline:</strong> writing &minus;2&#8308; instead of (&minus;2)&#8308; gives &minus;16, because the exponent binds tighter than the minus sign. That single missing bracket is the most common evaluation error in this lesson.</div>
</div></div>
"""
