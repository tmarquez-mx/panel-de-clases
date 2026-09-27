/* Formularios: recurso, sesión, duplicar sesión y materia. */

import { $, $$, esc, confirmar, avisar } from "../util/dom.js";
import { fechaCorta, sumarDias } from "../util/fechas.js";
import { pegarEn } from "../util/portapapeles.js";
import { urlSegura } from "../util/urls.js";
import {
  copiaDeSesion, indiceVigente, insertarPorMomento, materiaNueva, minutosDe,
  ordenarRecursosPorMomento, ordenarSesiones, registrarTipo, tiposDisponibles,
} from "../datos/modelo.js";
import {
  estado, materia, sesion, actualizar, irAMateria, irASesion, repintar,
} from "../estado.js";
import { mostrarAviso } from "./aviso.js";
import { voz } from "../datos/vocabulario.js";
import { recordarParaDeshacer, deshacer } from "../historial.js";

/* Índices de lo que se está editando. null = se está creando algo nuevo. */
let recursoEnEdicion = null;
let recursoAMover = null;
let sesionEnEdicion = null;
let sesionADuplicar = null;
let materiaEnEdicion = null;

const numeroDe = (s, i) => String(s?.num || i + 1).padStart(2, "0");

/* ========================= Recurso ========================= */

function llenarTipos(tipoActual) {
  const lista = [...new Set([...tiposDisponibles(estado.datos), tipoActual].filter(Boolean))].sort(
    (a, b) => a.localeCompare(b, "es")
  );
  $("#f-tipo").innerHTML =
    lista.map((t) => `<option value="${esc(t)}">${esc(t)}</option>`).join("") +
    '<option value="__nuevo">Otro tipo…</option>';
  $("#f-tipo").value = tipoActual && lista.includes(tipoActual) ? tipoActual : "lectura";
  $("#f-tipo-nuevo").value = "";
  $("#f-tipo-nuevo").classList.add("oculto");
}

export function abrirDlgRecurso(indice, precarga = {}) {
  const s = sesion();
  if (!s) return;
  const r = indice === null ? precarga : s.recursos[indice];
  if (!r) return;
  recursoEnEdicion = indice;

  $("#rec-titulo-dlg").textContent = indice === null ? "Agregar recurso" : "Editar recurso";
  $("#rec-sub").textContent = `Sesión ${numeroDe(s, estado.sesionActiva)} · ${fechaCorta(s.fecha)}`;
  $("#f-titulo").value = r.titulo || "";
  llenarTipos(r.tipo || "lectura");
  $("#f-momento").value = r.momento || "";
  $("#f-url").value = r.url || "";
  $("#f-nota").value = r.nota || "";
  $("#hecho-crear").classList.remove("visible");
  $("#dlg-recurso").showModal();
  $("#f-titulo").focus();
}

function guardarRecurso() {
  const s = sesion();
  const titulo = $("#f-titulo").value.trim();
  if (!s || !titulo) return;

  const anterior = recursoEnEdicion === null ? null : s.recursos[recursoEnEdicion];
  let tipo = $("#f-tipo").value;
  if (tipo === "__nuevo") {
    tipo = registrarTipo(estado.datos, $("#f-tipo-nuevo").value) || anterior?.tipo || "lectura";
  }

  const recurso = {
    titulo,
    tipo,
    momento: $("#f-momento").value.trim(),
    url: $("#f-url").value.trim(),
    nota: $("#f-nota").value.trim(),
    estado: anterior?.estado || "pendiente",
  };

  if (recursoEnEdicion === null) s.recursos.push(recurso);
  else s.recursos[recursoEnEdicion] = recurso;

  /* El orden de la sesión se rehace solo cuando cambian los minutos: así el
     recurso cae en el lugar que le toca dentro de la clase. Si los minutos no
     cambiaron, se respeta el orden que hayas fijado con Subir y Bajar. */
  const cambiaronLosMinutos = anterior
    ? anterior.momento !== recurso.momento
    : minutosDe(recurso.momento) !== null;
  if (cambiaronLosMinutos) ordenarRecursosPorMomento(s);

  recursoEnEdicion = null;
  actualizar();
}

/* --- Crear un archivo que todavía no existe, sin salir del panel --- */
const CREAR = {
  word: { url: "https://word.new", nombre: "documento de Word" },
  ppt: { url: "https://ppt.new", nombre: "presentación de PowerPoint" },
  excel: { url: "https://xl.new", nombre: "hoja de cálculo de Excel" },
};

