/* =========================================================
   Ventana de presentación: la pantalla que ven los alumnos.

   El problema que resuelve. Hasta ahora los recursos se abrían con
   window.open(url, "_blank"): una pestaña nueva cada vez, en la misma
   ventana del navegador. En Zoom eso obliga a elegir entre dos males.
   Compartir la ventana entera significa que los alumnos ven Pauta —el
   reloj, la bitácora, las notas de quien da la clase— cada vez que se
   cambia de recurso. Compartir una sola pestaña significa que los
   recursos siguientes, que nacen en otra pestaña, no se comparten.

   La salida es una ventana con nombre. window.open(url, NOMBRE, rasgos)
   reutiliza siempre la misma ventana, así que se comparte una vez en Zoom
   y se queda compartida toda la sesión. Para cambiar de recurso no se
   vuelve a abrir: se le escribe la dirección con ventana.location.href,
   que navega sin traer la ventana al frente. Quien da la clase se queda en
   Pauta y la ventana compartida cambia detrás.

   Por qué es un interruptor y no el único comportamiento. Reutilizar una
   ventana exige conservar su referencia, y conservarla exige soltar
   noopener: la página abierta puede alcanzar window.opener. Es un cambio
   real respecto del comportamiento de siempre, así que se enciende a
   propósito y nace apagado. Con el interruptor apagado no cambia nada:
   window.open(url, "_blank", "noopener,noreferrer"), como antes.

   La portada existe para poder reservar la ventana antes de la clase:
   se comparte en Zoom mostrando el título de la sesión, sin proyectar
   ningún recurso antes de tiempo, y se vuelve a ella entre un recurso y
   el siguiente. Se escribe sobre about:blank, que hereda el origen de
   Pauta; así no hay ningún archivo más que publicar ni que cargar, y la
   ventana funciona igual abriendo Pauta desde el disco.
   ========================================================= */

import { esc, avisar } from "../util/dom.js";
import { fechaLarga } from "../util/fechas.js";
import { esWeb, urlSegura } from "../util/urls.js";
import { voz } from "../datos/vocabulario.js";
import { materia, sesion, estado } from "../estado.js";
import logotipoSvg from "../../assets/LOGO_pauta-secuencia.svg?raw";

/* El nombre es lo que hace que sea siempre la misma ventana. */
const NOMBRE_VENTANA = "pauta-presentacion";

/* Con rasgos, el navegador abre una ventana emergente: sin pestañas y sin
   barra de marcadores. En el proyector y en Zoom se ve el recurso, no el
   navegador. El tamaño es 16:9, que es la forma de casi toda pantalla. */
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

let ventana = null;
/* Si lo que la ventana tiene encima es la portada. Importa porque a la
   portada se le puede escribir directo, y a un recurso no. */
let enPortada = false;

function viva() {
  try {
    return !!ventana && !ventana.closed;
  } catch {
    return false;
  }
}

export const presentacionEncendida = () => encendida;

/** Enciende o apaga el modo. Devuelve cómo quedó. */
export function alternarPresentacion() {
  encendida = !encendida;
  try {
    window.localStorage.setItem(CLAVE, encendida ? "1" : "0");
  } catch {
    /* sin memoria: vale para esta sesión del navegador */
  }
  if (!encendida) cerrarPresentacion();
  return encendida;
}

/* Cierra la ventana, si la hay. Al apagar el modo y al cerrar Pauta. */
function cerrarPresentacion() {
  if (viva()) {
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
   Navegar la ventana
   --------------------------------------------------------- */

/* Lleva la ventana de presentación a una dirección. Devuelve qué pasó:

     "presentacion" — la ventana de siempre, navegada. Lo normal.
     "reabierta"    — la ventana se había muerto y esta es OTRA. Importa
                      decirlo: para Zoom una ventana nueva no es la que se
                      estaba compartiendo, así que hay que volver a
                      compartirla. Antes se reabría en silencio y lo único
                      que se notaba era que Zoom pedía permiso de la nada.
     "bloqueada"    — el navegador no dejó abrirla.

   Una ventana puede morirse sin que Pauta tenga la culpa: hay páginas que
   se cierran solas, y Chrome cierra una ventana abierta por script cuando
   lo único que hizo fue descargar un archivo en vez de mostrarlo —lo que
   pasa con varios tipos de archivo de la nube—. */
function llevarAPresentacion(url) {
  const habiaVentana = !!ventana;
  if (viva()) {
    try {
      /* Escribir location.href navega la ventana sin traerla al frente:
         el foco se queda en Pauta y la ventana compartida cambia detrás.
         Es legal aunque la ventana esté en otro sitio: location.href se
         puede escribir entre orígenes distintos, solo no se puede leer. */
      ventana.location.href = url;
      enPortada = false;
      return "presentacion";
    } catch {
      /* Referencia inservible (la ventana murió entre el closed y esto):
         se cae al window.open de abajo, que la vuelve a abrir. */
      ventana = null;
    }
  }

  /* Sin noopener a propósito: es lo que permite conservar la referencia y
     reutilizar la ventana. Ver la nota de arriba. */
  ventana = window.open(url, NOMBRE_VENTANA, RASGOS);
  enPortada = false;
  if (!ventana) {
    avisar(
      "El navegador bloqueó la ventana de presentación. Permite las ventanas emergentes para esta página y vuelve a intentarlo."
    );
    return "bloqueada";
  }
  return habiaVentana ? "reabierta" : "presentacion";
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

/* Escribir en la ventana solo se puede cuando ya tiene encima el
   about:blank nuevo, que hereda el origen de Pauta. Si venía de un
   recurso ajeno, esa navegación tarda unos milisegundos y hasta entonces
   ventana.document es de otro origen y ni siquiera se deja mirar. De ahí
   el reintento: se comprueba que el documento sea el about:blank propio
   antes de escribirle, y si todavía no lo es se espera un poco. */
/* El primer intento es inmediato; los siguientes van pegados al repintado
   del navegador, que es lo más pronto que puede estar listo el documento.
   Antes esperaban 25 ms fijos entre intentos, y eso era retraso puro y
   visible justo donde más se nota: al volver a la portada. */
const INTENTOS = 90; // ~1.5 s de margen a 60 cuadros por segundo

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
      avisar(
        "La portada tardó demasiado en aparecer y la ventana de presentación quedó en blanco. " +
          "No la cierres —Zoom está compartiendo esa ventana—: vuelve a pedir la portada, o abre " +
          "directamente el siguiente recurso."
      );
      return;
    }
    window.requestAnimationFrame(() => escribirPortada(w, html, intentos + 1));
    return;
  }

  doc.open();
  doc.write(html);
  doc.close();
  /* Hasta aquí no era verdad que hubiera portada. Marcarlo antes de
     escribir dejaba a Pauta creyendo que la ventana mostraba la portada
     cuando había quedado en blanco, y entonces la siguiente vez escribía
     encima del documento equivocado. */
  enPortada = true;
}

