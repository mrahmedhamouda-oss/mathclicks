"""Key Figures + Try It Yourself for lesson 3-6, the Quadratic Formula and the Discriminant."""
import sys
sys.path.insert(0, __file__.rsplit('/', 1)[0])
from graphsvg import Graph

nav = [("concepts", "Concepts"), ("figures", "Key Figures"), ("examples", "Examples"),
       ("visualizer", "Discriminant Visualizer"), ("practice", "Try It Yourself"),
       ("quiz", "Practice Quiz")]


def panel(a, b, c, tag, note, part, roots):
    g = Graph(-3, 5, -4, 6, unit=13, pad_l=10, pad_r=10, pad_t=34, pad_b=44, grid_step=0)
    g.axes()
    g.func(lambda x: a * x * x + b * x + c, samples=140)
    for r in roots:
        g.point(r, 0, r=3.8)
    g.text_at(g.w / 2, 15, tag, cls="g-meas-b")
    g.text_at(g.w / 2, 28, note[0], cls="g-lbl-sm")
    for i, ln in enumerate(note[1:]):
        g.text_at(g.w / 2, g.h - 28 + i * 14, ln, cls="g-lbl-sm")
    return g, part


# x^2 - 3x - 4 : disc = 9 + 16 = 25 > 0, roots -1 and 4
# x^2 - 4x + 4 : disc = 16 - 16 = 0,     double root 2
# x^2 - 2x + 3 : disc = 4 - 12 = -8 < 0, no real roots
panels = [
    panel(1, -3, -4, "b&sup2; &minus; 4ac &gt; 0",
          ["25", "crosses twice", "2 real roots"], "pos", [-1, 4]),
    panel(1, -4, 4, "b&sup2; &minus; 4ac = 0",
          ["0", "touches once", "1 double root"], "zero", [2]),
    panel(1, -2, 3, "b&sup2; &minus; 4ac &lt; 0",
          ["&minus;8", "never touches", "2 complex roots"], "neg", []),
]

gap = 8
parts, x = [], 0
for g, part in panels:
    parts.append((x, g, part))
    x += g.w + gap
total_w = x - gap
inner = "\n  ".join(
    f'<g transform="translate({dx},0)" data-part="{part}">' + "".join(g.parts) + "</g>"
    for dx, g, part in parts)
disc_fig = (f'<svg id="l36fig1" viewBox="0 0 {total_w} {panels[0][0].h}" width="340" role="img" '
            f'aria-label="three parabolas showing a positive, zero and negative discriminant '
            f'crossing, touching and missing the x-axis">\n  {inner}\n</svg>')

# ---- figure 2: where the formula comes from geometrically -------------------
g = Graph(-2, 6, -6, 5, unit=25, pad_l=56, pad_r=52, pad_t=26, pad_b=44)
g.axes(xlabels=[-2, 6], ylabels=[-4, -2, 2, 4])
g.func(lambda x: x * x - 4 * x - 1, samples=160)      # roots 2 +- sqrt5
g.abline(0, 0, cls="g-aux")
g.line_seg((2, -5), (2, 4.4), cls="g-dash")
g.point(2 - 5 ** 0.5, 0, r=5)
g.point(2 + 5 ** 0.5, 0, r=5)
g.point(2, -5, r=5)
g.label(2, 4.4, "x = &minus;b/2a = 2", cls="g-meas", anchor="middle", dy=-8)
# the two roots are named under the figure rather than beside the points,
# which keeps them clear of the axis numbers
g.text_at(g.w / 2, g.h - 8, "the two roots: x = 2 &plusmn; &radic;5", cls="g-meas")
g.label(2, -5, "vertex", cls="g-grn", anchor="start", dx=9, dy=5)
g.line_seg((2, 0.55), (2 + 5 ** 0.5, 0.55), cls="g-arc")
g.line_seg((2 - 5 ** 0.5, 0.55), (2, 0.55), cls="g-arc")
g.label(3.1, 0.55, "&radic;5", cls="g-grn", anchor="middle", dy=-7)
g.label(0.9, 0.55, "&radic;5", cls="g-grn", anchor="middle", dy=-7)
axis_fig = g.svg("the parabola y equals x squared minus 4x minus 1 with its axis of symmetry at x "
                 "equals 2 and its two roots the same distance either side of it",
                 svg_id="l36fig2")