function crearArchivo(clave) {
  if (clave === "cuaderno") {
    const cuaderno = materia()?.cuaderno;
    if (!cuaderno) {
      avisar("Esta materia todavía no tiene cuaderno de OneNote. Agrégalo al editar la materia.");
      return;
    }
    // La liga puede venir de un respaldo ajeno: se valida el esquema antes de abrirla.
    if (!urlSegura(cuaderno)) {
      avisar("La liga del cuaderno de esta materia no es válida. Corrígela al editar la materia.");
      return;
    }
    window.open(cuaderno, "_blank", "noopener,noreferrer");
    $("#f-url").value = cuaderno;
    $("#hecho-crear").textContent =
      "Se abrió el cuaderno del curso y su liga ya quedó en el campo. Crea ahí la página de la sesión.";
    $("#hecho-crear").classList.add("visible");
    return;
  }

  const cfg = CREAR[clave];
  if (!cfg) return;
  window.open(cfg.url, "_blank", "noopener,noreferrer");
  $("#hecho-crear").textContent =
    `Se abrió un ${cfg.nombre} en blanco en otra pestaña. Ponle nombre, entra a Compartir, copia el vínculo y regresa aquí a presionar Pegar. Este formulario sigue abierto.`;
  $("#hecho-crear").classList.add("visible");
}

/* ========================= Mover a otra sesión ========================= */

export function abrirDlgMover(indice) {
  const m = materia();
  const s = sesion();
  const r = s?.recursos[indice];
  if (!m || !r) return;

  const otras = m.sesiones
    .map((x, i) => ({ x, i }))
    .filter(({ i }) => i !== estado.sesionActiva);

  if (!otras.length) {
    avisar("Esta materia solo tiene esta sesión. Crea otra sesión antes de mover el recurso.");
    return;
  }

  recursoAMover = indice;
  $("#mov-sub").textContent = `«${r.titulo}»${r.momento ? " · " + r.momento : " · sin minutos"}`;
  $("#mv-sesion").innerHTML = otras
    .map(({ x, i }) => `<option value="${i}">Sesión ${numeroDe(x, i)} · ${esc(fechaCorta(x.fecha))} · ${esc(x.titulo)}</option>`)
    .join("");
  $("#dlg-mover").showModal();
  $("#mv-sesion").focus();
}

function guardarMovimiento() {
  const m = materia();
  const origen = sesion();
  const r = origen?.recursos[recursoAMover];
  const iDestino = Number.parseInt($("#mv-sesion").value, 10);
  const destino = m?.sesiones[iDestino];
  if (!r || !destino || destino === origen) return;

  recordarParaDeshacer();
  origen.recursos.splice(recursoAMover, 1);
  insertarPorMomento(destino, r);
  recursoAMover = null;
  actualizar();

  mostrarAviso(`«${r.titulo}» se movió a la sesión ${numeroDe(destino, iDestino)} · ${fechaCorta(destino.fecha)}.`, {
    etiqueta: "Ir a esa sesión",
    titulo: "Abrir la sesión de destino",
    accion: () => {
      irASesion(iDestino); // ya sale de la vista de semestre
      repintar();
    },
  });
}

/* ========================= Sesión ========================= */

export function abrirDlgSesion(indice) {
  const m = materia();
  if (!m) return;
  const s = indice === null ? {} : m.sesiones[indice];
  if (!s) return;
  sesionEnEdicion = indice;

  $("#ses-titulo-dlg").textContent = indice === null ? "Agregar sesión" : "Editar sesión";
  $("#s-num").value = s.num || m.sesiones.length + 1;
  $("#s-fecha").value = s.fecha || "";
  $("#s-titulo").value = s.titulo || "";
  $("#s-proposito").value = s.proposito || "";
  $("#btn-borrar-sesion-dlg").hidden = indice === null;
  $("#dlg-sesion").showModal();
  $("#s-titulo").focus();
}

function guardarSesion() {
  const m = materia();
  const titulo = $("#s-titulo").value.trim();
  if (!m || !titulo) return;

  const numero = Number.parseInt($("#s-num").value, 10);
  const campos = {
    num: Number.isFinite(numero) && numero > 0 ? numero : m.sesiones.length + 1,
    fecha: $("#s-fecha").value,
    titulo,
    proposito: $("#s-proposito").value.trim(),
  };

  let referencia;
  if (sesionEnEdicion === null) {
    referencia = { ...campos, bitacora: "", recursos: [] };
    m.sesiones.push(referencia);
  } else {
    referencia = m.sesiones[sesionEnEdicion];
    Object.assign(referencia, campos);
  }

  ordenarSesiones(m);
  irASesion(m.sesiones.indexOf(referencia));
  sesionEnEdicion = null;
  actualizar();
}

