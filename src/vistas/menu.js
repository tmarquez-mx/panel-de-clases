/* Menú contextual: la pieza que permite dejar una sola acción visible
   sin esconder ninguna función.

   Usa el atributo popover del navegador, que ya trae gratis el cierre con
   Escape, el cierre al hacer clic fuera y la capa superior (nunca queda
   tapado por otra cosa). Encima de eso se agrega lo que el navegador no da:
   navegación con flechas y devolver el foco al botón que lo abrió. */

import { esc } from "../util/dom.js";

const SEPARADOR = "---";

let abierto = null;

function cerrar() {
  if (!abierto) return;
  const { caja, ancla } = abierto;
  abierto = null;
  caja.hidePopover?.();
  caja.remove();
  // El foco vuelve a donde estaba: quien navega con teclado no se pierde.
  if (ancla.isConnected) ancla.focus();
}

function colocar(caja, ancla) {
  const r = ancla.getBoundingClientRect();
  const { width, height } = caja.getBoundingClientRect();
  const margen = 8;

  // Debajo del botón; si no cabe, encima.
  let arriba = r.bottom + 6;
  if (arriba + height > window.innerHeight - margen && r.top - height - 6 > margen) {
    arriba = r.top - height - 6;
  }
  // Alineado a la derecha del botón, sin salirse de la ventana.
  let izquierda = r.right - width;
  izquierda = Math.max(margen, Math.min(izquierda, window.innerWidth - width - margen));

  caja.style.top = `${Math.max(margen, arriba)}px`;
  caja.style.left = `${izquierda}px`;
}

function moverFoco(caja, paso) {
  const items = Array.from(caja.querySelectorAll("button:not([disabled])"));
  if (!items.length) return;
  const i = items.indexOf(document.activeElement);
  const siguiente = i === -1 ? 0 : (i + paso + items.length) % items.length;
  items[siguiente].focus();
}

/**
 * Abre un menú colgado de un botón.
 * @param {HTMLElement} ancla  botón que lo dispara
 * @param {Array} opciones     {etiqueta, titulo, accion, peligro, desactivado, razon}
 *                             o la cadena "---" para una línea divisoria
 */
export function abrirMenu(ancla, opciones) {
  // Segundo clic en el mismo botón: se cierra.
  if (abierto?.ancla === ancla) {
    cerrar();
    return;
  }
  cerrar();

  const caja = document.createElement("div");
  caja.className = "menu";
  caja.setAttribute("popover", "manual");
  caja.setAttribute("role", "menu");

  caja.innerHTML = opciones
    .map((o, i) => {
      if (o === SEPARADOR) return '<hr class="menu-sep">';
      const titulo = o.desactivado ? o.razon || "" : o.titulo || "";
      return `<button type="button" role="menuitem" data-i="${i}"
        class="${o.peligro ? "peligro" : ""}"
        ${o.desactivado ? "disabled" : ""}
        ${titulo ? `title="${esc(titulo)}"` : ""}>${esc(o.etiqueta)}</button>`;
    })
    .join("");

  document.body.appendChild(caja);
  caja.showPopover?.();
  colocar(caja, ancla);

  abierto = { caja, ancla };

  caja.addEventListener("click", (e) => {
    const boton = e.target.closest("button[data-i]");
    if (!boton) return;
    const opcion = opciones[Number(boton.dataset.i)];
    cerrar();
    opcion?.accion?.();
  });

  caja.addEventListener("keydown", (e) => {
    if (e.key === "ArrowDown") { e.preventDefault(); moverFoco(caja, 1); }
    else if (e.key === "ArrowUp") { e.preventDefault(); moverFoco(caja, -1); }
    else if (e.key === "Tab") { e.preventDefault(); moverFoco(caja, e.shiftKey ? -1 : 1); }
  });

  // El navegador cierra con Escape o clic fuera: hay que limpiar igual.
  caja.addEventListener("toggle", (e) => {
    if (e.newState === "closed" && abierto?.caja === caja) cerrar();
  });

  caja.querySelector("button:not([disabled])")?.focus();
}

/** Cierra el menú abierto, si lo hay. Se usa antes de repintar. */
export function cerrarMenu() {
  cerrar();
}

// Si la ventana cambia de tamaño o se desplaza, el menú quedaría flotando
// lejos de su botón: se cierra en lugar de perseguirlo.
addEventListener("resize", cerrar);
addEventListener("scroll", cerrar, true);
