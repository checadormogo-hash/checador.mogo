// =====================================================
// OFFLINE.JS (baseline actual + ajustes planeados)
// - Cache diario en IndexedDB (siempre)
// - Lat/Lng SOLO cuando NO hay internet (evidencia)
// - Tabla pendientes + Distancia aprox
// - UI botones manuales según conexión
// - Control del modal automático sin tocar scripts.js
// =====================================================

// ===== ESTADO ONLINE / OFFLINE (texto en header) =====
document.addEventListener("DOMContentLoaded", () => {
  const statusEl = document.getElementById("connectionStatus");

  function updateStatus() {
    if (!statusEl) return;

    if (navigator.onLine) {
      statusEl.textContent = "● En línea";
      statusEl.classList.add("online");
      statusEl.classList.remove("offline");
    } else {
      statusEl.textContent = "● Sin conexión";
      statusEl.classList.add("offline");
      statusEl.classList.remove("online");
    }
  }

  updateStatus();
  window.addEventListener("online", updateStatus);
  window.addEventListener("offline", updateStatus);
});
async function updateOfflineBadge() {
  const el = document.getElementById("offlineBadge");
  if (!el) return;

  let all = [];
  try { all = await getOfflineCheckins(); } catch {}

  // contar pendientes reales (incluye pin pendiente o cualquier _offlineFields)
  const groups = new Map();
  all.forEach(r => {
    const key = `${String(r.worker_id)}__${String(r.fecha)}`;
    if (!groups.has(key)) groups.set(key, r);
  });

  let count = 0;
  for (const r of groups.values()) {
    const pending = r?._offlineFields && Object.keys(r._offlineFields).length > 0;
    const pinPending = r?.salida_pin_required && r?._offlineFields?.salida && !r?.salida_pin_lock;
    if (pending || pinPending) count++;
  }

  el.textContent = String(count);
  if (count > 0) el.classList.remove("oculto");
  else el.classList.add("oculto");
}
window.updateOfflineBadge = updateOfflineBadge;

// ===== CONFIG PARA DISTANCIA (solo visual) =====
// Reusar STORE_LOCATION de scripts.js si existe (evita redeclare)
const STORE_LOCATION_OFFLINE =
  (window.STORE_LOCATION && typeof window.STORE_LOCATION.lat === "number")
    ? window.STORE_LOCATION
    : { lat: 25.82105601479065, lng: -100.08711844709858 };

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

function getDistanciaAprox(row) {
  const lat = Number(row?.lat);
  const lng = Number(row?.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  const d = calcularDistanciaMetros(lat, lng, STORE_LOCATION_OFFLINE.lat, STORE_LOCATION_OFFLINE.lng);
  return Math.round(d);
}

// ===== INDEXED DB OFFLINE =====
const DB_NAME = "checador_offline_db";
const DB_VERSION = 1;
const STORE_NAME = "checadas_pendientes";

function openDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: "id", autoIncrement: true });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

// ===== LEEMOS CHECADAS ALMACENADAS =====
async function getOfflineCheckins() {
  const db = await openDB();

  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readonly");
    const store = tx.objectStore(STORE_NAME);
    const request = store.getAll();

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}
// ===== OBTENER REGISTRO LOCAL DEL DIA (por worker_id + fecha) =====
async function getLocalDayRecord(workerId, fecha) {
  const all = await getOfflineCheckins();
  return all.find(r =>
    String(r.worker_id) === String(workerId) &&
    String(r.fecha) === String(fecha)
  ) || null;
}
window.getLocalDayRecord = getLocalDayRecord;

