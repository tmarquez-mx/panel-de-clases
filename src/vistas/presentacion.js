/* =========================================================
   Presentación: lo que ven los alumnos en Zoom o en el proyector.

   El problema que resuelve. Abrir cada recurso en una pestaña nueva
   obligaba a elegir entre dos males: compartir la ventana entera, y que el
   grupo viera Pauta —el reloj, la bitácora, las notas— cada vez que se
   cambiaba de recurso; o compartir una sola pestaña, y que los recursos
   siguientes, que nacen en otra, no se compartieran.

   Hay dos maneras de resolverlo, y se usa la mejor que tenga el navegador.

   1. Pestañas y controles flotantes (Chrome y Edge). Durante el modo
      clase, los controles se mudan a una ventanita flotante —la de
      «imagen sobre imagen» de documento, la que usa Meet para los suyos—
      que siempre queda encima y que Zoom no captura cuando se comparte una
      ventana. La pestaña de Pauta pasa a ser el ESCENARIO: muestra la
      portada, y cada recurso se abre en una pestaña de esa misma ventana.
      Se comparte en Zoom la ventana de Chrome una sola vez.

   2. Ventana aparte (los demás navegadores). Una ventana con nombre que
      se va navegando con location.href, sin traerla al frente. Es lo que
      había antes, y tiene un límite que no se puede arreglar desde aquí:
      ver la nota de llevarAVentana.

   Por qué el primero es mejor, medido el 30-sep-2026 con Chrome real.
   YouTube, Google Drive, Classroom, Dropbox, iCloud, Canva, Padlet y
   Mentimeter mandan la cabecera Cross-Origin-Opener-Policy. Cuando la
   ventana aparte carga uno de ellos, el navegador la desconecta de Pauta
   por seguridad: el recurso se sigue viendo, pero Pauta ya no puede
   llevarle el siguiente. Antes se abría entonces OTRA ventana —que Zoom
   no estaba compartiendo— y se decía que la anterior «se había cerrado
   sola», que era falso: seguía ahí, con el video, delante del grupo.
   Con pestañas eso deja de importar: la pestaña desconectada se queda
   donde está y el siguiente recurso nace en otra pestaña DE LA MISMA
   VENTANA, que es lo que Zoom comparte. Nunca hay que volver a compartir.

   Por qué es un interruptor. Reutilizar una ventana o una pestaña exige
   conservar su referencia, y conservarla exige soltar noopener: la página
   abierta puede alcanzar window.opener. Se probó cortar ese vínculo
   (w.opener = null) y entonces Pauta tampoco puede navegarla. Así que se
   enciende a propósito y nace apagado; apagado, cada recurso se abre como
   siempre, en una pestaña aislada.
   ========================================================= */

import { $, esc } from "../util/dom.js";
import { fechaLarga } from "../util/fechas.js";
import { esWeb, urlSegura } from "../util/urls.js";
import { voz } from "../datos/vocabulario.js";
import { materia, sesion, estado } from "../estado.js";
import logotipoSvg from "../../assets/LOGO_pauta-secuencia.svg?raw";

/* El nombre es lo que hace que sea siempre la misma ventana o pestaña,
   también después de recargar Pauta. */
const NOMBRE_VENTANA = "pauta-presentacion";
const NOMBRE_PESTANA = "pauta-recurso";

/* Con rasgos, el navegador abre una ventana emergente: sin pestañas y sin
   barra de marcadores. El tamaño es 16:9, que es la forma de casi toda
   pantalla. Solo para la ventana aparte. */
const RASGOS = "popup=yes,width=1280,height=720";

const CLAVE = "panel-de-clases:presentacion";

/* La preferencia vive en el navegador y no en los datos: es de esta
   computadora —la que se conecta al proyector—, no de la materia. */
let encendida = false;
try {
  encendida = window.localStorage.getItem(CLAVE) === "1";
} catch {
  /* sin memoria: arranca apagada, que es lo de siempre */
}

/* Si la ventanita flotante falla al pedirla (una política del equipo, un
   navegador a medias), se cae a la ventana aparte hasta recargar. */
let sinConsola = false;

let ventana = null;  // la ventana aparte
let enPortada = false; // si lo que tiene encima es la portada
let pestana = null;  // la pestaña de los recursos, en el modo de pestañas

const viva = (w) => {
  try {
    return !!w && !w.closed;
  } catch {
    return false;
  }
};

export const presentacionEncendida = () => encendida;

/** "pestanas" si el navegador tiene la ventanita flotante; si no, "ventana". */
export function modoPresentacion() {
  const flotante = typeof window.documentPictureInPicture?.requestWindow === "function";
  return flotante && !sinConsola ? "pestanas" : "ventana";
}

