/*************************************************
 * 1. SUPABASE
 *************************************************/
const supabaseClient = window.supabase.createClient(
  "https://akgbqsfkehqlpxtrjsnw.supabase.co",
  "sb_publishable_dXfxuXMQS__XuqmdqXnbgA_yBkRMABj"
);

/*************************************************
 * 2. GEOLOCALIZACIÓN (OBLIGATORIA)
 *************************************************/
const STORE_LOCATION = {
  lat: 25.82105601479065,
  lng: -100.08711844709858
};
const ALLOWED_RADIUS_METERS = 400;

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

async function validarUbicacion() {
  if (!('geolocation' in navigator)) {
    showCriticalModal(
      'Ubicación no disponible',
      'Este dispositivo no soporta geolocalización'
    );
    return false;
  }

  return new Promise(resolve => {
    navigator.geolocation.getCurrentPosition(
      pos => {
        const d = calcularDistanciaMetros(
          pos.coords.latitude,
          pos.coords.longitude,
          STORE_LOCATION.lat,
          STORE_LOCATION.lng
        );

        if (d > ALLOWED_RADIUS_METERS) {
          showCriticalModal(
            'Fuera del establecimiento',
            'Debes estar dentro del establecimiento para checar'
          );
          resolve(false);
          return;
        }
        resolve(true);
      },
      () => {
        showCriticalModal(
          'Ubicación requerida',
          'Debes permitir el acceso a tu ubicación'
        );
        resolve(false);
      }
    );
  });
}

/*************************************************
 * 3. FECHA / HORA
 *************************************************/
function getTodayISO() {
  return new Date()
    .toLocaleDateString('en-CA', { timeZone: 'America/Monterrey' });
}

function getNowTime() {
  return new Date().toLocaleTimeString('es-MX', {
    hour12: false,
    timeZone: 'America/Monterrey'
  });
}

/*************************************************
 * 4. EMPLEADOS
 *************************************************/
let employees = [];
let employeesReady = false;

async function loadEmployees() {
  const { data } = await supabaseClient
    .from('workers')
    .select('id, nombre, activo, qr_token');

  employees = (data || []).map(w => ({
    id: w.id,
    name: w.nombre,
    activo: w.activo ? 'SI' : 'NO',
    token: w.qr_token
  }));

  employeesReady = true;
}

/*************************************************
 * 5. BLOQUEO ANTI DOBLE SCAN
 *************************************************/
const recentScans = new Map();
const BLOCK_TIME = 3 * 60 * 1000;

function isBlocked(id) {
  const t = recentScans.get(id);
  if (!t) return false;
  if (Date.now() - t < BLOCK_TIME) return true;
  recentScans.delete(id);
  return false;
}

/*************************************************
 * 6. SCANNER INPUT
 *************************************************/
const scannerInput = document.querySelector('.scanner-input');

if (scannerInput) {
  scannerInput.addEventListener('change', () => {
    const token = scannerInput.value.trim();
    scannerInput.value = '';
    if (token) processQR(token);
  });
}

/*************************************************
 * 7. PROCESAR QR (AUTOMÁTICO)
 *************************************************/
async function processQR(token) {
  if (!employeesReady) {
    showWarningModal('Sistema iniciando', 'Espera un momento');
    return;
  }

  const employee = employees.find(e =>
    e.token?.trim().toLowerCase() === token.trim().toLowerCase()
  );

  if (!employee) {
    showCriticalModal('QR no válido', 'No pertenece a ningún trabajador');
    return;
  }

  if (employee.activo !== 'SI') {
    showCriticalModal('Acceso denegado', 'Trabajador desactivado');
    return;
  }

  if (isBlocked(employee.id)) {
    showWarningModal(
      'Checada reciente',
      'Espera unos minutos para volver a checar'
    );
    return;
  }

  const ubicacionOK = await validarUbicacion();
  if (!ubicacionOK) return;

  const saved = await registerAutomatic(employee);
  if (saved) recentScans.set(employee.id, Date.now());
}

/*************************************************
 * 8. LÓGICA AUTOMÁTICA (CLAVE)
 *************************************************/
