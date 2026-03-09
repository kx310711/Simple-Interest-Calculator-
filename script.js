const principalInput = document.getElementById("principal");
const rateInput = document.getElementById("rate");
const rateNumberInput = document.getElementById("rate_number");
const rateTypeInput = document.getElementById("rate_type");
const rateEndInput = document.getElementById("rate_end");
const rateEndGroup = document.getElementById("rate_end_group");
const yearsInput = document.getElementById("years");
const monthlyInput = document.getElementById("monthly");
const modeInput = document.getElementById("mode");
const currencyInput = document.getElementById("currency");
const compareInput = document.getElementById("compare_mode");
const breakdownModeInput = document.getElementById("breakdown_mode");
const compoundFrequencyInput = document.getElementById("compound_frequency");
const compoundGroup = document.getElementById("compound_group");
const themeButton = document.getElementById("theme_btn");

const rateLabel = document.getElementById("rate_val");
const errorNode = document.getElementById("error");
const statusNode = document.getElementById("share_status");
const resultNode = document.getElementById("result");
const interestMetricNode = document.getElementById("interest_metric");
const amountMetricNode = document.getElementById("amount_metric");
const yearMetricNode = document.getElementById("year_metric");
const historyList = document.getElementById("history_list");
const chartCanvas = document.getElementById("growth_chart");
const breakdownBody = document.getElementById("breakdown_body");
const periodLabel = document.getElementById("period_label");
const comparePanel = document.getElementById("compare_panel");
const compareSimpleNode = document.getElementById("compare_simple");
const compareCompoundNode = document.getElementById("compare_compound");
const differenceBadge = document.getElementById("difference_badge");

const HISTORY_KEY = "interest_calc_history_v4";
const THEME_KEY = "interest_calc_theme_mode";
const prefersDark = window.matchMedia("(prefers-color-scheme: dark)");
let lastComputed = null;
let themeMode = "auto";

function getLocaleForCurrency(currency) {
  if (currency === "DOP") return "es-DO";
  if (currency === "EUR") return "de-DE";
  return "en-US";
}

function formatCurrency(value, currency) {
  return new Intl.NumberFormat(getLocaleForCurrency(currency), {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
  }).format(value);
}

function formatPercent(value) {
  return `${value.toFixed(2)}%`;
}

function setTheme(mode) {
  themeMode = mode;
  localStorage.setItem(THEME_KEY, mode);

  if (mode === "auto") {
    document.documentElement.removeAttribute("data-theme");
    themeButton.textContent = "Theme: Auto";
    return;
  }

  document.documentElement.setAttribute("data-theme", mode);
  themeButton.textContent = `Theme: ${mode === "dark" ? "Dark" : "Light"}`;
}

function cycleTheme() {
  if (themeMode === "auto") setTheme("light");
  else if (themeMode === "light") setTheme("dark");
  else setTheme("auto");
}

function initTheme() {
  setTheme(localStorage.getItem(THEME_KEY) || "auto");
  themeButton.addEventListener("click", cycleTheme);

  prefersDark.addEventListener("change", function () {
    if (themeMode === "auto") {
      document.documentElement.removeAttribute("data-theme");
    }
  });
}

function getFormValues() {
  return {
    principal: Number(principalInput.value),
    rate: Number(rateInput.value),
    rateEnd: Number(rateEndInput.value),
    rateType: rateTypeInput.value,
    years: Number(yearsInput.value),
    monthlyContribution: Number(monthlyInput.value || 0),
    mode: modeInput.value,
    compare: compareInput.checked,
    breakdownMode: breakdownModeInput.value,
    currency: currencyInput.value,
    compoundsPerYear: Number(compoundFrequencyInput.value),
  };
}

function validate(values) {
  if (!Number.isFinite(values.principal) || values.principal <= 0) {
    return "Please enter a principal amount greater than 0.";
  }

  if (!Number.isFinite(values.rate) || values.rate < 0.25 || values.rate > 300) {
    return "Starting rate must be between 0.25% and 300%.";
  }

  if (values.rateType === "variable" && (!Number.isFinite(values.rateEnd) || values.rateEnd < 0.25 || values.rateEnd > 300)) {
    return "Ending rate must be between 0.25% and 300%.";
  }

  if (!Number.isFinite(values.monthlyContribution) || values.monthlyContribution < 0) {
    return "Monthly contribution cannot be negative.";
  }

  return "";
}