// ===== PINTAMOS DATOS EN LA TABLA O MENSAJE VACIO =====
async function renderOfflineTable() {
  const wrap = document.getElementById("offlineCardsWrap");
  if (!wrap) return;

  wrap.innerHTML = "";

  let data = [];
  try {
    data = await getOfflineCheckins();
  } catch (err) {
    console.error("Error leyendo IndexedDB", err);
  }

  // 🚫 No hay datos
  if (!data.length) {
    wrap.innerHTML = `
      <div class="offline-empty">
        No hay checadas pendientes almacenadas
      </div>
    `;
    return;
  }

  // ✅ Agrupar por trabajador + fecha (porque tu llave lógica es worker_id + fecha)
  const groups = new Map();
  data.forEach(row => {
    const key = `${String(row.worker_id)}__${String(row.fecha)}`;
    if (!groups.has(key)) groups.set(key, row);
  });

  // ✅ Creamos una sola fila contenedora (colspan=10) para meter tarjetas
wrap.insertAdjacentHTML("beforeend", `
  <div class="status-legend">
    <span class="status-chip"><span class="dot pending"></span> Pendiente: guardado local, falta enviar</span>
    <span class="status-chip"><span class="dot synced"></span> Sincronizado: ya enviado</span>
    <span class="status-chip"><span class="dot error"></span> Error: no se pudo enviar</span>
    <button id="btnSyncNow" class="sync-btn" style="margin-left:auto;">Sincronizar</button>
  </div>
  <div class="offline-cards"></div>
`);

const cardsWrap = wrap.querySelector(".offline-cards");

const syncBtn = wrap.querySelector("#btnSyncNow");
if (syncBtn) {
  syncBtn.disabled = !navigator.onLine;
  syncBtn.style.opacity = navigator.onLine ? "1" : "0.5";
  syncBtn.style.pointerEvents = navigator.onLine ? "auto" : "none";
}

  // Helpers
  const safe = (v) => (v === null || v === undefined || String(v).trim() === "" ? "—" : v);

  function getOverallStatus(row) {
    const hasPending = row?._offlineFields && Object.keys(row._offlineFields).length > 0;
    const hasSynced = row?._syncedFields && Object.keys(row._syncedFields).length > 0;
    const pinPending = row?.salida_pin_required && row?._offlineFields?.salida && !row?.salida_pin_lock;
    if (pinPending) return { key: "pending", label: "Pendiente (PIN)" };

    // preparado para futuro (sync con errores)
    const hasError =
      String(row?.estado || "").toLowerCase() === "error" ||
      (row?._syncErrors && Object.keys(row._syncErrors).length > 0);


    if (hasError) return { key: "error", label: "Error" };
    if (hasPending) return { key: "pending", label: "Pendiente" };
    if (hasSynced) return { key: "synced", label: "Sincronizado" };
    return { key: "pending", label: "Pendiente" };
  }

  function cellClass(row, field) {
    // field esperado: entrada | salidaComida | entradaComida | salida
    if (row?._syncErrors?.[field]) return "offline-error";     // 🔴 error
    if (row?._offlineFields?.[field]) return "offline-pending"; // 🟠 pendiente
    if (row?._syncedFields?.[field]) return "offline-synced";   // 🔵 sincronizado
    return "";
  }
  // ✅ Pintar tarjetas
  Array.from(groups.values()).forEach(row => {
    const st = getOverallStatus(row);

    const card = document.createElement("div");
    card.className = "offline-card";

    card.innerHTML = `
      <div class="offline-card-header">
        <div class="offline-card-title">
          Empleado: <b>${safe(row.nombre)}</b> · Fecha: <b>${safe(row.fecha)}</b> · Estado:
          <span class="estado-text ${st.key}">${st.label}</span>
        </div>
      </div>

      <div class="offline-grid">
        <div class="offline-col ${cellClass(row,'entrada')}">
          <div class="offline-col-title">Entrada</div>
          <div class="offline-col-time">${safe(row.entrada)}</div>
          <div class="offline-col-sub">Lat: ${safe(row.entrada_lat)}</div>
          <div class="offline-col-sub">Lng: ${safe(row.entrada_lng)}</div>
        </div>

        <div class="offline-col ${cellClass(row,'salidaComida')}">
          <div class="offline-col-title">Salida comida</div>
          <div class="offline-col-time">${safe(row.salidaComida)}</div>
          <div class="offline-col-sub">Lat: ${safe(row.salidaComida_lat)}</div>
          <div class="offline-col-sub">Lng: ${safe(row.salidaComida_lng)}</div>
        </div>

        <div class="offline-col ${cellClass(row,'entradaComida')}">
          <div class="offline-col-title">Entrada comida</div>
          <div class="offline-col-time">${safe(row.entradaComida)}</div>
          <div class="offline-col-sub">Lat: ${safe(row.entradaComida_lat)}</div>
          <div class="offline-col-sub">Lng: ${safe(row.entradaComida_lng)}</div>
        </div>

        <div class="offline-col ${cellClass(row,'salida')}">
          <div class="offline-col-title">Salida</div>
          <div class="offline-col-time">${safe(row.salida)}</div>
          <div class="offline-col-sub">Lat: ${safe(row.salida_lat)}</div>
          <div class="offline-col-sub">Lng: ${safe(row.salida_lng)}</div>
        </div>
      </div>
      ${
        (row?.salida_pin_required && row?._offlineFields?.salida && !row?.salida_pin_lock)
          ? `<div style="margin-top:10px; display:flex; gap:10px; align-items:center;">
              <button class="retry-pin-btn"
                      data-worker="${row.worker_id}"
                      data-fecha="${row.fecha}"
                      ${!navigator.onLine ? 'disabled style="opacity:.5;pointer-events:none;"' : ''}>
                Reintentar PIN (${Math.max(0, (row.salida_pin_max ?? 3) - (row.salida_pin_intentos ?? 0))} intentos)
              </button>
              <div class="pin-reason" style="opacity:.85;">
                ${row.salida_pin_reason ? `Motivo: ${row.salida_pin_reason}` : ''}
              </div>
            </div>`
          : ''
      }
    `;

    cardsWrap.appendChild(card);
  });
}

