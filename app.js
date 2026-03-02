const CONFIG = { endpoint: "./mock-price.json", refreshMs: 600000 };

var STORAGE_KEY = "sahkohinta_tv_last_success_v1";
var state = { lastData: null };

var priceEl = document.getElementById("priceText");
var updatedEl = document.getElementById("updatedText");
var statusEl = document.getElementById("statusText");

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

function isValidIso(isoString) {
  return typeof isoString === "string" && !isNaN(new Date(isoString).getTime());
}

function isValidData(data) {
  if (!data || typeof data !== "object") {
    return false;
  }

  if (typeof data.centsPerKwh !== "number" || !isFinite(data.centsPerKwh)) {
    return false;
  }

  return isValidIso(data.updatedAt);
}

function getDisplayUpdatedAt(data) {
  if (data && isValidIso(data.fetchedAt)) {
    return data.fetchedAt;
  }

  return data.updatedAt;
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

function renderValue(data) {
  priceEl.textContent = "NYT: " + formatCents(data.centsPerKwh) + " snt/kWh";
  updatedEl.textContent = "P\u00e4ivitetty: " + formatTime(getDisplayUpdatedAt(data));
}

function toRecord(payload) {
  return {
    centsPerKwh: payload.centsPerKwh,
    updatedAt: payload.updatedAt,
    fetchedAt: new Date().toISOString()
  };
}

function saveToCache(data) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
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

    var parsed = JSON.parse(rawValue);
    return isValidData(parsed) ? parsed : null;
  } catch (error) {
    return null;
  }
}

function fetchLatest() {
  return fetch(CONFIG.endpoint, { cache: "no-store" })
    .then(function (response) {
      if (!response.ok) {
        throw new Error("HTTP " + response.status);
      }

      return response.json();
    })
    .then(function (payload) {
      if (!isValidData(payload)) {
        throw new Error("Invalid payload");
      }

      var record = toRecord(payload);
      state.lastData = record;
      renderValue(record);
      saveToCache(record);
      setStatus(true);
    })
    .catch(function () {
      if (state.lastData) {
        renderValue(state.lastData);
      }

      setStatus(false);
    });
}

function init() {
  var cached = loadFromCache();

  if (cached) {
    state.lastData = cached;
    renderValue(cached);
    setStatus(false);
  }

  fetchLatest();
  setInterval(fetchLatest, CONFIG.refreshMs);
}

init();
