/* Vista de sesión: cabecera, controles, bitácora y riel de recursos. */

import { $, esc, confirmar, avisar } from "../util/dom.js";
import { fechaCorta, fechaLarga } from "../util/fechas.js";
import { esLocal, esWeb, urlSegura, procedencia } from "../util/urls.js";
import { copiar } from "../util/portapapeles.js";
import { ordenarRecursosPorMomento, siguienteEstado, tiposDisponibles } from "../datos/modelo.js";
import {
  estado, materia, sesion, haySesion, actualizar, soloGuardar, repintar, suscribir,
} from "../estado.js";
import { abrirDlgRecurso, abrirDlgSesion, abrirDlgDuplicar, abrirDlgMover, borrarSesion } from "./dialogos.js";
import { entrarModoClase } from "./modoClase.js";
import { mostrarAviso } from "./aviso.js";
import { recordarParaDeshacer, deshacer } from "../historial.js";
import { abrirMenu, cerrarMenu } from "./menu.js";
import { voz } from "../datos/vocabulario.js";
import { nombreDeNube, suiteDe } from "../datos/nubes.js";
import { abrirLectura, formatearTexto } from "./lectura.js";
import {
  abrirEnPresentacion, presentacionEncendida, alternarPresentacion, mostrarPortada,
} from "./presentacion.js";

const CONTROLES_DE_SESION = [
  "#btn-editar-sesion", "#btn-borrar-sesion", "#btn-duplicar-sesion", "#btn-imprimir",
  "#btn-modo-clase", "#btn-abrir-todo", "#btn-nuevo", "#btn-nota", "#btn-ordenar",
  "#btn-mas-sesion", "#btn-mas-acciones",
];

/* Tras repintar, el riel se reconstruye entero y el foco se iría al principio
   de la página. Se anota qué control lo tenía para devolvérselo. */
let focoPendiente = null;

/** Convierte un botón que vive oculto en el documento en opción de menú.
 *  Hereda su título y su estado deshabilitado, así que no hay que
 *  duplicar esa lógica en dos lugares. */
function opcionDe(selector, etiqueta, extra = {}) {
  const boton = $(selector);
  return {
    etiqueta,
    titulo: boton?.title || "",
    desactivado: !boton || boton.disabled,
    accion: () => boton?.click(),
    ...extra,
  };
}

/** Abre un recurso. Las rutas locales no se pueden abrir desde el navegador:
 *  se copian al portapapeles para pegarlas en el explorador de archivos.
 *
 *  Es el único punto por el que se abre un recurso —la tarjeta y el modo
 *  clase pasan los dos por aquí—, así que también es el único lugar donde
 *  hay que preguntar por la ventana de presentación. */
export function abrirRecurso(url, boton) {
  if (!url) return "sin-liga";
  if (esLocal(url)) {
    copiar(url, boton, "Liga copiada");
    return "copiada";
  }
  if (!urlSegura(url)) {
    avisar("Esa liga no tiene una forma que el panel pueda abrir. Revísala con «Revisar enlaces».");
    return "invalida";
  }

  // Con el modo encendido, la liga va a la ventana compartida. Si el modo
  // está apagado, o la liga no es una página web, se cae a lo de siempre.
  const enLaVentana = abrirEnPresentacion(url);
  if (enLaVentana) return enLaVentana;

  /* window.open devuelve null cuando el navegador bloquea la ventana.
     Antes se ignoraba, y eso era una falla muda: la liga no se abría y el
     panel no decía nada, así que el botón parecía descompuesto. Peor en
     modo clase, donde la pantalla completa tapa cualquier pestaña nueva y
     ni siquiera se ve la que sí se abrió. */
  const pestana = window.open(url, "_blank", "noopener,noreferrer");
  return pestana ? "pestana" : "bloqueada";
}

function recursosVisibles() {
  const q = estado.busqueda.trim().toLowerCase();
  const tipo = estado.filtroTipo;
  return (sesion()?.recursos || []).filter((r) => {
    const coincide = !q || `${r.titulo} ${r.nota || ""}`.toLowerCase().includes(q);
    return coincide && (!tipo || r.tipo === tipo);
  });
}

