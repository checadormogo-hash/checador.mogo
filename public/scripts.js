/*************************************************
 * SUPABASE
 *************************************************/
const supabaseClient = window.supabase.createClient(
  "https://akgbqsfkehqlpxtrjsnw.supabase.co",
  "sb_publishable_dXfxuXMQS__XuqmdqXnbgA_yBkRMABj"
);

/*************************************************
 * EMPLEADOS
 *************************************************/
let employees = [];
let employeesReady = false;

async function loadEmployees() {
  const { data, error } = await supabaseClient
    .from('workers')
    .select('id, nombre, activo, qr_token');

  if (error) return;

  employees = data.map(w => ({
    id: w.id,
    name: w.nombre,
    activo: w.activo ? 'SI' : 'NO',
    token: w.qr_token
  }));

  employeesReady = true;
}

/*************************************************
 * GEOLOCALIZACIÓN
 *************************************************/
const IS_DESKTOP_TEST = true;

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

async function validarUbicacionObligatoria() {
  if (IS_DESKTOP_TEST) return true;

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
          showCriticalModal('Fuera del establecimiento','Debes estar dentro del establecimiento');
          resolve(false);
          return;
        }
        resolve(true);
      },
      () => {
        showCriticalModal('Ubicación requerida','Debes permitir ubicación');
        resolve(false);
      }
    );
  });
}

/*************************************************
 * FECHA / HORA
 *************************************************/
function getTodayISO() {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'America/Monterrey' });
}

/*************************************************
 * BLOQUEO ANTI DOBLE CHECADA
 *************************************************/
const recentScans = new Map();
const BLOCK_TIME = 3 * 60 * 1000;

function isBlocked(workerId) {
  const last = recentScans.get(workerId);
  if (!last) return false;
  if (Date.now() - last < BLOCK_TIME) return true;
  recentScans.delete(workerId);
  return false;
}

/*************************************************
 * ELEMENTOS DOM
 *************************************************/
const scannerInput = document.querySelector('.scanner-input');
const actionButtons = document.querySelectorAll('.action-btn');

/*************************************************
 * MODO MANUAL
 *************************************************/
actionButtons.forEach(btn => {
  const action = btn.dataset.action;
  if (!action || action === 'abrirscanner') return;

  btn.addEventListener('click', () => openManualModal(action));
});

function openManualModal(action) {
  clearTimeout(inactivityTimer);
  autoOverlay.style.display = 'flex';

  const title = autoOverlay.querySelector('.auto-header h3');
  title.textContent = `Manual | ${formatActionTitle(action)}`;

  autoOverlay.dataset.manualAction = action;
  switchToScannerTab();

  setTimeout(() => scannerInput?.focus(), 100);
}

function formatActionTitle(action) {
  return {
    'entrada': 'Entrada',
    'salida-comida': 'Salida Comida',
    'entrada-comida': 'Entrada Comida',
    'salida': 'Salida'
  }[action] || '';
}

/*************************************************
 * ESCANEO INPUT
 *************************************************/
if (scannerInput) {
  scannerInput.addEventListener('change', () => {
    const token = scannerInput.value.trim();
    scannerInput.value = '';
    if (!token) return;

    const manualAction = autoOverlay.dataset.manualAction || null;

    if (manualAction) {
      processManualQR(token, manualAction);
      delete autoOverlay.dataset.manualAction;
      return;
    }

    processQR(token);
  });
}

/*************************************************
 * PROCESAR QR AUTOMÁTICO
 *************************************************/
async function processQR(token) {
  if (!employeesReady) return;

  const employee = employees.find(e =>
    e.token?.trim().toLowerCase() === token.toLowerCase()
  );

  if (!employee || employee.activo !== 'SI') {
    showCriticalModal('QR inválido','Acceso denegado');
    return;
  }

  if (isBlocked(employee.id)) {
    showWarningModal('Checada reciente','Espera unos minutos');
    return;
  }

  const saved = await registerStep(employee);
  if (!saved) return;

  recentScans.set(employee.id, Date.now());
}

/*************************************************
 * REGISTRO AUTOMÁTICO
 *************************************************/
function getStepFromRecord(r) {
  if (!r) return 0;
  if (!r.entrada) return 0;
  if (!r.salida_comida) return 1;
  if (!r.entrada_comida) return 2;
  if (!r.salida) return 3;
  return 4;
}

