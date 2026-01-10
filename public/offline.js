document.addEventListener("DOMContentLoaded", () => {
  const statusEl = document.getElementById("connectionStatus");

  if (!statusEl) return;

  function updateStatus() {
    if (navigator.onLine) {
      statusEl.textContent = "● En línea";
      statusEl.classList.remove("offline");
      statusEl.classList.add("online");
    } else {
      statusEl.textContent = "● Sin conexión";
      statusEl.classList.remove("online");
      statusEl.classList.add("offline");
    }
  }

  // Estado inicial
  updateStatus();

  // Detectar cambios
  window.addEventListener("online", updateStatus);
  window.addEventListener("offline", updateStatus);
});
