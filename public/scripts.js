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
      step: 0
    }));
  } catch (e) {
    console.error('Error cargando trabajadores', e);
  }
}


function getLocalDate() {
  const now = new Date();
  const offset = now.getTimezoneOffset() * 60000;
  return new Date(now - offset).toISOString().split('T')[0];
}

// ===== FECHA Y HORA =====
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

function isBlocked(workerId) {
  const lastTime = recentScans.get(workerId);
  if (!lastTime) return false;

  const now = Date.now();
  if (now - lastTime < BLOCK_TIME) {
    return true;
  }

  // Si ya pasó el tiempo, liberar
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
    setTimeout(() => {
      if (scannerInput) scannerInput.focus();
    }, 100);
  }
}

function hideAutoModal() {
  autoOverlay.style.display = 'none';
  startInactivityTimer();
}

function startInactivityTimer() {
  clearTimeout(inactivityTimer);
  inactivityTimer = setTimeout(() => {
    showAutoModal();
  }, INACTIVITY_TIME);
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
const openAutoModalBtn = document.getElementById('openAutoModal');
openAutoModalBtn.addEventListener('click', () => {
  showAutoModal();
  clearTimeout(inactivityTimer);
});

// ===== CAMBIO DE TAB CAMERA / SCANNER =====
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
      setTimeout(() => { scannerInput.focus(); }, 100);
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

  if (!empId || !pin) {
    showWarningModal('QR inválido', 'Formato incorrecto');
    return;
  }

  const employee = employees.find(e => e.id === empId);

  if (!employee) {
    showCriticalModal('Usuario no registrado', 'El colaborador no existe en el sistema');
    return;
  }

  if (employee.activo !== 'SI') {
    showCriticalModal('Acceso denegado', 'El colaborador está desactivado');
    return;
  }

  if (employee.pin !== pin) {
    showWarningModal('Datos incorrectos', 'Usuario o PIN incorrecto');
    return;
  }
// 🚫 BLOQUEO POR DOBLE CHECADA
if (isBlocked(employee.id)) {
  showWarningModal(
    'Checada reciente',
    'Ya registraste tu asistencia. Espera unos minutos.'
  );
  return;
}

  registerStep(employee);
}

// ===== REGISTRAR CHECADA =====
async function registerStep(employee) {
  // ⏱️ Marcar checada reciente
  recentScans.set(employee.id, Date.now());
  const now = new Date();
  const time = now.toTimeString().slice(0, 5);
  const date = now.toISOString().split('T')[0];

  try {
    const resp = await fetch('/api/data/records', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        workerId: employee.id,
        step: employee.step,
        time,
        date
      })
    });

    const result = await resp.json();
    console.log('RESPUESTA RECORDS:', resp.status, result);

    if (!resp.ok) {
      showCriticalModal('Error', 'No se pudo guardar la checada');
      return;
    }
  } catch {
    showCriticalModal('Error', 'No se pudo guardar la checada');
    return;
  }

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

  confirmTimeout = setTimeout(() => { closeConfirmation(); }, duration);
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