/** La ventanita no se dejó abrir: el resto de la visita va con la ventana aparte. */
export function renunciarALaConsola() {
  sinConsola = true;
}

/** Enciende o apaga el modo. Devuelve cómo quedó. */
export function alternarPresentacion() {
  encendida = !encendida;
  try {
    window.localStorage.setItem(CLAVE, encendida ? "1" : "0");
  } catch {
    /* sin memoria: vale para esta sesión del navegador */
  }
  if (!encendida) cerrarVentana();
  return encendida;
}

/* Cierra la ventana aparte, si la hay. La pestaña de recursos no se toca:
   es una pestaña más de la ventana de quien da la clase, y cerrarla sola
   le quitaría algo que quizá sigue usando. */
function cerrarVentana() {
  if (viva(ventana)) {
    try {
      ventana.close();
    } catch {
      /* si el navegador no deja cerrarla, se queda; no es grave */
    }
  }
  ventana = null;
  enPortada = false;
}

/* ---------------------------------------------------------
   Lo que pasó, dicho a quien da la clase

   Los textos viven aquí y no en cada vista, porque las dos maneras de
   presentar dicen cosas distintas y las dos vistas que abren recursos —la
   tarjeta y el modo clase— tienen que decir lo mismo. Nada de alert(): un
   cuadro modal en mitad de la clase congela los controles y, en el modo de
   pestañas, aparecería encima del escenario, delante del grupo.
   --------------------------------------------------------- */

const LO_QUE_PASO = {
  presentacion: ["Listo: tus alumnos ven el recurso.", "bien"],
  portada: ["Tus alumnos ven la portada.", "bien"],
  reanudada: ["Clase reanudada donde ibas; el reloj sigue contando desde que empezaste.", "bien"],
  comparte: [
    "La ventana de presentación tiene la portada. Compártela en Zoom con Compartir → Ventana; si compartes «Pantalla», tus alumnos verán también esta.",
    "aviso",
  ],
  "comparte-pestana": [
    "En Zoom: Compartir → Ventanas de aplicación → la que lleva el nombre de la materia (no «Pestañas de Chrome»). En Mac, esa ventana tiene que estar en tu mismo escritorio y sin pantalla completa para aparecer. Esta ventanita solo la ves tú.",
    "aviso",
  ],
  pestana: ["Se abrió en otra pestaña, detrás de esta pantalla. Sal con Esc para verla.", "bien"],
  programa: ["Se abrió en su programa. Si quieres que lo vean, compártelo en Zoom aparte.", "aviso"],
  reabierta: [
    "Esta es una ventana de presentación nueva: compártela en Zoom (Compartir → Ventana) y cierra la anterior.",
    "problema",
  ],
  desconectada: [
    "Ese sitio desconectó la ventana compartida (lo hacen YouTube, Google Drive, Canva, Padlet…). Se sigue viendo, pero el próximo recurso abrirá una ventana nueva que tendrás que volver a compartir. En Chrome o Edge esto no pasa.",
    "problema",
  ],
  "portada-lenta": [
    "La portada tardó demasiado y la ventana quedó en blanco. No la cierres —Zoom la está compartiendo—: vuelve a pedir la portada o abre el siguiente recurso.",
    "problema",
  ],
  "sin-consola": [
    "No se pudo abrir la ventanita de controles, así que los recursos irán a una ventana aparte: compártela en Zoom cuando aparezca.",
    "aviso",
  ],
  copiada: ["Es una ruta del disco: se copió al portapapeles.", "bien"],
  bloqueada: ["El navegador bloqueó la apertura. Permite las ventanas emergentes para esta página y vuelve a intentarlo.", "problema"],
  "sin-liga": ["Este recurso no tiene liga.", "problema"],
  invalida: ["Esa liga no tiene una forma que el panel pueda abrir. Revísala con «Revisar enlaces».", "problema"],
  "sin-sesion": ["Abre una sesión para poder mostrar su portada.", "problema"],
};

/** [texto, clase] de lo que pasó; clase es "bien", "aviso" o "problema". */
export const queDecir = (clave) => LO_QUE_PASO[clave] || ["", "bien"];

/* Hay cosas que se saben después: que un sitio desconectó la ventana, que la
   portada no llegó a escribirse. Quien esté a cargo de decirlo se apunta aquí. */
let avisarDespues = () => {};
export function alPasarDespues(fn) {
  avisarDespues = fn;
}

/* ---------------------------------------------------------
   Llevar un recurso
   --------------------------------------------------------- */

