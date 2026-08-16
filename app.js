const STORAGE_KEY = "opencode_prices";
const QWEN_THRESHOLD = 256000;
const GPT_LUNA_THRESHOLD = 272000;
const LOW_TIER = "<= 256K tokens";
const HIGH_TIER = "> 256K tokens";
const GPT_LUNA_LOW_TIER = "<= 272K tokens";
const GPT_LUNA_HIGH_TIER = "> 272K tokens";
const QWEN_PLUS_MARKERS = ["Qwen3.7 Plus", "Qwen3.6 Plus"];
const GPT_LUNA_MARKER = "GPT 5.6 Luna";

const MAX_TOTAL_CONTEXT = 1_000_000;
const MAX_OUTPUT = 128_000;
const MIN_INPUT = 1;
const MIN_OUTPUT = 1;
const MIN_CACHE = 0;
const EXP_K_INPUT = 2.5;
const EXP_K_CACHE = 2.0;
const EXP_K_OUTPUT = 3.0;

const QUOTA_FRACTIONS = { fiveHours: 0.2, week: 0.5, month: 1.0 };

const defaultModels = [
  { name: "Grok 4.5", input: 2.00, output: 6.00, cacheRead: 0.30, promoMultiplier: 1, monthlyLimitUsd: 15 },
  { name: "GPT 5.6 Luna (<= 272K tokens)", input: 0.20, output: 1.20, cacheRead: 0.02, promoMultiplier: 1, monthlyLimitUsd: 15 },
  { name: "GPT 5.6 Luna (> 272K tokens)", input: 0.40, output: 1.80, cacheRead: 0.04, promoMultiplier: 1, monthlyLimitUsd: 15 },
  { name: "GLM-5.2", input: 1.40, output: 4.40, cacheRead: 0.26, promoMultiplier: 1, monthlyLimitUsd: 60 },
  { name: "GLM-5.1", input: 1.40, output: 4.40, cacheRead: 0.26, promoMultiplier: 1, monthlyLimitUsd: 60 },
  { name: "Kimi K3", input: 3.00, output: 15.00, cacheRead: 0.30, promoMultiplier: 1, monthlyLimitUsd: 15 },
  { name: "Kimi K2.7 Code", input: 0.95, output: 4.00, cacheRead: 0.19, promoMultiplier: 1, monthlyLimitUsd: 60 },
  { name: "Kimi K2.6", input: 0.95, output: 4.00, cacheRead: 0.16, promoMultiplier: 1, monthlyLimitUsd: 60 },
  { name: "MiMo V2.5", input: 0.14, output: 0.28, cacheRead: 0.0028, promoMultiplier: 1, monthlyLimitUsd: 60 },
  { name: "MiMo V2.5 Pro", input: 0.435, output: 0.87, cacheRead: 0.003625, promoMultiplier: 1, monthlyLimitUsd: 15 },
  { name: "MiniMax M3", input: 0.30, output: 1.20, cacheRead: 0.06, promoMultiplier: 1, monthlyLimitUsd: 60 },
  { name: "MiniMax M2.7", input: 0.30, output: 1.20, cacheRead: 0.06, promoMultiplier: 1, monthlyLimitUsd: 60 },
  { name: "MiniMax M2.5", input: 0.30, output: 1.20, cacheRead: 0.06, promoMultiplier: 1, monthlyLimitUsd: 60 },
  { name: "Qwen3.8 Max", input: 2.00, output: 6.00, cacheRead: 0.25, promoMultiplier: 1, monthlyLimitUsd: 15 },
  { name: "Qwen3.7 Max", input: 2.50, output: 7.50, cacheRead: 0.50, promoMultiplier: 1, monthlyLimitUsd: 60 },
  { name: "Qwen3.7 Plus (<= 256K tokens)", input: 0.40, output: 1.60, cacheRead: 0.04, promoMultiplier: 1, monthlyLimitUsd: 60 },
  { name: "Qwen3.7 Plus (> 256K tokens)", input: 1.20, output: 4.80, cacheRead: 0.12, promoMultiplier: 1, monthlyLimitUsd: 60 },
  { name: "Qwen3.6 Plus (<= 256K tokens)", input: 0.50, output: 3.00, cacheRead: 0.05, promoMultiplier: 1, monthlyLimitUsd: 60 },
  { name: "Qwen3.6 Plus (> 256K tokens)", input: 2.00, output: 6.00, cacheRead: 0.20, promoMultiplier: 1, monthlyLimitUsd: 60 },
  { name: "DeepSeek V4 Pro", input: 0.435, output: 0.87, cacheRead: 0.003625, promoMultiplier: 1, monthlyLimitUsd: 15 },
  { name: "DeepSeek V4 Flash", input: 0.14, output: 0.28, cacheRead: 0.0028, promoMultiplier: 1, monthlyLimitUsd: 60 },
  { name: "Hy3", input: 0.14, output: 0.58, cacheRead: 0.035, promoMultiplier: 1, monthlyLimitUsd: 60 }
];