function pintarFiltroDeTipos() {
  // Los tipos que aparecen en la materia, más los declarados en los datos.
  const enLaMateria = new Set(
    (materia()?.sesiones || []).flatMap((s) => s.recursos.map((r) => r.tipo))
  );
  const lista = [...new Set([...enLaMateria, ...tiposDisponibles(estado.datos)])]
    .filter(Boolean)
    .sort((a, b) => a.localeCompare(b, "es"));

  const select = $("#filtro-tipo");
  // Si el tipo filtrado ya no existe en la materia, se vuelve a "todos".
  if (estado.filtroTipo && !lista.includes(estado.filtroTipo)) estado.filtroTipo = "";
  select.innerHTML =
    '<option value="">Todos los tipos</option>' +
    lista.map((t) => `<option value="${esc(t)}">${esc(t)}</option>`).join("");
  select.value = estado.filtroTipo;
}

const NOMBRE_ESTADO = { pendiente: "pendiente", listo: "listo", usado: "usado" };

/* A partir de aquí una descripción se pliega: son unas seis líneas. */
const LARGO_PLEGADO = 320;

/* El cartelito del botón «Abrir» dice adónde va a ir el recurso, que no es
   lo mismo con la ventana de presentación encendida que sin ella. */
function tituloDeAbrir(url, local) {
  if (local) return "Copiar la ruta: el navegador no abre archivos del disco";
  if (presentacionEncendida() && esWeb(url) && urlSegura(url)) {
    return "Mostrar este recurso en la ventana de presentación, la que estás compartiendo";
  }
  return "Abrir este recurso en otra pestaña";
}

/* Una sola acción a la vista —abrir, que es lo que se necesita en clase—,
   el estado en el propio punto del riel, y las seis restantes a un paso
   dentro del menú. No se elimina ninguna función. */
function tarjeta(recurso, indice, total) {
  const local = esLocal(recurso.url);
  const actual = recurso.estado || "pendiente";
  const siguiente = siguienteEstado(actual);
  return `
  <article class="tarjeta" data-estado="${esc(actual)}" data-i="${indice}">
    <button class="punto" data-acc="estado"
      title="Ahora está ${esc(NOMBRE_ESTADO[actual] || actual)}. Marcar como ${esc(siguiente)}"
      aria-label="Estado del recurso: ${esc(NOMBRE_ESTADO[actual] || actual)}. Marcar como ${esc(siguiente)}"></button>
    <div class="cuerpo">
      <div class="etiquetas">
        <span class="tipo">${esc(recurso.tipo)}</span>
        ${recurso.momento ? `<span class="momento">${esc(recurso.momento)}</span>` : ""}
        ${actual !== "pendiente" ? `<span class="marca-estado">${esc(actual)}</span>` : ""}
      </div>
      <h3>${esc(recurso.titulo)}</h3>
      ${
        /* La descripción se muestra con formato —párrafos, viñetas y ligas con
           nombre legible—, siempre escapada antes: nada de lo que se escriba
           se ejecuta. Si es larga se pliega, y se despliega dentro de la
           tarjeta, sin mover la posición de lectura. */
        recurso.nota
          ? `<div class="nota${(recurso.nota || "").length > LARGO_PLEGADO ? " plegable" : ""}">${formatearTexto(recurso.nota)}</div>
             ${(recurso.nota || "").length > LARGO_PLEGADO
               ? `<button class="mas-texto" data-acc="desplegar" aria-expanded="false"
                    title="Mostrar el resto de la nota aquí mismo, sin salir de la tarjeta">Leer más</button>`
               : ""}`
          : ""
      }
      ${
        /* Procedencia, no la dirección entera: las ligas de la nube traen
           claves larguísimas que tapaban la tarjeta. La dirección completa
           sigue en el título del elemento y en «Copiar liga». Si la liga es
           de una nube conocida basta con nombrarla —antes decía «OneDrive»
           incluso en ligas de Drive, y además repetía el dominio al lado—;
           si no se reconoce, el dominio es lo más informativo que hay. */
        recurso.url
          ? `<span class="ruta" title="${esc(recurso.url)}">${esc(nombreDeNube(recurso.url) || procedencia(recurso.url))}</span>`
          : ""
      }
      ${local ? `<p class="aviso">Ruta local: no abre con un clic desde el navegador y no existe en otra computadora. Súbelo a tu nube y sustituye la liga.</p>` : ""}
    </div>
    <div class="acciones">
      ${recurso.nota ? `<button class="btn" data-acc="leer" title="Leer la descripción con texto amplio, sin nada alrededor">Leer</button>` : ""}
      ${recurso.url ? `<button class="btn btn-tinte" data-acc="abrir" title="${esc(tituloDeAbrir(recurso.url, local))}">${local ? "Copiar ruta" : "Abrir"}</button>` : ""}
      <button class="btn-icono" data-acc="menu" aria-haspopup="menu"
        aria-label="Más acciones de «${esc(recurso.titulo)}»"
        title="Copiar liga, editar, mover, reordenar o quitar">⋯</button>
    </div>
  </article>`;
}

