const supabaseClient = window.supabase.createClient(
  "https://akgbqsfkehqlpxtrjsnw.supabase.co",
  "sb_publishable_dXfxuXMQS__XuqmdqXnbgA_yBkRMABj"
);

let employees = [];
let employeesReady = false;
async function loadEmployees() {
  const { data, error } = await supabaseClient
    .from('workers')
    .select('id, nombre, activo, qr_token');

  if (error) {
    console.error('ERROR CARGANDO TRABAJADORES:', error);
    return;
  }

employees = data.map(w => ({
  id: String(w.id).trim(),  // 🔥
  name: w.nombre,
  activo: w.activo ? 'SI' : 'NO',
  token: w.qr_token
}));


  employeesReady = true;
}
const IS_DESKTOP_TEST = true; // ⚠️ SOLO PARA PRUEBAS

// ===== GEOLOCALIZACIÓN CONFIG =====
const STORE_LOCATION = {
  lat: 25.82105601479065,   // 👈 CAMBIA por la real
  lng: -100.08711844709858  // 👈 CAMBIA por la real
};

const ALLOWED_RADIUS_METERS = 400; // rango permitido

function calcularDistanciaMetros(lat1, lon1, lat2, lon2) {
  const R = 6371000; // radio tierra en metros
  const toRad = x => x * Math.PI / 180;

  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);

  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) *
    Math.cos(toRad(lat2)) *
    Math.sin(dLon / 2) ** 2;

  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}
async function validarUbicacionObligatoria() {

  // 🧪 BYPASS SOLO EN DESARROLLO PC
  if (IS_DESKTOP_TEST) {
    console.warn('⚠️ Geolocalización ignorada (modo pruebas en PC)');
    return true;
  }

  if (!('geolocation' in navigator)) {
    showCriticalModal(
      'Ubicación no disponible',
      'Este dispositivo no soporta geolocalización'
    );
    return false;
  }

  return new Promise(resolve => {
    navigator.geolocation.getCurrentPosition(
      position => {
        const { latitude, longitude } = position.coords;

        const distancia = calcularDistanciaMetros(
          latitude,
          longitude,
          STORE_LOCATION.lat,
          STORE_LOCATION.lng
        );

        console.log('📍 Distancia calculada:', Math.round(distancia), 'm');

        if (distancia > ALLOWED_RADIUS_METERS) {
          showCriticalModal(
            'Fuera del establecimiento',
            'Debes estar dentro del establecimiento para realizar la checada'
          );
          resolve(false);
          return;
        }

        resolve(true);
      },
      error => {
        showCriticalModal(
          'Ubicación requerida',
          'Debes permitir el acceso a tu ubicación'
        );
        resolve(false);
      }
    );
  });
}

// ===== BLOQUEO ANTI DOBLE CHECADA =====
const recentScans = new Map();
const BLOCK_TIME = 3 * 60 * 1000; // 3 minutos

const actionButtons = document.querySelectorAll('.action-btn');
const scannerInput = document.querySelector('.scanner-input');
const currentDateEl = document.getElementById('currentDate');

// ===== FECHA Y HORA =====
function getTodayISO() {
  // Fecha REAL en Monterrey sin UTC
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Monterrey',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(new Date()); // => "YYYY-MM-DD"
}
function getNowTimeMX() {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'America/Monterrey',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  }).formatToParts(new Date());

  const h = parts.find(p => p.type === 'hour')?.value ?? '00';
  const m = parts.find(p => p.type === 'minute')?.value ?? '00';
  const s = parts.find(p => p.type === 'second')?.value ?? '00';
  return `${h}:${m}:${s}`;
}


