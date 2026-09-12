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

def inline_md(s):
    s = html.escape(s, quote=False)
    s = re.sub(r"\*\*(.+?)\*\*", r"<strong>\1</strong>", s)
    s = re.sub(r"`([^`]+)`", r"<code>\1</code>", s)
    return s

def split_row(line):
    line = line.strip()
    if line.startswith("|"): line = line[1:]
    if line.endswith("|"): line = line[:-1]
    return line.split("|")

def render_table(rows):
    header, body = rows[0], rows[2:]
    out = ["<table><thead><tr>"]
    out += [f"<th>{inline_md(c.strip())}</th>" for c in header]
    out.append("</tr></thead><tbody>")
    for r in body:
        out.append("<tr>" + "".join(f"<td>{inline_md(c.strip())}</td>" for c in r) + "</tr>")
    out.append("</tbody></table>")
    return "".join(out)

def render_block(block_lines):
    """Renders markdown lines (no diagrams) into slide HTML."""
    parts, para, items = [], [], []
    list_tag = "ul"

    def flush():
        nonlocal para, items
        if para:
            parts.append(f"<p>{inline_md(' '.join(para))}</p>")
            para = []
        if items:
            parts.append(f"<{list_tag}>" + "".join(f"<li>{inline_md(x)}</li>" for x in items) + f"</{list_tag}>")
            items = []

    i, n = 0, len(block_lines)
    while i < n:
        stripped = block_lines[i].strip()
        if stripped.startswith("<!--"):
            flush()
            while i < n and "-->" not in block_lines[i]:
                i += 1
            i += 1
            continue
        if stripped.startswith("```"):
            flush()
            i += 1
            code = []
            while i < n and not block_lines[i].strip().startswith("```"):
                code.append(block_lines[i]); i += 1
            i += 1
            parts.append(f'<pre class="codeblock">{html.escape(chr(10).join(code))}</pre>')
            continue
        if stripped.startswith("|"):
            flush()
            rows = []
            while i < n and block_lines[i].strip().startswith("|"):
                rows.append(split_row(block_lines[i])); i += 1
            parts.append(render_table(rows))
            continue
        if re.match(r"^\*\*[^*]+\*\*$", stripped):
            flush()
            parts.append(f"<h4>{inline_md(stripped[2:-2])}</h4>")
        elif re.match(r"^\d+\. ", stripped):
            if para: flush()
            list_tag = "ol"
            items.append(re.sub(r"^\d+\.\s+", "", stripped))
        elif stripped.startswith("- "):
            if para: flush()
            list_tag = "ul"
            items.append(stripped[2:])
        elif stripped == "" or stripped == "---":
            flush()
        else:
            para.append(stripped)
        i += 1
    flush()
    return "\n".join(parts)

# ---- Parse: "## [N.] Section" -> sections, "### Sub-title" -> slides ----
# Each slide body is split so every mermaid diagram becomes its own slide.
slides = []  # dicts: section_num, section_title, subtitle, kind, content
section_num, section_title = None, None
subtitle, buf = None, []
in_fence = False

def flush_slide():
    global buf
    if subtitle is None:
        buf = []
        return
    text_lines = []
    i = 0
    while i < len(buf):
        if buf[i].strip().startswith("```mermaid"):
            if any(l.strip() for l in text_lines):
                slides.append(dict(num=section_num, section=section_title, subtitle=subtitle, kind="text", content=text_lines))
            text_lines = []
            j = i + 1
            code = []
            while j < len(buf) and not buf[j].strip().startswith("```"):
                code.append(buf[j]); j += 1
            slides.append(dict(num=section_num, section=section_title, subtitle=subtitle, kind="diagram", content="\n".join(code)))
            i = j + 1
            continue
        text_lines.append(buf[i])
        i += 1
    if any(l.strip() and not l.strip().startswith("<!--") for l in text_lines):
        slides.append(dict(num=section_num, section=section_title, subtitle=subtitle, kind="text", content=text_lines))
    buf = []

for ln in text.split("\n"):
    stripped = ln.strip()
    if stripped.startswith("```"):
        in_fence = not in_fence
    if not in_fence:
        m2 = re.match(r"^##\s+(?:(\d+)\.\s+)?(.+)$", stripped)
        m3 = re.match(r"^###\s+(.+)$", stripped)
        if m3:
            flush_slide()
            subtitle = m3.group(1)
            continue
        if m2 and not stripped.startswith("###"):
            flush_slide()
            subtitle = None
            section_num, section_title = m2.group(1), m2.group(2)
            continue
    buf.append(ln)
flush_slide()