const state = {
  inputTokens: 1000,
  outputTokens: 2000,
  cacheReadTokens: 100000,
  selectedModelName: "DeepSeek V4 Pro",
  filterText: "",
  sortKey: "total",
  sortDesc: true,
  showPromo: false,
  models: []
};

const $ = (id) => document.getElementById(id);
const clamp = (v, min, max) => Math.min(max, Math.max(min, v));
const normalizeName = (s) => String(s).toLowerCase().replace(/[-_\s]/g, "");
const isQwenPlus = (name) => QWEN_PLUS_MARKERS.some((m) => name.includes(m));
const isGptLuna = (name) => name.includes(GPT_LUNA_MARKER);

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
  const multiplier = model.promoMultiplier || 1;
  return (uncachedCost + cacheReadCost + outputCost) / multiplier;
}

function fmt(n) {
  if (!isFinite(n) || n === 0) return "$0.0000";
  if (n < 0.0001) return `$${n.toFixed(6)}`;
  if (n < 0.01) return `$${n.toFixed(5)}`;
  return `$${n.toFixed(4)}`;
}

function quotaForWindow(monthlyLimitUsd, window) {
  const f = QUOTA_FRACTIONS[window] ?? 1;
  return (Number(monthlyLimitUsd) || 0) * f;
}

function requestsFor(cost, quota) {
  if (!isFinite(quota) || quota <= 0) return 0;
  if (!isFinite(cost) || cost <= 0) return Infinity;
  return Math.floor(quota / cost);
}

function formatQuotaUsd(n) {
  if (!isFinite(n) || n === 0) return "$0";
  const fixed = n.toFixed(2).replace(/\.00$/, "");
  return `$${fixed}`;
}

function formatRequests(n) {
  if (!isFinite(n)) return n === Infinity ? "∞" : "0";
  if (n <= 0) return "0";
  if (n >= 1_000_000) return `${Math.round(n / 1_000_000)}M`;
  if (n >= 1000) return `${Math.round(n / 1000)}K`;
  return tokenFormatter.format(Math.floor(n));
}

function getEffectiveModels() {
  return state.models;
}

function isQwenTierActive(name) {
  const totalInput = state.inputTokens + state.cacheReadTokens;
  if (isGptLuna(name)) {
    const lowTier = totalInput <= GPT_LUNA_THRESHOLD;
    if (name.includes(GPT_LUNA_LOW_TIER)) return lowTier;
    if (name.includes(GPT_LUNA_HIGH_TIER)) return !lowTier;
    return true;
  }
  const lowTier = totalInput <= QWEN_THRESHOLD;
  if (!isQwenPlus(name)) return true;
  if (name.includes(LOW_TIER)) return lowTier;
  if (name.includes(HIGH_TIER)) return !lowTier;
  return true;
}

function getSelectedModel(effectiveModels) {
  const eff = effectiveModels ?? getEffectiveModels();
  if (!eff.length) return null;
  if (state.selectedModelName) {
    const target = normalizeName(state.selectedModelName);
    const match = eff.find((m) => normalizeName(m.name) === target);
    if (match) return { model: match, isAuto: false };
  }
  const tierModels = eff.filter((m) => isQwenTierActive(m.name));
  const pool = tierModels.length ? tierModels : eff;
  let best = pool[0];
  let bestReq = requestsFor(calculateCost(best, state.inputTokens, state.outputTokens, state.cacheReadTokens), best.monthlyLimitUsd || 0);
  let bestCost = calculateCost(best, state.inputTokens, state.outputTokens, state.cacheReadTokens);
  for (let i = 1; i < pool.length; i++) {
    const m = pool[i];
    const c = calculateCost(m, state.inputTokens, state.outputTokens, state.cacheReadTokens);
    const req = requestsFor(c, m.monthlyLimitUsd || 0);
    if (req > bestReq || (req === bestReq && c < bestCost)) {
      bestReq = req;
      bestCost = c;
      best = m;
    }
  }
  return { model: best, isAuto: true };
}

