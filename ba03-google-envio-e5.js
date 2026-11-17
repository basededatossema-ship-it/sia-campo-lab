
/**
 * SIA — Bienestar Animal BA-03.F.15.1
 * Acceso a autenticación independiente del piloto.
 *
 * No solicita credenciales.
 * No envía formularios.
 * No modifica IndexedDB ni permisos.
 *
 * La página de destino conserva su propio
 * bloqueo de escritura F15.
 */
(function (root) {
  "use strict";

  const PAGINA_PILOTO = "./envio-ba03-piloto.html";

  function sesionValida(usuarioId) {
    try {
      const identidad = JSON.parse(
        sessionStorage.getItem(
          "SIA_BA_IDENTIDAD_05G14"
        ) || "null"
      );

      const acceso = JSON.parse(
        sessionStorage.getItem(
          "SIA_BA_ACCESO_GOOGLE_05G19A"
        ) || "null"
      );

      const contrato = JSON.parse(
        sessionStorage.getItem(
          "SIA_BA_PERMISOS_05G21I"
        ) || "null"
      );

      const permisos = contrato && contrato.permisos;

      return Boolean(
        identidad &&
        acceso &&
        contrato &&
        permisos &&
        identidad.usuarioId === usuarioId &&
        acceso.usuarioId === usuarioId &&
        contrato.usuarioId === usuarioId &&
        identidad.verificadoEn === acceso.verificadoEn &&
        identidad.verificadoEn === contrato.verificadoEn &&
        identidad.modulo === "BIENESTAR_ANIMAL" &&
        contrato.contrato === "SIA-PERMISOS-BA-01" &&
        permisos.CONSULTAR === true &&
        permisos.CAPTURA_LOCAL === true &&
        permisos.ESCRIBIR === false &&
        permisos.ADMINISTRAR === false &&
        typeof permisos.SINCRONIZAR === "boolean" &&
        typeof root.usuarioListado05G16B === "function" &&
        root.usuarioListado05G16B() === usuarioId
      );
    } catch (_) {
      return false;
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
    ) {
      return;
    }

    const transporte = root.SIABA03TransporteE3;

    const esPiloto = Boolean(
      transporte &&
      typeof transporte.esPiloto === "function" &&
      transporte.esPiloto(registro)
    );

    const boton = document.createElement("button");

    boton.type = "button";
    boton.className = "secondary-button";
    boton.textContent = esPiloto
      ? "Verificar Google — piloto"
      : "Enviar al SIA (no habilitado)";

    boton.disabled = !esPiloto;
    contenedor.appendChild(boton);

    if (!esPiloto) return;

    const mensaje = document.createElement("p");
    mensaje.setAttribute("role", "status");
    mensaje.textContent =
      "Prueba de identidad. No enviará registros.";
    contenedor.appendChild(mensaje);

    boton.addEventListener("click", () => {
      if (!sesionValida(usuarioId)) {
        mensaje.textContent =
          "Sesión institucional no válida. " +
          "Ingresa nuevamente desde el acceso institucional.";
        return;
      }

      boton.disabled = true;

      // Navegación en la MISMA pestaña:
      // preserva la sesión institucional.
      root.location.assign(PAGINA_PILOTO);
    });
  }

  root.SIABA03GoogleE5 = Object.freeze({
    agregarAccion
  });

})(
  typeof globalThis !== "undefined"
    ? globalThis
    : this
);