/* Modo de pestañas. Sin rasgos, window.open abre una pestaña de ESTA misma
   ventana, que es la compartida. Se reutiliza mientras se pueda; cuando un
   sitio la desconecta, el siguiente recurso nace en una pestaña nueva de la
   misma ventana, y para Zoom no cambia nada. Navegar con location.href no
   la trae al frente, por eso el focus(): el recurso tiene que quedar a la
   vista del grupo. Se probó en Chrome que las dos cosas funcionan cuando la
   orden viene de un clic en la ventanita flotante. */
function llevarAPestana(url) {
  if (viva(pestana)) {
    try {
      pestana.location.href = url;
      pestana.focus();
      return "presentacion";
    } catch {
      pestana = null; // se cae a abrir una nueva
    }
  }
  const w = window.open(url, NOMBRE_PESTANA);
  if (!w) return "bloqueada";
  pestana = w;
  try {
    w.focus();
  } catch {
    /* ya está al frente: una pestaña nueva nace activa */
  }
  return "presentacion";
}

/* Modo de ventana aparte. Escribir location.href navega la ventana sin
   traerla al frente: el foco se queda en Pauta y la ventana compartida
   cambia detrás. Devuelve:

     "presentacion" — la ventana de siempre, navegada. Lo normal.
     "reabierta"    — la anterior se perdió y esta es OTRA. Para Zoom una
                      ventana nueva no es la que se estaba compartiendo.
     "bloqueada"    — el navegador no dejó abrirla.

   Una ventana se pierde cuando quien da la clase la cierra y, sobre todo,
   cuando un sitio con Cross-Origin-Opener-Policy la desconecta (ver la
   nota del principio). Por eso se vigila unos segundos después de cada
   recurso: si se desconecta, se dice en el momento, mientras todavía se
   ve el recurso, y no al pedir el siguiente. */
function llevarAVentana(url) {
  const habiaVentana = !!ventana;
  if (viva(ventana)) {
    try {
      ventana.location.href = url;
      enPortada = false;
      vigilar(ventana);
      return "presentacion";
    } catch {
      ventana = null; // referencia inservible: se abre una nueva abajo
    }
  }

  /* Sin noopener a propósito: es lo que permite conservar la referencia y
     reutilizar la ventana. Ver la nota de arriba. */
  ventana = window.open(url, NOMBRE_VENTANA, RASGOS);
  enPortada = false;
  if (!ventana) return "bloqueada";
  vigilar(ventana);
  return habiaVentana ? "reabierta" : "presentacion";
}

/* La desconexión llega al terminar de cargar el sitio, en uno o dos
   segundos; cinco dan margen a una red lenta. */
let vigilancia = 0;
function vigilar(w) {
  window.clearInterval(vigilancia);
  let vueltas = 0;
  vigilancia = window.setInterval(() => {
    vueltas += 1;
    if (ventana !== w) {
      window.clearInterval(vigilancia); // ya se pidió otra cosa
    } else if (!viva(w)) {
      window.clearInterval(vigilancia);
      avisarDespues("desconectada");
    } else if (vueltas >= 20) {
      window.clearInterval(vigilancia);
    }
  }, 250);
}

/**
 * Abre un recurso donde lo ven los alumnos, si el modo está encendido y la
 * liga es web. Devuelve qué pasó: "" cuando no le toca —y entonces quien
 * llama sigue con la apertura de siempre— o una clave de queDecir().
 */
export function abrirEnPresentacion(url) {
  if (!encendida) return "";
  /* Solo las ligas http(s). Las de aplicación de escritorio (ms-word:,
     obsidian:) no cargan una página: dejarían la ventana compartida en
     blanco mientras el programa abre aparte. */
  if (!esWeb(url) || !urlSegura(url)) return "";
  return modoPresentacion() === "pestanas" ? llevarAPestana(url) : llevarAVentana(url);
}

/* ---------------------------------------------------------
   La portada

   Propuesta editorial: fondo gris muy claro, todo el peso abajo a la
   izquierda, un filete rojo como único acento y el logotipo al pie en
   gris. Se descartó la versión centrada, que no dice de quién es la
   clase, y la oscura, que daba un fogonazo a blanco al abrir el primer
   recurso —los recursos casi siempre son blancos—.
   --------------------------------------------------------- */

/* El logotipo original es de dos colores. Aquí va monocromo en gris, y el
   teñido se hace con CSS: la regla `fill` de la hoja gana a los atributos
   fill de cada trazo, así que el archivo de la marca no se toca. Se le
   quita la declaración XML, que dentro de un HTML no significa nada. */
