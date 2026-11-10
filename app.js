
/**
 * banimApp - SIA Bienestar Animal
 * P04-B1 - Preparación del almacenamiento local
 *
 * Datos ficticios exclusivamente.
 * No transmite información a servidores.
 */

"use strict";

const DB_NAME = "SIA_CAMPO_PWA_LAB";
const DB_VERSION = 1;
const STORE_NAME = "borradores";

let db = null;

const $ = id => document.getElementById(id);

function mensaje(texto, tipo = "") {
  const elemento = $("estado");
  elemento.textContent = texto;
  elemento.className = "status " + tipo;
}

function actualizarConexion() {
  $("conexion").textContent = navigator.onLine
    ? "Conexión reportada"
    : "Sin conexión reportada";
}

function generarUUID() {
  if (typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }

  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);

  bytes[6] = (bytes[6] & 15) | 64;
  bytes[8] = (bytes[8] & 63) | 128;

  const hex = Array.from(
    bytes,
    b => b.toString(16).padStart(2, "0")
  ).join("");

  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    hex.slice(12, 16),
    hex.slice(16, 20),
    hex.slice(20)
  ].join("-");
}

/**
 * P04-B1
 * Identificador de operación permanente.
 */
function generarOperacionId(uuid) {
  const patron =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

  if (!patron.test(String(uuid))) {
    throw new Error(
      "UUID inválido para operación"
    );
  }

  return "P04-" +
    uuid.toLowerCase().replace(/-/g, "");
}

function abrirBase() {
  return new Promise((resolve, reject) => {
    if (!("indexedDB" in window)) {
      reject(new Error("IndexedDB no disponible"));
      return;
    }

    const solicitud = indexedDB.open(
      DB_NAME,
      DB_VERSION
    );

    solicitud.onupgradeneeded = () => {
      const base = solicitud.result;

      if (!base.objectStoreNames.contains(STORE_NAME)) {
        base.createObjectStore(
          STORE_NAME,
          { keyPath: "id" }
        );
      }
    };

    solicitud.onsuccess = () => {
      const base = solicitud.result;

      base.onversionchange = () => {
        base.close();
      };

      resolve(base);
    };

    solicitud.onerror = () => {
      reject(
        solicitud.error ||
        new Error("Error al abrir almacenamiento")
      );
    };

    solicitud.onblocked = () => {
      reject(new Error(
        "Otra pestaña bloquea la base local"
      ));
    };
  });
}

function guardarRegistro(registro) {
  return new Promise((resolve, reject) => {
    if (!db) {
      reject(new Error("Base local no inicializada"));
      return;
    }

    const tx = db.transaction(
      STORE_NAME,
      "readwrite"
    );

    tx.objectStore(STORE_NAME).add(registro);

    tx.oncomplete = () => resolve(registro.id);

    tx.onerror = () => {
      reject(
        tx.error ||
        new Error("Error de escritura")
      );
    };

    tx.onabort = () => {
      reject(new Error(
        "Almacenamiento cancelado"
      ));
    };
  });
}

function consultarRegistros() {
  return new Promise((resolve, reject) => {
    if (!db) {
      reject(new Error("Base local no inicializada"));
      return;
    }

    const tx = db.transaction(
      STORE_NAME,
      "readonly"
    );

    const solicitud = tx
      .objectStore(STORE_NAME)
      .getAll();

    let resultado = [];

    solicitud.onsuccess = () => {
      resultado = solicitud.result;
    };

    tx.oncomplete = () => resolve(resultado);

    tx.onerror = () => {
      reject(
        tx.error ||
        new Error("Error de lectura")
      );
    };

    tx.onabort = () => {
      reject(new Error("Consulta cancelada"));
    };
  });
}

/**
 * P04-B1
 * Migración de borradores anteriores.
 *
 * Conserva datos, UUID y estado.
 * Solo agrega operacion_id si falta.
 * No transmite información.
 */
