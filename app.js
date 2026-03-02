var CONFIG = {
  endpoint: "https://api.spot-hinta.fi/Today",
  refreshMs: 3600000,
  uiTickMs: 30000
};

var STORAGE_KEY = "sahkohinta_tv_last_success_v4";
var state = { lastData: null, viewMode: "main" };

var mainViewEl = document.getElementById("mainView");
var chartViewEl = document.getElementById("chartView");
var chartSvgEl = document.getElementById("chartSvg");

var slotEl = document.getElementById("slotText");
var priceEl = document.getElementById("priceText");
var updatedEl = document.getElementById("updatedText");
var statusEl = document.getElementById("statusText");

var minHourEl = document.getElementById("minHourText");
var minValueEl = document.getElementById("minValueText");
var maxHourEl = document.getElementById("maxHourText");
var maxValueEl = document.getElementById("maxValueText");
var avgValueEl = document.getElementById("avgValueText");

function twoDigits(value) {
  return value < 10 ? "0" + value : String(value);
}

function formatCents(value) {
  return value.toLocaleString("fi-FI", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 2
  });
}

function formatTime(isoString) {
  var date = new Date(isoString);

  if (isNaN(date.getTime())) {
    return "--:--";
  }

  return twoDigits(date.getHours()) + ":" + twoDigits(date.getMinutes());
}

function formatHourRange(hour) {
  var endHour = (hour + 1) % 24;
  return "klo " + twoDigits(hour) + " - " + twoDigits(endHour);
}

function formatAxisTick(value) {
  var rounded = Math.round(value);
  var isInteger = Math.abs(value - rounded) < 0.001;

  return value.toLocaleString("fi-FI", {
    minimumFractionDigits: isInteger ? 0 : 1,
    maximumFractionDigits: isInteger ? 0 : 1
  });
}

function getTimeMs(isoString) {
  var date = new Date(isoString);

  if (isNaN(date.getTime())) {
    return 0;
  }

  return date.getTime();
}

function getLocalDateKey(date) {
  return (
    date.getFullYear() +
    "-" +
    twoDigits(date.getMonth() + 1) +
    "-" +
    twoDigits(date.getDate())
  );
}

function isFiniteNumber(value) {
  return typeof value === "number" && isFinite(value);
}

function isValidIso(isoString) {
  return typeof isoString === "string" && !isNaN(new Date(isoString).getTime());
}

function normalizeHour(hour) {
  if (typeof hour !== "number" || hour % 1 !== 0) {
    return null;
  }

  if (hour < 0 || hour > 23) {
    return null;
  }

  return hour;
}

function normalizeHourlyPrices(hourlyPrices) {
  if (!Array.isArray(hourlyPrices)) {
    return [];
  }

  var byHour = {};
  var i;

  for (i = 0; i < hourlyPrices.length; i += 1) {
    var row = hourlyPrices[i];

    if (!row || typeof row !== "object") {
      continue;
    }

    var hour = normalizeHour(row.hour);
    var cents = row.centsPerKwh;

    if (hour === null || !isFiniteNumber(cents)) {
      continue;
    }

    if (typeof byHour[hour] === "undefined") {
      byHour[hour] = cents;
    }
  }

  var hours = Object.keys(byHour)
    .map(function (key) {
      return Number(key);
    })
    .sort(function (a, b) {
      return a - b;
    });

  var normalized = [];

  for (i = 0; i < hours.length; i += 1) {
    normalized.push({
      hour: hours[i],
      centsPerKwh: byHour[hours[i]]
    });
  }

  return normalized;
}

function makeSingleHourPrice(centsPerKwh) {
  if (!isFiniteNumber(centsPerKwh)) {
    return [];
  }

  return [
    {
      hour: new Date().getHours(),
      centsPerKwh: centsPerKwh
    }
  ];
}

