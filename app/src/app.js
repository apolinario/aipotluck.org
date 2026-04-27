import { MARKET_MAP_DATA } from './data.js';
import './style.css';

const D = MARKET_MAP_DATA;

// ---------- helpers ----------
const healthBucket = (h) => h >= 70 ? "healthy" : h >= 45 ? "medium" : "gap";
const healthColor = (h) => {
  const b = healthBucket(h);
  if (b === "healthy") return "var(--healthy)";
  if (b === "medium") return "var(--warm)";
  return "var(--signal)";
};
const healthLabel = (h) => {
  const b = healthBucket(h);
  if (b === "healthy") return "Healthy coverage";
  if (b === "medium") return "Fragile / fragmented";
  return "Significant gap";
};
const healthDesc = (h) => {
  const b = healthBucket(h);
  if (b === "healthy") return "Multiple mature projects with active maintenance, broad adoption, and strong interoperability.";
  if (b === "medium") return "Working tools exist but coverage is fragmented; documentation, governance, or interop lag behind closed alternatives.";
  return "Few or no production-grade open alternatives. The community needs investment, convening, or new contributors here.";
};

const layerById = (id) => D.layers.find(l => l.id === id);

// ---------- render stack ----------
function renderStack() {
  const root = document.getElementById("stack-root");
  root.innerHTML = D.layers.map((layer, i) => {
    const cells = layer.categories.map(cat => {
      const bucket = healthBucket(cat.health);
      const color = healthColor(cat.health);
      const visible = cat.projects.slice(0, 3);
      const more = cat.projects.length - visible.length;
      return `
        <div class="cell" data-health="${bucket}" data-layer="${layer.id}" data-cat="${cat.id}">
          <div class="cell-head">
            <div class="cell-name">${cat.name}</div>
            <div class="cell-score">${cat.health}</div>
          </div>
          <div class="cell-bar"><span style="width:${cat.health}%; background:${color}"></span></div>
          <div class="cell-chips">
            ${visible.map(p => `<span class="chip">${p.name}</span>`).join("")}
            ${more > 0 ? `<span class="chip chip-more">+${more}</span>` : ""}
          </div>
        </div>
      `;
    }).join("");
    return `
      <div class="layer-row" data-screen-label="layer-${layer.id}">
        <div class="layer-label">
          <div class="num">L${String(i+1).padStart(2,'0')}</div>
          <h3>${layer.title}</h3>
          <p>${layer.blurb}</p>
        </div>
        <div class="layer-cells">${cells}</div>
      </div>
    `;
  }).join("");

  root.querySelectorAll(".cell").forEach(el => {
    el.addEventListener("click", () => openDrawer(el.dataset.layer, el.dataset.cat));
  });
}

// ---------- workflow view ----------
let activeStep = 0;
const workflowSteps = [
  { id: "compute", label: "Provision", subtitle: "Compute & runtime" },
  { id: "data", label: "Curate", subtitle: "Data & datasets" },
  { id: "models", label: "Train", subtitle: "Models & post-training" },
  { id: "serve", label: "Serve", subtitle: "Inference & retrieval" },
  { id: "agents", label: "Compose", subtitle: "Agents & orchestration" },
  { id: "eval", label: "Evaluate", subtitle: "Eval & safety" },
  { id: "ux", label: "Ship", subtitle: "Product surface" },
];

