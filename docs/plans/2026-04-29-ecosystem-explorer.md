# Ecosystem Explorer v1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a data-driven React explorer at `/explore` that surfaces 15K repos across 8 OSAI layers with filtering, sorting, sparklines, and a detail drawer — all from a static JSON bundle exported from the OSO warehouse.

**Architecture:** React Router adds `/explore` alongside the existing landing page at `/`. A Python export script queries 7 warehouse tables and produces a single JSON bundle at build time. The explorer loads this bundle, indexes it in memory, and renders a virtualized table with filter sidebar, layer summary cards, and a slide-out detail drawer.

**Tech Stack:** React 18, React Router v7, Vite 8, @tanstack/react-virtual, pyoso (Python export)

**Design Spec:** `docs/specs/2026-04-29-ecosystem-explorer-design.md`

---

## File Map

### New Files

| File | Responsibility |
|------|---------------|
| `app/src/components/GlassCard.jsx` | Reusable glassmorphic card wrapper |
| `app/src/components/explorer/Explorer.jsx` | Explorer page layout (layer cards + sidebar + table) |
| `app/src/components/explorer/LayerCards.jsx` | Horizontal row of 8 OSAI layer summary cards |
| `app/src/components/explorer/FilterSidebar.jsx` | Left filter panel (layer, health, country, language, etc.) |
| `app/src/components/explorer/RepoTable.jsx` | Virtualized sortable table of repos |
| `app/src/components/explorer/RepoRow.jsx` | Single table row rendering |
| `app/src/components/explorer/Sparkline.jsx` | Mini SVG sparkline (13 weekly data points) |
| `app/src/components/explorer/DetailDrawer.jsx` | Slide-out project/repo detail panel |
| `app/src/components/explorer/HealthBadge.jsx` | Colored health dot + label |
| `app/src/components/explorer/SearchBar.jsx` | Global search input with debounce |
| `app/src/components/explorer/ArtifactList.jsx` | Package/model list for the drawer |
| `app/src/hooks/useExplorerData.js` | Load, index, and validate the JSON bundle |
| `app/src/hooks/useFilters.js` | Filter state + URL sync |
| `app/src/utils/health.js` | Health bucket/color/label helpers |
| `app/src/utils/format.js` | Number formatting (stars, counts) |
| `app/src/utils/search.js` | Text search index builder |
| `app/src/data/explorer-data.sample.json` | Committed sample data (~100 repos) for dev without API |

### Modified Files

| File | Change |
|------|--------|
| `app/package.json` | Add `react-router-dom`, `@tanstack/react-virtual` |
| `app/src/main.jsx` | Wrap App in `BrowserRouter` |
| `app/src/App.jsx` | Add `Routes` with `/` and `/explore` |
| `app/src/components/EcosystemSection.jsx` | Change `<a href="#">` to `<Link to="/explore">` |
| `app/src/styles/global.css` | Add explorer-specific styles |
| `app/vite.config.js` | Add SPA fallback for client-side routing |
| `app/.gitignore` | Add `src/data/explorer-data.json` |
| `scripts/export_website_data.py` | Full rewrite: 7 queries, validation, JSON bundle output |

---

## Task 1: Add Dependencies and Set Up Routing

**Files:**
- Modify: `app/package.json`
- Modify: `app/src/main.jsx`
- Modify: `app/src/App.jsx`
- Modify: `app/src/components/EcosystemSection.jsx:48-77`
- Modify: `app/vite.config.js`

- [ ] **Step 1: Install react-router-dom and @tanstack/react-virtual**

```bash
cd app && pnpm add react-router-dom @tanstack/react-virtual
```

- [ ] **Step 2: Wrap App in BrowserRouter**

Replace `app/src/main.jsx` with:

```jsx
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App.jsx';
import './styles/global.css';

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>,
);
```

- [ ] **Step 3: Add Routes to App.jsx**

Replace `app/src/App.jsx` with:

```jsx
import { useEffect, useRef, useState } from 'react';
import { Routes, Route } from 'react-router-dom';
import { EcosystemSection } from './components/EcosystemSection.jsx';
import { RoadmapSection } from './components/RoadmapSection.jsx';
import { HomeHero } from './components/HomeHero.jsx';
import { StorySection } from './components/StorySection.jsx';
import { MissionSection } from './components/MissionSection.jsx';
import { NavOverlay } from './components/NavOverlay.jsx';
import { SectionDots } from './components/SectionDots.jsx';
import { Chevron } from './components/Chevron.jsx';
import { Explorer } from './components/explorer/Explorer.jsx';

function LandingPage() {
  const [section, setSection] = useState(2);
  const [mode, setMode] = useState('dawn');
  const [atTop, setAtTop] = useState(false);
  const [atBot, setAtBot] = useState(false);
  const scrollRef = useRef(null);
  const sectionRefs = useRef([]);

  const scrollToSection = (idx) => {
    const container = scrollRef.current;
    const target = sectionRefs.current[idx];
    if (!container || !target) return;
    container.scrollTo({ top: target.offsetTop, behavior: 'smooth' });
  };

  const scrollByPage = (dir) => {
    const container = scrollRef.current;
    if (!container) return;
    container.scrollBy({ top: dir * window.innerHeight, behavior: 'smooth' });
  };

  useEffect(() => {
    const t = setTimeout(() => scrollToSection(2), 80);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    const container = scrollRef.current;
    if (!container) return;
    const onScroll = () => {
      const st = container.scrollTop;
      const ch = container.clientHeight;
      const sh = container.scrollHeight;
      setAtTop(st < 8);
      setAtBot(st + ch >= sh - 8);
      let active = 0;
      sectionRefs.current.forEach((ref, i) => {
        if (ref && ref.offsetTop <= st + ch * 0.45) active = i;
      });
      setSection(active);
    };
    container.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
    return () => container.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <div style={{ width: '100vw', height: '100vh', overflow: 'hidden', background: '#020508' }}>
      <div ref={scrollRef} className="scroll-container" style={{ width: '100%', height: '100%', overflowY: 'auto', overflowX: 'hidden' }}>
        <div ref={(el) => (sectionRefs.current[0] = el)} style={{ height: '100vh' }}>
          <EcosystemSection />
        </div>
        <div ref={(el) => (sectionRefs.current[1] = el)} style={{ height: '100vh' }}>
          <RoadmapSection mode={mode} />
        </div>
        <div ref={(el) => (sectionRefs.current[2] = el)} style={{ height: '100vh' }}>
          <HomeHero mode={mode} />
        </div>
        <div ref={(el) => (sectionRefs.current[3] = el)} style={{ height: '100vh' }}>
          <StorySection mode={mode} />
        </div>
        <div ref={(el) => (sectionRefs.current[4] = el)}>
          <MissionSection />
        </div>
      </div>

      <NavOverlay mode={mode} setMode={setMode} section={section} setSection={scrollToSection} />
      <SectionDots section={section} setSection={scrollToSection} />
      {!atTop && <Chevron dir="up" onClick={() => scrollByPage(-1)} />}
      {!atBot && <Chevron dir="down" onClick={() => scrollByPage(1)} />}
    </div>
  );
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/explore" element={<Explorer />} />
    </Routes>
  );
}
```

- [ ] **Step 4: Change EcosystemSection link to Router Link**

In `app/src/components/EcosystemSection.jsx`, change the `<a href="#">` at line 48 to a Router Link. Replace:

```jsx
        <a
          href="#"
```

with:

```jsx
        <Link
          to="/explore"
```

And add the import at the top of the file:

```jsx
import { Link } from 'react-router-dom';
```

Also change the closing `</a>` to `</Link>`.

- [ ] **Step 5: Add SPA fallback to Vite config**

Replace `app/vite.config.js` with:

```js
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    // SPA fallback — serve index.html for all routes
    historyApiFallback: true,
  },
});
```

Note: Vite dev server handles SPA fallback automatically for the dev server. For production, the hosting platform needs to be configured to serve `index.html` for all routes (Vercel/Netlify do this by default).

- [ ] **Step 6: Create placeholder Explorer component**

Create `app/src/components/explorer/Explorer.jsx`:

```jsx
import { Link } from 'react-router-dom';

export function Explorer() {
  return (
    <div style={{
      width: '100vw',
      height: '100vh',
      background: '#020508',
      color: '#fff',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      fontFamily: "'DM Sans', sans-serif",
    }}>
      <h1 style={{
        fontFamily: "'Cormorant Garamond', serif",
        fontSize: 'clamp(2rem, 5vw, 4rem)',
        fontWeight: 300,
        letterSpacing: '.03em',
        marginBottom: 16,
      }}>
        Ecosystem Explorer
      </h1>
      <p style={{ color: 'rgba(255,255,255,.5)', fontSize: 14 }}>
        Coming soon
      </p>
      <Link to="/" style={{
        marginTop: 24,
        color: 'rgba(255,255,255,.6)',
        fontSize: 13,
        textDecoration: 'none',
        border: '1px solid rgba(255,255,255,.15)',
        borderRadius: 6,
        padding: '7px 16px',
      }}>
        ← Back to landing
      </Link>
    </div>
  );
}
```

- [ ] **Step 7: Verify routing works**

```bash
cd app && pnpm dev
```

Open browser:
- `http://localhost:5173/` — landing page renders as before
- Click "Go to Ecosystem App" — navigates to `/explore`
- `http://localhost:5173/explore` — shows placeholder Explorer
- Click "← Back to landing" — returns to landing page

- [ ] **Step 8: Commit**

```bash
git add app/package.json app/pnpm-lock.yaml app/src/main.jsx app/src/App.jsx app/src/components/EcosystemSection.jsx app/src/components/explorer/Explorer.jsx app/vite.config.js
git commit -m "feat: add react-router with /explore route and placeholder explorer"
```

---

## Task 2: Utility Functions and Sample Data

**Files:**
- Create: `app/src/utils/health.js`
- Create: `app/src/utils/format.js`
- Create: `app/src/data/explorer-data.sample.json`
- Modify: `app/.gitignore` (create if needed)

- [ ] **Step 1: Create health utility**

Create `app/src/utils/health.js`:

```js
export function healthBucket(score) {
  if (score >= 70) return 'healthy';
  if (score >= 45) return 'fragile';
  return 'gap';
}

export function healthColor(score) {
  const b = healthBucket(score);
  if (b === 'healthy') return '#1b9e8a';
  if (b === 'fragile') return '#d9952a';
  return '#c8341d';
}

export function healthLabel(score) {
  const b = healthBucket(score);
  if (b === 'healthy') return 'Healthy';
  if (b === 'fragile') return 'Fragile';
  return 'Gap';
}
```

- [ ] **Step 2: Create format utility**

Create `app/src/utils/format.js`:

```js
export function formatStars(n) {
  if (n == null) return '—';
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${Math.round(n / 1_000)}k`;
  return String(n);
}

