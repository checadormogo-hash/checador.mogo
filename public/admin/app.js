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

addModal.style.display = 'none';

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

workersModal.style.display = 'none';

openWorkersBtn.onclick = () => {
  closeMenuFn();
  workersModal.style.display = 'flex';
  loadWorkers();
};

closeWorkersModal.onclick = () => {
  workersModal.style.display = 'none';
};

/* ================== MODAL QR ================== */
const qrModal = document.getElementById('qrModal');
const closeQrModal = document.getElementById('closeQrModal');
const qrImage = document.getElementById('qrImage');
const badgeName = document.getElementById('badgeName');
const badgeId = document.getElementById('badgeId');
const downloadQR = document.getElementById('downloadQR');

qrModal.style.display = 'none';

closeQrModal.onclick = () => {
  qrModal.style.display = 'none';
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
        <button 
          class="btn-icon btn-qr"
          title="Generar QR"
          data-id="${worker.id}"
          data-pin="${worker.pin}">📎
        </button>

        <button
          class="btn-icon btn-delete"
          title="Eliminar"
          data-id="${worker.id}">🗑️
        </button>
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

/* ================== TOAST ================== */
function showToast() {
  const toast = document.getElementById('toastSuccess');
  toast.style.display = 'block';

  setTimeout(() => {
    toast.style.display = 'none';
  }, 2500);
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

    // 🔄 LIMPIAR CAMPOS (NO cerrar modal)
    document.getElementById('workerName').value = '';
    document.getElementById('workerPin').value = '';
    document.getElementById('fechaIngreso').value = '';
    document.getElementById('workerActive').value = 'SI';

    showToast();
    loadWorkers();
  } catch (err) {
    console.error(err);
    alert('Error al guardar trabajador');
  }
});

/* ================== ELIMINAR ================== */
workersTableBody.addEventListener('click', async (e) => {
const qrBtn = e.target.closest('.btn-qr');
if (qrBtn) {
  const id = qrBtn.dataset.id;
  const pin = qrBtn.dataset.pin;

  const worker = workersCache.find(w => w.id === id);
  if (!worker) return;

  // Texto visible
  badgeName.textContent = worker.nombre;
  badgeId.textContent = worker.id;

  // QR con ID + PIN (PIN oculto)
  const qrValue = `${worker.id}|${worker.pin}`;
  qrImage.src = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(qrValue)}`;

  qrModal.style.display = 'flex';
  return;
}


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

downloadQR.addEventListener('click', () => {
  const badge = document.getElementById('badge');

  // ocultar botones
  const controls = document.querySelectorAll('.no-print');
  controls.forEach(el => el.style.display = 'none');

  // esperar a que la imagen QR esté completamente cargada
  qrImage.onload = () => {
    html2canvas(badge).then(canvas => {
      const link = document.createElement('a');
      link.download = 'gafete-trabajador.png';
      link.href = canvas.toDataURL();
      link.click();

      // restaurar botones
      controls.forEach(el => el.style.display = '');
    });
  };
  // disparar onload si la imagen ya estaba cargada
  if (qrImage.complete) qrImage.onload();
});