// ===== GUARDAR O ACTUALIZAR CHECADAS =====
// data esperado (desde scripts.js):
// {
//   worker_id, worker_name, fecha,
//   tipo: 'entrada' | 'salida-comida' | 'entrada-comida' | 'salida',
//   hora: 'HH:mm:ss',
//   lat, lng,
//   // opcional:
//   // forceCoords: true (si quieres forzar guardar coords aunque haya online)
// }
async function savePendingRecord(data) {
  const db = await openDB();

  // Regla: guardar coords SOLO si fue offline (o si se fuerza)
  const shouldSaveCoords = (!navigator.onLine) || (data?.forceCoords === true);

  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);

    const request = store.getAll();

    request.onsuccess = () => {
      const records = request.result || [];

      // Buscar por worker_id + fecha (llave lógica)
      let record = records.find(r =>
        String(r.worker_id) === String(data.worker_id) &&
        String(r.fecha) === String(data.fecha)
      ) || null;

      const isNew = !record;

      if (!record) {
        record = {
          worker_id: data.worker_id,
          nombre: data.worker_name,
          fecha: data.fecha,
          entrada: null,
          salidaComida: null,
          entradaComida: null,
          salida: null,
          // PIN salida temprana (solo offline)
          salida_pin: null,            // pin capturado (string)
          salida_pin_intentos: 0,      // intentos usados localmente
          salida_pin_max: 3,           // max intentos
          salida_pin_required: false,  // true si la salida offline fue temprana y requiere validación
          salida_pin_lock: false,      // true si ya NO se debe reintentar (no hay pin o intentos agotados)
          salida_pin_reason: null,     // texto para UI (ej. "PIN incorrecto", "No existe PIN", etc.)

          // Estado general del "día"
          estado: "Pendiente",

          // Coords (solo evidencia offline)
          lat: null,
          lng: null,
          // Coords por evento (evidencia por checada)
          entrada_lat: null,
            entrada_lng: null,
          salidaComida_lat: null,
            salidaComida_lng: null,
          entradaComida_lat: null,
            entradaComida_lng: null,
          salida_lat: null,
            salida_lng: null,

          // Pendientes por sync (naranja)
          _offlineFields: {},
          // Sincronizados (azul)
          _syncedFields: {}
        };
      }

      const map = {
        "entrada": "entrada",
        "salida-comida": "salidaComida",
        "entrada-comida": "entradaComida",
        "salida": "salida"
      };

      const field = map[data.tipo];
        // Si viene pin (solo lo usamos para salida)
        if (field === "salida") {
          if (data?.pinRequired === true) record.salida_pin_required = true;
          if (typeof data?.pin === "string") record.salida_pin = data.pin.trim();
          if (typeof data?.pinIntentos === "number") record.salida_pin_intentos = data.pinIntentos;
          if (typeof data?.pinReason === "string") record.salida_pin_reason = data.pinReason;
          if (data?.pinLock === true) record.salida_pin_lock = true;
        }

      // 1) Cache local SIEMPRE (online u offline): guardamos la hora para tener "estado del día"
      if (field && data.hora) {
        record[field] = data.hora;
      }

      // 2) Marcar pendiente SOLO si fue offline
      if (field && !navigator.onLine) {
        if (!record._offlineFields) record._offlineFields = {};
        record._offlineFields[field] = true;

        // si algún día se marcó como synced antes, lo removemos
        if (record._syncedFields) delete record._syncedFields[field];

        // estado general
        record.estado = record.estado || "Pendiente";
      }
      // 3) Guardar coords por evento (evidencia) o forzado
      if (shouldSaveCoords && field) {
        const latKey = `${field}_lat`;
        const lngKey = `${field}_lng`;

        if (data.lat !== undefined && data.lat !== null) record[latKey] = data.lat;
        if (data.lng !== undefined && data.lng !== null) record[lngKey] = data.lng;

        // (Opcional) mantener también "lat/lng" general como último punto
        record.lat = record[latKey];
        record.lng = record[lngKey];
      }
      // 4) Guardar
      if (isNew) store.add(record);
      else store.put(record);
    };

    tx.oncomplete = async () => { 
  resolve(true); 
  try { await updateOfflineBadge(); } catch {}
};

    tx.onerror = () => reject(tx.error);
    request.onerror = () => reject(request.error);
  });
}
window.savePendingRecord = savePendingRecord;
// ✅ AUTO-RENDER: cuando scripts.js abre el modal (remove 'oculto'), pintamos la tabla
document.addEventListener("DOMContentLoaded", () => {
  updateOfflineBadge();
  const modal = document.getElementById("offlineModal");
  if (!modal) return;

  const observer = new MutationObserver(() => {
    const visible = !modal.classList.contains("oculto");
    if (visible) renderOfflineTable();
  });

  observer.observe(modal, { attributes: true, attributeFilter: ["class"] });
});

