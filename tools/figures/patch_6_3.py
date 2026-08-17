"""Key Figures + Try It Yourself for lesson 6-3, nth Roots and Rational Exponents."""
import sys
sys.path.insert(0, __file__.rsplit('/', 1)[0])
from graphsvg import Graph

nav = [("concepts", "Concepts"), ("figures", "Key Figures"),
       ("examples", "Step-by-Step Examples"), ("practice", "Try It Yourself"),
       ("summary", "Summary"), ("quiz", "Practice Quiz")]

# ---- Figure 1: anatomy of a radical, and the rational-exponent translation ---
CALL = 'stroke="var(--sl-orange)" stroke-width="1.4" fill="none"'
anatomy_fig = f"""<svg viewBox="0 0 340 228" width="340" role="img" aria-label="a labelled diagram of the parts of a radical expression and its rational exponent form">
  <text x="106" y="72" text-anchor="middle" style="font-size:44px;fill:var(--sl-navy);font-family:'Times New Roman',serif">&radic;</text>
  <text x="86" y="52" text-anchor="middle" style="font-size:19px;fill:var(--sl-orange);font-weight:700;font-family:system-ui">3</text>
  <line class="g-line" x1="120" y1="40" x2="188" y2="40"/>
  <text x="154" y="70" text-anchor="middle" style="font-size:28px;fill:var(--sl-navy);font-family:'Times New Roman',serif">64</text>
  <path d="M 86 34 Q 74 16 42 16" {CALL}/>
  <text class="g-meas" x="38" y="20" text-anchor="end">index</text>
  <text class="g-lbl-sm" x="38" y="34" text-anchor="end">which root</text>
  <path d="M 154 80 Q 154 104 200 104" {CALL}/>
  <text class="g-meas" x="206" y="100" text-anchor="start">radicand</text>
  <text class="g-lbl-sm" x="206" y="114" text-anchor="start">what is underneath</text>
  <path d="M 112 84 Q 100 118 66 118" {CALL}/>
  <text class="g-meas" x="60" y="122" text-anchor="end">radical symbol</text>
  <line class="g-line-thin" x1="24" y1="146" x2="316" y2="146"/>
  <text class="g-lbl-sm" x="170" y="168" text-anchor="middle">the same thing written as a power:</text>
  <text class="g-meas-b" x="170" y="192" text-anchor="middle">&#8731;64 = 64^(1/3) = 4</text>
  <text class="g-grn" x="170" y="214" text-anchor="middle">64^(2/3) = (&#8731;64)&sup2; = 16</text>
</svg>"""

# ---- Figure 2: why even and odd indices behave differently ------------------
def root_panel(cube):
    """A tall narrow panel; the detailed reading lives in the figcaption."""
    g = Graph(-2.6, 2.6, -9, 9, unit=11, pad_l=34, pad_r=34, pad_t=32, pad_b=44, grid_step=0)
    g.axes()
    if cube:
        g.func(lambda x: x ** 3, samples=200)
        g.abline(0, 8, cls="g-dash")
        g.abline(0, -8, cls="g-dash")
        g.point(2, 8, r=4.2)
        g.point(-2, -8, r=4.2)
        g.text_at(g.w / 2, 14, "odd index", cls="g-meas-b")
        g.text_at(g.w / 2, 27, "y = x&sup3;", cls="g-lbl-sm")
        g.text_at(g.w / 2, g.h - 28, "each height once", cls="g-lbl-sm")
        g.text_at(g.w / 2, g.h - 12, "&#8731;8 = 2, &#8731;&minus;8 = &minus;2", cls="g-grn")
    else:
        g.func(lambda x: x * x, samples=200)
        g.abline(0, 4, cls="g-dash")
        g.abline(0, -4, cls="g-dash")
        g.point(2, 4, r=4.2)
        g.point(-2, 4, r=4.2)
        g.text_at(g.w / 2, 14, "even index", cls="g-meas-b")
        g.text_at(g.w / 2, 27, "y = x&sup2;", cls="g-lbl-sm")
        g.text_at(g.w / 2, g.h - 28, "twice, or never", cls="g-lbl-sm")
        g.text_at(g.w / 2, g.h - 12, "&radic;4 = 2, &radic;&minus;4 none", cls="g-meas")
    return g