/** Las seis acciones que dejaron de ocupar un botón propio. */
function menuDeTarjeta(boton, recurso, indice, total) {
  // Con un filtro puesto, el vecino de arriba o de abajo puede no estar a la
  // vista: reordenar movería el recurso respecto de algo que no se ve.
  const filtrado = !!(estado.busqueda.trim() || estado.filtroTipo);
  const razonFiltro = "Quita la búsqueda y el filtro para reordenar: con ellos puestos el vecino podría no estar a la vista";

  abrirMenu(boton, [
    ...(recurso.url
      ? [{ etiqueta: "Copiar liga", titulo: "Copiar la liga al portapapeles", accion: () => copiar(recurso.url, boton, "Copiada") }]
      : []),
    { etiqueta: "Editar…", titulo: "Cambiar título, tipo, minutos, liga y nota", accion: () => abrirDlgRecurso(indice) },
    { etiqueta: "Mover a otra sesión…", titulo: "Pasar este recurso a otra sesión de la materia", accion: () => abrirDlgMover(indice) },
    "---",
    {
      etiqueta: "Subir un lugar",
      titulo: "Subir un lugar en el orden de la clase",
      desactivado: filtrado || indice === 0,
      razon: filtrado ? razonFiltro : "Ya es el primero de la sesión",
      accion: () => moverRecurso(indice, -1),
    },
    {
      etiqueta: "Bajar un lugar",
      titulo: "Bajar un lugar en el orden de la clase",
      desactivado: filtrado || indice === total - 1,
      razon: filtrado ? razonFiltro : "Ya es el último de la sesión",
      accion: () => moverRecurso(indice, 1),
    },
    "---",
    { etiqueta: "Quitar de la sesión", peligro: true, titulo: "Quitar este recurso de la sesión. Se puede deshacer", accion: () => quitarRecurso(indice) },
  ]);
}

function moverRecurso(i, paso) {
  const recursos = sesion()?.recursos;
  const destino = i + paso;
  if (!recursos || destino < 0 || destino >= recursos.length) return;
  recursos.splice(destino, 0, recursos.splice(i, 1)[0]);
  focoPendiente = { i: destino, acc: "menu" };
  actualizar();
}

function quitarRecurso(i) {
  const recursos = sesion()?.recursos;
  const r = recursos?.[i];
  if (!r) return;
  if (!confirmar(`¿Quitar "${r.titulo}" de esta sesión?`)) return;
  recordarParaDeshacer();
  recursos.splice(i, 1);
  actualizar();
  mostrarAviso(`Se quitó «${r.titulo}» de esta sesión.`, {
    etiqueta: "Deshacer",
    titulo: "Devolver el recurso a su lugar",
    accion: deshacer,
  });
}

/* «Nueva nota» abre un documento en blanco de la suite de la materia, así
   que el rótulo tiene que decir cuál. Sin suite —Dropbox, iCloud— no hay
   documento que abrir: el atajo se esconde en vez de mentir. */
function rotularNotaNueva() {
  const doc = suiteDe(materia()).crear.find((c) => c.clave === "doc");
  const boton = $("#btn-nota");
  boton.dataset.sinSuite = doc ? "" : "1";
  boton.textContent = doc ? `Nueva nota en ${doc.boton}` : "Nueva nota";
  boton.title = doc
    ? `Abrir un ${doc.nombre} en blanco y dejar listo el formulario para pegar su liga`
    : "Esta materia no tiene suite para crear archivos en blanco. Elígela al editar la materia";
}

