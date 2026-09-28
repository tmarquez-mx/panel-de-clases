/* Modo clase: pantalla completa en negro, un recurso a la vez.
   Navegación con flechas, salida con Escape, sin tocar el mouse. */

import { $, avisar } from "../util/dom.js";
import { minutosDe } from "../datos/modelo.js";
import { sesion } from "../estado.js";
import { abrirRecurso } from "./sesion.js";
import { presentacionEncendida, mostrarPortada } from "./presentacion.js";
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

  /* Con la ventana de presentación encendida, el recurso no va a una
     pestaña nueva sino a la ventana compartida, y aparece el botón para
     volver a la portada entre un recurso y el siguiente. */
  const conVentana = presentacionEncendida();
  $("#mc-abrir").title = conVentana
    ? "Mostrar este recurso en la ventana de presentación, sin salir del modo clase"
    : "Abrir este recurso en otra pestaña, sin salir del modo clase";
  $("#mc-portada").hidden = !conVentana;

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

/* En pantalla completa no se ve nada de lo que pasa fuera: ni la ventana
   de presentación, ni una pestaña nueva, ni que el navegador bloqueó la
   apertura. Sin esto, abrir un recurso y que no ocurra nada visible es
   indistinguible de un botón descompuesto. */
const LO_QUE_PASO = {
  presentacion: ["Listo: el recurso ya está en la ventana de presentación.", "bien"],
  portada: ["La ventana de presentación volvió a la portada.", "bien"],
  comparte: [
    "La ventana de presentación tiene la portada. Compártela en Zoom con Compartir → Ventana; si compartes «Pantalla», tus alumnos verán esta pantalla negra.",
    "aviso",
  ],
  pestana: ["Se abrió en otra pestaña, detrás de esta pantalla. Sal con Esc para verla.", "bien"],
  reabierta: [
    "La ventana de presentación se había cerrado sola y esta es otra: vuelve a compartirla en Zoom.",
    "problema",
  ],
  copiada: ["Es una ruta del disco: se copió al portapapeles.", "bien"],
  bloqueada: [
    "El navegador bloqueó la ventana. Sal con Esc y permítele las ventanas emergentes a esta página.",
    "problema",
  ],
  "sin-liga": ["Este recurso no tiene liga.", "problema"],
};

let borrarEstado = 0;

function decirQuePaso(clave) {
  const caja = $("#mc-estado");
  if (!caja) return;
  const [texto, clase] = LO_QUE_PASO[clave] || ["", "bien"];
  caja.textContent = texto;
  caja.dataset.clase = clase;
  window.clearTimeout(borrarEstado);
  // Un problema, y el recordatorio de compartir, se quedan hasta que se
  // cambia de recurso; lo demás se va solo a los pocos segundos.
  if (texto && clase === "bien") {
    borrarEstado = window.setTimeout(() => { caja.textContent = ""; }, 4000);
  }
}

function mover(paso) {
  indice = Math.min(recursos.length - 1, Math.max(0, indice + paso));
  decirQuePaso("");
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

  /* Pantalla completa solo cuando el modo clase ES lo que se proyecta.
     Con la ventana de presentación encendida, lo que ve el grupo es esa
     otra ventana, y esta pantalla pasa a ser la consola privada de quien
     da la clase. Ahí la pantalla completa solo estorba: tapa la ventana
     compartida, y en macOS se va a su propio escritorio, así que ir a Zoom
     a compartir y volver se vuelve un viaje entre escritorios.
     Si el navegador la niega —hace falta un gesto del usuario, y algunos
     equipos la bloquean—, el modo clase funciona igual dentro de la
     ventana. */
  if (!presentacionEncendida()) {
    document.documentElement.requestFullscreen?.().catch(() => {});
  }

  pintar();
  pintarReloj();

  /* Entrar al modo clase es el momento de empezar, así que la ventana
     compartida debe estar en la portada: se pone sola. Antes había que
     pedirla aparte, en un menú, antes de entrar aquí —y para eso había que
     salir de la app, compartir en Zoom y volver a buscar el botón—.
     El recordatorio importa tanto como la portada: compartir la PANTALLA
     en vez de la ventana hace que el grupo vea esta pantalla negra, porque
     el modo clase está en pantalla completa y tapa todo lo demás. */
  if (presentacionEncendida()) {
    decirQuePaso(mostrarPortada() ? "comparte" : "bloqueada");
  }

  $("#mc-siguiente").focus();
}

export function salirModoClase() {
  if (!activo()) return;
  panel().classList.remove("activo");
  window.clearInterval(tic);
  tic = 0;
  if (document.fullscreenElement) document.exitFullscreen?.().catch(() => {});
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
  $("#mc-abrir").addEventListener("click", () => {
    decirQuePaso(abrirRecurso(recursos[indice]?.url, $("#mc-abrir")));
  });
  $("#mc-portada").addEventListener("click", () => {
    decirQuePaso(mostrarPortada() ? "portada" : "bloqueada");
  });

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
