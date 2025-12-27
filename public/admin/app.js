/* ================== CONFIG ================== */
// Supabase CDN (SIN import)
const supabase = window.supabase.createClient(
  "https://akgbqsfkehqlpxtrjsnw.supabase.co",
  "sb_publishable_dXfxuXMQS__XuqmdqXnbgA_yBkRMABj"
);
/* ================== CACHE ================== */
let recordsCache = [];

/* ================== RENDER ================== */
function renderRecords() {
  const tbody = document.getElementById('recordsTableBody');
  tbody.innerHTML = '';

  if (!recordsCache.length) {
    tbody.innerHTML = `<tr><td colspan="7">No hay registros</td></tr>`;
    return;
  }

  recordsCache.forEach(record => {
    const tr = document.createElement('tr');
    tr.dataset.id = record.id;

    tr.innerHTML = `
      <td>${record.trabajador}</td>
      <td>${record.fecha}</td>
      <td class="editable">${record.entrada || ''}</td>
      <td class="editable">${record.salida_comida || ''}</td>
      <td class="editable">${record.entrada_comida || ''}</td>
      <td class="editable">${record.salida || ''}</td>
      <td class="actions">
        <button class="btn-icon btn-edit">✏️</button>
        <button class="btn-icon btn-delete">🗑️</button>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

/* ================== CARGAR DATOS ================== */
async function loadRecords() {
  try {
    const { data, error } = await supabase
      .from('records')
      .select('*')
      .order('fecha', { ascending: false });

    if (error) throw error;

    // Guardar en cache
    recordsCache = data.map(r => ({
      id: r.id,
      trabajador: r.trabajador,
      fecha: r.fecha.substring(0,10), // YYYY-MM-DD
      entrada: r.entrada,
      salida_comida: r.salida_comida,
      entrada_comida: r.entrada_comida,
      salida: r.salida
    }));

    renderRecords();
  } catch (err) {
    console.error(err);
    alert('Error al cargar registros');
  }
}

/* ================== EDITAR / GUARDAR / ELIMINAR ================== */
document.getElementById('recordsTableBody').addEventListener('click', async e => {
  const tr = e.target.closest('tr');
  if (!tr) return;
  const id = tr.dataset.id;

  // Editar
  if (e.target.closest('.btn-edit')) {
    const inputsExist = tr.querySelectorAll('input').length;
    if (inputsExist) {
      // Guardar cambios
      const updated = {};
      tr.querySelectorAll('td.editable').forEach((td, i) => {
        updated[ ['entrada','salida_comida','entrada_comida','salida'][i] ] = td.querySelector('input').value;
      });

      try {
        const { error } = await supabase
          .from('records')
          .update(updated)
          .eq('id', id);

        if (error) throw error;

        // Actualizar cache
        const rec = recordsCache.find(r => r.id == id);
        Object.assign(rec, updated);

        renderRecords();
        mostrarToast('✏️ Registro actualizado');

      } catch (err) {
        console.error(err);
        alert('Error al actualizar registro');
      }

    } else {
      // Activar inputs
      tr.querySelectorAll('td.editable').forEach(td => {
        const val = td.textContent.trim();
        td.innerHTML = `<input type="time" value="${val}">`;
      });
    }
    return;
  }

  // Eliminar
  if (e.target.closest('.btn-delete')) {
    if (!confirm('¿Eliminar registro de este día?')) return;

    try {
      const { error } = await supabase
        .from('records')
        .delete()
        .eq('id', id);

      if (error) throw error;

      // eliminar del cache y re-render
      recordsCache = recordsCache.filter(r => r.id != id);
      renderRecords();
      mostrarToast('🗑️ Registro eliminado');

    } catch (err) {
      console.error(err);
      alert('No se pudo eliminar el registro');
    }
  }
});

/* ================== TOAST ================== */
function mostrarToast(mensaje) {
  let toast = document.getElementById('toastSuccess');
  if(!toast){
    toast = document.createElement('div');
    toast.id = 'toastSuccess';
    toast.style = `
      display:none;
      position:fixed;
      bottom:20px;
      left:50%;
      transform:translateX(-50%);
      background:#22c55e;
      color:#fff;
      padding:12px 20px;
      border-radius:10px;
      font-size:14px;
      box-shadow:0 8px 20px rgba(0,0,0,.25);
      z-index:9999;
    `;
    document.body.appendChild(toast);
  }

  toast.textContent = mensaje;
  toast.style.display = 'block';
  setTimeout(()=> toast.style.display = 'none', 2500);
}

/* ================== INICIO ================== */
loadRecords();

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
const regenQR = document.getElementById('regenQR');
let currentQRWorkerId = null;

qrModal.style.display = 'none';
closeQrModal.onclick = () => qrModal.style.display = 'none';

/* ================== CACHE ================== */
let workersCache = [];

/* ================== API HELPERS ================== */
async function apiGetWorkers() {
  const { data, error } = await supabase
    .from('workers')
    .select('id, nombre, pin, activo, fecha_ingreso, qr_token')
    .order('fecha_ingreso', { ascending: false });

  if (error) throw error;

  workersCache = data.map(w => ({
    id: w.id,
    nombre: w.nombre,
    pin: w.pin,
    activo: w.activo,
    fechaIngreso: w.fecha_ingreso,
    qr_token: w.qr_token
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
      <td>${worker.fechaIngreso || ''}</td>
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
      fecha_ingreso: fecha,
      qr_token: crypto.randomUUID()
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

  currentQRWorkerId = worker.id;

  qrImage.innerHTML = '';

  new QRCode(qrImage, {
    text: worker.qr_token,
    width: 180,
    height: 180,
    correctLevel: QRCode.CorrectLevel.H
  });

  qrModal.style.display = 'flex';
  return;
}

/* ===== EDITAR ===== */
if (editBtn) {
  const worker = workersCache.find(w => w.id == editBtn.dataset.id);
  if (!worker) return;

  document.getElementById('editWorkerId').value = worker.id;
  document.getElementById('editNombre').value  = worker.nombre;
  document.getElementById('editPin').value     = worker.pin;
  document.getElementById('editActivo').checked = worker.activo;

  // ✅ FECHA SEGURA PARA INPUT DATE
  if (worker.fechaIngreso) {
    document.getElementById('editFecha').value =
      worker.fechaIngreso.substring(0, 10); // YYYY-MM-DD
  } else {
    document.getElementById('editFecha').value = '';
  }

  document.getElementById('editWorkerModal').style.display = 'flex';
  return;
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
document.getElementById('saveEditWorker').addEventListener('click', async () => {

  const id = document.getElementById('editWorkerId').value;
  const nombre = document.getElementById('editNombre').value.trim();
  const pin = document.getElementById('editPin').value.trim();
  const activo = document.getElementById('editActivo').checked;
  const fechaInput = document.getElementById('editFecha').value; // YYYY-MM-DD

  if (!nombre || pin.length !== 4 || !fechaInput) {
    alert('Completa todos los campos');
    return;
  }

  try {
    const { error } = await supabase
      .from('workers')
      .update({
        nombre,
        pin,
        activo,
        fecha_ingreso: fechaInput
      })
      .eq('id', id);

    if (error) throw error;

    document.getElementById('editWorkerModal').style.display = 'none';
    mostrarToast('✏️ Trabajador actualizado correctamente');
    loadWorkers();

  } catch (err) {
    console.error(err);
    alert('Error al actualizar trabajador');
  }
});

document.getElementById('closeEditWorker').onclick = () => {
  document.getElementById('editWorkerModal').style.display = 'none';
};

regenQR.addEventListener('click', async () => {
  if (!currentQRWorkerId) return;

  const ok = confirm(
    'Esto invalidará el QR anterior.\n¿Deseas generar uno nuevo?'
  );
  if (!ok) return;

  const newToken = crypto.randomUUID();

  try {
    const { error } = await supabase
      .from('workers')
      .update({ qr_token: newToken })
      .eq('id', currentQRWorkerId);

    if (error) throw error;

    // actualizar cache
    const worker = workersCache.find(w => w.id === currentQRWorkerId);
    if (worker) worker.qr_token = newToken;

    // refrescar QR en pantalla
    qrImage.innerHTML = ''; // limpiar QR anterior

new QRCode(qrImage, {
  text: worker.qr_token,
  width: 180,
  height: 180,
  correctLevel: QRCode.CorrectLevel.H
});


    mostrarToast('🔄 QR regenerado correctamente');

  } catch (err) {
    console.error(err);
    alert('No se pudo regenerar el QR');
  }
});
downloadQR.addEventListener('click', async () => {
  const badge = document.getElementById('badge');

  // ocultar botones (no-print / no-export)
  badge.classList.add('exporting');

  const canvas = await html2canvas(badge, {
    scale: 3,           // alta calidad
    useCORS: true,
    backgroundColor: '#ffffff'
  });

  badge.classList.remove('exporting');

  const link = document.createElement('a');
  link.download = `gafete_qr_${currentQRWorkerId}.png`;
  link.href = canvas.toDataURL('image/png');
  link.click();
});

/* ================== INICIO ================== */
loadWorkers();
