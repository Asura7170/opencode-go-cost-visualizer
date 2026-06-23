const STORAGE_KEY = "opencode_prices";
const SELECTED_MODEL_KEY = "opencode_selected_model";
const QWEN_THRESHOLD = 256000;
const LOW_TIER = "\u2264 256K tokens";
const HIGH_TIER = "> 256K tokens";
const QWEN_PLUS_MARKERS = ["Qwen3.7 Plus", "Qwen3.6 Plus"];
const PROMO_MODEL = "minimaxm3";

const MAX_TOTAL_CONTEXT = 1_000_000;
const MAX_OUTPUT = 128_000;
const MIN_INPUT = 50;
const MIN_CACHE = 0;

const defaultModels = [
  { name: "GLM-5.2", input: 1.40, output: 4.40, cacheRead: 0.26, promoDivisor: 1 },
  { name: "GLM-5.1", input: 1.40, output: 4.40, cacheRead: 0.26, promoDivisor: 1 },
  { name: "Kimi K2.7 Code", input: 0.95, output: 4.00, cacheRead: 0.19, promoDivisor: 1 },
  { name: "Kimi K2.6", input: 0.95, output: 4.00, cacheRead: 0.16, promoDivisor: 1 },
  { name: "MiMo V2.5", input: 0.14, output: 0.28, cacheRead: 0.0028, promoDivisor: 1 },
  { name: "MiMo V2.5 Pro", input: 1.74, output: 3.48, cacheRead: 0.0145, promoDivisor: 1 },
  { name: "MiniMax M3", input: 0.30, output: 1.20, cacheRead: 0.06, promoDivisor: 3 },
  { name: "MiniMax M2.7", input: 0.30, output: 1.20, cacheRead: 0.06, promoDivisor: 1 },
  { name: "MiniMax M2.5", input: 0.30, output: 1.20, cacheRead: 0.06, promoDivisor: 1 },
  { name: "Qwen3.7 Max", input: 2.50, output: 7.50, cacheRead: 0.50, promoDivisor: 1 },
  { name: "Qwen3.7 Plus (\u2264 256K tokens)", input: 0.40, output: 1.60, cacheRead: 0.04, promoDivisor: 1 },
  { name: "Qwen3.7 Plus (> 256K tokens)", input: 1.20, output: 4.80, cacheRead: 0.12, promoDivisor: 1 },
  { name: "Qwen3.6 Plus (\u2264 256K tokens)", input: 0.50, output: 3.00, cacheRead: 0.05, promoDivisor: 1 },
  { name: "Qwen3.6 Plus (> 256K tokens)", input: 2.00, output: 6.00, cacheRead: 0.20, promoDivisor: 1 },
  { name: "DeepSeek V4 Pro", input: 1.74, output: 3.48, cacheRead: 0.0145, promoDivisor: 1 },
  { name: "DeepSeek V4 Flash", input: 0.14, output: 0.28, cacheRead: 0.0028, promoDivisor: 1 }
];

const state = {
  inputTokens: 1000,
  outputTokens: 2000,
  cacheReadTokens: 100000,
  weeklyRequests: 300,
  monthlyRequests: 1000,
  selectedModelName: null,
  models: []
};

const $ = (id) => document.getElementById(id);
const clamp = (v, min, max) => Math.min(max, Math.max(min, v));
const normalizeName = (s) => String(s).toLowerCase().replace(/[-_\s]/g, "");
const isQwenPlus = (name) => QWEN_PLUS_MARKERS.some((m) => name.includes(m));

const tokenFormatter = new Intl.NumberFormat("en-US");
const formatTokens = (n) => (Number.isFinite(n) ? tokenFormatter.format(n) : "0");

function createEl(tag, className, text) {
  const el = document.createElement(tag);
  if (className) el.className = className;
  if (text != null) el.textContent = text;
  return el;
}

function calculateCost(model, inputTokens, outputTokens, cacheReadTokens) {
  const uncachedCost = (inputTokens * model.input) / 1000000;
  const cacheReadCost = (cacheReadTokens * model.cacheRead) / 1000000;
  const outputCost = (outputTokens * model.output) / 1000000;
  const divisor = model.promoDivisor || 1;
  return (uncachedCost + cacheReadCost + outputCost) / divisor;
}

