"""Key Figures + Try It Yourself for lesson 3-7, Quadratic Inequalities."""
import sys
sys.path.insert(0, __file__.rsplit('/', 1)[0])
from graphsvg import Graph

nav = [("concepts", "Concepts"), ("figures", "Key Figures"), ("examples", "Examples"),
       ("grapher", "Interactive Grapher"), ("practice", "Try It Yourself"),
       ("quiz", "Practice Quiz")]

# ---- Figure 1: the graph and the number line say the same thing -------------
# y = x^2 - x - 6 = (x-3)(x+2), roots -2 and 3
para = lambda x: x * x - x - 6
g = Graph(-4, 5, -7, 5, unit=22, pad_l=40, pad_r=44, pad_t=26, pad_b=96)
g.axes(xlabels=[-4, -2, 3, 5], ylabels=[-6, -4, -2, 2, 4])
g.func(para, samples=180)
g.point(-2, 0, r=5)
g.point(3, 0, r=5)
# the stretch of curve sitting BELOW the axis -- that is where y < 0
g.func(para, cls="g-arc", samples=120, x0=-2, x1=3,
       extra=' style="stroke-width:4.5" data-part="below"')
g.label(1.4, -6.25, "y &lt; 0 here", cls="g-grn", anchor="middle", dy=19,
        extra=' data-part="below"')
# the two stretches ABOVE the axis (func clips them to the window for us)
for lo, hi in ((-4, -2), (3, 5)):
    g.func(para, cls="g-dash", samples=80, x0=lo, x1=hi,
           extra=' style="stroke-width:4.5;stroke-dasharray:none" data-part="above"')
g.label(-3.2, 3.4, "y &gt; 0", cls="g-meas", anchor="middle", extra=' data-part="above"')
g.label(4.2, 3.4, "y &gt; 0", cls="g-meas", anchor="middle", extra=' data-part="above"')

# a matching number line, placed clear of the whole plot area
NL = g.py(g.ymin) + 48
g.raw(f'<text class="g-lbl-sm" x="{g.px(0.5)}" y="{NL - 20}" text-anchor="middle">'
      f'the same three regions, on a number line</text>')
g.raw(f'<line class="g-axis" x1="{g.px(-4)}" y1="{NL}" x2="{g.px(5)}" y2="{NL}"/>')
g.raw(f'<line class="g-arc" style="stroke-width:7;opacity:.85" x1="{g.px(-2)}" y1="{NL}" '
      f'x2="{g.px(3)}" y2="{NL}" data-part="below"/>')
for lo, hi in ((-4, -2), (3, 5)):
    g.raw(f'<line class="g-dash" style="stroke-width:7;stroke-dasharray:none;opacity:.85" '
          f'x1="{g.px(lo)}" y1="{NL}" x2="{g.px(hi)}" y2="{NL}" data-part="above"/>')
for v in (-2, 3):
    g.raw(f'<circle class="g-pt-o" cx="{g.px(v)}" cy="{NL}" r="5.4"/>')
    label = str(v).replace('-', '&minus;')
    g.raw(f'<text class="g-lbl-sm" x="{g.px(v)}" y="{NL + 20}" text-anchor="middle">{label}</text>')
sign_fig = g.svg("the parabola y equals x squared minus x minus 6 with the section below the x-axis "
                 "highlighted, above a matching number line divided at negative 2 and 3",
                 svg_id="l37fig1")

# ---- Figure 2: shading a two-variable quadratic inequality -----------------
g2 = Graph(-4, 4, -6, 6, unit=22, pad_l=40, pad_r=40, pad_t=26, pad_b=46)
g2.axes(xlabels=[-4, -2, 2, 4], ylabels=[-4, -2, 2, 4])
# shade the region above the parabola y = x^2 - 4 by stacking thin vertical strips
strips = []
for i in range(-40, 41):
    x = i / 10
    lo = x * x - 4
    if lo < 6:
        strips.append(f'<line class="g-arc" style="stroke-width:2.6;opacity:.16" '
                      f'x1="{g2.px(x)}" y1="{g2.py(max(lo, -6))}" x2="{g2.px(x)}" y2="{g2.py(6)}"/>')
g2.raw("".join(strips))
g2.func(lambda x: x * x - 4, cls="g-dash", samples=180)
g2.point(0, 0, r=5.4)
g2.label(0, 0, "test (0, 0)", cls="g-meas", anchor="start", dx=10, dy=-6)
g2.label(-3.6, 4.6, "y &gt; x&sup2; &minus; 4", cls="g-grn", anchor="start")
g2.text_at(g2.w / 2, g2.h - 24, "0 &gt; 0&sup2; &minus; 4 &rarr; 0 &gt; &minus;4 is TRUE, so shade the side (0, 0) is on",
           cls="g-lbl-sm")
