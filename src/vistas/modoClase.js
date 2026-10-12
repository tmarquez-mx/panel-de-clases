/* Modo clase: un recurso a la vez, con flechas y sin tocar el mouse.

   Tiene tres formas, según lo que vea el grupo:
     · Sin presentación: pantalla completa en negro; es lo que se proyecta.
     · Con presentación en ventana aparte: esta pantalla es la consola
       privada y los recursos van a la otra ventana.
     · Con presentación en pestañas (Chrome, Edge): la consola se muda a una
       ventanita flotante y la pestaña de Pauta pasa a ser el escenario, con
       la portada. Ver presentacion.js. */

import { $, avisar } from "../util/dom.js";
import { minutosDe } from "../datos/modelo.js";
import { estado, materia, sesion, irAMateria, irASesion, repintar } from "../estado.js";
import { abrirRecurso } from "./sesion.js";
import {
  presentacionEncendida, modoPresentacion, mostrarPortada, queDecir, alPasarDespues,
  ponerEscenario, quitarEscenario, hayEscenario, renunciarALaConsola,
} from "./presentacion.js";
import { ocultarAviso, mostrarAviso } from "./aviso.js";

/* El panel del modo clase. Se guarda la referencia porque viaja: en el modo
   de pestañas vive dentro de la ventanita flotante, y ahí no lo encuentra
   document.querySelector. */
let raiz = null;
const el = (selector) => raiz.querySelector(selector);
const activo = () => raiz.classList.contains("activo");

let indice = 0;
let recursos = [];
let devolverFoco = null;
let inicio = 0;
let tic = 0;
let reloj = window; // de quién son los temporizadores del reloj
let consola = null; // la ventanita flotante, mientras está abierta
let origen = null; // dónde vivía el panel antes de mudarse a ella

/* ---------------------------------------------------------
   La clase en curso

   Antes, salir del modo clase y volver a entrar ponía el reloj en cero y
   regresaba al primer recurso: bastaba un Esc para consultar algo y el
   reloj dejaba de servir. Ahora se recuerda dónde se iba, por sesión, y se
   retoma. Vive en sessionStorage para sobrevivir también a recargar Pauta,
   que en el modo de pestañas importa más: es la ventana compartida.
   --------------------------------------------------------- */

const CLAVE_CLASE = "panel-de-clases:clase";
const VIGENCIA_MS = 6 * 60 * 60 * 1000; // una clase no dura más; después se empieza de cero

let clase = null;
try {
  clase = JSON.parse(window.sessionStorage.getItem(CLAVE_CLASE)) || null;
} catch {
  /* sin memoria de la pestaña: cada entrada empieza de cero */
}

function recordarClase(cambios) {
  clase = { ...clase, ...cambios };
  try {
    window.sessionStorage.setItem(CLAVE_CLASE, JSON.stringify(clase));
  } catch {
    /* sin memoria: vale mientras no se recargue */
  }
}

const firmaDe = (m, s) => ({ materia: m?.id || "", sesion: estado.sesionActiva, fecha: s.fecha, titulo: s.titulo });

const esLaMisma = (m, s) =>
  !!clase && clase.materia === (m?.id || "") && clase.fecha === s.fecha && clase.titulo === s.titulo &&
  Date.now() - (clase.inicio || 0) < VIGENCIA_MS;

/* ---------------------------------------------------------
   Pintar
   --------------------------------------------------------- */

/* Lo que ven los alumnos, hasta donde Pauta lo sabe: lo último que mandó.
   No se adivina por la visibilidad de la pestaña, porque macOS da por
   «oculta» una ventana tapada por Zoom aunque siga compartida. */
let enPantalla = "";

function pintarEnPantalla() {
  const caja = el("#mc-en-pantalla");
  caja.hidden = !presentacionEncendida() || !enPantalla;
  caja.textContent = enPantalla ? `En pantalla: ${enPantalla}` : "";
}