function renderWorkflow() {
  const root = document.getElementById("workflow-root");
  const rail = workflowSteps.map((s, i) => `
    <div class="wf-step ${i === activeStep ? 'active' : ''}" data-i="${i}">
      <div class="num">PHASE ${String(i+1).padStart(2,'0')}</div>
      <div class="dot"></div>
      <div class="lbl">${s.label}</div>
    </div>
  `).join("");

  const active = workflowSteps[activeStep];
  const layer = layerById(active.id);
  const cells = layer.categories.map(cat => {
    const bucket = healthBucket(cat.health);
    const color = healthColor(cat.health);
    return `
      <div class="cell" data-health="${bucket}" data-layer="${layer.id}" data-cat="${cat.id}">
        <div class="cell-head">
          <div class="cell-name">${cat.name}</div>
          <div class="cell-score">${cat.health}</div>
        </div>
        <div class="cell-bar"><span style="width:${cat.health}%; background:${color}"></span></div>
        <div class="cell-chips">
          ${cat.projects.slice(0,3).map(p => `<span class="chip">${p.name}</span>`).join("")}
          ${cat.projects.length > 3 ? `<span class="chip chip-more">+${cat.projects.length - 3}</span>` : ""}
        </div>
      </div>
    `;
  }).join("");

  root.innerHTML = `
    <div class="wf-rail">${rail}</div>
    <div class="wf-detail heatmap">
      <div>
        <div class="num mono" style="font-size:11px; color:var(--ink-3); letter-spacing:0.1em">PHASE ${String(activeStep+1).padStart(2,'0')} · ${active.subtitle.toUpperCase()}</div>
        <h3 style="margin-top:6px">${layer.title}</h3>
        <p>${layer.blurb}</p>
        <p style="font-size:13px; color:var(--ink-3); margin-top:16px"><strong style="color:var(--ink-2)">Interop note:</strong> moving from this phase to <em>${workflowSteps[(activeStep+1) % workflowSteps.length].label}</em> requires translating outputs across at least 3 different formats today.</p>
      </div>
      <div class="wf-cells">${cells}</div>
    </div>
  `;

  root.querySelectorAll(".wf-step").forEach(el => {
    el.addEventListener("click", () => {
      activeStep = parseInt(el.dataset.i);
      renderWorkflow();
    });
  });
  root.querySelectorAll(".cell").forEach(el => {
    el.addEventListener("click", () => openDrawer(el.dataset.layer, el.dataset.cat));
  });
}

// ---------- matrix view ----------
function renderMatrix() {
  const root = document.getElementById("matrix-root");
  const dims = ["Completeness", "Interop", "Docs", "Governance", "Safeguards"];
  const layerDimScores = D.layers.map(l => {
    const avg = l.categories.reduce((s,c) => s + c.health, 0) / l.categories.length;
    const seed = l.id.charCodeAt(0);
    return {
      layer: l,
      scores: dims.map((d, i) => Math.max(8, Math.min(96, Math.round(avg + ((seed * (i+1)) % 17) - 8))))
    };
  });
  const head = `<div class="matrix-cell head">Layer</div>` + dims.map(d => `<div class="matrix-cell head">${d}</div>`).join("");
  const rows = layerDimScores.map(({ layer, scores }) => `
    <div class="matrix-cell row-head">${layer.title}</div>
    ${scores.map(s => `
      <div class="matrix-cell">
        <div class="mx-score">
          <span class="mx-dot" style="background:${healthColor(s)}"></span>
          ${s}
        </div>
      </div>
    `).join("")}
  `).join("");
  root.innerHTML = `
    <div style="margin-bottom:14px; color:var(--ink-3); font-size:12.5px">Composite scores (0–100) across the five openness dimensions, per stack layer. <strong style="color:var(--ink-2)">Cooler = stronger.</strong></div>
    <div class="matrix">${head}${rows}</div>
  `;
}

// ---------- attributes ----------
function renderAttrs() {
  const root = document.getElementById("attrs-list");
  root.innerHTML = D.attributes.map(a => `
    <div class="attr">
      <div class="attr-name">${a.name}</div>
      <div class="attr-num">${a.coverage}<em>/100</em></div>
      <div class="attr-bar"><span style="width:${a.coverage}%; background:${healthColor(a.coverage)}"></span></div>
    </div>
  `).join("");
}

// ---------- contributors ----------
function renderContrib() {
  const root = document.getElementById("contrib-grid");
  root.innerHTML = D.contributors.map(c => `
    <div class="contrib-card">
      <div class="n">${c.projects}</div>
      <div class="nm">${c.name}</div>
      <div class="k">${c.kind}</div>
    </div>
  `).join("");
}