function pintarSesion() {
  const hay = haySesion();
  for (const selector of CONTROLES_DE_SESION) $(selector).disabled = !hay;
  $("#bitacora").hidden = !hay;

  if (!hay) {
    $("#meta-sesion").textContent = materia()?.nombre || "";
    $("#titulo-sesion").textContent = voz(materia()).sinEncuentros;
    $("#proposito-sesion").textContent = voz(materia()).primerEncuentro;
    $("#conteo").textContent = "";
    $("#riel").innerHTML = `<div class="vacio">${voz(materia()).primerEncuentro}</div>`;
    return;
  }

  const s = sesion();
  const num = String(s.num || estado.sesionActiva + 1).padStart(2, "0");
  $("#meta-sesion").textContent = `${voz(materia()).encuentro} ${num} · ${fechaLarga(s.fecha)}`;
  $("#titulo-sesion").textContent = s.titulo;
  $("#proposito-sesion").textContent = s.proposito || "";

  // Solo se reescribe si cambió, para no mover el cursor mientras se escribe.
  const caja = $("#txt-bitacora");
  if (caja.value !== (s.bitacora || "")) caja.value = s.bitacora || "";
  $("#bitacora-impresa").textContent = s.bitacora || "";

  pintarFiltroDeTipos();
  rotularNotaNueva();

  const visibles = recursosVisibles();
  const revisados = s.recursos.filter((r) => r.estado === "listo" || r.estado === "usado").length;
  $("#conteo").textContent = `${visibles.length} de ${s.recursos.length} recursos · ${revisados} revisados`;

  $("#riel").innerHTML = visibles.length
    ? visibles.map((r) => tarjeta(r, s.recursos.indexOf(r), s.recursos.length)).join("")
    : `<div class="vacio">No hay recursos que coincidan. Ajusta la búsqueda o agrega el primero.</div>`;

  // Se acaba de reconstruir el riel entero: hay que devolver el foco al
  // control que lo tenía, o quien usa teclado vuelve al inicio de la página.
  if (focoPendiente) {
    const { i, acc } = focoPendiente;
    focoPendiente = null;
    $(`#riel .tarjeta[data-i="${i}"] [data-acc="${acc}"]`)?.focus();
  }
}

function accionEnTarjeta(e) {
  const boton = e.target.closest("[data-acc]");
  if (!boton) return;
  const tarjetaHtml = boton.closest(".tarjeta");
  const i = Number(tarjetaHtml.dataset.i);
  const recursos = sesion()?.recursos;
  const r = recursos?.[i];
  if (!r) return;

  switch (boton.dataset.acc) {
    case "abrir":
      abrirRecurso(r.url, boton);
      break;
    case "estado":
      r.estado = siguienteEstado(r.estado);
      focoPendiente = { i, acc: "estado" }; // el punto sigue bajo el dedo
      actualizar();
      break;
    case "menu":
      menuDeTarjeta(boton, r, i, recursos.length);
      break;
    case "leer":
      abrirLectura(r, sesion());
      break;
    case "desplegar": {
      /* Se despliega en el sitio, sin repintar: repintar reconstruiría el
         riel y la lectora perdería el punto donde iba. */
      const nota = tarjetaHtml.querySelector(".nota");
      const abierta = nota.classList.toggle("abierta");
      boton.textContent = abierta ? "Mostrar menos" : "Leer más";
      boton.setAttribute("aria-expanded", String(abierta));
      break;
    }
    default:
      break;
  }
}

/* «Abrir todo» se queda con pestañas y no pasa por abrirRecurso: son
   varias ligas a la vez, y en una sola ventana compartida se pisarían unas
   a otras hasta dejar solo la última. */
function abrirTodo() {
  const web = (sesion()?.recursos || []).filter((r) => esWeb(r.url) && urlSegura(r.url));
  if (!web.length) {
    avisar("Esta sesión no tiene ligas web. Las rutas locales se abren desde el sistema de archivos.");
    return;
  }
  if (!confirmar(`Se abrirán ${web.length} pestañas. Si el navegador bloquea las ventanas emergentes, permítelas para esta página.`)) return;
  for (const r of web) window.open(r.url, "_blank", "noopener,noreferrer");
}

/* El interruptor de la ventana de presentación. Al encenderlo abre la
   portada en el acto: es el momento en que hay que compartirla en Zoom, y
   una ventana vacía no se sabe compartir. */
function alternarModoPresentacion() {
  const quedo = alternarPresentacion();
  repintar(); // el cartelito de «Abrir» dice otra cosa según el modo
  if (!quedo) {
    mostrarAviso("Los recursos vuelven a abrirse en una pestaña nueva cada uno.");
    return;
  }
  if (haySesion() && mostrarPortada()) {
    mostrarAviso("Ventana de presentación abierta con la portada. Compártela ahora en Zoom o llévala al proyector.");
  }
}

