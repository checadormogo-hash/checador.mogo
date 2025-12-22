const actionButtons = document.querySelectorAll('.action-btn');
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
  });
});
