
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

  /**
   * SIA-BIENESTAR-05G.16D.3
   *
   * Identifica al titular de la referencia
   * local aunque hayan pasado 72 horas.
   *
   * NO autentica ni autoriza.
   * NO recupera sesiones vencidas.
   */

  function consultarTitular() {

    const contenido =
      localStorage.getItem(CLAVE);

    if (contenido === null) {
      return null;
    }

    let identidad;

    try {
      identidad = JSON.parse(contenido);
    } catch (error) {
      throw new Error(
        "REFERENCIA_LOCAL_REQUIERE_REVISION"
      );
    }

    if (
      !identidad ||
      typeof identidad !== "object" ||
      Array.isArray(identidad) ||
      !texto(identidad.usuarioId) ||
      !texto(identidad.nombreCompleto) ||
      identidad.modulo !== "BIENESTAR_ANIMAL" ||
      identidad.permiso !== "LEER" ||
      typeof identidad.verificadoEn !== "string" ||
      !Number.isFinite(
        Date.parse(identidad.verificadoEn)
      )
    ) {
      throw new Error(
        "REFERENCIA_LOCAL_REQUIERE_REVISION"
      );
    }

    return {
      usuarioId: texto(identidad.usuarioId),
      nombreCompleto:
        texto(identidad.nombreCompleto),
      modulo: "BIENESTAR_ANIMAL",
      permiso: "LEER",
      verificadoEn: identidad.verificadoEn
    };
  }

  function conservar(identidad) {

    if (!validar(identidad)) {
      throw new Error(
        "IDENTIDAD_INSTITUCIONAL_INVALIDA"
      );
    }

    const existente = consultarTitular();

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

  
  /**
   * SIA-BIENESTAR-05G.16D.1
   *
   * Sustitucion controlada de referencia local.
   *
   * Debe invocarse solamente despues de:
   * - Nueva verificacion Google.
   * - Autorizacion del Servicio Central.
   * - Confirmacion expresa del cambio.
   *
   * No modifica registros ni IndexedDB.
   */

  function cambiarFuncionario(
    nuevaIdentidad,
    usuarioAnteriorId
  ) {

    if (!validar(nuevaIdentidad)) {
      throw new Error(
        "NUEVA_IDENTIDAD_INVALIDA"
      );
    }

    const anterior = consultarTitular();

    if (
      !anterior ||
      anterior.usuarioId !== usuarioAnteriorId
    ) {
      throw new Error(
        "IDENTIDAD_ANTERIOR_NO_COINCIDE"
      );
    }

    const nuevoId = texto(
      nuevaIdentidad.usuarioId
    );

    if (nuevoId === anterior.usuarioId) {
      throw new Error(
        "NO_EXISTE_CAMBIO_DE_FUNCIONARIO"
      );
    }

    const referencia = {
      usuarioId: nuevoId,
      nombreCompleto:
        texto(nuevaIdentidad.nombreCompleto),
      modulo: "BIENESTAR_ANIMAL",
      permiso: "LEER",
      verificadoEn: nuevaIdentidad.verificadoEn
    };

    // Sustituye una sola referencia local.
    // Si falla la escritura, no se elimina
    // previamente la identidad anterior.

    localStorage.setItem(
      CLAVE,
      JSON.stringify(referencia)
    );

    return {
      ok: true,
      cambiado: true,
      usuarioId: nuevoId
    };
  }


  
  window.SIABanimIdentidadOffline =
    Object.freeze({
      version: "05G.16D.3",
      consultar,
      consultarTitular,
      conservar,
      cambiarFuncionario,
      limpiar
    });