export function montarVistaSesion() {
  $("#buscar").addEventListener("input", (e) => {
    estado.busqueda = e.target.value;
    repintar();
  });
  $("#filtro-tipo").addEventListener("change", (e) => {
    estado.filtroTipo = e.target.value;
    repintar();
  });

  $("#txt-bitacora").addEventListener("input", (e) => {
    const s = sesion();
    if (!s) return;
    s.bitacora = e.target.value;
    $("#bitacora-impresa").textContent = s.bitacora;
    soloGuardar(); // no se repinta: movería el cursor del textarea
  });

  $("#riel").addEventListener("click", accionEnTarjeta);

  // La bitácora es plegable, y lo que está plegado no se imprime. Se abre
  // para imprimir y se devuelve a como estaba.
  let bitacoraEstaba = false;
  addEventListener("beforeprint", () => {
    const d = $("#bitacora");
    bitacoraEstaba = d.open;
    if ($("#txt-bitacora").value.trim()) d.open = true;
  });
  addEventListener("afterprint", () => {
    $("#bitacora").open = bitacoraEstaba;
  });

  $("#btn-nuevo").addEventListener("click", () => abrirDlgRecurso(null));

  $("#btn-ordenar").addEventListener("click", () => {
    const s = sesion();
    if (!s?.recursos.length) return;
    const antes = s.recursos.map((r) => r.titulo).join("|");
    ordenarRecursosPorMomento(s);
    if (s.recursos.map((r) => r.titulo).join("|") === antes) {
      mostrarAviso("Los recursos ya estaban en el orden que marcan sus minutos.");
      return;
    }
    actualizar();
    mostrarAviso("Los recursos se acomodaron según sus minutos.");
  });
  $("#btn-mas-sesion").addEventListener("click", (e) =>
    abrirMenu(e.currentTarget, [
      opcionDe("#btn-duplicar-sesion", "Duplicar sesión…"),
      opcionDe("#btn-imprimir", "Imprimir guion"),
      "---",
      opcionDe("#btn-borrar-sesion", "Eliminar sesión", { peligro: true }),
    ])
  );

  $("#btn-mas-acciones").addEventListener("click", (e) =>
    abrirMenu(e.currentTarget, [
      opcionDe("#btn-abrir-todo", "Abrir todas las ligas"),
      opcionDe("#btn-ordenar", "Ordenar por minutos"),
      "---",
      {
        etiqueta: presentacionEncendida()
          ? "Ventana de presentación: encendida"
          : "Ventana de presentación: apagada",
        titulo: presentacionEncendida()
          ? "Apagar: los recursos volverán a abrirse en una pestaña nueva cada uno"
          : "Encender: los recursos se abrirán todos en una misma ventana aparte, para compartirla en Zoom o en el proyector",
        accion: alternarModoPresentacion,
      },
      {
        etiqueta: "Mostrar la portada",
        titulo: "Llevar la ventana de presentación a la pantalla de título de esta sesión",
        desactivado: !presentacionEncendida() || !haySesion(),
        razon: presentacionEncendida()
          ? "No hay ninguna sesión abierta"
          : "Primero enciende la ventana de presentación",
        accion: mostrarPortada,
      },
      "---",
      opcionDe("#btn-nota", $("#btn-nota").textContent, {
        desactivado: $("#btn-nota").disabled || $("#btn-nota").dataset.sinSuite === "1",
        razon: "Elige una suite al editar la materia para crear archivos en blanco",
      }),
    ])
  );

  $("#btn-editar-sesion").addEventListener("click", () => abrirDlgSesion(estado.sesionActiva));
  $("#btn-borrar-sesion").addEventListener("click", () => borrarSesion(estado.sesionActiva));
  $("#btn-duplicar-sesion").addEventListener("click", () => abrirDlgDuplicar(estado.sesionActiva));
  $("#btn-modo-clase").addEventListener("click", entrarModoClase);
  $("#btn-abrir-todo").addEventListener("click", abrirTodo);
  $("#btn-imprimir").addEventListener("click", () => window.print());

  suscribir(() => {
    cerrarMenu(); // el menú cuelga de un botón que está por desaparecer
    const enSemestre = estado.vistaSemestre;
    $("#vista-sesion").hidden = enSemestre;
    $("#vista-semestre").hidden = !enSemestre;
    if (!enSemestre) pintarSesion();
  });
}