export function formatCount(n) {
  if (n == null || n === 0) return '—';
  return n.toLocaleString();
}
```

- [ ] **Step 3: Create sample data bundle**

Create `app/src/data/explorer-data.sample.json` — a minimal dataset with 2 layers, 4 subcategories, ~20 repos, a few packages/models, and sparkline data. This allows development without an API key.

```json
{
  "generated": "2026-04-29",
  "layers": [
    {
      "layer": "Infrastructure",
      "subcategories": [
        {
          "subcategory": "Training Frameworks",
          "subcategory_id": "training_frameworks",
          "gap_score": 4.2,
          "parity_verdict": "Near parity",
          "investment_ranking": { "gap_urgency": 20.0, "composite_score": 35.2 },
          "project_count": 8,
          "top_projects": ["pytorch", "jax", "tensorflow"]
        },
        {
          "subcategory": "Accelerator Runtimes",
          "subcategory_id": "accelerator_runtimes",
          "gap_score": 1.8,
          "parity_verdict": "Significant gap",
          "investment_ranking": { "gap_urgency": 80.0, "composite_score": 72.1 },
          "project_count": 3,
          "top_projects": ["rocm", "openxla"]
        }
      ]
    },
    {
      "layer": "Model Components: Code",
      "subcategories": [
        {
          "subcategory": "Fine-tuning Tools",
          "subcategory_id": "finetuning_tools",
          "gap_score": 3.5,
          "parity_verdict": "Partial parity",
          "investment_ranking": { "gap_urgency": 37.5, "composite_score": 45.0 },
          "project_count": 5,
          "top_projects": ["transformers", "peft", "axolotl"]
        },
        {
          "subcategory": "Inference Engines",
          "subcategory_id": "inference_engines",
          "gap_score": 4.5,
          "parity_verdict": "Near parity",
          "investment_ranking": { "gap_urgency": 12.5, "composite_score": 22.3 },
          "project_count": 6,
          "top_projects": ["vllm", "llama.cpp", "ollama"]
        }
      ]
    }
  ],
  "repos": [
    { "repo": "pytorch/pytorch", "category": "Machine Learning", "subcategory": "ML Frameworks", "stars": 82000, "star_7d": 320, "contributors": 4200, "language": "Python", "license": "BSD-3-Clause", "country": "US", "description": "Tensors and dynamic neural networks in Python", "stars_90d": 2400, "forks_90d": 180, "commits_90d": 890, "total_contributors": 4200, "full_time": 120, "part_time": 340 },
    { "repo": "google/jax", "category": "Machine Learning", "subcategory": "ML Frameworks", "stars": 30000, "star_7d": 110, "contributors": 890, "language": "Python", "license": "Apache-2.0", "country": "US", "description": "Composable transformations of Python+NumPy programs", "stars_90d": 980, "forks_90d": 45, "commits_90d": 420, "total_contributors": 890, "full_time": 45, "part_time": 120 },
    { "repo": "huggingface/transformers", "category": "Machine Learning", "subcategory": "Transformers", "stars": 134000, "star_7d": 580, "contributors": 2800, "language": "Python", "license": "Apache-2.0", "country": "France", "description": "State-of-the-art ML for PyTorch, TensorFlow, and JAX", "stars_90d": 4200, "forks_90d": 310, "commits_90d": 1200, "total_contributors": 2800, "full_time": 85, "part_time": 280 },
    { "repo": "vllm-project/vllm", "category": "Machine Learning", "subcategory": "Inference", "stars": 30000, "star_7d": 250, "contributors": 620, "language": "Python", "license": "Apache-2.0", "country": "US", "description": "High-throughput LLM serving engine", "stars_90d": 3100, "forks_90d": 120, "commits_90d": 560, "total_contributors": 620, "full_time": 28, "part_time": 95 },
    { "repo": "ggerganov/llama.cpp", "category": "Machine Learning", "subcategory": "Inference", "stars": 67000, "star_7d": 180, "contributors": 780, "language": "C++", "license": "MIT", "country": "Bulgaria", "description": "LLM inference in C/C++", "stars_90d": 1800, "forks_90d": 200, "commits_90d": 340, "total_contributors": 780, "full_time": 8, "part_time": 145 },
    { "repo": "ollama/ollama", "category": "Machine Learning", "subcategory": "Inference", "stars": 92000, "star_7d": 420, "contributors": 450, "language": "Go", "license": "MIT", "country": "US", "description": "Get up and running with large language models", "stars_90d": 5800, "forks_90d": 280, "commits_90d": 210, "total_contributors": 450, "full_time": 12, "part_time": 85 },
    { "repo": "microsoft/deepspeed", "category": "Machine Learning", "subcategory": "Training", "stars": 35000, "star_7d": 90, "contributors": 520, "language": "Python", "license": "Apache-2.0", "country": "US", "description": "Deep learning optimization library", "stars_90d": 800, "forks_90d": 60, "commits_90d": 180, "total_contributors": 520, "full_time": 22, "part_time": 88 },
    { "repo": "huggingface/peft", "category": "Machine Learning", "subcategory": "Fine-tuning", "stars": 16000, "star_7d": 45, "contributors": 210, "language": "Python", "license": "Apache-2.0", "country": "France", "description": "Parameter-Efficient Fine-Tuning", "stars_90d": 420, "forks_90d": 35, "commits_90d": 95, "total_contributors": 210, "full_time": 8, "part_time": 42 },
    { "repo": "ROCm/ROCm", "category": "Hardware", "subcategory": "GPU Runtimes", "stars": 5000, "star_7d": 12, "contributors": 180, "language": "C++", "license": "MIT", "country": "US", "description": "AMD ROCm platform", "stars_90d": 120, "forks_90d": 15, "commits_90d": 280, "total_contributors": 180, "full_time": 35, "part_time": 22 },
    { "repo": "openxla/xla", "category": "Hardware", "subcategory": "Compilers", "stars": 3000, "star_7d": 8, "contributors": 140, "language": "C++", "license": "Apache-2.0", "country": "US", "description": "ML compiler framework", "stars_90d": 80, "forks_90d": 10, "commits_90d": 190, "total_contributors": 140, "full_time": 28, "part_time": 18 }
  ],
  "projects": [
    { "project_slug": "pytorch", "display_name": "PyTorch", "total_stars": 82000, "stars_28d": 1200, "contributors_28d": 320, "full_time_28d": 120, "repo_count": 12, "package_count": 4, "model_count": 0, "direct_dependents": 1800, "total_dependents": 4200, "max_fragility_score": 0.12, "best_benchmark_avg": null, "primary_gap_score": 4.2, "investment_priority": 35.2 },
    { "project_slug": "transformers", "display_name": "Transformers", "total_stars": 134000, "stars_28d": 2100, "contributors_28d": 280, "full_time_28d": 85, "repo_count": 8, "package_count": 3, "model_count": 4200, "direct_dependents": 2400, "total_dependents": 5800, "max_fragility_score": 0.08, "best_benchmark_avg": null, "primary_gap_score": 3.5, "investment_priority": 45.0 },
    { "project_slug": "vllm", "display_name": "vLLM", "total_stars": 30000, "stars_28d": 1500, "contributors_28d": 95, "full_time_28d": 28, "repo_count": 3, "package_count": 1, "model_count": 0, "direct_dependents": 320, "total_dependents": 580, "max_fragility_score": 0.35, "best_benchmark_avg": null, "primary_gap_score": 4.5, "investment_priority": 22.3 },
    { "project_slug": "llama-cpp", "display_name": "llama.cpp", "total_stars": 67000, "stars_28d": 900, "contributors_28d": 145, "full_time_28d": 8, "repo_count": 2, "package_count": 2, "model_count": 0, "direct_dependents": 850, "total_dependents": 1200, "max_fragility_score": 0.62, "best_benchmark_avg": null, "primary_gap_score": 4.5, "investment_priority": 22.3 }
  ],
  "packages": [
    { "repo": "pytorch/pytorch", "project_slug": "pytorch", "package_source": "PIP", "package_name": "torch", "url": "https://pypi.org/project/torch" },
    { "repo": "huggingface/transformers", "project_slug": "transformers", "package_source": "PIP", "package_name": "transformers", "url": "https://pypi.org/project/transformers" },
    { "repo": "huggingface/peft", "project_slug": "transformers", "package_source": "PIP", "package_name": "peft", "url": "https://pypi.org/project/peft" },
    { "repo": "vllm-project/vllm", "project_slug": "vllm", "package_source": "PIP", "package_name": "vllm", "url": "https://pypi.org/project/vllm" }
  ],
  "models": [
    { "model_id": "meta-llama/Llama-3-8B", "repo": "meta-llama/llama3", "project_slug": "llama", "pipeline_tag": "text-generation", "library_name": "transformers", "downloads": 4500000, "likes": 2800, "model_family": "LLaMA", "benchmark_avg": 68.2, "architecture": "LlamaForCausalLM" },
    { "model_id": "mistralai/Mistral-7B-v0.3", "repo": "mistralai/mistral-src", "project_slug": "mistral", "pipeline_tag": "text-generation", "library_name": "transformers", "downloads": 2200000, "likes": 1500, "model_family": "Mistral", "benchmark_avg": 65.8, "architecture": "MistralForCausalLM" }
  ],
  "sparklines": {
    "pytorch/pytorch": { "stars": [280, 310, 290, 320, 340, 300, 280, 310, 330, 290, 320, 340, 310], "forks": [22, 18, 25, 20, 23, 19, 21, 24, 20, 22, 18, 25, 21], "contributors": [310, 315, 320, 318, 322, 325, 320, 318, 324, 328, 330, 325, 320] },
    "huggingface/transformers": { "stars": [480, 520, 510, 540, 560, 530, 490, 520, 550, 530, 560, 580, 540], "forks": [35, 30, 38, 32, 36, 28, 34, 31, 37, 33, 35, 30, 32], "contributors": [270, 275, 280, 278, 282, 285, 280, 278, 284, 288, 290, 285, 280] },
    "vllm-project/vllm": { "stars": [320, 350, 380, 340, 360, 390, 350, 370, 400, 380, 360, 390, 370], "forks": [12, 14, 11, 15, 13, 12, 14, 11, 16, 13, 14, 12, 15], "contributors": [88, 90, 92, 91, 93, 95, 92, 90, 94, 96, 95, 93, 95] },
    "ggerganov/llama.cpp": { "stars": [180, 200, 190, 210, 195, 185, 205, 195, 210, 200, 190, 205, 195], "forks": [25, 22, 28, 24, 26, 20, 23, 27, 22, 25, 21, 26, 24], "contributors": [140, 142, 145, 143, 146, 148, 145, 143, 147, 150, 148, 146, 145] }
  },
  "taxonomy": [
    { "project_slug": "pytorch", "osai_layer": "Infrastructure", "osai_subcategory": "Training Frameworks", "osai_subcategory_id": "training_frameworks", "gap_score": 4.2, "parity_verdict": "Near parity" },
    { "project_slug": "jax", "osai_layer": "Infrastructure", "osai_subcategory": "Training Frameworks", "osai_subcategory_id": "training_frameworks", "gap_score": 4.2, "parity_verdict": "Near parity" },
    { "project_slug": "transformers", "osai_layer": "Model Components: Code", "osai_subcategory": "Fine-tuning Tools", "osai_subcategory_id": "finetuning_tools", "gap_score": 3.5, "parity_verdict": "Partial parity" },
    { "project_slug": "vllm", "osai_layer": "Model Components: Code", "osai_subcategory": "Inference Engines", "osai_subcategory_id": "inference_engines", "gap_score": 4.5, "parity_verdict": "Near parity" },
    { "project_slug": "llama-cpp", "osai_layer": "Model Components: Code", "osai_subcategory": "Inference Engines", "osai_subcategory_id": "inference_engines", "gap_score": 4.5, "parity_verdict": "Near parity" },
    { "project_slug": "rocm", "osai_layer": "Infrastructure", "osai_subcategory": "Accelerator Runtimes", "osai_subcategory_id": "accelerator_runtimes", "gap_score": 1.8, "parity_verdict": "Significant gap" },
    { "project_slug": "openxla", "osai_layer": "Infrastructure", "osai_subcategory": "Accelerator Runtimes", "osai_subcategory_id": "accelerator_runtimes", "gap_score": 1.8, "parity_verdict": "Significant gap" }
  ]
}
```

- [ ] **Step 4: Add gitignore for generated data**

Create or append to `app/.gitignore`:

```
src/data/explorer-data.json
```

- [ ] **Step 5: Commit**

```bash
git add app/src/utils/health.js app/src/utils/format.js app/src/data/explorer-data.sample.json app/.gitignore
git commit -m "feat: add utility functions and sample data bundle"
```

---

## Task 3: Data Loading Hook and Search Index

**Files:**
- Create: `app/src/hooks/useExplorerData.js`
- Create: `app/src/utils/search.js`

- [ ] **Step 1: Create search index utility**

Create `app/src/utils/search.js`:

```js
export function buildSearchIndex(repos, packages, models) {
  const entries = [];
  const pkgByRepo = {};
  for (const p of packages) {
    if (!pkgByRepo[p.repo]) pkgByRepo[p.repo] = [];
    pkgByRepo[p.repo].push(p.package_name);
  }
  const modelByRepo = {};
  for (const m of models) {
    if (!modelByRepo[m.repo]) modelByRepo[m.repo] = [];
    modelByRepo[m.repo].push(m.model_id);
  }

  for (const repo of repos) {
    const parts = [
      repo.repo,
      repo.description || '',
      repo.category || '',
      repo.subcategory || '',
      repo.country || '',
      repo.language || '',
      repo.license || '',
      ...(pkgByRepo[repo.repo] || []),
      ...(modelByRepo[repo.repo] || []),
    ];
    entries.push({
      repo: repo.repo,
      text: parts.join(' ').toLowerCase(),
    });
  }
  return entries;
}

