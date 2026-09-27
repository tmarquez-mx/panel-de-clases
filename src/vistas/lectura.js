/* =========================================================
   Comodidad de lectura: el tamaño del texto y la vista de lectura.

   Son dos cosas distintas que sirven a lo mismo. El tamaño ajusta la raíz
   del documento, y solo crece lo que se lee —títulos de recurso,
   descripciones, propósitos, bitácora—, porque está en rem; el mobiliario
   de la interfaz se queda en px y no se desmonta.

   La vista de lectura muestra lo que ya está guardado en el recurso, con
   texto amplio y sin nada alrededor. No va a buscar nada a la página
   externa: enseña la descripción que escribió quien planeó la sesión.
   Complementa el modo clase, no lo sustituye: el modo clase es para dar la
   clase, esta es para leer con calma.
   ========================================================= */

import { $, esc } from "../util/dom.js";
import { procedencia, urlSegura, esLocal } from "../util/urls.js";

/* ---------------- Tamaño del texto ---------------- */

const CLAVE_ESCALA = "panel-de-clases:escala-texto";
const MINIMA = 0.85;
const MAXIMA = 1.5;
const PASO = 0.1;

let escala = 1;

const redondear = (v) => Math.round(v * 100) / 100;

function aplicarEscala() {
  document.documentElement.style.setProperty("--escala-texto", String(escala));
  const menos = $("#btn-texto-menos");
  const mas = $("#btn-texto-mas");
  const reset = $("#btn-texto-reset");
  if (menos) menos.disabled = escala <= MINIMA + 0.001;
  if (mas) mas.disabled = escala >= MAXIMA - 0.001;
  if (reset) {
    const porcentaje = Math.round(escala * 100);
    reset.title = escala === 1 ? "El texto está en su tamaño normal" : `Texto al ${porcentaje}%. Volver al normal`;
    reset.setAttribute("aria-label", reset.title);
    reset.classList.toggle("cambiada", escala !== 1);
  }
}

function guardarEscala() {
  try {
    window.localStorage.setItem(CLAVE_ESCALA, String(escala));
  } catch {
    /* sin memoria: el tamaño vale solo para esta visita */
  }
}

function cambiarEscala(delta) {
  escala = redondear(Math.min(MAXIMA, Math.max(MINIMA, escala + delta)));
  aplicarEscala();
  guardarEscala();
}

export function montarEscalaDeTexto() {
  try {
    const guardada = parseFloat(window.localStorage.getItem(CLAVE_ESCALA));
    if (Number.isFinite(guardada)) escala = redondear(Math.min(MAXIMA, Math.max(MINIMA, guardada)));
  } catch {
    /* sin memoria */
  }
  aplicarEscala();

  $("#btn-texto-menos").addEventListener("click", () => cambiarEscala(-PASO));
  $("#btn-texto-mas").addEventListener("click", () => cambiarEscala(PASO));
  $("#btn-texto-reset").addEventListener("click", () => {
    escala = 1;
    aplicarEscala();
    guardarEscala();
  });
}

/* ---------------- Vista de lectura ---------------- */

/* Al abrirla se recuerda dónde estaba la página y qué control tenía el foco,
   para devolver a la lectora exactamente al mismo recurso y a la misma
   altura cuando cierre. */
let posicionPrevia = 0;
let focoPrevio = null;

/**
 * Da formato al texto guardado sin ejecutar nada de lo que traiga.
 * Todo se escapa primero; solo después se reconocen párrafos, viñetas y
 * direcciones. Así una descripción con etiquetas HTML se lee como texto,
 * que es lo que es.
 */
export function formatearTexto(crudo) {
  const texto = String(crudo || "").trim();
  if (!texto) return "";

  const enlazar = (seguro) =>
    seguro.replace(/(https?:\/\/[^\s<]+)/g, (liga) => {
      const limpia = liga.replace(/[.,;:)]+$/, "");
      const cola = liga.slice(limpia.length);
      if (!urlSegura(limpia)) return esc(limpia) + esc(cola);
      // El nombre visible es la procedencia, no la dirección entera.
      return `<a href="${esc(limpia)}" target="_blank" rel="noopener noreferrer" title="${esc(limpia)}">${esc(procedencia(limpia) || limpia)}</a>${esc(cola)}`;
    });

  const bloques = texto.split(/\n{2,}/);
  return bloques
    .map((bloque) => {
      const lineas = bloque.split("\n");
      const sonViñetas = lineas.every((l) => /^\s*[-*•]\s+/.test(l));
      if (sonViñetas) {
        const puntos = lineas
          .map((l) => `<li>${enlazar(esc(l.replace(/^\s*[-*•]\s+/, "")))}</li>`)
          .join("");
        return `<ul>${puntos}</ul>`;
      }
      return `<p>${enlazar(esc(bloque)).replace(/\n/g, "<br>")}</p>`;
    })
    .join("");
}

export function abrirLectura(recurso, sesion) {
  if (!recurso) return;
  posicionPrevia = window.scrollY;
  focoPrevio = document.activeElement;

  const cuerpo = formatearTexto(recurso.nota) || `<p class="sin-texto">Este recurso no tiene descripción guardada. Puedes escribirla desde «Editar».</p>`;
  const origen = recurso.url
    ? esLocal(recurso.url)
      ? `<span class="lec-origen">Ruta local · ${esc(procedencia(recurso.url))}</span>`
      : `<a class="lec-origen" href="${esc(urlSegura(recurso.url) ? recurso.url : "")}" target="_blank" rel="noopener noreferrer" title="${esc(recurso.url)}">Abrir en ${esc(procedencia(recurso.url))} ↗</a>`
    : "";

  $("#lec-meta").textContent = [sesion?.titulo, recurso.tipo, recurso.momento].filter(Boolean).join(" · ");
  $("#lec-titulo").textContent = recurso.titulo;
  $("#lec-cuerpo").innerHTML = cuerpo;
  $("#lec-origen").innerHTML = origen;

  const dlg = $("#dlg-lectura");
  dlg.showModal();
  dlg.scrollTop = 0;
  $("#lec-cerrar").focus();
}

export function montarLectura() {
  const dlg = $("#dlg-lectura");
  $("#lec-cerrar").addEventListener("click", () => dlg.close());
  // Cerrar con Escape o con el botón devuelve a donde se estaba leyendo.
  dlg.addEventListener("close", () => {
    window.scrollTo({ top: posicionPrevia, behavior: "instant" });
    if (focoPrevio instanceof HTMLElement && focoPrevio.isConnected) focoPrevio.focus();
    focoPrevio = null;
  });
}
