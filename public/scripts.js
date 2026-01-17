// ✅ COPIA Y REEMPLAZA TODO TU ARCHIVO POR ESTE
// (Fix: MANUAL ahora hace el mismo "upsert base" que AUTO para evitar falsos positivos)

const supabaseClient = window.supabase.createClient(
  "https://akgbqsfkehqlpxtrjsnw.supabase.co",
  "sb_publishable_dXfxuXMQS__XuqmdqXnbgA_yBkRMABj"
);
if (typeof window.savePendingRecord !== 'function') {
  console.error('❌ offline.js NO cargó o no expuso savePendingRecord(). Revisa el orden de scripts.');
  // opcional: modal rojo para que lo veas en pantalla
  // showCriticalModal('Error', 'offline.js no cargó. No se puede guardar sin conexión.');
}

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
    id: String(w.id).trim(),
    name: w.nombre,
    activo: w.activo ? 'SI' : 'NO',
    token: w.qr_token
  }));

  employeesReady = true;
}

const IS_DESKTOP_TEST = false; // ✅ PRUEBA REAL
const ALLOWED_RADIUS_METERS = 200; // ✅ pruebas (luego lo ajustamos)

// ===== GEOLOCALIZACIÓN CONFIG =====
const STORE_LOCATION = {
  lat: 25.82105601479065,
  lng: -100.08711844709858
};