g2.text_at(g2.w / 2, g2.h - 8, "dashed curve because the inequality is strict (&gt;, not &ge;)",
           cls="g-lbl-sm")
shade_fig = g2.svg("the parabola y equals x squared minus 4 drawn dashed with the region above it "
                   "shaded and the test point 0 comma 0 marked")

figures = f"""
<figure class="fig">
<div class="fig-title">Figure 1 &mdash; the graph and the number line are the same answer</div>
{sign_fig}
<div class="fig-legend">
  <span class="fig-chip" onclick="figHi(this,'l37fig1','below')">x&sup2; &minus; x &minus; 6 &lt; 0</span>
  <span class="fig-chip" onclick="figHi(this,'l37fig1','above')">x&sup2; &minus; x &minus; 6 &gt; 0</span>
</div>
<figcaption>The zeros &minus;2 and 3 cut the number line into three regions, and the parabola tells you
the sign in each. Asking <code>x&sup2; &minus; x &minus; 6 &lt; 0</code> is asking &ldquo;where is the
curve <b>below</b> the axis?&rdquo; &mdash; the single stretch <b>between</b> the roots. Asking
<code>&gt; 0</code> is asking where it is <b>above</b> &mdash; the two pieces <b>outside</b> the roots.
This is why an upward parabola gives &ldquo;between&rdquo; for &lt; and &ldquo;outside&rdquo; for &gt;,
and why a downward parabola swaps them.</figcaption>
</figure>

<figure class="fig">
<div class="fig-title">Figure 2 &mdash; two variables: which side do I shade?</div>
{shade_fig}
<figcaption>With <i>y</i> in the inequality you shade a region rather than an interval. Graph the
boundary parabola &mdash; <b>dashed</b> for &lt; or &gt;, <b>solid</b> for &le; or &ge; &mdash; then test
one point that is not on the curve. (0, 0) is almost always the easiest. If the test point makes the
inequality true, shade the side it lies on; if false, shade the other side.</figcaption>
</figure>
"""