// Exponer helpers (útil para consola / pruebas)
window.renderOfflineTable = renderOfflineTable;
window.getOfflineCheckins = getOfflineCheckins;
// =====================================================
// SYNC: IndexedDB -> Supabase (sin sobrescribir)
// =====================================================
const FIELD_MAP = {
  entrada: "entrada",
  salidaComida: "salida_comida",
  entradaComida: "entrada_comida",
  salida: "salida"
};

function buildSafeUpdatePayload(localRow, remoteRow) {
  const payload = {};
  const pending = localRow?._offlineFields || {};

  Object.keys(pending).forEach(localField => {
    const remoteField = FIELD_MAP[localField];
    if (!remoteField) return;

    const localValue = localRow?.[localField];
    const remoteValue = remoteRow?.[remoteField];

    // ✅ solo enviar si local tiene hora y supabase NO tiene
    if (hasTime(localValue) && !hasTime(remoteValue)) {
      payload[remoteField] = localValue;
    }
  });

  // step: mandarlo si corresponde al ultimo campo enviado
  // (no obligatorio, pero ayuda)
  if (payload.salida) payload.step = 4;
  else if (payload.entrada_comida) payload.step = 3;
  else if (payload.salida_comida) payload.step = 2;
  else if (payload.entrada) payload.step = 1;

  return payload;
}

