// ===== BLOQUEO ANTI DOBLE CHECADA =====
const recentScans = new Map();
const BLOCK_TIME = 3 * 60 * 1000; // 3 minutos


const actionButtons = document.querySelectorAll('.action-btn');
const scannerInput = document.querySelector('.scanner-input');
const currentDateEl = document.getElementById('currentDate');

let employees = [];

// ===== CARGAR TRABAJADORES =====
async function loadEmployees() {
  if (typeof supabase === 'undefined') {
    console.error('Supabase no está definido aún');
    return;
  }
  const { data, error } = await supabase
    .from('workers')
    .select('id, nombre, activo, qr_token');
  if (error) {
    console.error(error);
    return;
  }
  employees = data.map(w => ({
    id: w.id,
    name: w.nombre,
    activo: w.activo ? 'SI' : 'NO',
    token: w.qr_token,
    step: 0
  }));
}

function getLocalDateDMY() {
  const d = new Date();
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  return `${day}-${month}-${year}`;
}
function time12hMX() {
  return new Date().toLocaleTimeString('es-MX', {
    timeZone: 'America/Monterrey', // 👈 CLAVE
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  });
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
document.addEventListener('DOMContentLoaded', async () => {
  if (typeof supabase === 'undefined') {
    console.error('Supabase aún no está definido');
    return;
  }
  await loadEmployees();
  showAutoModal();
});

// ===== BOTÓN MANUAL =====
const openAutoModalBtn = document.getElementById('openAutoModal');
if (openAutoModalBtn) {
  openAutoModalBtn.addEventListener('click', () => {
    showAutoModal();
    clearTimeout(inactivityTimer);
  });
}

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
if (scannerInput) {
  scannerInput.addEventListener('change', () => {
    const token = scannerInput.value.trim();
    scannerInput.value = '';

    if (!token) {
      showWarningModal('QR inválido', 'Código no reconocido');
      return;
    }

    processQR(token);
  });
}

function processQR(token) {

  const employee = employees.find(e => e.token === token);

  if (!employee) {
    showCriticalModal(
      'QR no válido',
      'Este código no pertenece a ningún trabajador'
    );
    return;
  }

  if (employee.activo !== 'SI') {
    showCriticalModal(
      'Acceso denegado',
      'El trabajador está desactivado'
    );
    return;
  }

  // 🚫 bloqueo anti doble checada
  if (isBlocked(employee.id)) {
    showWarningModal(
      'Checada reciente',
      'Ya registraste una checada hace unos momentos'
    );
    return;
  }

  registerStep(employee);
}
// ===== REGISTRAR CHECADA =====
async function registerStep(employee) {
  recentScans.set(employee.id, Date.now());

  try {
    await supabase
      .from('records')
      .insert([{
        worker_id: employee.id,
        step: employee.step
      }]);
  } catch {
    showCriticalModal('Error', 'No se pudo guardar la checada');
    return;
  }

  // 👇 tu switch EXISTENTE
  switch (employee.step) {
    case 0:
      showConfirmModal('Entrada registrada', `Hola ${employee.name}`);
      employee.step = 1;
      break;
    case 1:
      showConfirmModal('Salida a comida', `Buen provecho ${employee.name}`);
      employee.step = 2;
      break;
    case 2:
      showConfirmModal('Entrada de comida', `Bienvenido ${employee.name}`);
      employee.step = 3;
      break;
    case 3:
      showConfirmModal('Salida registrada', `Gracias ${employee.name}`);
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
