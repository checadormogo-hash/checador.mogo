const actionButtons = document.querySelectorAll('.action-btn');
const scannerInput = document.querySelector('.scanner-input');
const currentDateEl = document.getElementById('currentDate');

// ===== DATOS DE PRUEBA (luego van a backend) =====
const employees = [
  {
    id: "EMP-1766349467706",
    name: "José Francisco",
    pin: "8592",
    step: 0
  }
];

/*const pinInput = document.getElementById('pinInput');
const pinError = document.getElementById('pinError');
const pinOverlay = document.getElementById('pinOverlay');


/* ===============================
   PIN (solo estructura por ahora)
================================ 
pinInput.addEventListener('input', () => {
  pinError.classList.remove('show');

  if (pinInput.value.length === 4) {
    // Simulación temporal
    setTimeout(() => {
      pinError.classList.add('show');
      pinInput.value = '';
      pinInput.focus();
    }, 300);
  }
});*/

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

  // Capitalizar primera letra
  const formattedDate =
    date.charAt(0).toUpperCase() + date.slice(1);

  currentDateEl.textContent = `${formattedDate} · ${time}`;
}


/* ===============================
   BOTONES (estructura)
================================ */
actionButtons.forEach(btn => {
  btn.addEventListener('click', () => {
    const action = btn.dataset.action;
    console.log('Acción presionada:', action);
    // Aquí irá la lógica real después
  });
});

/* ===============================
   UTILIDADES (para después)
================================ */
// pinOverlay.style.display = 'none';
/* ================== MODAL AUTOMÁTICO ================== */
const autoOverlay = document.getElementById('autoOverlay');
const closeAutoModal = document.getElementById('closeAutoModal');

let inactivityTimer = null;
const INACTIVITY_TIME = 15000; // 15 segundos

/* ===== MOSTRAR MODAL ===== */
function showAutoModal() {
  clearTimeout(inactivityTimer);
  autoOverlay.style.display = 'flex';

  // Si el modo activo es SCANNER → enfocar input
  const activeTab = document.querySelector('.auto-tab.active');
  if (activeTab && activeTab.dataset.mode === 'scanner') {
    setTimeout(() => {
      const scannerInput = document.querySelector('.scanner-input');
      if (scannerInput) scannerInput.focus();
    }, 100);
  }
}

/* ===== OCULTAR MODAL ===== */
function hideAutoModal() {
  autoOverlay.style.display = 'none';
  startInactivityTimer();
}

/* ===== CONTADOR DE INACTIVIDAD ===== */
function startInactivityTimer() {
  clearTimeout(inactivityTimer);

  inactivityTimer = setTimeout(() => {
    showAutoModal();
  }, INACTIVITY_TIME);
}

/* ===== BOTÓN CERRAR ===== */
closeAutoModal.addEventListener('click', hideAutoModal);

/* ===== DETECTAR ACTIVIDAD EN PANTALLA ===== */
['click', 'touchstart', 'keydown'].forEach(evt => {
  document.addEventListener(evt, () => {
    if (autoOverlay.style.display === 'none') {
      startInactivityTimer();
    }
  });
});

/* ===== MOSTRAR AL CARGAR ===== */
window.addEventListener('load', () => {
  showAutoModal();
});

/* ===== BOTÓN REGISTRO AUTOMÁTICO ===== */
const openAutoModalBtn = document.getElementById('openAutoModal');

openAutoModalBtn.addEventListener('click', () => {
  showAutoModal();        // abre el modal
  clearTimeout(inactivityTimer); // detiene contador
});

/* ===== CAMBIO DE MODO CÁMARA / SCANNER ===== */
const autoTabs = document.querySelectorAll('.auto-tab');
const autoPanels = document.querySelectorAll('.auto-panel');

autoTabs.forEach(tab => {
  tab.addEventListener('click', () => {
    // quitar activos
    autoTabs.forEach(t => t.classList.remove('active'));
    autoPanels.forEach(p => p.classList.remove('active'));

    // activar seleccionado
    tab.classList.add('active');
    document
      .getElementById(
        tab.dataset.mode === 'camera' ? 'autoCamera' : 'autoScanner'
      )
      .classList.add('active');
    
      // foco automático en scanner
      if (tab.dataset.mode === 'scanner') {
        setTimeout(() => {
        scannerInput.focus();
        }, 100);
      }      
  });
});

scannerInput.addEventListener('change', () => {
  const value = scannerInput.value.trim();
  scannerInput.value = "";

  if (!value.includes('|')) {
    showWarningModal('QR inválido', 'Formato incorrecto');
    return;
  }

  processQR(value);
});

function processQR(qrValue) {
  const [empId, pin] = qrValue.split('|');

  if (!empId || !pin) {
    showWarningModal('QR inválido', 'Formato incorrecto');
    return;
  }

  const employee = employees.find(e => e.id === empId);

  if (!employee) {
    showCriticalModal(
      'Usuario no registrado',
      'El colaborador no existe en el sistema'
    );
    return;
  }

  if (employee.pin !== pin) {
    showWarningModal(
      'Datos incorrectos',
      'Usuario o PIN incorrecto'
    );
    return;
  }

  registerStep(employee);
}
function registerStep(employee) {
  switch (employee.step) {
    case 0:
      showConfirmModal(
        'Entrada registrada',
        `Hola ${employee.name}, bienvenido. Gracias por asistir.`
      );
      employee.step = 1;
      break;

    case 1:
      showConfirmModal(
        'Salida a comida',
        `Buen provecho ${employee.name}, anhelamos tu regreso.`
      );
      employee.step = 2;
      break;

    case 2:
      showConfirmModal(
        'Entrada de comida',
        `Bienvenido nuevamente ${employee.name}.`
      );
      employee.step = 3;
      break;

    case 3:
      showConfirmModal(
        'Salida registrada',
        `Gracias por todo tu esfuerzo ${employee.name}, descansa.`
      );
      employee.step = 0;
      break;
  }
}


const confirmModal = document.getElementById('confirmModal');
const confirmTitle = document.getElementById('confirmTitle');
const confirmMessage = document.getElementById('confirmMessage');
const closeConfirmModal = document.getElementById('closeConfirmModal');

let confirmTimeout = null;

// ABRIR MODAL CONFIRMACION
function showConfirmModal(title, message, duration = 2500) {
  confirmTitle.textContent = title;
  confirmMessage.textContent = message;

  confirmModal.classList.remove('oculto');

  confirmTimeout = setTimeout(() => {
    closeConfirmation();
  }, duration);
}

// CERRAR CONFIRMACION
function closeConfirmation() {
  clearTimeout(confirmTimeout);
  confirmModal.classList.add('oculto');

  // REGRESAR AL MODAL DE ESCANEO
  openAutoModal(); // 🔥 función que YA EXISTE en tu sistema
}

// BOTON X
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

updateDateTime();
setInterval(updateDateTime, 1000);