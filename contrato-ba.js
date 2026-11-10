
/**
 * banimApp — SIA Bienestar Animal
 * Etapa 05F.3A
 *
 * Adaptador de los formularios institucionales.
 * Sin IndexedDB, red ni escrituras.
 */

"use strict";

(function () {

  const CONTEOS = [
    "femenino", "masculino",
    "menores18", "edad18a28",
    "edad29a59", "mayores60",
    "desplazamiento",
    "otroHechoVictimizante",
    "otrasVictimas", "discapacitado",
    "desmovilizado", "reincorporado",
    "gestante", "cabezaHogar",
    "migrante", "adultoMayor",
    "ninguno", "afrodescendiente",
    "indigena", "rom",
    "heterosexual", "osigd"
  ];

  const EJES = [
    "ANIMALES DE COMPAÑÍA",
    "ANIMALES DE PRODUCCIÓN",
    "TRABAJO",
    "FAUNA SILVESTRE"
  ];

  const UUID =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

  function fechaValida(valor) {
    if (
      typeof valor !== "string" ||
      !/^\d{4}-\d{2}-\d{2}$/.test(valor)
    ) return false;

    const fecha = new Date(valor + "T12:00:00Z");

    return !isNaN(fecha.getTime()) &&
      fecha.toISOString().slice(0, 10) === valor;
  }

  function texto(valor) {
    return typeof valor === "string" &&
      valor.trim().length > 0;
  }

  function validarUbicacion(u, errores) {

    if (!u || typeof u !== "object" ||
        Array.isArray(u)) {
      errores.push("UBICACION_INVALIDA");
      return;
    }

    if (
      typeof u.longitud !== "number" ||
      !Number.isFinite(u.longitud) ||
      u.longitud < -180 || u.longitud > 180 ||
      typeof u.latitud !== "number" ||
      !Number.isFinite(u.latitud) ||
      u.latitud < -90 || u.latitud > 90
    ) {
      errores.push("COORDENADAS_INVALIDAS");
    }

    if (!texto(u.lugar)) {
      errores.push("LUGAR_REQUERIDO");
    }

    if (u.zona === "URBANA") {
      if (
        !/^COMUNA (10|[1-9])$/.test(u.comuna || "") ||
        !texto(u.barrio) ||
        u.corregimiento !== "N/A" ||
        u.vereda !== "N/A"
      ) {
        errores.push("UBICACION_URBANA_INVALIDA");
      }
    } else if (u.zona === "RURAL") {
      if (
        !/^CORREGIMIENTO [1-8]$/.test(
          u.corregimiento || ""
        ) ||
        !texto(u.vereda) ||
        u.comuna !== "N/A" ||
        u.barrio !== "N/A"
      ) {
        errores.push("UBICACION_RURAL_INVALIDA");
      }
    } else {
      errores.push("ZONA_INVALIDA");
    }
  }

  function validar(registro) {
    const errores = [];

    if (!registro ||
        typeof registro !== "object" ||
        Array.isArray(registro)) {
      return { ok: false, errores: ["REGISTRO_INVALIDO"] };
    }

    if (!UUID.test(registro.id || "")) {
      errores.push("UUID_INVALIDO");
    }

    const operacionEsperada =
      "P04-" + String(registro.id || "")
        .toLowerCase().replace(/-/g, "");

    if (registro.operacion_id !== operacionEsperada) {
      errores.push("OPERACION_INVALIDA");
    }

    const tipo = registro.tipo === "VISITA_TECNICA"
      ? "VISITA TECNICA"
      : registro.tipo;

    if (!["VISITA TECNICA", "SENSIBILIZACION"]
        .includes(tipo)) {
      errores.push("TIPO_INVALIDO");
    }

    const f = registro.formulario;

    if (!f || typeof f !== "object" ||
        Array.isArray(f)) {
      errores.push("FORMULARIO_INCOMPLETO");
      return {ok: false, errores};
    }

    validarUbicacion(f.ubicacion, errores);

    if (
      !texto(registro.creadoEn) ||
      isNaN(Date.parse(registro.creadoEn)) ||
      !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/
        .test(registro.creadoEn)
    ) {
      errores.push("FECHA_CAPTURA_INVALIDA");
    }

    for (const campo of [
      "fechaInforme", "fechaRadicado"
    ]) {
      if (
        f[campo] != null &&
        f[campo] !== "" &&
        !fechaValida(f[campo])
      ) {
        errores.push("FECHA_OPCIONAL_INVALIDA");
      }
    }

    for (const campo of [
      "numeroInforme", "numeroRadicado"
    ]) {
      if (
        f[campo] != null &&
        typeof f[campo] !== "string"
      ) {
        errores.push("DOCUMENTO_INVALIDO");
      }
    }

    if (tipo === "VISITA TECNICA") {
      if (!texto(f.asunto)) {
        errores.push("ASUNTO_REQUERIDO");
      }
      if (!fechaValida(f.fechaVisita)) {
        errores.push("FECHA_VISITA_INVALIDA");
      }
    }

    if (tipo === "SENSIBILIZACION") {

      if (f.meta !== "META 11") {
        errores.push("META_INVALIDA");
      }

      if (!EJES.includes(f.ejeEstrategico)) {
        errores.push("EJE_INVALIDO");
      }

      if (!texto(f.tematica)) {
        errores.push("TEMATICA_REQUERIDA");
      }

      if (!fechaValida(f.fechaActividad)) {
        errores.push("FECHA_ACTIVIDAD_INVALIDA");
      }

      const p = f.alcancePoblacional;

      if (!p || typeof p !== "object" ||
          Array.isArray(p)) {
        errores.push("ALCANCE_INVALIDO");
      } else {
        CONTEOS.forEach(campo => {
          if (
            !Number.isSafeInteger(p[campo]) ||
            p[campo] < 0
          ) {
            errores.push("CONTEO_INVALIDO_" + campo);
          }
        });

        if (
          Object.keys(p).some(
            campo => !CONTEOS.includes(campo)
          )
        ) {
          errores.push("CONTEOS_NO_RECONOCIDOS");
        }
      }
    }

    return {
      ok: errores.length === 0,
      errores
    };
  }

  function normalizar(registro) {

    const resultado = validar(registro);

    if (!resultado.ok) {
      return {
        ok: false,
        errores: resultado.errores
      };
    }

    const f = registro.formulario;

    const tipo = registro.tipo === "VISITA_TECNICA"
      ? "VISITA TECNICA"
      : registro.tipo;

    const salida = {
      uuid: registro.id,
      operacion_id: registro.operacion_id,
      tipo,
      fecha_captura: registro.creadoEn,
      ubicacion: {...f.ubicacion},
      numeroInforme: f.numeroInforme || "",
      fechaInforme: f.fechaInforme || ""
    };

    if (tipo === "VISITA TECNICA") {
      salida.asunto = f.asunto;
      salida.fechaVisita = f.fechaVisita;
      salida.poblacionComunidad =
        f.poblacionComunidad || "";
    } else {
      salida.meta = f.meta;
      salida.ejeEstrategico = f.ejeEstrategico;
      salida.tematica = f.tematica;
      salida.fechaActividad = f.fechaActividad;
      salida.numeroRadicado = f.numeroRadicado || "";
      salida.fechaRadicado = f.fechaRadicado || "";
      salida.alcancePoblacional = {
        ...f.alcancePoblacional
      };
    }

    return {
      ok: true,
      datos: salida
    };
  }

  window.SIABanimContrato = Object.freeze({
    version: "05F.3A",
    conteos: Object.freeze([...CONTEOS]),
    ejes: Object.freeze([...EJES]),
    validar,
    normalizar
  });

  // Pruebas sin efectos sobre los registros locales.
  const heredado = {
    id: "123e4567-e89b-42d3-a456-426614174000",
    operacion_id:
      "P04-123e4567e89b42d3a456426614174000",
    tipo: "VISITA_TECNICA",
    fecha: "2026-11-10",
    responsable: "PRUEBA",
    lugar: "PRUEBA",
    creadoEn: "2026-11-10T15:30:00-05:00"
  };

  const ubicacion = {
    zona: "URBANA",
    comuna: "COMUNA 1",
    barrio: "BARRIO FICTICIO",
    corregimiento: "N/A",
    vereda: "N/A",
    lugar: "SITIO FICTICIO",
    longitud: -73.62,
    latitud: 4.14
  };

  const visita = {
    ...heredado,
    formulario: {
      ubicacion,
      asunto: "Visita ficticia",
      fechaVisita: "2026-11-10"
    }
  };

  const conteos = Object.fromEntries(
    CONTEOS.map(campo => [campo, 0])
  );

  const sensibilizacion = {
    ...heredado,
    tipo: "SENSIBILIZACION",
    formulario: {
      ubicacion,
      meta: "META 11",
      ejeEstrategico: "FAUNA SILVESTRE",
      tematica: "Prueba ficticia",
      fechaActividad: "2026-11-10",
      alcancePoblacional: conteos
    }
  };

  const controles = {
    heredadoRechazado: !validar(heredado).ok,
    visitaValida: validar(visita).ok,
    sensibilizacionValida:
      validar(sensibilizacion).ok,
    normalizacionVisita:
      normalizar(visita).datos?.tipo ===
      "VISITA TECNICA",
    camposPoblacionales:
      CONTEOS.length === 22
  };

  console.info(
    "BA05F3A_CONTROLES:",
    JSON.stringify(controles)
  );

  console.info(
    Object.values(controles).every(Boolean)
      ? "SIA_BANIMAPP_05F3A_COMPATIBILIDAD_APROBADA"
      : "SIA_BANIMAPP_05F3A_COMPATIBILIDAD_RECHAZADA"
  );

})();
