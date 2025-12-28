/* ================== APP.JS COMPLETO ================== */

document.addEventListener('DOMContentLoaded', () => {
  const filterText = document.getElementById('filterText');
  const filterDate = document.getElementById('filterDate');
  const clearFiltersBtn = document.getElementById('clearFilters');
  /* ================== CONFIG ================== */
  // Supabase CDN (SIN import)
  const supabase = window.supabase.createClient(
    "https://akgbqsfkehqlpxtrjsnw.supabase.co",
    "sb_publishable_dXfxuXMQS__XuqmdqXnbgA_yBkRMABj"
  );

/* ================== HASH PASSWORD ================== */
async function sha256(text) {
  const data = new TextEncoder().encode(text);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hashBuffer))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}
  /* ================== CACHE ================== */
  let recordsCache = [];
  let workersCache = [];
  let currentQRWorkerId = null;

  /* ================== TOAST ================== */
  function mostrarToast(mensaje) {
    let toast = document.getElementById('toastSuccess');
    if (!toast) {
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
    setTimeout(() => toast.style.display = 'none', 2500);
  }

  /* ================== RENDER REGISTROS ================== */
  function renderRecords(data = recordsCache) {
    const tbody = document.getElementById('recordsTableBody');
    if (!tbody) return; // evitar null
    tbody.innerHTML = '';

    if (!data.length) {
      tbody.innerHTML = `<tr><td colspan="7">No hay registros</td></tr>`;
      return;
    }

    data.forEach(record => {
      const trabajador = workersCache.find(w => w.id == record.worker_id);
      const nombre = trabajador ? trabajador.nombre : 'Desconocido';

      const tr = document.createElement('tr');
      tr.dataset.id = record.id;

      tr.innerHTML = `
        <td>${nombre}</td>
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

  function applyRecordFilters() {
  const text = filterText.value.toLowerCase().trim();
  const date = filterDate.value;

  const filtered = recordsCache.filter(record => {
    const worker = workersCache.find(w => w.id == record.worker_id);
    const nombre = worker ? worker.nombre.toLowerCase() : '';

    const matchText =
      !text ||
      nombre.includes(text) ||
      String(record.worker_id).includes(text);

    const matchDate =
      !date || record.fecha === date;

    return matchText && matchDate;
  });

  renderRecords(filtered);
}
if (filterText) {
  filterText.addEventListener('input', applyRecordFilters);
}

if (filterDate) {
  filterDate.addEventListener('change', applyRecordFilters);
}
if (clearFiltersBtn) {
  clearFiltersBtn.addEventListener('click', () => {
    filterText.value = '';
    filterDate.value = '';
    renderRecords();
  });
}

  /* ================== CARGAR REGISTROS ================== */
  async function loadRecords() {
    try {
      const { data, error } = await supabase
        .from('records')
        .select('*')
        .order('fecha', { ascending: false });

      if (error) throw error;

      recordsCache = data.map(r => ({
        id: r.id,
        worker_id: r.worker_id, // <- importante
        trabajador: r.trabajador,
        fecha: r.fecha.substring(0, 10),
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
/* ================== INICIO: CARGAR TRABAJADORES + REGISTROS ================== */
async function init() {
  await loadWorkers(); // primero cargamos trabajadores
  await loadRecords(); // luego registros
}
init();
  /* ================== EVENT LISTENER REGISTROS ================== */
  const recordsTableBody = document.getElementById('recordsTableBody');
  if (recordsTableBody) {
    recordsTableBody.addEventListener('click', async e => {
      const tr = e.target.closest('tr');
      if (!tr) return;
      const id = tr.dataset.id;

      // Editar
      if (e.target.closest('.btn-edit')) {
        const inputsExist = tr.querySelectorAll('input').length;
        if (inputsExist) {
          const updated = {};
          tr.querySelectorAll('td.editable').forEach((td, i) => {
            const val = td.querySelector('input').value;
            updated[['entrada', 'salida_comida', 'entrada_comida', 'salida'][i]] = val !== '' ? val : null;
          });

          try {
            const { error } = await supabase
              .from('records')
              .update(updated)
              .eq('id', id);

            if (error) throw error;

            const rec = recordsCache.find(r => r.id == id);
            Object.assign(rec, updated);

            renderRecords();
            mostrarToast('✏️ Registro actualizado');
          } catch (err) {
            console.error(err);
            alert('Error al actualizar registro');
          }

        } else {
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

          recordsCache = recordsCache.filter(r => r.id != id);
          renderRecords();
          mostrarToast('🗑️ Registro eliminado');
        } catch (err) {
          console.error(err);
          alert('No se pudo eliminar el registro');
        }
      }
    });
  }

/* ================== LOGIN ADMIN (SUPABASE) ================== */
const loginOverlay = document.getElementById('loginOverlay');
const adminApp = document.getElementById('adminApp');
const loginBtn = document.getElementById('loginBtn');
const loginError = document.getElementById('loginError');

function showAdmin() {
  loginOverlay.style.display = 'none';
  adminApp.style.display = 'block';
}

function showLogin() {
  loginOverlay.style.display = 'flex';
  adminApp.style.display = 'none';
}

// Sesión persistente
if (localStorage.getItem('adminSession')) {
  showAdmin();
} else {
  showLogin();
}

if (loginBtn) {
  loginBtn.addEventListener('click', async () => {
    const user = document.getElementById('adminUser').value.trim();
    const pass = document.getElementById('adminPass').value.trim();

    if (!user || !pass) return;

    const hash = await sha256(pass);

    const { data, error } = await supabase
      .from('admin_users')
      .select('id, username, role')
      .eq('username', user)
      .eq('password_hash', hash)
      .eq('activo', true)
      .single();

    if (error || !data) {
      loginError.style.display = 'block';
      return;
    }

    localStorage.setItem('adminSession', JSON.stringify(data));
    loginError.style.display = 'none';
    showAdmin();
  });
}
/* ================== LOGOUT ================== */
const logoutBtn = document.getElementById('logoutAdmin');

if (logoutBtn) {
  logoutBtn.addEventListener('click', () => {
    localStorage.removeItem('adminSession');
    location.reload();
  });
}
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

  if (menuToggle) menuToggle.onclick = openMenu;
  if (closeMenu) closeMenu.onclick = closeMenuFn;
  if (menuOverlay) menuOverlay.onclick = closeMenuFn;


/* ================== Autorizaciones ================== */
const menuAuthPins = document.getElementById('menuAuthPins');
const authPinsModal = document.getElementById('authPinsModal');
const closeAuthPins = document.getElementById('closeAuthPins');
const authPinsTableBody = document.getElementById('authPinsTableBody');

if (menuAuthPins) {
  menuAuthPins.onclick = async () => {
  closeMenuFn();
  if (authPinsModal) {
  authPinsModal.style.display = 'flex';
}
  // 👇 aseguras que existan trabajadores
  if (!workersCache.length) {
    await loadWorkers();
  }

  loadAuthPinsToday();
};
}

if (closeAuthPins) {
  closeAuthPins.onclick = () => {
    authPinsModal.style.display = 'none';
  };
}
async function loadAuthPinsToday() {
  authPinsTableBody.innerHTML = '';

  const today = new Date().toISOString().substring(0, 10);

  try {
    // Traer todos los registros de hoy
      const { data, error } = await supabase
        .from('records')
        .select('id, worker_id, entrada, salida')
        .eq('fecha', today)
        .not('entrada', 'is', null)
        .order('entrada', { ascending: true });

    if (error) throw error;

    // Filtrar: entrada tiene valor y salida aún no registrada
    const activos = data.filter(r => r.entrada && r.entrada.trim() !== "" && (!r.salida || r.salida.trim() === ""));

    if (!activos.length) {
      authPinsTableBody.innerHTML = `
        <tr><td colspan="4">No hay trabajadores con entrada activa</td></tr>
      `;
      return;
    }

    activos.forEach(rec => {
      const worker = workersCache.find(w => w.id == rec.worker_id);
      if (!worker) return;

      const tr = document.createElement('tr');

      tr.innerHTML = `
        <td>${worker.nombre}</td>
        <td>${rec.entrada}</td>
        <td class="pin-cell">—</td>
        <td>
          <button class="btn primary btn-gen-pin" data-worker="${worker.id}">
            Generar PIN
          </button>
        </td>
      `;

      authPinsTableBody.appendChild(tr);
    });
  } catch (err) {
    console.error(err);
    authPinsTableBody.innerHTML = `
      <tr><td colspan="4">Error al cargar trabajadores</td></tr>
    `;
  }
}
if (authPinsTableBody) {
  authPinsTableBody.addEventListener('click', async e => {

    // GENERAR PIN
    const genBtn = e.target.closest('.btn-gen-pin');
    if (genBtn) {
      const workerId = genBtn.dataset.worker;
      const pin = Math.floor(1000 + Math.random() * 9000).toString();

      const { error } = await supabase
        .from('auth_pins').insert([{
        worker_id: workerId,
        pin,
        tipo: 'salida_temprana'
      }]);

      if (error) {
        alert('No se pudo generar el PIN');
        return;
      }

      const tr = genBtn.closest('tr');
      const tdPin = tr.querySelector('.pin-cell');

      tdPin.innerHTML = `<strong>${pin}</strong>`;
      tdPin.dataset.pin = pin;

      genBtn.outerHTML = `
        <button class="btn-icon copy-pin" title="Copiar PIN">📋</button>
        <button class="btn-icon share-pin" title="WhatsApp">🟢</button>
      `;
      return;
    }

    // COPIAR
    if (e.target.closest('.copy-pin')) {
      const pin = e.target.closest('tr').querySelector('.pin-cell').dataset.pin;
      navigator.clipboard.writeText(pin);
      mostrarToast('📋 PIN copiado');
      return;
    }

    // WHATSAPP
    if (e.target.closest('.share-pin')) {
      const tr = e.target.closest('tr');
      const nombre = tr.children[0].textContent;
      const pin = tr.querySelector('.pin-cell').dataset.pin;

      const msg = `🔐 Autorización de salida\n\nTrabajador: ${nombre}\nPIN: ${pin}\n\nUso único.`;
      window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, '_blank');
    }
  });
}
  /* ================== MODAL ALTA ================== */
  const addModal = document.getElementById('addWorkerModal');
  const openBtn = document.getElementById('openAddModal');
  const closeBtn = document.getElementById('closeAddModal');
  const saveWorkerBtn = document.getElementById('saveWorker');

  if (addModal) addModal.style.display = 'none';
  if (openBtn) openBtn.onclick = () => addModal.style.display = 'flex';
  if (closeBtn) closeBtn.onclick = () => addModal.style.display = 'none';

  const pinInput = document.getElementById('workerPin');
  if (pinInput) {
    pinInput.addEventListener('input', () => {
      pinInput.value = pinInput.value.replace(/\D/g, '').slice(0, 4);
    });
  }

  /* ================== MODAL LISTA ================== */
  const workersModal = document.getElementById('workersModal');
  const openWorkersBtn = document.getElementById('menuWorkers');
  const closeWorkersModal = document.getElementById('closeWorkersModal');
  const workersTableBody = document.getElementById('workersTableBody');

  if (workersModal) workersModal.style.display = 'none';
  if (openWorkersBtn) openWorkersBtn.onclick = () => {
    closeMenuFn();
    workersModal.style.display = 'flex';
    loadWorkers();
  };
  if (closeWorkersModal) closeWorkersModal.onclick = () => {
    workersModal.style.display = 'none';
  };

  /* ================== MODAL QR ================== */
  const qrModal = document.getElementById('qrModal');
  const closeQrModal = document.getElementById('closeQrModal');
  const qrImage = document.getElementById('qrImage');
  const badge = document.getElementById('badge');
  const regenQR = document.getElementById('regenQR');
  const downloadQR = document.getElementById('downloadQR');

  if (qrModal) qrModal.style.display = 'none';
  if (closeQrModal) closeQrModal.onclick = () => qrModal.style.display = 'none';

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

  /* ================== RENDER WORKERS ================== */
  function renderWorkers() {
    if (!workersTableBody) return;
    workersTableBody.innerHTML = '';

    if (!workersCache.length) {
      workersTableBody.innerHTML = `<tr><td colspan="6">No hay trabajadores registrados</td></tr>`;
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

  /* ================== LOAD WORKERS ================== */
  async function loadWorkers() {
    try {
      await apiGetWorkers();
    } catch (err) {
      console.error(err);
    }
  }

  /* ================== SAVE WORKER ================== */
  if (saveWorkerBtn) {
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

        if (addModal) addModal.style.display = 'none';
        loadWorkers();

      } catch (err) {
        console.error(err);
        alert('Error al guardar trabajador');
      }
    });
  }

  /* ================== EVENT LISTENER WORKERS ================== */
  if (workersTableBody) {
    workersTableBody.addEventListener('click', async e => {
      const qrBtn = e.target.closest('.btn-qr');
      const delBtn = e.target.closest('.btn-delete');
      const editBtn = e.target.closest('.btn-edit');

      // QR
      if (qrBtn) {
        const worker = workersCache.find(w => w.id == qrBtn.dataset.id);
        if (!worker || !qrImage || !qrModal) return;

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

      // EDIT
      if (editBtn) {
        const worker = workersCache.find(w => w.id == editBtn.dataset.id);
        if (!worker) return;

        document.getElementById('editWorkerId').value = worker.id;
        document.getElementById('editNombre').value = worker.nombre;
        document.getElementById('editPin').value = worker.pin;
        document.getElementById('editActivo').checked = worker.activo;

        if (worker.fechaIngreso) {
          document.getElementById('editFecha').value = worker.fechaIngreso.substring(0, 10);
        } else {
          document.getElementById('editFecha').value = '';
        }

        document.getElementById('editWorkerModal').style.display = 'flex';
        return;
      }

      // DELETE
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
  }

  /* ================== SAVE EDIT WORKER ================== */
  const saveEditWorkerBtn = document.getElementById('saveEditWorker');
  if (saveEditWorkerBtn) {
    saveEditWorkerBtn.addEventListener('click', async () => {
      const id = document.getElementById('editWorkerId').value;
      const nombre = document.getElementById('editNombre').value.trim();
      const pin = document.getElementById('editPin').value.trim();
      const activo = document.getElementById('editActivo').checked;
      const fechaInput = document.getElementById('editFecha').value;

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
  }

  /* ================== CLOSE EDIT WORKER ================== */
  const closeEditWorkerBtn = document.getElementById('closeEditWorker');
  if (closeEditWorkerBtn) {
    closeEditWorkerBtn.onclick = () => {
      document.getElementById('editWorkerModal').style.display = 'none';
    };
  }

  /* ================== REGENERAR QR ================== */
  if (regenQR) {
    regenQR.addEventListener('click', async () => {
      if (!currentQRWorkerId) return;

      const ok = confirm('Esto invalidará el QR anterior.\n¿Deseas generar uno nuevo?');
      if (!ok) return;

      const newToken = crypto.randomUUID();

      try {
        const { error } = await supabase
          .from('workers')
          .update({ qr_token: newToken })
          .eq('id', currentQRWorkerId);

        if (error) throw error;

        const worker = workersCache.find(w => w.id === currentQRWorkerId);
        if (worker && qrImage) {
          worker.qr_token = newToken;
          qrImage.innerHTML = '';
          new QRCode(qrImage, {
            text: worker.qr_token,
            width: 180,
            height: 180,
            correctLevel: QRCode.CorrectLevel.H
          });
        }

        mostrarToast('🔄 QR regenerado correctamente');

      } catch (err) {
        console.error(err);
        alert('No se pudo regenerar el QR');
      }
    });
  }

  /* ================== DESCARGAR QR ================== */
  if (downloadQR && badge) {
    downloadQR.addEventListener('click', async () => {
      badge.classList.add('exporting');

      const canvas = await html2canvas(badge, {
        scale: 3,
        useCORS: true,
        backgroundColor: '#ffffff'
      });

      badge.classList.remove('exporting');

      const link = document.createElement('a');
      link.download = `gafete_qr_${currentQRWorkerId}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
    });
  }

  /* ================== SERVICE WORKER ================== */
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/service-worker.js')
    .then(reg => {
      console.log('✅ SW registrado en ADMIN:', reg.scope);
    })
    .catch(err => {
      console.error('❌ Error al registrar SW en ADMIN', err);
    });
}

  /* ================== PWA INSTALL ADMIN ================== */