/**
 * Muestra la portada de la sesión abierta en la ventana de presentación,
 * abriéndola si hace falta. Es lo que se usa para reservar la ventana
 * antes de empezar y para volver a ella entre un recurso y el siguiente.
 * @returns {boolean} false si no hay sesión o el navegador la bloqueó.
 */
export function mostrarPortada() {
  const d = datosDePortada();
  if (!d) {
    avisar("Abre una sesión para poder mostrar su portada.");
    return false;
  }
  const html = htmlDePortada(d);

  /* Si la ventana ya tiene la portada encima, se le reescribe directo. No
     se navega otra vez a about:blank: esa navegación es asíncrona y
     borraría lo recién escrito. */
  if (viva() && enPortada) {
    escribirPortada(ventana, html);
    return true;
  }

  /* Si está abierta con un recurso encima, se le pide el about:blank por
     location.href y no por window.open: volver a la portada entre un
     recurso y el siguiente no debe traer la ventana al frente y tapar
     Pauta. Escribirle hay que esperarlo, y de eso se encarga el reintento. */
  if (viva()) {
    try {
      ventana.location.href = "about:blank";
      enPortada = false; // todavía no: lo pone escribirPortada al lograrlo
      escribirPortada(ventana, html);
      return true;
    } catch {
      ventana = null; // referencia inservible: se abre una nueva abajo
    }
  }

  const w = window.open("about:blank", NOMBRE_VENTANA, RASGOS);
  if (!w) {
    avisar(
      "El navegador bloqueó la ventana de presentación. Permite las ventanas emergentes para esta página y vuelve a intentarlo."
    );
    return false;
  }
  ventana = w;
  enPortada = false; // lo pone escribirPortada cuando de verdad la escribe
  escribirPortada(w, html);
  return true;
}

/**
 * Abre un recurso en la ventana de presentación, si el modo está
 * encendido y la liga es web.
 *
 * Devuelve qué pasó, no un sí o un no: "" cuando no le toca —y entonces
 * quien llama sigue con la apertura de siempre—, "presentacion" cuando la
 * ventana ya lleva el recurso, y "bloqueada" cuando el navegador no dejó
 * abrirla. Los tres casos se distinguen porque quien llama tiene que poder
 * decírselo a quien está dando clase: en pantalla completa no se ve nada
 * de lo que pase fuera, y una apertura que falla en silencio parece que el
 * botón no sirve.
 */
export function abrirEnPresentacion(url) {
  if (!encendida) return "";
  /* Solo las ligas http(s). Las de aplicación de escritorio (ms-word:,
     obsidian:) no cargan una página: dejarían la ventana compartida en
     blanco mientras el programa abre aparte. */
  if (!esWeb(url) || !urlSegura(url)) return "";
  return llevarAPresentacion(url);
}

/* Aquí hubo un addEventListener("pagehide", cerrarPresentacion), para no
   dejar ventanas huérfanas al cerrar Pauta. Era un error caro en clase:
   «pagehide» no distingue cerrar de RECARGAR, así que recargar Pauta
   cerraba la ventana compartida. La siguiente era una ventana nueva, y una
   ventana nueva es otra cosa para Zoom: pedía compartir otra vez, en mitad
   de la sesión y delante del grupo.
   Ahora la ventana sobrevive a la recarga. Como lleva nombre, la Pauta
   recién cargada vuelve a encontrarla y sigue usando la misma, así que lo
   que se está compartiendo no se interrumpe. Solo se cierra cuando se apaga
   el interruptor, que es cuando de verdad se quiso terminar. Si queda
   abierta después de cerrar Pauta, se cierra como cualquier otra ventana:
   es un estorbo menor comparado con perder lo compartido a media clase. */
