/* Vista de sesión: cabecera, controles, bitácora y riel de recursos. */

import { $, esc, confirmar, avisar } from "../util/dom.js";
import { fechaCorta, fechaLarga } from "../util/fechas.js";
import { esLocal, esNube, esWeb, urlSegura } from "../util/urls.js";
import { copiar } from "../util/portapapeles.js";
import { ordenarRecursosPorMomento, siguienteEstado, tiposDisponibles } from "../datos/modelo.js";
import {
  estado, materia, sesion, haySesion, actualizar, soloGuardar, repintar, suscribir,
} from "../estado.js";
import { abrirDlgRecurso, abrirDlgSesion, abrirDlgDuplicar, abrirDlgMover, borrarSesion } from "./dialogos.js";
import { entrarModoClase } from "./modoClase.js";
import { mostrarAviso } from "./aviso.js";
import { recordarParaDeshacer, deshacer } from "../historial.js";

const CONTROLES_DE_SESION = [
  "#btn-editar-sesion", "#btn-borrar-sesion", "#btn-duplicar-sesion", "#btn-imprimir",
  "#btn-modo-clase", "#btn-abrir-todo", "#btn-nuevo", "#btn-nota", "#btn-ordenar",
];

/** Abre un recurso. Las rutas locales no se pueden abrir desde el navegador:
 *  se copian al portapapeles para pegarlas en el explorador de archivos. */
