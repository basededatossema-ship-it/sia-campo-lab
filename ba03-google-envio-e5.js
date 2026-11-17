
/**
 * SIA — Bienestar Animal BA-03.F.13.2
 * Reautenticación Google del piloto BA-05F.
 *
 * Una verificación activa a la vez.
 * Cancelación solo antes del envío HTTP.
 * No modifica permisos ni IndexedDB.
 */
(function (root) {
  "use strict";

  const CLIENT_ID =
    "539376159794-mp0qjge29fhkudf2tdp9cu8knfq3qhlv.apps.googleusercontent.com";

  let activo = false;
  let secuencia = 0;

  function sesion() {
    try {
      const i = JSON.parse(
        sessionStorage.getItem("SIA_BA_IDENTIDAD_05G14") || "null"
      );
      const a = JSON.parse(
        sessionStorage.getItem("SIA_BA_ACCESO_GOOGLE_05G19A") || "null"
      );
      const p = JSON.parse(
        sessionStorage.getItem("SIA_BA_PERMISOS_05G21I") || "null"
      );

      return i && a && p && i.usuarioId &&
        i.usuarioId === a.usuarioId &&
        i.usuarioId === p.usuarioId &&
        i.verificadoEn === a.verificadoEn &&
        i.verificadoEn === p.verificadoEn &&
        i.modulo === "BIENESTAR_ANIMAL" &&
        p.permisos &&
        typeof p.permisos.SINCRONIZAR === "boolean" &&
        typeof root.usuarioListado05G16B === "function" &&
        root.usuarioListado05G16B() === i.usuarioId
          ? i.usuarioId : null;
    } catch (_) {
      return null;
    }
  }

  function agregarAccion(contenedor, registro, usuarioId) {
    if (
      !contenedor ||
      !registro ||
      registro.estado !== "BORRADOR" ||
      registro.formularioVersion !== "BA-05F" ||
      !registro.autoriaInstitucional ||
      registro.autoriaInstitucional.usuarioId !== usuarioId
    ) return;

    const transporte = root.SIABA03TransporteE3;

    const habilitado = Boolean(
      transporte &&
      transporte.envioHabilitado === true &&
      typeof transporte.esPiloto === "function" &&
      transporte.esPiloto(registro)
    );

    const boton = document.createElement("button");
    boton.type = "button";
    boton.className = "secondary-button";
    boton.textContent = habilitado
      ? "Enviar al SIA"
      : "Enviar al SIA (no habilitado)";
    boton.disabled = !habilitado;
    contenedor.appendChild(boton);

    if (!habilitado) return;

    const zonaGoogle = document.createElement("div");
    zonaGoogle.hidden = true;
    zonaGoogle.setAttribute(
      "aria-label",
      "Confirmar identidad Google para envío"
    );
    contenedor.appendChild(zonaGoogle);

    const cancelar = document.createElement("button");
    cancelar.type = "button";
    cancelar.className = "secondary-button";
    cancelar.textContent = "Cancelar verificación";
    cancelar.hidden = true;
    contenedor.appendChild(cancelar);

    const mensaje = document.createElement("p");
    mensaje.setAttribute("role", "status");
    contenedor.appendChild(mensaje);

    let fase = "reposo";
    let intentoActual = 0;

    function cerrarEspera(texto) {
      if (fase !== "esperando") return;

      secuencia++;
      intentoActual = 0;
      fase = "reposo";
      activo = false;
      boton.disabled = false;
      cancelar.hidden = true;
      zonaGoogle.replaceChildren();
      zonaGoogle.hidden = true;
      mensaje.textContent = texto;
    }

    cancelar.addEventListener("click", () => {
      cerrarEspera(
        "Verificación cancelada. No se inició el envío."
      );
    });

    boton.addEventListener("click", () => {
      if (fase !== "reposo" || activo) {
        mensaje.textContent =
          "Ya existe una verificación en curso.";
        return;
      }

      if (sesion() !== usuarioId) {
        mensaje.textContent =
          "Sesión institucional no válida. " +
          "Vuelve a ingresar desde el acceso institucional.";
        return;
      }

      const googleId =
        root.google &&
        root.google.accounts &&
        root.google.accounts.id;

      const control = root.SIABA03ControlE4;

      if (
        !googleId ||
        typeof googleId.initialize !== "function" ||
        typeof googleId.renderButton !== "function" ||
        !control ||
        typeof control.enviar !== "function"
      ) {
        mensaje.textContent =
          "Autenticación Google o envío no disponible.";
        return;
      }

      const intento = ++secuencia;
      intentoActual = intento;
      activo = true;
      fase = "esperando";

      boton.disabled = true;
      cancelar.hidden = false;
      cancelar.disabled = false;
      zonaGoogle.hidden = false;
      zonaGoogle.replaceChildren();

      mensaje.textContent =
        "Confirma tu cuenta Google para este envío.";

      try {
        googleId.initialize({
          client_id: CLIENT_ID,
          ux_mode: "popup",
          auto_select: false,

          callback: async credencial => {
            if (
              intento !== secuencia ||
              intentoActual !== intento ||
              !activo ||
              fase !== "esperando"
            ) return;

            const token =
              credencial && credencial.credential;

            if (
              typeof token !== "string" ||
              !token ||
              sesion() !== usuarioId
            ) {
              cerrarEspera(
                "Identidad Google no verificada. " +
                "No se inició el envío."
              );
              return;
            }

            // A partir de aquí ya puede comenzar
            // la comunicación HTTP. No cancelar.
            fase = "enviando";
            cancelar.hidden = true;
            cancelar.disabled = true;
            zonaGoogle.replaceChildren();
            zonaGoogle.hidden = true;

            mensaje.textContent =
              "Verificando recepción institucional...";

            try {
              const resultado = await control.enviar(
                registro.id,
                async () => token
              );

              if (resultado && resultado.ok === true) {
                fase = "terminado";
                mensaje.textContent =
                  "Recepción institucional confirmada.";

                if (
                  typeof root.mostrarRegistros === "function"
                ) {
                  try {
                    await root.mostrarRegistros();
                  } catch (_) {
                    // Conservar confirmación visible.
                  }
                }
              } else {
                fase = "indeterminado";
                mensaje.textContent =
                  "Envío no confirmado: " +
                  ((resultado && resultado.motivo) ||
                    "ERROR") +
                  ". Verifica BA_OPERACIONES_ENVIO " +
                  "antes de repetir.";
              }
            } catch (_) {
              fase = "indeterminado";
              mensaje.textContent =
                "No se pudo verificar la recepción. " +
                "Comprueba BA_OPERACIONES_ENVIO " +
                "antes de repetir.";
            } finally {
              activo = false;

              // No reactivar el botón tras un
              // resultado confirmado o incierto.
              boton.disabled = true;
            }
          }
        });

        googleId.renderButton(zonaGoogle, {
          theme: "outline",
          size: "large",
          text: "signin_with"
        });

      } catch (_) {
        cerrarEspera(
          "No fue posible abrir Google. " +
          "No se inició el envío."
        );
      }
    });
  }

  root.SIABA03GoogleE5 =
    Object.freeze({ agregarAccion });

})(
  typeof globalThis !== "undefined"
    ? globalThis
    : this
);