a, b = root_panel(False), root_panel(True)
total_w = a.w + b.w + 16
parity_fig = (f'<svg viewBox="0 0 {total_w} {a.h}" width="340" role="img" aria-label="the parabola y '
              f'equals x squared beside the cubic y equals x cubed, showing that an even index gives '
              f'two roots or none while an odd index always gives exactly one">\n  '
              f'<g>{"".join(a.parts)}</g>\n  '
              f'<g transform="translate({a.w + 16},0)">{"".join(b.parts)}</g>\n</svg>')

figures = f"""
<figure class="fig">
<div class="fig-title">Figure 1 &mdash; the parts, and the translation into exponents</div>
{anatomy_fig}
<figcaption>Three words worth getting straight, because questions use them: the <b>index</b> says which
root to take, the <b>radicand</b> is what sits underneath, and the whole thing is a
<b>radical</b>. Every radical is also a power &mdash; the index becomes the <i>denominator</i> of a
fractional exponent. Once you see <code>b^(x/y)</code> as &ldquo;the <i>y</i>th root, raised to the
<i>x</i>&rdquo;, the exponent rules you already know take over.</figcaption>
</figure>

<figure class="fig">
<div class="fig-title">Figure 2 &mdash; why even and odd indices behave so differently</div>
{parity_fig}
<figcaption>The whole real-<i>n</i>th-root table comes from these two shapes. An <b>even</b> power sends
both signs to a positive output, so its graph is a bowl: a positive target is hit twice (hence
&plusmn;, and the need to pick a <b>principal</b> root) and a negative target is never hit at all. An
<b>odd</b> power keeps the sign of its input, so its graph rises through every height exactly once
&mdash; one real root, always, positive or negative.</figcaption>
</figure>
"""