function buildRecordFromSpotArray(rows, fetchedAtOverride) {
  if (!Array.isArray(rows)) {
    return null;
  }

  var todayKey = getLocalDateKey(new Date());
  var buckets = {};
  var latestMs = 0;
  var i;

  for (i = 0; i < rows.length; i += 1) {
    var row = rows[i];

    if (!row || typeof row !== "object") {
      continue;
    }

    if (!isValidIso(row.DateTime)) {
      continue;
    }

    var rowDate = new Date(row.DateTime);

    if (getLocalDateKey(rowDate) !== todayKey) {
      continue;
    }

    var hour = rowDate.getHours();
    var priceEuro = isFiniteNumber(row.PriceWithTax) ? row.PriceWithTax : row.PriceNoTax;

    if (!isFiniteNumber(priceEuro)) {
      continue;
    }

    var cents = priceEuro * 100;

    if (!buckets[hour]) {
      buckets[hour] = { sum: 0, count: 0 };
    }

    buckets[hour].sum += cents;
    buckets[hour].count += 1;

    if (rowDate.getTime() > latestMs) {
      latestMs = rowDate.getTime();
    }
  }

  var hours = Object.keys(buckets)
    .map(function (key) {
      return Number(key);
    })
    .sort(function (a, b) {
      return a - b;
    });

  var hourlyPrices = [];

  for (i = 0; i < hours.length; i += 1) {
    var hourKey = hours[i];
    var bucket = buckets[hourKey];

    if (bucket.count > 0) {
      hourlyPrices.push({
        hour: hourKey,
        centsPerKwh: bucket.sum / bucket.count
      });
    }
  }

  if (hourlyPrices.length === 0) {
    return null;
  }

  var nowIso = new Date().toISOString();

  return {
    updatedAt: latestMs > 0 ? new Date(latestMs).toISOString() : nowIso,
    fetchedAt: fetchedAtOverride || nowIso,
    dayKey: todayKey,
    hourlyPrices: hourlyPrices
  };
}

function buildRecordFromLegacy(rawData, fetchedAtOverride) {
  if (!rawData || typeof rawData !== "object") {
    return null;
  }

  var hourlyPrices = normalizeHourlyPrices(rawData.hourlyPrices);

  if (hourlyPrices.length === 0) {
    hourlyPrices = makeSingleHourPrice(rawData.centsPerKwh);
  }

  if (hourlyPrices.length === 0) {
    return null;
  }

  var nowIso = new Date().toISOString();
  var updatedAt = isValidIso(rawData.updatedAt) ? rawData.updatedAt : nowIso;

  return {
    updatedAt: updatedAt,
    fetchedAt: isValidIso(rawData.fetchedAt) ? rawData.fetchedAt : (fetchedAtOverride || nowIso),
    dayKey: typeof rawData.dayKey === "string" ? rawData.dayKey : getLocalDateKey(new Date(updatedAt)),
    hourlyPrices: hourlyPrices
  };
}

function buildRecord(rawData, fetchedAtOverride) {
  var spotRecord = buildRecordFromSpotArray(rawData, fetchedAtOverride);

  if (spotRecord) {
    return spotRecord;
  }

  return buildRecordFromLegacy(rawData, fetchedAtOverride);
}

function getCurrentSlot(record) {
  var currentHour = new Date().getHours();
  var i;

  for (i = 0; i < record.hourlyPrices.length; i += 1) {
    if (record.hourlyPrices[i].hour === currentHour) {
      return record.hourlyPrices[i];
    }
  }

  return record.hourlyPrices[0];
}

function getSummary(record) {
  var hourlyPrices = record.hourlyPrices;
  var i;

  var minRow = hourlyPrices[0];
  var maxRow = hourlyPrices[0];
  var sum = 0;

  for (i = 0; i < hourlyPrices.length; i += 1) {
    var row = hourlyPrices[i];
    sum += row.centsPerKwh;

    if (row.centsPerKwh < minRow.centsPerKwh) {
      minRow = row;
    }

    if (row.centsPerKwh > maxRow.centsPerKwh) {
      maxRow = row;
    }
  }

  return {
    minRow: minRow,
    maxRow: maxRow,
    avgPrice: sum / hourlyPrices.length
  };
}

function setStatus(isConnected) {
  if (isConnected) {
    statusEl.textContent = "Yhteys OK";
    statusEl.setAttribute("data-state", "ok");
  } else {
    statusEl.textContent = "Ei yhteytt\u00e4 - n\u00e4ytet\u00e4\u00e4n viimeisin arvo";
    statusEl.setAttribute("data-state", "offline");
  }
}

function renderRecord(record) {
  var currentSlot = getCurrentSlot(record);
  var summary = getSummary(record);
  var updateSource = isValidIso(record.fetchedAt) ? record.fetchedAt : record.updatedAt;

  slotEl.textContent = formatHourRange(currentSlot.hour) + ": hinta";
  priceEl.textContent = formatCents(currentSlot.centsPerKwh);
  updatedEl.textContent = "P\u00e4ivitetty: " + formatTime(updateSource);

  minHourEl.textContent = formatHourRange(summary.minRow.hour);
  minValueEl.textContent = formatCents(summary.minRow.centsPerKwh);

  maxHourEl.textContent = formatHourRange(summary.maxRow.hour);
  maxValueEl.textContent = formatCents(summary.maxRow.centsPerKwh);

  avgValueEl.textContent = formatCents(summary.avgPrice);
}

