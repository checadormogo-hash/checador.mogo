/* ================== CONFIG ================== */
const API_WORKERS = '/api/data/workers';
const API_RECORDS = '/api/data/records';

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
    loadRecords();
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


async function loadRecords() {
  const tbody = document.querySelector('table tbody');
  tbody.innerHTML = '';

  try {
    // traer trabajadores (ya los usas)
    if (!workersCache.length) {
      const w = await apiGetWorkers();
      workersCache = w.workers || [];
    }

    // traer registros
    const r = await fetch(API_RECORDS, { cache: 'no-store' });
    const data = await r.json();
    const records = data.records || [];

    if (!records.length) {
      tbody.innerHTML = `
        <tr>
          <td colspan="7">No hay registros de asistencia</td>
        </tr>
      `;
      return;
    }

    records.forEach(rec => {
      const worker = workersCache.find(w => w.id === rec.workerId);

      const nombre = worker ? worker.nombre : 'Trabajador no encontrado';

      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${nombre}</td>
        <td>${rec.date}</td>
        <td>${rec.entrada || '-'}</td>
        <td>${rec.salidaComida || '-'}</td>
        <td>${rec.entradaComida || '-'}</td>
        <td>${rec.salida || '-'}</td>
        <td class="actions">
          <button class="btn-icon btn-edit">
            <i class="fa-solid fa-pen"></i>
          </button>
          <button class="btn-icon btn-delete">
            <i class="fa-solid fa-trash"></i>
          </button>
        </td>
      `;
      tbody.appendChild(tr);
    });

  } catch (err) {
    console.error(err);
    tbody.innerHTML = `
      <tr>
        <td colspan="7">Error al cargar asistencias</td>
      </tr>
    `;
  }
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

/* ================== ELIMINAR / GENERAR QR ================== */
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

/* ================== DESCARGAR GAFETE ================== */
downloadQR.addEventListener('click', () => {
  const badge = document.getElementById('badge');

  // ocultar botones
  const controls = document.querySelectorAll('.no-export');
  controls.forEach(el => el.style.display = 'none');

  // función para generar la imagen del gafete
  function generarGafete() {
    html2canvas(badge, { useCORS: true }).then(canvas => {
      const link = document.createElement('a');
      link.download = 'gafete-trabajador.png';
      link.href = canvas.toDataURL();
      link.click();

      // restaurar botones
      controls.forEach(el => el.style.display = '');
    });
  }

  // generar solo si el QR ya está cargado
  if (qrImage.complete && qrImage.naturalHeight !== 0) {
    generarGafete();
  } else {
    qrImage.onload = generarGafete;
  }
});