function pintar() {
  const r = recursos[indice];
  if (!r) return;

  el("#progreso").innerHTML = recursos
    .map((_, i) => `<span class="paso${i <= indice ? " hecho" : ""}"></span>`)
    .join("");
  el("#mc-eyebrow").textContent =
    `${r.tipo}${r.momento ? " · " + r.momento : ""} · ${indice + 1} de ${recursos.length}`;
  el("#mc-titulo").textContent = r.titulo;
  el("#mc-nota").textContent = r.nota || "";
  el("#mc-ruta").textContent = r.url || "";
  el("#mc-abrir").hidden = !r.url;

  const conPresentacion = presentacionEncendida();
  const enPestanas = conPresentacion && modoPresentacion() === "pestanas";
  el("#mc-abrir").title = !conPresentacion
    ? "Abrir este recurso en otra pestaña, sin salir del modo clase (A)"
    : enPestanas
      ? "Mostrar este recurso a tus alumnos, en la ventana que compartes (A)"
      : "Mostrar este recurso en la ventana de presentación, sin salir del modo clase (A)";
  el("#mc-portada").hidden = !conPresentacion;
  el("#mc-salir").title = consola
    ? "Cerrar estos controles. La portada se queda en la ventana compartida hasta que vuelvas al panel (Esc)"
    : "Salir del modo clase (Esc)";
  el("#mc-teclas").textContent = conPresentacion
    ? "← → recursos · A abrir · P portada · Esc salir"
    : "← → recursos · A abrir · Esc salir";

  el("#mc-anterior").disabled = indice === 0;
  el("#mc-siguiente").disabled = indice === recursos.length - 1;
  pintarEnPantalla();
}

/* Reloj de la sesión: minutos corridos desde que empezó la clase,
   comparados con el minuto en que estaba planeado el recurso visible. */