figures = f"""
<figure class="fig">
<div class="fig-title">Figure 1 &mdash; the discriminant is the parabola's height problem</div>
{disc_fig}
<div class="fig-legend">
  <span class="fig-chip" onclick="figHi(this,'l36fig1','pos')">positive &rarr; 2 real</span>
  <span class="fig-chip" onclick="figHi(this,'l36fig1','zero')">zero &rarr; 1 double</span>
  <span class="fig-chip" onclick="figHi(this,'l36fig1','neg')">negative &rarr; 2 complex</span>
</div>
<figcaption>Solving <code>ax&sup2; + bx + c = 0</code> asks where the parabola meets the
<i>x</i>-axis, and a parabola can only meet a line in three ways. The discriminant is the number that
tells you which picture you are in <b>before</b> you do any work, because it is exactly the quantity
under the square root: positive means a real &plusmn; to add and subtract, zero means the &plusmn;
adds nothing, and negative means the square root is imaginary.</figcaption>
</figure>

<figure class="fig">
<div class="fig-title">Figure 2 &mdash; reading the formula off the graph</div>
{axis_fig}
<figcaption>The quadratic formula is two pieces bolted together. The
<code>&minus;b/2a</code> part lands you on the <b>axis of symmetry</b> &mdash; here x = 2, straight
through the vertex. The <code>&radic;(b&sup2; &minus; 4ac) / 2a</code> part is how far you then step
<b>left and right</b> to reach the roots &mdash; here &radic;5 each way. That is why roots always come
in a symmetric pair, and why a zero discriminant collapses both of them onto the vertex itself.</figcaption>
</figure>
"""

