"""
Converts docs/deliverable-2-presentation-content.md into a styled HTML slide
deck (docs/scripts/deck.html), matching the app's design tokens from
src/app/globals.css. Run render-pdf.sh afterward to print it to PDF.
"""
import re, html
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
SRC = ROOT / "docs" / "deliverable-2-presentation-content.md"
OUT = Path(__file__).resolve().parent / "deck.html"

text = SRC.read_text(encoding="utf-8")

# Split into slide chunks on lines that are exactly '---', but not inside ``` fences.
lines = text.split("\n")
chunks = []
cur = []
in_fence = False
for ln in lines:
    if ln.strip().startswith("```"):
        in_fence = not in_fence
        cur.append(ln)
        continue
    if not in_fence and ln.strip() == "---":
        chunks.append(cur)
        cur = []
        continue
    cur.append(ln)
chunks.append(cur)

def inline_md(s):
    s = html.escape(s, quote=False)
    s = re.sub(r"\*\*(.+?)\*\*", r"<strong>\1</strong>", s)
    s = re.sub(r"`([^`]+)`", r"<code>\1</code>", s)
    return s

def render_table(rows):
    header = rows[0]
    body = rows[2:]
    out = ['<table>']
    out.append("<thead><tr>" + "".join(f"<th>{inline_md(c.strip())}</th>" for c in header) + "</tr></thead>")
    out.append("<tbody>")
    for r in body:
        out.append("<tr>" + "".join(f"<td>{inline_md(c.strip())}</td>" for c in r) + "</tr>")
    out.append("</tbody></table>")
    return "\n".join(out)

def split_row(line):
    line = line.strip()
    if line.startswith("|"): line = line[1:]
    if line.endswith("|"): line = line[:-1]
    return line.split("|")

def render_block(block_lines):
    """Render markdown lines (no slide separators) into HTML, extracting the
    talking track into its own HTML. Returns (main_html, talking_track_html_or_None)."""
    html_parts = []
    i = 0
    n = len(block_lines)
    talking = []
    in_talking = False
    para_buf = []
    list_buf = []

    def flush_para():
        nonlocal para_buf
        if para_buf:
            txt = " ".join(para_buf).strip()
            if txt:
                html_parts.append(f"<p>{inline_md(txt)}</p>")
            para_buf = []

    def flush_list():
        nonlocal list_buf
        if list_buf:
            html_parts.append("<ul>" + "".join(f"<li>{inline_md(x)}</li>" for x in list_buf) + "</ul>")
            list_buf = []

    while i < n:
        raw = block_lines[i]
        ln = raw.rstrip()
        stripped = ln.strip()

        if stripped.startswith("<!--"):
            flush_para(); flush_list()
            if "-->" not in stripped[4:]:
                i += 1
                while i < n and "-->" not in block_lines[i]:
                    i += 1
            if i < n:
                i += 1
            continue

        if stripped.startswith("**Talking track**"):
            flush_para(); flush_list()
            in_talking = True
            i += 1
            continue

        if stripped.startswith("```mermaid"):
            flush_para(); flush_list()
            i += 1
            mcode = []
            while i < n and not block_lines[i].strip().startswith("```"):
                mcode.append(block_lines[i])
                i += 1
            i += 1  # skip closing ```
            code = "\n".join(mcode)
            if in_talking:
                talking.append(("mermaid", code))
            else:
                html_parts.append(f'<div class="mermaid-wrap"><pre class="mermaid">{html.escape(code)}</pre></div>')
            continue

        if stripped.startswith("```"):
            flush_para(); flush_list()
            i += 1
            code = []
            while i < n and not block_lines[i].strip().startswith("```"):
                code.append(block_lines[i])
                i += 1
            i += 1
            block = f'<pre class="codeblock">{html.escape(chr(10).join(code))}</pre>'
            (talking.append(("html", block)) if in_talking else html_parts.append(block))
            continue

        if stripped.startswith("|"):
            flush_para(); flush_list()
            table_rows = []
            while i < n and block_lines[i].strip().startswith("|"):
                table_rows.append(split_row(block_lines[i]))
                i += 1
            tbl = render_table(table_rows)
            (talking.append(("html", tbl)) if in_talking else html_parts.append(tbl))
            continue

        if stripped.startswith("#### "):
            flush_para(); flush_list()
            txt = f"<h4>{inline_md(stripped[5:])}</h4>"
            (talking.append(("html", txt)) if in_talking else html_parts.append(txt))
            i += 1
            continue

        if re.match(r"^\*\*[^*]+\*\*$", stripped):
            flush_para(); flush_list()
            txt = f"<h4>{inline_md(stripped)}</h4>"
            (talking.append(("html", txt)) if in_talking else html_parts.append(txt))
            i += 1
            continue

        if re.match(r"^\d+\. ", stripped):
            flush_para()
            list_buf.append(re.sub(r"^\d+\.\s+", "", stripped))
            i += 1
            continue

        if stripped.startswith("- "):
            flush_para()
            list_buf.append(stripped[2:])
            i += 1
            continue

        if stripped == "":
            flush_para(); flush_list()
            i += 1
            continue

        (talking.append(("text", stripped)) if in_talking else para_buf.append(stripped))
        i += 1

    flush_para(); flush_list()

    talking_html = None
    if talking:
        parts = []
        buf = []
        def flush_buf():
            if buf:
                parts.append(f"<p>{inline_md(' '.join(buf))}</p>")
                buf.clear()
        for kind, val in talking:
            if kind == "text":
                buf.append(val)
            else:
                flush_buf()
                parts.append(f'<pre class="mermaid">{html.escape(val)}</pre>' if kind == "mermaid" else val)
        flush_buf()
        talking_html = "\n".join(parts)

    return "\n".join(html_parts), talking_html