async function updateLocalFlags(worker_id, fecha, fnMutate) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);
    const req = store.getAll();

    req.onsuccess = () => {
      const all = req.result || [];
      const rec = all.find(r => String(r.worker_id) === String(worker_id) && String(r.fecha) === String(fecha));
      if (!rec) return;

      fnMutate(rec);
      store.put(rec);
    };

    tx.oncomplete = () => resolve(true);
    tx.onerror = () => reject(tx.error);
    req.onerror = () => reject(req.error);
  });
}

async function syncPendingToSupabase() {
  if (!navigator.onLine) {
    console.warn("⚠️ No hay internet, no se puede sincronizar.");
    return;
  }

  const sb = window.supabaseClient;
  if (!sb) {
    console.error("❌ No existe window.supabaseClient. Asegura window.supabaseClient = supabaseClient en scripts.js");
    return;
  }

  const all = await getOfflineCheckins();
  if (!all.length) return;

  // agrupar por worker_id + fecha
  const groups = new Map();
  all.forEach(r => {
    const key = `${String(r.worker_id)}__${String(r.fecha)}`;
    if (!groups.has(key)) groups.set(key, r);
  });

  for (const row of groups.values()) {
    const pending = row?._offlineFields && Object.keys(row._offlineFields).length > 0;
    if (!pending) continue;

    try {
      // 1) leer registro remoto
      const { data: remoteRows, error: readErr } = await sb
        .from("records")
        .select("id, worker_id, fecha, entrada, salida_comida, entrada_comida, salida, step")
        .eq("worker_id", row.worker_id)
        .eq("fecha", row.fecha)
        .limit(1);

      if (readErr) throw readErr;

      let remote = remoteRows?.[0] || null;

      // 2) si no existe remoto, crear base (sin pisa)
      if (!remote) {
        const { data: baseRow, error: baseErr } = await sb
          .from("records")
          .upsert({ worker_id: row.worker_id, fecha: row.fecha }, { onConflict: "worker_id,fecha" })
          .select("id, worker_id, fecha, entrada, salida_comida, entrada_comida, salida, step")
          .maybeSingle();

        if (baseErr) throw baseErr;
        remote = baseRow;
      }

// ✅ Validación extra: salida temprana requiere PIN (solo si salida está pendiente)
const salidaPendiente = row?._offlineFields?.salida === true;
const requierePin = row?.salida_pin_required === true;

if (salidaPendiente && requierePin) {
  // si está bloqueado, no insistir
  if (row?.salida_pin_lock) {
    // no sincronizar salida
    await updateLocalFlags(row.worker_id, row.fecha, (rec) => {
      rec._syncErrors = rec._syncErrors || {};
      rec._syncErrors.salida = rec.salida_pin_reason || "Bloqueado";
      rec.estado = "Error";
    });
    continue;
  }

  // si no hay pin capturado, marcar NO HAY PIN y bloquear
  const pin = String(row?.salida_pin || "").trim();
  if (!pin) {
    await updateLocalFlags(row.worker_id, row.fecha, (rec) => {
      rec.salida_pin_reason = "No se capturó PIN";
      rec.salida_pin_lock = true; // 🔒 deshabilitar reintento
      rec._syncErrors = rec._syncErrors || {};
      rec._syncErrors.salida = "No hay PIN";
      rec.estado = "Error";
    });
    continue;
  }

  // validar contra auth_pins
  try {
    const { data: pinRow, error: pinErr } = await sb
      .from("auth_pins")
      .select("id, pin, usado, intentos, max_intentos")
      .eq("worker_id", row.worker_id)
      .eq("tipo", "salida_temprana")
      .is("usado", false)
      .order("creado_en", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (pinErr) throw pinErr;

    // si NO existe pin activo: bloquear y NO permitir reintento (como pediste)
    if (!pinRow) {
      await updateLocalFlags(row.worker_id, row.fecha, (rec) => {
        rec.salida_pin_reason = "No existe PIN activo para este trabajador";
        rec.salida_pin_lock = true; // 🔒 ya no se reintenta
        rec._syncErrors = rec._syncErrors || {};
        rec._syncErrors.salida = "No existe PIN";
        rec.estado = "Error";
      });
      continue;
    }

    const max = Number(pinRow.max_intentos ?? 3);
    const usados = Number(row?.salida_pin_intentos ?? 0);

    const ok = String(pinRow.pin) === pin;

    if (!ok) {
      const newLocalAttempts = usados + 1;
      const lock = newLocalAttempts >= max;

      await updateLocalFlags(row.worker_id, row.fecha, (rec) => {
        rec.salida_pin_intentos = newLocalAttempts;
        rec.salida_pin_max = max;
        rec.salida_pin_reason = `PIN incorrecto (${newLocalAttempts}/${max})`;
        rec.salida_pin_lock = lock;
        rec._syncErrors = rec._syncErrors || {};
        rec._syncErrors.salida = "PIN incorrecto";
        rec.estado = "Error";
      });

      continue; // ❌ no enviar salida
    }

    // ✅ PIN correcto: marcar usado en Supabase
    const { error: useErr } = await sb
      .from("auth_pins")
      .update({ usado: true, usado_en: new Date().toISOString() })
      .eq("id", pinRow.id);

    if (useErr) throw useErr;

    // limpiar errores de salida pin localmente
    await updateLocalFlags(row.worker_id, row.fecha, (rec) => {
      rec.salida_pin_reason = null;
      rec.salida_pin_lock = false;
      // NO borramos el pin por si quieres auditoría local; si quieres lo borramos luego
    });

  } catch (e) {
    console.error("❌ Error validando PIN:", e);
    await updateLocalFlags(row.worker_id, row.fecha, (rec) => {
      rec._syncErrors = rec._syncErrors || {};
      rec._syncErrors.salida = "Error validando PIN";
      rec.salida_pin_reason = "Error validando PIN";
      rec.estado = "Error";
    });
    continue;
  }
}


      // 3) construir payload seguro
      const payload = buildSafeUpdatePayload(row, remote);
      if (!Object.keys(payload).length) {
          await updateLocalFlags(row.worker_id, row.fecha, (rec) => {
            rec._offlineFields = rec._offlineFields || {};
            rec._syncedFields = rec._syncedFields || {};
            rec._syncErrors = rec._syncErrors || {};

            // Si Supabase ya tiene lo que local marcaba pendiente, limpiamos esos pendientes
            Object.keys(rec._offlineFields).forEach(lf => {
              const rf = FIELD_MAP[lf];
              if (!rf) return;

              const localValue = rec[lf];
              const remoteValue = remote?.[rf];

              // ✅ si remoto ya tiene el valor, entonces sí lo damos como sincronizado
              if (hasTime(localValue) && hasTime(remoteValue)) {
                delete rec._offlineFields[lf];
                rec._syncedFields[lf] = true;
                delete rec._syncErrors[lf];
              }
            });
            // ✅ si ya no hay pendientes, NO debe quedar Error
            const stillPending = Object.keys(rec._offlineFields).length > 0;
            rec.estado = stillPending ? "Pendiente" : "Sincronizado";

            // ✅ si ya quedó sincronizado completo, limpia cualquier error remanente
            if (!stillPending) {
              rec._syncErrors = {};
            }
          });
          continue;
        }
      // 4) update por id
      const { error: upErr } = await sb
        .from("records")
        .update(payload)
        .eq("id", remote.id);

      if (upErr) throw upErr;

      // 5) marcar columnas como sincronizadas localmente
      await updateLocalFlags(row.worker_id, row.fecha, (rec) => {
        rec._offlineFields = rec._offlineFields || {};
        rec._syncedFields = rec._syncedFields || {};
        rec._syncErrors = rec._syncErrors || {};

        Object.keys(payload).forEach(remoteField => {
          const localField = Object.keys(FIELD_MAP).find(k => FIELD_MAP[k] === remoteField);
          if (!localField) return;

          delete rec._offlineFields[localField];
          rec._syncedFields[localField] = true;
          delete rec._syncErrors[localField];
        });

        const stillPending = Object.keys(rec._offlineFields || {}).length > 0;
        rec.estado = stillPending ? "Pendiente" : "Sincronizado";

        // ✅ Si ya no hay pendientes, limpiar errores del día completo
        if (!stillPending) {
          rec._syncErrors = {};
        }

      });
    } catch (err) {
      console.error("❌ Error sincronizando", row.worker_id, row.fecha, err);

      // marcar error en todos los campos pendientes de ese día
      await updateLocalFlags(row.worker_id, row.fecha, (rec) => {
        rec._syncErrors = rec._syncErrors || {};
        Object.keys(rec._offlineFields || {}).forEach(f => {
          rec._syncErrors[f] = "Error al sincronizar";
        });
        rec.estado = "Error";
      });
    }
  }

  // refrescar UI si modal abierto
  try { await renderOfflineTable(); } catch {}
  try { await updateOfflineBadge(); } catch {}
}

// click del botón sincronizar
document.addEventListener("click", (e) => {
  if (e.target && e.target.id === "btnSyncNow") {
    syncPendingToSupabase();
  }
});

document.addEventListener("click", async (e) => {
  const btn = e.target?.closest?.(".retry-pin-btn");
  if (!btn) return;

  if (!navigator.onLine) return; // offline: no hacer nada

  const worker_id = btn.dataset.worker;
  const fecha = btn.dataset.fecha;

  // Pedir PIN con modal (lo haremos desde scripts.js)
  if (typeof window.requestPinForOfflineRetry === "function") {
    await window.requestPinForOfflineRetry(worker_id, fecha);
  } else {
    console.error("❌ Falta window.requestPinForOfflineRetry en scripts.js");
  }
});

// al volver online: intenta una vez (sin spam)
window.addEventListener("online", () => {
  setTimeout(() => syncPendingToSupabase(), 500);
});

// exponer para pruebas
window.syncPendingToSupabase = syncPendingToSupabase;

// =====================================================
// CLEANUP 10:10pm (solo sincronizados)
// =====================================================
function msUntil2210() {
  const now = new Date();
  const mxNow = new Date(new Date().toLocaleString("en-US", { timeZone: "America/Monterrey" }));

  const target = new Date(mxNow);
  target.setHours(22, 10, 0, 0);

  if (mxNow > target) target.setDate(target.getDate() + 1);

  return target.getTime() - mxNow.getTime();
}

async function deleteFullySynced() {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);
    const req = store.getAll();

    req.onsuccess = () => {
      const rows = req.result || [];
      rows.forEach(r => {
        const pending = r?._offlineFields && Object.keys(r._offlineFields).length > 0;
        const hasError = r?._syncErrors && Object.keys(r._syncErrors).length > 0;

        // ✅ borrar solo si ya no hay pendientes y no hay errores
        if (!pending && !hasError) {
          store.delete(r.id);
        }
      });
    };

    tx.oncomplete = async () => {
      resolve(true);
      try { await updateOfflineBadge(); } catch {}
    };
    tx.onerror = () => reject(tx.error);
    req.onerror = () => reject(req.error);
  });
}

