// ===== OFFLINE MANAGER =====
const DB_NAME = 'checadorDB';
const STORE_PENDING = 'pending_records';
const STORE_WORKERS = 'workers';
let db = null;

// ===== ABRIR / CREAR INDEXEDDB =====
function openDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 2);

    request.onupgradeneeded = e => {
      const db = e.target.result;

      if (!db.objectStoreNames.contains(STORE_PENDING)) {
        db.createObjectStore(STORE_PENDING, { keyPath: 'id' });
      }

      if (!db.objectStoreNames.contains(STORE_WORKERS)) {
        db.createObjectStore(STORE_WORKERS, { keyPath: 'id' });
      }
    };

    request.onsuccess = e => {
      db = e.target.result;
      resolve(db);
    };

    request.onerror = () => reject('Error abriendo IndexedDB');
  });
}

// ===== UTILIDADES PENDIENTES =====
async function getAllPending() {
  if (!db) await openDB();
  return new Promise(resolve => {
    const tx = db.transaction(STORE_PENDING, 'readonly');
    const store = tx.objectStore(STORE_PENDING);
    const req = store.getAll();
    req.onsuccess = () => resolve(req.result || []);
  });
}

async function deletePending(id) {
  if (!db) await openDB();
  return new Promise(resolve => {
    const tx = db.transaction(STORE_PENDING, 'readwrite');
    tx.objectStore(STORE_PENDING).delete(id);
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
      pos => resolve({
        lat: pos.coords.latitude,
        lng: pos.coords.longitude
      }),
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

  const location = await getLocation();

  const record = {
    id: crypto.randomUUID(),
    ...data,
    lat: location.lat,
    lng: location.lng,
    estado: 'pendiente',
    created_at: new Date().toISOString()
  };

  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_PENDING, 'readwrite');
    tx.objectStore(STORE_PENDING).add(record);
    tx.oncomplete = () => resolve(record);
    tx.onerror = () => reject('Error guardando checada offline');
  });
}

// ===== TRABAJADORES OFFLINE =====
async function saveWorkers(workers) {
  if (!db) await openDB();

  return new Promise(resolve => {
    const tx = db.transaction(STORE_WORKERS, 'readwrite');
    const store = tx.objectStore(STORE_WORKERS);

    workers.forEach(w => {
      store.put({
        id: w.id,
        name: w.name,
        qr: w.qr,
        active: w.active
      });
    });

    tx.oncomplete = () => resolve();
  });
}

async function findWorkerByQR(qr) {
  if (!db) await openDB();

  return new Promise(resolve => {
    const tx = db.transaction(STORE_WORKERS, 'readonly');
    const store = tx.objectStore(STORE_WORKERS);
    const req = store.getAll();

    req.onsuccess = () => {
      const worker = req.result.find(w => w.qr === qr && w.active);
      resolve(worker || null);
    };
  });
}

// ===== TABLA OFFLINE =====
async function renderOfflineTable() {
  const records = await getAllPending();
  const tbody = document.getElementById('offlineTableBody');
  if (!tbody) return;

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


// ===== BOTÓN OFFLINE (GLOBAL) =====
async function updateOfflineButton() {
  const offlineBtn = document.getElementById('openOfflineModal');
  if (!offlineBtn) return;

  const pending = await getAllPending();
  offlineBtn.style.display =
    (!navigator.onLine && pending.length > 0) ? 'flex' : 'none';
}

// 👇 EXPONERLA GLOBALMENTE
window.updateOfflineButton = updateOfflineButton;

// ===== ESTADO ONLINE / OFFLINE =====
document.addEventListener("DOMContentLoaded", async () => {
  await openDB();

  const offlineBtn = document.getElementById('openOfflineModal');
  const offlineModal = document.getElementById('offlineModal');
  const closeOfflineModal = document.getElementById('closeOfflineModal');
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

    updateOfflineButton();
  }

  updateStatus();
  window.addEventListener("online", updateStatus);
  window.addEventListener("offline", updateStatus);

  if (offlineBtn && offlineModal) {
      offlineBtn.addEventListener('click', async () => {
      await renderOfflineTable();

      // 🔴 OCULTAR EL AUTO OVERLAY
      const autoOverlay = document.getElementById('autoOverlay');
      if (autoOverlay) autoOverlay.style.display = 'none';

      offlineModal.classList.remove('oculto');
      offlineModal.style.display = 'flex';
    });
  }

  if (closeOfflineModal) {
    closeOfflineModal.addEventListener('click', () => {
      offlineModal.classList.add('oculto');
      offlineModal.style.display = 'none';

      // 🔁 REGRESAR AL AUTO MODAL
      const autoOverlay = document.getElementById('autoOverlay');
      if (autoOverlay) autoOverlay.style.display = 'flex';
    });
  }

});