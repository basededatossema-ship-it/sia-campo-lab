
/**
 * SIA - BIENESTAR ANIMAL
 * ETAPA 05G.12
 *
 * Receptor de identidad institucional.
 *
 * No autentica usuarios.
 * No almacena tokens.
 * No modifica IndexedDB.
 * No habilita sincronizacion.
 */

(function () {
  "use strict";

  let identidadActual = null;

  function texto(valor) {
    return typeof valor === "string"
      ? valor.trim()
      : "";
  }

  function recibir(respuesta) {

    // Nunca conservar una identidad anterior
    // al procesar otra respuesta.
    identidadActual = null;

    if (
      !respuesta ||
      respuesta.ok !== true ||
      respuesta.motivo !== "AUTORIZADO" ||
      !respuesta.responsable
    ) {
      return {
        ok: false,
        motivo: "IDENTIDAD_NO_AUTORIZADA"
      };
    }

    const origen = respuesta.responsable;

    const usuarioId = texto(origen.usuarioId);
    const nombreCompleto =
      texto(origen.nombreCompleto);

    const fecha = texto(origen.verificadoEn);

    if (
      !usuarioId ||
      !nombreCompleto ||
      origen.modulo !== "BIENESTAR_ANIMAL" ||
      origen.permiso !== "LEER" ||
      !fecha ||
      !Number.isFinite(Date.parse(fecha))
    ) {
      return {
        ok: false,
        motivo: "CONTRATO_IDENTIDAD_INVALIDO"
      };
    }

    // Identidad temporal para presentacion.
    // No representa una autorizacion de escritura.
    identidadActual = Object.freeze({
      usuarioId,
      nombreCompleto,
      modulo: "BIENESTAR_ANIMAL",
      permiso: "LEER",
      verificadoEn: fecha
    });

    return {
      ok: true,
      motivo: "IDENTIDAD_RECIBIDA"
    };
  }

  function consultar() {
    return identidadActual
      ? { ...identidadActual }
      : null;
  }

  function limpiar() {
    identidadActual = null;
  }

  window.SIABanimResponsable = Object.freeze({
    version: "05G.12",
    recibir,
    consultar,
    limpiar
  });

})();
