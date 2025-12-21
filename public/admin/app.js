/* ================== CONFIG ================== */
const API_WORKERS = '/api/data/workers';

/* ================== LOGIN ================== */
const overlay = document.getElementById('loginOverlay');
const userInput = document.getElementById('adminUser');
const passInput = document.getElementById('adminPass');
const error = document.getElementById('loginError');

const adminApp = document.getElementById('adminApp');
const fab = document.getElementById('openAddModal');

// ===== ESTADO INICIAL =====
adminApp.style.display = 'none';
fab.style.display = 'none';
addModal.style.display = 'none';
workersModal.style.display = 'none';

function tryLogin() {
  if (userInput.value === 'admin' && passInput.value === '1234') {
    overlay.style.display = 'none';
    adminApp.style.display = 'block';
    fab.style.display = 'flex';
  } else {
    error.classList.add('show');
  }
}

userInput.addEventListener('keydown', e => e.key === 'Enter' && passInput.focus());
passInput.addEventListener('keydown', e => e.key === 'Enter' && tryLogin());

/* ================== MENÚ ================== */
const menuToggle = document.getElementById('menuToggle');
const sideMenu = document.getElementById('sideMenu');
const menuOverlay = document.getElementById('menuOverlay');
const closeMenu = document.getElementById('closeMenu');

function openMenu() {
  sideMenu.classList.add('show');
  menuOverlay.classList.add('show');
}

function closeMenuFn() {
  sideMenu.classList.remove('show');
  menuOverlay.classList.remove('show');
}

menuToggle.onclick = openMenu;
closeMenu.onclick = closeMenuFn;
menuOverlay.onclick = closeMenuFn;

/* ================== MODAL ALTA ================== */
const addModal = document.getElementById('addWorkerModal');
const openBtn = document.getElementById('openAddModal');
const closeBtn = document.getElementById('closeAddModal');
const saveWorkerBtn = document.getElementById('saveWorker');

openBtn.onclick = () => addModal.style.display = 'flex';
closeBtn.onclick = () => addModal.style.display = 'none';

const pinInput = document.getElementById('workerPin');
pinInput.addEventListener('input', () => {
  pinInput.value = pinInput.value.replace(/\D/g, '').slice(0, 4);
});

/* ================== MODAL LISTA ================== */
const workersModal = document.getElementById('workersModal');
const openWorkersBtn = document.getElementById('menuWorkers');
const closeWorkersModal = document.getElementById('closeWorkersModal');
const workersTableBody = document.getElementById('workersTableBody');

openWorkersBtn.onclick = () => {
  closeMenuFn();
  workersModal.style.display = 'flex';
  loadWorkers();
};

closeWorkersModal.onclick = () => {
  workersModal.style.display = 'none';
};

/* ================== CACHE ================== */
let workersCache = [];

/* ================== API HELPERS ================== */
async function apiGetWorkers() {
  const r = await fetch(API_WORKERS, { cache: 'no-store' });
  if (!r.ok) throw new Error('GET error');
  return r.json();
}

async function apiSaveWorkers(arr) {
  const r = await fetch(API_WORKERS, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ workers: arr })
  });
  if (!r.ok) throw new Error('PUT error');
}

/* ================== RENDER ================== */
function renderWorkers() {
  workersTableBody.innerHTML = '';

  if (!workersCache.length) {
    workersTableBody.innerHTML = `
      <tr>
        <td colspan="6">No hay trabajadores registrados</td>
      </tr>
    `;
    return;
  }

  workersCache.forEach(worker => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${worker.id}</td>
      <td>${worker.nombre}</td>
      <td>${worker.pin}</td>
      <td>${worker.activo}</td>
      <td>${worker.fechaAlta}</td>
      <td class="actions">
        <button class="btn-icon btn-delete" data-id="${worker.id}">🗑️</button>
      </td>
    `;
    workersTableBody.appendChild(tr);
  });
}

/* ================== LOAD ================== */
async function loadWorkers() {
  try {
    const data = await apiGetWorkers();

    if (Array.isArray(data.workers)) {
      workersCache = data.workers;
    } else {
      console.warn('Formato inválido:', data);
      workersCache = [];
    }

    renderWorkers();
  } catch (err) {
    console.error(err);
    workersTableBody.innerHTML = `
      <tr>
        <td colspan="6">Error al cargar trabajadores</td>
      </tr>
    `;
  }
}

/* ================== GUARDAR ================== */
saveWorkerBtn.addEventListener('click', async () => {
  const worker = {
    id: 'EMP-' + Date.now(),
    nombre: document.getElementById('workerName').value.trim(),
    pin: document.getElementById('workerPin').value.trim(),
    activo: document.getElementById('workerActive').value,
    fechaAlta: document.getElementById('fechaIngreso').value
  };

  if (!worker.nombre || worker.pin.length !== 4 || !worker.fechaAlta) {
    alert('Completa correctamente todos los campos');
    return;
  }

  if (workersCache.some(w => w.pin === worker.pin)) {
    alert('Ese PIN ya existe');
    return;
  }

  try {
    workersCache.push(worker);
    await apiSaveWorkers(workersCache);
    addModal.style.display = 'none';
    loadWorkers();
  } catch (err) {
    console.error(err);
    alert('Error al guardar trabajador');
  }
});

/* ================== ELIMINAR ================== */
workersTableBody.addEventListener('click', async (e) => {
  const btn = e.target.closest('.btn-delete');
  if (!btn) return;

  const id = btn.dataset.id;
  if (!confirm('¿Eliminar trabajador definitivamente?')) return;

  try {
    workersCache = workersCache.filter(w => w.id !== id);
    await apiSaveWorkers(workersCache);
    renderWorkers();
  } catch (err) {
    console.error(err);
    alert('No se pudo eliminar');
  }
});