function getAnnualRateForMonth(values, monthIndex, totalMonths) {
  if (values.rateType === "fixed") {
    return values.rate;
  }

  if (totalMonths <= 1) {
    return values.rate;
  }

  const progress = monthIndex / (totalMonths - 1);
  return values.rate + (values.rateEnd - values.rate) * progress;
}

// Builds detailed monthly periods for simple or compound calculations.
function buildMonthlyRows(values, modeOverride = null) {
  const mode = modeOverride || values.mode;
  const totalMonths = values.years * 12;
  const rows = [];

  let balance = values.principal;

  for (let month = 1; month <= totalMonths; month += 1) {
    const start = balance;
    const annualRate = getAnnualRateForMonth(values, month - 1, totalMonths);
    let interest = 0;

    if (mode === "simple") {
      interest = values.principal * (annualRate / 100 / 12);
      balance += interest;
    } else {
      const n = values.compoundsPerYear;
      const monthlyEffectiveRate = Math.pow(1 + annualRate / 100 / n, n / 12) - 1;
      interest = balance * monthlyEffectiveRate;
      balance += interest;
    }

    if (values.monthlyContribution > 0) {
      balance += values.monthlyContribution;
    }

    rows.push({
      period: month,
      start,
      contributions: values.monthlyContribution,
      interest,
      end: balance,
      annualRate,
    });
  }

  return rows;
}

function aggregateRows(monthlyRows, mode) {
  if (mode === "monthly") {
    return monthlyRows;
  }

  const yearly = [];

  for (let i = 0; i < monthlyRows.length; i += 12) {
    const chunk = monthlyRows.slice(i, i + 12);
    yearly.push({
      period: i / 12 + 1,
      start: chunk[0].start,
      contributions: chunk.reduce((sum, row) => sum + row.contributions, 0),
      interest: chunk.reduce((sum, row) => sum + row.interest, 0),
      end: chunk[chunk.length - 1].end,
      annualRate: chunk[chunk.length - 1].annualRate,
    });
  }

  return yearly;
}

function computeDetails(values, modeOverride = null) {
  const mode = modeOverride || values.mode;
  const monthlyRows = buildMonthlyRows(values, mode);
  const totalInterest = monthlyRows.reduce((sum, row) => sum + row.interest, 0);
  const totalAmount = monthlyRows.length ? monthlyRows[monthlyRows.length - 1].end : values.principal;
  const rows = aggregateRows(monthlyRows, values.breakdownMode);

  return {
    mode,
    totalInterest,
    totalAmount,
    rows,
    monthlyRows,
    maturityYear: new Date().getFullYear() + values.years,
  };
}