export function borrarSesion(indice) {
  const m = materia();
  const s = m?.sesiones[indice];
  if (!s) return;
  const n = s.recursos.length;
  const cola = n ? ` y sus ${n} recurso${n === 1 ? "" : "s"}` : "";
  if (!confirmar(`¿Eliminar la sesión "${s.titulo}"${cola}?`)) return;
  recordarParaDeshacer();
  m.sesiones.splice(indice, 1);
  irASesion(indiceVigente(m));
  actualizar();
  mostrarAviso(`Se eliminó la sesión «${s.titulo}».`, {
    etiqueta: "Deshacer",
    titulo: "Devolver la sesión con todos sus recursos",
    accion: deshacer,
  });
}

/* ========================= Duplicar sesión ========================= */

export function abrirDlgDuplicar(indice) {
  const m = materia();
  const s = m?.sesiones[indice];
  if (!s) return;
  sesionADuplicar = indice;

  const mayor = m.sesiones.reduce((max, x) => Math.max(max, Number(x.num) || 0), 0);
  $("#dup-sub").textContent = `Copia de la sesión ${numeroDe(s, indice)} · ${s.titulo} · ${s.recursos.length} recursos`;
  $("#d-num").value = mayor + 1;
  $("#d-fecha").value = sumarDias(s.fecha, 7); // una semana después, lo más común
  $("#d-titulo").value = s.titulo;
  $("#dlg-duplicar").showModal();
  $("#d-titulo").focus();
}

function guardarDuplicado() {
  const m = materia();
  const original = m?.sesiones[sesionADuplicar];
  const titulo = $("#d-titulo").value.trim();
  if (!original || !titulo) return;

  const numero = Number.parseInt($("#d-num").value, 10);
  const copia = copiaDeSesion(original, {
    num: Number.isFinite(numero) && numero > 0 ? numero : m.sesiones.length + 1,
    fecha: $("#d-fecha").value,
    titulo,
  });

  m.sesiones.push(copia);
  ordenarSesiones(m);
  irASesion(m.sesiones.indexOf(copia));
  sesionADuplicar = null;
  actualizar();
}

/* ========================= Materia ========================= */

export function abrirDlgMateria(indice) {
  const m = indice === null ? {} : estado.datos.materias[indice];
  if (!m) return;
  materiaEnEdicion = indice;

  const clase = m.clase || "curso";
  $("#m-clase").value = clase;
  $("#mat-titulo-dlg").textContent =
    indice === null ? voz({ clase }).nueva : `Editar ${voz({ clase }).etiqueta.toLowerCase()}`;
  $("#m-nombre").value = m.nombre || "";
  $("#m-clave").value = m.clave || "";
  $("#m-carpeta").value = m.carpeta || "";
  $("#m-cuaderno").value = m.cuaderno || "";
  $("#btn-borrar-materia").hidden = indice === null || estado.datos.materias.length < 2;
  rotularDlgMateria();
  $("#dlg-materia").showModal();
  $("#m-nombre").focus();
}

/** Los rótulos del formulario siguen a lo que se eligió arriba. */
function rotularDlgMateria() {
  const v = voz({ clase: $("#m-clase").value });
  $("#lbl-m-nombre").textContent = v.campoNombre;
  $("#lbl-m-clave").textContent = v.campoClave;
  $("#m-clave").placeholder = v.ejemploClave;
  $("#mat-titulo-dlg").textContent =
    materiaEnEdicion === null ? v.nueva : `Editar ${v.etiqueta.toLowerCase()}`;
}

function guardarMateria() {
  const nombre = $("#m-nombre").value.trim();
  if (!nombre) return;

  const campos = {
    clase: $("#m-clase").value,
    nombre,
    clave: $("#m-clave").value.trim(),
    carpeta: $("#m-carpeta").value.trim(),
    cuaderno: $("#m-cuaderno").value.trim(),
  };

  if (materiaEnEdicion === null) {
    estado.datos.materias.push(materiaNueva(campos));
    irAMateria(estado.datos.materias.length - 1);
  } else {
    Object.assign(estado.datos.materias[materiaEnEdicion], campos);
  }

  materiaEnEdicion = null;
  actualizar();
}