export function searchRepos(index, query) {
  if (!query) return null;
  const q = query.toLowerCase().trim();
  if (!q) return null;
  const terms = q.split(/\s+/);
  const matches = new Set();
  for (const entry of index) {
    if (terms.every((t) => entry.text.includes(t))) {
      matches.add(entry.repo);
    }
  }
  return matches;
}
```

- [ ] **Step 2: Create useExplorerData hook**

Create `app/src/hooks/useExplorerData.js`:

```js
import { useMemo } from 'react';
import { buildSearchIndex } from '../utils/search.js';
import sampleData from '../data/explorer-data.sample.json';

let _data;
try {
  _data = await import('../data/explorer-data.json');
  _data = _data.default;
} catch {
  _data = sampleData;
}

const REQUIRED_KEYS = ['generated', 'layers', 'repos', 'projects', 'packages', 'models', 'sparklines', 'taxonomy'];

export function useExplorerData() {
  const data = _data;

  const bundleError = useMemo(() => {
    const missing = REQUIRED_KEYS.filter((k) => !(k in data));
    if (missing.length > 0) return `Missing keys: ${missing.join(', ')}`;
    return null;
  }, [data]);

  const indexes = useMemo(() => {
    const repoToProject = {};
    for (const t of data.taxonomy) {
      repoToProject[t.project_slug] = repoToProject[t.project_slug] || t.project_slug;
    }

    const packagesByProject = {};
    const packagesByRepo = {};
    for (const p of data.packages) {
      if (p.project_slug) {
        if (!packagesByProject[p.project_slug]) packagesByProject[p.project_slug] = [];
        packagesByProject[p.project_slug].push(p);
      }
      if (!packagesByRepo[p.repo]) packagesByRepo[p.repo] = [];
      packagesByRepo[p.repo].push(p);
    }

    const modelsByProject = {};
    const modelsByRepo = {};
    for (const m of data.models) {
      if (m.project_slug) {
        if (!modelsByProject[m.project_slug]) modelsByProject[m.project_slug] = [];
        modelsByProject[m.project_slug].push(m);
      }
      if (m.repo) {
        if (!modelsByRepo[m.repo]) modelsByRepo[m.repo] = [];
        modelsByRepo[m.repo].push(m);
      }
    }

    const taxonomyByProject = {};
    for (const t of data.taxonomy) {
      if (!taxonomyByProject[t.project_slug]) taxonomyByProject[t.project_slug] = [];
      taxonomyByProject[t.project_slug].push(t);
    }

    const projectBySlug = {};
    for (const p of data.projects) {
      projectBySlug[p.project_slug] = p;
    }

    const searchIndex = buildSearchIndex(data.repos, data.packages, data.models);

    return {
      reposByProject,
      packagesByProject,
      packagesByRepo,
      modelsByProject,
      modelsByRepo,
      taxonomyByProject,
      projectBySlug,
      searchIndex,
    };
  }, [data]);

  const warnings = useMemo(() => {
    const w = [];
    const generated = new Date(data.generated);
    const age = (Date.now() - generated.getTime()) / (1000 * 60 * 60 * 24);
    if (age > 7) w.push({ type: 'stale', message: `Data is ${Math.floor(age)} days old` });

    for (const layer of data.layers) {
      for (const sub of layer.subcategories) {
        if (sub.project_count < 2) {
          w.push({ type: 'sparse', message: `${layer.layer} > ${sub.subcategory}: only ${sub.project_count} project(s)` });
        }
      }
    }
    return w;
  }, [data]);

  return { data, ...indexes, warnings, bundleError };
}
```

- [ ] **Step 3: Verify the hook loads sample data**

Update `app/src/components/explorer/Explorer.jsx` temporarily:

```jsx
import { Link } from 'react-router-dom';
import { useExplorerData } from '../../hooks/useExplorerData.js';

export function Explorer() {
  const { data, warnings } = useExplorerData();

  return (
    <div style={{
      width: '100vw',
      height: '100vh',
      background: '#020508',
      color: '#fff',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      fontFamily: "'DM Sans', sans-serif",
    }}>
      <h1 style={{
        fontFamily: "'Cormorant Garamond', serif",
        fontSize: 'clamp(2rem, 5vw, 4rem)',
        fontWeight: 300,
        letterSpacing: '.03em',
        marginBottom: 16,
      }}>
        Ecosystem Explorer
      </h1>
      <p style={{ color: 'rgba(255,255,255,.5)', fontSize: 14 }}>
        {data.repos.length} repos · {data.projects.length} projects · {data.layers.length} layers
      </p>
      {warnings.map((w, i) => (
        <p key={i} style={{ color: '#d9952a', fontSize: 12, marginTop: 4 }}>{w.message}</p>
      ))}
      <Link to="/" style={{
        marginTop: 24,
        color: 'rgba(255,255,255,.6)',
        fontSize: 13,
        textDecoration: 'none',
        border: '1px solid rgba(255,255,255,.15)',
        borderRadius: 6,
        padding: '7px 16px',
      }}>
        ← Back to landing
      </Link>
    </div>
  );
}
```

Run dev server and navigate to `/explore`. Should show "10 repos · 4 projects · 2 layers".

- [ ] **Step 4: Commit**

```bash
git add app/src/hooks/useExplorerData.js app/src/utils/search.js app/src/components/explorer/Explorer.jsx
git commit -m "feat: add data loading hook with search index and validation"
```

---

## Task 4: GlassCard, HealthBadge, and Sparkline Components

**Files:**
- Create: `app/src/components/GlassCard.jsx`
- Create: `app/src/components/explorer/HealthBadge.jsx`
- Create: `app/src/components/explorer/Sparkline.jsx`

- [ ] **Step 1: Create GlassCard**

Create `app/src/components/GlassCard.jsx`:

```jsx
export function GlassCard({ children, style, active, activeColor, onClick, ...props }) {
  const base = {
    background: active ? `${activeColor || 'rgba(255,255,255,.07)'}18` : 'rgba(255,255,255,.04)',
    backdropFilter: 'blur(12px)',
    WebkitBackdropFilter: 'blur(12px)',
    border: `1px solid ${active ? (activeColor || 'rgba(255,255,255,.3)') + '66' : 'rgba(255,255,255,.10)'}`,
    borderRadius: 10,
    transition: 'all 200ms ease',
    cursor: onClick ? 'pointer' : 'default',
    ...style,
  };

  return (
    <div
      style={base}
      onClick={onClick}
      onMouseEnter={(e) => {
        if (!active) {
          e.currentTarget.style.background = 'rgba(255,255,255,.07)';
          e.currentTarget.style.borderColor = 'rgba(255,255,255,.18)';
        }
      }}
      onMouseLeave={(e) => {
        if (!active) {
          e.currentTarget.style.background = base.background;
          e.currentTarget.style.borderColor = base.border.match(/1px solid (.+)/)?.[1] || '';
        }
      }}
      {...props}
    >
      {children}
    </div>
  );
}
```

- [ ] **Step 2: Create HealthBadge**

Create `app/src/components/explorer/HealthBadge.jsx`:

```jsx
import { healthColor, healthLabel } from '../../utils/health.js';