function drawChart(monthlyRows, principal, currency) {
  const points = [{ period: 0, end: principal }];

  for (let i = 11; i < monthlyRows.length; i += 12) {
    points.push({ period: i / 12 + 1, end: monthlyRows[i].end });
  }

  if (monthlyRows.length && monthlyRows.length % 12 !== 0) {
    const last = monthlyRows[monthlyRows.length - 1];
    points.push({ period: monthlyRows.length / 12, end: last.end });
  }

  const ctx = chartCanvas.getContext("2d");
  const dpr = window.devicePixelRatio || 1;
  const width = chartCanvas.clientWidth;
  const height = chartCanvas.clientHeight;

  chartCanvas.width = Math.floor(width * dpr);
  chartCanvas.height = Math.floor(height * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, width, height);

  if (points.length < 2) return;

  const pad = 34;
  const w = width - pad * 2;
  const h = height - pad * 2;
  const max = Math.max(...points.map((x) => x.end));
  const min = Math.min(...points.map((x) => x.end));
  const span = Math.max(max - min, 1);

  ctx.strokeStyle = "rgba(135,150,220,0.5)";
  ctx.lineWidth = 1;
  for (let i = 0; i <= 4; i += 1) {
    const y = pad + (h / 4) * i;
    ctx.beginPath();
    ctx.moveTo(pad, y);
    ctx.lineTo(width - pad, y);
    ctx.stroke();
  }

  ctx.strokeStyle = "#3767ff";
  ctx.lineWidth = 2.4;
  ctx.beginPath();

  points.forEach(function (point, i) {
    const x = pad + (w * i) / Math.max(points.length - 1, 1);
    const y = pad + h - ((point.end - min) / span) * h;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });

  ctx.stroke();

  ctx.fillStyle = "#3767ff";
  points.forEach(function (point, i) {
    const x = pad + (w * i) / Math.max(points.length - 1, 1);
    const y = pad + h - ((point.end - min) / span) * h;
    ctx.beginPath();
    ctx.arc(x, y, 2.7, 0, Math.PI * 2);
    ctx.fill();
  });

  ctx.fillStyle = "#5a639f";
  ctx.font = "12px Arial";
  ctx.fillText("Start", pad, height - 10);
  ctx.fillText(`Year ${Math.round(points[points.length - 1].period)}`, width - pad - 56, height - 10);
  ctx.fillText(formatCurrency(max, currency), pad, pad - 10);
  ctx.fillText(formatCurrency(min, currency), pad, height - pad + 14);
}

function renderBreakdown(rows, currency, breakdownMode) {
  periodLabel.textContent = breakdownMode === "monthly" ? "Month" : "Year";

  breakdownBody.innerHTML = rows
    .map(function (row) {
      return `
        <tr>
          <td>${row.period}</td>
          <td>${formatCurrency(row.start, currency)}</td>
          <td>${formatCurrency(row.contributions, currency)}</td>
          <td>${formatCurrency(row.interest, currency)}</td>
          <td>${formatCurrency(row.end, currency)}</td>
        </tr>
      `;
    })
    .join("");
}

function renderHistory(items) {
  if (!items.length) {
    historyList.innerHTML = "<li>No calculations yet.</li>";
    return;
  }

  historyList.innerHTML = items
    .map(function (entry) {
      return `<li>${entry.date}: ${entry.summary}</li>`;
    })
    .join("");
}

function updateHistory(item) {
  const current = JSON.parse(localStorage.getItem(HISTORY_KEY) || "[]");
  const next = [item, ...current].slice(0, 8);
  localStorage.setItem(HISTORY_KEY, JSON.stringify(next));
  renderHistory(next);
}

function updateRateDisplay() {
  rateLabel.textContent = formatPercent(Number(rateInput.value));
}

function updateModeUI() {
  compoundGroup.style.display = modeInput.value === "compound" ? "block" : "none";
  rateEndGroup.hidden = rateTypeInput.value !== "variable";
}

function syncRateFromSlider() {
  rateNumberInput.value = rateInput.value;
  updateRateDisplay();
}

function syncRateFromNumber() {
  const clamped = Math.max(0.25, Math.min(300, Number(rateNumberInput.value || 0.25)));
  rateInput.value = String(clamped);
  rateNumberInput.value = String(clamped);
  updateRateDisplay();
}

function renderCompare(values) {
  if (!values.compare) {
    comparePanel.hidden = true;
    differenceBadge.hidden = true;
    return;
  }

  const simple = computeDetails({ ...values, mode: "simple" }, "simple");
  const compound = computeDetails({ ...values, mode: "compound" }, "compound");

  compareSimpleNode.textContent = `${formatCurrency(simple.totalAmount, values.currency)} (Interest: ${formatCurrency(simple.totalInterest, values.currency)})`;
  compareCompoundNode.textContent = `${formatCurrency(compound.totalAmount, values.currency)} (Interest: ${formatCurrency(compound.totalInterest, values.currency)})`;

  const winner = compound.totalAmount >= simple.totalAmount ? "Compound" : "Simple";
  const diff = Math.abs(compound.totalAmount - simple.totalAmount);
  const base = Math.max(Math.min(simple.totalAmount, compound.totalAmount), 1);
  const pct = (diff / base) * 100;

  differenceBadge.textContent = `${winner} is higher by ${formatCurrency(diff, values.currency)} (${pct.toFixed(2)}%).`;
  differenceBadge.hidden = false;
  comparePanel.hidden = false;
}

