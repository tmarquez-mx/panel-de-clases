/* =========================================================
   Artefacto epistémico: panel de clases.
   Arranque: carga los datos, monta las vistas y conecta el guardado.
   ========================================================= */

import "./estilos/base.css";
import "./estilos/componentes.css";
import "./estilos/impresion.css";

import { $, esc, avisar, confirmar } from "./util/dom.js";
import { fechaHoraCorta, horaCorta } from "./util/fechas.js";
import { migrar, ErrorDeDatos } from "./datos/modelo.js";
import { DATOS_DE_EJEMPLO } from "./datos/ejemplo.js";
import { crearGestor } from "./almacenamiento/gestor.js";
import { archivarCopia, leerCopias } from "./almacenamiento/local.js";
import { estado, materia, irAMateria, registrarPersistencia, repintar, actualizar } from "./estado.js";
import { montarLateral } from "./vistas/lateral.js";
import { montarVistaSesion } from "./vistas/sesion.js";
import { montarVistaSemestre } from "./vistas/semestre.js";
import { montarModoClase } from "./vistas/modoClase.js";
import { montarDialogos } from "./vistas/dialogos.js";
import { montarAviso, mostrarAviso } from "./vistas/aviso.js";
import { abrirMenu } from "./vistas/menu.js";
import { montarEscalaDeTexto, montarLectura } from "./vistas/lectura.js";
import { montarMudanza } from "./vistas/mudanza.js";
import { exportarMarkdown } from "./exportacion/markdown.js";
import { exportarPlantilla, exportarRespaldo } from "./exportacion/respaldo.js";

/* Un respaldo del panel pesa unos pocos cientos de KB. Más que esto no es un
   respaldo: se rechaza antes de intentar leerlo, para no colgar el navegador. */
const LIMITE_DE_ARCHIVO = 10 * 1024 * 1024;

const gestor = crearGestor({ alCambiarEstado: pintarIndicador });

/* ========================= Indicador de guardado ========================= */

const TEXTO_DE_MODO = {
  archivo: "en el archivo vinculado",
  navegador: "en este navegador",
  memoria: "sin guardado automático",
};

let pieVigente = "";

function pintarIndicador({ modo, situacion, hora, detalle, necesitaReconectar, nombreArchivo }) {
  const caja = $("#estado-guardado");
  caja.dataset.modo = modo;

  /* Dos textos distintos. En la cabecera va el breve, que cabe siempre y no
     se mueve con cada tecla; la hora y el porqué esperan a que se pulse.
     El estado nunca se comunica solo por color: cambia la palabra y cambia
     el signo del indicador, para quien no distingue los matices de rojo. */
  let breve;
  let signo = "guardado";
  if (situacion === "guardando") { breve = "Guardando…"; signo = "trabajando"; }
  else if (situacion === "pendiente") { breve = "Cambios sin guardar"; signo = "pendiente"; }
  else if (situacion === "error") { breve = "No se pudo guardar"; signo = "error"; }
  else if (situacion === "sin-guardar" || modo === "memoria") { breve = "Sin guardado automático"; signo = "error"; }
  else if (modo === "archivo") breve = `Guardado en ${nombreArchivo || "tu archivo"}`;
  else breve = "Guardado en este navegador";

  if (necesitaReconectar) { breve = "Falta permiso del archivo"; signo = "pendiente"; }

  let largo;
  if (situacion === "error") largo = detalle || "No se pudo guardar.";
  else if (hora) largo = `Guardado a las ${horaCorta(hora)} ${modo === "archivo" ? `en ${nombreArchivo}` : TEXTO_DE_MODO[modo]}.`;
  else largo = `Se guardará ${TEXTO_DE_MODO[modo]}.`;

  const pendientes = [];
  if (necesitaReconectar) pendientes.push("el archivo vinculado necesita permiso");
  if (detalle && situacion !== "error") pendientes.push(detalle);
  if (pendientes.length) largo += ` Pendiente: ${pendientes.join(" · ")}.`;

  caja.dataset.situacion = signo;
  caja.innerHTML = `<span class="punto"></span><span class="rot">${esc(breve)}</span>`;
  caja.title = `${largo} Pulsa para ver dónde se guarda y las copias de seguridad.`;
  caja.setAttribute("aria-label", `${breve}. ${largo} Pulsa para ver dónde se guarda.`);

  // El pie solo se rehace cuando cambia el modo: si no, cada tecla de la bitácora
  // reescribiría ese bloque y rompería cualquier selección de texto.
  const firma = `${modo}|${nombreArchivo}`;
  if (firma !== pieVigente) {
    pieVigente = firma;
    pintarPie(modo, nombreArchivo);
  }
}

