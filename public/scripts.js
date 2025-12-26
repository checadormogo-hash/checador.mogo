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
    console.error(error);
    return;
  }
  employeesReady = true;
  console.log('Trabajadores cargados:', employees);
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
    console.error('ERROR BUSCANDO RECORD:', findError);
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
      console.error('ERROR INSERT:', insertError);
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
      console.error('ERROR UPDATE:', updateError);
      showCriticalModal('Error', 'No se pudo guardar la checada');
      return;
    }
  }

  // ✅ MODALES CORRECTOS
  switch (step) {
    case 0:
      showConfirmModal('Entrada registrada', `Hola ${employee.name}`);
      break;
    case 1:
      showConfirmModal('Salida a comida', `Buen provecho ${employee.name}`);
      break;
    case 2:
      showConfirmModal('Entrada de comida', `Bienvenido ${employee.name}`);
      break;
    case 3:
      showConfirmModal('Salida registrada', `Gracias ${employee.name}`);
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


document.addEventListener('DOMContentLoaded', async () => {
  await loadEmployees();
  showAutoModal();
});