# Count numbered slides up front so the "NN / total" kicker stays accurate.
TOTAL_NUMBERED = sum(
    1 for chunk in chunks
    for l in chunk
    if re.match(r"^##\s+\d+\.\s+.*$", l.strip())
)

def is_vertical_flowchart(code):
    for l in code.split("\n"):
        s = l.strip()
        if not s:
            continue
        return bool(re.match(r"^(flowchart|graph)\s+(TB|TD)\b", s, re.IGNORECASE))
    return False

def split_vertical_diagrams(body_lines):
    """Pulls top-to-bottom mermaid flowcharts out as their own segments so they
    can get a full-slide treatment; everything else stays grouped as text
    segments (still handled by render_block, LR/sequence/state diagrams included).
    Returns a list of ('text', lines) / ('diagram', mermaid_code) tuples."""
    segments = []
    cur = []
    i = 0
    n = len(body_lines)
    while i < n:
        stripped = body_lines[i].strip()
        if stripped.startswith("```mermaid"):
            j = i + 1
            code_lines = []
            while j < n and not body_lines[j].strip().startswith("```"):
                code_lines.append(body_lines[j])
                j += 1
            code = "\n".join(code_lines)
            if is_vertical_flowchart(code):
                segments.append(("text", cur)); cur = []
                segments.append(("diagram", code))
            else:
                cur.append(body_lines[i])
                cur.extend(code_lines)
                cur.append(body_lines[j] if j < n else "```")
            i = j + 1
            continue
        cur.append(body_lines[i])
        i += 1
    segments.append(("text", cur))
    return segments

slides_html = []
for ci, chunk in enumerate(chunks):
    heading = None
    body_start = 0
    for j, l in enumerate(chunk):
        m = re.match(r"^##\s+(\d+)\.\s+(.*)$", l.strip())
        if m:
            heading = (m.group(1), m.group(2))
            body_start = j + 1
            break
    if heading is None:
        continue  # title chunk (ci == 0) or appendix — handled separately

    num, title = heading
    body_lines = chunk[body_start:]
    segments = split_vertical_diagrams(body_lines)

    # Drop text segments that are entirely blank so we don't emit empty slides.
    rendered_segments = []
    for kind, val in segments:
        if kind == "text" and not any(l.strip() for l in val):
            continue
        rendered_segments.append((kind, val))

    total_parts = len(rendered_segments)
    for part_i, (kind, val) in enumerate(rendered_segments):
        kicker = f"Vehicle live tracking · {num.zfill(2)} / {TOTAL_NUMBERED}"
        if total_parts > 1:
            kicker += f" · part {part_i + 1} of {total_parts}"

        if kind == "diagram":
            slide = f'''
<section class="slide slide-diagram">
  <div class="slide-kicker">{kicker}</div>
  <h2 class="slide-title">{inline_md(title)}</h2>
  <div class="slide-body slide-body-diagram">
    <div class="mermaid-wrap-full"><pre class="mermaid">{html.escape(val)}</pre></div>
  </div>
</section>
'''
        else:
            main_html, talking_html = render_block(val)
            slide = f'''
<section class="slide">
  <div class="slide-kicker">{kicker}</div>
  <h2 class="slide-title">{inline_md(title)}</h2>
  <div class="slide-body">
    {main_html}
  </div>
  {f'<div class="talking-track"><div class="tt-label">Talking track</div>{talking_html}</div>' if talking_html else ''}
</section>
'''
        slides_html.append(slide)

