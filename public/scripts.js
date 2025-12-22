const pinInput = document.getElementById('pinInput');
const pinError = document.getElementById('pinError');
const pinOverlay = document.getElementById('pinOverlay');
const actionButtons = document.querySelectorAll('.action-btn');

/* ===============================
   PIN (solo estructura por ahora)
================================ */
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
});

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
