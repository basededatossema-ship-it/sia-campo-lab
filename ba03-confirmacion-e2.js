
/**
 * SIA — banimApp BA-03.E.2
 * Contrato estricto de confirmación del Servicio Central.
 *
 * Módulo de preparación sin efectos secundarios:
 * - No transmite formularios, tokens ni otros datos.
 * - No escribe, elimina ni cambia el estado de IndexedDB.
 * - No concede permisos ni habilita SINCRONIZAR.
 * - Acepta solo el formato normalizado producido por contrato-ba.js.
 */

(function (root) {
  "use strict";

  const CONTRATO = "SIA-BA03-E1-01";

  const UUID =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

  const tiene = (obj, clave) =>
    Object.prototype.hasOwnProperty.call(obj, clave);

  function prepararRegistroLocal(borrador, contratoBA) {
    if (
      !borrador ||
      typeof borrador !== "object" ||
      Array.isArray(borrador) ||
      borrador.estado !== "BORRADOR" ||
      borrador.formularioVersion !== "BA-05F"
    ) {
      return {
        ok: false,
        motivo: "BORRADOR_NO_ADMITIDO"
      };
    }

    if (
      !contratoBA ||
      typeof contratoBA.normalizar !== "function"
    ) {
      return {
        ok: false,
        motivo: "CONTRATO_LOCAL_NO_DISPONIBLE"
      };
    }

    let resultado;

    try {
      resultado = contratoBA.normalizar(borrador);
    } catch (_) {
      return {
        ok: false,
        motivo: "FORMULARIO_NO_VALIDO"
      };
    }

    if (
      !resultado ||
      resultado.ok !== true ||
      !resultado.datos
    ) {
      return {
        ok: false,
        motivo: "FORMULARIO_NO_VALIDO"
      };
    }

    const registro = resultado.datos;
    const uuid = registro.uuid;

    if (
      typeof uuid !== "string" ||
      !UUID.test(uuid) ||
      uuid !== borrador.id ||
      registro.operacion_id !==
        "P04-" + uuid.toLowerCase().replace(/-/g, "") ||
      registro.operacion_id !== borrador.operacion_id ||
      ![
        "VISITA TECNICA",
        "SENSIBILIZACION"
      ].includes(registro.tipo)
    ) {
      return {
        ok: false,
        motivo: "IDENTIFICADORES_INCONSISTENTES"
      };
    }

    return {
      ok: true,
      registro
    };
  }

  function verificarConfirmacion(registro, respuesta) {
    if (
      !registro ||
      typeof registro !== "object" ||
      Array.isArray(registro) ||
      !respuesta ||
      typeof respuesta !== "object" ||
      Array.isArray(respuesta)
    ) {
      return {
        confirmada: false,
        motivo: "RESPUESTA_INVALIDA"
      };
    }

    const uuid = registro.uuid;

    if (
      typeof uuid !== "string" ||
      !UUID.test(uuid) ||
      typeof registro.operacion_id !== "string" ||
      registro.operacion_id !==
        "P04-" + uuid.toLowerCase().replace(/-/g, "")
    ) {
      return {
        confirmada: false,
        motivo: "IDENTIFICADORES_INVALIDOS"
      };
    }

    const confirmada =
      respuesta.ok === true &&
      respuesta.contrato === CONTRATO &&
      respuesta.estado === "CONFIRMADA" &&
      respuesta.recepcionConfirmada === true &&
      tiene(respuesta, "uuid") &&
      respuesta.uuid === uuid &&
      tiene(respuesta, "operacion_id") &&
      respuesta.operacion_id === registro.operacion_id;

    return confirmada
      ? {
          confirmada: true,
          uuid,
          operacion_id: registro.operacion_id
        }
      : {
          confirmada: false,
          motivo: "RECEPCION_NO_CONFIRMADA"
        };
  }

  const api = Object.freeze({
    prepararRegistroLocal,
    verificarConfirmacion
  });

  if (
    typeof module === "object" &&
    module.exports
  ) {
    module.exports = api;
  }

  if (root) {
    root.SIABA03EnvioE2 = api;
  }

})(
  typeof globalThis === "object"
    ? globalThis
    : null
);
