const CONFIG = { endpoint: "./mock-price.json", refreshMs: 600000 };

var STORAGE_KEY = "sahkohinta_tv_last_success_v2";
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

function buildRecord(rawData, fetchedAtOverride) {
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

  return {
    updatedAt: isValidIso(rawData.updatedAt) ? rawData.updatedAt : nowIso,
    fetchedAt: isValidIso(rawData.fetchedAt) ? rawData.fetchedAt : (fetchedAtOverride || nowIso),
    hourlyPrices: hourlyPrices
  };
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

function init() {
  var cached = loadFromCache();

  if (cached) {
    state.lastData = cached;
    renderRecord(cached);
    setStatus(false);
  }

  fetchLatest();
  setInterval(fetchLatest, CONFIG.refreshMs);
}

init();
