const supabaseClient = window.supabase.createClient(
  "https://akgbqsfkehqlpxtrjsnw.supabase.co",
  "sb_publishable_dXfxuXMQS__XuqmdqXnbgA_yBkRMABj"
);

let employees = [];
let employeesReady = false;
async function loadEmployees() {

  // ================= ONLINE =================
  if (navigator.onLine) {
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

    // 🔴 AQUÍ VA EXACTAMENTE ESTO
    //await saveWorkers(employees);

    return;
  }

  // ================= OFFLINE =================
  //const offlineWorkers = await getOfflineWorkers();

 // if (!offlineWorkers || offlineWorkers.length === 0) {
   // console.warn('No hay trabajadores guardados offline');
    //employeesReady = false;
    //return;
  //}

  //employees = offlineWorkers;
  //employeesReady = true;
//}

// ================== GEOLOCALIZACIÓN ==================
const STORE_LOCATION = {
  lat: 25.821034737584974,   // 👈 CAMBIA por tu ubicación real
  lng: -100.08712245322982, // 👈 CAMBIA por tu ubicación real
  radius: 120        // metros permitidos
};
const LOCATION_MESSAGES = {
  notSupported: {
    title: 'Ubicación no disponible',
    message: 'Este dispositivo no soporta geolocalización.'
  },
  permissionRequired: {
    title: 'Permiso de ubicación requerido',
    message: 'Para registrar asistencia es obligatorio compartir tu ubicación y estar dentro del establecimiento.'
  },
  blocked: {
    title: 'Ubicación bloqueada',
    message: 'Bloqueaste el acceso a tu ubicación. Es obligatorio permitirla para poder registrar tus checadas.'
  },
  outOfRange: {
    title: 'Fuera de zona autorizada',
    message: 'Debes encontrarte dentro del establecimiento para registrar asistencia.'
  }
};

let locationAllowed = false;
let currentCoords = null;
let locationPermissionState = 'pending';
// pending | blocked | allowed

function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371000;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) *
    Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);

  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function canProceedWithLocation() {

  // 1️⃣ El dispositivo no soporta geolocalización
  if (!navigator.geolocation) {
    showCriticalModal(
      LOCATION_MESSAGES.notSupported.title,
      LOCATION_MESSAGES.notSupported.message
    );
    return false;
  }

  // 2️⃣ Permiso nunca otorgado aún
  if (locationPermissionState === 'pending') {
    showCriticalModal(
      LOCATION_MESSAGES.permissionRequired.title,
      LOCATION_MESSAGES.permissionRequired.message
    );
    return false;
  }

  // 3️⃣ Permiso bloqueado explícitamente
  if (locationPermissionState === 'blocked') {
    showCriticalModal(
      LOCATION_MESSAGES.blocked.title,
      LOCATION_MESSAGES.blocked.message
    );
    return false;
  }

  // 4️⃣ Permiso OK, pero fuera del radio
  if (locationPermissionState === 'allowed' && !locationAllowed) {
    showCriticalModal(
      LOCATION_MESSAGES.outOfRange.title,
      LOCATION_MESSAGES.outOfRange.message
    );
    return false;
  }
  // 5️⃣ Todo correcto
  return true;
}

async function validateGeolocation() {
  return new Promise(resolve => {
    locationAllowed = false;
    currentCoords = null;

    navigator.geolocation.getCurrentPosition(
      pos => {
        locationPermissionState = 'allowed';

        const { latitude, longitude } = pos.coords;
        currentCoords = { latitude, longitude };

        const distance = calculateDistance(
          latitude,
          longitude,
          STORE_LOCATION.lat,
          STORE_LOCATION.lng
        );

        const accuracy = pos.coords.accuracy || 0;
        locationAllowed = distance <= (STORE_LOCATION.radius + accuracy);

        closeCriticalModal();
        resolve(locationAllowed);
      },
      error => {
        locationAllowed = false;

        if (error.code === error.PERMISSION_DENIED) {
          locationPermissionState = 'blocked';
          showCriticalModal(
            LOCATION_MESSAGES.blocked.title,
            LOCATION_MESSAGES.blocked.message
          );
        } else {
          locationPermissionState = 'pending';
          showCriticalModal(
            LOCATION_MESSAGES.permissionRequired.title,
            LOCATION_MESSAGES.permissionRequired.message
          );
        }

        resolve(false);
      },
      {
        enableHighAccuracy: true,
        timeout: 8000,
        maximumAge: 0
      }
    );
  });
}