export function abrirRecurso(url, boton) {
  if (!url) return;
  if (esLocal(url)) {
    copiar(url, boton, "Liga copiada");
    return;
  }
  if (!urlSegura(url)) {
    avisar("Esa liga no tiene una forma que el panel pueda abrir. Revísala con «Revisar enlaces».");
    return;
  }
  window.open(url, "_blank", "noopener,noreferrer");
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

function tarjeta(recurso, indice, total) {
  const local = esLocal(recurso.url);
  const siguiente = siguienteEstado(recurso.estado);
  return `
  <article class="tarjeta" data-estado="${esc(recurso.estado || "pendiente")}" data-i="${indice}">
    <div class="etiquetas">
      <span class="tipo">${esc(recurso.tipo)}</span>
      ${esNube(recurso.url) ? '<span class="tipo nube">OneDrive</span>' : ""}
      ${recurso.momento ? `<span class="momento">${esc(recurso.momento)}</span>` : ""}
    </div>
    <h3>${esc(recurso.titulo)}</h3>
    ${recurso.nota ? `<p class="nota">${esc(recurso.nota)}</p>` : ""}
    ${recurso.url ? `<span class="ruta">${esc(recurso.url)}</span>` : ""}
    ${local ? `<p class="aviso">Ruta local: no abre con un clic desde el navegador y no existe en otra computadora. Súbelo a OneDrive y sustituye la liga.</p>` : ""}
    <div class="acciones">
      ${recurso.url ? `<button class="btn" data-acc="abrir" title="${local ? "Copiar la ruta: el navegador no abre archivos del disco" : "Abrir este recurso en otra pestaña"}">Abrir</button>` : ""}
      ${recurso.url ? `<button class="btn" data-acc="copiar" title="Copiar la liga al portapapeles">Copiar liga</button>` : ""}
      <button class="btn" data-acc="estado" title="Cambiar el estado: pendiente, listo, usado">Marcar como ${esc(siguiente)}</button>
      <button class="btn" data-acc="subir" title="Subir un lugar en el orden de la clase" ${indice === 0 ? "disabled" : ""}>Subir</button>
      <button class="btn" data-acc="bajar" title="Bajar un lugar en el orden de la clase" ${indice === total - 1 ? "disabled" : ""}>Bajar</button>
      <button class="btn" data-acc="mover" title="Pasar este recurso a otra sesión de la materia">Mover a…</button>
      <button class="btn" data-acc="editar" title="Cambiar título, tipo, minutos, liga y nota">Editar</button>
      <button class="btn" data-acc="borrar" title="Quitar este recurso de la sesión. Se puede deshacer">Quitar</button>
    </div>
  </article>`;
}

function pintarSesion() {
  const hay = haySesion();
  for (const selector of CONTROLES_DE_SESION) $(selector).disabled = !hay;
  $("#bitacora").hidden = !hay;

  if (!hay) {
    $("#meta-sesion").textContent = materia()?.nombre || "";
    $("#titulo-sesion").textContent = "Sin sesiones todavía";
    $("#proposito-sesion").textContent = "Agrega la primera sesión desde el panel de la izquierda.";
    $("#conteo").textContent = "";
    $("#riel").innerHTML = `<div class="vacio">Agrega una sesión para empezar a colgar recursos de ella.</div>`;
    return;
  }

  const s = sesion();
  const num = String(s.num || estado.sesionActiva + 1).padStart(2, "0");
  $("#meta-sesion").textContent = `Sesión ${num} · ${fechaLarga(s.fecha)}`;
  $("#titulo-sesion").textContent = s.titulo;
  $("#proposito-sesion").textContent = s.proposito || "";

  // Solo se reescribe si cambió, para no mover el cursor mientras se escribe.
  const caja = $("#txt-bitacora");
  if (caja.value !== (s.bitacora || "")) caja.value = s.bitacora || "";
  $("#bitacora-impresa").textContent = s.bitacora || "";

  pintarFiltroDeTipos();

  const visibles = recursosVisibles();
  const revisados = s.recursos.filter((r) => r.estado === "listo" || r.estado === "usado").length;
  $("#conteo").textContent = `${visibles.length} de ${s.recursos.length} recursos · ${revisados} revisados`;

  $("#riel").innerHTML = visibles.length
    ? visibles.map((r) => tarjeta(r, s.recursos.indexOf(r), s.recursos.length)).join("")
    : `<div class="vacio">No hay recursos que coincidan. Ajusta la búsqueda o agrega el primero.</div>`;
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
    case "copiar":
      copiar(r.url, boton, "Copiada");
      break;
    case "estado":
      r.estado = siguienteEstado(r.estado);
      actualizar();
      break;
    case "subir":
      if (i > 0) {
        recursos.splice(i - 1, 0, recursos.splice(i, 1)[0]);
        actualizar();
      }
      break;
    case "bajar":
      if (i < recursos.length - 1) {
        recursos.splice(i + 1, 0, recursos.splice(i, 1)[0]);
        actualizar();
      }
      break;
    case "mover":
      abrirDlgMover(i);
      break;
    case "editar":
      abrirDlgRecurso(i);
      break;
    case "borrar":
      if (confirmar(`¿Quitar "${r.titulo}" de esta sesión?`)) {
        recordarParaDeshacer();
        recursos.splice(i, 1);
        actualizar();
        mostrarAviso(`Se quitó «${r.titulo}» de esta sesión.`, {
          etiqueta: "Deshacer",
          titulo: "Devolver el recurso a su lugar",
          accion: deshacer,
        });
      }
      break;
    default:
      break;
  }
}

function abrirTodo() {
  const web = (sesion()?.recursos || []).filter((r) => esWeb(r.url) && urlSegura(r.url));
  if (!web.length) {
    avisar("Esta sesión no tiene ligas web. Las rutas locales se abren desde el sistema de archivos.");
    return;
  }
  if (!confirmar(`Se abrirán ${web.length} pestañas. Si el navegador bloquea las ventanas emergentes, permítelas para esta página.`)) return;
  for (const r of web) window.open(r.url, "_blank", "noopener,noreferrer");
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
  $("#btn-editar-sesion").addEventListener("click", () => abrirDlgSesion(estado.sesionActiva));
  $("#btn-borrar-sesion").addEventListener("click", () => borrarSesion(estado.sesionActiva));
  $("#btn-duplicar-sesion").addEventListener("click", () => abrirDlgDuplicar(estado.sesionActiva));
  $("#btn-modo-clase").addEventListener("click", entrarModoClase);
  $("#btn-abrir-todo").addEventListener("click", abrirTodo);
  $("#btn-imprimir").addEventListener("click", () => window.print());

  suscribir(() => {
    const enSemestre = estado.vistaSemestre;
    $("#vista-sesion").hidden = enSemestre;
    $("#vista-semestre").hidden = !enSemestre;
    if (!enSemestre) pintarSesion();
  });
}
