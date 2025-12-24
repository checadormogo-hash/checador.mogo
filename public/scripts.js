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
      activo: w.activo,
      step: 0 // 👈 SOLO PARA UI
    }));
  } catch (e) {
    console.error('Error cargando trabajadores', e);
  }
}

// ===== FECHA Y HORA MX =====
function getLocalDateDMY() {
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

// ===== FECHA Y HORA HEADER =====
function updateDateTime() {
  const now = new Date();

  const dateFormatter = new Intl.DateTimeFormat('es-MX', {
    weekday: 'long',
    day: '2-digit',
    month: 'long',
    timeZone: 'America/Monterrey'
  });

  const time = time12hMX();
  const date = dateFormatter.format(now);
  currentDateEl.textContent =
    date.charAt(0).toUpperCase() + date.slice(1) + ' · ' + time;
}

// ===== BOTONES ACCIÓN =====
actionButtons.forEach(btn => {
  btn.addEventListener('click', () => {
    console.log('Acción presionada:', btn.dataset.action);
  });
});

// ===== BLOQUEO =====
function isBlocked(workerId) {
  const lastTime = recentScans.get(workerId);
  if (!lastTime) return false;
  if (Date.now() - lastTime < BLOCK_TIME) return true;
  recentScans.delete(workerId);
  return false;
}

// ===== MODAL AUTOMÁTICO =====
const autoOverlay = document.getElementById('autoOverlay');
const closeAutoModal = document.getElementById('closeAutoModal');
let inactivityTimer = null;
const INACTIVITY_TIME = 15000;

function showAutoModal() {
  clearTimeout(inactivityTimer);
  autoOverlay.style.display = 'flex';
  setTimeout(() => scannerInput?.focus(), 100);
}

function hideAutoModal() {
  autoOverlay.style.display = 'none';
  startInactivityTimer();
}

function startInactivityTimer() {
  clearTimeout(inactivityTimer);
  inactivityTimer = setTimeout(showAutoModal, INACTIVITY_TIME);
}

closeAutoModal.addEventListener('click', hideAutoModal);

// ===== INIT =====
window.addEventListener('load', async () => {
  await loadEmployees();
  showAutoModal();
  updateDateTime();
  setInterval(updateDateTime, 1000);
});

// ===== ESCANEAR QR =====
scannerInput.addEventListener('change', () => {
  const value = scannerInput.value.trim();
  scannerInput.value = '';
  if (!value.includes('|')) {
    showWarningModal('QR inválido', 'Formato incorrecto');
    return;
  }
  processQR(value);
});

function processQR(qrValue) {
  const [empId, pin] = qrValue.split('|');
  const employee = employees.find(e => e.id === empId);

  if (!employee) {
    showCriticalModal('Usuario no registrado', 'No existe en el sistema');
    return;
  }
  if (employee.activo !== 'SI') {
    showCriticalModal('Acceso denegado', 'Colaborador inactivo');
    return;
  }
  if (employee.pin !== pin) {
    showWarningModal('PIN incorrecto', 'Datos incorrectos');
    return;
  }
  if (isBlocked(employee.id)) {
    showWarningModal('Checada reciente', 'Espera unos minutos');
    return;
  }

  registerStep(employee);
}

// ===== REGISTRAR CHECADA (CORREGIDO) =====
async function registerStep(employee) {
  recentScans.set(employee.id, Date.now());

  try {
    const resp = await fetch('/api/data/records', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        workerId: employee.id,
        date: getLocalDateDMY(),
        time: time12hMX()
      })
    });

    const result = await resp.json();
    if (!resp.ok) throw new Error();

    // 👇 UI SE MANTIENE IGUAL
    switch (employee.step) {
      case 0:
        showConfirmModal('Entrada registrada', `Hola ${employee.name}, bienvenido.`);
        employee.step = 1;
        break;
      case 1:
        showConfirmModal('Salida a comida', `Buen provecho ${employee.name}.`);
        employee.step = 2;
        break;
      case 2:
        showConfirmModal('Entrada de comida', `Bienvenido nuevamente ${employee.name}.`);
        employee.step = 3;
        break;
      case 3:
        showConfirmModal('Salida registrada', `Gracias por tu esfuerzo ${employee.name}.`);
        employee.step = 0;
        break;
    }
  } catch {
    showCriticalModal('Error', 'No se pudo guardar la checada');
  }
}

// ===== MODALES =====
const confirmModal = document.getElementById('confirmModal');
const confirmTitle = document.getElementById('confirmTitle');
const confirmMessage = document.getElementById('confirmMessage');
const closeConfirmModal = document.getElementById('closeConfirmModal');
let confirmTimeout = null;

function showConfirmModal(title, message, duration = 2500) {
  confirmTitle.textContent = title;
  confirmMessage.textContent = message;
  confirmModal.classList.remove('oculto');
  confirmTimeout = setTimeout(closeConfirmation, duration);
}

function closeConfirmation() {
  clearTimeout(confirmTimeout);
  confirmModal.classList.add('oculto');
  showAutoModal();
}

closeConfirmModal.addEventListener('click', closeConfirmation);

function showWarningModal(title, message) {
  setConfirmStyle('#d97706');
  showConfirmModal(title, message);
}

function showCriticalModal(title, message) {
  setConfirmStyle('#dc2626');
  showConfirmModal(title, message, 3000);
}

function setConfirmStyle(color) {
  document.querySelector('.confirm-box')?.style.background = color;
}