function clearSvg(svg) {
  while (svg.firstChild) {
    svg.removeChild(svg.firstChild);
  }
}

function createSvgElement(name, className) {
  var node = document.createElementNS("http://www.w3.org/2000/svg", name);

  if (className) {
    node.setAttribute("class", className);
  }

  return node;
}

function setSvgAttributes(node, attrs) {
  var keys = Object.keys(attrs);
  var i;

  for (i = 0; i < keys.length; i += 1) {
    node.setAttribute(keys[i], String(attrs[keys[i]]));
  }
}

function appendSvgText(parent, x, y, className, textContent, textAnchor) {
  var textNode = createSvgElement("text", className);

  setSvgAttributes(textNode, {
    x: x,
    y: y,
    "text-anchor": textAnchor || "start"
  });

  textNode.textContent = textContent;
  parent.appendChild(textNode);
}

function getNiceStep(value) {
  if (!isFiniteNumber(value) || value <= 0) {
    return 1;
  }

  var exponent = Math.floor(Math.log(value) / Math.LN10);
  var magnitude = Math.pow(10, exponent);
  var normalized = value / magnitude;
  var niceBase = 1;

  if (normalized > 5) {
    niceBase = 10;
  } else if (normalized > 2) {
    niceBase = 5;
  } else if (normalized > 1) {
    niceBase = 2;
  }

  return niceBase * magnitude;
}

function renderNoDataChart() {
  if (!chartSvgEl) {
    return;
  }

  clearSvg(chartSvgEl);
  chartSvgEl.setAttribute("viewBox", "0 0 1720 860");
  appendSvgText(chartSvgEl, 860, 430, "axis-label", "Ei hintadataa", "middle");
}

function renderChart(record) {
  if (!chartSvgEl) {
    return;
  }

  if (!record || !record.hourlyPrices || record.hourlyPrices.length === 0) {
    renderNoDataChart();
    return;
  }

  clearSvg(chartSvgEl);

  var width = 1720;
  var height = 860;
  var marginLeft = 108;
  var marginRight = 26;
  var marginTop = 66;
  var marginBottom = 118;
  var plotWidth = width - marginLeft - marginRight;
  var plotHeight = height - marginTop - marginBottom;

  chartSvgEl.setAttribute("viewBox", "0 0 " + width + " " + height);

  var values = [];
  var i;

  for (i = 0; i < 24; i += 1) {
    values.push(null);
  }

  for (i = 0; i < record.hourlyPrices.length; i += 1) {
    var row = record.hourlyPrices[i];

    if (row && normalizeHour(row.hour) !== null && isFiniteNumber(row.centsPerKwh)) {
      values[row.hour] = row.centsPerKwh;
    }
  }

  var minHour = -1;
  var maxHour = -1;
  var minValue = Infinity;
  var maxValue = -Infinity;

  for (i = 0; i < 24; i += 1) {
    if (!isFiniteNumber(values[i])) {
      continue;
    }

    if (values[i] < minValue) {
      minValue = values[i];
      minHour = i;
    }

    if (values[i] > maxValue) {
      maxValue = values[i];
      maxHour = i;
    }
  }

  if (!isFiniteNumber(maxValue)) {
    renderNoDataChart();
    return;
  }

  var step = getNiceStep(maxValue / 5);
  var axisMax = Math.ceil(maxValue / step) * step;

  if (axisMax < step * 4) {
    axisMax = step * 4;
  }

  var tick;

  for (tick = 0; tick <= axisMax + 0.0001; tick += step) {
    var y = marginTop + plotHeight - (tick / axisMax) * plotHeight;
    var line = createSvgElement("line", "grid-line");

    setSvgAttributes(line, {
      x1: marginLeft,
      y1: y,
      x2: marginLeft + plotWidth,
      y2: y
    });

    chartSvgEl.appendChild(line);

    appendSvgText(
      chartSvgEl,
      marginLeft - 16,
      y + 11,
      "y-label",
      formatAxisTick(tick),
      "end"
    );
  }

  appendSvgText(chartSvgEl, marginLeft - 86, marginTop - 18, "axis-label", "c/kWh", "start");

  var slotWidth = plotWidth / 24;
  var barWidth = slotWidth * 0.9;
  var currentHour = new Date().getHours();

  for (i = 0; i < 24; i += 1) {
    var x = marginLeft + i * slotWidth + (slotWidth - barWidth) / 2;
    var value = values[i];
    var barHeight = 2;
    var yTop = marginTop + plotHeight - barHeight;
    var barClass = "bar";

    if (isFiniteNumber(value)) {
      barHeight = (value / axisMax) * plotHeight;
      yTop = marginTop + plotHeight - barHeight;
    } else {
      barClass += " bar-missing";
    }

    if (i === minHour) {
      barClass += " bar-min";
    }

    if (i === maxHour) {
      barClass += " bar-max";
    }

    if (i === currentHour) {
      barClass += " bar-now";
    }

    var rect = createSvgElement("rect", barClass);

    setSvgAttributes(rect, {
      x: x,
      y: yTop,
      width: barWidth,
      height: barHeight
    });

    chartSvgEl.appendChild(rect);

    var xLabelClass = "x-label";

    if (i === currentHour) {
      xLabelClass += " x-label-now";
    }

    appendSvgText(
      chartSvgEl,
      marginLeft + i * slotWidth + slotWidth / 2,
      height - 30,
      xLabelClass,
      String(i),
      "middle"
    );
  }
}