function pintarPie(modo, nombreArchivo) {
  const donde = {
    archivo: `<p><strong>Cómo guarda tu trabajo.</strong> Cada cambio se escribe solo en el archivo
      <em>${esc(nombreArchivo)}</em> y, además, queda una copia en este navegador. Si el archivo está en una
      carpeta de OneDrive sincronizada, el respaldo viaja solo a tus otras computadoras.</p>`,
    navegador: `<p><strong>Cómo guarda tu trabajo.</strong> Cada cambio se guarda solo en este navegador y en
      esta computadora. No viaja a ningún servidor. Para pasar tus datos a la computadora del salón usa
      <em>Guardar respaldo</em> aquí e <em>Importar respaldo</em> allá; en Chrome o Edge también puedes usar
      <em>Vincular archivo</em> y dejar el respaldo en OneDrive.</p>`,
    memoria: `<p><strong>Atención: aquí no se guarda nada.</strong> Este navegador no permite almacenamiento
      local, así que todo lo que escribas se pierde al cerrar la pestaña. Usa <em>Guardar respaldo</em> antes de
      salir e <em>Importar respaldo</em> al volver.</p>`,
  };

  /* Estas explicaciones vivían repetidas al pie de cada sesión, donde se
     leían una vez y después solo ocupaban sitio. Ahora están en «Guardado y
     respaldos», dentro del diálogo que abre el indicador de guardado, y en
     la guía. Al pie solo se queda lo que es un problema concreto y ahora. */
  $("#alm-ayuda-cuerpo").innerHTML = `
    ${donde[modo] || donde.navegador}
    <p><strong>Para que funcione en cualquier computadora,</strong> usa ligas de OneDrive en lugar de rutas del
    disco. Las rutas locales (<span class="ruta" style="display:inline">file://</span>) no abren con un clic desde
    el navegador. El botón <em>Revisar enlaces</em> las encuentra todas antes de la clase.</p>
    <p><strong>Tus ligas son privadas.</strong> Los respaldos incluyen las ligas de OneDrive, que llevan claves de
    uso compartido. No los subas a un repositorio abierto.</p>`;

  // El aviso al pie solo aparece cuando hay algo que resolver.
  $("#pie-pagina").innerHTML = modo === "memoria" ? donde.memoria : "";
  $("#pie-pagina").hidden = modo !== "memoria";
}

/* ========================= Carga de datos ========================= */

function cargarEnElPanel(datosCrudos, { guardar = false } = {}) {
  estado.datos = migrar(datosCrudos);
  irAMateria(0);
  if (guardar) actualizar();
  else repintar();
}

/* ========================= Importar respaldo ========================= */