function fmt(n) {
  if (!isFinite(n) || n === 0) return "$0.0000";
  if (n < 0.0001) return `$${n.toFixed(6)}`;
  if (n < 0.01) return `$${n.toFixed(5)}`;
  return `$${n.toFixed(4)}`;
}

function getEffectiveModels() {
  const totalInput = state.inputTokens + state.cacheReadTokens;
  const lowTier = totalInput <= QWEN_THRESHOLD;
  return state.models.filter((m) => {
    if (isQwenPlus(m.name)) {
      if (m.name.includes(LOW_TIER)) return lowTier;
      if (m.name.includes(HIGH_TIER)) return !lowTier;
    }
    return true;
  });
}

function getSelectedModel(effectiveModels) {
  const eff = effectiveModels ?? getEffectiveModels();
  if (!eff.length) return null;
  if (state.selectedModelName) {
    const target = normalizeName(state.selectedModelName);
    const match = eff.find((m) => normalizeName(m.name) === target);
    if (match) return { model: match, isAuto: false };
  }
  let cheapest = eff[0];
  let minCost = calculateCost(cheapest, state.inputTokens, state.outputTokens, state.cacheReadTokens);
  for (let i = 1; i < eff.length; i++) {
    const c = calculateCost(eff[i], state.inputTokens, state.outputTokens, state.cacheReadTokens);
    if (c < minCost) {
      minCost = c;
      cheapest = eff[i];
    }
  }
  return { model: cheapest, isAuto: true };
}

const cleanNum = (val) => {
  if (val == null) return 0;
  const s = String(val).replace(/[$,\s]/g, "").trim();
  if (s === "" || s === "-" || /^-+$/.test(s)) return 0;
  const n = parseFloat(s);
  return isFinite(n) ? n : 0;
};

function parsePricingData(text) {
  const lines = String(text).split(/\r?\n/);
  const out = [];
  let firstLine = true;
  for (const raw of lines) {
    const line = raw.trim();
    if (!line) continue;
    const parts = line.split(/\t|\s{2,}/).map((s) => s.trim()).filter(Boolean);
    if (parts.length < 3) continue;
    if (firstLine) {
      firstLine = false;
      if (/model/i.test(parts[0]) && /input|price|cost/i.test(parts.slice(1).join(" "))) {
        continue;
      }
    }

    const name = parts[0].replace(/\s+/g, " ").trim();
    const input = cleanNum(parts[1]);
    const output = cleanNum(parts[2]);
    const cacheRead = cleanNum(parts[3]);
    const promoDivisor = normalizeName(name) === PROMO_MODEL ? 3 : 1;
    out.push({ name, input, output, cacheRead, promoDivisor });
  }
  return out;
}

function loadModels() {
  const cached = localStorage.getItem(STORAGE_KEY);
  if (cached) {
    try {
      const parsed = JSON.parse(cached);
      if (Array.isArray(parsed) && parsed.length) {
        state.models = parsed.map((m) => ({
          name: m.name,
          input: m.input,
          output: m.output,
          cacheRead: m.cacheRead,
          promoDivisor:
            typeof m.promoDivisor === "number" && m.promoDivisor > 0
              ? m.promoDivisor
              : normalizeName(m.name) === PROMO_MODEL ? 3 : 1
        }));
        return;
      }
    } catch {}
  }
  state.models = defaultModels.map((m) => ({ ...m }));
  saveModels();
}

function saveModels() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state.models));
  } catch {}
}

function loadSelectedModel() {
  try {
    const saved = localStorage.getItem(SELECTED_MODEL_KEY);
    if (!saved) return;
    const target = normalizeName(saved);
    const match = state.models.find((m) => normalizeName(m.name) === target);
    if (match) state.selectedModelName = match.name;
  } catch {}
}

function saveSelectedModel(name) {
  try {
    localStorage.setItem(SELECTED_MODEL_KEY, name);
  } catch {}
}

const statusTimers = new Map();