function prepararRegistrosLocales() {
  return new Promise((resolve, reject) => {
    if (!db) {
      reject(new Error(
        "Base local no inicializada"
      ));
      return;
    }

    const tx = db.transaction(
      STORE_NAME,
      "readwrite"
    );

    const store = tx.objectStore(STORE_NAME);
    const cursorRequest = store.openCursor();

    let preparados = 0;
    let errorPreparacion = null;

    cursorRequest.onsuccess = () => {
      const cursor = cursorRequest.result;

      if (!cursor) return;

      const registro = cursor.value;

      try {
        if (
          typeof registro.operacion_id !== "string" ||
          registro.operacion_id.length === 0
        ) {
          registro.operacion_id =
            generarOperacionId(registro.id);

          cursor.update(registro);
          preparados++;
        }

        cursor.continue();

      } catch (error) {
        errorPreparacion = error;

        try {
          tx.abort();
        } catch (errorAbortar) {
          // La transacción puede estar terminada.
        }
      }
    };

    tx.oncomplete = () => {
      resolve(preparados);
    };

    tx.onerror = () => {
      reject(
        errorPreparacion ||
        tx.error ||
        new Error("Error al preparar registros")
      );
    };

    tx.onabort = () => {
      reject(
        errorPreparacion ||
        tx.error ||
        new Error("Preparación cancelada")
      );
    };
  });
}

/**
 * P04-B2 - Cola local de sincronizacion.
 *
 * Transicion permitida:
 * BORRADOR -> PENDIENTE
 *
 * No modifica UUID, operacion_id ni datos.
 * No realiza solicitudes de red.
 */
function prepararEnvioLocal(uuid) {
  return new Promise((resolve, reject) => {
    if (!db) {
      reject(new Error(
        "Base local no inicializada"
      ));
      return;
    }

    const tx = db.transaction(
      STORE_NAME,
      "readwrite"
    );

    const almacen = tx.objectStore(STORE_NAME);
    const consulta = almacen.get(uuid);

    let resultado = null;
    let causaError = null;

    consulta.onsuccess = () => {
      const registro = consulta.result;

      try {
        if (!registro) {
          throw new Error(
            "Registro local no encontrado"
          );
        }
        if (registro.formularioVersion === "BA-05F") {
          throw new Error(
            "La sincronización institucional BA " +
            "todavía no está habilitada."
          );
        }
        if (registro.estado === "PENDIENTE") {
          resultado = "YA_PENDIENTE";
          return;
        }

        if (registro.estado !== "BORRADOR") {
          throw new Error(
            "Estado incompatible para preparar envío"
          );
        }

        if (
          !registro.operacion_id ||
          registro.operacion_id !==
            generarOperacionId(registro.id)
        ) {
          throw new Error(
            "Identificador de operación inconsistente"
          );
        }

        if (
          !["SENSIBILIZACION", "VISITA_TECNICA"]
            .includes(registro.tipo) ||
          !registro.fecha ||
          !registro.responsable ||
          !registro.lugar
        ) {
          throw new Error(
            "Registro incompleto para sincronización"
          );
        }

        registro.estado = "PENDIENTE";
        registro.preparadoEn =
          new Date().toISOString();

        almacen.put(registro);
        resultado = "PREPARADO";

      } catch (error) {
        causaError = error;
        tx.abort();
      }
    };

    tx.oncomplete = () => {
      resolve(resultado);
    };

    tx.onerror = () => {
      reject(
        causaError ||
        tx.error ||
        new Error("Error de actualización local")
      );
    };

    tx.onabort = () => {
      reject(
        causaError ||
        tx.error ||
        new Error("Operación local cancelada")
      );
    };
  });
}

async function mostrarRegistros() {
  const registros = await consultarRegistros();

  registros.sort((a, b) =>
    String(b.creadoEn || "").localeCompare(
      String(a.creadoEn || "")
    )
  );

  
  const borradores = registros.filter(
    r => r.estado === "BORRADOR"
  ).length;

  const pendientes = registros.filter(
    r => r.estado === "PENDIENTE"
  ).length;

  $("contador").textContent =
    registros.length + " registro(s) local(es). " +
    borradores + " borrador(es). " +
    pendientes + " pendiente(s).";


  const contenedor = $("registros");
  contenedor.replaceChildren();

  for (const registro of registros) {
    const elemento = document.createElement("div");
    elemento.className = "record";

    const titulo = document.createElement("strong");
    titulo.textContent =
      registro.tipo === "VISITA_TECNICA"
        ? "Visita técnica"
        : "Sensibilización";

    const detalle = document.createElement("p");
    detalle.textContent = [
      registro.fecha,
      registro.responsable,
      registro.lugar
    ].join(" · ");

    const estadoRegistro =
      document.createElement("p");

    estadoRegistro.textContent =
      "Estado: " +
      (registro.estado || "BORRADOR");

    const identificador =
      document.createElement("small");

    identificador.textContent =
      "UUID: " + registro.id;

    const operacionRegistro =
      document.createElement("p");

    operacionRegistro.textContent =
      "Operación: " +
      (registro.operacion_id || "No preparada");

    elemento.append(
      titulo,
      detalle,
      estadoRegistro,
      identificador,
      operacionRegistro
    );

    
    // P04-B2: preparar manualmente la
    // sincronizacion de un borrador.

   
    if (
      registro.estado === "BORRADOR" &&
      registro.formularioVersion !== "BA-05F"
    ) {
      const botonPreparar =
        document.createElement("button");


      botonPreparar.type = "button";
      botonPreparar.className =
        "secondary-button";

      botonPreparar.textContent =
        "Preparar sincronización";

      botonPreparar.addEventListener(
        "click",
        async () => {
          botonPreparar.disabled = true;

          try {
            const resultado =
              await prepararEnvioLocal(registro.id);

            await mostrarRegistros();

            mensaje(
              resultado === "PREPARADO"
                ? "Registro incorporado a la cola local."
                : "El registro ya estaba pendiente.",
              "success"
            );

          } catch (error) {
            mensaje(error.message, "error");
            botonPreparar.disabled = false;
          }
        }
      );

      elemento.appendChild(botonPreparar);
    }


    contenedor.appendChild(elemento);
  }
}

