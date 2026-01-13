/* ======================================================
   SUPABASE
====================================================== */
const supabaseClient = window.supabase.createClient(
  "https://akgbqsfkehqlpxtrjsnw.supabase.co",
  "sb_publishable_dXfxuXMQS__XuqmdqXnbgA_yBkRMABj"
);

/* ======================================================
   EMPLEADOS
====================================================== */
let employees = [];
let employeesReady = false;

async function loadEmployees() {
  const { data, error } = await supabaseClient
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
    token: w.qr_token?.trim().toLowerCase()
  }));

  employeesReady = true;
}

/* ======================================================
   BLOQUEO ANTI DOBLE CHECADA
====================================================== */
const recentScans = new Map();
const BLOCK_TIME = 3 * 60 * 1000;

function isBlocked(workerId) {
  const last = recentScans.get(workerId);
  if (!last) return false;

  if (Date.now() - last < BLOCK_TIME) return true;

  recentScans.delete(workerId);
  return false;
}

/* ======================================================
   FECHA Y HORA
====================================================== */
const currentDateEl = document.getElementById('currentDate');

function getTodayISO() {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'America/Monterrey' });
}

function updateDateTime() {
  const now = new Date();
  currentDateEl.textContent = now.toLocaleString('es-MX', {
    weekday: 'long',
    day: '2-digit',
    month: 'long',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true
  });
}

/* ======================================================
   MODAL AUTOMÁTICO
====================================================== */
const autoOverlay = document.getElementById('autoOverlay');
const closeAutoModal = document.getElementById('closeAutoModal');
const openAutoModalBtn = document.getElementById('openAutoModal');

let inactivityTimer = null;
const INACTIVITY_TIME = 15000;

function showAutoModal() {
  autoOverlay.style.display = 'flex';
  delete autoOverlay.dataset.manualAction;

  const h3 = autoOverlay.querySelector('.auto-header h3');
  if (h3) h3.textContent = 'Checador Automático';

  switchToScannerTab();
  startInactivityTimer();
}

function hideAutoModal() {
  stopCameraScanner();
  autoOverlay.style.display = 'none';
  delete autoOverlay.dataset.manualAction;
  startInactivityTimer();
}

function startInactivityTimer() {
  clearTimeout(inactivityTimer);
  inactivityTimer = setTimeout(showAutoModal, INACTIVITY_TIME);
}

closeAutoModal?.addEventListener('click', hideAutoModal);

openAutoModalBtn?.addEventListener('click', () => {
  showAutoModal();
  clearTimeout(inactivityTimer);
});

/* ======================================================
   MODAL CHECADAS PENDIENTES
====================================================== */
const openOfflineModalBtn = document.getElementById('openOfflineModal');
const offlineModal = document.getElementById('offlineModal');
const closeOfflineModalBtn = document.getElementById('closeOfflineModal');

openOfflineModalBtn?.addEventListener('click', () => {
  offlineModal.classList.remove('oculto');
  clearTimeout(inactivityTimer);
});

closeOfflineModalBtn?.addEventListener('click', () => {
  offlineModal.classList.add('oculto');
  startInactivityTimer();
});

offlineModal?.addEventListener('click', e => {
  if (e.target === offlineModal) {
    offlineModal.classList.add('oculto');
    startInactivityTimer();
  }
});

/* ======================================================
   MODO MANUAL
====================================================== */
const actionButtons = document.querySelectorAll('.action-btn');
const scannerInput = document.querySelector('.scanner-input');

actionButtons.forEach(btn => {
  const action = btn.dataset.action;
  if (!action || action === 'abrirscanner') return;
  btn.addEventListener('click', () => openManualModal(action));
});

function openManualModal(action) {
  clearTimeout(inactivityTimer);
  autoOverlay.style.display = 'flex';
  autoOverlay.dataset.manualAction = action;

  const h3 = autoOverlay.querySelector('.auto-header h3');
  if (h3) h3.textContent = `Manual | ${formatActionTitle(action)}`;

  switchToScannerTab();
}

function formatActionTitle(action) {
  return {
    'entrada': 'Entrada',
    'salida-comida': 'Salida Comida',
    'entrada-comida': 'Entrada Comida',
    'salida': 'Salida'
  }[action] || '';
}

