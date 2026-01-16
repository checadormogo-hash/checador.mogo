// =====================================================
// OFFLINE.JS (baseline actual + ajustes planeados)
// - Cache diario en IndexedDB (siempre)
// - Lat/Lng SOLO cuando NO hay internet (evidencia)
// - Tabla pendientes + Distancia aprox
// - UI botones manuales según conexión
// - Control del modal automático sin tocar scripts.js
// =====================================================

// ===== ESTADO ONLINE / OFFLINE (texto en header) =====
document.addEventListener("DOMContentLoaded", () => {
  const statusEl = document.getElementById("connectionStatus");

  function updateStatus() {
    if (!statusEl) return;

    if (navigator.onLine) {
      statusEl.textContent = "● En línea";
      statusEl.classList.add("online");
      statusEl.classList.remove("offline");
    } else {
      statusEl.textContent = "● Sin conexión";
      statusEl.classList.add("offline");
      statusEl.classList.remove("online");
    }
  }

  updateStatus();
  window.addEventListener("online", updateStatus);
  window.addEventListener("offline", updateStatus);
});

// ===== CONFIG PARA DISTANCIA (solo visual) =====
// Reusar STORE_LOCATION de scripts.js si existe (evita redeclare)
const STORE_LOCATION_OFFLINE =
  (window.STORE_LOCATION && typeof window.STORE_LOCATION.lat === "number")
    ? window.STORE_LOCATION
    : { lat: 25.82105601479065, lng: -100.08711844709858 };

function calcularDistanciaMetros(lat1, lon1, lat2, lon2) {
  const R = 6371000;
  const toRad = x => x * Math.PI / 180;

  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);

  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) *
    Math.cos(toRad(lat2)) *
    Math.sin(dLon / 2) ** 2;

  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function getDistanciaAprox(row) {
  const lat = Number(row?.lat);
  const lng = Number(row?.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  const d = calcularDistanciaMetros(lat, lng, STORE_LOCATION_OFFLINE.lat, STORE_LOCATION_OFFLINE.lng);
  return Math.round(d);
}

// ===== INDEXED DB OFFLINE =====
const DB_NAME = "checador_offline_db";
const DB_VERSION = 1;
const STORE_NAME = "checadas_pendientes";

function openDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: "id", autoIncrement: true });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

// ===== LEEMOS CHECADAS ALMACENADAS =====
async function getOfflineCheckins() {
  const db = await openDB();

  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readonly");
    const store = tx.objectStore(STORE_NAME);
    const request = store.getAll();

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

// ===== PINTAMOS DATOS EN LA TABLA O MENSAJE VACIO =====
async function renderOfflineTable() {
  const tbody = document.getElementById("offlineTableBody");
  if (!tbody) return;

  tbody.innerHTML = "";

  let data = [];
  try {
    data = await getOfflineCheckins();
  } catch (err) {
    console.error("Error leyendo IndexedDB", err);
  }

  // 🚫 No hay datos
  if (!data.length) {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td colspan="10" style="text-align:center; padding:12px;">
        No hay checadas pendientes almacenadas
      </td>
    `;
    tbody.appendChild(tr);
    return;
  }

  data.forEach(row => {
    const dist = getDistanciaAprox(row);
    const distTxt = (dist === null) ? "-" : `${dist} m`;

    // Estado visual: Pendiente (naranja) o Sincronizado (azul)
    // (Aún no pintamos azul aquí porque depende del CSS que quieras;
    //  pero dejamos la estructura lista con _syncedFields)
    const estadoTxt = row.estado || "Pendiente";

    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${row.nombre || "-"}</td>
      <td>${row.fecha || "-"}</td>

      <td class="${row._offlineFields?.entrada ? 'offline-pending' : (row._syncedFields?.entrada ? 'offline-synced' : '')}">
        ${row.entrada || "-"}
      </td>
      <td class="${row._offlineFields?.salidaComida ? 'offline-pending' : (row._syncedFields?.salidaComida ? 'offline-synced' : '')}">
        ${row.salidaComida || "-"}
      </td>
      <td class="${row._offlineFields?.entradaComida ? 'offline-pending' : (row._syncedFields?.entradaComida ? 'offline-synced' : '')}">
        ${row.entradaComida || "-"}
      </td>
      <td class="${row._offlineFields?.salida ? 'offline-pending' : (row._syncedFields?.salida ? 'offline-synced' : '')}">
        ${row.salida || "-"}
      </td>

      <td>${estadoTxt}</td>
      <td>${row.lat ?? "-"}</td>
      <td>${row.lng ?? "-"}</td>
      <td>${distTxt}</td>
    `;
    tbody.appendChild(tr);
  });
}