function montarImportacion() {
  $("#btn-importar").addEventListener("click", () => $("#archivo-json").click());

  $("#archivo-json").addEventListener("change", (e) => {
    const archivo = e.target.files?.[0];
    e.target.value = ""; // permite volver a elegir el mismo archivo
    if (!archivo) return;

    if (archivo.size > LIMITE_DE_ARCHIVO) {
      avisar("Ese archivo es demasiado grande para ser un respaldo del panel.");
      return;
    }

    const lector = new FileReader();
    lector.onerror = () => avisar("No se pudo leer el archivo.");
    lector.onload = () => {
      let crudos;
      try {
        crudos = JSON.parse(String(lector.result));
      } catch {
        avisar("El archivo no es JSON válido. Debe ser un respaldo generado por «Guardar respaldo».");
        return;
      }
      try {
        const previo = migrar(crudos); // valida antes de tocar nada de lo que ya hay
        const materias = previo.materias.length;
        const sesiones = previo.materias.reduce((n, m) => n + m.sesiones.length, 0);
        if (!confirmar(`El respaldo trae ${materias} materia${materias === 1 ? "" : "s"} y ${sesiones} ${sesiones === 1 ? "sesión" : "sesiones"}. Sustituirá todo lo que hay ahora en el panel. ¿Continuar?`)) return;
        archivarCopia(estado.datos, "antes de importar un respaldo");
        cargarEnElPanel(crudos, { guardar: true });
        mostrarAviso("Se cargó el respaldo. Lo que había antes quedó guardado como copia, en «Vincular archivo».");
      } catch (error) {
        avisar(
          error instanceof ErrorDeDatos
            ? error.message
            : "El archivo no tiene la estructura del panel. Debe ser un respaldo generado por «Guardar respaldo»."
        );
      }
    };
    lector.readAsText(archivo);
  });
}

/* ========================= Exportaciones ========================= */

function montarExportaciones() {
  $("#btn-json").addEventListener("click", () => exportarRespaldo(estado.datos));

  $("#btn-md").addEventListener("click", () => {
    const m = materia();
    if (m) exportarMarkdown(m);
  });

  $("#btn-plantilla").addEventListener("click", () => {
    const m = materia();
    if (!m) return;
    if (!confirmar(`Se exportará "${m.nombre}" sin ligas y sin bitácoras, para compartirla. ¿Continuar?`)) return;
    exportarPlantilla(m);
  });
}

/* ========================= Diálogo de almacenamiento ========================= */

function pintarDialogoAlmacen() {
  const { modo, soportaArchivo, nombreArchivo, necesitaReconectar } = gestor.estado();

  const explicacion = {
    archivo: `Ahora mismo el panel escribe en <strong>${esc(nombreArchivo)}</strong>, y deja además una copia en este navegador.`,
    navegador: "Ahora mismo el panel guarda en <strong>este navegador</strong>: los datos sobreviven a cerrar la ventana, pero viven solo en esta computadora.",
    memoria: "Ahora mismo el panel <strong>no puede guardar nada</strong>. Exporta un respaldo antes de cerrar la pestaña.",
  };

  const disponible = soportaArchivo
    ? `<ul class="alm-lista">
         <li>Vincular un archivo <code>.json</code> deja tus datos en un archivo que tú controlas.</li>
         <li>Si lo pones en tu carpeta de OneDrive sincronizada, el mismo respaldo llega a tus otras computadoras.</li>
         <li>El navegador te pedirá permiso otra vez cada cierto tiempo. Es normal: se reconecta desde aquí.</li>
       </ul>`
    : `<ul class="alm-lista">
         <li>Este navegador no tiene la API de acceso a archivos: hoy solo está en Chrome y en Edge, y no funciona
             al abrir el panel con doble clic desde el disco.</li>
         <li>Aquí el guardado automático usa el almacenamiento del navegador. Para mover los datos, usa
             <em>Guardar respaldo</em> e <em>Importar respaldo</em>.</li>
       </ul>`;

  $("#alm-cuerpo").innerHTML = `
    <div class="alm-modo">${explicacion[modo] || explicacion.navegador}</div>
    ${necesitaReconectar ? `<div class="alm-modo">El archivo vinculado necesita tu permiso otra vez. Presiona <strong>Reconectar</strong>; si el archivo cambió de lugar, usa «Abrir archivo existente».</div>` : ""}
    ${disponible}
    ${pintarCopias()}`;

  $("#btn-alm-reconectar").hidden = !necesitaReconectar;
  $("#btn-alm-nuevo").disabled = !soportaArchivo;
  $("#btn-alm-existente").disabled = !soportaArchivo;
  $("#btn-alm-desvincular").hidden = modo !== "archivo" && !necesitaReconectar;
}