slides_html = []
TOTAL = len(slides) + 1
for idx, sl in enumerate(slides, start=2):
    kicker = f"{sl['num']}. {sl['section']}" if sl["num"] else sl["section"]
    footer = f'<div class="slide-footer"><span>Vehicle Live Tracking</span><span>{idx} / {TOTAL}</span></div>'
    if sl["kind"] == "diagram":
        slides_html.append(f"""
<section class="slide slide-diagram">
  <div class="slide-kicker">{html.escape(kicker)}</div>
  <h2 class="slide-title">{inline_md(sl['subtitle'])}</h2>
  <div class="slide-body slide-body-diagram">
    <div class="mermaid-wrap-full"><pre class="mermaid">{html.escape(sl['content'])}</pre></div>
  </div>
  {footer}
</section>""")
    else:
        slides_html.append(f"""
<section class="slide">
  <div class="slide-kicker">{html.escape(kicker)}</div>
  <h2 class="slide-title">{inline_md(sl['subtitle'])}</h2>
  <div class="slide-body">
    {render_block(sl['content'])}
  </div>
  {footer}
</section>""")

title_slide = """
<section class="slide slide-title-page">
  <div class="title-eyebrow">AW Rostamani Group IT</div>
  <h1>Vehicle Live Tracking</h1>
  <p class="title-sub">Architecture presentation · Product Engineering Manager assignment</p>
  <p class="title-sub2">Hitesh Pachpor · 12 September 2026</p>
</section>
"""

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
  font-size:17px;
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
  font-size:13.5px;
  letter-spacing:0.08em;
  text-transform:uppercase;
  color:var(--muted-foreground);
  font-weight:600;
  margin-bottom:6px;
}

.slide-title{
  font-size:34px;
  font-weight:700;
  margin:0 0 14px 0;
  color:var(--foreground);
  letter-spacing:-0.01em;
}

.slide-body{
  flex:1;
  min-height:0;
  overflow:hidden;
  font-size:18px;
  line-height:1.42;
}

.slide-body p{ margin:0 0 6px 0; }
.slide-body ul, .slide-body ol{ margin:0 0 8px 0; padding-left:22px; }
.slide-body li{ margin-bottom:3px; }
.slide-body h4{
  font-size:17.5px;
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
  font-size:15px;
  line-height:1.5;
  white-space:pre-wrap;
  margin:0 0 8px 0;
}

table{
  border-collapse:collapse;
  width:100%;
  margin:0 0 10px 0;
  font-size:16.5px;
}
th,td{
  border:1px solid var(--border);
  padding:6px 10px;
  text-align:left;
  vertical-align:top;
}
th{
  background:var(--muted);
  font-weight:700;
  color:var(--foreground);
}
tbody tr:nth-child(even){ background:var(--surface-strong); }
tbody td:first-child{ font-weight:600; }

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
  font-size:16px;
  font-weight:700;
  letter-spacing:0.1em;
  text-transform:uppercase;
  color:var(--primary);
  margin-bottom:18px;
}
.slide-title-page h1{
  font-size:72px;
  font-weight:800;
  margin:0 0 16px 0;
  letter-spacing:-0.02em;
}
.title-sub{
  font-size:22.5px;
  color:var(--foreground);
  margin:0 0 8px 0;
  font-weight:600;
}
.title-sub2{
  font-size:17px;
  color:var(--muted-foreground);
  margin:0;
}

.slide-appendix .slide-kicker{ color:var(--primary); }

.slide-body p{ margin:0 0 8px 0; }
.slide-body h4{ margin:12px 0 6px 0; }
.slide-diagram .slide-title{ text-align:left; }
.slide-diagram .slide-kicker{ text-align:left; }
.slide-body-diagram{ padding:0.1in 0; }
.mermaid-wrap-full svg{ max-height:5.6in !important; }
.slide-footer{
  display:flex; justify-content:space-between;
  font-size:12.5px; color:var(--muted-foreground);
  padding-top:6px; flex-shrink:0;
}
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
    fontSize:"18px",
    edgeLabelBackground:"#fbfbfc"
  },
  flowchart:{ curve:"basis", htmlLabels:true },
  sequence:{ actorFontSize:17, noteFontSize:16, messageFontSize:16 },
  state:{ }
});
window.__renderMermaid = async function(){
  await mermaid.run({ querySelector: ".mermaid" });
  window.__mermaidDone = true;
};
'''

all_slides = [title_slide] + slides_html

doc = f'''<!doctype html>
<html>
<head>
<meta charset="utf-8">
<title>Vehicle Live Tracking</title>
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