// ===== GUARDAR O ACTUALIZAR CHECADAS =====
// data esperado (desde scripts.js):
// {
//   worker_id, worker_name, fecha,
//   tipo: 'entrada' | 'salida-comida' | 'entrada-comida' | 'salida',
//   hora: 'HH:mm:ss',
//   lat, lng,
//   // opcional:
//   // forceCoords: true (si quieres forzar guardar coords aunque haya online)
// }
async function savePendingRecord(data) {
  const db = await openDB();

  // Regla: guardar coords SOLO si fue offline (o si se fuerza)
  const shouldSaveCoords = (!navigator.onLine) || (data?.forceCoords === true);

  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);

    const request = store.getAll();

    request.onsuccess = () => {
      const records = request.result || [];

      // Buscar por worker_id + fecha (llave lógica)
      let record = records.find(r =>
        String(r.worker_id) === String(data.worker_id) &&
        String(r.fecha) === String(data.fecha)
      ) || null;

      const isNew = !record;

      if (!record) {
        record = {
          worker_id: data.worker_id,
          nombre: data.worker_name,
          fecha: data.fecha,
          entrada: null,
          salidaComida: null,
          entradaComida: null,
          salida: null,

          // Estado general del "día"
          estado: "Pendiente",

          // Coords (solo evidencia offline)
          lat: null,
          lng: null,

          // Pendientes por sync (naranja)
          _offlineFields: {},

          // Sincronizados (azul)
          _syncedFields: {}
        };
      }

      const map = {
        "entrada": "entrada",
        "salida-comida": "salidaComida",
        "entrada-comida": "entradaComida",
        "salida": "salida"
      };

      const field = map[data.tipo];

      // 1) Cache local SIEMPRE (online u offline): guardamos la hora para tener "estado del día"
      if (field && data.hora) {
        record[field] = data.hora;
      }

      // 2) Marcar pendiente SOLO si fue offline
      if (field && !navigator.onLine) {
        if (!record._offlineFields) record._offlineFields = {};
        record._offlineFields[field] = true;

        // si algún día se marcó como synced antes, lo removemos
        if (record._syncedFields) delete record._syncedFields[field];

        // estado general
        record.estado = record.estado || "Pendiente";
      }

      // 3) Guardar coords solo si offline (evidencia) o forzado
      if (shouldSaveCoords) {
        if (data.lat !== undefined && data.lat !== null) record.lat = data.lat;
        if (data.lng !== undefined && data.lng !== null) record.lng = data.lng;
      }

      // 4) Guardar
      if (isNew) store.add(record);
      else store.put(record);
    };

    tx.oncomplete = () => resolve(true);
    tx.onerror = () => reject(tx.error);
    request.onerror = () => reject(request.error);
  });
}
window.savePendingRecord = savePendingRecord;
// ✅ AUTO-RENDER: cuando scripts.js abre el modal (remove 'oculto'), pintamos la tabla
document.addEventListener("DOMContentLoaded", () => {
  const modal = document.getElementById("offlineModal");
  if (!modal) return;

  const observer = new MutationObserver(() => {
    const visible = !modal.classList.contains("oculto");
    if (visible) renderOfflineTable();
  });

  observer.observe(modal, { attributes: true, attributeFilter: ["class"] });
});

// Exponer helpers (útil para consola / pruebas)
window.renderOfflineTable = renderOfflineTable;
window.savePendingRecord = savePendingRecord;
window.getOfflineCheckins = getOfflineCheckins;