export function HealthBadge({ score, showLabel = false }) {
  const color = healthColor(score);
  const label = healthLabel(score);

  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
      <span style={{
        width: 8,
        height: 8,
        borderRadius: '50%',
        background: color,
        boxShadow: `0 0 6px ${color}60`,
        flexShrink: 0,
      }} />
      {showLabel && (
        <span style={{
          fontFamily: "'DM Mono', monospace",
          fontSize: 10,
          color: color,
          letterSpacing: '.04em',
        }}>
          {label}
        </span>
      )}
    </span>
  );
}
```

- [ ] **Step 3: Create Sparkline**

Create `app/src/components/explorer/Sparkline.jsx`:

```jsx
export function Sparkline({ data, width = 80, height = 24, color = 'rgba(255,255,255,.5)', filled = false }) {
  if (!data || data.length === 0) {
    return (
      <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
        <line x1={0} y1={height / 2} x2={width} y2={height / 2}
          stroke="rgba(255,255,255,.12)" strokeWidth={1} strokeDasharray="2,3" />
      </svg>
    );
  }

  const max = Math.max(...data, 1);
  const min = Math.min(...data, 0);
  const range = max - min || 1;
  const padY = 2;
  const usableHeight = height - padY * 2;

  const points = data.map((v, i) => {
    const x = (i / (data.length - 1)) * width;
    const y = padY + usableHeight - ((v - min) / range) * usableHeight;
    return `${x},${y}`;
  });

  const pathD = `M${points.join(' L')}`;
  const fillD = `${pathD} L${width},${height} L0,${height} Z`;

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
      {filled && (
        <path d={fillD} fill={color} opacity={0.12} />
      )}
      <path d={pathD} fill="none" stroke={color} strokeWidth={1.5}
        strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
```

- [ ] **Step 4: Verify components render with sample data**

Quick visual check: import Sparkline into Explorer and render a test sparkline. After confirming, revert the test.

- [ ] **Step 5: Commit**

```bash
git add app/src/components/GlassCard.jsx app/src/components/explorer/HealthBadge.jsx app/src/components/explorer/Sparkline.jsx
git commit -m "feat: add GlassCard, HealthBadge, and Sparkline components"
```

---

## Task 5: Filter State Hook with URL Sync

**Files:**
- Create: `app/src/hooks/useFilters.js`

- [ ] **Step 1: Create useFilters hook**

Create `app/src/hooks/useFilters.js`:

```js
import { useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { healthBucket } from '../utils/health.js';
import { searchRepos } from '../utils/search.js';

const ACTIVITY_THRESHOLDS = { high: 100, medium: 10 };

export function useFilters(data, indexes) {
  const [searchParams, setSearchParams] = useSearchParams();

  const filters = useMemo(() => ({
    layer: searchParams.get('layer') || null,
    subcategory: searchParams.get('subcategory') || null,
    health: searchParams.getAll('health'),
    country: searchParams.get('country') || null,
    license: searchParams.get('license') || null,
    activity: searchParams.get('activity') || null,
    hasPackages: searchParams.get('hasPackages') === 'true',
    hasModels: searchParams.get('hasModels') === 'true',
    q: searchParams.get('q') || '',
  }), [searchParams]);

  const setFilter = useCallback((key, value) => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      if (key === 'health') {
        next.delete('health');
        if (Array.isArray(value)) value.forEach((v) => next.append('health', v));
      } else if (value === null || value === '' || value === false) {
        next.delete(key);
      } else {
        next.set(key, String(value));
      }
      return next;
    }, { replace: true });
  }, [setSearchParams]);

  const clearFilters = useCallback(() => {
    setSearchParams({}, { replace: true });
  }, [setSearchParams]);

  const activeCount = useMemo(() => {
    let n = 0;
    if (filters.layer) n++;
    if (filters.subcategory) n++;
    if (filters.health.length) n++;
    if (filters.country) n++;
    if (filters.license) n++;
    if (filters.activity) n++;
    if (filters.hasPackages) n++;
    if (filters.hasModels) n++;
    if (filters.q) n++;
    return n;
  }, [filters]);

  const filteredRepos = useMemo(() => {
    let repos = data.repos;

    const searchMatches = searchRepos(indexes.searchIndex, filters.q);
    if (searchMatches) {
      repos = repos.filter((r) => searchMatches.has(r.repo));
    }

    if (filters.layer) {
      const projectsInLayer = new Set(
        data.taxonomy
          .filter((t) => t.osai_layer === filters.layer)
          .map((t) => t.project_slug)
      );
      repos = repos.filter((r) => {
        const slug = r.repo;
        return projectsInLayer.has(slug) || data.taxonomy.some(
          (t) => t.osai_layer === filters.layer && data.repos.some(
            (rr) => rr.repo === slug
          )
        );
      });
    }

    if (filters.subcategory) {
      const projectsInSub = new Set(
        data.taxonomy
          .filter((t) => t.osai_subcategory === filters.subcategory)
          .map((t) => t.project_slug)
      );
      repos = repos.filter((r) => projectsInSub.has(r.repo));
    }

    if (filters.health.length > 0) {
      const taxScores = {};
      for (const t of data.taxonomy) {
        if (!taxScores[t.project_slug] || t.gap_score < taxScores[t.project_slug]) {
          taxScores[t.project_slug] = t.gap_score;
        }
      }
      repos = repos.filter((r) => {
        const score = taxScores[r.repo];
        if (score == null) return filters.health.includes('gap');
        const h = (score / 5) * 100;
        return filters.health.includes(healthBucket(h));
      });
    }

    if (filters.country) {
      repos = repos.filter((r) => r.country === filters.country);
    }
    if (filters.license) {
      repos = repos.filter((r) => r.license === filters.license);
    }

    if (filters.activity === 'high') {
      repos = repos.filter((r) => r.commits_90d >= ACTIVITY_THRESHOLDS.high);
    } else if (filters.activity === 'medium') {
      repos = repos.filter((r) => r.commits_90d >= ACTIVITY_THRESHOLDS.medium && r.commits_90d < ACTIVITY_THRESHOLDS.high);
    } else if (filters.activity === 'low') {
      repos = repos.filter((r) => r.commits_90d < ACTIVITY_THRESHOLDS.medium);
    }

    if (filters.hasPackages) {
      repos = repos.filter((r) => indexes.packagesByRepo[r.repo]?.length > 0);
    }
    if (filters.hasModels) {
      repos = repos.filter((r) => indexes.modelsByRepo[r.repo]?.length > 0);
    }

    return repos;
  }, [data, indexes, filters]);

  const filterOptions = useMemo(() => {
    const countries = [...new Set(data.repos.map((r) => r.country).filter(Boolean))].sort();
    const licenses = [...new Set(data.repos.map((r) => r.license).filter(Boolean))].sort();
    const subcategories = filters.layer
      ? data.layers.find((l) => l.layer === filters.layer)?.subcategories.map((s) => s.subcategory) || []
      : [];
    return { countries, licenses, subcategories };
  }, [data, filters.layer]);

  return { filters, setFilter, clearFilters, activeCount, filteredRepos, filterOptions };
}
```

- [ ] **Step 2: Commit**

```bash
git add app/src/hooks/useFilters.js
git commit -m "feat: add filter state hook with URL sync and composable filters"
```

---

## Task 6: Layer Cards Component

**Files:**
- Create: `app/src/components/explorer/LayerCards.jsx`

- [ ] **Step 1: Create LayerCards**

Create `app/src/components/explorer/LayerCards.jsx`:

```jsx
import { GlassCard } from '../GlassCard.jsx';
import { HealthBadge } from './HealthBadge.jsx';
import { healthColor } from '../../utils/health.js';

