/* Barra lateral: materias, enlaces del curso y sesiones. */

import { $, esc } from "../util/dom.js";
import { fechaCorta } from "../util/fechas.js";
import { urlSegura } from "../util/urls.js";
import { indiceVigente } from "../datos/modelo.js";
import { estado, materia, irAMateria, irASesion, repintar, suscribir } from "../estado.js";
import { abrirDlgMateria, abrirDlgSesion } from "./dialogos.js";
import { abrirRevision } from "./revision.js";

function pintarMaterias() {
  $("#lista-materias").innerHTML = estado.datos.materias
    .map(
      (m, i) => `
    <div class="fila materia" data-activo="${i === estado.materiaActiva}">
      <button class="principalbtn" data-ir="${i}" title="Abrir esta materia">${esc(m.nombre)}<small>${esc(m.clave || "")}</small></button>
      <button class="lapiz" data-editar="${i}" title="Editar nombre, periodo, carpeta y cuaderno de la materia" aria-label="Editar la materia ${esc(m.nombre)}">editar</button>
    </div>`
    )
    .join("");

  const m = materia();
  /* Una liga con un esquema que no se puede abrir se muestra como texto, nunca
     como enlace: un respaldo ajeno podría traer una liga preparada. */
  const enlace = (url, texto, sinLiga) => {
    if (!url) return `<span>${esc(sinLiga)}</span>`;
    if (!urlSegura(url)) return `<span>${esc(texto)}: la liga guardada no es válida</span>`;
    return `<a href="${esc(url)}" target="_blank" rel="noopener noreferrer">${esc(texto)}</a>`;
  };

  $("#enlaces-materia").innerHTML = m
    ? [
        enlace(m.carpeta, "Carpeta del curso en OneDrive", "Sin carpeta de OneDrive"),
        enlace(m.cuaderno, "Cuaderno del curso en OneNote", "Sin cuaderno de OneNote"),
      ].join("")
    : "";
}

function pintarSesiones() {
  const m = materia();
  const sesiones = m?.sesiones || [];
  const vigente = indiceVigente(m);
  const verTodas = estado.verTodasLasSesiones;

  $("#rotulo-sesiones").textContent = verTodas ? "Sesiones del curso" : "Sesión vigente";

  if (!sesiones.length) {
    $("#lista-sesiones").innerHTML = `<p class="sin-sesiones">Esta materia aún no tiene sesiones.</p>`;
    $("#btn-ver-todas").hidden = true;
    return;
  }

  const indices = verTodas ? sesiones.map((_, i) => i) : [estado.sesionActiva];
  $("#lista-sesiones").innerHTML = indices
    .map((i) => {
      const s = sesiones[i];
      const num = String(s.num || i + 1).padStart(2, "0");
      return `
    <div class="fila sesion" data-activo="${i === estado.sesionActiva}">
      <button class="principalbtn" data-ir="${i}" title="Abrir esta sesión">
        ${esc(s.titulo)}${i === vigente ? '<span class="vigente">vigente</span>' : ""}
        <small><span class="fecha-chip${s.fecha ? "" : " sin-fecha"}">S${num} · ${esc(fechaCorta(s.fecha))}</span></small>
      </button>
      <button class="lapiz" data-editar="${i}" title="Editar número, fecha, título y propósito de la sesión" aria-label="Editar la sesión ${esc(s.titulo)}">editar</button>
    </div>`;
    })
    .join("");

  $("#btn-ver-todas").hidden = sesiones.length <= 1;
  $("#btn-ver-todas").textContent = verTodas
    ? "Mostrar solo la sesión vigente"
    : `Ver las ${sesiones.length} sesiones del curso`;
}

export function montarLateral() {
  $("#lista-materias").addEventListener("click", (e) => {
    const editar = e.target.closest("[data-editar]");
    if (editar) {
      abrirDlgMateria(Number(editar.dataset.editar));
      return;
    }
    const ir = e.target.closest("[data-ir]");
    if (ir) {
      irAMateria(Number(ir.dataset.ir));
      estado.vistaSemestre = false;
      repintar();
    }
  });

  $("#lista-sesiones").addEventListener("click", (e) => {
    const editar = e.target.closest("[data-editar]");
    if (editar) {
      abrirDlgSesion(Number(editar.dataset.editar));
      return;
    }
    const ir = e.target.closest("[data-ir]");
    if (ir) {
      irASesion(Number(ir.dataset.ir));
      repintar();
    }
  });

  $("#btn-ver-todas").addEventListener("click", () => {
    estado.verTodasLasSesiones = !estado.verTodasLasSesiones;
    repintar();
  });

  $("#btn-materia-nueva").addEventListener("click", () => abrirDlgMateria(null));
  $("#btn-sesion-nueva").addEventListener("click", () => abrirDlgSesion(null));

  $("#btn-semestre").addEventListener("click", () => {
    estado.vistaSemestre = !estado.vistaSemestre;
    repintar();
  });

  $("#btn-revisar").addEventListener("click", abrirRevision);

  suscribir(() => {
    pintarMaterias();
    pintarSesiones();
    $("#btn-semestre").textContent = estado.vistaSemestre ? "Volver a la sesión" : "Vista de semestre";
  });
}