// ===============================
// UI: HABILITAR / DESHABILITAR BOTONES SEGÚN CONEXIÓN
// - Online: desactivar entrada/salida comida/entrada comida
// - Offline: activarlos
// - Salida siempre activa
// ===============================
document.addEventListener("DOMContentLoaded", () => {
  function setBtnState(el, enabled) {
    if (!el) return;
    el.style.pointerEvents = enabled ? "auto" : "none";
    el.style.opacity = enabled ? "1" : "0.45";
    el.style.filter = enabled ? "none" : "grayscale(35%)";
    el.setAttribute("aria-disabled", enabled ? "false" : "true");
  }

  function applyButtonsByConnection() {
    const isOnline = navigator.onLine;

    const btnEntrada = document.querySelector('.action-btn[data-action="entrada"]');
    const btnSalidaComida = document.querySelector('.action-btn[data-action="salida-comida"]');
    const btnEntradaComida = document.querySelector('.action-btn[data-action="entrada-comida"]');
    const btnSalida = document.querySelector('.action-btn[data-action="salida"]');

    // Online => desactivar 3 botones manuales (entrada, salida comida, entrada comida)
    // Offline => activarlos
    setBtnState(btnEntrada, !isOnline);
    setBtnState(btnSalidaComida, !isOnline);
    setBtnState(btnEntradaComida, !isOnline);

    // Salida siempre activa (online u offline)
    setBtnState(btnSalida, true);
  }

  applyButtonsByConnection();
  window.addEventListener("online", applyButtonsByConnection);
  window.addEventListener("offline", applyButtonsByConnection);
});


// ===============================
// CONTROL MODAL AUTOMÁTICO SIN TOCAR scripts.js
// - Offline: cerrar modal automático y NO permitir reapertura por timer
// - Online: abrir modal automático inmediatamente al volver la conexión
// ===============================
(function () {
  function safeHideAutoModal() {
    const autoOverlay = document.getElementById("autoOverlay");
    if (autoOverlay) {
      autoOverlay.style.display = "none";
      try { delete autoOverlay.dataset.manualAction; } catch {}
    }

    // Detener el timer si fuera accesible (best-effort)
    try {
      if (typeof window.inactivityTimer !== "undefined" && window.inactivityTimer) {
        clearTimeout(window.inactivityTimer);
      }
    } catch {}
  }

  function safeShowAutoModalNow() {
    if (typeof window.showAutoModal === "function") {
      window.showAutoModal();
      return true;
    }
    return false;
  }

  // Hook: evita que showAutoModal (re-apertura por inactividad) funcione si offline
  function hookShowAutoModal() {
    if (typeof window.showAutoModal !== "function") return false;
    if (window.__offline_showAutoModal_hooked) return true;

    const original = window.showAutoModal;

    window.showAutoModal = function (...args) {
      if (!navigator.onLine) return; // offline => no reabrir
      return original.apply(this, args);
    };

    window.__offline_showAutoModal_hooked = true;
    return true;
  }

  // Esperar a que scripts.js defina showAutoModal
  const hookTimer = setInterval(() => {
    if (hookShowAutoModal()) clearInterval(hookTimer);
  }, 50);

  // OFFLINE => cerrar auto modal
  window.addEventListener("offline", () => {
    safeHideAutoModal();
  });

  // ONLINE => abrir auto modal inmediatamente
  window.addEventListener("online", () => {
    if (safeShowAutoModalNow()) return;

    // si scripts.js aún no estaba listo, reintenta un poco
    let tries = 0;
    const t = setInterval(() => {
      tries++;
      if (safeShowAutoModalNow() || tries > 40) clearInterval(t);
    }, 50);
  });

  // Al cargar: si inicia offline, cerrar auto; si inicia online, dejar que scripts.js haga lo suyo.
  // (NO forzamos abrir aquí para no duplicar la lógica que ya tienes en scripts.js al DOMContentLoaded)
  document.addEventListener("DOMContentLoaded", () => {
    if (!navigator.onLine) {
      safeHideAutoModal();
    }
  });
})();
