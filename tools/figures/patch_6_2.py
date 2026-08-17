"""Key Figures + Try It Yourself for lesson 6-2, Inverse Relations and Functions."""
import sys
sys.path.insert(0, __file__.rsplit('/', 1)[0])
from graphsvg import Graph

nav = [("concepts", "Concepts"), ("figures", "Key Figures"),
       ("examples", "Step-by-Step Examples"), ("practice", "Try It Yourself"),
       ("summary", "Summary"), ("quiz", "Practice Quiz")]

# ---- Figure 1: an inverse is a reflection in the line y = x -----------------
g = Graph(-5, 5, -5, 5, unit=27, pad_l=36, pad_r=36, pad_t=26, pad_b=46)
g.axes(xlabels=[-4, -2, 2, 4], ylabels=[-4, -2, 2, 4])
g.abline(1, 0, cls="g-aux")                       # the mirror line y = x
g.abline(2, -3)                                   # f(x) = 2x - 3
g.abline(0.5, 1.5, cls="g-arc")                   # f inverse = (x + 3)/2
g.point(1, -1, r=5)
g.point(-1, 1, r=5)
g.line_seg((1, -1), (-1, 1), cls="g-dash")
g.label(1, -1, "(1, &minus;1)", cls="g-meas-b", anchor="start", dx=9, dy=4)
g.label(-1, 1, "(&minus;1, 1)", cls="g-grn", anchor="end", dx=-9, dy=-2)
g.label(2.4, 2.1, "y = x", cls="g-lbl-sm", anchor="start")
g.label(3.0, 4.3, "f(x) = 2x &minus; 3", cls="g-lbl-sm", anchor="end")
g.label(-4.7, 3.4, "f&#8315;&sup1;(x) = (x + 3)/2", cls="g-grn", anchor="start")
g.text_at(g.w / 2, g.h - 22, "every point (a, b) on f becomes (b, a) on f&#8315;&sup1;", cls="g-lbl-sm")
g.text_at(g.w / 2, g.h - 7, "so the two graphs are mirror images in the dashed line y = x",
          cls="g-lbl-sm")
mirror_fig = g.svg("the line f of x equals 2x minus 3 and its inverse reflected across the line y "
                   "equals x, with the point 1 comma negative 1 mapping to negative 1 comma 1")

# ---- Figure 2: the horizontal line test ------------------------------------
def hlt_panel(fail):
    g = Graph(-3, 3, -1, 6, unit=19, pad_l=16, pad_r=16, pad_t=32, pad_b=52, grid_step=0)
    g.axes()
    if fail:
        g.func(lambda x: x * x, samples=140)
        g.abline(0, 4, cls="g-dash")
        g.point(-2, 4, r=4.4)
        g.point(2, 4, r=4.4)
        g.text_at(g.w / 2, 15, "y = x&sup2; on all of &#8477;", cls="g-meas-b")
        g.text_at(g.w / 2, 27, "the line y = 4 hits twice", cls="g-lbl-sm")
        g.text_at(g.w / 2, g.h - 34, "FAILS the test", cls="g-meas")
        g.text_at(g.w / 2, g.h - 20, "not one-to-one, so the", cls="g-lbl-sm")
        g.text_at(g.w / 2, g.h - 7, "inverse is not a function", cls="g-lbl-sm")
    else:
        g.func(lambda x: x * x, cls="g-aux", samples=140, x0=-3, x1=0)
        g.func(lambda x: x * x, samples=140, x0=0, x1=3)
        g.abline(0, 4, cls="g-dash")
        g.point(2, 4, r=4.4)
        g.text_at(g.w / 2, 15, "y = x&sup2; restricted to x &ge; 0", cls="g-meas-b")
        g.text_at(g.w / 2, 27, "now y = 4 hits once", cls="g-lbl-sm")
        g.text_at(g.w / 2, g.h - 34, "PASSES the test", cls="g-grn")
        g.text_at(g.w / 2, g.h - 20, "one-to-one, and the inverse", cls="g-lbl-sm")
        g.text_at(g.w / 2, g.h - 7, "is f&#8315;&sup1;(x) = &radic;x", cls="g-lbl-sm")
    return g


a, b = hlt_panel(True), hlt_panel(False)
total_w = a.w + b.w + 16
hlt_fig = (f'<svg viewBox="0 0 {total_w} {a.h}" width="340" role="img" aria-label="the parabola y '
           f'equals x squared failing the horizontal line test, and the same parabola restricted to '
           f'non-negative x passing it">\n  '
           f'<g>{"".join(a.parts)}</g>\n  '
           f'<g transform="translate({a.w + 16},0)">{"".join(b.parts)}</g>\n</svg>')