function showStatus(el, message, ok) {
  el.textContent = message;
  el.className = `status ${ok ? "ok" : "err"}`;
  const existing = statusTimers.get(el);
  if (existing) clearTimeout(existing);
  const timer = setTimeout(() => {
    el.textContent = "";
    el.className = "status";
    statusTimers.delete(el);
  }, 4000);
  statusTimers.set(el, timer);
}

let renderScheduled = false;
function scheduleRender() {
  if (renderScheduled) return;
  renderScheduled = true;
  requestAnimationFrame(() => {
    renderScheduled = false;
    renderAll();
  });
}

function renderAll() {
  const effectiveModels = getEffectiveModels();
  const selectedResult = getSelectedModel(effectiveModels);
  updateProjections(selectedResult);
  updateCacheHelper();
  syncModelSelect(effectiveModels, selectedResult);
  renderCostComparison(effectiveModels, selectedResult);
}

function updateProjections(selectedResult) {
  const result = selectedResult ?? getSelectedModel();
  if (!result) {
    $("singleCost").textContent = "$0.0000";
    $("weeklyCost").textContent = "$0.0000";
    $("monthlyCost").textContent = "$0.0000";
    return;
  }
  const { model: selected } = result;
  const cost = calculateCost(selected, state.inputTokens, state.outputTokens, state.cacheReadTokens);
  $("singleCost").textContent = fmt(cost);
  $("weeklyCost").textContent = fmt(cost * (state.weeklyRequests || 0));
  $("monthlyCost").textContent = fmt(cost * (state.monthlyRequests || 0));
}

function updateCacheHelper() {
  const total = state.inputTokens + state.cacheReadTokens;
  const el = $("cacheHelper");
  if (el) el.textContent = `Total Input Tokens: ${formatTokens(total)}`;
}

let lastSelectKey = "";

function populateModelSelect(effectiveModels) {
  const select = $("modelSelect");
  if (!select) return;
  const eff = (effectiveModels ?? getEffectiveModels())
    .slice()
    .sort((a, b) => a.name.localeCompare(b.name));
  const key = eff.map((m) => m.name).join("|");
  if (key === lastSelectKey) return;
  lastSelectKey = key;
  select.replaceChildren();
  eff.forEach((m) => {
    const opt = createEl("option", null, m.name);
    opt.value = m.name;
    select.appendChild(opt);
  });
}

function syncModelSelect(effectiveModels, selectedResult) {
  const select = $("modelSelect");
  if (!select) return;
  populateModelSelect(effectiveModels);
  const result = selectedResult ?? getSelectedModel(effectiveModels);
  const autoEl = $("cardAuto");
  if (!result) {
    select.value = "";
    if (autoEl) autoEl.hidden = true;
    select.classList.remove("is-manual");
    return;
  }
  select.value = result.model.name;
  if (autoEl) autoEl.hidden = !result.isAuto;
  select.classList.toggle("is-manual", !result.isAuto);
}

function renderCostComparison(effectiveModels, selectedResult) {
  const container = $("costList");
  if (!container) return;

  const active = document.activeElement;
  const preserveModel = active?.dataset?.model;
  const caret = active?.selectionStart ?? null;

  container.replaceChildren();

  const eff = (effectiveModels ?? getEffectiveModels()).map((m) => ({
    model: m,
    cost: calculateCost(m, state.inputTokens, state.outputTokens, state.cacheReadTokens)
  }));
  eff.sort((a, b) => a.cost - b.cost);

  if (!eff.length) {
    container.appendChild(createEl("div", "cost-empty", "No models to display for the current token range."));
    return;
  }

  const maxCost = eff.reduce((max, r) => (r.cost > max ? r.cost : max), 0);
  const result = selectedResult ?? getSelectedModel(effectiveModels);
  const highlightedKey = result ? normalizeName(result.model.name) : null;

  eff.forEach(({ model: m, cost }) => {
    const isHighlighted = highlightedKey && normalizeName(m.name) === highlightedKey;

    const row = createEl("div", `cost-row${isHighlighted ? " highlighted" : ""}`);
    row.title = `${m.name} — ${fmt(cost)} per request`;

    row.appendChild(createEl("span", "cost-name", m.name));

    const barWrap = createEl("div", "cost-bar-wrap");
    const bar = createEl("div", "cost-bar");
    bar.style.width = `${maxCost > 0 ? (cost / maxCost) * 100 : 0}%`;
    barWrap.appendChild(bar);
    row.appendChild(barWrap);

    row.appendChild(createEl("span", "cost-value", fmt(cost)));

    const promo = document.createElement("input");
    promo.type = "number";
    promo.className = "cost-promo";
    promo.min = "1";
    promo.step = "1";
    promo.value = m.promoDivisor || 1;
    promo.setAttribute("value", promo.value);
    promo.style.setProperty("--d", m.promoDivisor || 1);
    promo.dataset.model = m.name;
    promo.setAttribute("aria-label", `Promo divisor for ${m.name}`);
    row.appendChild(promo);

    container.appendChild(row);
  });

  if (preserveModel) {
    const target = container.querySelector(`.cost-promo[data-model="${CSS.escape(preserveModel)}"]`);
    if (target) {
      target.focus();
      if (caret != null) {
        try { target.setSelectionRange(caret, caret); } catch {}
      }
    }
  }
}

