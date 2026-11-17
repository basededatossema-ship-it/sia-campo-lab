
/**
 * SIA — Bienestar Animal BA-03.E.5
 * Interfaz de reautenticación Google para enviar registros BA-05F.
 * El envío permanece bloqueado en ba03-transporte-e3.js.
 * No modifica IndexedDB, permisos ni tokens persistentes.
 */
(function (root) {
  "use strict";

  const CLIENT_ID =
    "539376159794-mp0qjge29fhkudf2tdp9cu8knfq3qhlv.apps.googleusercontent.com";

  const sesion = () => {
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
        p.permisos.SINCRONIZAR === false &&
        typeof root.usuarioListado05G16B === "function" &&
        root.usuarioListado05G16B() === i.usuarioId
        ? i.usuarioId : null;

    } catch (_) {
      return null;
    }
  };

  let activo = false;

  function agregarAccion(contenedor, registro, usuarioId) {

    if (
      !contenedor ||
      !registro ||
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

    const habilitado = !!transporte &&
      transporte.envioHabilitado === true;

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

    const mensaje = document.createElement("p");
    mensaje.setAttribute("role", "status");
    contenedor.appendChild(mensaje);

    boton.textContent = "Enviar al SIA";

    boton.addEventListener("click", () => {

      if (activo || sesion() !== usuarioId) {
        mensaje.textContent =
          "No se puede verificar la sesión institucional.";
        return;
      }

      const googleId = root.google &&
        root.google.accounts &&
        root.google.accounts.id;

      const control = root.SIABA03ControlE4;

      if (
        !googleId ||
        !control ||
        typeof control.enviar !== "function"
      ) {
        mensaje.textContent =
          "Autenticación Google o envío no disponible.";
        return;
      }

      activo = true;
      boton.disabled = true;
      zonaGoogle.hidden = false;
      zonaGoogle.replaceChildren();

      mensaje.textContent =
        "Confirma tu cuenta Google para este envío.";

      googleId.initialize({
        client_id: CLIENT_ID,
        ux_mode: "popup",
        auto_select: false,

        callback: async credencial => {

          const token =
            credencial && credencial.credential;

          if (
            typeof token !== "string" ||
            !token ||
            sesion() !== usuarioId
          ) {
            mensaje.textContent =
              "Identidad Google no verificada.";

            activo = false;
            boton.disabled = false;
            zonaGoogle.replaceChildren();
            zonaGoogle.hidden = true;
            return;
          }

          zonaGoogle.replaceChildren();
          zonaGoogle.hidden = true;

          mensaje.textContent =
            "Verificando recepción institucional...";

          try {
            const resultado = await control.enviar(
              registro.id,
              async () => token
            );

            mensaje.textContent =
              resultado && resultado.ok === true
                ? "Recepción institucional confirmada."
                : "Envío no confirmado: " +
                  (resultado && resultado.motivo || "ERROR");

            if (
              resultado &&
              resultado.ok === true &&
              typeof root.mostrarRegistros === "function"
            ) {
              await root.mostrarRegistros();
            }

          } catch (_) {
            mensaje.textContent =
              "No se pudo confirmar el envío.";

          } finally {
            activo = false;
            boton.disabled = false;
          }
        }
      });

      googleId.renderButton(zonaGoogle, {
        theme: "outline",
        size: "large",
        text: "signin_with"
      });
    });
  }

  root.SIABA03GoogleE5 =
    Object.freeze({ agregarAccion });

})(
  typeof globalThis !== "undefined"
    ? globalThis
    : this
);