function updateCriticalModal(title, message) {
  document.getElementById('criticalTitle').textContent = title;
  document.getElementById('criticalMessage').textContent = message;
}
function closeCriticalModal() {
  document.querySelector('.critical-overlay')?.remove();
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
  await validateGeolocation();

  if (!canProceedWithLocation()) return;

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

  // ⛔ SI NO HAY INTERNET → SOLO OFFLINE
if (!navigator.onLine) {

  const today = getTodayISO();
  const lastPending = await getLastPendingForWorker(employee.id, today);

  // 🧠 VALIDAR SECUENCIA OFFLINE
  if (lastPending) {
    const lastType = lastPending.tipo;

    if (action === 'entrada' && lastType === 'entrada') {
      showWarningModal('Entrada ya registrada', 'Ya habías checado entrada');
      hideAutoModal();
      return;
    }
    if (action === 'salida-comida' && lastType !== 'entrada') {
      showWarningModal('Secuencia inválida', 'Primero debes registrar entrada');
      hideAutoModal();
      return;
    }
    if (action === 'entrada-comida' && lastType !== 'salida-comida') {
      showWarningModal('Secuencia inválida', 'Primero debes salir a comida');
      hideAutoModal();
      return;
    }
    if (action === 'salida' && lastType !== 'entrada-comida') {
      showWarningModal('Secuencia inválida', 'No puedes salir aún');
      hideAutoModal();
      return;
    }
  }

  // ✅ GUARDAR OFFLINE
  await savePendingRecord({
    worker_id: employee.id,
    worker_name: employee.name,
    fecha: today,
    tipo: action,
    hora: new Date().toLocaleTimeString('es-MX', {
      hour12: false,
      timeZone: 'America/Monterrey'
    })
  });

  await updateOfflineButton();
  recentScans.set(employee.id, Date.now());

  showSuccessModal(
    `${formatActionTitle(action)} registrada (offline)`,
    `Hola <span class="employee-name">${employee.name}</span>, tu checada quedó guardada`
  );

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
  

  const nowTime = new Date().toLocaleTimeString('es-MX', {
    hour12: false,
    timeZone: 'America/Monterrey'
  });

  const recordData = {};

  switch (action) {
    case 'entrada':
      recordData.entrada = nowTime;
      break;
    case 'salida-comida':
      recordData.salida_comida = nowTime;
      break;
    case 'entrada-comida':
      recordData.entrada_comida = nowTime;
      break;
    case 'salida':
      // 🔒 Antes de registrar salida, solicitar PIN
      const pinValidado = await solicitarPin(employee.id, todayRecord?.id);
      if (!pinValidado) return; // si canceló o PIN incorrecto, salir

      recordData.salida = nowTime;
      break;
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
  recentScans.set(employee.id, Date.now());
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
      if (processingQR) return;
        stopCameraScanner(); // 👈 frena inmediatamente la cámara
        processQR(decodedText);
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
let processingQR = false;
async function processQR(token) {
  if (processingQR) return;
  processingQR = true;

  try {
    await validateGeolocation();

    if (!canProceedWithLocation()) return;

    if (!employeesReady) {
      showWarningModal(
        'Sistema iniciando',
        'Espera un momento e intenta nuevamente'
      );
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

    await registerStep(employee);

  } finally {
    processingQR = false;
  }
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

  const today = getTodayISO();

  const nowTime = new Date().toLocaleTimeString('es-MX', {
    hour12: false,
    timeZone: 'America/Monterrey'
  });

  // =================================================
  // 🔴 OFFLINE PRIMERO (NUNCA tocar Supabase aquí)
  // =================================================
  if (!navigator.onLine) {
    await savePendingRecord({
      worker_id: employee.id,
      worker_name: employee.name,
      fecha: today,
      tipo: 'auto', // o luego lo refinamos
      hora: nowTime
    });
    await renderOfflineTable();
    await updateOfflineButton();

    recentScans.set(employee.id, Date.now());

    showSuccessModal(
      'Checada registrada (offline)',
      `Hola <span class="employee-name">${employee.name}</span>, tu checada quedó guardada`
    );

    return; // ⛔ IMPORTANTE: aquí termina el flujo OFFLINE
  }

  // =================================================
  // 🟢 ONLINE (solo si HAY internet)
  // =================================================

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
      break;
    case 1:
      recordData.salida_comida = nowTime;
      break;
    case 2:
      recordData.entrada_comida = nowTime;
      break;
    case 3:
      recordData.salida = nowTime;
      break;
  }

  // 🆕 INSERT
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

  recentScans.set(employee.id, Date.now());

  // ✅ MODALES CORRECTOS ONLINE
  switch (step) {
    case 0:
      showSuccessModal(
        'Entrada registrada',
        `Hola <span class="employee-name">${employee.name}</span> bienvenido`
      );
      break;
    case 1:
      showSuccessModal(
        'Salida a comida',
        `Buen provecho <span class="employee-name">${employee.name}</span>.`
      );
      break;
    case 2:
      showSuccessModal(
        'Entrada de comida',
        `De regreso con toda la actitud <span class="employee-name">${employee.name}</span>`
      );
      break;
    case 3:
      showSuccessModal(
        'Salida registrada',
        `Gracias <span class="employee-name">${employee.name}</span> por tu esfuerzo`
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

let pinModal, workerPinInput, submitPinBtn, cancelPinBtn, pinError;
document.addEventListener('DOMContentLoaded', async () => {
  await loadEmployees();
  await validateGeolocation();
  showAutoModal();
  switchToScannerTab();

  // ✅ Asignaciones a las variables globales
  pinModal = document.getElementById('pinModal');
  workerPinInput = document.getElementById('workerPinInput');
  submitPinBtn = document.getElementById('submitPinBtn');
  cancelPinBtn = document.getElementById('cancelPinBtn');
  pinError = document.getElementById('pinError');

  const btn = document.getElementById('openOfflineModal');
  const modal = document.getElementById('offlineModal');

if (btn) {
    btn.classList.remove('oculto'); // ⬅ elimina la clase que lo oculta
    btn.style.display = 'flex';     // opcional
    btn.addEventListener('click', async () => {
      if (modal) modal.classList.remove('oculto');
    });
}

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

      // Verificamos en Supabase
      const { data, error } = await supabaseClient
        .from('auth_pins')
        .select('id')
        .eq('worker_id', workerId)
        .eq('pin', pin)
        .eq('tipo', 'salida_temprana')
        .is('usado', false)
        .limit(1)
        .maybeSingle();

      if (error || !data) {
        pinError.style.display = 'block';
        return;
      }
      if (!data) {
        pinError.style.display = 'block';
        return;
      }
      // Marcamos PIN como usado
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

if(openPolicies){
  openPolicies.addEventListener('click',()=>{
    policiesModal.classList.remove('oculto');
    clearTimeout(inactivityTimer);
  });
}

if(closePolicies){
  closePolicies.addEventListener('click',()=>{
    policiesModal.classList.add('oculto');
    startInactivityTimer();
  });
}

});