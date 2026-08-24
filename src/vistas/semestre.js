/* Vista de semestre: todas las sesiones de la materia, de un vistazo. */

import { $, esc } from "../util/dom.js";
import { fechaLarga } from "../util/fechas.js";
import { indiceVigente } from "../datos/modelo.js";
import { estado, materia, irASesion, repintar, suscribir } from "../estado.js";

function pintarSemestre() {
  const m = materia();
  const sesiones = m?.sesiones || [];
  $("#meta-semestre").textContent = `${m?.nombre || ""}${m?.clave ? " · " + m.clave : ""}`;

  if (!sesiones.length) {
    $("#tabla-semestre").innerHTML = `<div class="vacio">Esta materia aún no tiene sesiones.</div>`;
    return;
  }

  const vigente = indiceVigente(m);
  const filas = sesiones
    .map((s, i) => {
      const num = String(s.num || i + 1).padStart(2, "0");
      const total = s.recursos.length;
      const revisados = s.recursos.filter((r) => r.estado === "listo" || r.estado === "usado").length;
      return `
      <tr data-activo="${i === estado.sesionActiva}">
        <td class="col-num">S${num}${i === vigente ? '<span class="vigente">vigente</span>' : ""}</td>
        <td class="col-fecha ${s.fecha ? "" : "sin-fecha"}">${esc(fechaLarga(s.fecha))}</td>
        <td>
          <button class="liga-sesion" data-ir="${i}" title="Abrir esta sesión">${esc(s.titulo)}</button>
          ${s.proposito ? `<span class="prop">${esc(s.proposito)}</span>` : ""}
        </td>
        <td class="col-conteo">${total} recurso${total === 1 ? "" : "s"}<br>${revisados} revisado${revisados === 1 ? "" : "s"}</td>
      </tr>`;
    })
    .join("");

  $("#tabla-semestre").innerHTML = `
    <table class="semestre">
      <thead>
        <tr><th scope="col">Sesión</th><th scope="col">Fecha</th><th scope="col">Título y propósito</th><th scope="col">Recursos</th></tr>
      </thead>
      <tbody>${filas}</tbody>
    </table>`;
}

export function montarVistaSemestre() {
  $("#tabla-semestre").addEventListener("click", (e) => {
    const ir = e.target.closest("[data-ir]");
    if (!ir) return;
    irASesion(Number(ir.dataset.ir));
    estado.vistaSemestre = false;
    repintar();
  });

  $("#btn-cerrar-semestre").addEventListener("click", () => {
    estado.vistaSemestre = false;
    repintar();
  });

  $("#btn-imprimir-semestre").addEventListener("click", () => window.print());

  suscribir(() => {
    if (estado.vistaSemestre) pintarSemestre();
  });
}