# ---- Title slide (hand-built) ----
title_slide = '''
<section class="slide slide-title-page">
  <div class="title-eyebrow">AWR Group · GIT</div>
  <h1>Vehicle live tracking</h1>
  <p class="title-sub">Product Engineering Manager assignment</p>
  <p class="title-sub2">Seven-day working slice, plus how I would take it to production</p>
</section>
'''

# ---- Appendix slides ----
appendix_idx = None
for ci, chunk in enumerate(chunks):
    if "# Presenter appendix" in "\n".join(chunk):
        appendix_idx = ci
        break

appendix_slides = []
if appendix_idx is not None:
    # Appendix content spans multiple '---' chunks with no separator between
    # "## Demo" and "## Questions", so flatten and re-split on '## ' headings.
    appendix_lines = []
    for chunk in chunks[appendix_idx:]:
        appendix_lines.extend(chunk)

    sections = []
    cur_heading = None
    cur_body = []
    for l in appendix_lines:
        m2 = re.match(r"^##\s+(.*)$", l.strip())
        if m2:
            if cur_heading is not None:
                sections.append((cur_heading, cur_body))
            cur_heading = m2.group(1)
            cur_body = []
        elif cur_heading is not None:
            cur_body.append(l)
    if cur_heading is not None:
        sections.append((cur_heading, cur_body))

    def emit_appendix_slide(heading, body_lines):
        main_html, _ = render_block(body_lines)
        appendix_slides.append(f'''
<section class="slide slide-appendix">
  <div class="slide-kicker">Presenter appendix</div>
  <h2 class="slide-title">{inline_md(heading)}</h2>
  <div class="slide-body">
    {main_html}
  </div>
</section>
''')

    QPER = 4  # Q&A pairs per slide, tuned so nothing overflows the page
    for heading, body_lines in sections:
        if heading.strip() == "Questions I expect":
            units, cur_unit = [], []
            for l in body_lines:
                if re.match(r"^\*\*[^*]+\*\*$", l.strip()) and cur_unit:
                    units.append(cur_unit)
                    cur_unit = [l]
                else:
                    cur_unit.append(l)
            if cur_unit:
                units.append(cur_unit)

            total_parts = (len(units) + QPER - 1) // QPER
            for gi in range(0, len(units), QPER):
                flat = [l for u in units[gi:gi + QPER] for l in u]
                part_heading = f"{heading} ({gi // QPER + 1}/{total_parts})"
                emit_appendix_slide(part_heading, flat)
        else:
            emit_appendix_slide(heading, body_lines)