function syncContextCaps() {
  const inputMax = Math.max(MIN_INPUT, MAX_TOTAL_CONTEXT - state.cacheReadTokens);
  const cacheMax = Math.max(MIN_CACHE, MAX_TOTAL_CONTEXT - state.inputTokens);
  for (const el of [$("inputTokens"), $("inputTokensNum")]) {
    el.min = MIN_INPUT;
    el.max = inputMax;
  }
  for (const el of [$("cacheReadTokens"), $("cacheReadTokensNum")]) {
    el.min = MIN_CACHE;
    el.max = cacheMax;
  }
}

function setupOutputControl() {
  const slider = $("outputTokens");
  const num = $("outputTokensNum");
  const set = (val, source) => {
    let v = clamp(Number(val), 0, MAX_OUTPUT);
    if (!isFinite(v)) v = 0;
    state.outputTokens = v;
    if (source !== "slider") slider.value = v;
    if (source !== "num") num.value = v;
    scheduleRender();
  };
  slider.addEventListener("input", () => set(slider.value, "slider"));
  num.addEventListener("input", () => set(num.value, "num"));
}

function setupContextControls() {
  const inputSlider = $("inputTokens");
  const inputNum = $("inputTokensNum");
  const cacheSlider = $("cacheReadTokens");
  const cacheNum = $("cacheReadTokensNum");

  const setInput = (val, source) => {
    const cap = Math.max(MIN_INPUT, MAX_TOTAL_CONTEXT - state.cacheReadTokens);
    let v = clamp(Number(val), MIN_INPUT, cap);
    if (!isFinite(v)) v = MIN_INPUT;
    state.inputTokens = v;
    if (source !== "slider") inputSlider.value = v;
    if (source !== "num") inputNum.value = v;
    syncContextCaps();
    scheduleRender();
  };

  const setCache = (val, source) => {
    const cap = Math.max(MIN_CACHE, MAX_TOTAL_CONTEXT - state.inputTokens);
    let v = clamp(Number(val), MIN_CACHE, cap);
    if (!isFinite(v)) v = MIN_CACHE;
    state.cacheReadTokens = v;
    if (source !== "slider") cacheSlider.value = v;
    if (source !== "num") cacheNum.value = v;
    syncContextCaps();
    scheduleRender();
  };

  inputSlider.addEventListener("input", () => setInput(inputSlider.value, "slider"));
  inputNum.addEventListener("input", () => setInput(inputNum.value, "num"));
  cacheSlider.addEventListener("input", () => setCache(cacheSlider.value, "slider"));
  cacheNum.addEventListener("input", () => setCache(cacheNum.value, "num"));
}

