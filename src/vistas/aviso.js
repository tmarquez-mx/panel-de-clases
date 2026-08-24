/* Aviso de lo que acaba de pasar, con la acción para revertirlo o seguirlo.
   Aparece abajo a la izquierda, no interrumpe y se va solo. */

import { $, esc } from "../util/dom.js";

const DURACION_MS = 25000;

let temporizador = 0;
let accionPendiente = null;

export function ocultarAviso() {
  window.clearTimeout(temporizador);
  temporizador = 0;
  accionPendiente = null;
  const caja = $("#aviso-flotante");
  caja.hidden = true;
  caja.innerHTML = "";
}

/**
 * Muestra el aviso. `accion` es opcional: si viene, se pinta un botón con la
 * `etiqueta` que la ejecuta y cierra el aviso.
 */
export function mostrarAviso(texto, { etiqueta = "", accion = null, titulo = "" } = {}) {
  const caja = $("#aviso-flotante");
  accionPendiente = accion;

  caja.innerHTML =
    `<span class="texto">${esc(texto)}</span>` +
    (accion
      ? `<button type="button" class="btn" data-accion title="${esc(titulo || etiqueta)}">${esc(etiqueta)}</button>`
      : "") +
    `<button type="button" class="cerrar" data-cerrar-aviso title="Cerrar este aviso" aria-label="Cerrar el aviso">×</button>`;
  caja.hidden = false;

  window.clearTimeout(temporizador);
  temporizador = window.setTimeout(ocultarAviso, DURACION_MS);
}

export function montarAviso() {
  $("#aviso-flotante").addEventListener("click", (e) => {
    if (e.target.closest("[data-accion]")) {
      const accion = accionPendiente;
      ocultarAviso();
      accion?.();
    } else if (e.target.closest("[data-cerrar-aviso]")) {
      ocultarAviso();
    }
  });
}