CSS = '''
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');

:root{
  --background:#f5f6f7;
  --surface:#fbfbfc;
  --surface-strong:#f0f1f2;
  --foreground:#202124;
  --muted:#e9eaec;
  --muted-foreground:#63666b;
  --border:#d9dbde;
  --primary:#b4232c;
  --primary-foreground:#fffafa;
}

*{ box-sizing:border-box; }

html,body{
  margin:0; padding:0;
  background:var(--background);
  color:var(--foreground);
  font-family:"Avenir Next","Inter","Segoe UI",sans-serif;
  font-size:15px;
}

@page{ size: 13.333in 7.5in; margin:0; }

.slide{
  width:13.333in;
  height:7.5in;
  padding:0.45in 0.75in 0.35in 0.75in;
  background:var(--surface);
  position:relative;
  break-after:page;
  page-break-after:always;
  overflow:hidden;
  display:flex;
  flex-direction:column;
}
.slide:last-of-type{ break-after: auto; }

.slide::before{
  content:"";
  position:absolute;
  top:0; left:0; right:0; height:6px;
  background:var(--primary);
}

.slide-kicker{
  font-size:12px;
  letter-spacing:0.08em;
  text-transform:uppercase;
  color:var(--muted-foreground);
  font-weight:600;
  margin-bottom:6px;
}

.slide-title{
  font-size:30px;
  font-weight:700;
  margin:0 0 10px 0;
  color:var(--foreground);
  letter-spacing:-0.01em;
}

.slide-body{
  flex:1;
  min-height:0;
  overflow:hidden;
  font-size:15.5px;
  line-height:1.38;
}

.slide-body p{ margin:0 0 6px 0; }
.slide-body ul{ margin:0 0 6px 0; padding-left:20px; }
.slide-body li{ margin-bottom:3px; }
.slide-body h4{
  font-size:15.5px;
  font-weight:700;
  margin:10px 0 6px 0;
  color:var(--primary);
}
.slide-body h4:first-child{ margin-top:0; }

code{
  background:var(--muted);
  border-radius:4px;
  padding:1px 5px;
  font-family:"SF Mono","Menlo",monospace;
  font-size:0.85em;
  color:#7f1820;
}

.codeblock{
  background:var(--surface-strong);
  border:1px solid var(--border);
  border-radius:8px;
  padding:10px 12px;
  font-family:"SF Mono","Menlo",monospace;
  font-size:13.5px;
  line-height:1.5;
  white-space:pre-wrap;
  margin:0 0 8px 0;
}

table{
  border-collapse:collapse;
  width:100%;
  margin:0 0 10px 0;
  font-size:14.5px;
}
th,td{
  border:1px solid var(--border);
  padding:5px 9px;
  text-align:left;
  vertical-align:top;
}
th{
  background:var(--muted);
  font-weight:700;
  color:var(--foreground);
}
tbody tr:nth-child(even){ background:var(--surface-strong); }

.mermaid-wrap{
  display:flex;
  justify-content:center;
  margin:4px 0 6px 0;
}
.mermaid-wrap svg{
  max-height:1.85in;
  max-width:100%;
}

.slide-body-diagram{
  display:flex;
  align-items:center;
  justify-content:center;
}
.mermaid-wrap-full{
  width:100%;
  height:100%;
  display:flex;
  align-items:center;
  justify-content:center;
}
.mermaid-wrap-full pre.mermaid{
  width:100%;
  height:100%;
  margin:0;
  display:flex;
  align-items:center;
  justify-content:center;
}
.mermaid-wrap-full svg{
  width:100% !important;
  height:100% !important;
  max-width:100% !important;
  max-height:100% !important;
}
.slide-diagram .slide-title{
  text-align:center;
  margin-bottom:6px;
}
.slide-diagram .slide-kicker{
  text-align:center;
}

.talking-track{
  margin-top:auto;
  background:var(--surface-strong);
  border-radius:8px;
  padding:8px 14px;
  max-height:1.7in;
  overflow:hidden;
  flex-shrink:0;
}
.tt-label{
  font-size:11px;
  font-weight:700;
  letter-spacing:0.08em;
  text-transform:uppercase;
  color:var(--primary);
  margin-bottom:4px;
}
.talking-track p{
  font-size:13.5px;
  line-height:1.42;
  color:var(--muted-foreground);
  font-style:italic;
  margin:0 0 4px 0;
}

.slide-title-page{
  align-items:flex-start;
  justify-content:center;
  background: linear-gradient(160deg, var(--surface) 0%, var(--surface-strong) 100%);
}
.slide-title-page::before{ height:10px; }
.title-eyebrow{
  font-size:14px;
  font-weight:700;
  letter-spacing:0.1em;
  text-transform:uppercase;
  color:var(--primary);
  margin-bottom:18px;
}
.slide-title-page h1{
  font-size:64px;
  font-weight:800;
  margin:0 0 16px 0;
  letter-spacing:-0.02em;
}
.title-sub{
  font-size:20px;
  color:var(--foreground);
  margin:0 0 8px 0;
  font-weight:600;
}
.title-sub2{
  font-size:15px;
  color:var(--muted-foreground);
  margin:0;
}

.slide-appendix .slide-kicker{ color:var(--primary); }
'''

MERMAID_INIT = '''
mermaid.initialize({
  startOnLoad: false,
  theme: "base",
  themeVariables: {
    background:"#fbfbfc",
    primaryColor:"#fbeaec",
    primaryTextColor:"#202124",
    primaryBorderColor:"#b4232c",
    lineColor:"#63666b",
    secondaryColor:"#e9eaec",
    tertiaryColor:"#f0f1f2",
    fontFamily:"Avenir Next, Inter, sans-serif",
    fontSize:"14px",
    edgeLabelBackground:"#fbfbfc"
  },
  flowchart:{ curve:"basis", htmlLabels:true },
  sequence:{ actorFontSize:13, noteFontSize:12, messageFontSize:12 }
});
window.__renderMermaid = async function(){
  await mermaid.run({ querySelector: ".mermaid" });
  window.__mermaidDone = true;
};
'''

all_slides = [title_slide] + slides_html + appendix_slides

doc = f'''<!doctype html>
<html>
<head>
<meta charset="utf-8">
<title>Vehicle live tracking — deck</title>
<style>{CSS}</style>
</head>
<body>
{"".join(all_slides)}
<script src="https://cdn.jsdelivr.net/npm/mermaid@10/dist/mermaid.min.js"></script>
<script>{MERMAID_INIT}
window.__renderMermaid();
</script>
</body>
</html>
'''

OUT.write_text(doc, encoding="utf-8")
print("wrote", OUT, "slides:", len(all_slides))