function sliderToTokens(pos, min, max, step, k) {
  const fraction = Math.max(0, Math.min(1, pos / 100));
  const raw = min + (max - min) * Math.pow(fraction, k);
  const snapped = step > 1 ? Math.round(raw / step) * step : Math.round(raw);
  return clamp(snapped, min, max);
}

function tokensToSlider(val, min, max, k) {
  if (max <= min) return 0;
  const fraction = Math.max(0, Math.min(1, (val - min) / (max - min)));
  return 100 * Math.pow(fraction, 1 / k);
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
    const monthlyLimitUsd = cleanNum(parts[4]) || 60;
    out.push({ name, input, output, cacheRead, monthlyLimitUsd, promoMultiplier: 1 });
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
          monthlyLimitUsd: typeof m.monthlyLimitUsd === "number" ? m.monthlyLimitUsd : 60,
          promoMultiplier: 1
        }));
        return;
      }
    } catch {}
  }
  state.models = defaultModels.map((m) => ({ ...m }));
}

function saveModels() {
  try {
    const slim = state.models.map((m) => ({
      name: m.name,
      input: m.input,
      output: m.output,
      cacheRead: m.cacheRead,
      monthlyLimitUsd: m.monthlyLimitUsd
    }));
    localStorage.setItem(STORAGE_KEY, JSON.stringify(slim));
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
  const promoToggle = $("promoToggle");
  if (promoToggle) promoToggle.checked = state.showPromo;
}

function updateProjections(selectedResult) {
  const result = selectedResult ?? getSelectedModel();
  const ids = ["quota5h", "quotaWeek", "quotaMonth"];
  const hintIds = ["quota5hHint", "quotaWeekHint", "quotaMonthHint"];
  const windows = ["fiveHours", "week", "month"];
  if (!result) {
    ids.forEach((id) => { const el = $(id); if (el) el.textContent = "0"; });
    hintIds.forEach((id) => { const el = $(id); if (el) el.textContent = ""; });
    return;
  }
  const { model: selected } = result;
  const cost = calculateCost(selected, state.inputTokens, state.outputTokens, state.cacheReadTokens);
  const mLimit = selected.monthlyLimitUsd || 0;
  windows.forEach((w, i) => {
    const quota = quotaForWindow(mLimit, w);
    const req = requestsFor(cost, quota);
    const el = $(ids[i]);
    const hint = $(hintIds[i]);
    if (el) {
      el.textContent = formatRequests(req);
      el.title = isFinite(cost) && cost > 0 ? `${formatQuotaUsd(quota)} cap @ ${fmt(cost)}/req` : `${formatQuotaUsd(quota)} cap`;
    }
    if (hint) hint.textContent = `${formatQuotaUsd(quota)} cap`;
  });
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
  const header = $("costHeader");
  if (!container || !header) return;

  const active = document.activeElement;
  const preserveModel = active?.dataset?.model;
  const caret = active?.selectionStart ?? null;

  const checksContainer = document.querySelector(".column-checks");
  const checkEls = checksContainer ? [...checksContainer.querySelectorAll('input[type="checkbox"]')] : [];
  const visibleCols = checkEls.filter((cb) => cb.checked).map((cb) => cb.dataset.col);

  container.replaceChildren();
  header.replaceChildren();
  container.classList.toggle("hide-promo", !state.showPromo);

  const filter = state.filterText.trim().toLowerCase();

  const eff = (effectiveModels ?? getEffectiveModels())
    .map((m) => {
      const multiplier = m.promoMultiplier || 1;
      const inputCost = (state.inputTokens * m.input) / 1_000_000 / multiplier;
      const outputCost = (state.outputTokens * m.output) / 1_000_000 / multiplier;
      const cacheCost = (state.cacheReadTokens * m.cacheRead) / 1_000_000 / multiplier;
      const totalCost = inputCost + outputCost + cacheCost;
      const qMonth = m.monthlyLimitUsd || 0;
      const reqTotal = requestsFor(totalCost, qMonth);
      const reqInput = requestsFor(inputCost, qMonth);
      const reqOutput = requestsFor(outputCost, qMonth);
      const reqCache = requestsFor(cacheCost, qMonth);
      const value = m.monthlyLimitUsd || 0;
      return {
        model: m,
        total: reqTotal,
        input: reqInput,
        output: reqOutput,
        cache: reqCache,
        value,
        _costTotal: totalCost,
        _costInput: inputCost,
        _costOutput: outputCost,
        _costCache: cacheCost
      };
    })
    .filter(({ model: m }) => {
      if (!filter) return true;
      return m.name.toLowerCase().includes(filter);
    });

  eff.sort((a, b) => {
    const key = state.sortKey || "name";
    const desc = state.sortDesc;
    let cmp;
    const rankVal = (v) => (v === Infinity ? Number.MAX_SAFE_INTEGER : v);
    if (key === "value") {
      cmp = a.value - b.value;
      if (cmp === 0) cmp = a.model.name.localeCompare(b.model.name);
      return desc ? -cmp : cmp;
    }
    switch (key) {
      case "total": cmp = rankVal(a.total) - rankVal(b.total); break;
      case "input": cmp = rankVal(a.input) - rankVal(b.input); break;
      case "output": cmp = rankVal(a.output) - rankVal(b.output); break;
      case "cache": cmp = rankVal(a.cache) - rankVal(b.cache); break;
      case "name": cmp = a.model.name.localeCompare(b.model.name); break;
      default: cmp = rankVal(a.total) - rankVal(b.total);
    }
    if (cmp === 0 && key !== "name") cmp = a.model.name.localeCompare(b.model.name);
    return desc ? -cmp : cmp;
  });

  if (!eff.length) {
    header.style.display = "none";
    const msg = filter
      ? `No models match "${state.filterText}".`
      : "No models to display for the current token range.";
    container.appendChild(createEl("div", "cost-empty", msg));
    return;
  }

  header.style.display = "";

  const barKey = state.sortKey || "total";
  const finiteForBar = (v) => (v === Infinity ? Number.MAX_SAFE_INTEGER : (Number.isFinite(v) ? v : 0));
  const barMax = barKey === "value"
    ? Math.max(...eff.map((r) => r.value), 0)
    : Math.max(...eff.map((r) => r[barKey] === "name" ? 0 : finiteForBar(r[barKey])), 0);

  const valueCols = visibleCols.length;
  const promoCol = state.showPromo ? 1 : 0;
  const gridCols = `minmax(140px, 0.2fr) 1fr` +
    (valueCols > 0 ? ` repeat(${valueCols}, minmax(70px, max-content))` : "") +
    (promoCol > 0 ? " 60px" : "");

  header.style.gridTemplateColumns = gridCols;

  header.appendChild(createEl("span", "hdr-cell hdr-name sortable",
    `Model${state.sortKey === "name" ? (state.sortDesc ? " \u2193" : " \u2191") : ""}`));
  header.appendChild(createEl("span", "hdr-cell hdr-bar", "%"));

  visibleCols.forEach((col) => {
    const arrow = col === state.sortKey ? (state.sortDesc ? " \u2193" : " \u2191") : "";
    const span = createEl("span", "hdr-cell hdr-val sortable", `${COL_SHORT[col]}${arrow}`);
    span.dataset.col = col;
    header.appendChild(span);
  });
  if (state.showPromo) {
    header.appendChild(createEl("span", "hdr-cell hdr-val", "Promo"));
  }

  const result = selectedResult ?? getSelectedModel(effectiveModels);
  const highlightedKey = result ? normalizeName(result.model.name) : null;

  eff.forEach(({ model: m, total, input, output, cache, value: eff, _costTotal, _costInput, _costOutput, _costCache }) => {
    const isHighlighted = highlightedKey && normalizeName(m.name) === highlightedKey;
    const cls = `cost-row${isHighlighted ? " highlighted" : ""}`;
    const row = createEl("div", cls);
    row.style.opacity = isQwenTierActive(m.name) ? "" : "0.35";
    row.style.gridTemplateColumns = gridCols;
    const costMap = { total: _costTotal, input: _costInput, output: _costOutput, cache: _costCache, value: _costTotal };
    const quotaHint = formatQuotaUsd(m.monthlyLimitUsd || 0);
    row.title = `${m.name} — ${fmt(_costTotal)} per request · ${quotaHint} monthly cap`;

    row.appendChild(createEl("span", "cost-name", m.name));

    const rawBarVal = (state.sortKey && state.sortKey !== "name") ? (state.sortKey === "value" ? eff : ({ total, input, output, cache })[state.sortKey]) : total;
    const barVal = rawBarVal === Infinity ? Number.MAX_SAFE_INTEGER : (Number.isFinite(rawBarVal) ? rawBarVal : 0);
    const barWrap = createEl("div", "cost-bar-wrap");
    const bar = createEl("div", "cost-bar");
    bar.style.width = `${barMax > 0 ? (barVal / barMax) * 100 : 0}%`;
    barWrap.appendChild(bar);
    row.appendChild(barWrap);

    const vals = { total, input, output, cache, value: eff };
    visibleCols.forEach((col) => {
      if (col === "value") {
        const cls = `cost-cell${(m.monthlyLimitUsd || 0) < 60 ? " cost-cell--low" : ""}`;
        const cell = createEl("span", cls, formatQuotaUsd(m.monthlyLimitUsd || 0));
        cell.title = `${quotaHint} monthly cap`;
        row.appendChild(cell);
      } else {
        const v = vals[col];
        const cell = createEl("span", "cost-cell", formatRequests(v));
        const costForCol = costMap[col];
        if (isFinite(costForCol) && costForCol > 0) {
          cell.title = `${quotaHint} cap @ ${fmt(costForCol)}/req`;
        } else if (v === Infinity) {
          cell.title = `${quotaHint} cap · cost-free`;
        }
        row.appendChild(cell);
      }
    });

    if (state.showPromo) {
      const wrap = document.createElement("span");
      wrap.className = "cost-promo-wrap";
      wrap.setAttribute("data-value", m.promoMultiplier || 1);

      const promo = document.createElement("input");
      promo.type = "number";
      promo.className = "cost-promo";
      promo.min = "1";
      promo.step = "1";
      promo.value = m.promoMultiplier || 1;
      promo.setAttribute("value", promo.value);
      promo.style.setProperty("--promo-multiplier", m.promoMultiplier || 1);
      promo.dataset.model = m.name;
      promo.setAttribute("aria-label", `Promo multiplier for ${m.name}`);

      wrap.appendChild(promo);
      row.appendChild(wrap);
    }

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
  const inputCap = Math.max(MIN_INPUT, MAX_TOTAL_CONTEXT - state.cacheReadTokens);
  const cacheCap = Math.max(MIN_CACHE, MAX_TOTAL_CONTEXT - state.inputTokens);
  state.inputTokens = clamp(state.inputTokens, MIN_INPUT, inputCap);
  state.cacheReadTokens = clamp(state.cacheReadTokens, MIN_CACHE, cacheCap);
  $("inputTokensNum").min = MIN_INPUT;
  $("inputTokensNum").max = inputCap;
  $("inputTokens").value = tokensToSlider(state.inputTokens, MIN_INPUT, inputCap, EXP_K_INPUT);
  $("cacheReadTokensNum").min = MIN_CACHE;
  $("cacheReadTokensNum").max = cacheCap;
  $("cacheReadTokens").value = tokensToSlider(state.cacheReadTokens, MIN_CACHE, cacheCap, EXP_K_CACHE);
}

function setupOutputControl() {
  const slider = $("outputTokens");
  const num = $("outputTokensNum");
  const STEP = 1;
  const set = (val, source) => {
    let v = clamp(Number(val), MIN_OUTPUT, MAX_OUTPUT);
    if (!isFinite(v)) v = MIN_OUTPUT;
    state.outputTokens = v;
    if (source !== "slider") slider.value = tokensToSlider(v, MIN_OUTPUT, MAX_OUTPUT, EXP_K_OUTPUT);
    if (source !== "num") num.value = v;
    scheduleRender();
  };
  slider.addEventListener("input", () => {
    const tokens = sliderToTokens(Number(slider.value), MIN_OUTPUT, MAX_OUTPUT, STEP, EXP_K_OUTPUT);
    set(tokens, "slider");
  });
  num.addEventListener("input", () => set(num.value, "num"));
}

function setupContextControls() {
  const inputSlider = $("inputTokens");
  const inputNum = $("inputTokensNum");
  const cacheSlider = $("cacheReadTokens");
  const cacheNum = $("cacheReadTokensNum");
  const INPUT_STEP = 1;
  const CACHE_STEP = 1;

  const inputCap = () => Math.max(MIN_INPUT, MAX_TOTAL_CONTEXT - state.cacheReadTokens);
  const cacheCap = () => Math.max(MIN_CACHE, MAX_TOTAL_CONTEXT - state.inputTokens);

  const setInput = (val, source) => {
    const cap = inputCap();
    let v = clamp(Number(val), MIN_INPUT, cap);
    if (!isFinite(v)) v = MIN_INPUT;
    state.inputTokens = v;
    if (source !== "slider") inputSlider.value = tokensToSlider(v, MIN_INPUT, cap, EXP_K_INPUT);
    if (source !== "num") inputNum.value = v;
    syncContextCaps();
    scheduleRender();
  };

  const setCache = (val, source) => {
    const cap = cacheCap();
    let v = clamp(Number(val), MIN_CACHE, cap);
    if (!isFinite(v)) v = MIN_CACHE;
    state.cacheReadTokens = v;
    if (source !== "slider") cacheSlider.value = tokensToSlider(v, MIN_CACHE, cap, EXP_K_CACHE);
    if (source !== "num") cacheNum.value = v;
    syncContextCaps();
    scheduleRender();
  };

  inputSlider.addEventListener("input", () => {
    const tokens = sliderToTokens(Number(inputSlider.value), MIN_INPUT, inputCap(), INPUT_STEP, EXP_K_INPUT);
    setInput(tokens, "slider");
  });
  inputNum.addEventListener("input", () => setInput(inputNum.value, "num"));
  cacheSlider.addEventListener("input", () => {
    const tokens = sliderToTokens(Number(cacheSlider.value), MIN_CACHE, cacheCap(), CACHE_STEP, EXP_K_CACHE);
    setCache(tokens, "slider");
  });
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
    localStorage.removeItem(STORAGE_KEY);
    renderAll();
    showStatus($("priceStatus"), "Local storage cleared, defaults restored.", true);
  });
}

function setupRequestInputs() {}

function setupModelSelect() {
  const select = $("modelSelect");
  if (!select) return;
  select.addEventListener("change", () => {
    const name = select.value;
    if (!name) return;
    state.selectedModelName = name;
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
    model.promoMultiplier = v;
    promo.setAttribute("value", v);
    const wrap = promo.closest(".cost-promo-wrap");
    if (wrap) wrap.setAttribute("data-value", v);
    promo.style.setProperty("--promo-multiplier", v);
    scheduleRender();
  });
}

function setupCostToolbar() {
  const filterInput = $("costFilter");

  if (filterInput) {
    filterInput.addEventListener("input", () => {
      state.filterText = filterInput.value;
      scheduleRender();
    });
  }

  const promoToggle = $("promoToggle");
  if (promoToggle) {
    promoToggle.addEventListener("change", () => {
      state.showPromo = promoToggle.checked;
      scheduleRender();
    });
  }
}

function setupColumnChecks() {
  const container = document.querySelector(".column-checks");
  if (!container) return;

  container.addEventListener("change", (e) => {
    const cb = e.target;
    if (cb.type !== "checkbox") return;
    if (cb.checked) {
      state.sortKey = cb.dataset.col;
      state.sortDesc = false;
    } else if (!cb.checked && cb.dataset.col === state.sortKey) {
      const checks = [...container.querySelectorAll('input[type="checkbox"]')];
      const next = checks.find((c) => c.checked && c.dataset.col && c.dataset.col !== state.sortKey);
      state.sortKey = next ? next.dataset.col : "name";
      state.sortDesc = false;
    }
    scheduleRender();
  });
}

function setupHeaderSort() {
  const header = $("costHeader");
  if (!header) return;

  header.addEventListener("click", (e) => {
    const cell = e.target.closest(".hdr-cell");
    if (!cell || !cell.classList.contains("sortable")) return;

    const col = cell.dataset.col || (cell.classList.contains("hdr-name") ? "name" : null);
    if (!col) return;

    if (col === state.sortKey) {
      state.sortDesc = !state.sortDesc;
    } else {
      state.sortKey = col;
      state.sortDesc = false;
    }
    scheduleRender();
  });
}

const COL_SHORT = {
  total: "Req Total",
  input: "Req Input",
  output: "Req Output",
  cache: "Req Cache",
  value: "Value"
};

function init() {
  loadModels();

  state.inputTokens = clamp(
    Number($("inputTokensNum").value) || MIN_INPUT,
    MIN_INPUT,
    MAX_TOTAL_CONTEXT
  );
  state.outputTokens = clamp(
    Number($("outputTokensNum").value) || MIN_OUTPUT,
    MIN_OUTPUT,
    MAX_OUTPUT
  );
  state.cacheReadTokens = clamp(
    Number($("cacheReadTokensNum").value) || MIN_CACHE,
    MIN_CACHE,
    MAX_TOTAL_CONTEXT
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
  setupCostToolbar();
  setupColumnChecks();
  setupHeaderSort();

  syncContextCaps();
  renderAll();
}

export { calculateCost, defaultModels };

if (typeof document !== "undefined") init();
