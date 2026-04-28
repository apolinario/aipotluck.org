# Current AI Notebook Style

Visual identity for Current AI ecosystem mapping notebooks. Derived from the website design system (warm editorial palette) with adaptations for data analysis.

Use this style for all notebooks in this project — both hosted (oso.xyz) and local exploration.

---

## Layout Constants

### LAYOUT + F + C

Three constants work together: `F` (font stacks), `C` (semantic colors), and `LAYOUT` (Plotly base).

```python
@app.cell(hide_code=True)
def _():
    F = {
        "headline": "Fraunces, Georgia, serif",
        "body": "Inter, -apple-system, system-ui, sans-serif",
        "mono": "'JetBrains Mono', ui-monospace, SFMono-Regular, monospace",
    }
    C = {
        "ink":          "#1a1814",
        "ink_2":        "#3a342b",
        "ink_3":        "#6b6253",
        "paper":        "#f5f1ea",
        "paper_2":      "#ede7dc",
        "paper_3":      "#e3dccd",
        "rule":         "#c9bfac",
        "signal":       "#c8341d",
        "signal_soft":  "#e98a78",
        "healthy":      "#1b6b5e",
        "healthy_soft": "#6ba99a",
        "warm":         "#d97c2a",
        "accent":       "#2a3d8f",
    }
    LAYOUT = dict(
        plot_bgcolor="white",
        paper_bgcolor="white",
        font=dict(family=F["body"], size=12, color=C["ink"]),
        margin=dict(t=20, l=60, r=20, b=50),
        legend=dict(
            bgcolor="rgba(0,0,0,0)",
            font=dict(size=11),
            orientation="h",
            yanchor="bottom", y=1.02,
            xanchor="left", x=0,
        ),
        hovermode="closest",
    )
    CHART_LAYOUT = LAYOUT
    return C, F, LAYOUT, CHART_LAYOUT
```

**Key principles:**