async function registerStep(employee) {
  if (!(await validarUbicacionObligatoria())) return false;

  const today = getTodayISO();
  const now = new Date().toLocaleTimeString('es-MX',{hour12:false,timeZone:'America/Monterrey'});

  const { data: record } = await supabaseClient
    .from('records')
    .select('id, entrada, salida_comida, entrada_comida, salida')
    .eq('worker_id', employee.id)
    .eq('fecha', today)
    .maybeSingle();

  const step = getStepFromRecord(record);
  if (step === 4) {
    showWarningModal('Jornada finalizada','Ya completaste el día');
    return false;
  }

  const data = { worker_id: employee.id, fecha: today };
  let title = '', msg = '';

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
    .upsert(data,{ onConflict:'worker_id,fecha' });

  if (error) {
    showCriticalModal('Error','No se pudo guardar');
    return false;
  }

  showSuccessModal(title,msg);
  return true;
}

/*************************************************
 * PROCESAR QR MANUAL
 *************************************************/
async function processManualQR(token, action) {
  if (!employeesReady) return;

  const employee = employees.find(e =>
    e.token?.trim().toLowerCase() === token.toLowerCase()
  );

  if (!employee || employee.activo !== 'SI') {
    showCriticalModal('QR inválido','Acceso denegado');
    hideAutoModal();
    return;
  }

  if (isBlocked(employee.id)) {
    showWarningModal('Checada reciente','Espera unos minutos');
    hideAutoModal();
    return;
  }

  const today = getTodayISO();
  const { data: record } = await supabaseClient
    .from('records')
    .select('*')
    .eq('worker_id', employee.id)
    .eq('fecha', today)
    .maybeSingle();

  const saved = await registerStepManual(employee, action, record);
  if (saved) {
    recentScans.set(employee.id, Date.now());
    hideAutoModal();
  }
}

async function registerStepManual(employee, action, record) {
  if (!(await validarUbicacionObligatoria())) return false;

  const now = new Date().toLocaleTimeString('es-MX',{hour12:false,timeZone:'America/Monterrey'});
  const data = {};

  if (action === 'entrada' && record?.entrada) return false;
  if (action === 'salida-comida' && !record?.entrada) return false;
  if (action === 'entrada-comida' && !record?.salida_comida) return false;
  if (action === 'salida' && !record?.entrada) return false;

  if (action === 'entrada') data.entrada = now;
  if (action === 'salida-comida') data.salida_comida = now;
  if (action === 'entrada-comida') data.entrada_comida = now;
  if (action === 'salida') data.salida = now;

  const { error } = await supabaseClient
    .from('records')
    .upsert({
      worker_id: employee.id,
      fecha: getTodayISO(),
      ...data
    },{ onConflict:'worker_id,fecha' });

  if (error) {
    showCriticalModal('Error','No se pudo guardar');
    return false;
  }

  showSuccessModal(
    `${formatActionTitle(action)} registrada`,
    `Hola <span class="employee-name">${employee.name}</span>`
  );
  return true;
}

/*************************************************
 * MODALES (SIN CAMBIOS)
 *************************************************/
const autoOverlay = document.getElementById('autoOverlay');
const closeAutoModal = document.getElementById('closeAutoModal');
let inactivityTimer = null;
const INACTIVITY_TIME = 15000;

function showAutoModal() {
  clearTimeout(inactivityTimer);
  autoOverlay.style.display = 'flex';

  delete autoOverlay.dataset.manualAction;
  autoOverlay.querySelector('.auto-header h3').textContent = 'Registro automático';

  switchToScannerTab();
  startInactivityTimer();
}

function hideAutoModal() {
  autoOverlay.style.display = 'none';
  delete autoOverlay.dataset.manualAction;
  startInactivityTimer();
}

function startInactivityTimer() {
  clearTimeout(inactivityTimer);
  inactivityTimer = setTimeout(showAutoModal, INACTIVITY_TIME);
}

closeAutoModal.addEventListener('click', hideAutoModal);

/*************************************************
 * CONFIRMACIÓN
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

function showWarningModal(t,m){ setConfirmStyle('#d97706'); showConfirmModal(t,m); }
function showCriticalModal(t,m){ setConfirmStyle('#dc2626'); showConfirmModal(t,m,3000); }
function showSuccessModal(t,m){ setConfirmStyle('#16a34a'); showConfirmModal(t,m); }

function setConfirmStyle(color){
  const box = document.querySelector('.confirm-box');
  if (box) box.style.background = color;
}

/*************************************************
 * INIT
 *************************************************/
document.addEventListener('DOMContentLoaded', async () => {
  await loadEmployees();
  showAutoModal();
});
