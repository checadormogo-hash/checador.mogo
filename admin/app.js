// ===== LOGIN VISUAL =====
const overlay = document.getElementById('loginOverlay');
const userInput = document.getElementById('adminUser');
const passInput = document.getElementById('adminPass');
const error = document.getElementById('loginError');

const adminApp = document.getElementById('adminApp');
const fab = document.getElementById('openAddModal');

const pinInput = document.getElementById('workerPin');

pinInput.addEventListener('input', () => {
  pinInput.value = pinInput.value
    .replace(/\D/g, '') // quita todo lo que no sea número
    .slice(0, 4);       // máximo 4 dígitos
});

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
  if (!worker.nombre || worker.pin.length !== 4 || !worker.fechaAlta) {
  alert('El PIN debe tener exactamente 4 dígitos');
  return;
  }

  fetch('https://script.google.com/macros/s/AKfycbwU4Q07LUsPkXgL4HxdfEp5jzPkqj8qiVONnmUM5lB1Z2oJN9LOaVUdVROifo-fTsEg/exec', {
  method: 'POST',
  body: JSON.stringify(worker)
})
.then(res => res.json())
.then(data => {
  if (data.status === 'ok') {
    alert('Trabajador guardado correctamente');
    addModal.style.display = 'none';
  } else {
    alert('Error al guardar');
  }
})
.catch(err => {
  console.error(err);
  alert('Error de conexión con el servidor');
});

  document.getElementById('addWorkerModal').classList.remove('show');
});



const workersModal = document.getElementById('workersModal');
const openWorkersBtn = document.getElementById('menuWorkers');
const closeWorkersModal = document.getElementById('closeWorkersModal');
const workersTableBody = document.getElementById('workersTableBody');

openWorkersBtn.onclick = () => {
  closeMenuFn(); // cerramos menú hamburguesa
  workersModal.style.display = 'flex';
  loadWorkers();
};

closeWorkersModal.onclick = () => {
  workersModal.style.display = 'none';
};

function loadWorkers() {
  fetch('https://script.google.com/macros/s/AKfycbxm2zzRoqaE209KzJdBdfF9Urch4C76wAHm7wPPlUdS0J5Q-hOhMRoQgolQU4VXMEd8/exec')
    .then(res => res.json())
    .then(data => {
      workersTableBody.innerHTML = '';

      data.forEach(worker => {
        const tr = document.createElement('tr');

        tr.innerHTML = `
          <td>${worker.id}</td>
          <td>${worker.nombre}</td>
          <td>${worker.pin}</td>
          <td>${worker.activo}</td>
          <td>${worker.fechaAlta}</td>
          <td class="actions">
            <button class="btn-icon btn-edit" onclick="editWorker('${worker.id}')">
              <i class="fa-solid fa-pen"></i>
            </button>
            <button class="btn-icon btn-delete" onclick="deleteWorker('${worker.id}')">
              <i class="fa-solid fa-trash"></i>
            </button>
          </td>
        `;

        workersTableBody.appendChild(tr);
      });
    });
}

function deleteWorker(id) {
  if (!confirm('¿Eliminar trabajador definitivamente?')) return;

  fetch(`https://script.google.com/macros/s/AKfycbxm2zzRoqaE209KzJdBdfF9Urch4C76wAHm7wPPlUdS0J5Q-hOhMRoQgolQU4VXMEd8/exec?delete=${id}`)
    .then(res => res.json())
    .then(() => loadWorkers());
}

