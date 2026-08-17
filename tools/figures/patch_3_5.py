"""Key Figures + Try It Yourself for lesson 3-5, Completing the Square."""
import sys
sys.path.insert(0, __file__.rsplit('/', 1)[0])
from graphsvg import Graph

nav = [("concepts", "Concepts"), ("figures", "Key Figures"), ("examples", "Examples"),
       ("grapher", "Interactive Grapher"), ("practice", "Try It Yourself"),
       ("quiz", "Practice Quiz")]

# ---- Figure 1: the area model -- why it is called "completing the square" ----
BS, SS, X0, Y0 = 100, 50, 46, 34          # big side, small side, origin of the diagram
area_fig = f"""<svg viewBox="0 0 340 244" width="340" role="img" aria-label="an area diagram showing x squared plus 6x needing a 3 by 3 corner square to complete a full square of side x plus 3">
  <rect x="{X0}" y="{Y0}" width="{BS}" height="{BS}" fill="var(--sl-blue-soft)" stroke="var(--sl-blue)" stroke-width="2"/>
  <rect x="{X0+BS}" y="{Y0}" width="{SS}" height="{BS}" fill="var(--sl-blue-soft)" stroke="var(--sl-blue)" stroke-width="2"/>
  <rect x="{X0}" y="{Y0+BS}" width="{BS}" height="{SS}" fill="var(--sl-blue-soft)" stroke="var(--sl-blue)" stroke-width="2"/>
  <rect x="{X0+BS}" y="{Y0+BS}" width="{SS}" height="{SS}" fill="var(--sl-orange-soft)" stroke="var(--sl-orange)" stroke-width="2" stroke-dasharray="6 4"/>
  <text class="g-lbl" x="{X0+BS/2}" y="26" text-anchor="middle">x</text>
  <text class="g-meas" x="{X0+BS+SS/2}" y="26" text-anchor="middle">3</text>
  <text class="g-lbl" x="{X0-10}" y="{Y0+BS/2+5}" text-anchor="end">x</text>
  <text class="g-meas" x="{X0-10}" y="{Y0+BS+SS/2+5}" text-anchor="end">3</text>
  <text class="g-lbl" x="{X0+BS/2}" y="{Y0+BS/2+6}" text-anchor="middle">x&sup2;</text>
  <text class="g-lbl" x="{X0+BS+SS/2}" y="{Y0+BS/2+6}" text-anchor="middle">3x</text>
  <text class="g-lbl" x="{X0+BS/2}" y="{Y0+BS+SS/2+6}" text-anchor="middle">3x</text>
  <text class="g-meas" x="{X0+BS+SS/2}" y="{Y0+BS+SS/2+5}" text-anchor="middle">9</text>
  <text class="g-lbl-sm" x="212" y="72" text-anchor="start">The three blue pieces</text>
  <text class="g-meas-b" x="212" y="90" text-anchor="start">x&sup2; + 3x + 3x = x&sup2; + 6x</text>
  <text class="g-lbl-sm" x="212" y="118" text-anchor="start">The dashed corner you</text>
  <text class="g-lbl-sm" x="212" y="133" text-anchor="start">must add is (6/2)&sup2; =</text>
  <text class="g-meas" x="212" y="151" text-anchor="start">9</text>
  <text class="g-lbl-sm" x="212" y="179" text-anchor="start">Now it is a full square</text>
  <text class="g-grn" x="212" y="197" text-anchor="start">(x + 3)&sup2;</text>
  <text class="g-lbl-sm" x="{X0+(BS+SS)/2}" y="{Y0+BS+SS+24}" text-anchor="middle">side = x + 3</text>
</svg>"""

# ---- Figure 2: vertex form is just a shift of y = x^2 ------------------------
g = Graph(-3, 6, -6, 5, unit=24, pad_l=42, pad_r=44, pad_t=26, pad_b=42)
g.axes(xlabels=[-2, 2, 4, 6], ylabels=[-4, -2, 2, 4])
g.func(lambda x: x * x, cls="g-aux", samples=160)
g.func(lambda x: (x - 2) ** 2 - 5, samples=160)
g.point(0, 0, cls="g-pt-o", r=4.6)
g.point(2, -5, r=5.4)
g.label(2, -5, "(2, &minus;5)", cls="g-grn", anchor="start", dx=10, dy=5)
g.line_seg((0, 0), (2, 0), cls="g-dash")
g.line_seg((2, 0), (2, -5), cls="g-dash")
g.label(1, 0, "h = 2 right", cls="g-meas", anchor="middle", dy=-8)
g.label(2, -2.5, "k = 5 down", cls="g-meas", anchor="start", dx=8)
g.label(-2.6, 4.2, "y = x&sup2;", cls="g-lbl-sm", anchor="start")
g.text_at(g.w / 2, g.h - 8, "y = (x &minus; 2)&sup2; &minus; 5  is the same curve as  y = x&sup2; &minus; 4x &minus; 1",
          cls="g-meas-b")
