
/**
 * SIA-BIENESTAR-05G.25.5.1
 * Validador estructural de permisos BA.
 *
 * Sin red, IndexedDB ni modificaciones
 * de sesión o registros.
 */

"use strict";

(function () {

  const BASE = [
    "CONSULTAR",
    "CAPTURA_LOCAL",
    "ESCRIBIR",
    "ADMINISTRAR",
    "SINCRONIZAR"
  ];

  function validar(contrato) {

    if (
      !contrato ||
      typeof contrato !== "object" ||
      Array.isArray(contrato)
    ) {
      return {
        valido: false,
        version: null,
        editarBorrador: false
      };
    }

    const version = contrato.contrato;
    const permisos = contrato.permisos;

    const esBA01 =
      version === "SIA-PERMISOS-BA-01";

    const esBA02 =
      version === "SIA-PERMISOS-BA-02";

    if (
      (!esBA01 && !esBA02) ||
      !permisos ||
      typeof permisos !== "object" ||
      Array.isArray(permisos)
    ) {
      return {
        valido: false,
        version: null,
        editarBorrador: false
      };
    }

    const campos = esBA02
      ? [...BASE, "EDITAR_BORRADOR"]
      : [...BASE];

    const estructuraValida =
      Object.keys(permisos).length ===
        campos.length &&
      campos.every(campo =>
        Object.prototype.hasOwnProperty.call(
          permisos,
          campo
        ) &&
        typeof permisos[campo] === "boolean"
      );

    const restriccionesValidas =
      permisos.CONSULTAR === true &&
      permisos.CAPTURA_LOCAL === true &&
      permisos.ESCRIBIR === false &&
      permisos.ADMINISTRAR === false &&
      permisos.SINCRONIZAR === false;

    const valido =
      estructuraValida &&
      restriccionesValidas;

    return {
      valido,
      version: valido ? version : null,
      editarBorrador: Boolean(
        valido &&
        esBA02 &&
        permisos.EDITAR_BORRADOR === true
      )
    };
  }

  window.SIABanimPermisos05G25 =
    Object.freeze({
      validar
    });

})();
