/* Revisión de enlaces de la materia activa.

   Solo se revisa la forma de cada liga. No se hace fetch: la restricción de
   origen cruzado del navegador lo impide y devolvería errores donde no los hay.
   Que una liga esté bien formada no significa que el archivo exista ni que
   tengas permiso para abrirlo. */

import { $, esc } from "../util/dom.js";
import { fechaCorta } from "../util/fechas.js";
import { revisarUrl } from "../util/urls.js";
import { materia } from "../estado.js";

const GRUPOS = [
  { clase: "vacia", titulo: "Sin liga", leve: true },
  { clase: "local", titulo: "Rutas locales (file://)", leve: false },
  { clase: "malformada", titulo: "Ligas mal formadas", leve: false },
  { clase: "bloqueada", titulo: "Ligas que el panel no abre", leve: false },
  { clase: "app", titulo: "Ligas de programas de escritorio", leve: true },
];

function revisarMateria(m) {
  const hallazgos = [];

  const fijas = [
    ["Carpeta del curso", m.carpeta],
    ["Cuaderno del curso", m.cuaderno],
  ];
  for (const [nombre, url] of fijas) {
    if (!url) continue; // los enlaces del curso pueden quedar vacíos a propósito
    const r = revisarUrl(url);
    if (r.clase !== "ok") hallazgos.push({ ...r, donde: nombre, que: url });
  }

  m.sesiones.forEach((s, i) => {
    const num = String(s.num || i + 1).padStart(2, "0");
    s.recursos.forEach((recurso) => {
      const r = revisarUrl(recurso.url);
      if (r.clase === "ok") return;
      hallazgos.push({
        ...r,
        donde: `Sesión ${num} · ${fechaCorta(s.fecha)}`,
        que: recurso.titulo,
      });
    });
  });

  return hallazgos;
}

export function abrirRevision() {
  const m = materia();
  const caja = $("#rev-resultado");

  if (!m) {
    caja.innerHTML = `<div class="rev-bien">No hay ninguna materia seleccionada.</div>`;
    $("#dlg-revision").showModal();
    return;
  }

  const hallazgos = revisarMateria(m);
  const totalRecursos = m.sesiones.reduce((n, s) => n + s.recursos.length, 0);

  if (!hallazgos.length) {
    caja.innerHTML = `
      <p class="rev-resumen">${totalRecursos} recursos revisados en ${m.sesiones.length} sesiones.</p>
      <div class="rev-bien">Todas las ligas están bien formadas y apuntan a la web.</div>`;
    $("#dlg-revision").showModal();
    return;
  }

  const bloques = GRUPOS.map((grupo) => {
    const propios = hallazgos.filter((h) => h.clase === grupo.clase);
    if (!propios.length) return "";
    return `
      <div class="rev-grupo">
        <h4>${esc(grupo.titulo)} · ${propios.length}</h4>
        ${propios
          .map(
            (h) => `
          <div class="rev-item${grupo.leve ? " leve" : ""}">
            <span class="donde">${esc(h.donde)}</span>
            <strong>${esc(h.que)}</strong><br>${esc(h.mensaje)}
          </div>`
          )
          .join("")}
      </div>`;
  }).join("");

  caja.innerHTML = `
    <p class="rev-resumen">${totalRecursos} recursos revisados en ${m.sesiones.length} sesiones ·
      ${hallazgos.length} punto${hallazgos.length === 1 ? "" : "s"} de atención.</p>
    ${bloques}`;
  $("#dlg-revision").showModal();
}
