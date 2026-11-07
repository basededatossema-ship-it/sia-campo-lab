
/**
 * SIA CAMPO - LABORATORIO PWA
 * Etapa 9.9 - Almacenamiento local
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

async function mostrarRegistros() {
  const registros = await consultarRegistros();

  registros.sort((a, b) =>
    b.creadoEn.localeCompare(a.creadoEn)
  );

  $("contador").textContent =
    registros.length +
    " borrador(es) almacenado(s).";

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

    const identificador = document.createElement("small");
    identificador.textContent = registro.id;

    elemento.append(
      titulo,
      detalle,
      identificador
    );

    contenedor.appendChild(elemento);
  }
}

async function guardarFormulario(evento) {
  evento.preventDefault();

  const boton = $("guardar");
  boton.disabled = true;

  try {
    const registro = {
      id: generarUUID(),
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

    if (!["SENSIBILIZACION", "VISITA_TECNICA"]
        .includes(registro.tipo)) {
      throw new Error("Tipo de registro inválido");
    }

    if (!registro.fecha ||
        !registro.responsable ||
        !registro.lugar) {
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
    const registro = await navigator.serviceWorker
      .getRegistration("./");

    if (registro && registro.active) {
      $("serviceworker").textContent =
        "Activo";
    } else {
      $("serviceworker").textContent =
        "Pendiente";
    }
  } catch (error) {
    $("serviceworker").textContent =
      "No verificado";
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
