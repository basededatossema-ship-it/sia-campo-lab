
/**
 * banimApp - Bienestar Animal
 * Etapa 05F.3B.2
 *
 * Guardado local de formularios BA.
 * Sin solicitudes de red.
 * Sin cambios al esquema IndexedDB.
 */

"use strict";

(function () {

  const DB_NAME = "SIA_CAMPO_PWA_LAB";
  const DB_VERSION = 1;
  const STORE = "borradores";
  const VERSION_FORMULARIO = "BA-05F";

  function abrirBase() {
    return new Promise((resolve, reject) => {

      const solicitud = indexedDB.open(
        DB_NAME,
        DB_VERSION
      );

      solicitud.onupgradeneeded = () => {
        // No crear ni modificar estructuras.
        solicitud.transaction.abort();
      };

      solicitud.onsuccess = () => {
        const db = solicitud.result;

        if (!db.objectStoreNames.contains(STORE)) {
          db.close();
          reject(new Error(
            "ALMACEN_LOCAL_NO_DISPONIBLE"
          ));
          return;
        }

        resolve(db);
      };

      solicitud.onerror = () => {
        reject(new Error(
          "BASE_LOCAL_NO_DISPONIBLE"
        ));
      };

      solicitud.onblocked = () => {
        reject(new Error(
          "BASE_LOCAL_BLOQUEADA"
        ));
      };
    });
  }

  async function guardar(registro) {

    if (!window.SIABanimContrato) {
      throw new Error(
        "CONTRATO_BA_NO_DISPONIBLE"
      );
    }

    const validacion =
      SIABanimContrato.normalizar(registro);

    if (!validacion.ok) {
      throw new Error(
        "FORMULARIO_INVALIDO: " +
        validacion.errores.join(",")
      );
    }

    if (
      registro.formularioVersion !==
        VERSION_FORMULARIO ||
      registro.estado !== "BORRADOR" ||
      registro.origen !==
        "SIA_BA_FORMULARIO_LAB"
    ) {
      throw new Error(
        "ESTADO_LOCAL_INCOMPATIBLE"
      );
    }

    const db = await abrirBase();

    try {
      return await new Promise((resolve, reject) => {

        const tx = db.transaction(
          STORE,
          "readwrite"
        );

        const almacen = tx.objectStore(STORE);

        // add() impide sobrescribir registros
        // que ya tengan este UUID.
        const solicitud = almacen.add(registro);

        let errorLocal = null;

        solicitud.onerror = () => {
          errorLocal = "UUID_YA_EXISTENTE";
        };

        tx.oncomplete = () => {
          resolve({
            ok: true,
            uuid: registro.id,
            estado: "BORRADOR"
          });
        };

        tx.onerror = () => {
          reject(new Error(
            errorLocal ||
            "GUARDADO_LOCAL_FALLIDO"
          ));
        };

        tx.onabort = () => {
          reject(new Error(
            errorLocal ||
            "GUARDADO_LOCAL_CANCELADO"
          ));
        };
      });
    } finally {
      db.close();
    }
  }

  async function verificar(uuid) {

    if (
      typeof uuid !== "string" ||
      !/^[0-9a-f-]{36}$/i.test(uuid)
    ) {
      throw new Error("UUID_INVALIDO");
    }

    const db = await abrirBase();

    try {
      return await new Promise((resolve, reject) => {

        const tx = db.transaction(
          STORE,
          "readonly"
        );

        const solicitud =
          tx.objectStore(STORE).get(uuid);

        let encontrado = false;

        solicitud.onsuccess = () => {
          const registro = solicitud.result;

          encontrado = !!registro &&
            registro.id === uuid &&
            registro.formularioVersion ===
              VERSION_FORMULARIO &&
            registro.estado === "BORRADOR";
        };

        tx.oncomplete = () => {
          resolve(encontrado);
        };

        tx.onerror = () => {
          reject(new Error(
            "VERIFICACION_LOCAL_FALLIDA"
          ));
        };

        tx.onabort = () => {
          reject(new Error(
            "VERIFICACION_LOCAL_CANCELADA"
          ));
        };
      });
    } finally {
      db.close();
    }
  }

  window.SIABanimAlmacenamiento =
    Object.freeze({
      guardar,
      verificar
    });

})();
