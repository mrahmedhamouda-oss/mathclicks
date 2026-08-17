"""Key Figures + Try It Yourself for lesson 5-2, Solving Polynomial Equations Algebraically."""
import sys
sys.path.insert(0, __file__.rsplit('/', 1)[0])
from graphsvg import Graph

nav = [("concepts", "Concepts"), ("figures", "Key Figures"),
       ("examples", "Step-by-Step Examples"), ("practice", "Try It Yourself"),
       ("summary", "Summary"), ("quiz", "Practice Quiz")]

# ---- Figure 1: pick your factoring technique by counting terms --------------
BOX = ('fill="var(--sl-surface-3)" stroke="var(--sl-line-2)" stroke-width="1.5"')
BLUE = ('fill="var(--sl-blue-soft)" stroke="var(--sl-blue)" stroke-width="1.6"')
GREEN = ('fill="var(--sl-green-soft)" stroke="var(--sl-green)" stroke-width="1.6"')

rows = [
    ("2 terms", ["GCF: 3x&sup3; &minus; 12x = 3x(x&sup2; &minus; 4)",
                 "difference of squares: a&sup2; &minus; b&sup2;",
                 "sum/difference of cubes: a&sup3; &plusmn; b&sup3;"]),
    ("3 terms", ["ordinary trinomial: x&sup2; + 5x + 6",
                 "quadratic form: x&#8308; &minus; 5x&sup2; + 4 &rarr; let u = x&sup2;",
                 "perfect square: a&sup2; &plusmn; 2ab + b&sup2;"]),
    ("4 terms", ["grouping: pair them up and factor each pair",
                 "then factor out the common bracket"]),
]
parts = [
    f'<rect x="96" y="6" width="150" height="30" rx="8" {BOX}/>',
    '<text class="g-lbl-sm" x="171" y="25" text-anchor="middle">Always take out the GCF first</text>',
    '<line class="g-line-thin" x1="171" y1="36" x2="171" y2="50"/>',
    '<rect x="80" y="50" width="182" height="28" rx="8" ' + BLUE + '/>',
    '<text class="g-lbl-sm" x="171" y="68" text-anchor="middle">Now count the terms</text>',
]
y = 92
for label, opts in rows:
    h = 20 + 16 * len(opts)
    parts.append(f'<line class="g-line-thin" x1="171" y1="{y-14}" x2="171" y2="{y}"/>')
    parts.append(f'<rect x="6" y="{y}" width="70" height="{h}" rx="8" {GREEN}/>')
    parts.append(f'<text class="g-meas" x="41" y="{y + h/2 + 5}" text-anchor="middle">{label}</text>')
    parts.append(f'<rect x="82" y="{y}" width="252" height="{h}" rx="8" {BOX}/>')
    for i, o in enumerate(opts):
        parts.append(f'<text class="g-lbl-sm" x="94" y="{y + 20 + i*16}" text-anchor="start">{o}</text>')
    y += h + 14
flow_fig = (f'<svg viewBox="0 0 340 {y}" width="340" role="img" aria-label="a flowchart choosing a '
            f'factoring technique by the number of terms">\n  ' + "\n  ".join(parts) + '\n</svg>')

# ---- Figure 2: factored form and the x-intercepts are the same information --
g = Graph(-3, 3, -5, 5, unit=34, pad_l=38, pad_r=38, pad_t=26, pad_b=56)
g.axes(xlabels=[-2, 2], ylabels=[-4, -2, 2, 4])
g.func(lambda x: x ** 3 - 4 * x, samples=220)
for r in (-2, 0, 2):
    g.point(r, 0, r=5.4)
g.label(-2, 0, "x = &minus;2", cls="g-meas", anchor="middle", dy=-12)
g.label(0, 0, "x = 0", cls="g-meas", anchor="start", dx=7, dy=-11)
g.label(2, 0, "x = 2", cls="g-meas", anchor="middle", dy=-12)
g.text_at(g.w / 2, g.h - 34, "x&sup3; &minus; 4x = x(x &minus; 2)(x + 2)", cls="g-meas-b")
g.text_at(g.w / 2, g.h - 18, "three factors &rarr; three zeros &rarr; three x-intercepts",
          cls="g-lbl-sm")
roots_fig = g.svg("the cubic y equals x cubed minus 4x crossing the x-axis at negative 2, 0 and 2")

