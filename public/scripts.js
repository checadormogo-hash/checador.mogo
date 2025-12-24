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
      // step SE IGNORA (backend manda)
    }));
  } catch (e) {
    console.error('Error cargando trabajadores', e);
  }
}

// ===== FECHA dd-mm-aaaa =====
function getLocalDateDMY() {
  const d = new Date();
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  return `${day}-${month}-${year}`;
}

// ===== HORA MX 12h =====
function time12hMX() {
  return new Date().toLocaleTimeString('es-MX', {
    timeZone: 'America/Monterrey',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  });
}

// ===== FECHA Y HORA UI =====
function updateDateTime() {
  const now = new Date();

  const dateFormatter = new Intl.DateTimeFormat('es-MX', {
    weekday: 'long',
    day: '2-digit',
    month: 'long'
  });

  const timeFormatter = new Intl.DateTimeFormat('es-MX', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true
  });

  const date = dateFormatter.format(now);
  const time = timeFormatter.format(now);

  const formattedDate = date.charAt(0).toUpperCase() + date.slice(1);
  currentDateEl.textContent = `${formattedDate} · ${time}`;
}

// ===== BOTONES ACCIÓN =====
actionButtons.forEach(btn => {
  btn.addEventListener('click', () => {
    const action = btn.dataset.action;
    console.log('Acción presionada:', action);
  });
});

// ===== BLOQUEO =====
function isBlocked(workerId) {
  const lastTime = recentScans.get(workerId);
  if (!lastTime) return false;

  const now = Date.now();
  if (now - lastTime < BLOCK_TIME) {
    return true;
  }

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

  const activeTab = document.querySelector('.auto-tab.active');
  if (activeTab && activeTab.dataset.mode === 'scanner') {
    setTimeout(() => scannerInput?.focus(), 100);
  }
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

['click', 'touchstart', 'keydown'].forEach(evt => {
  document.addEventListener(evt, () => {
    if (autoOverlay.style.display === 'none') startInactivityTimer();
  });
});

// ===== AL CARGAR =====
window.addEventListener('load', async () => {
  await loadEmployees();
  showAutoModal();
});

// ===== BOTÓN MANUAL =====
document.getElementById('openAutoModal')
  .addEventListener('click', () => {
    showAutoModal();
    clearTimeout(inactivityTimer);
  });

// ===== TABS =====
const autoTabs = document.querySelectorAll('.auto-tab');
const autoPanels = document.querySelectorAll('.auto-panel');

autoTabs.forEach(tab => {
  tab.addEventListener('click', () => {
    autoTabs.forEach(t => t.classList.remove('active'));
    autoPanels.forEach(p => p.classList.remove('active'));

    tab.classList.add('active');
    document
      .getElementById(tab.dataset.mode === 'camera' ? 'autoCamera' : 'autoScanner')
      .classList.add('active');

    if (tab.dataset.mode === 'scanner') {
      setTimeout(() => scannerInput.focus(), 100);
    }
  });
});

// ===== ESCANEAR QR =====
scannerInput.addEventListener('change', () => {
  const value = scannerInput.value.trim();
  scannerInput.value = "";

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
    showCriticalModal('Usuario no registrado', 'El colaborador no existe');
    return;
  }

  if (employee.activo !== 'SI') {
    showCriticalModal('Acceso denegado', 'Colaborador desactivado');
    return;
  }

  if (employee.pin !== pin) {
    showWarningModal('Datos incorrectos', 'PIN incorrecto');
    return;
  }

  // 🚫 BLOQUEO REAL (NO ENVÍA)
  if (isBlocked(employee.id)) {
    showWarningModal(
      'Checada reciente',
      'Ya registraste una checada. Espera unos minutos.'
    );
    return;
  }

  registerCheck(employee);
}

// ===== REGISTRAR CHECADA (BACKEND DECIDE TODO) =====
async function registerCheck(employee) {
  recentScans.set(employee.id, Date.now());

  const payload = {
    workerId: employee.id,
    date: getLocalDateDMY(),
    time: time12hMX()
  };

  try {
    const resp = await fetch('/api/data/records', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const result = await resp.json();

    if (!resp.ok) {
      showCriticalModal('Error', result.error || 'No se pudo guardar');
      return;
    }

    const messages = {
      entradaTrabajo: ['Entrada registrada', `Hola ${employee.name}`],
      salidaComida: ['Salida a comida', `Buen provecho ${employee.name}`],
      entradaComida: ['Entrada de comida', `Bienvenido ${employee.name}`],
      salidaTrabajo: ['Salida registrada', `Gracias ${employee.name}`]
    };

    const [title, msg] = messages[result.fieldRegistered];
    showConfirmModal(title, msg);

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
  showConfirmModal(title, message, 2500);
}

function showCriticalModal(title, message) {
  setConfirmStyle('#dc2626');
  showConfirmModal(title, message, 3000);
}

function setConfirmStyle(color) {
  const box = document.querySelector('.confirm-box');
  if (box) box.style.background = color;
}

// ===== INICIAR RELOJ =====
updateDateTime();
setInterval(updateDateTime, 1000);