function renderAll(record) {
  renderRecord(record);

  if (state.viewMode === "chart") {
    renderChart(record);
  }
}

function saveToCache(record) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(record));
  } catch (error) {
    // localStorage may fail on some TV browser configurations.
  }
}

function loadFromCache() {
  try {
    var rawValue = localStorage.getItem(STORAGE_KEY);

    if (!rawValue) {
      return null;
    }

    return buildRecord(JSON.parse(rawValue), null);
  } catch (error) {
    return null;
  }
}

function fetchLatest() {
  var fetchStartIso = new Date().toISOString();

  return fetch(CONFIG.endpoint, { cache: "no-store" })
    .then(function (response) {
      if (!response.ok) {
        throw new Error("HTTP " + response.status);
      }

      return response.json();
    })
    .then(function (payload) {
      var record = buildRecord(payload, fetchStartIso);

      if (!record) {
        throw new Error("Invalid payload");
      }

      state.lastData = record;
      renderAll(record);
      saveToCache(record);
      setStatus(true);
    })
    .catch(function () {
      if (state.lastData) {
        renderAll(state.lastData);
      }

      setStatus(false);
    });
}

function scheduleRefresh(cachedRecord) {
  var initialDelayMs = 0;
  var todayKey = getLocalDateKey(new Date());

  if (
    cachedRecord &&
    cachedRecord.dayKey === todayKey &&
    isValidIso(cachedRecord.fetchedAt)
  ) {
    var elapsedMs = Date.now() - getTimeMs(cachedRecord.fetchedAt);

    if (elapsedMs >= 0 && elapsedMs < CONFIG.refreshMs) {
      initialDelayMs = CONFIG.refreshMs - elapsedMs;
    }
  }

  setTimeout(function () {
    fetchLatest();
    setInterval(fetchLatest, CONFIG.refreshMs);
  }, initialDelayMs);
}

function startUiTicker() {
  setInterval(function () {
    if (state.lastData) {
      renderAll(state.lastData);
    }
  }, CONFIG.uiTickMs);
}

function setViewMode(mode) {
  if (mode !== "main" && mode !== "chart") {
    return;
  }

  state.viewMode = mode;

  var showMain = mode === "main";

  if (mainViewEl) {
    mainViewEl.hidden = !showMain;
    mainViewEl.setAttribute("aria-hidden", showMain ? "false" : "true");
  }

  if (chartViewEl) {
    chartViewEl.hidden = showMain;
    chartViewEl.setAttribute("aria-hidden", showMain ? "true" : "false");
  }

  if (!showMain) {
    renderChart(state.lastData);
  }
}

function isArrowKeyEvent(event) {
  if (!event) {
    return false;
  }

  var key = event.key;

  if (
    key === "ArrowLeft" ||
    key === "ArrowRight" ||
    key === "ArrowUp" ||
    key === "ArrowDown"
  ) {
    return true;
  }

  var code = event.keyCode || event.which;

  return code === 37 || code === 38 || code === 39 || code === 40;
}

function setupRemoteNavigation() {
  document.addEventListener("keydown", function (event) {
    if (!isArrowKeyEvent(event)) {
      return;
    }

    if (event.repeat) {
      return;
    }

    event.preventDefault();

    if (state.viewMode === "main") {
      setViewMode("chart");
    } else {
      setViewMode("main");
    }
  });
}

function init() {
  setViewMode("main");
  setupRemoteNavigation();

  var cached = loadFromCache();

  if (cached) {
    state.lastData = cached;
    renderAll(cached);
    setStatus(true);
  } else {
    setStatus(false);
    renderNoDataChart();
  }

  startUiTicker();
  scheduleRefresh(cached);
}

init();
