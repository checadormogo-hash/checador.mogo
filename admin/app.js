// ===== LOGIN VISUAL =====
const overlay = document.getElementById('loginOverlay');
const userInput = document.getElementById('adminUser');
const passInput = document.getElementById('adminPass');
const error = document.getElementById('loginError');

const adminApp = document.getElementById('adminApp');
const fab = document.getElementById('openAddModal');


function tryLogin() {
  if (userInput.value === 'admin' && passInput.value === '1234') {
    overlay.style.display = 'none';
    adminApp.style.display = 'block';
    fab.style.display = 'flex';
  } else {
    error.classList.add('show');
  }
}

userInput.addEventListener('keydown', e => e.key === 'Enter' && passInput.focus());
passInput.addEventListener('keydown', e => e.key === 'Enter' && tryLogin());

// ===== MODAL ALTA TRABAJADOR =====
const addModal = document.getElementById('addWorkerModal');
const openBtn = document.getElementById('openAddModal');
const closeBtn = document.getElementById('closeAddModal');

addModal.style.display = 'none';

openBtn.onclick = () => addModal.style.display = 'flex';
closeBtn.onclick = () => addModal.style.display = 'none';

const menuToggle = document.getElementById('menuToggle');
  const sideMenu = document.getElementById('sideMenu');
  const menuOverlay = document.getElementById('menuOverlay');
  const closeMenu = document.getElementById('closeMenu');

  function openMenu() {
    sideMenu.classList.add('show');
    menuOverlay.classList.add('show');
  }

  function closeMenuFn() {
    sideMenu.classList.remove('show');
    menuOverlay.classList.remove('show');
  }

  menuToggle.onclick = openMenu;
  closeMenu.onclick = closeMenuFn;
  menuOverlay.onclick = closeMenuFn;

  const saveWorkerBtn = document.getElementById('saveWorker');

saveWorkerBtn.addEventListener('click', () => {

  const worker = {
    id: 'EMP-' + Date.now(), // ID único simple (luego lo mejoramos)
    nombre: document.getElementById('workerName').value.trim(),
    pin: document.getElementById('workerPin').value.trim(),
    activo: document.getElementById('workerActive').value,
    fechaAlta: document.getElementById('fechaIngreso').value
  };

  if (!worker.nombre || !worker.pin || !worker.fechaAlta) {
    alert('Completa todos los campos');
    return;
  }

  fetch('https://script.google.com/macros/s/AKfycbymD4tbBwUPmqY0PSmy4mx0fy1osM52oVO1CfgS_cbscYsHrgAjBrzFgWjdiQyIjp57/exec', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(worker)
  });

  alert('Trabajador guardado correctamente');

  document.getElementById('addWorkerModal').classList.remove('show');
});