// ---------- crowdsource ----------
const votedSet = new Set();
function renderIssues() {
  const root = document.getElementById("issue-list");
  root.innerHTML = D.suggestions
    .slice()
    .sort((a,b) => b.votes - a.votes)
    .map(s => {
      const layer = layerById(s.layer);
      const cat = layer ? layer.categories.find(c => c.id === s.category) : null;
      const stateClass = s.state.toLowerCase().replace(/\s+/g, "-");
      const voted = votedSet.has(s.id);
      return `
        <div class="issue" data-id="${s.id}">
          <div class="vote ${voted ? 'voted' : ''}" data-vote="${s.id}">
            <span class="arrow">&#9650;</span>
            <span class="num">${s.votes + (voted ? 1 : 0)}</span>
          </div>
          <div>
            <div class="issue-title">${s.title}</div>
            <div class="issue-meta">
              <span class="tag">${layer ? layer.title : s.layer}${cat ? ' · ' + cat.name : ''}</span>
              <span class="tag-state tag ${stateClass}">${s.state}</span>
              <span>${s.author}</span>
            </div>
          </div>
          <button class="pill" data-adopt="${s.id}">Adopt</button>
        </div>
      `;
    }).join("");
  root.querySelectorAll("[data-vote]").forEach(el => {
    el.addEventListener("click", (e) => {
      e.stopPropagation();
      const id = parseInt(el.dataset.vote);
      if (votedSet.has(id)) votedSet.delete(id); else votedSet.add(id);
      renderIssues();
    });
  });
  root.querySelectorAll("[data-adopt]").forEach(el => {
    el.addEventListener("click", (e) => {
      e.stopPropagation();
      el.textContent = "Adopted ✓";
      el.style.background = "var(--healthy)";
      el.style.color = "var(--paper)";
      el.style.borderColor = "var(--healthy)";
    });
  });
}

// ---------- drawer ----------
function openDrawer(layerId, catId) {
  const layer = layerById(layerId);
  const cat = layer.categories.find(c => c.id === catId);
  document.getElementById("d-crumb").textContent = `${layer.title} · ${cat.name}`;
  document.getElementById("d-title").textContent = cat.name;

  const ringBg = `conic-gradient(${healthColor(cat.health)} ${cat.health * 3.6}deg, var(--paper-3) 0)`;
  const projects = cat.projects.map(p => `
    <div class="proj">
      <div>
        <div class="proj-name">${p.name}${p.note ? ` <span style="color:var(--ink-3); font-weight:400; font-size:12px">· ${p.note}</span>` : ""}</div>
        <div class="proj-org">${p.org}</div>
      </div>
      ${p.stars ? `<div class="proj-meta">★ ${p.stars}</div>` : '<div></div>'}
      <span class="lic">${p.license}</span>
    </div>
  `).join("");

  const adjacents = layer.categories.filter(c => c.id !== cat.id).slice(0, 3);
  document.getElementById("d-body").innerHTML = `
    <div class="health-card">
      <div class="health-ring" style="background:${ringBg}">
        <span style="background:var(--paper); width:42px; height:42px; border-radius:50%; display:grid; place-items:center">${cat.health}</span>
      </div>
      <div>
        <div class="label">Ecosystem health</div>
        <div style="font-family:'Fraunces', serif; font-size:18px; font-weight:500; margin-top:2px">${healthLabel(cat.health)}</div>
        <div class="desc">${healthDesc(cat.health)}</div>
      </div>
    </div>

    ${cat.gap ? `
      <div class="gap-card">
        <div class="lab">⬤ Why this is a red spot</div>
        <p>${cat.gap}</p>
      </div>
    ` : ""}

    <div class="section-h">Top open-source projects · ${cat.projects.length}</div>
    <div class="proj-list">${projects}</div>

    <div class="section-h">Adjacent in this layer</div>
    <div style="display:flex; gap:6px; flex-wrap:wrap">
      ${adjacents.map(c => `<button class="pill" data-jump-cat="${c.id}">${c.name} · ${c.health}</button>`).join("")}
    </div>

    <div class="drawer-cta">
      <h5>${cat.gap ? "Adopt this gap" : "Suggest an addition"}</h5>
      <p>${cat.gap
        ? "Sign your team up to lead, fund, or convene work on this red spot. Current AI will publish your commitment alongside the map."
        : "Know an open project we missed in this category? Add it — every entry is reviewed by the community working group."
      }</p>
      <div class="drawer-cta-row">
        <button class="pill primary">${cat.gap ? "Adopt gap" : "Add project"}</button>
        <button class="pill" id="cta-discuss">Open discussion ↗</button>
      </div>
    </div>
  `;
  document.getElementById("drawer").classList.add("open");
  document.getElementById("scrim").classList.add("open");

  document.querySelectorAll("[data-jump-cat]").forEach(el => {
    el.addEventListener("click", () => openDrawer(layerId, el.dataset.jumpCat));
  });
}