practice = """
<p>Solve each one, then reveal. Problems 4 and 5 are the ones that catch people out &mdash; think about
the picture before you write anything.</p>

<div class="try-box"><h4>Problem 1</h4><div class="prob">Solve x&sup2; &minus; 4 &gt; 0.</div>
<button class="reveal-btn" onclick="reveal(this)">Show Solution</button><div class="reveal-body">
<div class="solution-step"><span class="num">1</span><span class="math">x&sup2; &minus; 4 = 0 &rarr; x = &plusmn;2</span><span class="reason">Find the zeros of the related equation</span></div>
<div class="solution-step"><span class="num">2</span><span class="math">a = 1 &gt; 0, so the parabola opens up</span><span class="reason">&gt; 0 means above the axis &rarr; the outside regions</span></div>
<div class="solution-step"><span class="num">3</span><span class="math">test x = 0: 0 &minus; 4 = &minus;4, not &gt; 0</span><span class="reason">Confirms the middle region fails</span></div>
<div class="answer-box">x &lt; &minus;2 or x &gt; 2</div>
<div class="check-box"><strong>Check an endpoint region:</strong> x = 3 gives 9 &minus; 4 = 5 &gt; 0 &#10003;. Open circles at &plusmn;2 because the inequality is strict.</div>
</div></div>

<div class="try-box"><h4>Problem 2</h4><div class="prob">Solve x&sup2; + 2x &minus; 15 &le; 0.</div>
<button class="reveal-btn" onclick="reveal(this)">Show Solution</button><div class="reveal-body">
<div class="solution-step"><span class="num">1</span><span class="math">(x + 5)(x &minus; 3) = 0 &rarr; x = &minus;5, x = 3</span><span class="reason">Factor to find the zeros</span></div>
<div class="solution-step"><span class="num">2</span><span class="math">opens up, and we want &le; 0</span><span class="reason">Below or on the axis &rarr; between the roots</span></div>
<div class="solution-step"><span class="num">3</span><span class="math">test x = 0: &minus;15 &le; 0 &#10003;</span><span class="reason">The middle region works</span></div>
<div class="answer-box">&minus;5 &le; x &le; 3</div>
<div class="check-box"><strong>The endpoints are included</strong> because &le; allows equality, and at x = &minus;5 and x = 3 the expression is exactly 0. Filled circles.</div>
</div></div>

<div class="try-box"><h4>Problem 3</h4><div class="prob">Solve &minus;x&sup2; + 4x &minus; 3 &gt; 0.</div>
<button class="reveal-btn" onclick="reveal(this)">Show Solution</button><div class="reveal-body">
<div class="solution-step"><span class="num">1</span><span class="math">x&sup2; &minus; 4x + 3 &lt; 0</span><span class="reason">Multiply by &minus;1 and <b>reverse</b> the inequality</span></div>
<div class="solution-step"><span class="num">2</span><span class="math">(x &minus; 1)(x &minus; 3) = 0 &rarr; x = 1, x = 3</span><span class="reason">Factor</span></div>
<div class="solution-step"><span class="num">3</span><span class="math">opens up, want &lt; 0 &rarr; between</span><span class="reason">Test x = 2: 4 &minus; 8 + 3 = &minus;1 &lt; 0 &#10003;</span></div>
<div class="answer-box">1 &lt; x &lt; 3</div>
<div class="check-box"><strong>Or skip the rewrite:</strong> the original opens <i>down</i>, and a downward parabola is <i>above</i> the axis between its roots &mdash; same answer, 1 &lt; x &lt; 3. Either route works, but you must not both flip the sign and use the downward rule, or you will get the complement.</div>
</div></div>

<div class="try-box"><h4>Problem 4</h4><div class="prob">Solve x&sup2; &minus; 6x + 9 &gt; 0.</div>
<button class="reveal-btn" onclick="reveal(this)">Show Solution</button><div class="reveal-body">
<div class="solution-step"><span class="num">1</span><span class="math">(x &minus; 3)&sup2; &gt; 0</span><span class="reason">A perfect square &mdash; the discriminant is 0</span></div>
<div class="solution-step"><span class="num">2</span><span class="math">the only zero is x = 3</span><span class="reason">The vertex sits <i>on</i> the axis, so there is no region between roots</span></div>
<div class="solution-step"><span class="num">3</span><span class="math">a square is positive everywhere except where it is 0</span><span class="reason">Test x = 0: 9 &gt; 0 &#10003;, and x = 5: 4 &gt; 0 &#10003;</span></div>
<div class="answer-box">All real numbers except x = 3</div>
<div class="check-box"><strong>Do not answer &ldquo;no solution&rdquo;.</strong> Only the single point x = 3 fails, where the expression equals 0 rather than being greater than 0. Had the question said &ge; 0, the answer would be all real numbers.</div>
</div></div>

<div class="try-box"><h4>Problem 5</h4><div class="prob">Solve x&sup2; + 1 &lt; 0.</div>
<button class="reveal-btn" onclick="reveal(this)">Show Solution</button><div class="reveal-body">
<div class="solution-step"><span class="num">1</span><span class="math">b&sup2; &minus; 4ac = 0 &minus; 4 = &minus;4 &lt; 0</span><span class="reason">No real zeros, so the curve never crosses the axis</span></div>
<div class="solution-step"><span class="num">2</span><span class="math">a = 1 &gt; 0 and no crossings</span><span class="reason">The whole parabola sits above the axis</span></div>
<div class="answer-box">&empty; &mdash; no real solution</div>
<div class="check-box"><strong>Reason it out directly:</strong> x&sup2; is never negative, so x&sup2; + 1 is always at least 1. Nothing can make it less than 0. Had the question said &gt; 0, the answer would be all real numbers.</div>
</div></div>

<div class="try-box"><h4>Problem 6</h4><div class="prob">Describe the graph of y &ge; x&sup2; &minus; 2x &minus; 3: boundary style, key points, and which region is shaded.</div>
<button class="reveal-btn" onclick="reveal(this)">Show Solution</button><div class="reveal-body">
<div class="solution-step"><span class="num">1</span><span class="math">&ge; &rarr; solid parabola</span><span class="reason">The boundary itself is part of the solution</span></div>
<div class="solution-step"><span class="num">2</span><span class="math">(x &minus; 3)(x + 1) = 0 &rarr; x-intercepts &minus;1 and 3</span><span class="reason">Factor to plot the curve</span></div>
<div class="solution-step"><span class="num">3</span><span class="math">x = &minus;b/2a = 1, y = 1 &minus; 2 &minus; 3 = &minus;4</span><span class="reason">Vertex (1, &minus;4)</span></div>
<div class="solution-step"><span class="num">4</span><span class="math">test (0, 0): 0 &ge; &minus;3 &#10003;</span><span class="reason">True, so shade the side containing the origin</span></div>
<div class="answer-box">Solid upward parabola through (&minus;1, 0) and (3, 0) with vertex (1, &minus;4), shaded <b>inside and above</b> the curve</div>
<div class="check-box"><strong>Sense check:</strong> y &ge; something means &ldquo;at or above&rdquo;, so for an upward parabola the shading fills the bowl and everything above it &mdash; exactly the pattern in Figure 2.</div>
</div></div>
"""