shift_fig = g.svg("the parabola y equals x squared shown dashed, and the same parabola shifted two "
                  "right and five down to give the vertex at 2, negative 5", svg_id="l35fig2")

figures = f"""
<figure class="fig">
<div class="fig-title">Figure 1 &mdash; why it is called <i>completing</i> the square</div>
{area_fig}
<figcaption>The name is literal. Lay out <code>x&sup2; + 6x</code> as area: one x-by-x square and the
6x split into two 3-by-x strips, one on each side. That shape is a square with a bite missing from the
corner, and the missing piece is exactly 3 by 3 = <b>9</b>. Adding it finishes the square, whose side is
<code>x + 3</code>. This is where <code>(b/2)&sup2;</code> comes from: you halve b so the strips are
equal, and the corner is that half squared.</figcaption>
</figure>

<figure class="fig">
<div class="fig-title">Figure 2 &mdash; vertex form tells you where the parabola moved</div>
{shift_fig}
<figcaption>Completing the square converts <code>y = x&sup2; &minus; 4x &minus; 1</code> into
<code>y = (x &minus; 2)&sup2; &minus; 5</code>, and the second version is readable at a glance: take the
basic parabola <code>y = x&sup2;</code> and slide it <b>2 right</b> and <b>5 down</b>. That lands the
vertex at (2, &minus;5). Watch the sign trap &mdash; <code>(x &minus; 2)&sup2;</code> moves the curve to
the <i>right</i>, and the <code>&minus;5</code> sitting outside moves it straight down.</figcaption>
</figure>
"""

