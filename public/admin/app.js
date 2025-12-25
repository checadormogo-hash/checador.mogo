/* ================== CONFIG ================== */
// Supabase CDN (SIN import)
const supabase = window.supabase.createClient(
  "https://akgbqsfkehqlpxtrjsnw.supabase.co",
  "sb_publishable_dXfxuXMQS__XuqmdqXnbgA_yBkRMABj"
);

/* ================== MOSTRAR ADMIN (SIN LOGIN) ================== */
const overlay = document.getElementById('loginOverlay');
const adminApp = document.getElementById('adminApp');
const fab = document.getElementById('openAddModal');

if (overlay) overlay.style.display = 'none';
if (adminApp) adminApp.style.display = 'block';
if (fab) fab.style.display = 'flex';

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
closeQrModal.onclick = () => qrModal.style.display = 'none';

/* ================== CACHE ================== */
let workersCache = [];

/* ================== API HELPERS ================== */
async function apiGetWorkers() {
  const { data, error } = await supabase
    .from('workers')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) throw error;

  workersCache = data.map(w => ({
    id: w.id,
    nombre: w.nombre,
    pin: w.pin,
    activo: w.activo,
    fechaAlta: w.created_at
  }));

  renderWorkers();
}

/* ================== RENDER ================== */
function renderWorkers() {
  workersTableBody.innerHTML = '';

  if (!workersCache.length) {
    workersTableBody.innerHTML = `
      <tr><td colspan="6">No hay trabajadores registrados</td></tr>
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
        <button class="btn-icon btn-qr" data-id="${worker.id}">📎</button>
        <button class="btn-edit" data-id="${worker.id}">✏️</button>
        <button class="btn-icon btn-delete" data-id="${worker.id}">🗑️</button>
      </td>
    `;
    workersTableBody.appendChild(tr);
  });
}

/* ================== LOAD ================== */
async function loadWorkers() {
  try {
    await apiGetWorkers();
  } catch (err) {
    console.error(err);
  }
}

/* ================== GUARDAR ================== */
saveWorkerBtn.addEventListener('click', async () => {
  try {
    const nombre = document.getElementById('workerName').value.trim();
    const pin = document.getElementById('workerPin').value.trim();
    const activo = document.getElementById('workerActive').value === 'SI';
    const fecha = document.getElementById('fechaIngreso').value;

    if (!nombre || pin.length !== 4 || !fecha) {
      alert('Completa todos los campos');
      return;
    }

    const { error } = await supabase.from('workers').insert([{
      nombre,
      pin,
      activo,
      created_at: fecha
    }]);

    if (error) throw error;

    addModal.style.display = 'none';
    loadWorkers();

  } catch (err) {
    console.error(err);
    alert('Error al guardar trabajador');
  }
});

/* ================== QR / EDITAR / ELIMINAR ================== */
workersTableBody.addEventListener('click', async e => {

  const qrBtn   = e.target.closest('.btn-qr');
  const delBtn  = e.target.closest('.btn-delete');
  const editBtn = e.target.closest('.btn-edit');

  /* ===== QR ===== */
  if (qrBtn) {
    const worker = workersCache.find(w => w.id == qrBtn.dataset.id);
    if (!worker) return;

    badgeName.textContent = worker.nombre;
    badgeId.textContent   = worker.id;

    const qrValue = `${worker.id}|${worker.pin}`;
    qrImage.src = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(qrValue)}`;

    qrModal.style.display = 'flex';
    return; // ⬅️ evita que caiga en editar o eliminar
  }

  /* ===== EDITAR ===== */
  if (editBtn) {
    const worker = workersCache.find(w => w.id == editBtn.dataset.id);
    if (!worker) return;

    document.getElementById('editWorkerId').value = worker.id;
    document.getElementById('editNombre').value   = worker.nombre;
    document.getElementById('editPin').value      = worker.pin;
    if (worker.fechaIngreso) {
      const [day, month, year] = worker.fechaIngreso.split('/');
      document.getElementById('editFecha').value = `${year}-${month}-${day}`;
    }
    document.getElementById('editActivo').checked = worker.activo;

    document.getElementById('editWorkerModal').style.display = 'flex';
    return; // ⬅️ evita que caiga en eliminar
  }

  /* ===== ELIMINAR ===== */
  if (delBtn) {
    if (!confirm('¿Eliminar trabajador definitivamente?')) return;

    try {
      const { error } = await supabase
        .from('workers')
        .delete()
        .eq('id', delBtn.dataset.id);

      if (error) throw error;

      mostrarToast('🗑️ Trabajador eliminado correctamente');
      loadWorkers();

    } catch (err) {
      console.error(err);
      alert('No se pudo eliminar el trabajador');
    }
  }

});
document.getElementById('saveEditWorker').addEventListener('click', () => {

  const id = document.getElementById('editWorkerId').value;
  const trabajadores = JSON.parse(localStorage.getItem('trabajadores')) || [];

  const index = trabajadores.findIndex(t => t.id === id);
  if (index === -1) return;

  // ===== FORMATEAR FECHA =====
  const fechaInput = document.getElementById('editFecha').value; // YYYY-MM-DD
  let fechaFormateada = '';

  if (fechaInput) {
    const [year, month, day] = fechaInput.split('-');
    fechaFormateada = `${day}/${month}/${year}`; // DD/MM/YYYY
  }

  // ===== GUARDAR CAMBIOS =====
  trabajadores[index].nombre = document.getElementById('editNombre').value.trim();
  trabajadores[index].pin = document.getElementById('editPin').value.trim();
  trabajadores[index].fechaIngreso = fechaFormateada;
  trabajadores[index].activo = document.getElementById('editActivo').checked;

  localStorage.setItem('trabajadores', JSON.stringify(trabajadores));

  renderWorkers(); // tu función actual
  document.getElementById('editWorkerModal').style.display = 'none';

  mostrarToast('✏️ Trabajador actualizado correctamente');
});

document.getElementById('closeEditWorker').onclick = () => {
  document.getElementById('editWorkerModal').style.display = 'none';
};

function mostrarToast(mensaje) {
  const toast = document.getElementById('toastSuccess');
  toast.textContent = mensaje;
  toast.style.display = 'block';

  setTimeout(() => {
    toast.style.display = 'none';
  }, 2500);
}

/* ================== INICIO ================== */
loadWorkers();
