
/**
 * SIA — banimApp BA-03.E.4
 * Controlador de envío institucional y cierre local seguro.
 *
 * No se vincula automáticamente al botón Enviar.
 * Depende de E.2 y E.3. E.3 permanece deshabilitado.
 * No almacena tokens ni elimina registros.
 *
 * Solo actualiza BORRADOR -> ENVIADO tras una
 * confirmación obtenida mediante E.3 y la
 * verificación de autoría y contenido.
 */

(function (root) {
  "use strict";

  const DB = "SIA_CAMPO_PWA_LAB";
  const STORE = "borradores";
  const ENVIOS = new Set();

  const CLAVES_SESION = [
    "SIA_BA_IDENTIDAD_05G14",
    "SIA_BA_ACCESO_GOOGLE_05G19A",
    "SIA_BA_PERMISOS_05G21I"
  ];

  function contexto() {
    try {
      const valores = CLAVES_SESION.map(
        k => sessionStorage.getItem(k)
      );

      if (valores.some(x => !x)) return null;

      const [identidad, acceso, permisos] =
        valores.map(x => JSON.parse(x));

      const id = identidad && identidad.usuarioId;
      const p = permisos && permisos.permisos;

      if (
        !id ||
        typeof id !== "string" ||
        identidad.modulo !== "BIENESTAR_ANIMAL" ||
        acceso.usuarioId !== id ||
        permisos.usuarioId !== id ||
        identidad.verificadoEn !== acceso.verificadoEn ||
        identidad.verificadoEn !== permisos.verificadoEn ||
        !p ||
        p.CONSULTAR !== true ||
        p.CAPTURA_LOCAL !== true ||
        p.ESCRIBIR !== false ||
        p.ADMINISTRAR !== false ||
        typeof p.SINCRONIZAR !== "boolean" ||
        typeof root.usuarioListado05G16B !== "function" ||
        root.usuarioListado05G16B() !== id
      ) {
        return null;
      }

      return { id, valores };
    } catch (_) {
      return null;
    }
  }

  function sesionIgual(c) {
    return !!c &&
      CLAVES_SESION.every(
        (k, i) =>
          sessionStorage.getItem(k) === c.valores[i]
      ) &&
      !!contexto() &&
      contexto().id === c.id;
  }

  function abrir() {
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(DB, 1);

      req.onupgradeneeded = () =>
        req.transaction.abort();

      req.onerror = () =>
        reject(new Error("BASE_LOCAL_NO_DISPONIBLE"));

      req.onblocked = () =>
        reject(new Error("BASE_LOCAL_BLOQUEADA"));

      req.onsuccess = () => {
        const base = req.result;

        if (!base.objectStoreNames.contains(STORE)) {
          base.close();

          reject(new Error(
            "ALMACEN_LOCAL_NO_DISPONIBLE"
          ));
        } else {
          resolve(base);
        }
      };
    });
  }

  async function leer(uuid) {
    const base = await abrir();

    try {
      return await new Promise((resolve, reject) => {
        const tx = base.transaction(STORE, "readonly");
        const req = tx.objectStore(STORE).get(uuid);

        let valor;

        req.onsuccess = () => {
          valor = req.result;
        };

        tx.oncomplete = () => resolve(valor);

        tx.onerror = () =>
          reject(new Error("LECTURA_LOCAL_FALLIDA"));

        tx.onabort = () =>
          reject(new Error("LECTURA_LOCAL_CANCELADA"));
      });
    } finally {
      base.close();
    }
  }

  function pertenece(registro, uuid, c) {
    return !!registro &&
      registro.id === uuid &&
      registro.estado === "BORRADOR" &&
      registro.formularioVersion === "BA-05F" &&
      !!registro.autoriaInstitucional &&
      registro.autoriaInstitucional.usuarioId === c.id &&
      registro.operacion_id ===
        "P04-" + uuid.toLowerCase().replace(/-/g, "");
  }

  async function cerrarTrasConfirmacion(
    uuid, original, c, confirmacion
  ) {
    const base = await abrir();

    try {
      return await new Promise((resolve, reject) => {
        const tx = base.transaction(STORE, "readwrite");
        const req = tx.objectStore(STORE).get(uuid);

        let estado = "NO_ACTUALIZADO";
        let causa = "CIERRE_LOCAL_CANCELADO";

        req.onsuccess = () => {
          const actual = req.result;

          if (
            !sesionIgual(c) ||
            !pertenece(actual, uuid, c) ||
            JSON.stringify(actual) !== original ||
            confirmacion.uuid !== uuid ||
            confirmacion.operacion_id !==
              actual.operacion_id ||
            confirmacion.recepcionConfirmada !== true
          ) {
            causa = "REGISTRO_O_SESION_CAMBIARON";
            tx.abort();
            return;
          }

          actual.estado = "ENVIADO";
          actual.confirmadoEn = new Date().toISOString();

          actual.confirmacionInstitucional = {
            contrato: "SIA-BA03-E1-01",
            uuid,
            operacion_id: actual.operacion_id,
            estado: "CONFIRMADA"
          };

          tx.objectStore(STORE).put(actual);
          estado = "ENVIADO";
        };

        tx.oncomplete = () => resolve(estado);

        tx.onerror = () =>
          reject(new Error(causa));

        tx.onabort = () =>
          reject(new Error(causa));
      });
    } finally {
      base.close();
    }
  }

  async function enviar(uuid, obtenerTokenGoogleNuevo) {
    if (
      typeof uuid !== "string" ||
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
        .test(uuid)
    ) {
      return {
        ok: false,
        motivo: "UUID_INVALIDO"
      };
    }

    if (ENVIOS.has(uuid)) {
      return {
        ok: false,
        motivo: "ENVIO_EN_CURSO"
      };
    }

    const transporte = root.SIABA03TransporteE3;

    if (
      !transporte ||
      transporte.envioHabilitado !== true
    ) {
      return {
        ok: false,
        motivo: "SINCRONIZACION_DESHABILITADA"
      };
    }

    const c = contexto();

    if (!c) {
      return {
        ok: false,
        motivo: "IDENTIDAD_NO_VERIFICADA"
      };
    }

    ENVIOS.add(uuid);

    try {
      const borrador = await leer(uuid);

      if (
        !sesionIgual(c) ||
        !pertenece(borrador, uuid, c)
      ) {
        return {
          ok: false,
          motivo: "BORRADOR_NO_AUTORIZADO"
        };
      }

      const original = JSON.stringify(borrador);

      const resultado =
        await transporte.enviarBorrador(
          borrador,
          obtenerTokenGoogleNuevo
        );

      if (
        !resultado ||
        resultado.ok !== true ||
        resultado.recepcionConfirmada !== true ||
        resultado.uuid !== uuid ||
        resultado.operacion_id !== borrador.operacion_id
      ) {
        return {
          ok: false,
          motivo:
            (resultado && resultado.motivo) ||
            "RECEPCION_NO_CONFIRMADA"
        };
      }

      try {
        await cerrarTrasConfirmacion(
          uuid,
          original,
          c,
          resultado
        );
      } catch (_) {
        return {
          ok: false,
          motivo:
            "CONFIRMADA_EN_SERVIDOR_PENDIENTE_CIERRE_LOCAL"
        };
      }

      return {
        ok: true,
        estado: "ENVIADO",
        uuid,
        operacion_id: borrador.operacion_id
      };

    } catch (_) {
      return {
        ok: false,
        motivo: "ENVIO_NO_COMPLETADO"
      };
    } finally {
      ENVIOS.delete(uuid);
    }
  }

  root.SIABA03ControlE4 = Object.freeze({
    enviar
  });

})(
  typeof globalThis !== "undefined"
    ? globalThis
    : this
);