figures = f"""
<figure class="fig">
<div class="fig-title">Figure 1 &mdash; count the terms, then pick the tool</div>
{flow_fig}
<figcaption>Factoring feels like guesswork until you notice that the <b>number of terms</b> narrows your
options to two or three. Pull out the greatest common factor first &mdash; always &mdash; because doing
so often turns a hard expression into one of the standard patterns. Then count what is left and choose
from the matching row.</figcaption>
</figure>

<figure class="fig">
<div class="fig-title">Figure 2 &mdash; why factoring solves the equation</div>
{roots_fig}
<figcaption>Factoring works because of the <b>Zero Product Property</b>: if a product is 0 then one of
its factors must be 0. So <code>x(x &minus; 2)(x + 2) = 0</code> breaks into three tiny equations, and
each one gives a zero. On the graph those zeros are exactly the points where the curve meets the
<i>x</i>-axis. Factored form and <i>x</i>-intercepts are two ways of writing the same fact.</figcaption>
</figure>
"""

practice = """
<p>Factor and solve each one, then reveal. Problem 4 is quadratic form and problem 6 has a trap in it.</p>

<div class="try-box"><h4>Problem 1</h4><div class="prob">Solve 3x&sup3; &minus; 12x = 0.</div>
<button class="reveal-btn" onclick="reveal(this)">Show Solution</button><div class="reveal-body">
<div class="solution-step"><span class="num">1</span><span class="math">3x(x&sup2; &minus; 4) = 0</span><span class="reason">GCF first &mdash; take out 3x</span></div>
<div class="solution-step"><span class="num">2</span><span class="math">3x(x &minus; 2)(x + 2) = 0</span><span class="reason">x&sup2; &minus; 4 is a difference of squares</span></div>
<div class="solution-step"><span class="num">3</span><span class="math">x = 0, x = 2, x = &minus;2</span><span class="reason">Zero Product Property on each factor</span></div>
<div class="answer-box">x = &minus;2, 0 or 2</div>
<div class="warning-box"><strong>Never divide both sides by x</strong> to &ldquo;simplify&rdquo; &mdash; that throws away the solution x = 0. Factor it out instead and keep it.</div>
</div></div>

<div class="try-box"><h4>Problem 2</h4><div class="prob">Factor completely: x&sup3; &minus; 27.</div>
<button class="reveal-btn" onclick="reveal(this)">Show Solution</button><div class="reveal-body">
<div class="solution-step"><span class="num">1</span><span class="math">x&sup3; &minus; 3&sup3;</span><span class="reason">Two terms, both perfect cubes &rarr; difference of cubes</span></div>
<div class="solution-step"><span class="num">2</span><span class="math">a&sup3; &minus; b&sup3; = (a &minus; b)(a&sup2; + ab + b&sup2;)</span><span class="reason">Standard pattern with a = x, b = 3</span></div>
<div class="answer-box">(x &minus; 3)(x&sup2; + 3x + 9)</div>
<div class="check-box"><strong>Remembering the signs:</strong> the binomial copies the sign of the original, and the trinomial's middle term takes the <i>opposite</i>&hellip; no &mdash; simpler and safer: <b>S</b>ame, <b>O</b>pposite, <b>A</b>lways <b>P</b>ositive. Binomial sign is the same (&minus;), middle term is opposite (+3x), last term always positive (+9).</div>
</div></div>

<div class="try-box"><h4>Problem 3</h4><div class="prob">Factor by grouping: x&sup3; + 2x&sup2; &minus; 9x &minus; 18.</div>
<button class="reveal-btn" onclick="reveal(this)">Show Solution</button><div class="reveal-body">
<div class="solution-step"><span class="num">1</span><span class="math">(x&sup3; + 2x&sup2;) + (&minus;9x &minus; 18)</span><span class="reason">Four terms &rarr; pair them up</span></div>
<div class="solution-step"><span class="num">2</span><span class="math">x&sup2;(x + 2) &minus; 9(x + 2)</span><span class="reason">Factor each pair &mdash; both give (x + 2)</span></div>
<div class="solution-step"><span class="num">3</span><span class="math">(x + 2)(x&sup2; &minus; 9)</span><span class="reason">Factor out the common bracket</span></div>
<div class="solution-step"><span class="num">4</span><span class="math">(x + 2)(x &minus; 3)(x + 3)</span><span class="reason">x&sup2; &minus; 9 factors further &mdash; go all the way</span></div>
<div class="answer-box">(x + 2)(x &minus; 3)(x + 3)</div>
<div class="check-box"><strong>If the two brackets do not match</strong> after step 2, try pairing differently, or factor &minus;1 out of the second pair. Matching brackets are the signal that grouping is working.</div>
</div></div>

<div class="try-box"><h4>Problem 4</h4><div class="prob">Solve x&#8308; &minus; 13x&sup2; + 36 = 0.</div>
<button class="reveal-btn" onclick="reveal(this)">Show Solution</button><div class="reveal-body">
<div class="solution-step"><span class="num">1</span><span class="math">let u = x&sup2;, so u&sup2; &minus; 13u + 36 = 0</span><span class="reason">Quadratic form &mdash; the exponents 4 and 2 are in a 2:1 ratio</span></div>
<div class="solution-step"><span class="num">2</span><span class="math">(u &minus; 4)(u &minus; 9) = 0 &rarr; u = 4 or 9</span><span class="reason">Factor the ordinary trinomial</span></div>
<div class="solution-step"><span class="num">3</span><span class="math">x&sup2; = 4 &rarr; x = &plusmn;2</span><span class="reason">Substitute back &mdash; <b>do not stop at u</b></span></div>
<div class="solution-step"><span class="num">4</span><span class="math">x&sup2; = 9 &rarr; x = &plusmn;3</span><span class="reason">And the second branch</span></div>
<div class="answer-box">x = &minus;3, &minus;2, 2 or 3 &mdash; four solutions, as a degree-4 equation allows</div>
<div class="warning-box"><strong>Two traps:</strong> answering u = 4, 9 and forgetting to convert back to x, and forgetting the &plusmn; on each square root. Either one halves your marks.</div>
</div></div>

<div class="try-box"><h4>Problem 5</h4><div class="prob">Solve x&sup3; = 4x&sup2; + 21x.</div>
<button class="reveal-btn" onclick="reveal(this)">Show Solution</button><div class="reveal-body">
<div class="solution-step"><span class="num">1</span><span class="math">x&sup3; &minus; 4x&sup2; &minus; 21x = 0</span><span class="reason">Get everything to one side &mdash; the Zero Product Property needs a 0</span></div>
<div class="solution-step"><span class="num">2</span><span class="math">x(x&sup2; &minus; 4x &minus; 21) = 0</span><span class="reason">GCF is x</span></div>
<div class="solution-step"><span class="num">3</span><span class="math">x(x &minus; 7)(x + 3) = 0</span><span class="reason">Factor the trinomial: &minus;7 &times; 3 = &minus;21 and &minus;7 + 3 = &minus;4</span></div>
<div class="answer-box">x = 0, x = 7 or x = &minus;3</div>
<div class="check-box"><strong>Check x = 7:</strong> 343 on the left, and 4(49) + 21(7) = 196 + 147 = 343 on the right &#10003;</div>
</div></div>

<div class="try-box"><h4>Problem 6</h4><div class="prob">Solve x&#8308; &minus; 16 = 0 over the real numbers, then over the complex numbers.</div>
<button class="reveal-btn" onclick="reveal(this)">Show Solution</button><div class="reveal-body">
<div class="solution-step"><span class="num">1</span><span class="math">(x&sup2; &minus; 4)(x&sup2; + 4) = 0</span><span class="reason">Difference of squares with a = x&sup2;, b = 4</span></div>
<div class="solution-step"><span class="num">2</span><span class="math">(x &minus; 2)(x + 2)(x&sup2; + 4) = 0</span><span class="reason">x&sup2; &minus; 4 factors again; x&sup2; + 4 does <b>not</b> factor over the reals</span></div>
<div class="solution-step"><span class="num">3</span><span class="math">x&sup2; = &minus;4 &rarr; x = &plusmn;2i</span><span class="reason">The remaining factor gives complex roots</span></div>
<div class="answer-box">Real: x = &plusmn;2. Complex: x = 2, &minus;2, 2i, &minus;2i &mdash; four roots in total</div>
<div class="warning-box"><strong>A sum of squares is not factorable over the reals.</strong> x&sup2; + 4 is not (x + 2)&sup2;, and it is not (x + 2)(x &minus; 2). Only the <i>difference</i> of squares factors. Over the complex numbers it does split, into (x + 2i)(x &minus; 2i).</div>
</div></div>
"""