practice = """
<p>Work each one on paper before revealing. Problems 2 and 5 are where sign errors usually happen.</p>

<div class="try-box"><h4>Problem 1</h4><div class="prob">Find the discriminant of 3x&sup2; &minus; 5x + 1 = 0 and describe the roots.</div>
<button class="reveal-btn" onclick="reveal(this)">Show Solution</button><div class="reveal-body">
<div class="solution-step"><span class="num">1</span><span class="math">a = 3, b = &minus;5, c = 1</span><span class="reason">Read the coefficients from standard form</span></div>
<div class="solution-step"><span class="num">2</span><span class="math">b&sup2; &minus; 4ac = 25 &minus; 12 = 13</span><span class="reason">(&minus;5)&sup2; = 25, and 4(3)(1) = 12</span></div>
<div class="answer-box">13 &gt; 0 and not a perfect square &rarr; two real, irrational roots</div>
<div class="check-box"><strong>Picture it:</strong> a positive discriminant is the left panel of Figure 1 &mdash; the parabola cuts the x-axis at two separate points.</div>
</div></div>

<div class="try-box"><h4>Problem 2</h4><div class="prob">Find the discriminant of 2x&sup2; + 3x + 5 = 0 and describe the roots.</div>
<button class="reveal-btn" onclick="reveal(this)">Show Solution</button><div class="reveal-body">
<div class="solution-step"><span class="num">1</span><span class="math">a = 2, b = 3, c = 5</span><span class="reason">Identify the coefficients</span></div>
<div class="solution-step"><span class="num">2</span><span class="math">b&sup2; &minus; 4ac = 9 &minus; 40 = &minus;31</span><span class="reason">4(2)(5) = 40</span></div>
<div class="answer-box">&minus;31 &lt; 0 &rarr; two complex roots; the parabola never reaches the x-axis</div>
<div class="check-box"><strong>Sanity check without algebra:</strong> a = 2 opens upward and c = 5 puts the y-intercept above the axis, so if the vertex also sits above the axis the curve can never cross. A negative discriminant is confirming exactly that.</div>
</div></div>

<div class="try-box"><h4>Problem 3</h4><div class="prob">Solve x&sup2; + 6x + 4 = 0 using the quadratic formula. Give exact answers.</div>
<button class="reveal-btn" onclick="reveal(this)">Show Solution</button><div class="reveal-body">
<div class="solution-step"><span class="num">1</span><span class="math">a = 1, b = 6, c = 4</span><span class="reason">Already in standard form</span></div>
<div class="solution-step"><span class="num">2</span><span class="math">x = (&minus;6 &plusmn; &radic;(36 &minus; 16)) / 2</span><span class="reason">Substitute into the formula</span></div>
<div class="solution-step"><span class="num">3</span><span class="math">x = (&minus;6 &plusmn; &radic;20) / 2</span><span class="reason">Simplify the discriminant</span></div>
<div class="solution-step"><span class="num">4</span><span class="math">x = (&minus;6 &plusmn; 2&radic;5) / 2</span><span class="reason">&radic;20 = &radic;(4 &middot; 5) = 2&radic;5</span></div>
<div class="solution-step"><span class="num">5</span><span class="math">x = &minus;3 &plusmn; &radic;5</span><span class="reason">Divide <b>every</b> term of the numerator by 2</span></div>
<div class="answer-box">x = &minus;3 + &radic;5 &asymp; &minus;0.76 or x = &minus;3 &minus; &radic;5 &asymp; &minus;5.24</div>
<div class="warning-box"><strong>The classic slip:</strong> cancelling the 2 into only one term, giving &minus;3 &plusmn; 2&radic;5. Both parts of the numerator must be divided, or neither.</div>
</div></div>

<div class="try-box"><h4>Problem 4</h4><div class="prob">Solve 4x&sup2; &minus; 12x + 9 = 0. What is special about the answer?</div>
<button class="reveal-btn" onclick="reveal(this)">Show Solution</button><div class="reveal-body">
<div class="solution-step"><span class="num">1</span><span class="math">b&sup2; &minus; 4ac = 144 &minus; 4(4)(9) = 144 &minus; 144 = 0</span><span class="reason">Check the discriminant first</span></div>
<div class="solution-step"><span class="num">2</span><span class="math">x = (12 &plusmn; 0) / 8 = 3/2</span><span class="reason">The &plusmn; adds nothing when the discriminant is 0</span></div>
<div class="answer-box">x = 3/2, a single repeated (double) root</div>
<div class="check-box"><strong>Why it repeats:</strong> 4x&sup2; &minus; 12x + 9 = (2x &minus; 3)&sup2;, a perfect square. This is the middle panel of Figure 1 &mdash; the vertex is sitting exactly on the x-axis, so both roots land on the same point.</div>
</div></div>

<div class="try-box"><h4>Problem 5</h4><div class="prob">Solve 2x&sup2; &minus; 4x + 5 = 0. Give exact answers.</div>
<button class="reveal-btn" onclick="reveal(this)">Show Solution</button><div class="reveal-body">
<div class="solution-step"><span class="num">1</span><span class="math">b&sup2; &minus; 4ac = 16 &minus; 40 = &minus;24</span><span class="reason">Negative, so expect complex roots</span></div>
<div class="solution-step"><span class="num">2</span><span class="math">x = (4 &plusmn; &radic;(&minus;24)) / 4</span><span class="reason">&minus;b = &minus;(&minus;4) = 4, and 2a = 4</span></div>
<div class="solution-step"><span class="num">3</span><span class="math">&radic;(&minus;24) = &radic;(&minus;1 &middot; 4 &middot; 6) = 2i&radic;6</span><span class="reason">Pull out &radic;(&minus;1) = i and &radic;4 = 2</span></div>
<div class="solution-step"><span class="num">4</span><span class="math">x = (4 &plusmn; 2i&radic;6) / 4 = (2 &plusmn; i&radic;6) / 2</span><span class="reason">Divide every term by the common factor 2</span></div>
<div class="answer-box">x = (2 + i&radic;6)/2 or x = (2 &minus; i&radic;6)/2</div>
<div class="warning-box"><strong>Two traps in one problem:</strong> writing &minus;b as &minus;4 when b is already negative, and forgetting that &radic;(&minus;24) is not &minus;&radic;24. The minus sign lives inside the radical and becomes an <i>i</i>.</div>
</div></div>

<div class="try-box"><h4>Problem 6</h4><div class="prob">For what value of k does x&sup2; + kx + 9 = 0 have exactly one real solution?</div>
<button class="reveal-btn" onclick="reveal(this)">Show Solution</button><div class="reveal-body">
<div class="solution-step"><span class="num">1</span><span class="math">one real solution &rarr; b&sup2; &minus; 4ac = 0</span><span class="reason">A double root means a zero discriminant</span></div>
<div class="solution-step"><span class="num">2</span><span class="math">k&sup2; &minus; 4(1)(9) = 0</span><span class="reason">Substitute a = 1, b = k, c = 9</span></div>
<div class="solution-step"><span class="num">3</span><span class="math">k&sup2; = 36 &rarr; k = &plusmn;6</span><span class="reason">Take both square roots</span></div>
<div class="answer-box">k = 6 or k = &minus;6</div>
<div class="check-box"><strong>Check both:</strong> k = 6 gives x&sup2; + 6x + 9 = (x + 3)&sup2; with the double root x = &minus;3, and k = &minus;6 gives (x &minus; 3)&sup2; with the double root x = 3. Forgetting the negative root loses half the marks.</div>
</div></div>
"""
