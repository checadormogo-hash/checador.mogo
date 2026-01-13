/* ======================================================
   SUPABASE
====================================================== */
const supabaseClient = window.supabase.createClient(
  "https://akgbqsfkehqlpxtrjsnw.supabase.co",
  "sb_publishable_dXfxuXMQS__XuqmdqXnbgA_yBkRMABj"
);

/* ======================================================
   ESTADO ONLINE / OFFLINE
====================================================== */
function isOnline() {
  return navigator.onLine === true;
}

window.addEventListener('online', () => {
  console.log('🟢 Conectado a internet');
});

window.addEventListener('offline', () => {
  console.log('🔴 Sin conexión a internet');
});

/* ======================================================
   GEOLOCALIZACIÓN (SOLO VALIDAR)
====================================================== */
let geoAllowed = false;

function checkGeolocation() {
  if (!navigator.geolocation) return;

  navigator.geolocation.getCurrentPosition(
    () => {
      geoAllowed = true;
      console.log('📍 Geolocalización permitida');
    },
    () => {
      geoAllowed = false;
      console.warn('📍 Geolocalización denegada');
    }
  );
}

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
    activo: w.activo,
    token: w.qr_token?.trim().toLowerCase()
  }));

  employeesReady = true;
}

/* ======================================================
   BLO BLOQUEO ANTI DOBLE CHECADA
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
  return new Date().toLocaleDateString('en-CA', {
    timeZone: 'America/Monterrey'
  });
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
  autoOverlay.querySelector('.auto-header h3').textContent = 'Checador Automático';
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
openAutoModalBtn?.addEventListener('click', showAutoModal);

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
  autoOverlay.querySelector('.auto-header h3').textContent =
    `Manual | ${formatActionTitle(action)}`;
  switchToScannerTab();
}

function formatActionTitle(action) {
  return {
    'entrada': 'Entrada',
    'salida-comida': 'Salida Comida',
    'entrada-comida': 'Entrada Comida',
    'salida': 'Salida'
  }[action];
}

/* ======================================================
   ROUTER ÚNICO QR
====================================================== */
async function handleQR(token) {
  if (!employeesReady) return;

  const normalized = token.trim().toLowerCase();
  const employee = employees.find(e => e.token === normalized);

  if (!employee) return;
  if (!employee.activo) return;
  if (isBlocked(employee.id)) return;

  // OFFLINE
  if (!isOnline()) {
    console.warn('📴 OFFLINE → guardar en IndexedDB (pendiente)');
    return;
  }

  // ONLINE
  if (!geoAllowed) {
    console.warn('📍 Sin geolocalización permitida');
    return;
  }

  const manualAction = autoOverlay.dataset.manualAction || null;

  if (manualAction) {
    await registerStepManual(employee, manualAction);
    delete autoOverlay.dataset.manualAction;
  } else {
    await registerStep(employee);
  }
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

  const data = {
    worker_id: employee.id,
    fecha: today
  };

  if (action === 'entrada') data.entrada = now;
  if (action === 'salida-comida') data.salida_comida = now;
  if (action === 'entrada-comida') data.entrada_comida = now;
  if (action === 'salida') data.salida = now;

  await supabaseClient.from('records').upsert(data, {
    onConflict: 'worker_id,fecha'
  });

  recentScans.set(employee.id, Date.now());
  hideAutoModal();
}

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
      decoded => handleQR(decoded)
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
  checkGeolocation();
  await loadEmployees();
  updateDateTime();
  setInterval(updateDateTime, 1000);
  showAutoModal();
});
