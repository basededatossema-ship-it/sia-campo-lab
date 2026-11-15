
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


/**
 * SIA-BIENESTAR-05G.20A
 * Estado informativo de conectividad.
 * No concede acceso ni permisos.
 */

function actualizarConexion() {

  const enLinea = navigator.onLine;

  $("conexion").textContent = enLinea
    ? "Red disponible (reportada)"
    : "Sin conexión de red reportada";

  const indicador = $(
    "conectividadCampo05G20A"
  );

  if (!indicador) return;

  let sesionValida = false;

  try {
    const usuarioId =
      usuarioListado05G16B();

    const acceso = JSON.parse(
      sessionStorage.getItem(
        "SIA_BA_ACCESO_GOOGLE_05G19A"
      ) || "null"
    );

    
    const identidad = JSON.parse(
      sessionStorage.getItem(
        "SIA_BA_IDENTIDAD_05G14"
      ) || "null"
    );

    sesionValida = Boolean(
      usuarioId &&
      acceso &&
      identidad &&
      acceso.usuarioId === usuarioId &&
      identidad.usuarioId === usuarioId &&
      typeof acceso.verificadoEn === "string" &&
      acceso.verificadoEn === identidad.verificadoEn
    );

  } catch (error) {
    sesionValida = false;
  }

  const conectividad = enLinea
    ? "CONECTIVIDAD REPORTADA\n" +
      "El dispositivo informa conexión de red."
    : "SIN CONEXIÓN REPORTADA\n" +
      "El trabajo local puede continuar " +
      "mientras la sesión permanezca válida.";

  const identidad = sesionValida
    ? "SESIÓN LOCAL ACTIVA"
    : "SESIÓN INSTITUCIONAL REQUERIDA";

  indicador.textContent =
    conectividad + "\n\n" +
    identidad + "\n" +
    "Sincronización: DESHABILITADA";
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

/**
 * SIA - banimApp
 * Etapa 05F.3B.2B
 *
 * Eliminacion individual de borradores
 * experimentales expresamente identificados.
 */

const BA_BORRADORES_ELIMINABLES = new Set([
  "e81d342b-680d-4f5d-912b-1bf70eb752db",
  "ee9d6775-4a5d-4e1e-be4c-ea6043941655",
  "9b5e4601-bf4e-4400-9274-b4041e7bd403"
]);

function eliminarBorradorPrueba(uuid) {
  return new Promise((resolve, reject) => {

    if (!db) {
      reject(new Error("BASE_LOCAL_NO_DISPONIBLE"));
      return;
    }

    if (!BA_BORRADORES_ELIMINABLES.has(uuid)) {
      reject(new Error("ELIMINACION_NO_AUTORIZADA"));
      return;
    }

    const tx = db.transaction(
      STORE_NAME,
      "readwrite"
    );

    const almacen = tx.objectStore(STORE_NAME);
    const consulta = almacen.get(uuid);

    let eliminado = false;
    let errorLocal = null;

    consulta.onsuccess = () => {
      const registro = consulta.result;

      if (
        !registro ||
        registro.id !== uuid ||
        registro.estado !== "BORRADOR"
      ) {
        errorLocal = "REGISTRO_NO_ELIMINABLE";
        tx.abort();
        return;
      }

      almacen.delete(uuid);
      eliminado = true;
    };

    tx.oncomplete = () => resolve(eliminado);

    tx.onerror = () => reject(
      new Error(errorLocal || "ELIMINACION_FALLIDA")
    );

    tx.onabort = () => reject(
      new Error(errorLocal || "ELIMINACION_CANCELADA")
    );
  });
}

/**
 * SIA-BIENESTAR-05G.16B
 * Identidad para visualizar borradores.
 *
 * No autentica.
 * No modifica registros.
 * No concede permisos.
 */

function usuarioListado05G16B() {

  try {
    const sesion = JSON.parse(
      sessionStorage.getItem(
        "SIA_BA_IDENTIDAD_05G14"
      ) || "null"
    );

    const referencia = JSON.parse(
      localStorage.getItem(
        "SIA_BA_IDENTIDAD_OFFLINE_05G15"
      ) || "null"
    );

    if (!sesion || !referencia) {
      return null;
    }

    const fecha = Date.parse(
      referencia.verificadoEn
    );

    const antiguedad = Date.now() - fecha;

    if (
      typeof sesion.usuarioId !== "string" ||
      !sesion.usuarioId.trim() ||
      typeof sesion.nombreCompleto !== "string" ||
      !sesion.nombreCompleto.trim() ||
      sesion.modulo !== "BIENESTAR_ANIMAL" ||
      sesion.permiso !== "LEER" ||
      referencia.modulo !== "BIENESTAR_ANIMAL" ||
      referencia.permiso !== "LEER" ||
      sesion.usuarioId !== referencia.usuarioId ||
      sesion.nombreCompleto !==
        referencia.nombreCompleto ||
      sesion.verificadoEn !==
        referencia.verificadoEn ||
      !Number.isFinite(fecha) ||
      antiguedad < 0 ||
      antiguedad > 72 * 60 * 60 * 1000
    ) {
      return null;
    }

    return sesion.usuarioId.trim();

  } catch (error) {
    return null;
  }
}



/**
 * SIA-BIENESTAR-05G.20C
 * Presentación de identidad institucional.
 * No autentica ni modifica registros.
 */

function actualizarIdentidadPanel05G18B() {

  const salida = $("identidadPanel05G18B");
  if (!salida) return;

  salida.replaceChildren();

  const usuarioId = usuarioListado05G16B();
  let identidad = null;

  try {
    identidad = JSON.parse(
      sessionStorage.getItem(
        "SIA_BA_IDENTIDAD_05G14"
      ) || "null"
    );
  } catch (_) {}

  if (
    !usuarioId ||
    !identidad ||
    identidad.usuarioId !== usuarioId
  ) {
    salida.textContent =
      "Identidad institucional requerida";
    return;
  }

  const agregar = (etiqueta, valor, clase) => {
    const elemento = document.createElement(etiqueta);
    elemento.className = clase;
    elemento.textContent = valor;
    salida.appendChild(elemento);
  };

  agregar(
    "div",
    "✓ SESIÓN INSTITUCIONAL ACTIVA",
    "sia-identidad-estado"
  );

  agregar(
    "div",
    identidad.nombreCompleto,
    "sia-identidad-nombre"
  );

  agregar(
    "div",
    "ID: " + usuarioId,
    "sia-identidad-detalle"
  );

  agregar(
    "div",
    "Bienestar Animal · Permiso: LEER",
    "sia-identidad-detalle"
  );

  agregar(
    "div",
    "Sincronización deshabilitada",
    "sia-identidad-pie"
  );
}



async function mostrarRegistros() {
  actualizarIdentidadPanel05G18B();
  // SIA-BIENESTAR-05G.16C
  // Limpiar siempre la lista antes de
  // comprobar la identidad institucional.

  const contenedor = $("registros");
  contenedor.replaceChildren();

  $("contador").textContent =
    "Verificando identidad institucional...";

  const usuarioId = usuarioListado05G16B();

  if (!usuarioId) {
    $("contador").textContent =
      "IDENTIDAD INSTITUCIONAL REQUERIDA. " +
      "Autentícate o confirma tu identidad " +
      "local desde los formularios.";

    return;
  }

  
  // SIA-BIENESTAR-05G.22D
  // Comprobar permiso CONSULTAR antes
  // de leer los registros locales.

  let consultaAutorizada = false;

  try {
    const sesion = JSON.parse(
      sessionStorage.getItem(
        "SIA_BA_IDENTIDAD_05G14"
      ) || "null"
    );

    const contrato = JSON.parse(
      sessionStorage.getItem(
        "SIA_BA_PERMISOS_05G21I"
      ) || "null"
    );

    const p = contrato && contrato.permisos;

    consultaAutorizada = Boolean(
      sesion &&
      contrato &&
      sesion.usuarioId === usuarioId &&
      contrato.usuarioId === usuarioId &&
      contrato.verificadoEn ===
        sesion.verificadoEn &&
      contrato.contrato ===
        "SIA-PERMISOS-BA-01" &&
      p &&
      typeof p === "object" &&
      !Array.isArray(p) &&
      Object.keys(p).length === 5 &&
      p.CONSULTAR === true &&
      p.CAPTURA_LOCAL === true &&
      p.ESCRIBIR === false &&
      p.ADMINISTRAR === false &&
      p.SINCRONIZAR === false
    );

  } catch (_) {
    consultaAutorizada = false;
  }

  if (!consultaAutorizada) {
    $("contador").textContent =
      "CONSULTA NO HABILITADA.\n" +
      "No existe un contrato de permisos " +
      "válido para esta sesión.";

    return;
  }

  
  // SIA-BIENESTAR-05G.22E.1
  // Conservar el estado autorizado antes
  // de iniciar la lectura de IndexedDB.

  const identidadAntes = sessionStorage.getItem(
    "SIA_BA_IDENTIDAD_05G14"
  );

  const accesoAntes = sessionStorage.getItem(
    "SIA_BA_ACCESO_GOOGLE_05G19A"
  );

  const permisosAntes = sessionStorage.getItem(
    "SIA_BA_PERMISOS_05G21I"
  );

  const todos = await consultarRegistros();

  // Si alguno de estos elementos cambió
  // durante la lectura, descartar el
  // resultado sin mostrar registros.

  const sesionSinCambios = Boolean(
    identidadAntes &&
    accesoAntes &&
    permisosAntes &&
    identidadAntes === sessionStorage.getItem(
      "SIA_BA_IDENTIDAD_05G14"
    ) &&
    accesoAntes === sessionStorage.getItem(
      "SIA_BA_ACCESO_GOOGLE_05G19A"
    ) &&
    permisosAntes === sessionStorage.getItem(
      "SIA_BA_PERMISOS_05G21I"
    )
  );

  if (!sesionSinCambios) {
    contenedor.replaceChildren();

    $("contador").textContent =
      "CONSULTA INTERRUMPIDA.\n" +
      "La sesión o los permisos cambiaron " +
      "durante la lectura.\n" +
      "Vuelve a validar tu identidad.";

    return;
  }


  // SIA-BIENESTAR-05G.16C.1
  // Comprobar nuevamente la identidad
  // despues de la lectura de IndexedDB.

  const usuarioConfirmado =
    usuarioListado05G16B();

  if (
    !usuarioConfirmado ||
    usuarioConfirmado !== usuarioId
  ) {
    contenedor.replaceChildren();

    $("contador").textContent =
      "IDENTIDAD INSTITUCIONAL CAMBIADA. " +
      "Vuelve a confirmar tu identidad " +
      "antes de consultar los registros.";

    return;
  }

  const registros = todos.filter(registro =>

    registro.formularioVersion === "BA-05F" &&
    registro.autoriaInstitucional &&
    registro.autoriaInstitucional.usuarioId ===
      usuarioId
  );



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

  
  // SIA-BIENESTAR-05G.17F
  // Contador exclusivo del funcionario activo.
  // No informa cantidades de otros usuarios.

  if (registros.length === 0) {

    $("contador").textContent =
      "No hay actividades visibles para " +
      "el funcionario institucional " +
      usuarioId + ".\n" +
      "Esto no significa que el " +
      "almacenamiento esté vacío.";

  } else {

    $("contador").textContent =
      "Funcionario institucional: " +
      usuarioId + "\n" +
      registros.length +
      " actividad(es) propia(s). " +
      borradores + " borrador(es). " +
      pendientes + " pendiente(s).";
  }



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

    // SIA-BIENESTAR-05G.23A.1
    // Ficha de consulta de Visita Técnica.
    // Lectura exclusiva. No modifica IndexedDB.

    if (registro.tipo === "VISITA_TECNICA") {

      const ficha = document.createElement("details");
      const encabezado = document.createElement("summary");

      encabezado.textContent =
        "Ver detalle de la actividad";

      encabezado.style.cursor = "pointer";
      encabezado.style.fontWeight = "600";
      encabezado.style.padding = "12px 0";

      ficha.appendChild(encabezado);

      const contenido = document.createElement("div");

      const f = registro.formulario || {};
      const u = f.ubicacion || {};
      const autoria = registro.autoriaInstitucional || {};

      function agregarCampo(etiqueta, valor) {
        const fila = document.createElement("p");
        const nombre = document.createElement("strong");

        nombre.textContent = etiqueta + ": ";

        const dato = document.createElement("span");

        dato.textContent =
          valor === null ||
          valor === undefined ||
          valor === ""
            ? "No registrado"
            : String(valor);

        fila.append(nombre, dato);
        contenido.appendChild(fila);
      }

      function agregarSeccion(nombre) {
        const subtitulo = document.createElement("h4");
        subtitulo.textContent = nombre;
        contenido.appendChild(subtitulo);
      }

      agregarSeccion("Información de la visita");
      agregarCampo("Fecha de visita", f.fechaVisita);
      agregarCampo("Asunto", f.asunto);
      agregarCampo("Número de informe", f.numeroInforme);
      agregarCampo("Fecha del informe", f.fechaInforme);
      agregarCampo(
        "Población-comunidad",
        f.poblacionComunidad
      );

      
      // SIA-BIENESTAR-05G.23C.1
      // Presentar solo los campos
      // correspondientes a la zona.

      agregarSeccion("Ubicación");
      agregarCampo("Zona", u.zona);

      if (u.zona === "URBANA") {
        agregarCampo("Comuna", u.comuna);
        agregarCampo("Barrio", u.barrio);
      }

      if (u.zona === "RURAL") {
        agregarCampo("Corregimiento", u.corregimiento);
        agregarCampo("Vereda", u.vereda);
      }

      agregarCampo("Sitio", u.lugar);

      agregarCampo("Latitud", u.latitud);
      agregarCampo("Longitud", u.longitud);

      agregarSeccion("Identificación institucional");
      agregarCampo("Responsable", registro.responsable);
      agregarCampo("Usuario institucional", autoria.usuarioId);
      agregarCampo("UUID", registro.id);
      agregarCampo("Operación", registro.operacion_id);

      // Antes de desplegar, comprobar que la
      // sesión de consulta no haya cambiado.

      ficha.addEventListener("toggle", function () {
        if (!ficha.open) return;

        const sigueAutorizado = Boolean(
          usuarioListado05G16B() === usuarioId &&
          identidadAntes === sessionStorage.getItem(
            "SIA_BA_IDENTIDAD_05G14"
          ) &&
          accesoAntes === sessionStorage.getItem(
            "SIA_BA_ACCESO_GOOGLE_05G19A"
          ) &&
          permisosAntes === sessionStorage.getItem(
            "SIA_BA_PERMISOS_05G21I"
          )
        );

        if (!sigueAutorizado) {
          ficha.open = false;
          contenedor.replaceChildren();
          $("contador").textContent =
            "CONSULTA NO DISPONIBLE. " +
            "Verifica nuevamente tu sesión institucional.";
        }
      });

      ficha.appendChild(contenido);
      elemento.appendChild(ficha);
    }

    // SIA-BIENESTAR-05G.23A.3
    // Ficha de consulta de Sensibilización.
    // Lectura exclusiva. Sin escritura en IndexedDB.

    if (registro.tipo === "SENSIBILIZACION") {

      const fichaSens = document.createElement("details");
      const encabezadoSens = document.createElement("summary");

      encabezadoSens.textContent =
        "Ver detalle de la actividad";

      encabezadoSens.style.cursor = "pointer";
      encabezadoSens.style.fontWeight = "600";
      encabezadoSens.style.padding = "12px 0";

      fichaSens.appendChild(encabezadoSens);

      const contenidoSens = document.createElement("div");

      const fSens = registro.formulario || {};
      const uSens = fSens.ubicacion || {};
      const autoriaSens =
        registro.autoriaInstitucional || {};

      function campoSens(etiqueta, valor) {
        const fila = document.createElement("p");
        const nombre = document.createElement("strong");
        const dato = document.createElement("span");

        nombre.textContent = etiqueta + ": ";

        dato.textContent =
          valor === null ||
          valor === undefined ||
          valor === ""
            ? "No registrado"
            : String(valor);

        fila.append(nombre, dato);
        contenidoSens.appendChild(fila);
      }

      function seccionSens(nombre) {
        const tituloSeccion = document.createElement("h4");
        tituloSeccion.textContent = nombre;
        contenidoSens.appendChild(tituloSeccion);
      }

      seccionSens("Información de Sensibilización");
      campoSens("Meta", fSens.meta);
      campoSens("Eje estratégico", fSens.ejeEstrategico);
      campoSens("Temática", fSens.tematica);
      campoSens("Fecha de actividad", fSens.fechaActividad);

      seccionSens("Informe y radicado");
      campoSens("Número de informe", fSens.numeroInforme);
      campoSens("Fecha del informe", fSens.fechaInforme);
      campoSens("Número de radicado", fSens.numeroRadicado);
      campoSens("Fecha del radicado", fSens.fechaRadicado);

      // Mantener los grupos y las etiquetas
      // utilizados en los formularios originales.

      const gruposSens = [
        ["Género", [
          ["femenino", "Femenino"],
          ["masculino", "Masculino"]
        ]],
        ["Edad", [
          ["menores18", "Menores de 18 años"],
          ["edad18a28", "De 18 a 28 años"],
          ["edad29a59", "De 29 a 59 años"],
          ["mayores60", "Mayores de 60 años"]
        ]],
        ["Víctimas del conflicto armado", [
          ["desplazamiento", "Desplazamiento"],
          ["otroHechoVictimizante", "Otro hecho victimizante"],
          ["otrasVictimas", "Otros"]
        ]],
        ["Situación poblacional", [
          ["discapacitado", "Discapacitado"],
          ["desmovilizado", "Desmovilizado(a)"],
          ["reincorporado", "Reincorporado(a)"],
          ["gestante", "Gestante"],
          ["cabezaHogar", "Cabeza de hogar"],
          ["migrante", "Migrante"],
          ["adultoMayor", "Adulto mayor"],
          ["ninguno", "Ninguno"]
        ]],
        ["Grupo étnico", [
          ["afrodescendiente", "Afrodescendiente"],
          ["indigena", "Indígena"],
          ["rom", "Rom"]
        ]],
        ["Orientación sexual", [
          ["heterosexual", "Heterosexual"],
          ["osigd", "OSIGD"]
        ]]
      ];

      seccionSens("Alcance poblacional");

      const alcanceSens = fSens.alcancePoblacional || {};

      for (const [grupo, campos] of gruposSens) {
        seccionSens(grupo);

        for (const [clave, etiqueta] of campos) {
          campoSens(etiqueta, alcanceSens[clave]);
        }
      }

      seccionSens("Ubicación");
      campoSens("Zona", uSens.zona);

      if (uSens.zona === "URBANA") {
        campoSens("Comuna", uSens.comuna);
        campoSens("Barrio", uSens.barrio);
      }

      if (uSens.zona === "RURAL") {
        campoSens("Corregimiento", uSens.corregimiento);
        campoSens("Vereda", uSens.vereda);
      }

      campoSens("Sitio", uSens.lugar);
      campoSens("Latitud", uSens.latitud);
      campoSens("Longitud", uSens.longitud);

      seccionSens("Identificación institucional");
      campoSens("Responsable", registro.responsable);
      campoSens(
        "Usuario institucional",
        autoriaSens.usuarioId
      );
      campoSens("UUID", registro.id);
      campoSens("Operación", registro.operacion_id);

      // Revalidar la sesión antes de
      // presentar información detallada.

      fichaSens.addEventListener("toggle", function () {
        if (!fichaSens.open) return;

        const autorizadoSens = Boolean(
          usuarioListado05G16B() === usuarioId &&
          identidadAntes === sessionStorage.getItem(
            "SIA_BA_IDENTIDAD_05G14"
          ) &&
          accesoAntes === sessionStorage.getItem(
            "SIA_BA_ACCESO_GOOGLE_05G19A"
          ) &&
          permisosAntes === sessionStorage.getItem(
            "SIA_BA_PERMISOS_05G21I"
          )
        );

        if (!autorizadoSens) {
          fichaSens.open = false;
          contenedor.replaceChildren();

          $("contador").textContent =
            "CONSULTA NO DISPONIBLE. " +
            "Verifica nuevamente tu sesión institucional.";
        }
      });

      fichaSens.appendChild(contenidoSens);
      elemento.appendChild(fichaSens);
    }

    
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


if (
  registro.estado === "BORRADOR" &&
  BA_BORRADORES_ELIMINABLES.has(registro.id)
) {
  const botonEliminar =
    document.createElement("button");

  botonEliminar.type = "button";
  botonEliminar.className = "secondary-button";
  botonEliminar.textContent =
    "Eliminar borrador de prueba";

  botonEliminar.addEventListener(
    "click",
    async () => {

      const confirmado = window.confirm(
        "¿Eliminar definitivamente este " +
        "borrador de prueba?\n\nUUID: " +
        registro.id
      );

      if (!confirmado) return;

      botonEliminar.disabled = true;

      try {
        await eliminarBorradorPrueba(registro.id);
        await mostrarRegistros();

        mensaje(
          "Borrador de prueba eliminado.",
          "success"
        );

      } catch (error) {
        mensaje(error.message, "error");
        botonEliminar.disabled = false;
      }
    }
  );

  elemento.appendChild(botonEliminar);
}

    contenedor.appendChild(elemento);
  }
}

