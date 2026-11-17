
/**
 * SIA — Bienestar Animal BA-03.F.13
 * Reautenticación Google para único piloto BA-05F.
 * No cambia permisos, IndexedDB ni estados de registros.
 * Cancelar solo funciona mientras se espera la credencial.
 */
(function (root) {
  "use strict";

  const CLIENT_ID =
    "539376159794-mp0qjge29fhkudf2tdp9cu8knfq3qhlv.apps.googleusercontent.com";

  function sesion() {
    try {
      const i = JSON.parse(sessionStorage.getItem("SIA_BA_IDENTIDAD_05G14") || "null");
      const a = JSON.parse(sessionStorage.getItem("SIA_BA_ACCESO_GOOGLE_05G19A") || "null");
      const p = JSON.parse(sessionStorage.getItem("SIA_BA_PERMISOS_05G21I") || "null");

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

  let activo = false;

  function agregarAccion(contenedor, registro, usuarioId) {
    if (
      !contenedor || !registro ||
      registro.estado !== "BORRADOR" ||
      registro.formularioVersion !== "BA-05F" ||
      !registro.autoriaInstitucional ||
      registro.autoriaInstitucional.usuarioId !== usuarioId
    ) return;

    const boton = document.createElement("button");
    boton.type = "button";
    boton.className = "secondary-button";
    boton.textContent = "Enviar al SIA (no habilitado)";

    const transporte = root.SIABA03TransporteE3;
    const habilitado = Boolean(
      transporte && transporte.envioHabilitado === true &&
      typeof transporte.esPiloto === "function" &&
      transporte.esPiloto(registro)
    );

    boton.disabled = !habilitado;
    contenedor.appendChild(boton);
    if (!habilitado) return;

    const zonaGoogle = document.createElement("div");
    zonaGoogle.hidden = true;
    zonaGoogle.setAttribute("aria-label", "Confirmar identidad Google para envío");
    contenedor.appendChild(zonaGoogle);

    const mensaje = document.createElement("p");
    mensaje.setAttribute("role", "status");
    contenedor.appendChild(mensaje);

    const cancelar = document.createElement("button");
    cancelar.type = "button";
    cancelar.className = "secondary-button";
    cancelar.textContent = "Cancelar verificación";
    cancelar.hidden = true;
    contenedor.appendChild(cancelar);

    boton.textContent = "Enviar al SIA";
    let fase = "reposo";
    let intento = 0;

    function cerrarEspera(texto) {
      // Solo permite cancelar antes del inicio de control.enviar().
      if (fase !== "esperando") return;
      intento++;
      fase = "reposo";
      activo = false;
      boton.disabled = false;
      cancelar.hidden = true;
      zonaGoogle.replaceChildren();
      zonaGoogle.hidden = true;
      mensaje.textContent = texto;
    }

    cancelar.addEventListener("click", () => {
      cerrarEspera("Verificación cancelada. No se inició el envío.");
    });

    boton.addEventListener("click", () => {
      if (fase !== "reposo" || activo) {
        mensaje.textContent = "Ya existe una verificación en curso.";
        return;
      }
      if (sesion() !== usuarioId) {
        mensaje.textContent =
          "Sesión institucional no válida. Vuelve a ingresar desde el acceso institucional.";
        return;
      }

      const googleId = root.google && root.google.accounts && root.google.accounts.id;
      const control = root.SIABA03ControlE4;
      if (!googleId || typeof googleId.initialize !== "function" ||
          typeof googleId.renderButton !== "function" ||
          !control || typeof control.enviar !== "function") {
        mensaje.textContent = "Autenticación Google o envío no disponible.";
        return;
      }

      activo = true;
      fase = "esperando";
      const numero = ++intento;
      boton.disabled = true;
      cancelar.hidden = false;
      zonaGoogle.hidden = false;
      zonaGoogle.replaceChildren();
      mensaje.textContent = "Confirma tu cuenta Google para este envío.";

      try {
        googleId.initialize({
          client_id: CLIENT_ID,
          ux_mode: "popup",
          auto_select: false,
          callback: async credencial => {
            // Ignora credenciales tardías de intentos cancelados.
            if (numero !== intento || fase !== "esperando") return;
            const token = credencial && credencial.credential;
            if (typeof token !== "string" || !token || sesion() !== usuarioId) {
              cerrarEspera("Identidad Google no verificada. No se inició el envío.");
              return;
            }

            // Desde este punto NO se permite cancelar ni reintentar:
            // el resultado HTTP podría ser incierto.
            fase = "enviando";
            cancelar.hidden = true;
            zonaGoogle.replaceChildren();
            zonaGoogle.hidden = true;
            mensaje.textContent = "Verificando recepción institucional...";
            try {
              const resultado = await control.enviar(registro.id, async () => token);
              if (resultado && resultado.ok === true) {
                fase = "terminado";
                mensaje.textContent = "Recepción institucional confirmada.";
                if (typeof root.mostrarRegistros === "function") {
                  try { await root.mostrarRegistros(); } catch (_) { /* mensaje conservado */ }
                }
              } else {
                fase = "indeterminado";
                mensaje.textContent =
                  "Envío no confirmado: " +
                  ((resultado && resultado.motivo) || "ERROR") +
                  ". Comprueba BA_OPERACIONES_ENVIO antes de repetir.";
              }
            } catch (_) {
              fase = "indeterminado";
              mensaje.textContent =
                "No se pudo verificar la recepción. Comprueba BA_OPERACIONES_ENVIO antes de repetir.";
            } finally {
              activo = false;
              // Botón no vuelve a habilitarse tras una solicitud incierta.
            }
          }
        });

        googleId.renderButton(zonaGoogle, {
          theme: "outline",
          size: "large",
          text: "signin_with"
        });
      } catch (_) {
        cerrarEspera("No fue posible abrir la verificación Google. No se inició el envío.");
      }
    });
  }

  root.SIABA03GoogleE5 = Object.freeze({ agregarAccion });
})(typeof globalThis !== "undefined" ? globalThis : this);
