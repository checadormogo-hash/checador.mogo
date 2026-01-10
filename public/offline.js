// ===== OFFLINE MANAGER =====
const DB_NAME = 'checadorDB';
const STORE_NAME = 'pending_records';
let db = null;

// ===== ABRIR / CREAR INDEXEDDB =====
function openDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);

    request.onupgradeneeded = e => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    };

    request.onsuccess = e => {
      db = e.target.result;
      resolve(db);
    };

    request.onerror = () => reject('Error abriendo IndexedDB');
  });
}

// ===== UTILIDADES INDEXEDDB =====
async function getAllPending() {
  if (!db) await openDB();
  return new Promise(resolve => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const req = store.getAll();
    req.onsuccess = () => resolve(req.result || []);
  });
}

async function deletePending(id) {
  if (!db) await openDB();
  return new Promise(resolve => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).delete(id);
    tx.oncomplete = () => resolve();
  });
}
// ===== GEOLOCALIZACIÓN =====
function getLocation() {
  return new Promise(resolve => {
    if (!navigator.geolocation) {
      return resolve({ lat: null, lng: null });
    }

    navigator.geolocation.getCurrentPosition(
      pos => {
        resolve({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude
        });
      },
      () => resolve({ lat: null, lng: null }),
      {
        enableHighAccuracy: true,
        timeout: 5000
      }
    );
  });
}
// ===== GUARDAR CHECADA OFFLINE =====
async function savePendingRecord(data) {
  if (!db) await openDB();

  return new Promise(async (resolve, reject) => {
    const location = await getLocation();

    const record = {
      id: crypto.randomUUID(),
      ...data,
      lat: location.lat,
      lng: location.lng,
      estado: 'pendiente',
      created_at: new Date().toISOString()
    };

    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    store.add(record);

    tx.oncomplete = () => resolve(record);
    tx.onerror = () => reject('Error guardando checada offline');
  });
}

async function renderOfflineTable() {
  const records = await getAllPending();
  const tbody = document.getElementById('offlineTableBody');
  tbody.innerHTML = '';

  records.forEach(r => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${r.worker_name}</td>
      <td>${r.fecha}</td>
      <td>${r.tipo === 'entrada' ? r.hora : '—'}</td>
      <td>${r.tipo === 'salida_comida' ? r.hora : '—'}</td>
      <td>${r.tipo === 'entrada_comida' ? r.hora : '—'}</td>
      <td>${r.tipo === 'salida' ? r.hora : '—'}</td>
      <td class="estado-pendiente">Pendiente</td>
      <td>${r.lat ?? '—'}</td>
      <td>${r.lng ?? '—'}</td>
    `;
    tbody.appendChild(tr);
  });
}

document.addEventListener("DOMContentLoaded", async () => {
  await openDB();

  const statusEl = document.getElementById("connectionStatus");
  const offlineBtn = document.getElementById("openOfflineModal");

  function updateStatus() {
    if (navigator.onLine) {
      statusEl.textContent = "● En línea";
      statusEl.classList.add("online");
      statusEl.classList.remove("offline");
    } else {
      statusEl.textContent = "● Sin conexión";
      statusEl.classList.add("offline");
      statusEl.classList.remove("online");
    }
    updateOfflineButton();
  }

  async function updateOfflineButton() {
    const pending = await getAllPending();
    if (!navigator.onLine && pending.length > 0) {
      offlineBtn.style.display = 'flex';
    } else {
      offlineBtn.style.display = 'none';
    }
  }

  updateStatus();
  window.addEventListener("online", updateStatus);
  window.addEventListener("offline", updateStatus);
});