function scheduleCleanup2210() {
  setTimeout(async () => {
    try {
      // intenta sync antes de borrar
      if (navigator.onLine) await syncPendingToSupabase();

      await deleteFullySynced();
      try { await updateOfflineBadge(); } catch {}
      console.log("🧹 Cleanup 10:10pm terminado");
    } catch (e) {
      console.error("❌ Cleanup error:", e);
    }

    // reprogramar cada 24h
    scheduleCleanup2210();
  }, msUntil2210());
}

document.addEventListener("DOMContentLoaded", () => {
  scheduleCleanup2210();
});

// ===============================
// UI: HABILITAR / DESHABILITAR BOTONES SEGÚN CONEXIÓN
// - Online: desactivar entrada/salida comida/entrada comida
// - Offline: activarlos
// - Salida siempre activa
// ===============================
document.addEventListener("DOMContentLoaded", () => {
  function setBtnState(el, enabled) {
    if (!el) return;
    el.style.pointerEvents = enabled ? "auto" : "none";
    el.style.opacity = enabled ? "1" : "0.45";
    el.style.filter = enabled ? "none" : "grayscale(35%)";
    el.setAttribute("aria-disabled", enabled ? "false" : "true");
  }

  function applyButtonsByConnection() {
    const isOnline = navigator.onLine;

    const btnEntrada = document.querySelector('.action-btn[data-action="entrada"]');
    const btnSalidaComida = document.querySelector('.action-btn[data-action="salida-comida"]');
    const btnEntradaComida = document.querySelector('.action-btn[data-action="entrada-comida"]');
    const btnSalida = document.querySelector('.action-btn[data-action="salida"]');

    // Online => desactivar 3 botones manuales (entrada, salida comida, entrada comida)
    // Offline => activarlos
    setBtnState(btnEntrada, !isOnline);
    setBtnState(btnSalidaComida, !isOnline);
    setBtnState(btnEntradaComida, !isOnline);

    // Salida siempre activa (online u offline)
    setBtnState(btnSalida, true);
  }

  applyButtonsByConnection();
  window.addEventListener("online", applyButtonsByConnection);
  window.addEventListener("offline", applyButtonsByConnection);
});