const LOGOTIPO = logotipoSvg
  .replace(/<\?xml[^>]*\?>/i, "")
  .replace(/<svg /i, '<svg class="marca" ');

function datosDePortada() {
  const m = materia();
  const s = sesion();
  if (!s) return null;
  const num = String(s.num || estado.sesionActiva + 1).padStart(2, "0");
  return {
    nombre: m?.nombre || "",
    clave: m?.clave || "",
    titulo: s.titulo || "",
    meta: `${voz(m).encuentro} ${num} · ${fechaLarga(s.fecha)}`,
  };
}

function htmlDePortada(d) {
  return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="utf-8">
<title>${esc(d.nombre || "Pauta")}</title>
<style>
  :root{
    --papel:#F2F1EF; --negro:#1D1D1F; --gris:#6E6E76; --rojo:#A62237;
    --texto:system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI Variable Text","Segoe UI","Helvetica Neue",Arial,sans-serif;
  }
  *{box-sizing:border-box}
  html,body{height:100%}
  body{
    margin:0; background:var(--papel); color:var(--negro);
    font-family:var(--texto); -webkit-font-smoothing:antialiased;
    display:flex; flex-direction:column; justify-content:flex-end;
    /* Margen generoso y proporcional a la ventana: la portada se ve igual
       de holgada en una emergente de 1280 que a pantalla completa. */
    padding:6vmin 7vmin 5vmin;
  }
  .filete{
    width:clamp(56px,7vw,104px); height:5px;
    background:var(--rojo); border-radius:2px; margin-bottom:clamp(20px,3vh,36px);
  }
  h1{
    margin:0; font-size:clamp(34px,6.4vw,92px); line-height:1.04;
    font-weight:650; letter-spacing:-.02em; max-width:18ch;
  }
  .titulo{
    margin:clamp(14px,2.2vh,26px) 0 0;
    font-size:clamp(17px,2.1vw,30px); line-height:1.3; font-weight:450;
    color:var(--negro); max-width:34ch;
  }
  .meta{
    margin:clamp(10px,1.4vh,16px) 0 0;
    font-size:clamp(13px,1.25vw,18px); color:var(--gris); letter-spacing:.01em;
  }
  .pie{
    margin-top:clamp(28px,6vh,64px);
    display:flex; align-items:flex-end; justify-content:space-between; gap:24px;
  }
  /* El teñido: gana a los fill del archivo original, que queda intacto. */
  .marca{height:clamp(18px,2.2vh,26px); width:auto; opacity:.55}
  .marca path{fill:var(--gris)}
  .clave{font-size:clamp(12px,1.1vw,15px); color:var(--gris); text-align:right}
  /* Sin animación de entrada a propósito: la portada vive en una ventana
     que casi nunca tiene el foco —ese es el punto—, y el navegador pausa
     las animaciones de las ventanas tapadas. Una portada que apareciera
     con un fundido podría quedarse a medias, en blanco, delante del grupo. */
</style>
</head>
<body>
  <div class="filete"></div>
  <h1>${esc(d.nombre)}</h1>
  ${d.titulo ? `<p class="titulo">${esc(d.titulo)}</p>` : ""}
  <p class="meta">${esc(d.meta)}</p>
  <div class="pie">
    ${LOGOTIPO}
    ${d.clave ? `<p class="clave">${esc(d.clave)}</p>` : ""}
  </div>
</body>
</html>`;
}

/* ---------- El escenario: la portada en la pestaña de Pauta ----------

   En el modo de pestañas lo que se comparte es la ventana de Pauta, así que
   mientras dura la clase la pestaña de Pauta tiene que mostrar algo que el
   grupo pueda ver: la portada, a toda la ventana, tapando el panel. Va en un
   iframe con srcdoc para usar exactamente la misma portada que la ventana
   aparte, con sus estilos aislados de los del panel. */

let tituloDelPanel = "";

export function ponerEscenario() {
  const d = datosDePortada();
  if (!d) return false;
  const escenario = $("#escenario");
  $("#escenario-portada").srcdoc = htmlDePortada(d);
  if (escenario.hidden) tituloDelPanel = document.title;
  escenario.hidden = false;
  /* Es lo que Zoom pone en su lista de ventanas para compartir: tiene que
     reconocerse de un vistazo. */
  document.title = `${d.nombre} — Pauta`;
  return true;
}

export function quitarEscenario() {
  const escenario = $("#escenario");
  if (escenario.hidden) return;
  escenario.hidden = true;
  $("#escenario-portada").removeAttribute("srcdoc");
  if (tituloDelPanel) document.title = tituloDelPanel;
}

export const hayEscenario = () => !$("#escenario").hidden;

/* ---------- La portada en la ventana aparte ---------- */

/* Escribir en la ventana solo se puede cuando ya tiene encima el
   about:blank nuevo, que hereda el origen de Pauta. Si venía de un
   recurso ajeno, esa navegación tarda unos milisegundos y hasta entonces
   ventana.document es de otro origen y ni siquiera se deja mirar. De ahí
   el reintento: se comprueba que el documento sea el about:blank propio
   antes de escribirle, y si todavía no lo es se espera un poco.
   El primer intento es inmediato y los siguientes esperan un cuadro (16 ms).
   Se usa un temporizador y no requestAnimationFrame: el navegador pausa ese
   último cuando la ventana de Pauta está tapada o en otro escritorio, y
   quien da clase en Zoom tiene justo eso a los pocos segundos de pedir la
   portada. */
const ESPERA_MS = 16;
const INTENTOS = 90; // ~1.5 s de margen con la ventana a la vista

function escribirPortada(w, html, intentos = 0) {
  /* Nunca decir «ciérrala». Cerrar la ventana es lo único que de verdad no
     tiene arreglo en mitad de una clase: Zoom estaba compartiendo ESA
     ventana, y al cerrarla hay que volver a compartir delante del grupo.
     Si la portada no llega a escribirse, la ventana sigue sirviendo. */
  let doc = null;
  try {
    doc = w.document;
    if (doc.URL !== "about:blank") doc = null; // todavía el recurso anterior
  } catch {
    doc = null; // todavía de otro origen
  }

  if (!doc) {
    if (intentos >= INTENTOS) {
      avisarDespues("portada-lenta");
      return;
    }
    window.setTimeout(() => escribirPortada(w, html, intentos + 1), ESPERA_MS);
    return;
  }

  doc.open();
  doc.write(html);
  doc.close();
  /* Hasta aquí no era verdad que hubiera portada. Marcarlo antes de
     escribir dejaba a Pauta creyendo que la ventana mostraba la portada
     cuando había quedado en blanco. */
  enPortada = true;
}

function portadaEnVentana(html) {
  /* Si la ventana ya tiene la portada encima, se le reescribe directo. No
     se navega otra vez a about:blank: esa navegación es asíncrona y
     borraría lo recién escrito. */
  if (viva(ventana) && enPortada) {
    escribirPortada(ventana, html);
    return "portada";
  }

  /* Con un recurso encima, se le pide el about:blank por location.href y
     no por window.open: volver a la portada no debe traer la ventana al
     frente y tapar Pauta. Escribirle hay que esperarlo: lo hace el reintento. */
  if (viva(ventana)) {
    try {
      ventana.location.href = "about:blank";
      enPortada = false; // todavía no: lo pone escribirPortada al lograrlo
      escribirPortada(ventana, html);
      return "portada";
    } catch {
      ventana = null; // referencia inservible: se abre una nueva abajo
    }
  }

  const habiaVentana = !!ventana;
  const w = window.open("about:blank", NOMBRE_VENTANA, RASGOS);
  if (!w) return "bloqueada";
  ventana = w;
  enPortada = false; // lo pone escribirPortada cuando de verdad la escribe
  escribirPortada(w, html);
  return habiaVentana ? "reabierta" : "portada";
}

/**
 * Lleva lo que ven los alumnos a la portada de la sesión abierta.
 * En el modo de pestañas, trae al frente la pestaña de Pauta, que durante la
 * clase es el escenario. En el de ventana, la abre si hace falta: es lo que
 * sirve para reservarla antes de empezar y para volver entre un recurso y el
 * siguiente. Devuelve una clave de queDecir().
 */
export function mostrarPortada() {
  const d = datosDePortada();
  if (!d) return "sin-sesion";
  if (modoPresentacion() === "pestanas") {
    ponerEscenario();
    /* Con el clic en la ventanita, Chrome deja que Pauta traiga su propia
       pestaña al frente; probado. Sin ese permiso no pasa nada visible, y
       el indicador «En pantalla» lo dice. */
    window.focus();
    return "portada";
  }
  return portadaEnVentana(htmlDePortada(d));
}

/* Aquí hubo un addEventListener("pagehide", cerrarVentana), para no dejar
   ventanas huérfanas al cerrar Pauta. Era un error caro en clase: «pagehide»
   no distingue cerrar de RECARGAR, así que recargar Pauta cerraba la ventana
   compartida. Ahora la ventana sobrevive a la recarga. Como lleva nombre, la
   Pauta recién cargada vuelve a encontrarla. Solo se cierra cuando se apaga
   el interruptor, que es cuando de verdad se quiso terminar. */
