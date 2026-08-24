/* Atajos mínimos sobre el DOM. */

export const $ = (selector, raiz = document) => raiz.querySelector(selector);
export const $$ = (selector, raiz = document) => Array.from(raiz.querySelectorAll(selector));

/** Escapa texto antes de insertarlo en HTML. Se usa SIEMPRE que se arma
 *  una plantilla con innerHTML, incluidos los datos importados. */
export const esc = (t) =>
  String(t ?? "").replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])
  );

/** Confirmación con texto explícito. Devuelve true o false. */
export const confirmar = (mensaje) => window.confirm(mensaje);

/** Aviso simple. Aislado en una función para poder cambiarlo después. */
export const avisar = (mensaje) => window.alert(mensaje);