function calcularDistanciaMetros(lat1, lon1, lat2, lon2) {
  const R = 6371000;
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

// ===== GEO HELPERS =====
async function getGeoPermissionState() {
  // Devuelve: 'granted' | 'denied' | 'prompt' | 'unknown'
  try {
    if (!navigator.permissions?.query) return 'unknown';
    const st = await navigator.permissions.query({ name: 'geolocation' });
    return st.state; // granted | denied | prompt
  } catch {
    return 'unknown';
  }
}

// Obtiene posición con alta precisión + timeout
function getCurrentPositionAsync(options = {}) {
  return new Promise((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(resolve, reject, {
      enableHighAccuracy: true,
      timeout: 12000,
      maximumAge: 0,
      ...options
    });
  });
}
async function getCoordsIfOffline(force = false) {
  // force=true => intenta obtener coords aunque navigator.onLine diga true
  if (!force && navigator.onLine) return { lat: null, lng: null };

  try {
    const pos = await getCurrentPositionAsync();
    return {
      lat: pos.coords.latitude,
      lng: pos.coords.longitude
    };
  } catch {
    return { lat: null, lng: null };
  }
}

async function validarUbicacionObligatoria({ silentIfOk = true } = {}) {
  // Evitar re-entradas (dobles llamados)
  if (GEO_CHECK_IN_PROGRESS) return false;
  GEO_CHECK_IN_PROGRESS = true;

  try {
    // 🧪 BYPASS SOLO EN PRUEBAS
    if (IS_DESKTOP_TEST) {
      console.warn('⚠️ Geolocalización ignorada (modo pruebas)');
      GEO_BOOT_OK = true;
      FORCE_BLOCK_MODAL = false;
      return true;
    }

    // 0) Si no existe geolocation
    if (!('geolocation' in navigator)) {
      FORCE_BLOCK_MODAL = true;
      setConfirmStyle('#dc2626');
      showConfirmModal(
        'Ubicación no disponible',
        'Este dispositivo no soporta geolocalización. No es posible checar.',
        9999999
      );
      return false;
    }

    // 1) Revisar permisos (si se puede)
    const permState = await getGeoPermissionState();

    if (permState === 'denied') {
      FORCE_BLOCK_MODAL = true;
      setConfirmStyle('#dc2626');
      showConfirmModal(
        'Bloqueaste acceso a Ubicación',
        'Es obligatorio compartir la ubicación para continuar.<br><br>Ve a Configuración y permite Ubicación.',
        9999999,
        `<button class="btn-retry-geo" id="btnGeoRetry">Ya desbloqueé ubicación</button>`
      );

      // enganchar el botón
      setTimeout(() => {
        const b = document.getElementById('btnGeoRetry');
        if (b) b.onclick = reintentarUbicacion;
      }, 0);

      return false;
    }

    // 2) Pedir posición (esto dispara el prompt si está en "prompt")
    let position;
    try {
      position = await getCurrentPositionAsync();
    } catch (error) {
      // ❌ Manejo de errores GPS / permisos / timeout
      FORCE_BLOCK_MODAL = true;
      setConfirmStyle('#dc2626');

      if (error && error.code === 1) {
        showConfirmModal(
          'Permisos de Ubicación',
          'Debes permitir compartir tu ubicación para poder checar.',
          9999999,
          `<button class="btn-retry-geo" id="btnGeoRetry">Ya permití ubicación</button>`
        );

        setTimeout(() => {
          const b = document.getElementById('btnGeoRetry');
          if (b) b.onclick = reintentarUbicacion;
        }, 0);

        return false;
      }

      if (error && error.code === 2) {
        showConfirmModal(
          'Ubicación desactivada',
          'Debes activar la ubicación (GPS) para continuar.',
          9999999,
          `<button class="btn-retry-geo" id="btnGeoRetry">Ya activé ubicación</button>`
        );

        setTimeout(() => {
          const b = document.getElementById('btnGeoRetry');
          if (b) b.onclick = reintentarUbicacion;
        }, 0);

        return false;
      }

      if (error && error.code === 3) {
        showConfirmModal(
          'No se pudo obtener ubicación',
          'No se detectó tu ubicación a tiempo. Asegúrate de tener GPS activado e intenta nuevamente.',
          9999999,
          `<button class="btn-retry-geo" id="btnGeoRetry">Reintentar</button>`
        );

        setTimeout(() => {
          const b = document.getElementById('btnGeoRetry');
          if (b) b.onclick = reintentarUbicacion;
        }, 0);

        return false;
      }

      showConfirmModal(
        'Ubicación requerida',
        'Debes permitir el acceso a tu ubicación para continuar.',
        9999999,
        `<button class="btn-retry-geo" id="btnGeoRetry">Ya permití ubicación</button>`
      );

      setTimeout(() => {
        const b = document.getElementById('btnGeoRetry');
        if (b) b.onclick = reintentarUbicacion;
      }, 0);

      return false;
    }

    const { latitude, longitude, accuracy } = position.coords;

    const distancia = calcularDistanciaMetros(
      latitude,
      longitude,
      STORE_LOCATION.lat,
      STORE_LOCATION.lng
    );

    console.log('📍 GPS OK:', { latitude, longitude, accuracy, distancia: Math.round(distancia) });

    // 3) Validar distancia (si está fuera => bloquea)
    if (distancia > ALLOWED_RADIUS_METERS) {
      FORCE_BLOCK_MODAL = true;
      setConfirmStyle('#dc2626');
      showConfirmModal(
        'Fuera del establecimiento',
        `Debes estar dentro del establecimiento para realizar la checada.<br><br>Distancia aproximada: <b>${Math.round(distancia)} m</b>`,
        9999999,
        `<button class="btn-retry-geo" id="btnGeoRetry">Ya estoy en el establecimiento</button>`
      );

      setTimeout(() => {
        const b = document.getElementById('btnGeoRetry');
        if (b) b.onclick = reintentarUbicacion;
      }, 0);

      return false;
    }

    // ✅ OK: ya hay GPS + permisos + dentro del rango
    GEO_BOOT_OK = true;
    FORCE_BLOCK_MODAL = false;

    // Si había modal bloqueante abierto, lo cerramos
    try {
      if (!confirmModal.classList.contains('oculto')) closeConfirmation();
    } catch {}

    // Si estás en modo "solo validar" (checadas), no muestres nada si está OK.
    // (tu UI ya muestra el éxito de checada)
    return true;

  } finally {
    GEO_CHECK_IN_PROGRESS = false;
  }
}
async function reintentarUbicacion() {
  // evita dobles clicks
  if (GEO_CHECK_IN_PROGRESS) return;

  confirmMessage.innerHTML = '';
  
  FORCE_BLOCK_MODAL = false; // permitir que el modal azul cierre solo
  setConfirmStyle('#2563eb');
  showConfirmModal('Revisando ubicación…', 'Espera un momento.', 1200);

  // vuelve a validar (si falla, validarUbicacionObligatoria pondrá FORCE_BLOCK_MODAL=true y mostrará el modal rojo)
  await validarUbicacionObligatoria({ silentIfOk: false });
}

// ===== BLOQUEO ANTI DOBLE CHECADA =====
const recentScans = new Map();
const BLOCK_TIME = 3 * 60 * 1000; // 3 minutos

const actionButtons = document.querySelectorAll('.action-btn');
const scannerInput = document.querySelector('.scanner-input');
const currentDateEl = document.getElementById('currentDate');

// ===== FECHA Y HORA =====
function getTodayISO() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Monterrey',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(new Date());
}