export function LayerCards({ layers, activeLayer, onLayerClick }) {
  return (
    <div style={{
      display: 'flex',
      gap: 10,
      padding: '0 24px',
      overflowX: 'auto',
      scrollbarWidth: 'none',
    }}>
      {layers.map((layer) => {
        const avgGap = layer.subcategories.reduce((s, c) => s + c.gap_score, 0) / layer.subcategories.length;
        const healthScore = Math.round((avgGap / 5) * 100);
        const isActive = activeLayer === layer.layer;
        const color = healthColor(healthScore);

        return (
          <GlassCard
            key={layer.layer}
            active={isActive}
            activeColor={color}
            onClick={() => onLayerClick(isActive ? null : layer.layer)}
            style={{
              padding: '14px 18px',
              minWidth: 160,
              flexShrink: 0,
            }}
          >
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 8,
              marginBottom: 8,
            }}>
              <span style={{
                fontFamily: "'DM Sans', sans-serif",
                fontSize: 13,
                fontWeight: 500,
                color: isActive ? '#fff' : 'rgba(255,255,255,.85)',
              }}>
                {layer.layer}
              </span>
              <HealthBadge score={healthScore} />
            </div>
            <div style={{
              fontFamily: "'DM Mono', monospace",
              fontSize: 10,
              color: 'rgba(255,255,255,.4)',
              letterSpacing: '.06em',
              marginBottom: 6,
            }}>
              {layer.subcategories.length} subcategories
            </div>
            <div style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: 4,
            }}>
              {layer.subcategories
                .slice(0, 3)
                .flatMap((s) => s.top_projects?.slice(0, 1) || [])
                .slice(0, 3)
                .map((name) => (
                  <span key={name} style={{
                    fontSize: 10,
                    padding: '2px 7px',
                    borderRadius: 999,
                    background: 'rgba(255,255,255,.06)',
                    border: '1px solid rgba(255,255,255,.08)',
                    color: 'rgba(255,255,255,.55)',
                    whiteSpace: 'nowrap',
                  }}>
                    {name}
                  </span>
                ))}
            </div>
          </GlassCard>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add app/src/components/explorer/LayerCards.jsx
git commit -m "feat: add LayerCards component with health badges"
```

---

## Task 7: Filter Sidebar Component

**Files:**
- Create: `app/src/components/explorer/FilterSidebar.jsx`

- [ ] **Step 1: Create FilterSidebar**

Create `app/src/components/explorer/FilterSidebar.jsx`:

```jsx
const selectStyle = {
  width: '100%',
  background: 'rgba(255,255,255,.05)',
  border: '1px solid rgba(255,255,255,.12)',
  borderRadius: 6,
  color: '#fff',
  fontFamily: "'DM Sans', sans-serif",
  fontSize: 12,
  padding: '6px 8px',
  outline: 'none',
};

const labelStyle = {
  fontFamily: "'DM Mono', monospace",
  fontSize: 10,
  letterSpacing: '.08em',
  textTransform: 'uppercase',
  color: 'rgba(255,255,255,.4)',
  marginBottom: 6,
  display: 'block',
};

const checkboxRowStyle = {
  display: 'flex',
  alignItems: 'center',
  gap: 6,
  fontSize: 12,
  color: 'rgba(255,255,255,.7)',
  cursor: 'pointer',
  marginBottom: 4,
};

function FilterGroup({ label, children }) {
  return (
    <div style={{ marginBottom: 18 }}>
      <label style={labelStyle}>{label}</label>
      {children}
    </div>
  );
}

export function FilterSidebar({ filters, setFilter, clearFilters, activeCount, filterOptions, layers }) {
  const healthBuckets = ['healthy', 'fragile', 'gap'];

  const toggleHealth = (bucket) => {
    const current = filters.health;
    const next = current.includes(bucket)
      ? current.filter((h) => h !== bucket)
      : [...current, bucket];
    setFilter('health', next);
  };

  return (
    <div style={{
      width: 220,
      flexShrink: 0,
      padding: '16px 20px',
      borderRight: '1px solid rgba(255,255,255,.06)',
      overflowY: 'auto',
      height: '100%',
    }}>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 18,
      }}>
        <span style={{
          fontFamily: "'DM Sans', sans-serif",
          fontSize: 13,
          fontWeight: 500,
          color: '#fff',
        }}>
          Filters
          {activeCount > 0 && (
            <span style={{
              marginLeft: 6,
              background: 'rgba(255,255,255,.12)',
              borderRadius: 999,
              padding: '1px 7px',
              fontSize: 10,
              color: 'rgba(255,255,255,.7)',
            }}>
              {activeCount}
            </span>
          )}
        </span>
        {activeCount > 0 && (
          <button
            onClick={clearFilters}
            style={{
              background: 'none',
              border: 'none',
              color: 'rgba(255,255,255,.4)',
              fontSize: 11,
              cursor: 'pointer',
              fontFamily: "'DM Sans', sans-serif",
            }}
          >
            Clear all
          </button>
        )}
      </div>

      <FilterGroup label="Layer">
        <select
          style={selectStyle}
          value={filters.layer || ''}
          onChange={(e) => {
            setFilter('layer', e.target.value || null);
            setFilter('subcategory', null);
          }}
        >
          <option value="">All layers</option>
          {layers.map((l) => (
            <option key={l.layer} value={l.layer}>{l.layer}</option>
          ))}
        </select>
      </FilterGroup>

      {filterOptions.subcategories.length > 0 && (
        <FilterGroup label="Subcategory">
          <select
            style={selectStyle}
            value={filters.subcategory || ''}
            onChange={(e) => setFilter('subcategory', e.target.value || null)}
          >
            <option value="">All subcategories</option>
            {filterOptions.subcategories.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </FilterGroup>
      )}

      <FilterGroup label="Health">
        {healthBuckets.map((bucket) => (
          <label key={bucket} style={checkboxRowStyle}>
            <input
              type="checkbox"
              checked={filters.health.includes(bucket)}
              onChange={() => toggleHealth(bucket)}
              style={{ accentColor: bucket === 'healthy' ? '#1b9e8a' : bucket === 'fragile' ? '#d9952a' : '#c8341d' }}
            />
            <span style={{ textTransform: 'capitalize' }}>{bucket}</span>
          </label>
        ))}
      </FilterGroup>

      <FilterGroup label="Country">
        <select
          style={selectStyle}
          value={filters.country || ''}
          onChange={(e) => setFilter('country', e.target.value || null)}
        >
          <option value="">All countries</option>
          {filterOptions.countries.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
      </FilterGroup>

      <FilterGroup label="License">
        <select
          style={selectStyle}
          value={filters.license || ''}
          onChange={(e) => setFilter('license', e.target.value || null)}
        >
          <option value="">All licenses</option>
          {filterOptions.licenses.map((l) => (
            <option key={l} value={l}>{l}</option>
          ))}
        </select>
      </FilterGroup>

      <FilterGroup label="Activity (90d commits)">
        <select
          style={selectStyle}
          value={filters.activity || ''}
          onChange={(e) => setFilter('activity', e.target.value || null)}
        >
          <option value="">Any level</option>
          <option value="high">High (100+)</option>
          <option value="medium">Medium (10–99)</option>
          <option value="low">Low (&lt;10)</option>
        </select>
      </FilterGroup>

      <FilterGroup label="Artifacts">
        <label style={checkboxRowStyle}>
          <input
            type="checkbox"
            checked={filters.hasPackages}
            onChange={(e) => setFilter('hasPackages', e.target.checked)}
          />
          Has packages
        </label>
        <label style={checkboxRowStyle}>
          <input
            type="checkbox"
            checked={filters.hasModels}
            onChange={(e) => setFilter('hasModels', e.target.checked)}
          />
          Has models
        </label>
      </FilterGroup>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add app/src/components/explorer/FilterSidebar.jsx
git commit -m "feat: add FilterSidebar with all filter controls"
```

---

## Task 8: Virtualized Repo Table

**Files:**
- Create: `app/src/components/explorer/RepoRow.jsx`
- Create: `app/src/components/explorer/RepoTable.jsx`

- [ ] **Step 1: Create RepoRow**

Create `app/src/components/explorer/RepoRow.jsx`:

```jsx
import { Sparkline } from './Sparkline.jsx';
import { HealthBadge } from './HealthBadge.jsx';
import { formatStars, formatCount } from '../../utils/format.js';

const cellStyle = {
  padding: '0 8px',
  fontFamily: "'DM Sans', sans-serif",
  fontSize: 12,
  color: 'rgba(255,255,255,.75)',
  whiteSpace: 'nowrap',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
};

const monoStyle = {
  ...cellStyle,
  fontFamily: "'DM Mono', monospace",
  fontSize: 11,
};

export function RepoRow({ repo, sparkline, packageCount, modelCount, healthScore, onClick, style }) {
  return (
    <div
      onClick={onClick}
      style={{
        display: 'grid',
        gridTemplateColumns: '2.5fr 1fr 1fr 70px 90px 70px 80px 70px 50px 50px 36px',
        alignItems: 'center',
        height: 40,
        borderBottom: '1px solid rgba(255,255,255,.04)',
        cursor: 'pointer',
        transition: 'background 120ms ease',
        ...style,
      }}
      onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,.04)'; }}
      onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
    >
      <div style={{ ...cellStyle, fontWeight: 500, color: 'rgba(255,255,255,.9)' }}>
        {repo.repo}
      </div>
      <div style={cellStyle}>{repo.category || '—'}</div>
      <div style={cellStyle}>{repo.subcategory || '—'}</div>
      <div style={monoStyle}>{formatStars(repo.stars)}</div>
      <div style={{ padding: '0 4px' }}>
        <Sparkline data={sparkline?.stars} width={80} height={20} color="#1b9e8a" />
      </div>
      <div style={monoStyle}>{formatCount(repo.total_contributors)}</div>
      <div style={monoStyle}>{repo.license || '—'}</div>
      <div style={cellStyle}>{repo.country || '—'}</div>
      <div style={monoStyle}>{packageCount > 0 ? packageCount : '—'}</div>
      <div style={monoStyle}>{modelCount > 0 ? modelCount : '—'}</div>
      <div style={{ padding: '0 8px', display: 'flex', justifyContent: 'center' }}>
        {healthScore != null && <HealthBadge score={healthScore} />}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Create RepoTable with virtualization**

Create `app/src/components/explorer/RepoTable.jsx`:

```jsx
import { useState, useMemo, useRef } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { RepoRow } from './RepoRow.jsx';

const COLUMNS = [
  { key: 'repo', label: 'Name', sortable: true },
  { key: 'category', label: 'Category', sortable: true },
  { key: 'subcategory', label: 'Subcategory', sortable: true },
  { key: 'stars', label: 'Stars', sortable: true },
  { key: 'sparkline', label: '90d Activity', sortable: false },
  { key: 'total_contributors', label: 'Contributors', sortable: true },
  { key: 'license', label: 'License', sortable: true },
  { key: 'country', label: 'Country', sortable: true },
  { key: 'packages', label: 'Pkgs', sortable: true },
  { key: 'models', label: 'Models', sortable: true },
  { key: 'health', label: '', sortable: false },
];

const headerStyle = {
  display: 'grid',
  gridTemplateColumns: '2.5fr 1fr 1fr 70px 90px 70px 80px 70px 50px 50px 36px',
  borderBottom: '1px solid rgba(255,255,255,.08)',
  position: 'sticky',
  top: 0,
  zIndex: 2,
  background: '#0a0c12',
};

const headerCellStyle = {
  padding: '8px 8px',
  fontFamily: "'DM Mono', monospace",
  fontSize: 10,
  fontWeight: 600,
  letterSpacing: '.06em',
  textTransform: 'uppercase',
  color: 'rgba(255,255,255,.35)',
  cursor: 'pointer',
  userSelect: 'none',
  display: 'flex',
  alignItems: 'center',
  gap: 4,
};

export function RepoTable({ repos, sparklines, packagesByRepo, modelsByRepo, taxonomyByProject, onRowClick }) {
  const [sortKey, setSortKey] = useState('stars');
  const [sortDir, setSortDir] = useState('desc');
  const scrollRef = useRef(null);

  const handleSort = (key) => {
    if (!COLUMNS.find((c) => c.key === key)?.sortable) return;
    if (key === 'packages') key = '_pkgCount';
    if (key === 'models') key = '_modelCount';
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir('desc');
    }
  };

  const sorted = useMemo(() => {
    const arr = repos.map((r) => ({
      ...r,
      _pkgCount: packagesByRepo[r.repo]?.length || 0,
      _modelCount: modelsByRepo[r.repo]?.length || 0,
    }));
    arr.sort((a, b) => {
      let va = a[sortKey];
      let vb = b[sortKey];
      if (typeof va === 'string') va = va.toLowerCase();
      if (typeof vb === 'string') vb = vb.toLowerCase();
      if (va == null) va = sortDir === 'desc' ? -Infinity : Infinity;
      if (vb == null) vb = sortDir === 'desc' ? -Infinity : Infinity;
      if (va < vb) return sortDir === 'asc' ? -1 : 1;
      if (va > vb) return sortDir === 'asc' ? 1 : -1;
      return a.repo.localeCompare(b.repo);
    });
    return arr;
  }, [repos, sortKey, sortDir, packagesByRepo, modelsByRepo]);

  const virtualizer = useVirtualizer({
    count: sorted.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => 40,
    overscan: 20,
  });

  const getHealthScore = (repo) => {
    const tax = taxonomyByProject[repo.repo];
    if (!tax || tax.length === 0) return null;
    const minGap = Math.min(...tax.map((t) => t.gap_score));
    return Math.round((minGap / 5) * 100);
  };

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
      <div style={headerStyle}>
        {COLUMNS.map((col) => (
          <div
            key={col.key}
            style={{
              ...headerCellStyle,
              cursor: col.sortable ? 'pointer' : 'default',
            }}
            onClick={() => col.sortable && handleSort(col.key)}
          >
            {col.label}
            {col.sortable && sortKey === col.key && (
              <span style={{ fontSize: 8 }}>{sortDir === 'asc' ? '▲' : '▼'}</span>
            )}
          </div>
        ))}
      </div>

      <div style={{
        fontFamily: "'DM Mono', monospace",
        fontSize: 10,
        color: 'rgba(255,255,255,.3)',
        padding: '6px 8px',
        borderBottom: '1px solid rgba(255,255,255,.04)',
      }}>
        {sorted.length.toLocaleString()} repos
      </div>

      <div
        ref={scrollRef}
        style={{ flex: 1, overflowY: 'auto', scrollbarWidth: 'thin' }}
      >
        <div style={{ height: virtualizer.getTotalSize(), position: 'relative' }}>
          {virtualizer.getVirtualItems().map((item) => {
            const repo = sorted[item.index];
            return (
              <div
                key={repo.repo}
                style={{
                  position: 'absolute',
                  top: item.start,
                  left: 0,
                  right: 0,
                  height: item.size,
                }}
              >
                <RepoRow
                  repo={repo}
                  sparkline={sparklines[repo.repo]}
                  packageCount={repo._pkgCount}
                  modelCount={repo._modelCount}
                  healthScore={getHealthScore(repo)}
                  onClick={() => onRowClick(repo)}
                />
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add app/src/components/explorer/RepoRow.jsx app/src/components/explorer/RepoTable.jsx
git commit -m "feat: add virtualized RepoTable with sortable columns"
```

---

## Task 9: Search Bar Component

**Files:**
- Create: `app/src/components/explorer/SearchBar.jsx`

- [ ] **Step 1: Create SearchBar**

Create `app/src/components/explorer/SearchBar.jsx`:

```jsx
import { useState, useEffect, useRef } from 'react';

export function SearchBar({ value, onChange }) {
  const [local, setLocal] = useState(value);
  const timerRef = useRef(null);

  useEffect(() => {
    setLocal(value);
  }, [value]);

  const handleChange = (e) => {
    const v = e.target.value;
    setLocal(v);
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => onChange(v), 150);
  };

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: 8,
      background: 'rgba(255,255,255,.05)',
      border: '1px solid rgba(255,255,255,.10)',
      borderRadius: 8,
      padding: '6px 12px',
      minWidth: 240,
    }}>
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,.35)" strokeWidth="2" strokeLinecap="round">
        <circle cx="11" cy="11" r="8" />
        <line x1="21" y1="21" x2="16.65" y2="16.65" />
      </svg>
      <input
        type="text"
        value={local}
        onChange={handleChange}
        placeholder="Search repos, packages, models..."
        style={{
          background: 'transparent',
          border: 'none',
          outline: 'none',
          color: '#fff',
          fontFamily: "'DM Sans', sans-serif",
          fontSize: 13,
          flex: 1,
        }}
      />
      {local && (
        <button
          onClick={() => { setLocal(''); onChange(''); }}
          style={{
            background: 'none',
            border: 'none',
            color: 'rgba(255,255,255,.35)',
            cursor: 'pointer',
            fontSize: 14,
            lineHeight: 1,
            padding: 0,
          }}
        >
          ×
        </button>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add app/src/components/explorer/SearchBar.jsx
git commit -m "feat: add SearchBar with debounced input"
```

---

## Task 10: Assemble the Explorer Page

**Files:**
- Modify: `app/src/components/explorer/Explorer.jsx`

- [ ] **Step 1: Wire up Explorer with all components**

Replace `app/src/components/explorer/Explorer.jsx` with:

```jsx
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useExplorerData } from '../../hooks/useExplorerData.js';
import { useFilters } from '../../hooks/useFilters.js';
import { PALETTES } from '../../data/palettes.js';
import { LayerCards } from './LayerCards.jsx';
import { FilterSidebar } from './FilterSidebar.jsx';
import { RepoTable } from './RepoTable.jsx';
import { SearchBar } from './SearchBar.jsx';

export function Explorer() {
  const explorerData = useExplorerData();
  const { data, warnings, bundleError, packagesByRepo, modelsByRepo, taxonomyByProject } = explorerData;
  const { filters, setFilter, clearFilters, activeCount, filteredRepos, filterOptions } = useFilters(data, explorerData);
  const [drawerRepo, setDrawerRepo] = useState(null);
  const [mode, setMode] = useState('dawn');

  if (bundleError) {
    return (
      <div style={{ width: '100vw', height: '100vh', background: '#020508', color: '#c8341d', display: 'grid', placeItems: 'center', fontFamily: "'DM Sans', sans-serif" }}>
        <div style={{ textAlign: 'center' }}>
          <h2 style={{ fontFamily: "'Cormorant Garamond', serif", fontWeight: 300, color: '#fff', marginBottom: 12 }}>Data Error</h2>
          <p style={{ fontSize: 14 }}>{bundleError}</p>
          <Link to="/" style={{ color: 'rgba(255,255,255,.5)', fontSize: 13, textDecoration: 'none', marginTop: 16, display: 'inline-block' }}>← Back to landing</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="grain" style={{
      width: '100vw',
      height: '100vh',
      background: '#020508',
      color: '#fff',
      display: 'flex',
      flexDirection: 'column',
      fontFamily: "'DM Sans', sans-serif",
      overflow: 'hidden',
    }}>
      {/* Nav bar */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '12px 24px',
        borderBottom: '1px solid rgba(255,255,255,.06)',
        flexShrink: 0,
      }}>
        <Link to="/" style={{
          color: 'rgba(255,255,255,.5)',
          textDecoration: 'none',
          fontSize: 13,
          display: 'flex',
          alignItems: 'center',
          gap: 6,
        }}>
          ← <span style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 16, fontWeight: 300, color: 'rgba(255,255,255,.7)' }}>Current AI</span>
        </Link>
        <div style={{ flex: 1 }} />
        <SearchBar value={filters.q} onChange={(q) => setFilter('q', q)} />
        <button
          onClick={() => setMode((m) => (m === 'dawn' ? 'dusk' : 'dawn'))}
          style={{
            background: 'rgba(255,255,255,.07)',
            backdropFilter: 'blur(12px)',
            border: '1px solid rgba(255,255,255,.12)',
            borderRadius: 6,
            color: '#fff',
            fontFamily: "'DM Mono', monospace",
            fontSize: 10,
            letterSpacing: '.08em',
            textTransform: 'uppercase',
            padding: '6px 12px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: 6,
          }}
        >
          <span style={{ fontSize: 13, lineHeight: 1 }}>{PALETTES[mode].icon}</span>
          {PALETTES[mode].label}
        </button>
        {warnings.some((w) => w.type === 'stale') && (
          <span style={{
            fontFamily: "'DM Mono', monospace",
            fontSize: 10,
            color: '#d9952a',
            letterSpacing: '.04em',
          }}>
            {warnings.find((w) => w.type === 'stale').message}
          </span>
        )}
      </div>

      {/* Layer cards */}
      <div style={{ padding: '16px 0', flexShrink: 0 }}>
        <LayerCards
          layers={data.layers}
          activeLayer={filters.layer}
          onLayerClick={(layer) => {
            setFilter('layer', layer);
            setFilter('subcategory', null);
          }}
        />
      </div>

      {/* Main content: sidebar + table */}
      <div style={{ flex: 1, display: 'flex', minHeight: 0 }}>
        <FilterSidebar
          filters={filters}
          setFilter={setFilter}
          clearFilters={clearFilters}
          activeCount={activeCount}
          filterOptions={filterOptions}
          layers={data.layers}
        />
        <RepoTable
          repos={filteredRepos}
          sparklines={data.sparklines}
          packagesByRepo={packagesByRepo}
          modelsByRepo={modelsByRepo}
          taxonomyByProject={taxonomyByProject}
          onRowClick={(repo) => setDrawerRepo(repo)}
        />
      </div>

      {/* Drawer placeholder — wired in Task 11 */}
    </div>
  );
}
```

- [ ] **Step 2: Verify the full explorer renders**

```bash
cd app && pnpm dev
```

Navigate to `/explore`. Should see:
- Nav bar with search and back link
- 2 layer cards (from sample data)
- Filter sidebar on the left
- Table with ~10 sample repos, sortable columns, sparklines

- [ ] **Step 3: Commit**

```bash
git add app/src/components/explorer/Explorer.jsx
git commit -m "feat: assemble Explorer page with layer cards, filters, and table"
```

---

## Task 11: Detail Drawer and Artifact List

**Files:**
- Create: `app/src/components/explorer/ArtifactList.jsx`
- Create: `app/src/components/explorer/DetailDrawer.jsx`
- Modify: `app/src/components/explorer/Explorer.jsx`

- [ ] **Step 1: Create ArtifactList**

Create `app/src/components/explorer/ArtifactList.jsx`:

```jsx
import { formatStars, formatCount } from '../../utils/format.js';

const PACKAGE_ICONS = {
  PIP: '🐍', NPM: '📦', GO: '🔵', RUST: '🦀', MAVEN: '☕', NUGET: '💜',
};

export function PackageList({ packages }) {
  if (!packages || packages.length === 0) return null;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {packages.map((p) => (
        <a
          key={`${p.package_source}-${p.package_name}`}
          href={p.url}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '8px 10px',
            background: 'rgba(255,255,255,.03)',
            border: '1px solid rgba(255,255,255,.06)',
            borderRadius: 6,
            textDecoration: 'none',
            color: 'rgba(255,255,255,.75)',
            fontSize: 12,
            transition: 'border-color 150ms',
          }}
          onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'rgba(255,255,255,.15)'; }}
          onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'rgba(255,255,255,.06)'; }}
        >
          <span>{PACKAGE_ICONS[p.package_source] || '📦'}</span>
          <span style={{ flex: 1, fontFamily: "'DM Mono', monospace", fontSize: 11 }}>{p.package_name}</span>
          <span style={{ fontSize: 10, color: 'rgba(255,255,255,.35)', textTransform: 'uppercase', letterSpacing: '.06em' }}>{p.package_source}</span>
        </a>
      ))}
    </div>
  );
}

export function ModelList({ models }) {
  if (!models || models.length === 0) return null;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {models.map((m) => (
        <a
          key={m.model_id}
          href={m.url || `https://huggingface.co/${m.model_id}`}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr auto auto',
            gap: 8,
            alignItems: 'center',
            padding: '8px 10px',
            background: 'rgba(255,255,255,.03)',
            border: '1px solid rgba(255,255,255,.06)',
            borderRadius: 6,
            textDecoration: 'none',
            color: 'rgba(255,255,255,.75)',
            fontSize: 12,
            transition: 'border-color 150ms',
          }}
          onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'rgba(255,255,255,.15)'; }}
          onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'rgba(255,255,255,.06)'; }}
        >
          <div>
            <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 11 }}>{m.model_id}</div>
            <div style={{ fontSize: 10, color: 'rgba(255,255,255,.35)', marginTop: 2 }}>
              {[m.pipeline_tag, m.library_name, m.model_family].filter(Boolean).join(' · ')}
            </div>
          </div>
          <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, color: 'rgba(255,255,255,.4)' }}>
            ↓{formatStars(m.downloads)}
          </div>
          {m.benchmark_avg != null && (
            <div style={{
              fontFamily: "'DM Mono', monospace",
              fontSize: 10,
              padding: '2px 6px',
              background: 'rgba(27,158,138,.15)',
              borderRadius: 4,
              color: '#1b9e8a',
            }}>
              {m.benchmark_avg.toFixed(1)}
            </div>
          )}
        </a>
      ))}
    </div>
  );
}
```

- [ ] **Step 2: Create DetailDrawer**

Create `app/src/components/explorer/DetailDrawer.jsx`:

```jsx
import { useEffect, useCallback } from 'react';
import { Sparkline } from './Sparkline.jsx';
import { HealthBadge } from './HealthBadge.jsx';
import { PackageList, ModelList } from './ArtifactList.jsx';
import { formatStars, formatCount } from '../../utils/format.js';
import { healthColor } from '../../utils/health.js';

