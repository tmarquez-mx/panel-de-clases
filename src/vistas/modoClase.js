/* Modo clase: pantalla completa en negro, un recurso a la vez.
   Navegación con flechas, salida con Escape, sin tocar el mouse. */

import { $, avisar } from "../util/dom.js";
import { minutosDe } from "../datos/modelo.js";
import { sesion } from "../estado.js";
import { abrirRecurso } from "./sesion.js";
import { ocultarAviso } from "./aviso.js";

let indice = 0;
let recursos = [];
let devolverFoco = null;
let inicio = 0;
let tic = 0;

const panel = () => $("#modo-clase");
const activo = () => panel().classList.contains("activo");

function pintar() {
  const r = recursos[indice];
  if (!r) return;

  $("#progreso").innerHTML = recursos
    .map((_, i) => `<span class="paso${i <= indice ? " hecho" : ""}"></span>`)
    .join("");
  $("#mc-eyebrow").textContent =
    `${r.tipo}${r.momento ? " · " + r.momento : ""} · ${indice + 1} de ${recursos.length}`;
  $("#mc-titulo").textContent = r.titulo;
  $("#mc-nota").textContent = r.nota || "";
  $("#mc-ruta").textContent = r.url || "";
  $("#mc-abrir").hidden = !r.url;
  $("#mc-anterior").disabled = indice === 0;
  $("#mc-siguiente").disabled = indice === recursos.length - 1;
}

/* Reloj de la sesión: minutos corridos desde que se entró al modo clase,
   comparados con el minuto en que estaba planeado el recurso visible. */
function pintarReloj() {
  const caja = $("#mc-reloj");
  const segundos = Math.max(0, Math.floor((Date.now() - inicio) / 1000));
  const minutos = Math.floor(segundos / 60);
  let texto = `${minutos}:${String(segundos % 60).padStart(2, "0")} de sesión`;
  let situacion = "normal";

  const planeado = minutosDe(recursos[indice]?.momento);
  if (planeado !== null) {
    const diferencia = minutos - planeado;
    if (diferencia <= -2) {
      texto += ` · ${-diferencia} min antes de lo planeado`;
      situacion = "adelante";
    } else if (diferencia >= 2) {
      texto += ` · ${diferencia} min de retraso`;
      situacion = "tarde";
    } else {
      texto += " · a tiempo";
    }
  }

  caja.textContent = texto;
  caja.dataset.situacion = situacion;
}

function mover(paso) {
  indice = Math.min(recursos.length - 1, Math.max(0, indice + paso));
  pintar();
  pintarReloj();
}

export function entrarModoClase() {
  const s = sesion();
  if (!s || !s.recursos.length) {
    avisar("Agrega al menos un recurso a la sesión.");
    return;
  }
  recursos = s.recursos;
  indice = 0;
  devolverFoco = document.activeElement;
  ocultarAviso(); // el aviso flotante no debe quedar encima de la pantalla negra

  inicio = Date.now();
  window.clearInterval(tic);
  tic = window.setInterval(pintarReloj, 1000);

  panel().classList.add("activo");
  // El resto de la página queda fuera del foco y del lector de pantalla.
  $("#envoltura").inert = true;
  document.querySelector(".barra").inert = true;

  pintar();
  pintarReloj();
  $("#mc-siguiente").focus();
}

export function salirModoClase() {
  if (!activo()) return;
  panel().classList.remove("activo");
  window.clearInterval(tic);
  tic = 0;
  $("#envoltura").inert = false;
  document.querySelector(".barra").inert = false;
  recursos = [];
  const destino =
    devolverFoco instanceof HTMLElement && devolverFoco.isConnected && devolverFoco !== document.body
      ? devolverFoco
      : $("#btn-modo-clase");
  destino.focus();
  devolverFoco = null;
}

export function montarModoClase() {
  $("#mc-salir").addEventListener("click", salirModoClase);
  $("#mc-anterior").addEventListener("click", () => mover(-1));
  $("#mc-siguiente").addEventListener("click", () => mover(1));
  $("#mc-abrir").addEventListener("click", () => abrirRecurso(recursos[indice]?.url, $("#mc-abrir")));

  document.addEventListener("keydown", (e) => {
    if (!activo()) return;
    if (e.key === "Escape") {
      e.preventDefault();
      salirModoClase();
    } else if (e.key === "ArrowRight") {
      e.preventDefault();
      mover(1);
    } else if (e.key === "ArrowLeft") {
      e.preventDefault();
      mover(-1);
    }
  });
}