function getNowTimeMX() {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'America/Monterrey',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  }).formatToParts(new Date());

  const h = (parts.find(p => p.type === 'hour')?.value ?? '00').padStart(2, '0');
  const m = (parts.find(p => p.type === 'minute')?.value ?? '00').padStart(2, '0');
  const s = (parts.find(p => p.type === 'second')?.value ?? '00').padStart(2, '0');
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

if (openOfflineModalBtn) {
  openOfflineModalBtn.addEventListener('click', () => {
    offlineModal.classList.remove('oculto');
    clearTimeout(inactivityTimer);
  });
}

if (closeOfflineModalBtn) {
  closeOfflineModalBtn.addEventListener('click', () => {
    offlineModal.classList.add('oculto');
    startInactivityTimer();
  });
}

offlineModal.addEventListener('click', (e) => {
  if (e.target === offlineModal) {
    offlineModal.classList.add('oculto');
    startInactivityTimer();
  }
});

// ===== HELPERS =====
function hasTime(v) {
  if (v === null || v === undefined) return false;
  const s = String(v).trim();
  return s !== '' && s.toLowerCase() !== 'null' && s.toLowerCase() !== 'undefined';
}

function isBlocked(workerId) {
  const lastTime = recentScans.get(workerId);
  if (!lastTime) return false;

  const now = Date.now();
  if (now - lastTime < BLOCK_TIME) return true;

  recentScans.delete(workerId);
  return false;
}

// ✅ NUEVO: obtiene el registro del día con fallback "upsert base" (igual que en AUTO)
async function getOrCreateTodayRecord(workerId, today) {
  // 1) Intento de lectura normal
  const { data: rows, error: readError } = await supabaseClient
    .from('records')
    .select('id, fecha, entrada, salida_comida, entrada_comida, salida, step, created_at')
    .eq('worker_id', workerId)
    .eq('fecha', today)
    .order('created_at', { ascending: true });

if (readError) {
  if (!navigator.onLine) console.warn('⚠️ MANUAL offline: no se pudo leer records');
  else console.warn('⚠️ MANUAL readError:', readError);
}


  let todayRecord = rows?.[0] ?? null;

  // 2) Fallback: si no se ve nada, hacemos UPSERT BASE (no pisa campos)
  if (!todayRecord) {
    const basePayload = { worker_id: workerId, fecha: today };

    const { data: baseRow, error: baseErr } = await supabaseClient
      .from('records')
      .upsert(basePayload, { onConflict: 'worker_id,fecha' })
      .select('id, fecha, entrada, salida_comida, entrada_comida, salida, step, created_at')
      .maybeSingle();

    if (baseErr) {
      console.warn('⚠️ MANUAL baseErr:', baseErr);
    }

    if (baseRow) todayRecord = baseRow;
  }

  return todayRecord; // puede venir con campos null si es nuevo
}

// ===== MODO MANUAL =====
actionButtons.forEach(btn => {
  const action = btn.dataset.action;
  if (!action || action === 'abrirscanner') return;

  btn.addEventListener('click', () => {
    openManualModal(action);
  });
});