function SectionHeader({ children }) {
  return (
    <div style={{
      fontFamily: "'DM Mono', monospace",
      fontSize: 10,
      letterSpacing: '.08em',
      textTransform: 'uppercase',
      color: 'rgba(255,255,255,.3)',
      marginTop: 24,
      marginBottom: 10,
    }}>
      {children}
    </div>
  );
}

function StatBox({ label, value }) {
  return (
    <div style={{ textAlign: 'center' }}>
      <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 18, fontWeight: 500, color: '#fff' }}>{value}</div>
      <div style={{ fontSize: 10, color: 'rgba(255,255,255,.35)', marginTop: 2, letterSpacing: '.04em' }}>{label}</div>
    </div>
  );
}

export function DetailDrawer({ repo, project, taxonomy, packages, models, sparkline, adjacentProjects, onClose, onNavigate }) {
  const handleKeyDown = useCallback((e) => {
    if (e.key === 'Escape') onClose();
  }, [onClose]);

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  if (!repo) return null;

  const displayName = project?.display_name || repo.repo;
  const gapScore = taxonomy?.[0]?.gap_score;
  const healthScore = gapScore != null ? Math.round((gapScore / 5) * 100) : null;

  return (
    <>
      {/* Scrim */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(2,5,8,.65)',
          backdropFilter: 'blur(2px)',
          zIndex: 80,
        }}
      />

      {/* Drawer */}
      <div style={{
        position: 'fixed',
        top: 0,
        right: 0,
        bottom: 0,
        width: 'min(600px, 92vw)',
        background: 'rgba(10,12,18,.97)',
        backdropFilter: 'blur(20px)',
        borderLeft: '1px solid rgba(255,255,255,.08)',
        zIndex: 90,
        display: 'flex',
        flexDirection: 'column',
        boxShadow: '-24px 0 60px -30px rgba(0,0,0,.6)',
      }}>
        {/* Header */}
        <div style={{
          padding: '20px 24px 16px',
          borderBottom: '1px solid rgba(255,255,255,.06)',
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          gap: 12,
        }}>
          <div>
            {taxonomy?.length > 0 && (
              <div style={{
                fontFamily: "'DM Mono', monospace",
                fontSize: 10,
                letterSpacing: '.08em',
                textTransform: 'uppercase',
                color: 'rgba(255,255,255,.3)',
                marginBottom: 6,
              }}>
                {taxonomy[0].osai_layer} · {taxonomy[0].osai_subcategory}
              </div>
            )}
            <div style={{
              fontFamily: "'Cormorant Garamond', serif",
              fontSize: 28,
              fontWeight: 300,
              color: '#fff',
              lineHeight: 1.1,
            }}>
              {displayName}
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'rgba(255,255,255,.06)',
              border: '1px solid rgba(255,255,255,.10)',
              borderRadius: '50%',
              width: 30,
              height: 30,
              color: 'rgba(255,255,255,.5)',
              cursor: 'pointer',
              fontSize: 14,
              display: 'grid',
              placeItems: 'center',
              flexShrink: 0,
            }}
          >
            ×
          </button>
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '0 24px 24px', scrollbarWidth: 'thin' }}>
          {/* Health card */}
          {healthScore != null && (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: 14,
              padding: '14px 16px',
              marginTop: 16,
              background: 'rgba(255,255,255,.03)',
              border: '1px solid rgba(255,255,255,.06)',
              borderRadius: 10,
            }}>
              <div style={{
                width: 48,
                height: 48,
                borderRadius: '50%',
                background: `conic-gradient(${healthColor(healthScore)} ${healthScore * 3.6}deg, rgba(255,255,255,.06) 0)`,
                display: 'grid',
                placeItems: 'center',
                flexShrink: 0,
              }}>
                <span style={{
                  width: 36,
                  height: 36,
                  borderRadius: '50%',
                  background: 'rgba(10,12,18,.97)',
                  display: 'grid',
                  placeItems: 'center',
                  fontFamily: "'DM Mono', monospace",
                  fontSize: 14,
                  fontWeight: 500,
                  color: '#fff',
                }}>
                  {healthScore}
                </span>
              </div>
              <div>
                <HealthBadge score={healthScore} showLabel />
                {taxonomy?.[0]?.parity_verdict && (
                  <div style={{ fontSize: 12, color: 'rgba(255,255,255,.5)', marginTop: 2 }}>
                    {taxonomy[0].parity_verdict}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Stats row */}
          {project && (
            <>
              <SectionHeader>Overview</SectionHeader>
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(3, 1fr)',
                gap: 12,
                padding: '12px 0',
              }}>
                <StatBox label="Stars" value={formatStars(project.total_stars)} />
                <StatBox label="Contributors (28d)" value={formatCount(project.contributors_28d)} />
                <StatBox label="Full-time (28d)" value={formatCount(project.full_time_28d)} />
                <StatBox label="Repos" value={project.repo_count} />
                <StatBox label="Packages" value={project.package_count || '—'} />
                <StatBox label="Models" value={project.model_count || '—'} />
              </div>
            </>
          )}

          {/* Activity sparkline (larger) */}
          {sparkline && (
            <>
              <SectionHeader>Activity (90 days)</SectionHeader>
              <div style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr 1fr',
                gap: 12,
              }}>
                {[
                  { key: 'stars', label: 'Stars', color: '#1b9e8a' },
                  { key: 'forks', label: 'Forks', color: '#d9952a' },
                  { key: 'contributors', label: 'Contributors', color: '#E8796A' },
                ].map(({ key, label, color }) => (
                  <div key={key}>
                    <div style={{ fontSize: 10, color: 'rgba(255,255,255,.35)', marginBottom: 4, letterSpacing: '.04em' }}>{label}</div>
                    <Sparkline data={sparkline[key]} width={160} height={40} color={color} filled />
                  </div>
                ))}
              </div>
            </>
          )}

          {/* Packages */}
          {packages?.length > 0 && (
            <>
              <SectionHeader>Packages · {packages.length}</SectionHeader>
              <PackageList packages={packages} />
            </>
          )}

          {/* Models */}
          {models?.length > 0 && (
            <>
              <SectionHeader>Models · {models.length}</SectionHeader>
              <ModelList models={models} />
            </>
          )}

          {/* Dependency info */}
          {project && (project.direct_dependents > 0 || project.max_fragility_score > 0) && (
            <>
              <SectionHeader>Dependencies</SectionHeader>
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(3, 1fr)',
                gap: 12,
                padding: '12px 0',
              }}>
                <StatBox label="Direct dependents" value={formatCount(project.direct_dependents)} />
                <StatBox label="Total dependents" value={formatCount(project.total_dependents)} />
                <StatBox label="Fragility" value={project.max_fragility_score?.toFixed(2) || '—'} />
              </div>
            </>
          )}

          {/* Taxonomy placements */}
          {taxonomy?.length > 1 && (
            <>
              <SectionHeader>Taxonomy placements · {taxonomy.length}</SectionHeader>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {taxonomy.map((t, i) => (
                  <span key={i} style={{
                    fontSize: 11,
                    padding: '4px 10px',
                    borderRadius: 999,
                    background: 'rgba(255,255,255,.04)',
                    border: '1px solid rgba(255,255,255,.08)',
                    color: 'rgba(255,255,255,.6)',
                  }}>
                    {t.osai_layer} → {t.osai_subcategory}
                  </span>
                ))}
              </div>
            </>
          )}

          {/* Adjacent projects */}
          {adjacentProjects?.length > 0 && (
            <>
              <SectionHeader>Related projects</SectionHeader>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {adjacentProjects.map((p) => (
                  <button
                    key={p.project_slug}
                    onClick={() => onNavigate(p)}
                    style={{
                      fontSize: 11,
                      padding: '4px 10px',
                      borderRadius: 999,
                      background: 'rgba(255,255,255,.04)',
                      border: '1px solid rgba(255,255,255,.10)',
                      color: 'rgba(255,255,255,.7)',
                      cursor: 'pointer',
                      fontFamily: "'DM Sans', sans-serif",
                    }}
                  >
                    {p.display_name || p.project_slug} · {formatStars(p.total_stars)}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </>
  );
}
```

- [ ] **Step 3: Wire drawer into Explorer.jsx**

Add the drawer to `Explorer.jsx`. After the `{/* Drawer placeholder */}` comment, add:

```jsx
import { DetailDrawer } from './DetailDrawer.jsx';
```

(at the top with other imports)

And replace the `{/* Drawer placeholder — wired in Task 11 */}` comment with:

```jsx
      {drawerRepo && (() => {
        // Resolve project slug for this repo via taxonomy
        const repoTax = data.taxonomy.filter((t) =>
          data.repos.some((r) => r.repo === drawerRepo.repo && data.taxonomy.some(
            (tt) => tt.project_slug === t.project_slug
          ))
        );
        // Direct lookup: taxonomy maps project_slug, repos use repo name
        // Find the project_slug that owns this repo
        const projectSlug = data.taxonomy.find((t) => t.project_slug === drawerRepo.repo)?.project_slug
          || data.taxonomy.find((t) => data.repos.some(
            (r) => r.repo === drawerRepo.repo
          ) && t.project_slug)?.project_slug;
        const project = explorerData.projectBySlug[projectSlug];
        const taxonomy = explorerData.taxonomyByProject[projectSlug] || explorerData.taxonomyByProject[drawerRepo.repo] || [];
        const sub = taxonomy[0]?.osai_subcategory;
        const adjacentSlugs = sub ? [...new Set(
          data.taxonomy
            .filter((t) => t.osai_subcategory === sub && t.project_slug !== projectSlug && t.project_slug !== drawerRepo.repo)
            .map((t) => t.project_slug)
        )] : [];
        const adjacentProjects = adjacentSlugs
          .map((s) => explorerData.projectBySlug[s])
          .filter(Boolean)
          .sort((a, b) => (b.total_stars || 0) - (a.total_stars || 0))
          .slice(0, 5);

        return (
        <DetailDrawer
          repo={drawerRepo}
          project={project}
          taxonomy={taxonomy}
          packages={explorerData.packagesByRepo[drawerRepo.repo] || explorerData.packagesByProject[projectSlug]}
          models={explorerData.modelsByRepo[drawerRepo.repo] || explorerData.modelsByProject[projectSlug]}
          sparkline={data.sparklines[drawerRepo.repo]}
          adjacentProjects={adjacentProjects}
          onClose={() => setDrawerRepo(null)}
          onNavigate={(proj) => {
            // Find a repo belonging to this project
            const targetRepo = data.repos.find((r) =>
              data.taxonomy.some((t) => t.project_slug === proj.project_slug)
              && r.repo.includes(proj.project_slug)
            ) || data.repos.find((r) => r.repo === proj.project_slug);
            if (targetRepo) setDrawerRepo(targetRepo);
          }}
        />
        );
      })()}
```

- [ ] **Step 4: Verify drawer opens and closes**

In the browser, click a repo row. Drawer should slide in showing project details, sparklines, packages, models. Press Escape or click the scrim to close.

- [ ] **Step 5: Commit**

```bash
git add app/src/components/explorer/ArtifactList.jsx app/src/components/explorer/DetailDrawer.jsx app/src/components/explorer/Explorer.jsx
git commit -m "feat: add DetailDrawer with artifacts, sparklines, and adjacent projects"
```

---

## Task 12: Explorer CSS and Polish

**Files:**
- Modify: `app/src/styles/global.css`

- [ ] **Step 1: Add explorer styles to global.css**

Append to `app/src/styles/global.css`:

```css

/* ---------- Explorer ---------- */
.explorer-sidebar::-webkit-scrollbar {
  width: 3px;
}
.explorer-sidebar::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.08);
  border-radius: 2px;
}

.explorer-table::-webkit-scrollbar {
  width: 4px;
}
.explorer-table::-webkit-scrollbar-track {
  background: transparent;
}
.explorer-table::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.1);
  border-radius: 2px;
}