async function guardarFormulario(evento) {
  evento.preventDefault();

  const boton = $("guardar");
  boton.disabled = true;

  try {
    const nuevoUUID = generarUUID();

    const registro = {
      id: nuevoUUID,
      operacion_id:
        generarOperacionId(nuevoUUID),
      tipo: $("tipo").value,
      fecha: $("fecha").value,
      responsable: $("responsable").value.trim(),
      lugar: $("lugar").value.trim(),
      observaciones:
        $("observaciones").value.trim(),
      estado: "BORRADOR",
      creadoEn: new Date().toISOString(),
      origen: "SIA_CAMPO_PWA_LAB"
    };

    if (![
      "SENSIBILIZACION",
      "VISITA_TECNICA"
    ].includes(registro.tipo)) {
      throw new Error("Tipo de registro inválido");
    }

    if (
      !registro.fecha ||
      !registro.responsable ||
      !registro.lugar
    ) {
      throw new Error(
        "Completa los campos obligatorios"
      );
    }

    await guardarRegistro(registro);

    $("formulario").reset();

    mensaje(
      "Borrador guardado localmente.",
      "success"
    );

    try {
      await mostrarRegistros();
    } catch (error) {
      mensaje(
        "Borrador guardado, pero no se pudo actualizar la lista: " +
        error.message,
        "error"
      );
    }

  } catch (error) {
    mensaje(error.message, "error");

  } finally {
    boton.disabled = false;
  }
}

async function verificarServiceWorker() {
  if (!("serviceWorker" in navigator)) {
    $("serviceworker").textContent =
      "No compatible";
    return;
  }

  try {
    const registro = await navigator.serviceWorker.register(
      "./sw.js",
      { scope: "./" }
    );

    await navigator.serviceWorker.ready;

    $("serviceworker").textContent =
      registro.active
        ? "Instalado"
        : "Pendiente de activación";

  } catch (error) {
    $("serviceworker").textContent =
      "Error de instalación";

    console.error(
      "SIA Campo - Service Worker:",
      error
    );
  }
}

async function iniciarAplicacion() {
  actualizarConexion();

  window.addEventListener(
    "online",
    actualizarConexion
  );

  window.addEventListener(
    "offline",
    actualizarConexion
  );

  $("formulario").addEventListener(
    "submit",
    guardarFormulario
  );

  $("actualizar").addEventListener(
    "click",
    async () => {
      try {
        await mostrarRegistros();
      } catch (error) {
        mensaje(error.message, "error");
      }
    }
  );

  await verificarServiceWorker();

  try {
    db = await abrirBase();

    const registrosPreparados =
      await prepararRegistrosLocales();

    console.info(
      "P04-B1 registros preparados:",
      registrosPreparados
    );

    $("almacenamiento").textContent =
      "Disponible";

    $("guardar").disabled = false;
    $("actualizar").disabled = false;

    await mostrarRegistros();

    mensaje(
      "Almacenamiento local disponible.",
      "success"
    );

  } catch (error) {
    $("almacenamiento").textContent =
      "No disponible";

    mensaje(error.message, "error");
  }
}

document.addEventListener(
  "DOMContentLoaded",
  iniciarAplicacion
);
