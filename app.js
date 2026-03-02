var CONFIG = {
  endpoint: "https://api.spot-hinta.fi/Today",
  refreshMs: 3600000,
  uiTickMs: 30000
};

var STORAGE_KEY = "sahkohinta_tv_last_success_v3";
var state = { lastData: null };

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
      renderRecord(record);
      saveToCache(record);
      setStatus(true);
    })
    .catch(function () {
      if (state.lastData) {
        renderRecord(state.lastData);
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
      renderRecord(state.lastData);
    }
  }, CONFIG.uiTickMs);
}

function init() {
  var cached = loadFromCache();

  if (cached) {
    state.lastData = cached;
    renderRecord(cached);
    setStatus(true);
  } else {
    setStatus(false);
  }

  startUiTicker();
  scheduleRefresh(cached);
}

init();