function closeDrawer() {
  document.getElementById("drawer").classList.remove("open");
  document.getElementById("scrim").classList.remove("open");
}

document.getElementById("d-close").addEventListener("click", closeDrawer);
document.getElementById("scrim").addEventListener("click", closeDrawer);
document.addEventListener("keydown", (e) => { if (e.key === "Escape") closeDrawer(); });

// ---------- view switching ----------
document.querySelectorAll("#view-seg button").forEach(btn => {
  btn.addEventListener("click", () => {
    document.querySelectorAll("#view-seg button").forEach(b => b.classList.remove("active"));
    btn.classList.add("active");
    document.body.classList.remove("view-stack", "view-workflow", "view-matrix");
    document.body.classList.add("view-" + btn.dataset.view);
    if (btn.dataset.view === "workflow") renderWorkflow();
    if (btn.dataset.view === "matrix") renderMatrix();
  });
});

// ---------- heatmap toggle ----------
document.getElementById("heatmap-toggle").addEventListener("change", (e) => {
  const on = e.target.checked;
  document.querySelectorAll("#stack-root, #workflow-root .wf-detail").forEach(el => {
    el.classList.toggle("heatmap", on);
  });
});

// ---------- search ----------
document.getElementById("search-input").addEventListener("input", (e) => {
  const q = e.target.value.toLowerCase().trim();
  document.querySelectorAll("#stack-root .cell, #workflow-root .cell").forEach(cell => {
    if (!q) { cell.style.opacity = ""; cell.style.filter = ""; return; }
    const text = cell.textContent.toLowerCase();
    const match = text.includes(q);
    cell.style.opacity = match ? "1" : "0.32";
    cell.style.filter = match ? "" : "saturate(0.4)";
  });
});

// ---------- submit form ----------
const fLayer = document.getElementById("f-layer");
fLayer.innerHTML = D.layers.map(l => `<option value="${l.id}">${l.title}</option>`).join("");
document.getElementById("submit-form").addEventListener("submit", (e) => {
  e.preventDefault();
  const title = document.getElementById("f-title").value.trim();
  if (!title) return;
  const layerId = fLayer.value;
  const layer = layerById(layerId);
  D.suggestions.unshift({
    id: Date.now(),
    title,
    layer: layerId,
    category: layer.categories[0].id,
    votes: 1,
    author: "@you",
    state: "Open",
  });
  document.getElementById("f-title").value = "";
  document.getElementById("f-notes").value = "";
  document.getElementById("submit-success").style.display = "block";
  setTimeout(() => document.getElementById("submit-success").style.display = "none", 4000);
  renderIssues();
});

// ---------- init ----------
document.body.classList.add("view-stack");
renderStack();
renderAttrs();
renderContrib();
renderIssues();