function updateDateTime() {
  const now = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Monterrey' }));

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

// ===============================
// MODAL CHECADAS PENDIENTES
// ===============================
const openOfflineModalBtn = document.getElementById('openOfflineModal');
const offlineModal = document.getElementById('offlineModal');
const closeOfflineModalBtn = document.getElementById('closeOfflineModal');

// Abrir modal
if (openOfflineModalBtn) {
  openOfflineModalBtn.addEventListener('click', () => {
    offlineModal.classList.remove('oculto');
    clearTimeout(inactivityTimer); // pausa auto modal
  });
}

// Cerrar modal con botón ✕
if (closeOfflineModalBtn) {
  closeOfflineModalBtn.addEventListener('click', () => {
    offlineModal.classList.add('oculto');
    startInactivityTimer(); // reanuda auto modal
  });
}

// Cerrar modal al hacer clic fuera del contenido
offlineModal.addEventListener('click', (e) => {
  if (e.target === offlineModal) {
    offlineModal.classList.add('oculto');
    startInactivityTimer();
  }
});

// ===== MODO MANUAL =====
actionButtons.forEach(btn => {
  const action = btn.dataset.action;
  if (!action || action === 'abrirscanner') return; // ignorar el botón de automático

  btn.addEventListener('click', () => {
    openManualModal(action);
  });
});

// Abrir modal manual con acción específica
function openManualModal(action) {
  clearTimeout(inactivityTimer); // pausa el auto-modal
  autoOverlay.style.display = 'flex';

  // Cambiar título dinámicamente
  const headerTitle = autoOverlay.querySelector('.auto-header h3');
  headerTitle.textContent = `Manual | ${formatActionTitle(action)}`;

  // Activar scanner por defecto
  switchToScannerTab();

  // Flag de acción manual actual
  autoOverlay.dataset.manualAction = action;

  setTimeout(() => {
    if (scannerInput) scannerInput.focus();
  }, 100);
}

// Formatear título bonito
function formatActionTitle(action) {
  switch (action) {
    case 'entrada': return 'Entrada';
    case 'salida-comida': return 'Salida Comida';
    case 'entrada-comida': return 'Entrada Comida';
    case 'salida': return 'Salida';
    default: return '';
  }
}

// Procesar QR en modo manual
async function processManualQR(token, action) {
  if (!employeesReady) {
    showWarningModal('Sistema iniciando', 'Espera un momento e intenta nuevamente');
    return;
  }

  const tokenNormalized = token.trim().replace(/['"]/g, '-').toLowerCase();
  const employee = employees.find(e => e.token?.trim().toLowerCase() === tokenNormalized);

  if (!employee) {
    showCriticalModal('QR no válido', 'Este código no pertenece a ningún trabajador');
    hideAutoModal();
    return;
  }

  if (employee.activo !== 'SI') {
    showCriticalModal('Acceso denegado', 'El trabajador está desactivado');
    hideAutoModal();
    return;
  }
  const workerId = String(employee.id).trim();
  if (isBlocked(workerId)) {
    showWarningModal('Checaste Recientemente', 'Espera unos minutos más para volver a checar...');
    hideAutoModal();
    return;
  }
  recentScans.set(workerId, Date.now());
  // Validar secuencia de pasos según acción manual
  const today = getTodayISO();

const { data: todayRecord } = await supabaseClient
  .from('records')
  .select('id, entrada, salida_comida, entrada_comida, salida')
  .eq('worker_id', workerId)
  .eq('fecha', today)
  .maybeSingle();


  // Validar si la acción ya fue registrada
  if (todayRecord) {
    switch (action) {
      case 'entrada':
        if (todayRecord.entrada) {
          showWarningModal('Entrada ya registrada', 'Ya habías checado entrada');
          hideAutoModal();
          return;
        }
        break;
      case 'salida-comida':
        if (todayRecord.salida_comida) {
          showWarningModal('Salida comida ya registrada', 'Ya habías checado salida comida');
          hideAutoModal();
          return;
        }
        break;
      case 'entrada-comida':
        if (todayRecord.entrada_comida) {
          showWarningModal('Entrada comida ya registrada', 'Ya habías checado entrada comida');
          hideAutoModal();
          return;
        }
        break;
      case 'salida':
        if (todayRecord.salida) {
          showWarningModal('Salida ya registrada', 'Ya habías checado salida');
          hideAutoModal();
          return;
        }
        break;
    }
  }

  // Reglas de secuencia manual
  if (action === 'salida-comida' && !todayRecord?.entrada) {
    showWarningModal('Secuencia inválida', 'No puedes registrar salida a comida antes de entrada');
    hideAutoModal();
    return;
  }
  if (action === 'entrada-comida' && !todayRecord?.salida_comida) {
    showWarningModal('Secuencia inválida', 'No puedes registrar entrada de comida antes de salir a comida');
    hideAutoModal();
    return;
  }
  if (action === 'salida' && !todayRecord?.entrada) {
    showWarningModal('Secuencia inválida', 'No puedes registrar salida antes de entrada');
    hideAutoModal();
    return;
  }

  // Registrar el paso según acción
  const saved = await registerStepManual(employee, action, todayRecord);
  if (!saved) recentScans.delete(workerId);
  if (saved) hideAutoModal();
}

// Registrar paso manual
async function registerStepManual(employee, action, todayRecord) {
  const workerId = String(employee.id).trim();
  const ubicacionValida = await validarUbicacionObligatoria();
  if (!ubicacionValida) return false;

  recentScans.set(workerId, Date.now());

  const nowTime = new Date().toLocaleTimeString('es-MX', {
    hour12: false,
    timeZone: 'America/Monterrey'
  });

  const recordData = {};

  switch (action) {
    case 'entrada':
      recordData.entrada = nowTime;
      recordData.step = 1;
      break;
    case 'salida-comida':
      recordData.salida_comida = nowTime;
      recordData.step = 2;
      break;
    case 'entrada-comida':
      recordData.entrada_comida = nowTime;
      recordData.step = 3;
      break;
    case 'salida':
      const pinValidado = await solicitarPin(employee.id, todayRecord?.id);
      if (!pinValidado) return false;

      recordData.salida = nowTime;
      recordData.step = 4;
      break;
  }

  if (!todayRecord) {
    const { error: insertError } = await supabaseClient
      .from('records')
      .insert([{ worker_id: workerId, fecha: getTodayISO(), ...recordData }]);

    if (insertError) {
      showCriticalModal('Error', 'No se pudo guardar la entrada');
      return false;
    }
  } else {
    const { error: updateError } = await supabaseClient
      .from('records')
      .update(recordData)
      .eq('id', todayRecord.id);

    if (updateError) {
      showCriticalModal('Error', 'No se pudo guardar la checada');
      return false;
    }
  }

  showSuccessModal(
    `${formatActionTitle(action)} registrada`,
    `Hola <span class="employee-name">${employee.name}</span>, ${action.includes('salida') ? '¡Hasta luego!' : 'registro exitoso'}`
  );
  return true;
}

function isBlocked(workerId) {
  const lastTime = recentScans.get(workerId);
  if (!lastTime) return false;

  const now = Date.now();
  if (now - lastTime < BLOCK_TIME) return true;

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

  if (autoOverlay.dataset.manualAction) {
    delete autoOverlay.dataset.manualAction;
  }

  const headerTitle = autoOverlay.querySelector('.auto-header h3');
  if (headerTitle) headerTitle.textContent = 'Checador Automático';

  autoTabs.forEach(tab => tab.classList.remove('active'));
  autoPanels.forEach(panel => panel.classList.remove('active'));

  const scannerTab = document.querySelector('.auto-tab[data-mode="scanner"]');
  const scannerPanel = document.getElementById('autoScanner');

  scannerTab.classList.add('active');
  scannerPanel.classList.add('active');

  if (scannerInput) scannerInput.value = '';

  setTimeout(() => {
    if (scannerInput) scannerInput.focus();
  }, 100);

  startInactivityTimer();
}

function hideAutoModal() {
  stopCameraScanner();
  autoOverlay.style.display = 'none';
  if (autoOverlay.dataset.manualAction) {
    delete autoOverlay.dataset.manualAction;
  }
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

// ===== BOTÓN MANUAL =====
const openAutoModalBtn = document.getElementById('openAutoModal');
if (openAutoModalBtn) {
  openAutoModalBtn.addEventListener('click', () => {
    showAutoModal();
    clearTimeout(inactivityTimer);
  });
}

function switchToScannerTab() {
  autoTabs.forEach(t => t.classList.remove('active'));
  autoPanels.forEach(p => p.classList.remove('active'));

  const scannerTab = document.querySelector('.auto-tab[data-mode="scanner"]');
  const scannerPanel = document.getElementById('autoScanner');

  scannerTab.classList.add('active');
  scannerPanel.classList.add('active');

  setTimeout(() => scannerInput.focus(), 100);
}

// ===== CAMBIO DE TAB CAMERA / SCANNER =====
const autoTabs = document.querySelectorAll('.auto-tab');
const autoPanels = document.querySelectorAll('.auto-panel');

autoTabs.forEach(tab => {
  tab.addEventListener('click', () => {
    if (tab.dataset.mode === 'camera') {
      startCameraScanner();
    } else {
      stopCameraScanner();
    }
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

// ===== QR POR CÁMARA =====
let html5QrCode = null;
let cameraActive = false;
let cameraInactivityTimer = null;
const CAMERA_INACTIVITY_TIME = 15000; // 15 segundos
function resetCameraInactivity() {
  clearTimeout(cameraInactivityTimer);

  cameraInactivityTimer = setTimeout(() => {
    stopCameraScanner();
    switchToScannerTab();
  }, CAMERA_INACTIVITY_TIME);
}

function startCameraScanner() {
  if (cameraActive) return;

  const cameraContainer = document.getElementById('autoCamera');

  cameraContainer.innerHTML = `
    <div id="qr-reader" style="width:100%;"></div>
    <p style="text-align:center; margin-top:10px;">
      Apunta la cámara al QR del gafete
    </p>
  `;

  html5QrCode = new Html5Qrcode("qr-reader");

  Html5Qrcode.getCameras().then(devices => {
    if (!devices || devices.length === 0) {
      showCriticalModal('Cámara no disponible', 'No se detectó ninguna cámara');
      return;
    }

    const cameraId = devices[0].id;

    html5QrCode.start(
      cameraId,
      { fps: 10, qrbox: 250 },
      (decodedText) => {
        processQR(decodedText);
        resetCameraInactivity();
      }
    );

    cameraActive = true;
  }).catch(err => {
    showCriticalModal('Error de cámara', 'No se pudo acceder a la cámara');
  });
  resetCameraInactivity();
}

function stopCameraScanner() {
  if (html5QrCode && cameraActive) {
    html5QrCode.stop().then(() => {
      html5QrCode.clear();
      cameraActive = false;
    });
  }
}

// ===== ESCANEAR QR =====
if (scannerInput) {
  scannerInput.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter') return;
    const token = scannerInput.value.trim();
    scannerInput.value = '';

    if (!token) {
      showWarningModal('QR inválido', 'Código no reconocido');
      return;
    }

    const manualAction = autoOverlay?.dataset?.manualAction || null;

    if (manualAction) {
      processManualQR(token, manualAction);
      delete autoOverlay.dataset.manualAction;
      return;
    }

    processQR(token);
  });
}

let processingQR = false; // 🔒 LOCK GLOBAL

async function processQR(token) {
  if (processingQR) return;
  processingQR = true;

  try {
    if (!employeesReady) {
      showWarningModal('Sistema iniciando', 'Espera un momento e intenta nuevamente');
      return;
    }

    const tokenNormalized = token
      .trim()
      .replace(/['"]/g, '-')
      .toLowerCase();

    const employee = employees.find(e =>
      e.token?.trim().toLowerCase() === tokenNormalized
    );

    if (!employee) {
      showCriticalModal('QR no válido', 'Este código no pertenece a ningún trabajador');
      return;
    }

    if (employee.activo !== 'SI') {
      showCriticalModal('Acceso denegado', 'El trabajador está desactivado');
      return;
    }
    const workerId = String(employee.id).trim();
    if (isBlocked(workerId)) {
      showWarningModal('Checaste recientemente', 'Espera unos minutos más para volver a checar...');
      return;
    }

    recentScans.set(workerId, Date.now());

    const saved = await registerStep(employee);

    if (!saved) {
      recentScans.delete(workerId);
    }

  } catch (err) {
    console.error('❌ Error en processQR:', err);
    showCriticalModal('Error inesperado', 'Ocurrió un problema al procesar la checada');
  } finally {
    processingQR = false;
  }
}

function showSuccessModal(title, message) {
  setConfirmStyle('#16a34a');
  showConfirmModal(title, message, 2500);
}

function hasTime(v) {
  if (v === null || v === undefined) return false;
  const s = String(v).trim();
  return s !== '' && s.toLowerCase() !== 'null' && s.toLowerCase() !== 'undefined';
}

// ===== REGISTRAR CHECADA (AUTO) =====
async function registerStep(employee) {
  const ubicacionValida = await validarUbicacionObligatoria();
  if (!ubicacionValida) return false;

  const today = getTodayISO();
  const nowTime = getNowTimeMX();

  const workerId = String(employee.id).trim(); // 🔥 FORZAMOS STRING SIEMPRE

  console.log('📅 HOY APP:', today, '⏰', nowTime, 'workerId:', workerId, 'typeof:', typeof workerId);

  // 1) Leer estado real
  const { data: todayRecord, error: readError } = await supabaseClient
  .from('records')
  .select('id, worker_id, fecha, entrada, salida_comida, entrada_comida, salida, step')
  .eq('worker_id', workerId)
  .eq('fecha', today)
  .maybeSingle();


  console.log('🧾 todayRecord leído:', todayRecord);

  if (readError) {
    console.error('❌ READ ERROR:', readError);
    showCriticalModal('Error', 'No se pudo validar la checada');
    return false;
  }


  const hasEntrada = hasTime(todayRecord?.entrada);
  const hasSalidaComida = hasTime(todayRecord?.salida_comida);
  const hasEntradaComida = hasTime(todayRecord?.entrada_comida);
  const hasSalida = hasTime(todayRecord?.salida);

  let recordData = {};
  let actionReal = null;
const step = Number(todayRecord?.step || 0);

if (!todayRecord || step === 0) {
  actionReal = 'entrada';
  recordData = { entrada: nowTime, step: 1 };
} else if (step === 1) {
  // solo avanzar si no existe salida_comida todavía
  if (hasTime(todayRecord?.salida_comida)) {
    actionReal = 'entrada-comida';
    recordData = { entrada_comida: nowTime, step: 3 };
  } else {
    actionReal = 'salida-comida';
    recordData = { salida_comida: nowTime, step: 2 };
  }
} else if (step === 2) {
  // solo avanzar si no existe entrada_comida todavía
  if (hasTime(todayRecord?.entrada_comida)) {
    actionReal = 'salida';
    recordData = { salida: nowTime, step: 4 };
  } else {
    actionReal = 'entrada-comida';
    recordData = { entrada_comida: nowTime, step: 3 };
  }
} else if (step === 3) {
  actionReal = 'salida';
  recordData = { salida: nowTime, step: 4 };
} else {
  showWarningModal('Jornada finalizada', 'Ya completaste todas las checadas del día');
  return false;
}


  console.log('➡️ ACCIÓN REAL:', actionReal, { todayRecord });
const payload = { worker_id: workerId, fecha: today, ...recordData };
  // 2) Guardar SIEMPRE con UPSERT para evitar 409
  const { error: saveError } = await supabaseClient
    .from('records')
    .upsert(payload, { onConflict: 'worker_id,fecha' });
    console.log('📦 UPSERT payload:', payload);

// ✅ Re-lee lo guardado REAL para confirmar que sí se escribió
const { data: verifyRecord, error: verifyErr } = await supabaseClient
  .from('records')
  .select('id, entrada, salida_comida, entrada_comida, salida, step')
  .eq('worker_id', workerId)
  .eq('fecha', today)
  .maybeSingle();

console.log('✅ VERIFY BD:', verifyRecord, verifyErr);

  if (saveError) {
    console.error('❌ SAVE ERROR:', saveError);
    showCriticalModal('Error', 'No se pudo guardar la checada');
    return false;
  }

  // 3) Mensaje
  switch (actionReal) {
    case 'entrada':
      showSuccessModal('Entrada registrada', `Bienvenido <span class="employee-name">${employee.name}</span>`);
      break;
    case 'salida-comida':
      showSuccessModal('Salida a comida', `Buen provecho <span class="employee-name">${employee.name}</span>`);
      break;
    case 'entrada-comida':
      showSuccessModal('Entrada de comida', `De regreso <span class="employee-name">${employee.name}</span>`);
      break;
    case 'salida':
      showSuccessModal('Salida registrada', `Hasta luego <span class="employee-name">${employee.name}</span>`);
      break;
  }

  return true;
}

// ===== MODALES =====
const confirmModal = document.getElementById('confirmModal');
const confirmTitle = document.getElementById('confirmTitle');
const confirmMessage = document.getElementById('confirmMessage');
const closeConfirmModal = document.getElementById('closeConfirmModal');
let confirmTimeout = null;

function showConfirmModal(title, message, duration = 2500) {
  confirmTitle.textContent = title;
  confirmMessage.innerHTML = message;
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

let pinModal, workerPinInput, submitPinBtn, cancelPinBtn, pinError;
document.addEventListener('DOMContentLoaded', async () => {
  await loadEmployees();
  showAutoModal();
  switchToScannerTab();

  pinModal = document.getElementById('pinModal');
  workerPinInput = document.getElementById('workerPinInput');
  submitPinBtn = document.getElementById('submitPinBtn');
  cancelPinBtn = document.getElementById('cancelPinBtn');
  pinError = document.getElementById('pinError');
});

let deferredPrompt;
const installBtn = document.getElementById('installAppBtn');

if (window.matchMedia('(display-mode: standalone)').matches) {
  installBtn.style.display = 'none';
}

window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredPrompt = e;

  if (!window.matchMedia('(display-mode: standalone)').matches) {
    installBtn.style.display = 'flex';
  }
});

installBtn.addEventListener('click', async () => {
  if (!deferredPrompt) return;

  deferredPrompt.prompt();
  await deferredPrompt.userChoice;

  deferredPrompt = null;
  installBtn.style.display = 'none';
});

async function solicitarPin(workerId, recordId) {
  if (!workerPinInput || !pinError || !pinModal) {
    console.error('El modal o los inputs del PIN no existen en el DOM');
    return false;
  }

  workerPinInput.value = '';
  pinError.style.display = 'none';
  pinModal.classList.remove('oculto');

  return new Promise(resolve => {
    submitPinBtn.onclick = async () => {
      const pin = workerPinInput.value.trim();
      if (!pin) return;

      const { data, error } = await supabaseClient
        .from('auth_pins')
        .select('id')
        .eq('worker_id', workerId)
        .eq('pin', pin)
        .eq('tipo', 'salida_temprana')
        .is('usado', false)
        .maybeSingle();

      if (error || !data) {
        pinError.style.display = 'block';
        return;
      }

      await supabaseClient
        .from('auth_pins')
        .update({ usado: true })
        .eq('id', data.id);

      pinModal.classList.add('oculto');
      resolve(true);
    };

    cancelPinBtn.onclick = () => {
      pinModal.classList.add('oculto');
      resolve(false);
    };
  });
}

const openPolicies = document.getElementById('openPolicies');
const policiesModal = document.getElementById('policiesModal');
const closePolicies = document.getElementById('closePolicies');

if (openPolicies) {
  openPolicies.addEventListener('click', () => {
    policiesModal.classList.remove('oculto');
    clearTimeout(inactivityTimer);
  });
}

if (closePolicies) {
  closePolicies.addEventListener('click', () => {
    policiesModal.classList.add('oculto');
    startInactivityTimer();
  });
}