let deferredPromptAdmin = null;
const installAdminBtn = document.getElementById('installAdminApp');

// Detectar si ya está instalada
function isAppInstalled() {
  return window.matchMedia('(display-mode: standalone)').matches
    || window.navigator.standalone === true;
}

// Escuchar evento de instalación disponible
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault(); // evita banner automático
  deferredPromptAdmin = e;

  if (installAdminBtn && !isAppInstalled()) {
    installAdminBtn.style.display = 'flex';
  }
});

// Click en instalar
if (installAdminBtn) {
  installAdminBtn.addEventListener('click', async () => {
    if (!deferredPromptAdmin) return;

    deferredPromptAdmin.prompt();
    const { outcome } = await deferredPromptAdmin.userChoice;

    if (outcome === 'accepted') {
      installAdminBtn.style.display = 'none';
      deferredPromptAdmin = null;
    }
  });
}

// Si ya está instalada, nunca mostrar botón
if (installAdminBtn && isAppInstalled()) {
  installAdminBtn.style.display = 'none';
}

/* ================== REPORTE SEMANAL ================== */

const weeklyReportModal = document.getElementById('weeklyReportModal');
const workerDetailModal = document.getElementById('workerDetailModal');

document.getElementById('closeWeeklyReport').onclick = () =>
  weeklyReportModal.classList.add('oculto');

document.getElementById('closeWorkerDetail').onclick = () =>
  workerDetailModal.classList.add('oculto');
/* ================== BOTÓN REPORTES ================== */

// buscamos el botón por su texto
const reportBtn = [...document.querySelectorAll('button')]
  .find(btn => btn.textContent.trim().includes('Reportes'));

if (reportBtn) {
  reportBtn.addEventListener('click', () => {
    closeMenuFn();
    openWeeklyReport();
  });
}
function openWeeklyReport() {
  weeklyReportModal.classList.remove('oculto');
  generateWeeklyReport();
}
function generateWeeklyReport() {
  console.log('📊 Generando reporte semanal...');
  // aquí después metemos la lógica real
}


});