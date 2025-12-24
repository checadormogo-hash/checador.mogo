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
    fechaAlta: w.fecha_ingreso
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
    const activo = document.getElementById('workerActive').value;
    const fecha = document.getElementById('fechaIngreso').value;

    if (!nombre || pin.length !== 4 || !fecha) {
      alert('Completa todos los campos');
      return;
    }

    const { error } = await supabase.from('workers').insert([{
      nombre,
      pin,
      activo,
      fecha_ingreso: fecha
    }]);

    if (error) throw error;

    addModal.style.display = 'none';
    loadWorkers();

  } catch (err) {
    console.error(err);
    alert('Error al guardar trabajador');
  }
});

/* ================== ELIMINAR / QR ================== */
workersTableBody.addEventListener('click', async e => {
  const qrBtn = e.target.closest('.btn-qr');
  const delBtn = e.target.closest('.btn-delete');

  if (qrBtn) {
    const worker = workersCache.find(w => w.id == qrBtn.dataset.id);
    badgeName.textContent = worker.nombre;
    badgeId.textContent = worker.id;
    qrImage.src = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${worker.id}|${worker.pin}`;
    qrModal.style.display = 'flex';
  }

  if (delBtn) {
    if (!confirm('¿Eliminar trabajador?')) return;
    await supabase.from('workers').delete().eq('id', delBtn.dataset.id);
    loadWorkers();
  }
});

/* ================== INICIO ================== */
loadWorkers();
