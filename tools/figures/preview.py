"""Write tools/figures/preview.html showing one lesson's Key Figures section.

Useful for eyeballing a drawing without scrolling the whole single-page app:
    python3 preview.py 2-3
"""
import pathlib
import re
import sys

ROOT = pathlib.Path(__file__).parent.parent.parent
lesson = sys.argv[1] if len(sys.argv) > 1 else '2-3'
sections = sys.argv[2] if len(sys.argv) > 2 else 'figures'

src = (ROOT / f'data/lessons/{lesson}.html').read_text()
m = re.search(rf'<section id="{sections}">(.*?)</section>', src, re.S)
if not m:
    sys.exit(f'no <section id="{sections}"> in {lesson}.html')

html = f"""<!doctype html><html><head><meta charset="utf-8"><title>figures {lesson}</title>
<link rel="stylesheet" href="../../css/style.css">
<link rel="stylesheet" href="../../css/lesson-embed.css">
<style>body{{background:#f5f7fb;margin:0;padding:16px}}.lesson-content{{max-width:760px;margin:0 auto}}
h2:first-of-type{{margin-top:0}}</style>
</head><body><div class="lesson-content dom-advanced-math"><div class="sat-lesson">{m.group(1)}</div></div>
<script>
function figHi(chip,figId,cls){{const fig=document.getElementById(figId);const on=chip.classList.contains('on');
fig.parentElement.querySelectorAll('.fig-chip').forEach(c=>c.classList.remove('on'));
fig.querySelectorAll('[data-part]').forEach(e=>e.classList.remove('g-fade'));
if(!on){{chip.classList.add('on');fig.querySelectorAll('[data-part]').forEach(e=>{{
if(e.getAttribute('data-part')!==cls)e.classList.add('g-fade');}});}}}}
</script></body></html>"""
(ROOT / 'tools/figures/preview.html').write_text(html)
print(f'preview.html <- {lesson} #{sections}')
