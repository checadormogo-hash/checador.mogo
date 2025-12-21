// ================== LOGIN ==================
const overlay = document.getElementById('loginOverlay');
const userInput = document.getElementById('adminUser');
const passInput = document.getElementById('adminPass');
const error = document.getElementById('loginError');

const adminApp = document.getElementById('adminApp');
const fab = document.getElementById('openAddModal');

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


// ================== MENÚ ==================
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


// ================== MODAL ALTA ==================
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


// ================== MODAL LISTA ==================
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


// ================== CACHE ==================
let workersCache = [];


// ================== RENDER ==================
function renderWorkers(data) {
  workersTableBody.innerHTML = '';

  if (!Array.isArray(data) || data.length === 0) {
    workersTableBody.innerHTML = `
      <tr>
        <td colspan="6">No hay trabajadores registrados</td>
      </tr>
    `;
    return;
  }

  data.forEach(worker => {
    const tr = document.createElement('tr');

    tr.innerHTML = `
      <td>${worker.id}</td>
      <td>${worker.nombre}</td>
      <td>${worker.pin}</td>
      <td>${worker.activo}</td>
      <td>${worker.fechaAlta}</td>
      <td class="actions">
        <button class="btn-icon btn-delete" onclick="deleteWorker('${worker.id}')">
          🗑️
        </button>
      </td>
    `;

    workersTableBody.appendChild(tr);
  });
}


// ================== LOAD ==================
async function loadWorkers() {
  try {
    const r = await fetch('/api/workers', { cache: 'no-store' });
    const data = await r.json();

    workersCache = Array.isArray(data.workers) ? data.workers : [];
    renderWorkers(workersCache);

  } catch (err) {
    console.error(err);
    workersTableBody.innerHTML = `
      <tr>
        <td colspan="6">Error al cargar trabajadores</td>
      </tr>
    `;
  }
}


// ================== GUARDAR ==================
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

  // evitar PIN duplicado
  if (workersCache.some(w => w.pin === worker.pin)) {
    alert('Ese PIN ya existe');
    return;
  }

  workersCache.push(worker);

  try {
    await fetch('/api/workers', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ workers: workersCache })
    });

    alert('Trabajador guardado correctamente');
    addModal.style.display = 'none';
    loadWorkers();

  } catch (err) {
    console.error(err);
    alert('Error al guardar trabajador');
  }
});


// ================== ELIMINAR ==================
async function deleteWorker(id) {
  if (!confirm('¿Eliminar trabajador definitivamente?')) return;

  workersCache = workersCache.filter(w => w.id !== id);

  try {
    await fetch('/api/workers', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ workers: workersCache })
    });

    loadWorkers();

  } catch (err) {
    console.error(err);
    alert('No se pudo eliminar');
  }
}