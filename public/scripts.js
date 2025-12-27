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
    id: w.id,
    name: w.nombre,
    activo: w.activo ? 'SI' : 'NO',
    token: w.qr_token
  }));

  employeesReady = true;
}
// ===== BLOQUEO ANTI DOBLE CHECADA =====
const recentScans = new Map();
const BLOCK_TIME = 3 * 60 * 1000; // 3 minutos


const actionButtons = document.querySelectorAll('.action-btn');
const scannerInput = document.querySelector('.scanner-input');
const currentDateEl = document.getElementById('currentDate');

// ===== FECHA Y HORA =====
function getTodayISO() {
  return new Date()
    .toLocaleDateString('en-CA', { timeZone: 'America/Monterrey' });
}
// devuelve: 2025-12-26

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

// Reutilizar processQR para modo manual
const originalProcessQR = processQR; // guardamos referencia

processQR = function(token) {
  const manualAction = autoOverlay.dataset.manualAction || null;

  if (manualAction) {
    // Override temporal del paso según acción manual
    processManualQR(token, manualAction);
    delete autoOverlay.dataset.manualAction;
    return;
  }

  // Si no es manual, sigue la lógica automática
  originalProcessQR(token);
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

  if (isBlocked(employee.id)) {
    showWarningModal('Checada reciente', 'Ya registraste una checada hace unos momentos');
    hideAutoModal();
    return;
  }

  // Validar secuencia de pasos según acción manual
  const today = getTodayISO();
  const { data: todayRecord } = await supabaseClient
    .from('records')
    .select('id, entrada, salida_comida, entrada_comida, salida')
    .eq('worker_id', employee.id)
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
  await registerStepManual(employee, action, todayRecord);

  // Cerrar modal manual al finalizar
  hideAutoModal();
}

// Registrar paso manual (reutilizando registerStep)
async function registerStepManual(employee, action, todayRecord) {
  recentScans.set(employee.id, Date.now());

  const nowTime = new Date().toLocaleTimeString('es-MX', {
    hour12: false,
    timeZone: 'America/Monterrey'
  });

  const recordData = {};

  switch (action) {
    case 'entrada':
      recordData.entrada = nowTime; break;
    case 'salida-comida':
      recordData.salida_comida = nowTime; break;
    case 'entrada-comida':
      recordData.entrada_comida = nowTime; break;
    case 'salida':
      recordData.salida = nowTime; break;
  }

  if (!todayRecord) {
    // Insertar nuevo registro si no existe
    const { error: insertError } = await supabaseClient
      .from('records')
      .insert([{ worker_id: employee.id, fecha: getTodayISO(), ...recordData }]);

    if (insertError) {
      showCriticalModal('Error', 'No se pudo guardar la entrada');
      return;
    }
  } else {
    // Actualizar registro existente
    const { error: updateError } = await supabaseClient
      .from('records')
      .update(recordData)
      .eq('id', todayRecord.id);

    if (updateError) {
      showCriticalModal('Error', 'No se pudo guardar la checada');
      return;
    }
  }

  // Mensaje de éxito
  showSuccessModal(
    `${formatActionTitle(action)} registrada`,
    `Hola <span class="employee-name">${employee.name}</span>, ${action.includes('salida') ? '¡Hasta luego!' : 'registro exitoso'}`
  );
}


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

  // Mostrar overlay
  autoOverlay.style.display = 'flex';

  // 🔹 Limpiar cualquier acción manual previa
  if (autoOverlay.dataset.manualAction) {
    delete autoOverlay.dataset.manualAction;
  }

  // 🔹 Resetear título del header al modo automático
  const headerTitle = autoOverlay.querySelector('.auto-header h3');
  if (headerTitle) headerTitle.textContent = 'Checador Automático';

  // 🔹 Forzar que sea modo automático (scanner activo)
  autoTabs.forEach(tab => tab.classList.remove('active'));
  autoPanels.forEach(panel => panel.classList.remove('active'));

  const scannerTab = document.querySelector('.auto-tab[data-mode="scanner"]');
  const scannerPanel = document.getElementById('autoScanner');

  scannerTab.classList.add('active');
  scannerPanel.classList.add('active');

  // Limpiar input del scanner
  if (scannerInput) scannerInput.value = '';
  
  // Foco en el input
  setTimeout(() => { 
    if (scannerInput) scannerInput.focus(); 
  }, 100);

  // Reiniciar temporizador
  startInactivityTimer();
}