/* ======================================================
   ROUTER ÚNICO DE QR (SCANNER Y CÁMARA)
====================================================== */
async function handleQR(token) {
  if (!employeesReady) return;

  const normalized = token.trim().toLowerCase();
  const employee = employees.find(e => e.token === normalized);

  if (!employee || employee.activo !== 'SI') return;
  if (isBlocked(employee.id)) return;

  const manualAction = autoOverlay.dataset.manualAction || null;

  if (manualAction) {
    await registerStepManual(employee, manualAction);
    delete autoOverlay.dataset.manualAction;
    return;
  }

  await registerStep(employee);
}

/* ======================================================
   SCANNER INPUT
====================================================== */
scannerInput?.addEventListener('change', () => {
  const token = scannerInput.value.trim();
  scannerInput.value = '';
  if (token) handleQR(token);
});

/* ======================================================
   PROCESO AUTOMÁTICO
====================================================== */
function getStepFromRecord(r) {
  if (!r) return 0;
  if (!r.entrada) return 0;
  if (!r.salida_comida) return 1;
  if (!r.entrada_comida) return 2;
  if (!r.salida) return 3;
  return 4;
}

async function registerStep(employee) {
  const today = getTodayISO();
  const now = new Date().toLocaleTimeString('es-MX', { hour12: false });

  const { data: record } = await supabaseClient
    .from('records')
    .select('*')
    .eq('worker_id', employee.id)
    .eq('fecha', today)
    .maybeSingle();

  const step = getStepFromRecord(record);
  if (step === 4) return;

  const data = {};
  if (!record) data.entrada = now;
  else if (!record.salida_comida) data.salida_comida = now;
  else if (!record.entrada_comida) data.entrada_comida = now;
  else data.salida = now;

  await supabaseClient.from('records').upsert({
    worker_id: employee.id,
    fecha: today,
    ...data
  }, { onConflict: 'worker_id,fecha' });

  recentScans.set(employee.id, Date.now());
  showAutoModal();
}

/* ======================================================
   PROCESO MANUAL
====================================================== */
async function registerStepManual(employee, action) {
  const today = getTodayISO();
  const now = new Date().toLocaleTimeString('es-MX', { hour12: false });

  const { data: record } = await supabaseClient
    .from('records')
    .select('*')
    .eq('worker_id', employee.id)
    .eq('fecha', today)
    .maybeSingle();

  const data = {};
  if (action === 'entrada') data.entrada = now;
  if (action === 'salida-comida') data.salida_comida = now;
  if (action === 'entrada-comida') data.entrada_comida = now;
  if (action === 'salida') data.salida = now;

  await supabaseClient.from('records').upsert({
    worker_id: employee.id,
    fecha: today,
    ...data
  }, { onConflict: 'worker_id,fecha' });

  recentScans.set(employee.id, Date.now());
  hideAutoModal();
}

/* ======================================================
   TABS SCANNER / CÁMARA
====================================================== */
const autoTabs = document.querySelectorAll('.auto-tab');
const autoPanels = document.querySelectorAll('.auto-panel');

function switchToScannerTab() {
  autoTabs.forEach(t => t.classList.remove('active'));
  autoPanels.forEach(p => p.classList.remove('active'));

  document.querySelector('[data-mode="scanner"]').classList.add('active');
  document.getElementById('autoScanner').classList.add('active');

  setTimeout(() => scannerInput?.focus(), 100);
}

autoTabs.forEach(tab => {
  tab.addEventListener('click', () => {
    autoTabs.forEach(t => t.classList.remove('active'));
    autoPanels.forEach(p => p.classList.remove('active'));

    tab.classList.add('active');
    document.getElementById(
      tab.dataset.mode === 'camera' ? 'autoCamera' : 'autoScanner'
    ).classList.add('active');

    tab.dataset.mode === 'camera' ? startCameraScanner() : stopCameraScanner();
  });
});

/* ======================================================
   CÁMARA QR
====================================================== */
let html5QrCode = null;
let cameraActive = false;

function startCameraScanner() {
  if (cameraActive) return;

  html5QrCode = new Html5Qrcode("qr-reader");

  Html5Qrcode.getCameras().then(devices => {
    if (!devices.length) return;

    html5QrCode.start(
      devices[0].id,
      { fps: 10, qrbox: 250 },
      decodedText => handleQR(decodedText)
    );

    cameraActive = true;
  });
}

function stopCameraScanner() {
  if (html5QrCode && cameraActive) {
    html5QrCode.stop().then(() => {
      html5QrCode.clear();
      cameraActive = false;
    });
  }
}

/* ======================================================
   INIT
====================================================== */
document.addEventListener('DOMContentLoaded', async () => {
  await loadEmployees();
  updateDateTime();
  setInterval(updateDateTime, 1000);
  showAutoModal();
});