function borrarMateria() {
  const indice = materiaEnEdicion;
  const m = estado.datos.materias[indice];
  $("#dlg-materia").close("cancelar");
  if (!m) return;

  const sesiones = m.sesiones.length;
  const recursos = m.sesiones.reduce((n, s) => n + s.recursos.length, 0);
  const cola = sesiones ? ` con sus ${sesiones} ${sesiones === 1 ? "sesión" : "sesiones"} y ${recursos} recurso${recursos === 1 ? "" : "s"}` : "";
  if (!confirmar(`¿Eliminar la materia "${m.nombre}"${cola}?`)) return;

  recordarParaDeshacer();
  estado.datos.materias.splice(indice, 1);
  irAMateria(indice < estado.materiaActiva ? estado.materiaActiva - 1 : estado.materiaActiva);
  actualizar();
  mostrarAviso(`Se eliminó la materia «${m.nombre}».`, {
    etiqueta: "Deshacer",
    titulo: "Devolver la materia con todas sus sesiones",
    accion: deshacer,
  });
}

/* ========================= Montaje ========================= */

/**
 * Conecta un formulario de diálogo.
 *
 * Se escucha "submit" y no "close": submit dice qué botón se presionó
 * (e.submitter) y es el evento que todos los navegadores con <dialog>
 * disparan de manera confiable. Con method="dialog" el propio navegador
 * cierra el formulario después, y valida antes los campos obligatorios.
 *
 * El evento "close" se usa solo para olvidar qué se estaba editando, tanto si
 * se guardó como si se canceló con Escape o con el botón Cancelar.
 */
function conectar(idDialogo, alGuardar, alCerrar = () => {}) {
  const dialogo = $(idDialogo);
  dialogo.querySelector("form").addEventListener("submit", (e) => {
    // "Guardar" es el único botón de envío del formulario: Cancelar es type="button".
    // Si el navegador no informa el submitter, el envío solo pudo venir de Guardar.
    if (!e.submitter || e.submitter.value === "guardar") alGuardar();
  });
  dialogo.addEventListener("close", alCerrar);
}

export function montarDialogos() {
  /* Cancelar cierra sin guardar. Es type="button" a propósito: si fuera un botón
     de envío, al presionar Enter dentro de un campo el navegador lo activaría a él
     por ser el primero del formulario, y se perdería lo escrito. */
  $$("[data-cerrar]").forEach((boton) =>
    boton.addEventListener("click", () => boton.closest("dialog").close("cancelar"))
  );

  /* --- Recurso --- */
  $("#f-tipo").addEventListener("change", (e) => {
    const nuevo = e.target.value === "__nuevo";
    $("#f-tipo-nuevo").classList.toggle("oculto", !nuevo);
    if (nuevo) $("#f-tipo-nuevo").focus();
  });
  $("#btn-pegar").addEventListener("click", () => pegarEn($("#f-url")));
  $$("[data-crear]").forEach((b) => b.addEventListener("click", () => crearArchivo(b.dataset.crear)));
  conectar("#dlg-recurso", guardarRecurso, () => { recursoEnEdicion = null; });

  /* Atajo: nota nueva de la sesión, ya prellenada. El formulario queda abierto. */
  $("#btn-nota").addEventListener("click", () => {
    const s = sesion();
    if (!s) return;
    abrirDlgRecurso(null, {
      titulo: `Notas · Sesión ${numeroDe(s, estado.sesionActiva)} · ${fechaCorta(s.fecha)}`,
      tipo: "apunte",
      momento: "referencia",
      nota: "Notas de la sesión.",
    });
    crearArchivo("word");
  });

  /* --- Sesión --- */
  $("#btn-borrar-sesion-dlg").addEventListener("click", () => {
    const indice = sesionEnEdicion;
    $("#dlg-sesion").close("cancelar");
    if (indice !== null) borrarSesion(indice);
  });
  conectar("#dlg-sesion", guardarSesion, () => { sesionEnEdicion = null; });

  /* --- Duplicar --- */
  conectar("#dlg-duplicar", guardarDuplicado, () => { sesionADuplicar = null; });

  /* --- Mover a otra sesión --- */
  conectar("#dlg-mover", guardarMovimiento, () => { recursoAMover = null; });

  /* --- Materia --- */
  $$("[data-pegar]").forEach((b) =>
    b.addEventListener("click", () => pegarEn($(`#${b.dataset.pegar}`)))
  );
  $("#btn-borrar-materia").addEventListener("click", borrarMateria);
  $("#m-clase").addEventListener("change", rotularDlgMateria);
  conectar("#dlg-materia", guardarMateria, () => { materiaEnEdicion = null; });
}
