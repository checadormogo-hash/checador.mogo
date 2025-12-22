/*const pinInput = document.getElementById('pinInput');
const pinError = document.getElementById('pinError');
const pinOverlay = document.getElementById('pinOverlay');
const actionButtons = document.querySelectorAll('.action-btn');

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
const INACTIVITY_TIME = 30000; // 30 segundos

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