.drawer-body::-webkit-scrollbar {
  width: 3px;
}
.drawer-body::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.08);
  border-radius: 2px;
}

/* Layer cards horizontal scroll */
.layer-cards-row::-webkit-scrollbar {
  display: none;
}
.layer-cards-row {
  scrollbar-width: none;
}

/* Select dropdown styling for dark backgrounds */
.explorer-sidebar select option {
  background: #0a0c12;
  color: #fff;
}
```

- [ ] **Step 2: Add className references to components**

Add `className="explorer-sidebar"` to the FilterSidebar root div, `className="explorer-table"` to the RepoTable scroll div, `className="drawer-body"` to the DetailDrawer body div, and `className="layer-cards-row"` to the LayerCards container.

- [ ] **Step 3: Commit**

```bash
git add app/src/styles/global.css app/src/components/explorer/FilterSidebar.jsx app/src/components/explorer/RepoTable.jsx app/src/components/explorer/DetailDrawer.jsx app/src/components/explorer/LayerCards.jsx
git commit -m "feat: add explorer CSS for scrollbars and dark select dropdowns"
```

---

## Task 13: Export Script Enhancement

**Files:**
- Modify: `scripts/export_website_data.py`

- [ ] **Step 1: Rewrite the export script**

Replace `scripts/export_website_data.py` with the full implementation. This is the largest single step — the script queries all 7 data sources, assembles the bundle, runs validation, and writes JSON.

```python
"""
Export warehouse data to JSON bundle for the Ecosystem Explorer.

Queries 7 tables from the currentai org and produces a single
explorer-data.json with layers, projects, repos, packages, models,
sparklines, and taxonomy.

Usage:
    uv run scripts/export_website_data.py --output app/src/data/explorer-data.json
    uv run scripts/export_website_data.py --output app/src/data/explorer-data.json --skip-validation
    uv run scripts/export_website_data.py --validate-only app/src/data/explorer-data.json
"""

import argparse
import datetime
import json
import os
import sys

try:
    from pyoso import Client
except ImportError:
    print("pyoso not installed. Run: uv sync")
    sys.exit(1)


SPOT_CHECKS = {
    "Infrastructure": ["pytorch", "ray"],
    "Model Components: Code": ["transformers", "deepspeed"],
    "Model Components: Datasets": ["huggingface/datasets", "common-crawl"],
    "Model Components: Weights": ["llama", "mistral"],
    "Product/UX": ["langchain", "open-webui"],
    "Documentation": [],
    "Licensing": [],
    "Safeguards": ["guardrails"],
}


def get_client():
    if not os.environ.get("OSO_API_KEY"):
        print("OSO_API_KEY not set.")
        sys.exit(1)
    return Client()


def query_layers(client):
    print("  Querying layers (gap_map + investment_ranking)...")
    gap_df = client.to_pandas("""
        SELECT layer, subcategory, subcategory_id,
               CAST(overall_score AS DOUBLE) AS overall_score,
               maturity, parity_verdict
        FROM currentai.catalog.osai_gap_map
        WHERE subcategory_id IS NOT NULL AND subcategory_id != ''
    """)
    inv_df = client.to_pandas("""
        SELECT layer, subcategory, gap_urgency, composite_score,
               dep_centrality, fragility_risk, top_repo, repo_count
        FROM currentai.scores.investment_ranking
    """)
    inv_map = {}
    for _, row in inv_df.iterrows():
        inv_map[(row["layer"], row["subcategory"])] = {
            "gap_urgency": float(row["gap_urgency"] or 0),
            "composite_score": float(row["composite_score"] or 0),
        }

    layers = {}
    for _, row in gap_df.iterrows():
        name = row["layer"]
        if name not in layers:
            layers[name] = {"layer": name, "subcategories": []}
        sub = {
            "subcategory": row["subcategory"],
            "subcategory_id": row["subcategory_id"],
            "gap_score": float(row["overall_score"] or 0),
            "parity_verdict": row["parity_verdict"],
            "investment_ranking": inv_map.get((name, row["subcategory"]), {}),
        }
        layers[name]["subcategories"].append(sub)
    return list(layers.values())


def query_projects(client):
    print("  Querying projects (project_summary)...")
    df = client.to_pandas("SELECT * FROM currentai.scores.project_summary")
    projects = []
    for _, row in df.iterrows():
        projects.append({
            "project_slug": row["project_slug"],
            "display_name": row.get("display_name"),
            "total_stars": int(row.get("total_stars") or 0),
            "stars_28d": int(row.get("stars_28d") or 0),
            "contributors_28d": int(row.get("contributors_28d") or 0),
            "full_time_28d": int(row.get("full_time_28d") or 0),
            "repo_count": int(row.get("repo_count") or 0),
            "package_count": int(row.get("package_count") or 0),
            "model_count": int(row.get("model_count") or 0),
            "direct_dependents": int(row.get("direct_dependents") or 0),
            "total_dependents": int(row.get("total_dependents") or 0),
            "max_fragility_score": float(row.get("max_fragility_score") or 0),
            "best_benchmark_avg": float(row["best_benchmark_avg"]) if row.get("best_benchmark_avg") else None,
            "primary_gap_score": float(row["primary_gap_score"]) if row.get("primary_gap_score") else None,
            "investment_priority": float(row["investment_priority"]) if row.get("investment_priority") else None,
        })
    return projects