function compute(saveHistory) {
  const values = getFormValues();
  const validationError = validate(values);

  if (validationError) {
    errorNode.textContent = saveHistory ? validationError : "";
    return;
  }

  errorNode.textContent = "";

  const details = computeDetails(values);
  renderCompare(values);

  interestMetricNode.textContent = formatCurrency(details.totalInterest, values.currency);
  amountMetricNode.textContent = formatCurrency(details.totalAmount, values.currency);
  yearMetricNode.textContent = String(details.maturityYear);

  resultNode.textContent =
    `${details.mode === "compound" ? "Compound" : "Simple"} ${values.rateType} rate result: ` +
    `${formatCurrency(details.totalAmount, values.currency)} total in ${details.maturityYear}. ` +
    `Interest earned: ${formatCurrency(details.totalInterest, values.currency)}.`;

  drawChart(details.monthlyRows, values.principal, values.currency);
  renderBreakdown(details.rows, values.currency, values.breakdownMode);

  lastComputed = { values, details };

  if (saveHistory) {
    updateHistory({
      date: new Date().toLocaleDateString(),
      summary:
        `${details.mode}/${values.rateType} | ${formatCurrency(values.principal, values.currency)} -> ` +
        `${formatCurrency(details.totalAmount, values.currency)} (${values.years}y @ ${formatPercent(values.rate)})`,
    });
  }
}

function buildShareUrl() {
  const values = getFormValues();
  const params = new URLSearchParams({
    p: String(values.principal || ""),
    r: String(values.rate || ""),
    re: String(values.rateEnd || ""),
    rt: values.rateType,
    y: String(values.years || ""),
    m: String(values.monthlyContribution || "0"),
    mode: values.mode,
    cur: values.currency,
    n: String(values.compoundsPerYear),
    cmp: values.compare ? "1" : "0",
    br: values.breakdownMode,
  });

  return `${window.location.origin}${window.location.pathname}?${params.toString()}`;
}

function prefillFromUrl() {
  const params = new URLSearchParams(window.location.search);

  if (params.has("p")) principalInput.value = params.get("p");
  if (params.has("r")) {
    const rate = Math.max(0.25, Math.min(300, Number(params.get("r"))));
    rateInput.value = String(rate);
    rateNumberInput.value = String(rate);
  }
  if (params.has("re")) rateEndInput.value = params.get("re");
  if (params.has("rt")) rateTypeInput.value = params.get("rt");
  if (params.has("y")) yearsInput.value = params.get("y");
  if (params.has("m")) monthlyInput.value = params.get("m");
  if (params.has("mode")) modeInput.value = params.get("mode");
  if (params.has("cur")) currencyInput.value = params.get("cur");
  if (params.has("n")) compoundFrequencyInput.value = params.get("n");
  if (params.has("cmp")) compareInput.checked = params.get("cmp") === "1";
  if (params.has("br")) breakdownModeInput.value = params.get("br");
}

async function copyShareLink() {
  const url = buildShareUrl();
  try {
    await navigator.clipboard.writeText(url);
    statusNode.textContent = "Share link copied to clipboard.";
  } catch (error) {
    statusNode.textContent = "Could not auto-copy; URL displayed in summary.";
    resultNode.textContent = url;
  }
}

async function copyResultText() {
  if (!lastComputed) {
    statusNode.textContent = "Calculate first before copying result.";
    return;
  }

  const text = `${resultNode.textContent} | Interest: ${interestMetricNode.textContent} | Total: ${amountMetricNode.textContent} | Maturity Year: ${yearMetricNode.textContent}`;

  try {
    await navigator.clipboard.writeText(text);
    statusNode.textContent = "Result copied to clipboard.";
  } catch (error) {
    statusNode.textContent = "Could not copy automatically. Please copy manually.";
  }
}

