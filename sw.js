
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

const CACHE_NAME = "banimapp-lab-v3";

const BASE_URL = new URL(
  "./",
  self.location.href
);


const APP_SHELL = [
  "index.html",
  "app.js",
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

  if (request.mode === "navigate") {
    event.respondWith(
      (async () => {
        try {
          return await fetch(request);
        } catch (error) {
          const cache = await caches.open(
            CACHE_NAME
          );

          const respaldo = await cache.match(
            new URL("index.html", BASE_URL).href
          );

          if (respaldo) {
            return respaldo;
          }

          return Response.error();
        }
      })()
    );

    return;
  }

  // Archivos de la aplicación:
  // priorizar el recurso guardado.

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

      const guardado = await cache.match(recurso);

      if (guardado) {
        return guardado;
      }

      return fetch(request);
    })()
  );
});
