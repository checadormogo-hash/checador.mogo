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