function openManualModal(action) {
  clearTimeout(inactivityTimer);
  autoOverlay.style.display = 'flex';

  const headerTitle = autoOverlay.querySelector('.auto-header h3');
  headerTitle.textContent = `Manual | ${formatActionTitle(action)}`;

  switchToScannerTab();
  autoOverlay.dataset.manualAction = action;

  setTimeout(() => {
    if (scannerInput) scannerInput.focus();
  }, 100);
}

function formatActionTitle(action) {
  switch (action) {
    case 'entrada': return 'Entrada';
    case 'salida-comida': return 'Salida Comida';
    case 'entrada-comida': return 'Entrada Comida';
    case 'salida': return 'Salida';
    default: return '';
  }
}

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

const today = getTodayISO();

// ✅ OFFLINE: el "estado del día" sale de IndexedDB (no Supabase)
let todayRecord = null;

if (!navigator.onLine) {
  if (typeof window.getLocalDayRecord === 'function') {
    todayRecord = await window.getLocalDayRecord(workerId, today);
  }
} else {
  // ✅ ONLINE: Supabase normal
  todayRecord = await getOrCreateTodayRecord(workerId, today);
}

// ✅ Si viene de IndexedDB, convertir a "formato Supabase" para reutilizar validaciones
if (todayRecord && !navigator.onLine) {
  todayRecord = {
    ...todayRecord,
    salida_comida: todayRecord.salidaComida,
    entrada_comida: todayRecord.entradaComida
  };
}


  // Validar si la acción ya fue registrada (usando hasTime para no confundir null/"")
  if (todayRecord) {
    switch (action) {
      case 'entrada':
        if (hasTime(todayRecord.entrada)) {
          showWarningModal('Entrada ya registrada', 'Ya habías checado entrada');
          hideAutoModal();
          return;
        }
        break;
      case 'salida-comida':
        if (hasTime(todayRecord.salida_comida)) {
          showWarningModal('Salida comida ya registrada', 'Ya habías checado salida comida');
          hideAutoModal();
          return;
        }
        break;
      case 'entrada-comida':
        if (hasTime(todayRecord.entrada_comida)) {
          showWarningModal('Entrada comida ya registrada', 'Ya habías checado entrada comida');
          hideAutoModal();
          return;
        }
        break;
      case 'salida':
        if (hasTime(todayRecord.salida)) {
          showWarningModal('Salida ya registrada', 'Ya habías checado salida');
          hideAutoModal();
          return;
        }
        break;
    }
  }

  // Reglas de secuencia manual (con hasTime)
  if (action === 'salida-comida' && !hasTime(todayRecord?.entrada)) {
    showWarningModal('Secuencia inválida', 'No puedes registrar salida a comida antes de entrada');
    hideAutoModal();
    return;
  }
  if (action === 'entrada-comida' && !hasTime(todayRecord?.salida_comida)) {
    showWarningModal('Secuencia inválida', 'No puedes registrar entrada de comida antes de salir a comida');
    hideAutoModal();
    return;
  }
  if (action === 'salida' && !hasTime(todayRecord?.entrada)) {
    showWarningModal('Secuencia inválida', 'No puedes registrar salida antes de entrada');
    hideAutoModal();
    return;
  }

  const saved = await registerStepManual(employee, action, todayRecord);
  if (!saved) recentScans.delete(workerId);
  if (saved) hideAutoModal();
}

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
    case 'salida': {
      const yaPasoPorComida =
        hasTime(todayRecord?.entrada) &&
        hasTime(todayRecord?.salida_comida) &&
        hasTime(todayRecord?.entrada_comida);

      const salidaTemprana =
        hasTime(todayRecord?.entrada) &&
        !hasTime(todayRecord?.salida_comida) &&
        !hasTime(todayRecord?.entrada_comida);

      if (salidaTemprana) {
        const pinValidado = await solicitarPin(employee.id, todayRecord?.id, employee.name);
        if (!pinValidado) return false;
      }

      recordData.salida = nowTime;
      recordData.step = 4;
      break;
    }
  }

  // ===============================
