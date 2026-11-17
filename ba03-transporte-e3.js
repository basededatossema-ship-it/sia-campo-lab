
/**
 * SIA — banimApp BA-03.E.3 | Transporte institucional preparado.
 * INSTALACIÓN SEGURA: no envía solicitudes HTTP mientras
 * BA03_E3_ENVIO_HABILITADO sea false.
 *
 * No lee ni modifica IndexedDB, no cambia estados de borradores,
 * no almacena tokens y no concede permisos.
 */
(function (root) {
  "use strict";

  // Debe permanecer false hasta comprobar escritura real, autorización,
  // despliegue web y confirmación institucional de extremo a extremo.
  const BA03_E3_ENVIO_HABILITADO = false;
  
/**
 * BA-03.F.6
 * Restricción adicional del piloto en banimApp.
 * La autorización definitiva permanece en el servidor.
 */
const BA03_E3_UUID_PILOTO =
  "7fbb0fcf-bf30-4e3b-ac18-80fab5b0b002";

function siaBA03E3EsPiloto_(registro) {
  if (
    !registro ||
    typeof registro !== "object" ||
    Array.isArray(registro)
  ) {
    return false;
  }

  const uuid = BA03_E3_UUID_PILOTO;

  return (
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
      .test(uuid) &&
    registro.id === uuid &&
    registro.operacion_id ===
      "P04-" + uuid.replace(/-/g, "")
  );
}

  const OPERACION = "ENVIAR_REGISTRO_BANIMAPP";
  const URL_CENTRAL =
    "https://script.google.com/macros/s/AKfycbx8xZx31rH7LERYaSrwv6NzdNHjVKP0-AH_y6WZGSrp3IeOekC6JbgEFx-K4S0Ywg77/exec";

  function prepararSolicitud(borrador, idToken) {
    const contrato = root && root.SIABanimContrato;
    const confirmacion = root && root.SIABA03EnvioE2;

    if (!contrato || !confirmacion) {
      return {
        ok: false,
        motivo: "DEPENDENCIAS_NO_DISPONIBLES"
      };
    }

    const preparado =
      confirmacion.prepararRegistroLocal(borrador, contrato);

    if (!preparado || preparado.ok !== true) {
      return {
        ok: false,
        motivo: (preparado && preparado.motivo) ||
          "FORMULARIO_INVALIDO"
      };
    }

    if (
      typeof idToken !== "string" ||
      !idToken.trim() ||
      idToken.length > 8192
    ) {
      return {
        ok: false,
        motivo: "TOKEN_GOOGLE_REQUERIDO"
      };
    }

    return {
      ok: true,
      solicitud: {
        operacion: OPERACION,
        idToken,
        registro: preparado.registro
      }
    };
  }

  async function enviarBorrador(borrador, obtenerToken) {
    // Rechazo antes de acceder a la identidad o a la red.
    if (!BA03_E3_ENVIO_HABILITADO) {
      return {
        ok: false,
        motivo: "SINCRONIZACION_DESHABILITADA",
        recepcionConfirmada: false
      };
    }
    
if (!siaBA03E3EsPiloto_(borrador)) {
  return {
    ok: false,
    motivo: "REGISTRO_FUERA_DEL_PILOTO",
    recepcionConfirmada: false
  };
}

    if (typeof obtenerToken !== "function") {
      return {
        ok: false,
        motivo: "IDENTIDAD_NO_DISPONIBLE",
        recepcionConfirmada: false
      };
    }

    // El token debe ser NUEVO, obtenido mediante Google
    // en la sesión activa.
    // Nunca se lee de localStorage/sessionStorage
    // ni se conserva en IndexedDB.
    let token;

    try {
      token = await obtenerToken();
    } catch (_) {
      return {
        ok: false,
        motivo: "IDENTIDAD_NO_VERIFICADA",
        recepcionConfirmada: false
      };
    }

    const preparado = prepararSolicitud(borrador, token);
    token = null;

    if (!preparado.ok) {
      return {
        ok: false,
        motivo: preparado.motivo,
        recepcionConfirmada: false
      };
    }

    // NOTA: verificar transporte cross-origin de Apps Script
    // antes de activar.
    // Nunca utilizar mode: 'no-cors':
    // impediría verificar la confirmación.
    let respuesta;

    try {
      const http = await fetch(URL_CENTRAL, {
        method: "POST",
        headers: {
          "Content-Type": "text/plain;charset=utf-8"
        },
        body: JSON.stringify(preparado.solicitud),
        redirect: "follow",
        cache: "no-store",
        credentials: "omit"
      });

      if (!http.ok) {
        throw new Error("HTTP_NO_OK");
      }

      respuesta = await http.json();

    } catch (_) {
      return {
        ok: false,
        motivo: "RESPUESTA_NO_VERIFICABLE",
        recepcionConfirmada: false
      };
    }

    const verificada =
      root.SIABA03EnvioE2.verificarConfirmacion(
        preparado.solicitud.registro,
        respuesta
      );

    
/**
 * BA-03.F.17
 * Diagnóstico controlado de rechazo institucional.
 * No muestra tokens, datos personales ni
 * estructuras internas del Servicio Central.
 */
if (!verificada.confirmada) {

  const motivosAdmitidos = new Set([
    "SOLICITUD_INVALIDA",
    "ENVIO_DESHABILITADO",
    "PILOTO_NO_CONFIGURADO",
    "OPERACION_NO_AUTORIZADA",
    "ENVIO_NO_AUTORIZADO",
    "ENVIO_NO_CONFIRMADO"
  ]);

  const contratoValido = Boolean(
    respuesta &&
    typeof respuesta === "object" &&
    !Array.isArray(respuesta) &&
    respuesta.contrato === "SIA-BA03-E1-01" &&
    respuesta.ok === false &&
    respuesta.recepcionConfirmada === false
  );

  const motivo =
    contratoValido &&
    typeof respuesta.motivo === "string" &&
    motivosAdmitidos.has(respuesta.motivo)
      ? respuesta.motivo
      : "RECEPCION_NO_CONFIRMADA";

  return {
    ok: false,
    motivo,
    recepcionConfirmada: false
  };
}


    // El componente NO marca ni elimina borradores.
    // Esa transición requerirá una transacción
    // local con comprobación de autoría.
    return {
      ok: true,
      recepcionConfirmada: true,
      uuid: verificada.uuid,
      operacion_id: verificada.operacion_id
    };
  }

  
root.SIABA03TransporteE3 = Object.freeze({
  envioHabilitado: BA03_E3_ENVIO_HABILITADO,
  esPiloto: siaBA03E3EsPiloto_,
  prepararSolicitud,
  enviarBorrador
});


})(
  typeof globalThis !== "undefined"
    ? globalThis
    : this
);
