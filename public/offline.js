// ===== ESTADO ONLINE / OFFLINE =====
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
// Debe coincidir con scripts.js
const STORE_LOCATION = {
  lat: 25.82105601479065,
  lng: -100.08711844709858
};

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
  const d = calcularDistanciaMetros(lat, lng, STORE_LOCATION.lat, STORE_LOCATION.lng);
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
        db.createObjectStore(STORE_NAME, {
          keyPath: "id",
          autoIncrement: true
        });
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

  // ✅ Hay datos
  data.forEach(row => {
    const dist = getDistanciaAprox(row);
    const distTxt = (dist === null) ? "-" : `${dist} m`;

    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${row.nombre || "-"}</td>
      <td>${row.fecha || "-"}</td>

      <td class="${row._offlineFields?.entrada ? 'offline-pending' : ''}">${row.entrada || "-"}</td>
      <td class="${row._offlineFields?.salidaComida ? 'offline-pending' : ''}">${row.salidaComida || "-"}</td>
      <td class="${row._offlineFields?.entradaComida ? 'offline-pending' : ''}">${row.entradaComida || "-"}</td>
      <td class="${row._offlineFields?.salida ? 'offline-pending' : ''}">${row.salida || "-"}</td>

      <td>${row.estado || "Pendiente"}</td>
      <td>${row.lat ?? "-"}</td>
      <td>${row.lng ?? "-"}</td>
      <td>${distTxt}</td>
    `;
    tbody.appendChild(tr);
  });
}

// ===== GUARDAR O ACTUALIZAR CHECADAS =====
// data esperado (desde scripts.js después):
// {
//   worker_id, worker_name, fecha,
//   tipo: 'entrada' | 'salida-comida' | 'entrada-comida' | 'salida',
//   hora: 'HH:mm:ss',
//   lat, lng
// }
async function savePendingRecord(data) {
  const db = await openDB();

  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);

    const request = store.getAll();

    request.onsuccess = () => {
      const records = request.result || [];

      // buscar por worker_id + fecha (tu "llave lógica")
      let record = records.find(r =>
        String(r.worker_id) === String(data.worker_id) &&
        String(r.fecha) === String(data.fecha)
      ) || null;

      const isNew = !record;

      if (!record) {
        record = {
          // id lo asigna IndexedDB
          worker_id: data.worker_id,
          nombre: data.worker_name,
          fecha: data.fecha,
          entrada: null,
          salidaComida: null,
          entradaComida: null,
          salida: null,
          estado: "Pendiente",
          lat: null,
          lng: null,
          _offlineFields: {}
        };
      }

      // map de acciones a campos
      const map = {
        "entrada": "entrada",
        "salida-comida": "salidaComida",
        "entrada-comida": "entradaComida",
        "salida": "salida"
      };

      const field = map[data.tipo];

      // guardar hora del campo si viene
      if (field && data.hora) {
        record[field] = data.hora;

        // marcar que este campo es offline
        if (!record._offlineFields) record._offlineFields = {};
        record._offlineFields[field] = true;
      }

      // 📍 guardar coords si vienen (evidencia offline)
      if (data.lat !== undefined && data.lat !== null) record.lat = data.lat;
      if (data.lng !== undefined && data.lng !== null) record.lng = data.lng;

      // ✅ Guardado correcto: add si es nuevo, put si existe
      if (isNew) {
        store.add(record);
      } else {
        store.put(record);
      }
    };

    tx.oncomplete = () => resolve(true);
    tx.onerror = () => reject(tx.error);
    request.onerror = () => reject(request.error);
  });
}
// ✅ AUTO-RENDER: cuando scripts.js abre el modal (remove 'oculto'), pintamos la tabla
document.addEventListener("DOMContentLoaded", () => {
  const modal = document.getElementById("offlineModal");
  if (!modal) return;

  const observer = new MutationObserver(() => {
    const visible = !modal.classList.contains("oculto");
    if (visible) {
      renderOfflineTable();
    }
  });

  observer.observe(modal, { attributes: true, attributeFilter: ["class"] });
});