// ✅ OFFLINE: no tocar Supabase, guardar solo en IndexedDB + coords
// ===============================
if (!navigator.onLine) {
  try {
    const coords = await getCoordsIfOffline();
    if (typeof window.savePendingRecord === 'function') {
      await window.savePendingRecord({
        worker_id: workerId,
        worker_name: employee.name,
        fecha: getTodayISO(),
        tipo: action,
        hora: nowTime,
        lat: coords.lat,
        lng: coords.lng
      });
    }
  } catch (e) {
    console.error('Error guardando offline:', e);
    showCriticalModal('Error', 'No se pudo guardar la checada en modo sin conexión');
    return false;
  }

  showSuccessModal(
    `${formatActionTitle(action)} registrada`,
    `Hola <span class="employee-name">${employee.name}</span>, registro guardado <b>sin conexión</b>.`
  );

  return true;
}

// ===============================
// ✅ ONLINE: continúa normal (Supabase) y cachea sin coords
// ===============================

  // ✅ Guardado seguro: UPDATE por ID si existe, si no existe hacemos INSERT
  if (todayRecord?.id) {
    const { error: updateError } = await supabaseClient
      .from('records')
      .update(recordData)
      .eq('id', todayRecord.id);

    if (updateError) {
      showCriticalModal('Error', 'No se pudo guardar la checada');
      return false;
    }
  } else {
    const { error: insertError } = await supabaseClient
      .from('records')
      .insert([{ worker_id: workerId, fecha: getTodayISO(), ...recordData }]);

    if (insertError) {
      showCriticalModal('Error', 'No se pudo guardar la checada');
      return false;
    }
  }

  showSuccessModal(
    `${formatActionTitle(action)} registrada`,
    `Hola <span class="employee-name">${employee.name}</span>, ${action.includes('salida') ? '¡Hasta luego!' : 'registro exitoso'}`
  );

// ✅ Cache local del día (online) SIN coords
try {
  if (typeof window.savePendingRecord === 'function') {
    await window.savePendingRecord({
      worker_id: workerId,
      worker_name: employee.name,
      fecha: getTodayISO(),
      tipo: action,
      hora: nowTime,
      lat: null,
      lng: null
    });
  }
} catch (e) {
  console.warn('No se pudo cachear en IndexedDB (manual online):', e);
}

  return true;
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
}window.showAutoModal = showAutoModal;

function hideAutoModal() {
  stopCameraScanner();
  autoOverlay.style.display = 'none';
  if (autoOverlay.dataset.manualAction) {
    delete autoOverlay.dataset.manualAction;
  }
  startInactivityTimer();
}window.hideAutoModal = hideAutoModal;

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

// ===== BOTÓN MANUAL (abre el modal automático) =====
const openAutoModalBtn = document.getElementById('openAutoModal');
if (openAutoModalBtn) {
  openAutoModalBtn.addEventListener('click', () => {
    showAutoModal();
    clearTimeout(inactivityTimer);
  });
}