- **Warm palette** — paper tones (#f5f1ea) instead of pure white/gray. This matches the website.
- **Three font stacks:** Fraunces (serif display, for headlines), Inter (UI/body), JetBrains Mono (data/numbers)
- **Semantic color dict `C`** — reference by role (`C['signal']`, `C['healthy']`), never by hex
- **Health encoding:** `healthy` (teal, ≥70), `warm` (amber, 45-69), `signal` (red, <45) — same thresholds as website

---

## Color Palette

Colors communicate ecosystem health — the same vocabulary as the website's gap heatmap.

| Role        | Key               | Hex       | Usage                                         |
| ----------- | ----------------- | --------- | --------------------------------------------- |
| Ink         | `C['ink']`        | `#1a1814` | Text, axis lines, borders                     |
| Ink 2       | `C['ink_2']`      | `#3a342b` | Secondary text, subtitles                     |
| Ink 3       | `C['ink_3']`      | `#6b6253` | Tertiary text, labels, captions               |
| Paper       | `C['paper']`      | `#f5f1ea` | Page background (warm off-white)              |
| Paper 2     | `C['paper_2']`    | `#ede7dc` | Card backgrounds, table alternating rows      |
| Rule        | `C['rule']`       | `#c9bfac` | Borders, gridlines, separators                |
| Signal      | `C['signal']`     | `#c8341d` | Gaps, red spots, <45 health                   |
| Healthy     | `C['healthy']`    | `#1b6b5e` | Healthy coverage, ≥70 health, positive        |
| Warm        | `C['warm']`       | `#d97c2a` | Fragile, 45-69 health, caution                |
| Accent      | `C['accent']`     | `#2a3d8f` | Deep editorial blue, links, primary series    |

**Health color helper:**

```python
def health_color(score):
    if score >= 70:
        return C['healthy']
    elif score >= 45:
        return C['warm']
    return C['signal']
```

**Category colors** (for GoodAI categories):

```python
CAT_COLORS = {
    'Infrastructure':    '#1A5276',
    'AI Engineering':    '#196F3D',
    'Model Development': '#922B21',
    'Applications':      '#6C3483',
    'Models':            '#117A65',
    'Tutorials':         '#784212',
    'Lists':             '#17202A',
    'Misc':              '#717D7E',
}
```

**Usage rules:**

- Lead series uses `C['accent']` (blue) for neutral data
- Health-encoded data uses `healthy`/`warm`/`signal` — never arbitrary colors
- Category-encoded data uses `CAT_COLORS`
- Gray (`C['ink_3']`) for context, secondary lines, de-emphasized data
- Never more than 5 colors in one chart

---

## Typography

Fonts loaded via Google Fonts (Fraunces + Inter + JetBrains Mono are already in the website's font stack):

```python
@app.cell(hide_code=True)
def _(mo):
    mo.Html("""<style>
        @import url('https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,300;9..144,400;9..144,500;9..144,600;9..144,700&family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap');
        </style>""")
    return
```

| Element              | Font            | Size    | Weight | Color         | Extra                                            |
| -------------------- | --------------- | ------- | ------ | ------------- | ------------------------------------------------ |
| Page title (h1)      | `F['headline']` | 2.2rem  | 400    | `C['ink']`    | `letter-spacing:-0.025em; line-height:1.05`      |
| Section header (h2)  | `F['headline']` | 1.4rem  | 500    | `C['ink']`    | —                                                |
| Eyebrow label        | `F['mono']`     | 11px    | 500    | `C['ink_3']`  | `letter-spacing:0.1em; text-transform:uppercase` |
| Body paragraph       | `F['body']`     | 0.95rem | 400    | `C['ink_2']`  | `line-height:1.5`                                |
| KPI value            | `F['headline']` | 1.8rem  | 500    | `C['ink']`    | —                                                |
| KPI label            | `F['body']`     | 0.75rem | 600    | `C['ink_3']`  | `text-transform:uppercase; letter-spacing:0.08em`|
| Table header         | `F['mono']`     | 10px    | 500    | `C['ink_3']`  | `letter-spacing:0.08em; text-transform:uppercase` |
| Table cell (text)    | `F['body']`     | 13px    | 500    | `C['ink']`    | —                                                |
| Table cell (numeric) | `F['mono']`     | 12px    | 400    | `C['ink']`    | Right-aligned                                    |
| Chart tick labels    | `F['body']`     | 11px    | 400    | `C['ink_3']`  | —                                                |

**Key difference from other styles:** Fraunces at weight 400 (light) for headlines — editorial, not bold. This matches the website's masthead typography.

---

## KPI Cards

Use `mo.stat()` for consistency:

```python
mo.hstack([
    mo.stat(value=f"{repos:,}", label="Repos", bordered=True, caption="across the AI stack"),
    mo.stat(value=f"{stars:,}", label="Stars", bordered=True, caption="community adoption"),
    mo.stat(value=f"{contributors:,}", label="Contributors", bordered=True, caption="active developers"),
], widths="equal", gap=1)
```

**Rules:**

- 3-6 stats per row
- Always use `bordered=True`
- Use `caption` for context (timeframe, methodology note)
- Format numbers with commas: `f"{n:,}"`
- Use K/M suffixes for large numbers: `f"{n/1e3:.0f}K"`

---

## Charts

### Horizontal bar charts (primary chart type)

Most ecosystem data is categorical — subcategories, organizations, projects ranked by a metric. Horizontal bars are the default.

```python
fig = go.Figure(go.Bar(
    y=df['name'],
    x=df['value'],
    orientation='h',
    marker_color=C['accent'],
    hovertemplate="<b>%{y}</b><br>Value: %{x:,}<extra></extra>",
))
fig.update_layout(
    **LAYOUT,
    height=max(300, len(df) * 28),
    xaxis=dict(title='Metric', showgrid=True, gridcolor=C['rule']),
    yaxis=dict(title='', showgrid=False),
)
```

**Rules:**

- Sort ascending (largest at top after Plotly flips the y-axis)
- Dynamic height: `max(300, len(df) * 28)` — 28px per bar
- Color by category when relevant (`CAT_COLORS.get(cat, '#999')`)
- Color by health score when showing ecosystem health (`health_color(score)`)

### Health scatter (coverage vs depth)

The signature chart — plots subcategories by adoption (x) vs contributor depth (y), with quadrant labels.

```python
fig.add_vline(x=median_stars, line=dict(color=C['rule'], dash='dash'))
fig.add_hline(y=median_contributors, line=dict(color=C['rule'], dash='dash'))

# Quadrant labels
for px, py, label, color in [
    (0.02, 0.02, 'GAP',     C['signal']),
    (0.98, 0.02, 'AT RISK', C['warm']),
    (0.02, 0.98, 'HIDDEN',  C['accent']),
    (0.98, 0.98, 'HEALTHY', C['healthy']),
]:
    fig.add_annotation(x=px, y=py, xref='paper', yref='paper',
                       text=f'<b>{label}</b>', showarrow=False,
                       font=dict(size=12, color=color))
```

### Treemaps (market map overview)

Size = repo count, color = contributor depth (darker = more contributors).

```python
marker=dict(
    colorscale=[[0, C['paper_2']], [0.5, C['healthy_soft']], [1, C['healthy']]],
    line=dict(width=1.5, color='white'),
)
```

---

## Section Structure

```
1. Header           ← eyebrow + serif title + framing paragraph
2. KPI strip        ← 3-6 mo.stat() cards
3. Overview chart   ← bar chart showing the landscape
4. Detail chart     ← scatter, treemap, or breakdown
5. Table            ← ranked list with filters
6. Methodology      ← data sources, caveats, links
```

**Rules:**

- Every chart preceded by a markdown cell with title and 1-2 sentence framing
- Use `mo.vstack([mo.md("## Title"), mo.ui.plotly(fig)])` to keep title and chart together
- End with a methodology/source note
- For interactive notebooks, use `mo.ui.dropdown()` for filters — place in their own cell

---

## When to Use This Style

All notebooks in the `ecosystem-mapping` project should use this style. It ensures visual consistency between the website and the notebooks, and gives Current AI a recognizable identity across all outputs.

| Notebook type              | This style |
| -------------------------- | ---------- |
| France / geo-filtered view | Yes        |
| Trends / developer activity| Yes        |
| Gap analysis               | Yes        |
| Data inventory             | Yes        |
| Taxonomy mapping           | Yes        |