function exportCsv() {
  if (!lastComputed) {
    statusNode.textContent = "Calculate first before exporting CSV.";
    return;
  }

  const { values, details } = lastComputed;
  const rows = [
    ["Mode", details.mode],
    ["RateType", values.rateType],
    ["StartRate", values.rate],
    ["EndRate", values.rateType === "variable" ? values.rateEnd : values.rate],
    ["Principal", values.principal],
    ["Years", values.years],
    ["MonthlyContribution", values.monthlyContribution],
    ["Currency", values.currency],
    ["Interest", details.totalInterest],
    ["TotalAmount", details.totalAmount],
    ["MaturityYear", details.maturityYear],
    [],
    [values.breakdownMode === "monthly" ? "Month" : "Year", "Start", "Contributions", "Interest", "End"],
  ];

  details.rows.forEach(function (row) {
    rows.push([row.period, row.start.toFixed(2), row.contributions.toFixed(2), row.interest.toFixed(2), row.end.toFixed(2)]);
  });

  const csv = rows.map((x) => x.join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = "interest-breakdown.csv";
  anchor.click();
  URL.revokeObjectURL(url);
  statusNode.textContent = "CSV exported.";
}

function exportPdf() {
  if (!lastComputed) {
    statusNode.textContent = "Calculate first before exporting PDF.";
    return;
  }
  window.print();
}

function resetForm() {
  principalInput.value = "";
  rateInput.value = "10.25";
  rateNumberInput.value = "10.25";
  rateTypeInput.value = "fixed";
  rateEndInput.value = "14";
  yearsInput.value = "1";
  monthlyInput.value = "0";
  modeInput.value = "simple";
  currencyInput.value = "USD";
  breakdownModeInput.value = "yearly";
  compareInput.checked = false;
  compoundFrequencyInput.value = "12";
  updateModeUI();
  updateRateDisplay();

  errorNode.textContent = "";
  statusNode.textContent = "";
  resultNode.textContent = "Enter values to calculate your result.";
  interestMetricNode.textContent = "$0.00";
  amountMetricNode.textContent = "$0.00";
  yearMetricNode.textContent = "-";
  breakdownBody.innerHTML = "";
  comparePanel.hidden = true;
  differenceBadge.hidden = true;
  drawChart([], 0, "USD");
  lastComputed = null;
  principalInput.focus();
}

function bindLiveUpdates() {
  [
    principalInput,
    yearsInput,
    monthlyInput,
    modeInput,
    currencyInput,
    breakdownModeInput,
    rateTypeInput,
    rateEndInput,
    compoundFrequencyInput,
    compareInput,
  ].forEach(function (element) {
    element.addEventListener("input", function () {
      updateModeUI();
      compute(false);
    });
    element.addEventListener("change", function () {
      updateModeUI();
      compute(false);
    });
  });

  rateInput.addEventListener("input", function () {
    syncRateFromSlider();
    compute(false);
  });

  rateNumberInput.addEventListener("input", function () {
    syncRateFromNumber();
    compute(false);
  });
}

function init() {
  initTheme();
  prefillFromUrl();
  updateModeUI();
  updateRateDisplay();
  bindLiveUpdates();

  document.getElementById("compute_btn").addEventListener("click", function () {
    compute(true);
  });
  document.getElementById("reset_btn").addEventListener("click", resetForm);
  document.getElementById("copy_btn").addEventListener("click", copyResultText);
  document.getElementById("share_btn").addEventListener("click", copyShareLink);
  document.getElementById("csv_btn").addEventListener("click", exportCsv);
  document.getElementById("pdf_btn").addEventListener("click", exportPdf);

  [principalInput, monthlyInput, rateNumberInput, rateEndInput].forEach(function (input) {
    input.addEventListener("keydown", function (event) {
      if (event.key === "Enter") {
        compute(true);
      }
    });
  });

  renderHistory(JSON.parse(localStorage.getItem(HISTORY_KEY) || "[]"));
  compute(false);
}

init();