// ===============================
// CONTROL MODAL AUTOMÁTICO SIN TOCAR scripts.js
// - Offline: cerrar modal automático y NO permitir reapertura por timer
// - Online: abrir modal automático inmediatamente al volver la conexión
// ===============================
(function () {
  function safeHideAutoModal() {
    const autoOverlay = document.getElementById("autoOverlay");
    if (autoOverlay) {
      autoOverlay.style.display = "none";
      try { delete autoOverlay.dataset.manualAction; } catch {}
    }

    // Detener el timer si fuera accesible (best-effort)
    try {
      if (typeof window.inactivityTimer !== "undefined" && window.inactivityTimer) {
        clearTimeout(window.inactivityTimer);
      }
    } catch {}
  }

  function safeShowAutoModalNow() {
    if (typeof window.showAutoModal === "function") {
      window.showAutoModal();
      return true;
    }
    return false;
  }

  // Hook: evita que showAutoModal (re-apertura por inactividad) funcione si offline
  function hookShowAutoModal() {
    if (typeof window.showAutoModal !== "function") return false;
    if (window.__offline_showAutoModal_hooked) return true;

    const original = window.showAutoModal;

    window.showAutoModal = function (...args) {
      if (!navigator.onLine) return; // offline => no reabrir
      return original.apply(this, args);
    };

    window.__offline_showAutoModal_hooked = true;
    return true;
  }

  // Esperar a que scripts.js defina showAutoModal
  const hookTimer = setInterval(() => {
    if (hookShowAutoModal()) clearInterval(hookTimer);
  }, 50);

  // OFFLINE => cerrar auto modal
  window.addEventListener("offline", () => {
    safeHideAutoModal();
  });

  // ONLINE => abrir auto modal inmediatamente
  window.addEventListener("online", () => {
    if (safeShowAutoModalNow()) return;

    // si scripts.js aún no estaba listo, reintenta un poco
    let tries = 0;
    const t = setInterval(() => {
      tries++;
      if (safeShowAutoModalNow() || tries > 40) clearInterval(t);
    }, 50);
  });

  // Al cargar: si inicia offline, cerrar auto; si inicia online, dejar que scripts.js haga lo suyo.
  // (NO forzamos abrir aquí para no duplicar la lógica que ya tienes en scripts.js al DOMContentLoaded)
  document.addEventListener("DOMContentLoaded", () => {
    if (!navigator.onLine) {
      safeHideAutoModal();
    }
  });
})();