figures = f"""
<figure class="fig">
<div class="fig-title">Figure 1 &mdash; an inverse is a reflection in y = x</div>
{mirror_fig}
<figcaption>Swapping <i>x</i> and <i>y</i> in the equation is the algebra. Reflecting the graph in the
line <code>y = x</code> is the same move seen geometrically: the point (1, &minus;1) on <i>f</i> lands
on (&minus;1, 1) on <i>f</i>&#8315;&sup1;. This also explains why the domain and range trade places
&mdash; the inputs of one are the outputs of the other.</figcaption>
</figure>

<figure class="fig">
<div class="fig-title">Figure 2 &mdash; the horizontal line test, and the fix</div>
{hlt_fig}
<figcaption>If a horizontal line can hit the graph twice, then two different inputs share one output.
Reflecting that in <code>y = x</code> would give one input with two outputs, which is not a function.
The fix is to <b>restrict the domain</b> to a stretch where the graph is one-to-one. Restricting
<code>y = x&sup2;</code> to <code>x &ge; 0</code> gives the inverse &radic;x; restricting it to
<code>x &le; 0</code> gives &minus;&radic;x instead &mdash; a different but equally valid branch.</figcaption>
</figure>
"""

practice = """
<p>Work each one on paper, then reveal. Problem 5 is the one examiners use to separate grades.</p>

<div class="try-box"><h4>Problem 1</h4><div class="prob">Find the inverse of f(x) = 3x + 12.</div>
<button class="reveal-btn" onclick="reveal(this)">Show Solution</button><div class="reveal-body">
<div class="solution-step"><span class="num">1</span><span class="math">y = 3x + 12</span><span class="reason">Replace f(x) with y</span></div>
<div class="solution-step"><span class="num">2</span><span class="math">x = 3y + 12</span><span class="reason">Exchange x and y &mdash; this is the whole idea</span></div>
<div class="solution-step"><span class="num">3</span><span class="math">x &minus; 12 = 3y</span><span class="reason">Subtract 12</span></div>
<div class="solution-step"><span class="num">4</span><span class="math">y = (x &minus; 12)/3</span><span class="reason">Divide by 3</span></div>
<div class="answer-box">f&#8315;&sup1;(x) = (x &minus; 12)/3</div>
<div class="check-box"><strong>Check with a value:</strong> f(1) = 15, and f&#8315;&sup1;(15) = 3/3 = 1 &#10003;. The inverse undoes the original.</div>
</div></div>

<div class="try-box"><h4>Problem 2</h4><div class="prob">Verify that f(x) = 4x &minus; 8 and g(x) = (x + 8)/4 are inverses.</div>
<button class="reveal-btn" onclick="reveal(this)">Show Solution</button><div class="reveal-body">
<div class="solution-step"><span class="num">1</span><span class="math">[f &#8728; g](x) = 4 &middot; (x + 8)/4 &minus; 8</span><span class="reason">Substitute g into f</span></div>
<div class="solution-step"><span class="num">2</span><span class="math">= (x + 8) &minus; 8 = x</span><span class="reason">First composition gives the identity</span></div>
<div class="solution-step"><span class="num">3</span><span class="math">[g &#8728; f](x) = ((4x &minus; 8) + 8)/4</span><span class="reason">Now substitute f into g</span></div>
<div class="solution-step"><span class="num">4</span><span class="math">= 4x/4 = x</span><span class="reason">Second composition also gives the identity</span></div>
<div class="answer-box">Both compositions equal x, so f and g are inverses</div>
<div class="warning-box"><strong>Check both directions.</strong> The definition requires
[f &#8728; g](x) = x <b>and</b> [g &#8728; f](x) = x. One alone is not proof.</div>
</div></div>

<div class="try-box"><h4>Problem 3</h4><div class="prob">If f(4) = &minus;3, what is f&#8315;&sup1;(&minus;3)? Explain without finding a formula.</div>
<button class="reveal-btn" onclick="reveal(this)">Show Solution</button><div class="reveal-body">
<div class="solution-step"><span class="num">1</span><span class="math">f(a) = b &#8660; f&#8315;&sup1;(b) = a</span><span class="reason">The defining property of inverses</span></div>
<div class="solution-step"><span class="num">2</span><span class="math">a = 4 and b = &minus;3</span><span class="reason">Read them off the given fact</span></div>
<div class="answer-box">f&#8315;&sup1;(&minus;3) = 4</div>
<div class="check-box"><strong>As coordinates:</strong> (4, &minus;3) lies on f, so (&minus;3, 4) lies on f&#8315;&sup1; &mdash; the swap in Figure 1. No formula needed.</div>
</div></div>

<div class="try-box"><h4>Problem 4</h4><div class="prob">Find the inverse of f(x) = (x &minus; 1)/(x + 2), and state the domain restriction on the inverse.</div>
<button class="reveal-btn" onclick="reveal(this)">Show Solution</button><div class="reveal-body">
<div class="solution-step"><span class="num">1</span><span class="math">x = (y &minus; 1)/(y + 2)</span><span class="reason">Swap x and y</span></div>
<div class="solution-step"><span class="num">2</span><span class="math">x(y + 2) = y &minus; 1</span><span class="reason">Multiply both sides by (y + 2)</span></div>
<div class="solution-step"><span class="num">3</span><span class="math">xy + 2x = y &minus; 1</span><span class="reason">Distribute</span></div>
<div class="solution-step"><span class="num">4</span><span class="math">xy &minus; y = &minus;1 &minus; 2x</span><span class="reason">Collect every y-term on one side</span></div>
<div class="solution-step"><span class="num">5</span><span class="math">y(x &minus; 1) = &minus;1 &minus; 2x</span><span class="reason">Factor out y</span></div>
<div class="solution-step"><span class="num">6</span><span class="math">y = (&minus;2x &minus; 1)/(x &minus; 1)</span><span class="reason">Divide by (x &minus; 1)</span></div>
<div class="answer-box">f&#8315;&sup1;(x) = (&minus;2x &minus; 1)/(x &minus; 1), with x &ne; 1</div>
<div class="check-box"><strong>Where the restriction comes from:</strong> the original f can never output 1 (its horizontal asymptote), so 1 is not in the range of f &mdash; and the range of f is the domain of f&#8315;&sup1;. The algebra agrees: x = 1 would divide by zero.</div>
</div></div>

<div class="try-box"><h4>Problem 5</h4><div class="prob">Does f(x) = x&sup2; + 4 have an inverse function? If not, restrict its domain so that it does, and give the inverse.</div>
<button class="reveal-btn" onclick="reveal(this)">Show Solution</button><div class="reveal-body">
<div class="solution-step"><span class="num">1</span><span class="math">f(2) = 8 and f(&minus;2) = 8</span><span class="reason">Two inputs share an output, so it fails the horizontal line test</span></div>
<div class="solution-step"><span class="num">2</span><span class="math">restrict to x &ge; 0</span><span class="reason">On that half the parabola is one-to-one</span></div>
<div class="solution-step"><span class="num">3</span><span class="math">x = y&sup2; + 4 &rarr; y&sup2; = x &minus; 4</span><span class="reason">Swap and rearrange</span></div>
<div class="solution-step"><span class="num">4</span><span class="math">y = &radic;(x &minus; 4)</span><span class="reason">Take the <i>positive</i> root only, to match the restriction</span></div>
<div class="answer-box">No inverse function as given. With x &ge; 0: f&#8315;&sup1;(x) = &radic;(x &minus; 4), valid for x &ge; 4</div>
<div class="warning-box"><strong>Two things to get right:</strong> writing &plusmn;&radic;(x &minus; 4) is not a function, so the restriction decides the sign. And the inverse's own domain is x &ge; 4, because 4 is the smallest output the restricted f can produce. Restricting to x &le; 0 instead gives f&#8315;&sup1;(x) = &minus;&radic;(x &minus; 4) &mdash; the other branch in Figure 2.</div>
</div></div>

<div class="try-box"><h4>Problem 6</h4><div class="prob">The graph of f passes through (0, 5) and (3, 11). Name two points on the graph of f&#8315;&sup1;, and find its slope.</div>
<button class="reveal-btn" onclick="reveal(this)">Show Solution</button><div class="reveal-body">
<div class="solution-step"><span class="num">1</span><span class="math">(0, 5) &rarr; (5, 0) and (3, 11) &rarr; (11, 3)</span><span class="reason">Swap each coordinate pair</span></div>
<div class="solution-step"><span class="num">2</span><span class="math">slope of f = (11 &minus; 5)/(3 &minus; 0) = 2</span><span class="reason">For comparison</span></div>
<div class="solution-step"><span class="num">3</span><span class="math">slope of f&#8315;&sup1; = (3 &minus; 0)/(11 &minus; 5) = 1/2</span><span class="reason">Rise and run have traded places</span></div>
<div class="answer-box">(5, 0) and (11, 3) lie on f&#8315;&sup1;, whose slope is 1/2</div>
<div class="check-box"><strong>A useful pattern:</strong> reflecting in y = x turns a slope of m into 1/m. It also means a line of slope 1 is its own reflection, and a horizontal line reflects to a vertical one &mdash; which is exactly why a constant function has no inverse function.</div>
</div></div>
"""
