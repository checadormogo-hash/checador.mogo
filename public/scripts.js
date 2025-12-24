// ===== BLOQUEO ANTI DOBLE CHECADA =====
const recentScans = new Map();
const BLOCK_TIME = 3 * 60 * 1000; // 3 minutos

const actionButtons = document.querySelectorAll('.action-btn');
const scannerInput = document.querySelector('.scanner-input');
const currentDateEl = document.getElementById('currentDate');

let employees = [];

// ===== CARGAR TRABAJADORES =====
async function loadEmployees() {
  try {
    const r = await fetch('/api/data/workers', { cache: 'no-store' });
    const data = await r.json();

    employees = (data.workers || []).map(w => ({
      id: w.id,
      name: w.nombre,
      pin: w.pin,
      activo: w.activo
    }));
  } catch (e) {
    console.error('Error cargando trabajadores', e);
  }
}

// ===== FECHA Y HORA MX =====
function getDateDMY() {
  const d = new Date();
  return d.toLocaleDateString('es-MX', {
    timeZone: 'America/Monterrey',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  }).replace(/\//g, '-');
}

function time12hMX() {
  return new Date().toLocaleTimeString('es-MX', {
    timeZone: 'America/Monterrey',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  });
}

// ===== HEADER FECHA =====
function updateDateTime() {
  const now = new Date();
  const date = now.toLocaleDateString('es-MX', {
    timeZone: 'America/Monterrey',
    weekday: 'long',
    day: '2-digit',
    month: 'long'
  });
  const time = time12hMX();
  currentDateEl.textContent =
    date.charAt(0).toUpperCase() + date.slice(1) + ' · ' + time;
}

// ===== BLOQUEO =====
function isBlocked(workerId) {
  const last = recentScans.get(workerId);
  if (!last) return false;
  if (Date.now() - last < BLOCK_TIME) return true;
  recentScans.delete(workerId);
  return false;
}

// ===== ESCÁNER =====
scannerInput.addEventListener('change', () => {
  const value = scannerInput.value.trim();
  scannerInput.value = '';

  if (!value.includes('|')) {
    showWarningModal('QR inválido', 'Formato incorrecto');
    return;
  }
  processQR(value);
});

function processQR(qr) {
  const [empId, pin] = qr.split('|');
  const emp = employees.find(e => e.id === empId);

  if (!emp) {
    showCriticalModal('Usuario no registrado', 'No existe en el sistema');
    return;
  }
  if (emp.activo !== 'SI') {
    showCriticalModal('Acceso denegado', 'Colaborador inactivo');
    return;
  }
  if (emp.pin !== pin) {
    showWarningModal('PIN incorrecto', 'Datos inválidos');
    return;
  }
  if (isBlocked(emp.id)) {
    showWarningModal('Checada reciente', 'Espera unos minutos');
    return;
  }

  registerAttendance(emp);
}

// ===== REGISTRAR (SIN STEP) =====
async function registerAttendance(emp) {
  recentScans.set(emp.id, Date.now());

  try {
    const resp = await fetch('/api/data/records', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        workerId: emp.id,
        date: getDateDMY(),
        time: time12hMX()
      })
    });

    const result = await resp.json();
    if (!resp.ok) throw new Error(result.error);

    showConfirmModal(result.title, result.message);
  } catch (e) {
    showCriticalModal('Error', 'No se pudo guardar la checada');
  }
}

// ===== MODALES =====
const confirmModal = document.getElementById('confirmModal');
const confirmTitle = document.getElementById('confirmTitle');
const confirmMessage = document.getElementById('confirmMessage');
const closeConfirmModal = document.getElementById('closeConfirmModal');

function showConfirmModal(title, message, duration = 2500) {
  confirmTitle.textContent = title;
  confirmMessage.textContent = message;
  confirmModal.classList.remove('oculto');
  setTimeout(() => confirmModal.classList.add('oculto'), duration);
}

closeConfirmModal.addEventListener('click', () => {
  confirmModal.classList.add('oculto');
});

// ===== INIT =====
window.addEventListener('load', async () => {
  await loadEmployees();
  updateDateTime();
  setInterval(updateDateTime, 1000);
});