/**
 * SIA-BIENESTAR-05G.16C
 *
 * Revalidar la visualizacion cuando
 * la pagina vuelva a estar activa.
 */

document.addEventListener(
  "visibilitychange",
  () => {
    if (
      document.visibilityState === "visible" &&
      db
    ) {
      mostrarRegistros().catch(() => {
        $("registros").replaceChildren();
        $("contador").textContent =
          "No fue posible verificar los registros.";
      });
    }
  }
);

window.addEventListener(
  "storage",
  event => {
    if (
      event.key ===
      "SIA_BA_IDENTIDAD_OFFLINE_05G15" &&
      db
    ) {
      mostrarRegistros().catch(() => {
        $("registros").replaceChildren();
        $("contador").textContent =
          "No fue posible verificar los registros.";
      });
    }
  }
);

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
  actualizarIdentidadPanel05G18B();

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

  
  // SIA-BIENESTAR-05G.20C.2
  // Verificar Service Worker sin bloquear
  // la apertura de IndexedDB ni los registros.

  void verificarServiceWorker();


// SIA-BIENESTAR-05G.19B
// No inicializar registros de campo
// sin una identidad y acceso concordantes.

let accesoConfirmado = false;

try {
  const usuarioId =
    usuarioListado05G16B();

  const acceso = JSON.parse(
    sessionStorage.getItem(
      "SIA_BA_ACCESO_GOOGLE_05G19A"
    ) || "null"
  );

  accesoConfirmado = Boolean(
    usuarioId &&
    acceso &&
    acceso.usuarioId === usuarioId
  );

} catch (error) {
  accesoConfirmado = false;
}

if (!accesoConfirmado) {
  $("contador").textContent =
    "Acceso institucional requerido.";
  return;
}

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

  
  // SIA-BIENESTAR-05G.20B
  // Refrescar el estado informativo
  // cuando el panel vuelva a estar visible.

  document.addEventListener(
    "visibilitychange",
    () => {
      if (document.visibilityState === "visible") {
        actualizarConexion();
      }
    }
  );

}

document.addEventListener(
  "DOMContentLoaded",
  iniciarAplicacion
);