/** Las tres últimas versiones archivadas, con su botón para restaurar. */
function pintarCopias() {
  const copias = leerCopias();
  if (!copias.length) {
    return `<h4 class="alm-titulo">Copias de seguridad</h4>
      <p class="pista">Todavía no hay ninguna. El panel archiva por su cuenta las últimas tres versiones:
      una al abrir y una antes de cada operación que sustituye todo.</p>`;
  }

  return `<h4 class="alm-titulo">Copias de seguridad</h4>
    <p class="pista">Las últimas ${copias.length === 1 ? "versión archivada" : `${copias.length} versiones archivadas`}
    por el panel. Restaurar sustituye lo que hay ahora, y antes archiva el estado actual.</p>
    <ul class="alm-copias">
      ${copias
        .map((copia, i) => {
          const materias = copia.datos?.materias?.length || 0;
          const sesiones = (copia.datos?.materias || []).reduce((n, m) => n + (m.sesiones?.length || 0), 0);
          return `<li>
            <span class="cuando">${esc(fechaHoraCorta(copia.fecha))}</span>
            <span class="que">${esc(copia.motivo || "copia")} · ${materias} materia${materias === 1 ? "" : "s"}, ${sesiones} ${sesiones === 1 ? "sesión" : "sesiones"}</span>
            <button type="button" class="mini" data-restaurar="${i}" title="Volver a esta versión del panel">Restaurar</button>
          </li>`;
        })
        .join("")}
    </ul>`;
}

function restaurarCopia(indice) {
  const copia = leerCopias()[indice];
  if (!copia) return;
  if (!confirmar(`Se volverá a la versión del ${fechaHoraCorta(copia.fecha)} (${copia.motivo}). Lo que hay ahora se archiva como copia antes de sustituirlo. ¿Continuar?`)) return;

  try {
    archivarCopia(estado.datos, "antes de restaurar una copia");
    cargarEnElPanel(copia.datos, { guardar: true });
    $("#dlg-almacen").close("cerrar");
    mostrarAviso(`Se restauró la versión guardada el ${fechaHoraCorta(copia.fecha)}`);
  } catch (error) {
    avisar(
      error instanceof ErrorDeDatos
        ? `Esa copia está dañada y no se pudo restaurar: ${error.message}`
        : "Esa copia está dañada y no se pudo restaurar."
    );
  }
}