function setupTabs() {
  const tabs = Array.from(document.querySelectorAll(".tab"));
  const container = document.querySelector(".tabs");
  if (!container) return;

  const activate = (tab) => {
    tabs.forEach((t) => {
      const isActive = t === tab;
      t.classList.toggle("active", isActive);
      t.setAttribute("aria-selected", isActive ? "true" : "false");
      t.tabIndex = isActive ? 0 : -1;
      const panel = $(t.getAttribute("aria-controls"));
      if (panel) {
        panel.classList.toggle("active", isActive);
        panel.hidden = !isActive;
      }
    });
  };

  container.addEventListener("click", (e) => {
    const tab = e.target.closest(".tab");
    if (tab) activate(tab);
  });

  container.addEventListener("keydown", (e) => {
    const current = tabs.findIndex((t) => t.tabIndex === 0);
    if (current === -1) return;
    let next;
    if (e.key === "ArrowRight") next = (current + 1) % tabs.length;
    else if (e.key === "ArrowLeft") next = (current - 1 + tabs.length) % tabs.length;
    else if (e.key === "Home") next = 0;
    else if (e.key === "End") next = tabs.length - 1;
    else return;
    e.preventDefault();
    tabs[next].focus();
    activate(tabs[next]);
  });
}

function setupImportHandlers() {
  $("applyPrices").addEventListener("click", () => {
    const parsed = parsePricingData($("pricingInput").value);
    if (!parsed.length) {
      showStatus($("priceStatus"), "No valid rows found.", false);
      return;
    }
    state.models = parsed;
    lastSelectKey = "";
    saveModels();
    renderAll();
    showStatus($("priceStatus"), `Updated ${parsed.length} models. Saved locally.`, true);
  });

  $("resetPrices").addEventListener("click", () => {
    state.models = defaultModels.map((m) => ({ ...m }));
    lastSelectKey = "";
    saveModels();
    renderAll();
    showStatus($("priceStatus"), "Default pricing restored.", true);
  });
}

function setupRequestInputs() {
  $("weeklyRequests").addEventListener("input", (e) => {
    state.weeklyRequests = clamp(Number(e.target.value) || 0, 0, 1e9);
    scheduleRender();
  });
  $("monthlyRequests").addEventListener("input", (e) => {
    state.monthlyRequests = clamp(Number(e.target.value) || 0, 0, 1e9);
    scheduleRender();
  });
}

function setupModelSelect() {
  const select = $("modelSelect");
  if (!select) return;
  select.addEventListener("change", () => {
    const name = select.value;
    if (!name) return;
    state.selectedModelName = name;
    saveSelectedModel(name);
    renderAll();
  });
}

function setupCostListDelegation() {
  const container = $("costList");
  if (!container) return;
  container.addEventListener("input", (e) => {
    const promo = e.target.closest(".cost-promo");
    if (!promo) return;
    const modelName = promo.dataset.model;
    const model = state.models.find((m) => m.name === modelName);
    if (!model) return;
    const v = clamp(Number(promo.value) || 1, 1, 1000);
    model.promoDivisor = v;
    promo.setAttribute("value", v);
    promo.style.setProperty("--d", v);
    saveModels();
    scheduleRender();
  });
}

function init() {
  loadModels();
  loadSelectedModel();

  state.inputTokens = clamp(
    Number($("inputTokensNum").value) || MIN_INPUT,
    MIN_INPUT,
    MAX_TOTAL_CONTEXT
  );
  state.outputTokens = clamp(
    Number($("outputTokensNum").value) || 0,
    0,
    MAX_OUTPUT
  );
  state.cacheReadTokens = clamp(
    Number($("cacheReadTokensNum").value) || MIN_CACHE,
    MIN_CACHE,
    MAX_TOTAL_CONTEXT
  );
  state.weeklyRequests = clamp(
    Number($("weeklyRequests").value) || 0,
    0,
    1e9
  );
  state.monthlyRequests = clamp(
    Number($("monthlyRequests").value) || 0,
    0,
    1e9
  );

  if (state.inputTokens + state.cacheReadTokens > MAX_TOTAL_CONTEXT) {
    state.cacheReadTokens = MAX_TOTAL_CONTEXT - state.inputTokens;
  }

  setupOutputControl();
  setupContextControls();
  setupTabs();
  setupImportHandlers();
  setupRequestInputs();
  setupModelSelect();
  setupCostListDelegation();

  syncContextCaps();
  renderAll();
}

export { calculateCost, defaultModels };

if (typeof document !== "undefined") init();