def query_repos(client):
    print("  Querying repos (repos_summary + license from entities.repos)...")
    df = client.to_pandas("""
        SELECT rs.*, er.license
        FROM currentai.scores.repos_summary rs
        LEFT JOIN currentai.entities.repos er ON rs.repo = er.repo
    """)
    repos = []
    for _, row in df.iterrows():
        repos.append({
            "repo": row["repo"],
            "category": row.get("category"),
            "subcategory": row.get("subcategory"),
            "stars": int(row.get("stars") or 0),
            "star_7d": int(row.get("star_7d") or 0),
            "contributors": int(row.get("contributors") or 0),
            "language": row.get("language"),
            "license": row.get("license") or None,
            "country": row.get("country"),
            "description": row.get("description"),
            "stars_90d": int(row.get("stars_90d") or 0),
            "forks_90d": int(row.get("forks_90d") or 0),
            "commits_90d": int(row.get("commits_90d") or 0),
            "total_contributors": int(row.get("total_contributors") or 0),
            "full_time": int(row.get("full_time") or 0),
            "part_time": int(row.get("part_time") or 0),
        })
    return repos


def query_packages(client):
    print("  Querying packages...")
    df = client.to_pandas("SELECT * FROM currentai.entities.packages")
    packages = []
    for _, row in df.iterrows():
        packages.append({
            "repo": row["repo"],
            "project_slug": row.get("project_slug"),
            "package_source": row["package_source"],
            "package_name": row["package_name"],
            "url": row.get("url", ""),
        })
    return packages


def query_models(client):
    print("  Querying models...")
    df = client.to_pandas("SELECT * FROM currentai.entities.models")
    models = []
    for _, row in df.iterrows():
        models.append({
            "model_id": row["model_id"],
            "url": row.get("url"),
            "repo": row.get("repo"),
            "project_slug": row.get("project_slug"),
            "pipeline_tag": row.get("pipeline_tag"),
            "library_name": row.get("library_name"),
            "downloads": int(row.get("downloads") or 0),
            "likes": int(row.get("likes") or 0),
            "model_family": row.get("model_family"),
            "benchmark_avg": float(row["benchmark_avg"]) if row.get("benchmark_avg") else None,
            "architecture": row.get("architecture"),
        })
    return models


def query_sparklines(client):
    print("  Querying sparklines (weekly metrics, 91 days)...")
    df = client.to_pandas("""
        SELECT
          repo,
          DATE_TRUNC('week', day) AS week,
          SUM(CASE WHEN metric = 'stars' THEN value ELSE 0 END) AS stars,
          SUM(CASE WHEN metric = 'forks' THEN value ELSE 0 END) AS forks,
          MAX_BY(CASE WHEN metric = 'contributors' THEN value ELSE 0 END, day) AS contributors
        FROM currentai.metrics.daily
        WHERE day >= CURRENT_DATE - INTERVAL '91' DAY
          AND metric IN ('stars', 'forks', 'contributors')
        GROUP BY repo, DATE_TRUNC('week', day)
        ORDER BY repo, week
    """)
    sparklines = {}
    for _, row in df.iterrows():
        repo = row["repo"]
        if repo not in sparklines:
            sparklines[repo] = {"stars": [], "forks": [], "contributors": []}
        sparklines[repo]["stars"].append(int(row.get("stars") or 0))
        sparklines[repo]["forks"].append(int(row.get("forks") or 0))
        sparklines[repo]["contributors"].append(int(row.get("contributors") or 0))
    return sparklines


def query_taxonomy(client):
    print("  Querying taxonomy...")
    df = client.to_pandas("SELECT * FROM currentai.scores.taxonomy")
    taxonomy = []
    for _, row in df.iterrows():
        taxonomy.append({
            "project_slug": row["project_slug"],
            "osai_layer": row["osai_layer"],
            "osai_subcategory": row["osai_subcategory"],
            "osai_subcategory_id": row.get("osai_subcategory_id"),
            "gap_score": float(row.get("gap_score") or 0),
            "parity_verdict": row.get("parity_verdict"),
        })
    return taxonomy


def enrich_layers(layers, taxonomy, projects):
    project_map = {p["project_slug"]: p for p in projects}
    for layer in layers:
        for sub in layer["subcategories"]:
            matching = [
                t for t in taxonomy
                if t["osai_layer"] == layer["layer"]
                and t["osai_subcategory"] == sub["subcategory"]
            ]
            slugs = list({t["project_slug"] for t in matching})
            sub["project_count"] = len(slugs)
            top = sorted(
                [project_map[s] for s in slugs if s in project_map],
                key=lambda p: p["total_stars"],
                reverse=True,
            )[:3]
            sub["top_projects"] = [
                p["display_name"] or p["project_slug"] for p in top
            ]


def validate(bundle):
    errors = []
    warnings = []
    layers = bundle["layers"]
    repos = bundle["repos"]
    projects = bundle["projects"]
    taxonomy = bundle["taxonomy"]
    sparklines = bundle["sparklines"]
    packages = bundle["packages"]
    models = bundle["models"]

    # Structural
    if len(layers) < 4:
        errors.append(f"Only {len(layers)} layers (expected 8)")
    for layer in layers:
        for sub in layer["subcategories"]:
            if sub.get("project_count", 0) < 2:
                star_count = sum(
                    1 for t in taxonomy
                    if t["osai_layer"] == layer["layer"]
                    and t["osai_subcategory"] == sub["subcategory"]
                    and any(
                        p["total_stars"] > 100 for p in projects
                        if p["project_slug"] == t["project_slug"]
                    )
                )
                if star_count < 2:
                    warnings.append(
                        f"{layer['layer']} > {sub['subcategory']}: "
                        f"only {star_count} recognizable projects (stars>100)"
                    )

    if not (10_000 <= len(repos) <= 20_000):
        errors.append(f"Repo count {len(repos)} outside expected range 10K-20K")
    if not (8_000 <= len(projects) <= 18_000):
        errors.append(f"Project count {len(projects)} outside expected range 8K-18K")
    if len(sparklines) < len(repos) * 0.5:
        warnings.append(f"Sparklines cover only {len(sparklines)}/{len(repos)} repos")

    # Data quality
    neg_stars = sum(1 for r in repos if r["stars"] < 0)
    if neg_stars:
        errors.append(f"{neg_stars} repos with negative stars")
    empty_cat = sum(1 for r in repos if not r.get("category"))
    if empty_cat > len(repos) * 0.1:
        warnings.append(f"{empty_cat} repos missing category")
    country_pct = sum(1 for r in repos if r.get("country")) / max(len(repos), 1)
    if country_pct < 0.3:
        warnings.append(f"Country coverage only {country_pct:.0%} (expected >30%)")
    active = sum(1 for r in repos if r.get("commits_90d", 0) > 0)
    if active < 1000:
        warnings.append(f"Only {active} repos with nonzero commits_90d")
    if not (1_000 <= len(packages) <= 5_000):
        warnings.append(f"Package count {len(packages)} outside expected range")
    if not (3_000 <= len(models) <= 10_000):
        warnings.append(f"Model count {len(models)} outside expected range")

    # Spot checks
    project_layers = {}
    for t in taxonomy:
        project_layers.setdefault(t["osai_layer"], set()).add(t["project_slug"])
    for layer_name, expected in SPOT_CHECKS.items():
        layer_projects = project_layers.get(layer_name, set())
        for slug in expected:
            if slug not in layer_projects:
                warnings.append(f"Spot check: '{slug}' not found in {layer_name}")

    return errors, warnings


def export_data(skip_validation=False):
    client = get_client()
    print("Exporting ecosystem data...")

    layers = query_layers(client)
    projects = query_projects(client)
    repos = query_repos(client)
    packages = query_packages(client)
    models = query_models(client)
    sparklines = query_sparklines(client)
    taxonomy = query_taxonomy(client)

    enrich_layers(layers, taxonomy, projects)

    bundle = {
        "generated": str(datetime.date.today()),
        "layers": layers,
        "projects": projects,
        "repos": repos,
        "packages": packages,
        "models": models,
        "sparklines": sparklines,
        "taxonomy": taxonomy,
    }

    if not skip_validation:
        errors, warnings = validate(bundle)
        for w in warnings:
            print(f"  WARN: {w}")
        for e in errors:
            print(f"  ERROR: {e}")
        if errors:
            print("Validation failed. Use --skip-validation to override.")
            sys.exit(1)

    print(f"  {len(layers)} layers, {len(repos)} repos, {len(projects)} projects")
    print(f"  {len(packages)} packages, {len(models)} models, {len(sparklines)} sparklines")
    return bundle


def validate_only(path):
    with open(path) as f:
        bundle = json.load(f)
    errors, warnings = validate(bundle)
    for w in warnings:
        print(f"  WARN: {w}")
    for e in errors:
        print(f"  ERROR: {e}")
    if errors:
        print("Validation FAILED.")
        sys.exit(1)
    else:
        print("Validation passed.")


def main():
    parser = argparse.ArgumentParser(description="Export ecosystem data to JSON")
    parser.add_argument("--output", help="Write to file instead of stdout")
    parser.add_argument("--skip-validation", action="store_true")
    parser.add_argument("--validate-only", metavar="FILE", help="Validate existing file")
    args = parser.parse_args()

    if args.validate_only:
        validate_only(args.validate_only)
        return

    bundle = export_data(skip_validation=args.skip_validation)
    content = json.dumps(bundle, separators=(",", ":"))

    if args.output:
        os.makedirs(os.path.dirname(args.output), exist_ok=True)
        with open(args.output, "w") as f:
            f.write(content)
        size_mb = len(content) / 1_000_000
        print(f"Written to {args.output} ({size_mb:.1f} MB)")
    else:
        print(json.dumps(bundle, indent=2)[:3000])
        if len(content) > 3000:
            print(f"\n... ({len(content)} chars total)")


if __name__ == "__main__":
    main()
```

- [ ] **Step 2: Test the script (if API key available)**

```bash
uv run scripts/export_website_data.py --output app/src/data/explorer-data.json
```

Expected: prints query progress, validation results, writes file. If no API key, script exits with "OSO_API_KEY not set."

- [ ] **Step 3: Commit**

```bash
git add scripts/export_website_data.py
git commit -m "feat: rewrite export script with 7 queries, validation, and spot checks"
```

---

## Task 14: End-to-End Verification

- [ ] **Step 1: Generate real data (if API key available)**

```bash
uv run scripts/export_website_data.py --output app/src/data/explorer-data.json
```

If no API key, the app will fall back to sample data.

- [ ] **Step 2: Run the dev server and verify all features**

```bash
cd app && pnpm dev
```

Open `http://localhost:5173/` and verify:

1. Landing page loads as before
2. "Go to Ecosystem App" navigates to `/explore`
3. Layer cards display with health badges
4. Clicking a layer card filters the table
5. Table shows repos with sparklines, sortable columns
6. Filters work: layer, subcategory, health, country, language, activity, packages, models
7. Search filters in real-time
8. Clicking a row opens the detail drawer
9. Drawer shows health card, stats, sparklines, packages, models, taxonomy, adjacent projects
10. Adjacent project links navigate within the drawer
11. Escape / scrim click closes the drawer
12. URL query params reflect filter state
13. Direct navigation to `/explore?layer=Infrastructure` applies the filter
14. Back link returns to landing page

- [ ] **Step 3: Build check**

```bash
cd app && pnpm build
```

Expected: builds without errors. Check `app/dist/` for output.

- [ ] **Step 4: Commit any remaining fixes**

```bash
git add -A
git commit -m "chore: end-to-end verification fixes"
```

(Only if fixes were needed.)