function pintarReloj() {
  const caja = el("#mc-reloj");
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

/* Los temporizadores son de la ventana donde está el reloj. En el modo de
   pestañas la de Pauta queda en segundo plano en cuanto se abre un recurso,
   y Chrome espacia sus temporizadores hasta uno por minuto pasados cinco; los
   de la ventanita flotante, que está a la vista, no se frenan. */
function arrancarReloj(vista) {
  pararReloj();
  reloj = vista;
  tic = vista.setInterval(pintarReloj, 1000);
}

function pararReloj() {
  try {
    reloj.clearInterval(tic);
  } catch {
    /* la ventanita ya se cerró y se llevó sus temporizadores */
  }
  tic = 0;
}

/* En pantalla completa, o en la ventanita, no se ve nada de lo que pasa
   fuera: ni la ventana de presentación, ni una pestaña nueva, ni que el
   navegador bloqueó la apertura. Sin esto, abrir un recurso y que no ocurra
   nada visible es indistinguible de un botón descompuesto. */
let borrarEstado = 0;

function decirQuePaso(clave) {
  const caja = el("#mc-estado");
  const [texto, clase] = queDecir(clave);
  caja.textContent = texto;
  caja.dataset.clase = clase;
  window.clearTimeout(borrarEstado);
  // Un problema, y el recordatorio de compartir, se quedan hasta que se
  // cambia de recurso; lo demás se va solo a los pocos segundos.
  if (texto && clase === "bien") {
    borrarEstado = window.setTimeout(() => { caja.textContent = ""; }, 4000);
  }
}

/* ---------------------------------------------------------
   Acciones
   --------------------------------------------------------- */

function mover(paso) {
  indice = Math.min(recursos.length - 1, Math.max(0, indice + paso));
  recordarClase({ indice });
  decirQuePaso("");
  pintar();
  pintarReloj();
}

function abrir() {
  const r = recursos[indice];
  if (!r?.url) return;
  const paso = abrirRecurso(r.url, el("#mc-abrir"));
  if (paso === "presentacion" || paso === "reabierta") enPantalla = `«${r.titulo}»`;
  decirQuePaso(paso);
  pintarEnPantalla();
}

function portada() {
  const paso = mostrarPortada();
  if (paso === "portada" || paso === "reabierta") enPantalla = "la portada";
  decirQuePaso(paso);
  pintarEnPantalla();
}

/* El mismo teclado en la página y en la ventanita. A y P ahorran el viaje al
   mouse en lo que más se repite en Zoom: pasar al siguiente y mostrarlo. */
function teclas(e) {
  if (!activo() || e.metaKey || e.ctrlKey || e.altKey) return;
  switch (e.key) {
    case "Escape":
      e.preventDefault();
      salirModoClase();
      break;
    case "ArrowRight":
      e.preventDefault();
      mover(1);
      break;
    case "ArrowLeft":
      e.preventDefault();
      mover(-1);
      break;
    case "a":
    case "A":
      if (!el("#mc-abrir").hidden) {
        e.preventDefault();
        abrir();
      }
      break;
    case "p":
    case "P":
      if (presentacionEncendida()) {
        e.preventDefault();
        portada();
      }
      break;
    default:
      break;
  }
}

function bloquearPanel(bloquear) {
  // El resto de la página queda fuera del foco y del lector de pantalla.
  $("#envoltura").inert = bloquear;
  document.querySelector(".barra").inert = bloquear;
}

/* ---------------------------------------------------------
   Entrar
   --------------------------------------------------------- */

export function entrarModoClase() {
  const m = materia();
  const s = sesion();
  if (!s || !s.recursos.length) {
    avisar("Agrega al menos un recurso a la sesión.");
    return;
  }
  if (activo()) return;

  const reanuda = esLaMisma(m, s);
  recursos = s.recursos;
  indice = reanuda ? Math.min(clase.indice || 0, recursos.length - 1) : 0;
  inicio = reanuda ? clase.inicio : Date.now();
  if (!reanuda) enPantalla = "";
  recordarClase({ ...firmaDe(m, s), inicio, indice });
  ocultarAviso(); // el aviso flotante no debe quedar encima del modo clase

  if (presentacionEncendida() && modoPresentacion() === "pestanas") {
    abrirConsola(reanuda);
    return;
  }
  entrarEnLaPagina(reanuda);
}

/* El modo clase de siempre, dentro de la página. */
function entrarEnLaPagina(reanuda, { sinPortada = false } = {}) {
  devolverFoco = document.activeElement;
  raiz.classList.add("activo");
  bloquearPanel(true);

  /* Pantalla completa solo cuando el modo clase ES lo que se proyecta.
     Con la ventana de presentación encendida, lo que ve el grupo es esa
     otra ventana, y esta pantalla pasa a ser la consola privada de quien
     da la clase. Ahí la pantalla completa solo estorba: tapa la ventana
     compartida, y en macOS se va a su propio escritorio. Si el navegador
     la niega, el modo clase funciona igual dentro de la ventana. */
  if (!presentacionEncendida()) {
    document.documentElement.requestFullscreen?.().catch(() => {});
  }

  arrancarReloj(window);
  pintar();
  pintarReloj();

  /* Entrar al modo clase es el momento de empezar, así que la ventana
     compartida debe estar en la portada: se pone sola. Pero al REANUDAR no
     se toca: el grupo puede estar viendo un recurso, y salir un momento a
     consultar algo no debe arrancárselo de la pantalla. */
  if (presentacionEncendida() && !sinPortada && !(reanuda && enPantalla)) {
    const paso = mostrarPortada();
    if (paso === "portada" || paso === "reabierta") enPantalla = "la portada";
    decirQuePaso(paso === "portada" ? "comparte" : paso);
  } else if (reanuda) {
    decirQuePaso("reanudada");
  }
  pintarEnPantalla();

  el("#mc-siguiente").focus();
}

/* La ventanita flotante tiene que pedirse dentro del clic: por eso
   requestWindow es lo primero que se llama, antes de cualquier await. */
async function abrirConsola(reanuda) {
  let pip;
  try {
    pip = await window.documentPictureInPicture.requestWindow({
      width: 460,
      height: 420,
      // Sin el botón «volver a la pestaña»: la pestaña es el escenario.
      disallowReturnToOpener: true,
    });
  } catch {
    /* Sin ventanita no hay escenario posible: el panel quedaría a la vista
       del grupo. Se sigue con la ventana aparte, que no la necesita; la
       portada se pide con un clic, porque este ya se gastó en la ventanita. */
    renunciarALaConsola();
    entrarEnLaPagina(reanuda, { sinPortada: true });
    decirQuePaso("sin-consola");
    return;
  }

  consola = pip;
  prepararConsola(pip.document);
  origen = { padre: raiz.parentNode, siguiente: raiz.nextSibling };
  raiz.classList.add("activo", "en-consola");
  pip.document.body.append(raiz);
  pip.document.addEventListener("keydown", teclas);
  pip.addEventListener("pagehide", alCerrarConsola, { once: true });

  // La pestaña de Pauta pasa a ser lo que ve el grupo.
  ponerEscenario();
  $("#escenario-control").hidden = true;
  bloquearPanel(true);
  recordarClase({ escenario: true });
  enPantalla = "la portada";

  arrancarReloj(pip);
  pintar();
  pintarReloj();
  decirQuePaso(reanuda ? "reanudada" : "comparte-pestana");
  el("#mc-siguiente").focus();
}

/* La ventanita empieza en blanco: hay que darle las hojas de estilo del
   panel. Se copian las reglas, que funciona igual con las hojas en línea
   de la versión publicada que con las que inyecta Vite al desarrollar. */
function prepararConsola(doc) {
  doc.documentElement.lang = "es";
  doc.title = "Controles de Pauta — no compartir";
  for (const hoja of document.styleSheets) {
    try {
      const estilo = doc.createElement("style");
      estilo.textContent = [...hoja.cssRules].map((regla) => regla.cssText).join("\n");
      doc.head.append(estilo);
    } catch {
      if (hoja.href) {
        const liga = doc.createElement("link");
        liga.rel = "stylesheet";
        liga.href = hoja.href;
        doc.head.append(liga);
      }
    }
  }
  doc.body.className = "cuerpo-consola";
}

/* ---------------------------------------------------------
   Salir
   --------------------------------------------------------- */

/* Se cerró la ventanita, con «Salir», con Esc o con su propia ×. El panel
   vuelve a su sitio, pero el ESCENARIO SE QUEDA: la ventana sigue
   compartida en Zoom y lo que hay debajo es el panel privado, con tiempos y
   bitácora. Volver a él es un clic aparte, después de dejar de compartir. */
function alCerrarConsola() {
  if (!consola) return;
  consola = null;
  pararReloj();
  window.clearTimeout(borrarEstado);
  raiz.classList.remove("activo", "en-consola");
  try {
    origen.padre.insertBefore(raiz, origen.siguiente);
  } catch {
    document.body.append(raiz);
  }
  recursos = [];
  if (hayEscenario()) {
    $("#escenario-aviso").textContent =
      "Clase en pausa. Antes de volver al panel, deja de compartir en Zoom: si no, tus alumnos lo verán.";
    $("#escenario-control").hidden = false;
    $("#btn-escenario-reanudar").focus();
  }
}

export function salirModoClase() {
  if (!activo()) return;
  if (consola) {
    const pip = consola;
    alCerrarConsola();
    try {
      pip.close();
    } catch {
      /* ya estaba cerrándose */
    }
    return;
  }
  raiz.classList.remove("activo");
  pararReloj();
  if (document.fullscreenElement) document.exitFullscreen?.().catch(() => {});
  bloquearPanel(false);
  recursos = [];
  const destino =
    devolverFoco instanceof HTMLElement && devolverFoco.isConnected && devolverFoco !== document.body
      ? devolverFoco
      : $("#btn-modo-clase");
  destino.focus();
  devolverFoco = null;
}

function volverAlPanel() {
  quitarEscenario();
  $("#escenario-control").hidden = true;
  bloquearPanel(false);
  recordarClase({ escenario: false });
  $("#btn-modo-clase").focus();
}

/**
 * Si Pauta se recargó a media clase en el modo de pestañas, la ventana
 * sigue compartida en Zoom y, sin esto, el grupo vería el panel. Se vuelve
 * a la misma sesión y se pone el escenario; la ventanita se reabre con un
 * clic, porque el navegador solo la da a cambio de uno. Lo llama main.js en
 * cuanto hay datos.
 */
export function retomarClaseTrasRecarga() {
  if (!clase?.escenario || !presentacionEncendida() || modoPresentacion() !== "pestanas") return;
  if (Date.now() - (clase.inicio || 0) >= VIGENCIA_MS) return;
  const im = estado.datos.materias.findIndex((m) => m.id === clase.materia);
  if (im < 0) return;
  const sesiones = estado.datos.materias[im].sesiones;
  const coincide = (s) => s && s.fecha === clase.fecha && s.titulo === clase.titulo;
  const is = coincide(sesiones[clase.sesion]) ? clase.sesion : sesiones.findIndex(coincide);
  if (is < 0) return;

  irAMateria(im);
  irASesion(is);
  repintar();
  if (!ponerEscenario()) return;
  bloquearPanel(true);
  $("#escenario-aviso").textContent =
    "Pauta se recargó a media clase. Si sigues compartiendo esta ventana, tus alumnos ven esta portada.";
  $("#escenario-control").hidden = false;
}

export function montarModoClase() {
  raiz = $("#modo-clase");
  el("#mc-salir").addEventListener("click", salirModoClase);
  el("#mc-anterior").addEventListener("click", () => mover(-1));
  el("#mc-siguiente").addEventListener("click", () => mover(1));
  el("#mc-abrir").addEventListener("click", abrir);
  el("#mc-portada").addEventListener("click", portada);
  document.addEventListener("keydown", teclas);

  $("#btn-escenario-reanudar").addEventListener("click", entrarModoClase);
  $("#btn-escenario-volver").addEventListener("click", volverAlPanel);

  /* Lo que se sabe después —un sitio que desconectó la ventana aparte, una
     portada que no llegó— se dice donde se esté mirando. */
  alPasarDespues((clave) => {
    if (clave === "desconectada" && enPantalla) enPantalla += ", en una ventana que Pauta ya no controla";
    if (activo()) {
      decirQuePaso(clave);
      pintarEnPantalla();
    } else {
      mostrarAviso(queDecir(clave)[0]);
    }
  });
}