function getStepFromRecord(r) {
  if (!r) return 0;
  if (!r.entrada) return 0;
  if (!r.salida_comida) return 1;
  if (!r.entrada_comida) return 2;
  if (!r.salida) return 3;
  return 4;
}

async function registerAutomatic(employee) {
  const today = getTodayISO();
  const now = getNowTime();

  const { data: record } = await supabaseClient
    .from('records')
    .select('id, entrada, salida_comida, entrada_comida, salida')
    .eq('worker_id', employee.id)
    .eq('fecha', today)
    .maybeSingle();

  const step = getStepFromRecord(record);
  if (step === 4) {
    showWarningModal(
      'Jornada finalizada',
      'Ya completaste tus checadas del día'
    );
    return false;
  }

  const data = {
    worker_id: employee.id,
    fecha: today
  };

  let title = '';
  let msg = '';

  if (step === 0) {
    data.entrada = now;
    title = 'Entrada registrada';
    msg = `Hola <span class="employee-name">${employee.name}</span> bienvenido`;
  } else if (step === 1) {
    data.salida_comida = now;
    title = 'Salida a comida';
    msg = `Buen provecho <span class="employee-name">${employee.name}</span>`;
  } else if (step === 2) {
    data.entrada_comida = now;
    title = 'Entrada de comida';
    msg = `De regreso <span class="employee-name">${employee.name}</span>`;
  } else if (step === 3) {
    data.salida = now;
    title = 'Salida registrada';
    msg = `Gracias <span class="employee-name">${employee.name}</span>`;
  }

  const { error } = await supabaseClient
    .from('records')
    .upsert(data, { onConflict: 'worker_id,fecha' });

  if (error) {
    showCriticalModal('Error', 'No se pudo guardar la checada');
    return false;
  }

  showSuccessModal(title, msg);
  return true;
}

/*************************************************
 * 9. MODALES (SIN CAMBIOS)
 *************************************************/
const confirmModal = document.getElementById('confirmModal');
const confirmTitle = document.getElementById('confirmTitle');
const confirmMessage = document.getElementById('confirmMessage');
const closeConfirmModal = document.getElementById('closeConfirmModal');
let confirmTimeout = null;

function showConfirmModal(title, message, duration = 2500) {
  confirmTitle.textContent = title;
  confirmMessage.innerHTML = message;
  confirmModal.classList.remove('oculto');
  confirmTimeout = setTimeout(closeConfirmation, duration);
}

function closeConfirmation() {
  clearTimeout(confirmTimeout);
  confirmModal.classList.add('oculto');
  showAutoModal();
}

closeConfirmModal.addEventListener('click', closeConfirmation);

function showWarningModal(t, m) {
  setConfirmStyle('#d97706');
  showConfirmModal(t, m);
}

function showCriticalModal(t, m) {
  setConfirmStyle('#dc2626');
  showConfirmModal(t, m, 3000);
}

function showSuccessModal(t, m) {
  setConfirmStyle('#16a34a');
  showConfirmModal(t, m);
}

function setConfirmStyle(color) {
  const box = document.querySelector('.confirm-box');
  if (box) box.style.background = color;
}

/*************************************************
 * 10. AUTO MODAL POR INACTIVIDAD
 *************************************************/
const autoOverlay = document.getElementById('autoOverlay');
const closeAutoModal = document.getElementById('closeAutoModal');
let inactivityTimer = null;
const INACTIVITY_TIME = 15000;

function showAutoModal() {
  clearTimeout(inactivityTimer);
  autoOverlay.style.display = 'flex';
  if (scannerInput) setTimeout(() => scannerInput.focus(), 100);
  startInactivityTimer();
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

['click', 'keydown', 'touchstart'].forEach(e => {
  document.addEventListener(e, () => {
    if (autoOverlay.style.display === 'none') startInactivityTimer();
  });
});

/*************************************************
 * 11. INIT
 *************************************************/
document.addEventListener('DOMContentLoaded', async () => {
  await loadEmployees();
  showAutoModal();
});
