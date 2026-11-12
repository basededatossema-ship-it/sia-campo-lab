
/**
 * SIA - BIENESTAR ANIMAL
 * ETAPA 05G.15A
 *
 * Conservacion local de una referencia
 * de identidad previamente verificada.
 *
 * No almacena tokens.
 * No autentica usuarios.
 * No concede autorizaciones.
 * No modifica IndexedDB.
 * No sincroniza informacion.
 */

(function () {
  "use strict";

  const CLAVE = "SIA_BA_IDENTIDAD_OFFLINE_05G15";
  const VIGENCIA_MS = 72 * 60 * 60 * 1000;

  function texto(valor) {
    return typeof valor === "string"
      ? valor.trim()
      : "";
  }

  function validar(identidad) {

    if (
      !identidad ||
      typeof identidad !== "object" ||
      Array.isArray(identidad)
    ) {
      return false;
    }

    const fecha = Date.parse(
      identidad.verificadoEn
    );

    const ahora = Date.now();

    return (
      !!texto(identidad.usuarioId) &&
      !!texto(identidad.nombreCompleto) &&
      identidad.modulo === "BIENESTAR_ANIMAL" &&
      identidad.permiso === "LEER" &&
      Number.isFinite(fecha) &&
      fecha <= ahora &&
      ahora - fecha <= VIGENCIA_MS
    );
  }

  function consultar() {

    let identidad;

    try {
      const contenido =
        localStorage.getItem(CLAVE);

      if (!contenido) {
        return null;
      }

      identidad = JSON.parse(contenido);

    } catch (error) {
      return null;
    }

    if (!validar(identidad)) {
      return null;
    }

    return {
      usuarioId: identidad.usuarioId,
      nombreCompleto: identidad.nombreCompleto,
      modulo: identidad.modulo,
      permiso: identidad.permiso,
      verificadoEn: identidad.verificadoEn
    };
  }

  function conservar(identidad) {

    if (!validar(identidad)) {
      throw new Error(
        "IDENTIDAD_INSTITUCIONAL_INVALIDA"
      );
    }

    const existente = consultar();

    if (
      existente &&
      existente.usuarioId !== identidad.usuarioId
    ) {
      throw new Error(
        "CAMBIO_DE_FUNCIONARIO_REQUIERE_REVISION"
      );
    }

    const referencia = {
      usuarioId: texto(identidad.usuarioId),
      nombreCompleto:
        texto(identidad.nombreCompleto),
      modulo: "BIENESTAR_ANIMAL",
      permiso: "LEER",
      verificadoEn: identidad.verificadoEn
    };

    localStorage.setItem(
      CLAVE,
      JSON.stringify(referencia)
    );

    return {
      ok: true,
      usuarioId: referencia.usuarioId
    };
  }

  function limpiar() {
    localStorage.removeItem(CLAVE);
  }

  window.SIABanimIdentidadOffline =
    Object.freeze({
      version: "05G.15A",
      consultar,
      conservar,
      limpiar
    });

})();