function hideAutoModal() {
  stopCameraScanner();
  autoOverlay.style.display = 'none';
    // 🔹 Limpiar flag de acción manual al cerrar
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

  if (!employeesReady) {
    showWarningModal(
      'Sistema iniciando',
      'Espera un momento e intenta nuevamente'
    );
    return;
  }

  const tokenNormalized = token
    .trim()
    .replace(/['"]/g, '-') // scanners raros
    .toLowerCase();

  const employee = employees.find(e =>
    e.token?.trim().toLowerCase() === tokenNormalized
  );

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

  if (isBlocked(employee.id)) {
    showWarningModal(
      'Checada reciente',
      'Ya registraste una checada hace unos momentos'
    );
    return;
  }

  registerStep(employee);
}

function getStepFromRecord(record) {
  if (!record) return 0;
  if (!record.entrada) return 0;
  if (!record.salida_comida) return 1;
  if (!record.entrada_comida) return 2;
  if (!record.salida) return 3;
  return 4; // día completo
}

function showSuccessModal(title, message) {
  setConfirmStyle('#16a34a'); // 🟢 verde
  showConfirmModal(title, message, 2500);
}

// ===== REGISTRAR CHECADA =====
async function registerStep(employee) {
  recentScans.set(employee.id, Date.now());

  const today = getTodayISO();

  const nowTime = new Date().toLocaleTimeString('es-MX', {
    hour12: false,
    timeZone: 'America/Monterrey'
  });

  // 🔎 Buscar registro del día
  const { data: todayRecord, error: findError } = await supabaseClient
    .from('records')
    .select('id, entrada, salida_comida, entrada_comida, salida')
    .eq('worker_id', employee.id)
    .eq('fecha', today)
    .maybeSingle();

  if (findError && findError.code !== 'PGRST116') {
    showCriticalModal('Error', 'No se pudo validar la checada');
    return;
  }

  // 🧠 STEP REAL DESDE BD
  const step = getStepFromRecord(todayRecord);
  if (!todayRecord && step !== 0) {
    showCriticalModal(
      'Error de secuencia',
      'El registro del día no es válido'
    );
    return;
  }
  // 🛑 Día ya completo
  if (step === 4) {
    showWarningModal(
      'Jornada finalizada',
      'Ya registraste todas tus checadas del día'
    );
    return;
  }

  const recordData = {};

switch (step) {
  case 0:
    recordData.entrada = nowTime;
    recordData.step = 1;
    break;
  case 1:
    recordData.salida_comida = nowTime;
    recordData.step = 2;
    break;
  case 2:
    recordData.entrada_comida = nowTime;
    recordData.step = 3;
    break;
  case 3:
    recordData.salida = nowTime;
    recordData.step = 3; // día completo
    break;
}

  // 🆕 INSERT (solo entrada)
  if (!todayRecord) {
    const { error: insertError } = await supabaseClient
      .from('records')
      .insert([{
        worker_id: employee.id,
        fecha: today,
        ...recordData
      }]);

    if (insertError) {
      showCriticalModal('Error', 'No se pudo guardar la entrada');
      return;
    }
  } 
  // 🔁 UPDATE
  else {
    const { error: updateError } = await supabaseClient
      .from('records')
      .update(recordData)
      .eq('id', todayRecord.id);

    if (updateError) {
      showCriticalModal('Error', 'No se pudo guardar la checada');
      return;
    }
  }

  // ✅ MODALES CORRECTOS
  switch (step) {
    case 0:
      showSuccessModal(
        'Entrada registrada', `Hola <span class="employee-name">${employee.name}</span> bienvenido`
      );
      break;
    case 1:
      showSuccessModal(
        'Salida a comida', `Buen provecho <span class="employee-name">${employee.name}</span>.`
      );
      break;
    case 2:
      showSuccessModal(
        'Entrada de comida', `De regreso con toda la actitud <span class="employee-name">${employee.name}</span>`
      );
      break;
    case 3:
      showSuccessModal(
        'Salida registrada', `Gracias <span class="employee-name">${employee.name}</span> por tu esfuerzo, nos vemos pronto...`
      );
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


document.addEventListener('DOMContentLoaded', async () => {
  await loadEmployees();
  showAutoModal();
  switchToScannerTab();
});

let deferredPrompt;
const installBtn = document.getElementById('installAppBtn');

// Si ya está instalada → nunca mostrar
if (window.matchMedia('(display-mode: standalone)').matches) {
  installBtn.style.display = 'none';
}

// Detectar posibilidad de instalación
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredPrompt = e;

  // Mostrar solo si NO está instalada
  if (!window.matchMedia('(display-mode: standalone)').matches) {
    installBtn.style.display = 'flex';
  }
});

// Click instalar
installBtn.addEventListener('click', async () => {
  if (!deferredPrompt) return;

  deferredPrompt.prompt();
  await deferredPrompt.userChoice;

  deferredPrompt = null;
  installBtn.style.display = 'none';
});
