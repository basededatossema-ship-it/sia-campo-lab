
/**
 * SIA CAMPO - LABORATORIO PWA
 * Service Worker experimental
 *
 * Etapa 9.9
 * Objetivo: permitir apertura offline.
 *
 * No almacena información ciudadana.
 * No sincroniza registros.
 */

"use strict";

const CACHE_NAME = "banimapp-lab-v37";

const BASE_URL = new URL(
  "./",
  self.location.href
);


const APP_SHELL = [
  "index.html",
  "app.js",
  "contrato-ba.js",
  "almacenamiento-ba.js",
  "identidad-offline-ba-05g15.js",
  "formularios-ba.html",
  "manifest.webmanifest",
  "banimapp-icon-180.png",
  "banimapp-icon-192.png",
  "banimapp-icon-512.png"
].map(
  archivo => new URL(archivo, BASE_URL).href
);


// INSTALACIÓN
// Guardar los recursos principales.

self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting())
  );
});

// ACTIVACIÓN
// Eliminar versiones anteriores del laboratorio.

self.addEventListener("activate", event => {
  event.waitUntil(
    (async () => {
      const nombres = await caches.keys();

      await Promise.all(
        nombres
          .filter(
            nombre =>
              (
            nombre.startsWith("sia-campo-lab-") ||
            nombre.startsWith("banimapp-lab-")
          ) &&
              nombre !== CACHE_NAME
          )
          .map(nombre => caches.delete(nombre))
      );

      await self.clients.claim();
    })()
  );
});

// INTERCEPTAR SOLICITUDES
// Solo recursos del laboratorio.

self.addEventListener("fetch", event => {
  const request = event.request;

  if (request.method !== "GET") {
    return;
  }

  const url = new URL(request.url);

  if (url.origin !== self.location.origin) {
    return;
  }

  if (!url.pathname.startsWith(BASE_URL.pathname)) {
    return;
  }

  // Navegación: intentar red y recuperar
  // index.html cuando no haya internet.

  
  // SIA-BIENESTAR-05F.3B.7
  // Navegación independiente sin conexión.

  if (request.mode === "navigate") {
    event.respondWith(
      (async () => {

        const cache = await caches.open(
          CACHE_NAME
        );

        const ruta = url.pathname;
        const inicio = new URL(
          "index.html", BASE_URL
        ).pathname;

        const formularios = new URL(
          "formularios-ba.html", BASE_URL
        ).pathname;

        let pagina = null;

        if (
          ruta === BASE_URL.pathname ||
          ruta === inicio
        ) {
          pagina = new URL(
            "index.html", BASE_URL
          ).href;
        } else if (ruta === formularios) {
          pagina = new URL(
            "formularios-ba.html", BASE_URL
          ).href;
        }

        
        // SIA-BIENESTAR-05G.19B
        // En linea: priorizar la version publicada.
        // Sin conexion: conservar funcionamiento offline.

        try {
          const respuesta = await fetch(request);

          if (respuesta.ok && pagina) {
            await cache.put(
              pagina,
              respuesta.clone()
            );
          }

          return respuesta;

        } catch (error) {
          if (pagina) {
            const guardada =
              await cache.match(pagina);

            if (guardada) {
              return guardada;
            }
          }

          return Response.error();
        }


      })()
    );

    return;
  }


  
  // P04-B1.1
  // Archivos de la aplicación:
  // consultar primero la red.
  // Si no hay conexión, usar la caché.

  const recurso = APP_SHELL.find(
    archivo =>
      new URL(archivo).pathname === url.pathname
  );

  if (!recurso) {
    return;
  }

  event.respondWith(
    (async () => {
      const cache = await caches.open(CACHE_NAME);

      try {
        const respuesta = await fetch(request);

        if (respuesta.ok) {
          await cache.put(
            recurso,
            respuesta.clone()
          );

          return respuesta;
        }
      } catch (error) {
        // La red puede no estar disponible.
      }

      const guardado = await cache.match(recurso);

      if (guardado) {
        return guardado;
      }

      return Response.error();
    })()
  );
});