practice = """
<p>Work each one on paper first, then reveal. Problems 4 and 6 are the full method &mdash; the rest build up to it.</p>

<div class="try-box"><h4>Problem 1</h4><div class="prob">Solve (x &minus; 3)&sup2; = 49.</div>
<button class="reveal-btn" onclick="reveal(this)">Show Solution</button><div class="reveal-body">
<div class="solution-step"><span class="num">1</span><span class="math">x &minus; 3 = &plusmn;7</span><span class="reason">Square Root Property &mdash; keep the &plusmn;</span></div>
<div class="solution-step"><span class="num">2</span><span class="math">x = 3 + 7 = 10 &nbsp;or&nbsp; x = 3 &minus; 7 = &minus;4</span><span class="reason">Add 3 to each side, taking both branches</span></div>
<div class="answer-box">x = 10 or x = &minus;4</div>
<div class="check-box"><strong>Check:</strong> (10 &minus; 3)&sup2; = 49 &#10003; and (&minus;4 &minus; 3)&sup2; = (&minus;7)&sup2; = 49 &#10003;</div>
</div></div>

<div class="try-box"><h4>Problem 2</h4><div class="prob">Solve x&sup2; = 45. Give the exact answer in simplest radical form.</div>
<button class="reveal-btn" onclick="reveal(this)">Show Solution</button><div class="reveal-body">
<div class="solution-step"><span class="num">1</span><span class="math">x = &plusmn;&radic;45</span><span class="reason">Square Root Property</span></div>
<div class="solution-step"><span class="num">2</span><span class="math">&radic;45 = &radic;(9 &middot; 5) = 3&radic;5</span><span class="reason">Pull out the largest perfect square factor</span></div>
<div class="answer-box">x = &plusmn;3&radic;5 &asymp; &plusmn;6.71</div>
<div class="warning-box"><strong>Do not write &radic;45 &asymp; 6.7 and stop</strong> when the question asks for an exact answer. 3&radic;5 is exact; 6.71 is rounded.</div>
</div></div>

<div class="try-box"><h4>Problem 3</h4><div class="prob">What number completes the square for x&sup2; + 10x, and what does the expression factor to?</div>
<button class="reveal-btn" onclick="reveal(this)">Show Solution</button><div class="reveal-body">
<div class="solution-step"><span class="num">1</span><span class="math">b = 10, so b/2 = 5</span><span class="reason">Halve the coefficient of x</span></div>
<div class="solution-step"><span class="num">2</span><span class="math">(b/2)&sup2; = 25</span><span class="reason">Square that half &mdash; this is the corner piece in Figure 1</span></div>
<div class="answer-box">Add 25: x&sup2; + 10x + 25 = (x + 5)&sup2;</div>
<div class="check-box"><strong>Check by expanding:</strong> (x + 5)&sup2; = x&sup2; + 10x + 25 &#10003;. Notice the number inside the bracket is always b/2, never b.</div>
</div></div>

<div class="try-box"><h4>Problem 4</h4><div class="prob">Solve x&sup2; &minus; 6x + 2 = 0 by completing the square. Give exact answers.</div>
<button class="reveal-btn" onclick="reveal(this)">Show Solution</button><div class="reveal-body">
<div class="solution-step"><span class="num">1</span><span class="math">x&sup2; &minus; 6x = &minus;2</span><span class="reason">Move the constant to the right side</span></div>
<div class="solution-step"><span class="num">2</span><span class="math">(&minus;6/2)&sup2; = 9</span><span class="reason">Find the completing number</span></div>
<div class="solution-step"><span class="num">3</span><span class="math">x&sup2; &minus; 6x + 9 = &minus;2 + 9</span><span class="reason">Add 9 to <b>both</b> sides &mdash; this is the step people forget</span></div>
<div class="solution-step"><span class="num">4</span><span class="math">(x &minus; 3)&sup2; = 7</span><span class="reason">Factor the perfect square</span></div>
<div class="solution-step"><span class="num">5</span><span class="math">x &minus; 3 = &plusmn;&radic;7</span><span class="reason">Square Root Property</span></div>
<div class="answer-box">x = 3 &plusmn; &radic;7, so x &asymp; 5.65 or x &asymp; 0.35</div>
<div class="warning-box"><strong>Adding to one side only</strong> changes the equation into a different one. Whatever completes the square on the left must also be added on the right.</div>
</div></div>

<div class="try-box"><h4>Problem 5</h4><div class="prob">Write y = x&sup2; + 8x + 11 in vertex form and state the vertex.</div>
<button class="reveal-btn" onclick="reveal(this)">Show Solution</button><div class="reveal-body">
<div class="solution-step"><span class="num">1</span><span class="math">(8/2)&sup2; = 16</span><span class="reason">The completing number</span></div>
<div class="solution-step"><span class="num">2</span><span class="math">y = (x&sup2; + 8x + 16) &minus; 16 + 11</span><span class="reason">Add 16 <b>and</b> subtract 16 &mdash; here we cannot add to &ldquo;both sides&rdquo;, so we keep the total unchanged</span></div>
<div class="solution-step"><span class="num">3</span><span class="math">y = (x + 4)&sup2; &minus; 5</span><span class="reason">Factor, then combine &minus;16 + 11</span></div>
<div class="answer-box">y = (x + 4)&sup2; &minus; 5, vertex (&minus;4, &minus;5), a minimum since a &gt; 0</div>
<div class="check-box"><strong>Two checks:</strong> expanding gives x&sup2; + 8x + 16 &minus; 5 = x&sup2; + 8x + 11 &#10003;, and the formula x = &minus;b/2a = &minus;8/2 = &minus;4 confirms the vertex's x-coordinate. Note the vertex is (&minus;4, &minus;5), not (4, &minus;5) &mdash; the bracket reads (x &minus; h).</div>
</div></div>

<div class="try-box"><h4>Problem 6</h4><div class="prob">Write y = 2x&sup2; &minus; 12x + 7 in vertex form and state the vertex. (Careful &mdash; a &ne; 1.)</div>
<button class="reveal-btn" onclick="reveal(this)">Show Solution</button><div class="reveal-body">
<div class="solution-step"><span class="num">1</span><span class="math">y = 2(x&sup2; &minus; 6x) + 7</span><span class="reason">Factor 2 out of the x-terms only</span></div>
<div class="solution-step"><span class="num">2</span><span class="math">(&minus;6/2)&sup2; = 9</span><span class="reason">Complete the square <b>inside</b> the bracket</span></div>
<div class="solution-step"><span class="num">3</span><span class="math">y = 2(x&sup2; &minus; 6x + 9) &minus; 18 + 7</span><span class="reason">Adding 9 inside a bracket multiplied by 2 really adds 18, so subtract 18 outside</span></div>
<div class="solution-step"><span class="num">4</span><span class="math">y = 2(x &minus; 3)&sup2; &minus; 11</span><span class="reason">Factor and combine</span></div>
<div class="answer-box">y = 2(x &minus; 3)&sup2; &minus; 11, vertex (3, &minus;11), a minimum</div>
<div class="warning-box"><strong>The a &ne; 1 trap:</strong> subtracting only 9 instead of 18. The 9 sits inside a bracket that is multiplied by 2, so it contributes 2 &times; 9 = 18 to the expression, and 18 is what must come back out. Check by expanding: 2(x&sup2; &minus; 6x + 9) &minus; 11 = 2x&sup2; &minus; 12x + 18 &minus; 11 = 2x&sup2; &minus; 12x + 7 &#10003;</div>
</div></div>
"""
