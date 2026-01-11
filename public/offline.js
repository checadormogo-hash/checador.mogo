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
      <td colspan="9" style="text-align:center; padding:12px;">
        No hay checadas pendientes almacenadas
      </td>
    `;
    tbody.appendChild(tr);
    return;
  }

  // ✅ Hay datos
  data.forEach(row => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${row.nombre || "-"}</td>
      <td>${row.fecha || "-"}</td>
      <td>${row.entrada || "-"}</td>
      <td>${row.salidaComida || "-"}</td>
      <td>${row.entradaComida || "-"}</td>
      <td>${row.salida || "-"}</td>
      <td>${row.estado || "Pendiente"}</td>
      <td>${row.lat || "-"}</td>
      <td>${row.lng || "-"}</td>
    `;
    tbody.appendChild(tr);
  });
}

document.addEventListener("DOMContentLoaded", () => {
  const btn = document.getElementById("btnChecadasPendientes");
  if (!btn) return;

  btn.addEventListener("click", () => {
    renderOfflineTable();
  });
});

//GUARDAR O ACTUALIZAR CHECADAS
async function savePendingRecord(data) {
  const db = await openDB();

  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);

    const request = store.getAll();

    request.onsuccess = () => {
      const records = request.result;

      // 🔧 usar los nombres REALES que vienen de scripts.js
      let record = records.find(r =>
        r.worker_id === data.worker_id &&
        r.fecha === data.fecha
      );

      if (!record) {
        record = {
          worker_id: data.worker_id,
          nombre: data.worker_name,
          fecha: data.fecha,
          entrada: null,
          salidaComida: null,
          entradaComida: null,
          salida: null,
          estado: "Pendiente"
        };
      }

      // 🔧 normalizar tipos
      const map = {
        "entrada": "entrada",
        "salida-comida": "salidaComida",
        "entrada-comida": "entradaComida",
        "salida": "salida"
      };

      const field = map[data.tipo];
      if (field) {
        record[field] = data.hora;
      }

      store.put(record);
    };

    tx.oncomplete = () => resolve(true);
    tx.onerror = () => reject(tx.error);
  });
}