function montarDialogoAlmacen() {
  $("#alm-cuerpo").addEventListener("click", (e) => {
    const boton = e.target.closest("[data-restaurar]");
    if (boton) restaurarCopia(Number(boton.dataset.restaurar));
  });

  const abrirAlmacen = () => {
    pintarDialogoAlmacen();
    $("#dlg-almacen").showModal();
  };
  $("#btn-vincular").addEventListener("click", abrirAlmacen);
  // El indicador de guardado es la puerta al detalle: dónde se guarda,
  // a qué hora y qué copias de seguridad hay.
  $("#estado-guardado").addEventListener("click", abrirAlmacen);

  /* Menú «Archivo». Los botones siguen en el documento, ocultos: el menú
     los acciona, así que conservan nombre, título y confirmaciones. */
  const opcionDe = (selector, etiqueta) => {
    const boton = $(selector);
    return {
      etiqueta,
      titulo: boton?.title || "",
      desactivado: !boton || boton.disabled,
      accion: () => boton?.click(),
    };
  };
  $("#btn-archivo").addEventListener("click", (e) =>
    abrirMenu(e.currentTarget, [
      opcionDe("#btn-vincular", "Vincular archivo…"),
      "---",
      opcionDe("#btn-importar", "Importar respaldo…"),
      opcionDe("#btn-json", "Guardar respaldo"),
      "---",
      opcionDe("#btn-md", "Exportar a Markdown"),
      opcionDe("#btn-plantilla", "Plantilla del curso"),
    ])
  );

  $("#btn-alm-nuevo").addEventListener("click", async () => {
    try {
      const listo = await gestor.vincularNuevo(estado.datos, "panel-de-clases.json");
      if (listo) $("#dlg-almacen").close("cerrar");
    } catch {
      avisar("No se pudo vincular el archivo.");
    }
  });

  $("#btn-alm-existente").addEventListener("click", async () => {
    try {
      const contenido = await gestor.abrirExistente((crudo) => migrar(crudo));
      if (contenido === null) return; // canceló
      if (contenido) {
        archivarCopia(estado.datos, "antes de abrir otro archivo");
        cargarEnElPanel(contenido, { guardar: true });
      } else {
        // Archivo vacío: se vincula y se escribe en él lo que ya hay en el panel.
        await gestor.guardarAhora(estado.datos);
      }
      $("#dlg-almacen").close("cerrar");
    } catch (error) {
      avisar(
        error instanceof ErrorDeDatos
          ? error.message
          : "No se pudo abrir ese archivo. Debe ser un respaldo del panel en formato JSON."
      );
    }
  });

  $("#btn-alm-reconectar").addEventListener("click", async () => {
    try {
      const contenido = await gestor.reconectar((crudo) => migrar(crudo));
      if (contenido) cargarEnElPanel(contenido);
      $("#dlg-almacen").close("cerrar");
    } catch (error) {
      avisar(
        error instanceof ErrorDeDatos
          ? `El archivo vinculado ya no es un respaldo válido: ${error.message}`
          : "No se pudo reconectar el archivo. Elígelo otra vez con «Abrir archivo existente»."
      );
    }
  });

  $("#btn-alm-desvincular").addEventListener("click", async () => {
    if (!confirmar("El panel dejará de escribir en el archivo y seguirá guardando solo en este navegador. ¿Continuar?")) return;
    await gestor.desvincular();
    $("#dlg-almacen").close("cerrar");
  });
}

/* ========================= Arranque ========================= */

async function arrancar() {
  montarLateral();
  montarVistaSesion();
  montarEscalaDeTexto();
  montarLectura();
  montarMudanza();
  montarVistaSemestre();
  montarModoClase();
  montarDialogos();
  montarAviso();
  montarImportacion();
  montarExportaciones();
  montarDialogoAlmacen();

  registrarPersistencia((datos) => gestor.programar(datos));

  // Última oportunidad de guardar si la pestaña se cierra con cambios recientes.
  window.addEventListener("pagehide", () => gestor.guardarAlSalir());
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") gestor.guardarAlSalir();
  });

  let aviso = "";
  try {
    const inicio = await gestor.iniciar();
    aviso = inicio.aviso;
    cargarEnElPanel(inicio.datos || DATOS_DE_EJEMPLO);
    // Copia de seguridad del estado con el que se abrió, si había algo guardado.
    if (inicio.datos) archivarCopia(estado.datos, "al abrir el panel");
  } catch (error) {
    cargarEnElPanel(DATOS_DE_EJEMPLO);
    avisar(
      `Lo guardado no se pudo leer, así que se abrieron los datos de ejemplo. Nada se ha sobrescrito todavía: importa tu último respaldo antes de hacer cambios.\n\n${
        error instanceof ErrorDeDatos ? error.message : "El archivo guardado está dañado."
      }`
    );
  }

  if (aviso) avisar(aviso);
}

/* En desarrollo el script es un módulo y se ejecuta con el documento ya
   armado. En la versión construida es un script normal dentro de <head>, así
   que hay que esperar a que exista el cuerpo de la página. */
/** Última red: si el arranque falla del todo, al menos se dice en voz alta. */
function arrancarConRed() {
  arrancar().catch(() => {
    avisar("El panel no pudo arrancar. Vuelve a cargar la página; si sigue igual, abre un respaldo con «Importar respaldo».");
  });
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", arrancarConRed, { once: true });
} else {
  arrancarConRed();
}
