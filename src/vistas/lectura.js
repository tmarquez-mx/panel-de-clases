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
 * Se reconocen párrafos, viñetas y direcciones, y TODO lo que sale al HTML
 * pasa por esc() exactamente una vez. Así una descripción con etiquetas HTML
 * se lee como texto, que es lo que es.
 *
 * El orden importa. Antes se escapaba todo primero y las direcciones se
 * buscaban después, sobre el texto ya escapado, y al ponerlas en el enlace se
 * escapaban otra vez: cada «&» de una dirección pasaba a «&amp;amp;». El
 * navegador deshace un solo nivel, así que la liga apuntaba a «?x=1&amp;y=2»
 * y el segundo parámetro llegaba corrupto (se perdía, por ejemplo, el
 * minuto de un video de YouTube). Ahora las direcciones se buscan en el texto
 * original y cada trozo se escapa una sola vez, sea liga o texto.
 */
export function formatearTexto(crudo) {
  const texto = String(crudo || "").trim();
  if (!texto) return "";

  /* Recibe texto SIN escapar y devuelve HTML. Una dirección termina donde
     empieza un espacio, un «<» o «>» o unas comillas: son los signos que la
     rodean al pegarla («<https://…>», «"https://…"») y nunca forman parte de
     ella. Los puntos y comas del final tampoco. */
  const enlazar = (crudo) => {
    let html = "";
    let desde = 0;
    for (const coincidencia of crudo.matchAll(/https?:\/\/[^\s<>"]+/g)) {
      const liga = coincidencia[0];
      const limpia = liga.replace(/[.,;:)]+$/, "");
      const cola = liga.slice(limpia.length);

      html += esc(crudo.slice(desde, coincidencia.index));
      if (urlSegura(limpia)) {
        // El nombre visible es la procedencia, no la dirección entera.
        html += `<a href="${esc(limpia)}" target="_blank" rel="noopener noreferrer" title="${esc(limpia)}">${esc(procedencia(limpia) || limpia)}</a>`;
      } else {
        html += esc(limpia);
      }
      html += esc(cola);
      desde = coincidencia.index + liga.length;
    }
    return html + esc(crudo.slice(desde));
  };

  const bloques = texto.split(/\n{2,}/);
  return bloques
    .map((bloque) => {
      const lineas = bloque.split("\n");
      const sonViñetas = lineas.every((l) => /^\s*[-*•]\s+/.test(l));
      if (sonViñetas) {
        const puntos = lineas
          .map((l) => `<li>${enlazar(l.replace(/^\s*[-*•]\s+/, ""))}</li>`)
          .join("");
        return `<ul>${puntos}</ul>`;
      }
      return `<p>${enlazar(bloque).replace(/\n/g, "<br>")}</p>`;
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