practice = """
<p>Evaluate or simplify each one, then reveal. Problems 4 and 5 are the absolute-value and
negative-exponent traps.</p>

<div class="try-box"><h4>Problem 1</h4><div class="prob">Evaluate 81^(1/4) and 81^(3/4).</div>
<button class="reveal-btn" onclick="reveal(this)">Show Solution</button><div class="reveal-body">
<div class="solution-step"><span class="num">1</span><span class="math">81^(1/4) = &#8308;&radic;81 = 3</span><span class="reason">Because 3&#8308; = 81</span></div>
<div class="solution-step"><span class="num">2</span><span class="math">81^(3/4) = (&#8308;&radic;81)&sup3;</span><span class="reason">Denominator = the root, numerator = the power</span></div>
<div class="solution-step"><span class="num">3</span><span class="math">= 3&sup3; = 27</span><span class="reason">Take the root first, then the power &mdash; far smaller numbers</span></div>
<div class="answer-box">81^(1/4) = 3 and 81^(3/4) = 27</div>
<div class="check-box"><strong>Root first, always.</strong> Doing the power first means computing 81&sup3; = 531,441 and then its fourth root. Same answer, much harder arithmetic.</div>
</div></div>

<div class="try-box"><h4>Problem 2</h4><div class="prob">Write &#8309;&radic;(x&sup3;) using a rational exponent, and write y^(2/7) as a radical.</div>
<button class="reveal-btn" onclick="reveal(this)">Show Solution</button><div class="reveal-body">
<div class="solution-step"><span class="num">1</span><span class="math">&#8309;&radic;(x&sup3;) = x^(3/5)</span><span class="reason">Index 5 becomes the denominator, power 3 the numerator</span></div>
<div class="solution-step"><span class="num">2</span><span class="math">y^(2/7) = &#8311;&radic;(y&sup2;)</span><span class="reason">Denominator 7 becomes the index, numerator 2 stays as the power</span></div>
<div class="answer-box">x^(3/5) and &#8311;&radic;(y&sup2;)</div>
<div class="warning-box"><strong>Do not swap them.</strong> x^(3/5) is the fifth root cubed, not the cube root to the fifth. The rule is index &rarr; denominator, every time.</div>
</div></div>

<div class="try-box"><h4>Problem 3</h4><div class="prob">Evaluate &#8731;(&minus;125) and &#8308;&radic;(&minus;16).</div>
<button class="reveal-btn" onclick="reveal(this)">Show Solution</button><div class="reveal-body">
<div class="solution-step"><span class="num">1</span><span class="math">&#8731;(&minus;125) = &minus;5</span><span class="reason">Odd index: (&minus;5)&sup3; = &minus;125, so one real root exists</span></div>
<div class="solution-step"><span class="num">2</span><span class="math">&#8308;&radic;(&minus;16) has no real value</span><span class="reason">Even index: nothing real to the 4th power is negative</span></div>
<div class="answer-box">&#8731;(&minus;125) = &minus;5, and &#8308;&radic;(&minus;16) is not a real number (it is 2i&radic;2 in the complex numbers)</div>
<div class="check-box"><strong>This is Figure 2 in one line:</strong> odd index accepts negatives, even index does not.</div>
</div></div>

<div class="try-box"><h4>Problem 4</h4><div class="prob">Simplify &radic;(49x&#8310;) and &#8308;&radic;(16x&#8308;). Where are absolute value bars needed?</div>
<button class="reveal-btn" onclick="reveal(this)">Show Solution</button><div class="reveal-body">
<div class="solution-step"><span class="num">1</span><span class="math">&radic;(49x&#8310;) = 7x&sup3;&hellip; careful</span><span class="reason">Even index, even exponent inside, <b>odd</b> exponent outside &rarr; bars needed</span></div>
<div class="solution-step"><span class="num">2</span><span class="math">&radic;(49x&#8310;) = 7|x&sup3;|</span><span class="reason">If x were negative, x&sup3; would be negative but the radical must not be</span></div>
<div class="solution-step"><span class="num">3</span><span class="math">&#8308;&radic;(16x&#8308;) = 2|x|</span><span class="reason">Even index, even exponent in, odd exponent out &rarr; bars again</span></div>
<div class="answer-box">7|x&sup3;| and 2|x|</div>
<div class="check-box"><strong>Test it:</strong> at x = &minus;2, &radic;(49 &middot; 64) = &radic;3136 = 56, and 7|(&minus;2)&sup3;| = 7(8) = 56 &#10003;, whereas 7x&sup3; would give &minus;56 &#10007;. By contrast &radic;(25x&#8308;) = 5x&sup2; needs no bars, because x&sup2; cannot be negative.</div>
</div></div>

<div class="try-box"><h4>Problem 5</h4><div class="prob">Simplify 8^(&minus;2/3).</div>
<button class="reveal-btn" onclick="reveal(this)">Show Solution</button><div class="reveal-body">
<div class="solution-step"><span class="num">1</span><span class="math">8^(&minus;2/3) = 1 / 8^(2/3)</span><span class="reason">A negative exponent means reciprocal &mdash; it does not make the answer negative</span></div>
<div class="solution-step"><span class="num">2</span><span class="math">8^(2/3) = (&#8731;8)&sup2; = 2&sup2; = 4</span><span class="reason">Root first, then power</span></div>
<div class="solution-step"><span class="num">3</span><span class="math">= 1/4</span><span class="reason">Take the reciprocal</span></div>
<div class="answer-box">1/4</div>
<div class="warning-box"><strong>The classic error:</strong> answering &minus;4. A negative exponent flips the base into a denominator; it never changes the sign of the result.</div>
</div></div>

<div class="try-box"><h4>Problem 6</h4><div class="prob">Simplify (x^(1/2) &middot; x^(1/3)) &divide; x^(1/6).</div>
<button class="reveal-btn" onclick="reveal(this)">Show Solution</button><div class="reveal-body">
<div class="solution-step"><span class="num">1</span><span class="math">x^(1/2) &middot; x^(1/3) = x^(1/2 + 1/3)</span><span class="reason">Multiplying like bases adds the exponents</span></div>
<div class="solution-step"><span class="num">2</span><span class="math">1/2 + 1/3 = 3/6 + 2/6 = 5/6</span><span class="reason">Common denominator</span></div>
<div class="solution-step"><span class="num">3</span><span class="math">x^(5/6) &divide; x^(1/6) = x^(5/6 &minus; 1/6)</span><span class="reason">Dividing subtracts the exponents</span></div>
<div class="solution-step"><span class="num">4</span><span class="math">= x^(4/6) = x^(2/3)</span><span class="reason">Reduce the fraction</span></div>
<div class="answer-box">x^(2/3), which is &#8731;(x&sup2;)</div>
<div class="check-box"><strong>The point of rational exponents:</strong> as radicals this problem is a mess of square, cube and sixth roots. As exponents it is just adding and subtracting fractions. Convert to exponents, work, then convert back if asked.</div>
</div></div>
"""
