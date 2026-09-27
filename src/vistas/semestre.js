/* Vista de semestre: todas las sesiones de la materia, de un vistazo. */

import { $, esc } from "../util/dom.js";
import { fechaCorta } from "../util/fechas.js";
import { indiceVigente } from "../datos/modelo.js";
import { estado, materia, irASesion, repintar, suscribir } from "../estado.js";
import { voz } from "../datos/vocabulario.js";

function pintarSemestre() {
  const m = materia();
  const sesiones = m?.sesiones || [];
  const v = voz(m);
  $("#meta-semestre").textContent = `${m?.nombre || ""}${m?.clave ? " · " + m.clave : ""}`;
  $("#titulo-semestre").textContent = v.tituloVistaGeneral;
  $("#resumen-semestre").textContent = v.resumenVistaGeneral;

  if (!sesiones.length) {
    $("#tabla-semestre").innerHTML = `<div class="vacio">${v.sinEncuentros}.</div>`;
    return;
  }

  const vigente = indiceVigente(m);
  const filas = sesiones
    .map((s, i) => {
      const num = String(s.num || i + 1).padStart(2, "0");
      const total = s.recursos.length;
      const revisados = s.recursos.filter((r) => r.estado === "listo" || r.estado === "usado").length;
      /* El título manda; número, fecha y conteo quedan como apoyo. Los
         propósitos largos se recortan para poder recorrer el temario, con
         un desplegable por fila. */
      const largo = (s.proposito || "").length > 150;
      return `
      <tr data-activo="${i === estado.sesionActiva}">
        <td class="col-titulo">
          <span class="ses-num">${esc(v.encuentro.slice(0, 1).toUpperCase())}${num}</span>${i === vigente ? '<span class="vigente">vigente</span>' : ""}
          <button class="liga-sesion" data-ir="${i}" title="Abrir ${esc(v.encuentro.toLowerCase())}: ${esc(s.titulo)}">${esc(s.titulo)}</button>
          ${s.proposito ? `<span class="prop${largo ? " recortado" : ""}">${esc(s.proposito)}</span>` : ""}
          ${largo ? `<button class="mas-texto" data-abrir-prop aria-expanded="false">Leer más</button>` : ""}
        </td>
        <td class="col-fecha ${s.fecha ? "" : "sin-fecha"}">${esc(fechaCorta(s.fecha))}</td>
        <td class="col-conteo">${total} recurso${total === 1 ? "" : "s"}<br>${revisados} revisado${revisados === 1 ? "" : "s"}</td>
      </tr>`;
    })
    .join("");

  $("#tabla-semestre").innerHTML = `
    <table class="semestre">
      <thead>
        <tr><th scope="col">${v.encuentro} y propósito</th><th scope="col">Fecha</th><th scope="col">Recursos</th></tr>
      </thead>
      <tbody>${filas}</tbody>
    </table>`;
}

export function montarVistaSemestre() {
  $("#tabla-semestre").addEventListener("click", (e) => {
    const abrirProp = e.target.closest("[data-abrir-prop]");
    if (abrirProp) {
      const prop = abrirProp.parentElement.querySelector(".prop");
      const abierto = prop.classList.toggle("abierto");
      abrirProp.textContent = abierto ? "Mostrar menos" : "Leer más";
      abrirProp.setAttribute("aria-expanded", String(abierto));
      return;
    }
    const ir = e.target.closest("[data-ir]");
    if (!ir) return;
    irASesion(Number(ir.dataset.ir)); // ya sale de la vista de semestre
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