function switchToScannerTab() {
  if (!autoTabs || !autoPanels) return;

  autoTabs.forEach(t => t.classList.remove('active'));
  autoPanels.forEach(p => p.classList.remove('active'));

  const scannerTab = document.querySelector('.auto-tab[data-mode="scanner"]');
  const scannerPanel = document.getElementById('autoScanner');

  if (scannerTab) scannerTab.classList.add('active');
  if (scannerPanel) scannerPanel.classList.add('active');

  setTimeout(() => scannerInput?.focus(), 100);
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
const CAMERA_INACTIVITY_TIME = 15000;

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

// ===== ESCANEAR QR (scanner input) =====
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

// ===== REGISTRAR CHECADA (AUTO) =====
async function registerStep(employee) {
  const ubicacionValida = await validarUbicacionObligatoria();
  if (!ubicacionValida) return false;

  const today = getTodayISO();
  const nowTime = getNowTimeMX();
  const workerId = String(employee.id).trim();

  console.log('📅 HOY APP:', today, '⏰', nowTime, 'workerId:', workerId);

  // 🧪 TEST SELECT (para saber si RLS sigue bloqueando lecturas)
  const { data: testRow, error: testErr } = await supabaseClient
    .from('records')
    .select('id, worker_id, fecha')
    .limit(1);

  console.log('🧪 TEST SELECT records:', testRow, testErr);

  // 1) Intento de lectura normal del registro del día
  const { data: rows, error: readError } = await supabaseClient
    .from('records')
    .select('id, fecha, entrada, salida_comida, entrada_comida, salida, step, created_at')
    .eq('worker_id', workerId)
    .eq('fecha', today)
    .order('created_at', { ascending: true });

  if (readError) {
    console.error('❌ READ ERROR:', readError);
  }

  let todayRecord = rows?.[0] ?? null;

  console.log('🧾 rows:', rows);
  console.log('🧾 todayRecord usado (pre-fallback):', todayRecord);

  // 2) Fallback: UPSERT BASE
  if (!todayRecord) {
    const basePayload = { worker_id: workerId, fecha: today };

    const { data: baseRow, error: baseErr } = await supabaseClient
      .from('records')
      .upsert(basePayload, { onConflict: 'worker_id,fecha' })
      .select('id, fecha, entrada, salida_comida, entrada_comida, salida, step, created_at')
      .maybeSingle();

    console.log('🧱 baseRow (fallback):', baseRow, baseErr);

    if (baseRow) todayRecord = baseRow;
  }

  console.log('🧾 todayRecord final:', todayRecord);

  const hasEntrada = hasTime(todayRecord?.entrada);
  const hasSalidaComida = hasTime(todayRecord?.salida_comida);
  const hasEntradaComida = hasTime(todayRecord?.entrada_comida);
  const hasSalida = hasTime(todayRecord?.salida);

  let actionReal = null;
  let recordData = {};

  if (!hasEntrada) {
    actionReal = 'entrada';
    recordData = { entrada: nowTime, step: 1 };
  } else if (!hasSalidaComida) {
    actionReal = 'salida-comida';
    recordData = { salida_comida: nowTime, step: 2 };
  } else if (!hasEntradaComida) {
    actionReal = 'entrada-comida';
    recordData = { entrada_comida: nowTime, step: 3 };
  } else if (!hasSalida) {
    actionReal = 'salida';
    recordData = { salida: nowTime, step: 4 };
  } else {
    showWarningModal('Jornada finalizada', 'Ya completaste todas las checadas del día');
    return false;
  }

  console.log('➡️ ACCIÓN REAL:', actionReal, { todayRecord, recordData });

  let saveError = null;

  if (todayRecord?.id) {
    const { error } = await supabaseClient
      .from('records')
      .update(recordData)
      .eq('id', todayRecord.id);
    saveError = error;
  } else {
    const payload = { worker_id: workerId, fecha: today, ...recordData };
    const { error } = await supabaseClient
      .from('records')
      .upsert(payload, { onConflict: 'worker_id,fecha' });
    saveError = error;
  }

if (saveError) {
  console.error('❌ SAVE ERROR (Supabase):', saveError);

  // ✅ Guardar OFFLINE en IndexedDB con coords (evidencia)
  try {
    if (typeof window.savePendingRecord === 'function') {
      const coords = await getCoordsIfOffline(true);
      await window.savePendingRecord({
        worker_id: workerId,
        worker_name: employee.name,
        fecha: today,
        tipo: actionReal,
        hora: nowTime,
        lat: coords.lat,
        lng: coords.lng
      });
    }

    // ✅ Mostrar éxito OFFLINE y NO tratar como error
    switch (actionReal) {
      case 'entrada':
        showSuccessModal('Entrada registrada', `Guardado <b>sin conexión</b> · <span class="employee-name">${employee.name}</span>`);
        break;
      case 'salida-comida':
        showSuccessModal('Salida a comida', `Guardado <b>sin conexión</b> · <span class="employee-name">${employee.name}</span>`);
        break;
      case 'entrada-comida':
        showSuccessModal('Entrada de comida', `Guardado <b>sin conexión</b> · <span class="employee-name">${employee.name}</span>`);
        break;
      case 'salida':
        showSuccessModal('Salida registrada', `Guardado <b>sin conexión</b> · <span class="employee-name">${employee.name}</span>`);
        break;
    }

    return true; // 🔥 IMPORTANTE: ya quedó guardado local
  } catch (e) {
    console.error('❌ También falló IndexedDB:', e);
    showCriticalModal('Error', 'No se pudo guardar la checada (ni online ni offline)');
    return false;
  }
}



// ✅ Cache local del día (ONLINE) SIN coords (solo si Supabase guardó bien)
try {
  if (typeof window.savePendingRecord === 'function') {
    await window.savePendingRecord({
      worker_id: workerId,
      worker_name: employee.name,
      fecha: today,
      tipo: actionReal,
      hora: nowTime,
      lat: null,
      lng: null
    });
  }
} catch (e) {
  console.warn('No se pudo cachear en IndexedDB (auto online):', e);
}


  const { data: verifyRows, error: verifyErr } = await supabaseClient
    .from('records')
    .select('id, fecha, entrada, salida_comida, entrada_comida, salida, step, created_at')
    .eq('worker_id', workerId)
    .eq('fecha', today)
    .order('created_at', { ascending: true });

  console.log('✅ VERIFY rows:', verifyRows, verifyErr);

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

function getTomorrowISO(todayISO) {
  const [y, m, d] = todayISO.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + 1);
  const yyyy = dt.getUTCFullYear();
  const mm = String(dt.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(dt.getUTCDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

let FORCE_BLOCK_MODAL = false;
let GEO_BOOT_OK = false;
let GEO_CHECK_IN_PROGRESS = false;

// ===== MODALES =====
const confirmModal = document.getElementById('confirmModal');
const confirmTitle = document.getElementById('confirmTitle');
const confirmMessage = document.getElementById('confirmMessage');
const closeConfirmModal = document.getElementById('closeConfirmModal');
let confirmTimeout = null;

function showConfirmModal(title, message, duration = 2500, actionBtnHtml = '') {
  confirmTitle.textContent = title;

  // ✅ Si mandamos botón, lo añadimos debajo del mensaje
  confirmMessage.innerHTML = `
    <div>${message}</div>
    ${actionBtnHtml ? `<div style="margin-top:14px;">${actionBtnHtml}</div>` : ''}
  `;
  confirmModal.classList.remove('oculto');

  clearTimeout(confirmTimeout);

  // 🔒 Si es bloqueante, NO autocierra
  if (FORCE_BLOCK_MODAL) return;

  confirmTimeout = setTimeout(() => { closeConfirmation(); }, duration);
}

function closeConfirmation() {
  clearTimeout(confirmTimeout);
  confirmModal.classList.add('oculto');

  // ✅ IMPORTANTE: NO forzar el autoOverlay si no existe o si aún no se inicializa
  try {
    if (autoOverlay) showAutoModal();
  } catch {}
}

closeConfirmModal.addEventListener('click', () => {
  if (FORCE_BLOCK_MODAL) return; // 🔒 si es modal obligatorio, no deja cerrar
  closeConfirmation();
});


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

  // ✅ Ubicación obligatoria al entrar/cargar (UNA SOLA VEZ)
  setTimeout(async () => {
    FORCE_BLOCK_MODAL = false;
    setConfirmStyle('#2563eb');
    showConfirmModal('Validando ubicación…', 'Por favor espera un momento.', 1200);

    await validarUbicacionObligatoria({ silentIfOk: false });
  }, 300);

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

async function solicitarPin(workerId, recordId, employeeName = '') {
  if (!workerPinInput || !pinError || !pinModal) {
    console.error('El modal o los inputs del PIN no existen en el DOM');
    return false;
  }

  // helper: mostrar error + limpiar + focus
  const showPinError = (msg) => {
    pinError.textContent = msg;
    pinError.style.display = 'block';
    workerPinInput.value = '';
    setTimeout(() => workerPinInput.focus(), 50);
  };

  // helper: modal bloqueante con solo Aceptar
  const showBlockedPinModal = (name) => {
    const nombre = (name || '').trim() || 'Colaborador';
    showCriticalModal(
      'Intentos agotados',
      `Lo siento <span class="employee-name">${nombre}</span>, has agotado tus intentos para salida temprano.<br>Solicita un nuevo PIN con el administrador.`
    );

    // 🔒 Bloquear cierre automático y cualquier cierre extra
    clearTimeout(confirmTimeout);

    // Asegurar que SOLO cierre con el botón "X" si existe (lo ideal: ocultarlo en CSS)
    // Aquí forzamos: al cerrar, reabrimos auto modal
    closeConfirmModal.onclick = () => {
      closeConfirmation();
      showAutoModal();
    };
  };

  // reset UI del pin
  workerPinInput.value = '';
  pinError.style.display = 'none';
  pinError.textContent = '';
  pinModal.classList.remove('oculto');

  let busy = false;

  return new Promise(resolve => {
    submitPinBtn.onclick = async () => {
      if (busy) return;
      busy = true;

      try {
        const pinIngresado = workerPinInput.value.trim();
        if (!pinIngresado) {
          busy = false;
          return;
        }

        // 1) buscar el PIN activo del trabajador (no usado)
        const { data: pinRow, error: pinErr } = await supabaseClient
          .from('auth_pins')
          .select('id, pin, usado, intentos, max_intentos')
          .eq('worker_id', workerId)
          .eq('tipo', 'salida_temprana')
          .is('usado', false)
          .order('creado_en', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (pinErr) {
          console.error('Error leyendo auth_pins:', pinErr);
          showPinError('No se pudo validar el PIN. Intenta de nuevo.');
          busy = false;
          return;
        }

        if (!pinRow) {
          showPinError('No hay un PIN activo. Solicita uno al administrador.');
          busy = false;
          return;
        }

        const intentos = Number(pinRow.intentos ?? 0);
        const max = Number(pinRow.max_intentos ?? 3);

        // 2) comparar
        const correcto = String(pinRow.pin) === String(pinIngresado);

        if (!correcto) {
          // 3) sumar intento
          const newIntentos = intentos + 1;
          const restantes = Math.max(0, max - newIntentos);

          const { error: upErr } = await supabaseClient
            .from('auth_pins')
            .update({ intentos: newIntentos })
            .eq('id', pinRow.id);

          if (upErr) {
            console.error('Error actualizando intentos:', upErr);
            showPinError('PIN incorrecto (no se pudo actualizar intentos).');
            busy = false;
            return;
          }

          // 4) si se agotó
          if (newIntentos >= max) {
            // opcional: marcar como usado para que ya no se intente
            await supabaseClient
              .from('auth_pins')
              .update({ usado: true, usado_en: new Date().toISOString() })
              .eq('id', pinRow.id);

            // cerrar modal de pin
            pinModal.classList.add('oculto');

            // mostrar modal bloqueante personalizado
            showBlockedPinModal(employeeName);

            // al aceptar, tu closeConfirmation ya hace showAutoModal()
            // (por tu código actual)
            resolve(false);
            busy = false;
            return;
          }

          showPinError(`PIN incorrecto | Te quedan ${restantes} intento(s)`);
          busy = false;
          return;
        }

        // 5) correcto: marcar usado
        const { error: useErr } = await supabaseClient
          .from('auth_pins')
          .update({ usado: true, usado_en: new Date().toISOString() })
          .eq('id', pinRow.id);

        if (useErr) {
          console.error('Error marcando usado:', useErr);
          showPinError('PIN válido, pero no se pudo confirmar. Intenta de nuevo.');
          busy = false;
          return;
        }

        pinModal.classList.add('oculto');
        resolve(true);
        busy = false;

      } catch (e) {
        console.error('Error en solicitarPin:', e);
        showPinError('Ocurrió un error. Intenta de nuevo.');
        busy = false;
      }
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