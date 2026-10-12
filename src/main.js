/* =========================================================
   Artefacto epistémico: panel de clases.
   Arranque: carga los datos, monta las vistas y conecta el guardado.
   ========================================================= */

import "./estilos/base.css";
import "./estilos/componentes.css";
import "./estilos/impresion.css";

import { $, esc, avisar, confirmar } from "./util/dom.js";
import { fechaHoraCorta, horaCorta } from "./util/fechas.js";
import { migrar, ErrorDeDatos, copiaDeMateria, ordenarSesiones, identificador } from "./datos/modelo.js";
import { voz } from "./datos/vocabulario.js";
import { DATOS_DE_EJEMPLO } from "./datos/ejemplo.js";
import { crearGestor } from "./almacenamiento/gestor.js";
import { archivarCopia, leerCopias, leerDanado, borrarDanado } from "./almacenamiento/local.js";
import { estado, materia, irAMateria, registrarPersistencia, repintar, actualizar } from "./estado.js";
import { montarLateral } from "./vistas/lateral.js";
import { montarVistaSesion } from "./vistas/sesion.js";
import { montarVistaSemestre } from "./vistas/semestre.js";
import { montarModoClase, retomarClaseTrasRecarga } from "./vistas/modoClase.js";
import { montarDialogos } from "./vistas/dialogos.js";
import { montarAviso, mostrarAviso } from "./vistas/aviso.js";
import { montarEscalaDeTexto, montarLectura } from "./vistas/lectura.js";
import { montarMudanza } from "./vistas/mudanza.js";
import { exportarMarkdown } from "./exportacion/markdown.js";
import { exportarPlantilla, exportarRespaldo } from "./exportacion/respaldo.js";
import { descargar } from "./exportacion/descargar.js";

/* Un respaldo del panel pesa unos pocos cientos de KB. Más que esto no es un
   respaldo: se rechaza antes de intentar leerlo, para no colgar el navegador. */
const LIMITE_DE_ARCHIVO = 10 * 1024 * 1024;

const gestor = crearGestor({
  alCambiarEstado: (e) => {
    pintarIndicador(e);
    // Un conflicto se abre solo la primera vez que se detecta; después queda
    // el indicador, para no interrumpir cada vez que se guarda.
    if (e.abrirDialogo) abrirConflicto();
  },
});

/* ========================= Indicador de guardado ========================= */

const TEXTO_DE_MODO = {
  archivo: "en tu archivo",
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
  if (situacion === "abriendo") { breve = "Abriendo tu archivo…"; signo = "trabajando"; }
  else if (situacion === "conflicto") { breve = "Otra computadora cambió el archivo"; signo = "error"; }
  else if (situacion === "guardando") { breve = "Guardando…"; signo = "trabajando"; }
  else if (situacion === "pendiente") { breve = "Cambios sin guardar"; signo = "pendiente"; }
  else if (situacion === "error") { breve = "No se pudo guardar"; signo = "error"; }
  else if (situacion === "sin-guardar" || modo === "memoria") { breve = "Sin guardado automático"; signo = "error"; }
  else if (modo === "archivo") breve = `Guardado en ${nombreArchivo || "tu archivo"}`;
  else breve = "Guardado en este navegador";

  if (necesitaReconectar) { breve = "Falta permiso del archivo"; signo = "pendiente"; }

  let largo;
  if (situacion === "abriendo") largo = "Leyendo tu archivo. Si tarda, quizá la nube lo está descargando.";
  else if (situacion === "conflicto") largo = detalle;
  else if (situacion === "error") largo = detalle || "No se pudo guardar.";
  else if (hora) largo = `Guardado a las ${horaCorta(hora)} ${modo === "archivo" ? `en ${nombreArchivo}` : TEXTO_DE_MODO[modo]}.`;
  else largo = `Se guardará ${TEXTO_DE_MODO[modo]}.`;

  const pendientes = [];
  if (necesitaReconectar) pendientes.push("tu archivo necesita permiso");
  if (detalle && situacion !== "error") pendientes.push(detalle);
  if (pendientes.length) largo += ` Pendiente: ${pendientes.join(" · ")}.`;

  caja.dataset.situacion = signo;
  caja.innerHTML = `<span class="punto"></span><span class="rot"><strong>Mis datos</strong> · ${esc(breve)}</span>`;
  caja.title = `${largo} Pulsa para ver dónde se guardan, descargarlos, cargarlos o volver a una versión anterior.`;
  caja.setAttribute("aria-label", `Mis datos. ${breve}. ${largo}`);

  // El pie solo se rehace cuando cambia el modo: si no, cada tecla de la bitácora
  // reescribiría ese bloque y rompería cualquier selección de texto.
  const firma = `${modo}|${nombreArchivo}`;
  if (firma !== pieVigente) {
    pieVigente = firma;
    pintarPie(modo);
  }
}

function pintarPie(modo) {
  /* Las explicaciones de cómo se guarda viven en la guía, enlazada desde
     «Mis datos». Al pie solo se queda lo que es un problema concreto y ahora. */
  $("#pie-pagina").innerHTML =
    modo === "memoria"
      ? `<p><strong>Atención: aquí no se guarda nada.</strong> Este navegador no permite almacenamiento
          local, así que todo lo que escribas se pierde al cerrar la pestaña. Antes de salir, abre
          <em>Mis datos</em> y usa <em>Descargar mis datos</em>; al volver, <em>Cargar datos de un archivo</em>.</p>`
      : "";
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

/* Un archivo con una sola materia casi nunca es un respaldo de todo el panel:
   es una «Copia para otro semestre», una «Estructura» o la materia que pasó
   una colega. Sustituirlo todo con ella dejaba a la usuaria solo con esa
   materia, así que en ese caso se pregunta. Con dos o más materias el archivo
   es un respaldo completo y se sigue confirmando como antes. */

let importacionPendiente = null; // { crudos, previo } hasta que se elige en el diálogo

const cuentaDeSesiones = (n) => `${n} ${n === 1 ? "sesión" : "sesiones"}`;

/** «2 sesiones», «2 bloques» o «2 presentaciones», según lo que sea la materia. */
function cuentaDeEncuentros(m) {
  const v = voz(m);
  const n = m.sesiones.length;
  return `${n} ${(n === 1 ? v.encuentro : v.encuentros).toLowerCase()}`;
}

function sustituirTodoCon(crudos) {
  archivarCopia(estado.datos, "antes de cargar datos de un archivo");
  cargarEnElPanel(crudos, { guardar: true });
  mostrarAviso("Se cargaron los datos del archivo. Lo que había antes quedó en «Mis datos», entre las versiones anteriores.");
}

function agregarMateriaImportada(previo) {
  const nueva = previo.materias[0];
  // Si el archivo salió de este mismo panel, su id ya existe: se le da uno propio.
  if (estado.datos.materias.some((m) => m.id === nueva.id)) nueva.id = identificador();
  // Sus tipos propios se suman a los del panel, para que no se pierdan al editar.
  estado.datos.tipos = [...new Set([...(estado.datos.tipos || []), ...previo.tipos])].sort();
  estado.datos.materias.push(nueva);
  irAMateria(estado.datos.materias.length - 1);
  actualizar();
  mostrarAviso(
    `Se agregó «${nueva.nombre}» a tu panel, con ${cuentaDeEncuentros(nueva)}. ` +
      "Tus otras materias siguen igual. Si no la querías, elimínala desde su menú ⋯ → Editar."
  );
}

function abrirDlgImportar(crudos, previo) {
  const m = previo.materias[0];
  const recursos = m.sesiones.reduce((n, s) => n + s.recursos.length, 0);
  const tuyas = estado.datos?.materias?.length || 0;
  importacionPendiente = { crudos, previo };
  $("#imp-cuerpo").innerHTML = `
    <p class="sub">${esc(voz(m).etiqueta)} «${esc(m.nombre)}»${m.clave ? ` · ${esc(m.clave)}` : ""} · ${esc(cuentaDeEncuentros(m))} y ${recursos} recurso${recursos === 1 ? "" : "s"}</p>
    <p>Tu panel tiene ahora ${tuyas} materia${tuyas === 1 ? "" : "s"}. Elige qué hacer con la del archivo:</p>
    <ul class="alm-lista">
      <li><strong>Agregar como materia nueva</strong>: queda junto a tus otras materias. No se toca nada de lo que ya tienes.</li>
      <li><strong>Sustituir todo</strong>: el panel queda solo con esta materia. Lo que hay ahora se guarda antes entre las versiones anteriores, en «Mis datos».</li>
    </ul>`;
  $("#dlg-importar").showModal();
}

/** Lo que espera respuesta, una sola vez: un doble clic no agrega dos copias. */
function tomarImportacion() {
  const pendiente = importacionPendiente;
  importacionPendiente = null;
  $("#dlg-importar").close("cerrar");
  return pendiente;
}

function montarDlgImportar() {
  $("#btn-imp-agregar").addEventListener("click", () => {
    const pendiente = tomarImportacion();
    if (pendiente) agregarMateriaImportada(pendiente.previo);
  });

  $("#btn-imp-sustituir").addEventListener("click", () => {
    const pendiente = tomarImportacion();
    if (pendiente) sustituirTodoCon(pendiente.crudos);
  });
}

function montarImportacion() {
  montarDlgImportar();

  $("#archivo-json").addEventListener("change", (e) => {
    const archivo = e.target.files?.[0];
    e.target.value = ""; // permite volver a elegir el mismo archivo
    if (!archivo) return;

    if (archivo.size > LIMITE_DE_ARCHIVO) {
      avisar("Ese archivo es demasiado grande para ser de Pauta.");
      return;
    }

    const lector = new FileReader();
    lector.onerror = () => avisar("No se pudo leer el archivo.");
    lector.onload = () => {
      let crudos;
      try {
        crudos = JSON.parse(String(lector.result));
      } catch {
        avisar("El archivo no es JSON válido. Debe ser un .json descargado o guardado desde Pauta.");
        return;
      }
      try {
        const previo = migrar(crudos); // valida antes de tocar nada de lo que ya hay
        const materias = previo.materias.length;
        if (materias === 1) return abrirDlgImportar(crudos, previo);
        const sesiones = previo.materias.reduce((n, m) => n + m.sesiones.length, 0);
        if (!confirmar(`El archivo trae ${materias} materias y ${cuentaDeSesiones(sesiones)}. Sustituirá todo lo que hay ahora en el panel. ¿Continuar?`)) return;
        sustituirTodoCon(crudos);
      } catch (error) {
        avisar(
          error instanceof ErrorDeDatos
            ? error.message
            : "El archivo no tiene la estructura de Pauta. Debe ser un .json descargado o guardado desde Pauta."
        );
      }
    };
    lector.readAsText(archivo);
  });
}

/* ========================= Exportaciones ========================= */

function montarExportaciones() {
  $("#btn-md").addEventListener("click", () => {
    const m = materia();
    if (m) exportarMarkdown(m);
  });

  $("#btn-plantilla").addEventListener("click", abrirDlgPlantilla);
}

/* ========================= Duplicar materia ========================= */

/* Copiar una materia sirve a dos usos opuestos —volver a dar el curso con los
   mismos recursos, o empezar otro curso o un taller con el esqueleto—, así que
   se elige aquí, con la materia delante. «Agregar a mi panel» ahorra el rodeo de
   descargar el archivo e importarlo, que además pregunta si agregar o sustituir. */

const modoElegido = () => document.querySelector('input[name="pl-modo"]:checked')?.value || "semestre";

/** Las etiquetas siguen a lo que se está eligiendo: curso, taller o ponencia. */
function rotularDlgPlantilla() {
  const v = voz({ clase: $("#pl-clase").value });
  $("#lbl-pl-nombre").textContent = v.campoNombre;
  $("#lbl-pl-clave").textContent = v.campoClave;
  $("#pl-clave").placeholder = v.ejemploClave;
}

function abrirDlgPlantilla() {
  const m = materia();
  if (!m) return;
  const recursos = m.sesiones.reduce((n, s) => n + s.recursos.length, 0);
  $("#pl-sub").textContent = `«${m.nombre}» · ${cuentaDeEncuentros(m)} y ${recursos} recurso${recursos === 1 ? "" : "s"}`;
  document.querySelector('input[name="pl-modo"][value="semestre"]').checked = true;
  $("#pl-nombre").value = m.nombre;
  $("#pl-clave").value = m.clave || "";
  $("#pl-clase").value = m.clase || "curso";
  $("#pl-fecha").value = "";
  rotularDlgPlantilla();
  $("#dlg-plantilla").showModal();
  $("#pl-nombre").focus();
}

/** Lo que la usuaria eligió en el diálogo, o null si falta el nombre. */
function opcionesDePlantilla() {
  const nombre = $("#pl-nombre").value.trim();
  if (!nombre) {
    $("#pl-nombre").focus();
    return null;
  }
  return {
    modo: modoElegido(),
    nombre,
    clave: $("#pl-clave").value.trim(),
    clase: $("#pl-clase").value,
    primeraFecha: $("#pl-fecha").value,
  };
}

function montarPlantilla() {
  $("#pl-clase").addEventListener("change", rotularDlgPlantilla);
  // Sin un botón de envío, Enter no cierra el diálogo ni pierde lo escrito.
  $("#dlg-plantilla form").addEventListener("submit", (e) => e.preventDefault());

  $("#btn-pl-descargar").addEventListener("click", () => {
    const opciones = opcionesDePlantilla();
    const m = materia();
    if (!opciones || !m) return;
    exportarPlantilla(m, opciones);
    $("#dlg-plantilla").close("cerrar");
    mostrarAviso(
      opciones.modo === "estructura"
        ? "Se descargó la estructura, sin ninguna liga. Al cargarla en otro Pauta se puede agregar junto a lo que haya ahí."
        : "Se descargó la copia, con tus recursos y sus ligas. Al cargarla en otro Pauta se puede agregar junto a lo que haya ahí."
    );
  });

  $("#btn-pl-agregar").addEventListener("click", () => {
    const opciones = opcionesDePlantilla();
    const m = materia();
    if (!opciones || !m) return;

    const copia = copiaDeMateria(m, opciones);
    ordenarSesiones(copia);
    estado.datos.materias.push(copia);
    irAMateria(estado.datos.materias.length - 1);
    actualizar();
    $("#dlg-plantilla").close("cerrar");

    mostrarAviso(
      `Se agregó «${copia.nombre}» a tu panel, con ${cuentaDeEncuentros(copia)}` +
        (opciones.modo === "estructura" ? " y sin ligas." : " y sus recursos.") +
        " Si no la querías, elimínala desde su menú ⋯ → Editar."
    );
  });
}

/* ========================= Mis datos =========================

   Un solo lugar para todo lo que tiene que ver con los datos, con tres
   preguntas en orden: dónde se guardan, cómo llevarlos a otra parte y cómo
   volver atrás. Antes esto estaba repartido entre el menú «Archivo» y este
   cuadro, con cinco botones al pie y tres palabras —respaldo, copia de
   seguridad, archivo vinculado— que sonaban a lo mismo. Ahora cada bloque
   ofrece solo la acción que tiene sentido en la situación del momento. */

function bloqueDondeSeGuardan() {
  const { modo, soportaArchivo, nombreArchivo, necesitaReconectar } = gestor.estado();
  const boton = (accion, texto, titulo, clase = "btn") =>
    `<button type="button" class="${clase}" data-alm="${accion}" title="${esc(titulo)}">${esc(texto)}</button>`;

  let texto;
  let botones = "";
  if (necesitaReconectar) {
    texto = `Se guardan en <strong>${esc(nombreArchivo || "tu archivo")}</strong>, pero el navegador necesita tu
      permiso otra vez para seguir escribiendo en él. Mientras tanto, todo queda a salvo en este navegador.`;
    botones =
      boton("reconectar", "Reconectar", "Volver a dar permiso sobre el archivo y seguir escribiendo en él", "btn btn-solido") +
      boton("existente", "Abrir otro archivo…", "Si el archivo cambió de lugar, elígelo otra vez");
  } else if (modo === "archivo") {
    texto = `En el archivo <strong>${esc(nombreArchivo)}</strong>. Si está en tu carpeta de OneDrive, Drive, Dropbox
      o iCloud, te sigue a tus otras computadoras. Además queda una copia en este navegador.`;
    botones = `<details class="alm-cambiar">
        <summary title="Usar otro archivo, crear uno nuevo o dejar de guardar en un archivo">Cambiar…</summary>
        <div class="alm-botones">
          ${boton("existente", "Abrir otro archivo…", "Abrir un .json que ya tengas y guardar ahí de aquí en adelante")}
          ${boton("nuevo", "Crear un archivo nuevo…", "Crear un .json nuevo con lo que hay ahora y guardar ahí de aquí en adelante")}
          ${boton("desvincular", "Dejar de usar el archivo", "Dejar de escribir en el archivo. Tus datos siguen en este navegador", "btn peligro")}
        </div>
      </details>`;
  } else if (modo === "memoria") {
    texto = `<strong>En ningún lado:</strong> este navegador no deja guardar nada y todo se pierde al cerrar la
      pestaña. Antes de salir, usa <em>Descargar mis datos</em>.`;
  } else if (soportaArchivo) {
    texto = `Solo en <strong>este navegador</strong>, en esta computadora. Guárdalos en un archivo dentro de tu
      carpeta de OneDrive, Drive, Dropbox o iCloud y te seguirán a cualquier computadora.`;
    botones =
      boton("nuevo", "Guardar en un archivo…", "Crear un .json en la carpeta que elijas y guardar ahí cada cambio, de aquí en adelante", "btn btn-solido") +
      boton("existente", "Ya tengo un archivo: abrirlo…", "Abrir el .json que ya usas en otra computadora y seguir guardando en él");
  } else {
    texto = `Solo en <strong>este navegador</strong>, en esta computadora. Guardar en un archivo de tu nube solo se
      puede en Chrome y Edge (y no abriendo Pauta con doble clic desde el disco). Aquí, para llevar tus datos a
      otra computadora, descárgalos y cárgalos allá.`;
  }

  return `<h4 class="alm-titulo">Dónde se guardan</h4>
    <p class="alm-texto">${texto}</p>
    ${botones ? `<div class="alm-botones">${botones}</div>` : ""}`;
}

function bloqueLlevar() {
  return `<h4 class="alm-titulo">Llevarlos a otra parte</h4>
    <p class="pista">Para pasarlos a otra computadora sin archivo en la nube, o compartirlos. <em>Descargar</em>
      crea un .json con todas tus materias. <em>Cargar</em> lo abre aquí: si trae una sola materia te pregunta si
      agregarla o sustituir todo; si trae varias, sustituye todo, y lo de ahora queda en las versiones anteriores.</p>
    <div class="alm-botones">
      <button type="button" class="btn" data-alm="descargar" title="Descargar todas tus materias en un archivo .json">Descargar mis datos</button>
      <button type="button" class="btn" data-alm="cargar" title="Abrir un .json descargado de Pauta: agrega una materia o sustituye todo, según lo que traiga">Cargar datos de un archivo…</button>
    </div>`;
}

/** Las versiones archivadas, plegadas: solo hacen falta cuando algo salió mal. */
function bloqueVersiones(abierto) {
  const copias = leerCopias();
  const lista = copias.length
    ? `<p class="pista">Restaurar vuelve a esa versión; lo que hay ahora se guarda antes como una versión más.</p>
      <ul class="alm-copias">
      ${copias
        .map((copia, i) => {
          const materias = copia.datos?.materias?.length || 0;
          const sesiones = (copia.datos?.materias || []).reduce((n, m) => n + (m.sesiones?.length || 0), 0);
          return `<li>
            <span class="cuando">${esc(fechaHoraCorta(copia.fecha))}</span>
            <span class="que">${esc(copia.motivo || "versión")} · ${materias} materia${materias === 1 ? "" : "s"}, ${sesiones} ${sesiones === 1 ? "sesión" : "sesiones"}</span>
            <button type="button" class="mini" data-restaurar="${i}" title="Volver a esta versión de tus datos">Restaurar</button>
          </li>`;
        })
        .join("")}
      </ul>`
    : `<p class="pista">Todavía no hay ninguna.</p>`;

  return `<details class="alm-versiones"${abierto ? " open" : ""}>
      <summary title="Ver las versiones que Pauta guarda sola, por si necesitas volver atrás">Versiones anteriores (${copias.length})</summary>
      <p class="pista">Pauta las guarda sola en este navegador: al abrir, antes de cualquier cambio que sustituya todo y
        cada pocos minutos mientras trabajas. Conserva las seis más recientes y una por día de la última semana.</p>
      ${lista}
    </details>`;
}

function pintarDialogoAlmacen() {
  const danado = leerDanado();
  const problemas =
    (danado
      ? `<div class="alm-modo">Se conservó aparte una versión que no se pudo leer (${Math.max(1, Math.round(danado.length / 1024))} KB). No se usa para nada; está por si alguien puede recuperar algo de ahí. Si buscas tus datos, mira las versiones anteriores.
      <button type="button" class="mini" data-bajar-danado title="Descargar lo que no se pudo leer, como archivo de texto">Descargar</button>
      <button type="button" class="mini" data-descartar-danado title="Borrar de este navegador lo que no se pudo leer. No se puede deshacer">Descartar</button></div>`
      : "") +
    (gestor.estado().hayConflicto
      ? `<div class="alm-modo">Otra computadora cambió el archivo y todavía no has decidido qué versión se queda. Mientras tanto no se escribe nada en él.
      <button type="button" class="mini" data-resolver-conflicto title="Ver qué cambió y elegir qué versión se queda">Resolver ahora</button></div>`
      : "");

  $("#alm-cuerpo").innerHTML = problemas + bloqueDondeSeGuardan() + bloqueLlevar() + bloqueVersiones(!!danado);
}

function restaurarCopia(indice) {
  const copia = leerCopias()[indice];
  if (!copia) return;
  if (!confirmar(`Se volverá a la versión del ${fechaHoraCorta(copia.fecha)} (${copia.motivo}). Lo que hay ahora se guarda antes como una versión más. ¿Continuar?`)) return;

  try {
    archivarCopia(estado.datos, "antes de restaurar una versión");
    cargarEnElPanel(copia.datos, { guardar: true });
    $("#dlg-almacen").close("cerrar");
    mostrarAviso(`Se restauró la versión del ${fechaHoraCorta(copia.fecha)}.`);
  } catch (error) {
    avisar(
      error instanceof ErrorDeDatos
        ? `Esa versión está dañada y no se pudo restaurar: ${error.message}`
        : "Esa versión está dañada y no se pudo restaurar."
    );
  }
}

/* Lo que hace cada botón de «Mis datos». Los botones se repintan según la
   situación, así que se escuchan desde el cuadro y no uno por uno. */
const ACCIONES_DE_DATOS = {
  async nuevo() {
    try {
      const listo = await gestor.vincularNuevo(estado.datos, "panel-de-clases.json");
      if (listo) $("#dlg-almacen").close("cerrar");
    } catch {
      avisar("No se pudo crear el archivo.");
    }
  },

  async existente() {
    try {
      const contenido = await gestor.abrirExistente((crudo) => migrar(crudo));
      if (contenido === null) return; // canceló
      if (contenido) {
        archivarCopia(estado.datos, "antes de abrir otro archivo");
        cargarEnElPanel(contenido, { guardar: true });
      } else {
        // Archivo vacío: se usa y se escribe en él lo que ya hay en el panel.
        await gestor.guardarAhora(estado.datos);
      }
      $("#dlg-almacen").close("cerrar");
    } catch (error) {
      avisar(
        error instanceof ErrorDeDatos
          ? error.message
          : "No se pudo abrir ese archivo. Debe ser un .json guardado o descargado desde Pauta."
      );
    }
  },

  async reconectar() {
    try {
      const contenido = await gestor.reconectar((crudo) => migrar(crudo), estado.datos);
      if (contenido) cargarEnElPanel(contenido);
      $("#dlg-almacen").close("cerrar");
    } catch (error) {
      avisar(
        error instanceof ErrorDeDatos
          ? `El archivo ya no tiene datos de Pauta válidos: ${error.message}`
          : "No se pudo reconectar el archivo. Elígelo otra vez con «Abrir otro archivo»."
      );
    }
  },

  async desvincular() {
    if (!confirmar("Pauta dejará de escribir en el archivo y seguirá guardando solo en este navegador. ¿Continuar?")) return;
    await gestor.desvincular();
    $("#dlg-almacen").close("cerrar");
  },

  descargar() {
    exportarRespaldo(estado.datos);
  },

  cargar() {
    $("#dlg-almacen").close("cerrar");
    $("#archivo-json").click();
  },
};

function montarDialogoAlmacen() {
  $("#alm-cuerpo").addEventListener("click", (e) => {
    const accion = e.target.closest("[data-alm]")?.dataset.alm;
    if (accion) {
      ACCIONES_DE_DATOS[accion]?.();
      return;
    }
    if (e.target.closest("[data-resolver-conflicto]")) {
      $("#dlg-almacen").close("cerrar");
      abrirConflicto();
      return;
    }
    if (e.target.closest("[data-bajar-danado]")) {
      const texto = leerDanado();
      if (texto) descargar("panel-de-clases-danado.txt", texto, "text/plain;charset=utf-8");
      return;
    }
    if (e.target.closest("[data-descartar-danado]")) {
      if (!confirmar("Se borrará de este navegador lo que no se pudo leer. No se puede deshacer. ¿Continuar?")) return;
      borrarDanado();
      pintarDialogoAlmacen();
      return;
    }
    const boton = e.target.closest("[data-restaurar]");
    if (boton) restaurarCopia(Number(boton.dataset.restaurar));
  });

  // El indicador de guardado es la puerta: dice si todo está guardado y,
  // al pulsarlo, todo lo demás.
  $("#estado-guardado").addEventListener("click", () => {
    pintarDialogoAlmacen();
    $("#dlg-almacen").showModal();
  });
}

/* ========================= El archivo cambió en otra computadora ========================= */

function abrirConflicto() {
  const dlg = $("#dlg-conflicto");
  const d = gestor.detalleDeConflicto();
  if (!d || dlg.open) return;

  const cuando = d.cuando ? ` (a las ${horaCorta(d.cuando)})` : "";
  const cuanto = `${d.materias} materia${d.materias === 1 ? "" : "s"} y ${d.sesiones} ${d.sesiones === 1 ? "sesión" : "sesiones"}`;
  $("#con-cuerpo").innerHTML = `
    <p>Mientras tenías Pauta abierta, <strong>otra computadora, u otra pestaña, guardó cambios</strong> en
      <em>${esc(d.nombreArchivo || "tu archivo")}</em>${esc(cuando)}. La versión del archivo trae ${esc(cuanto)}.</p>
    <p>Para no pisarlos, <strong>no se ha escrito nada en el archivo</strong>. Lo que hiciste en esta pestaña está a salvo
      en este navegador. Elige qué versión se queda:</p>
    <ul class="alm-lista">
      <li><strong>Usar la versión del archivo</strong>: cargas lo que guardó la otra computadora. Lo de esta pestaña se guarda antes como versión anterior.</li>
      <li><strong>Guardar la mía encima</strong>: el archivo queda con lo de esta pestaña. La versión que hay ahora en el archivo se guarda antes como versión anterior.</li>
    </ul>
    <p class="pista">En los dos casos la otra versión queda en «Mis datos», entre las versiones anteriores.</p>`;
  dlg.showModal();
}

function montarConflicto() {
  $("#btn-con-archivo").addEventListener("click", () => {
    const enDisco = gestor.contenidoEnConflicto();
    if (!enDisco) return $("#dlg-conflicto").close("cerrar");
    try {
      migrar(enDisco); // se valida antes de tocar nada: si no sirve, el conflicto sigue abierto
    } catch (error) {
      avisar(
        error instanceof ErrorDeDatos
          ? `La versión del archivo no se puede cargar: ${error.message}`
          : "La versión del archivo no se puede cargar."
      );
      return;
    }
    archivarCopia(estado.datos, "antes de cargar la versión del archivo");
    cargarEnElPanel(gestor.usarArchivo(), { guardar: true });
    $("#dlg-conflicto").close("cerrar");
    mostrarAviso("Se cargó la versión del archivo. Lo que tenías en esta pestaña quedó en «Mis datos», entre las versiones anteriores.");
  });

  $("#btn-con-mia").addEventListener("click", async () => {
    const enDisco = gestor.contenidoEnConflicto();
    // Primero se archiva lo que se va a sobrescribir; si no cupiera, no se sigue.
    if (enDisco && !archivarCopia(enDisco, "versión del archivo antes de sobrescribirla")) {
      const hayCopiaIgual = leerCopias().some((c) => JSON.stringify(c.datos) === JSON.stringify(enDisco));
      if (!hayCopiaIgual && !confirmar("No se pudo guardar una copia de la versión del archivo, así que se perderá al sobrescribirlo. ¿Continuar de todos modos?")) return;
    }
    await gestor.guardarLaMia(estado.datos);
    $("#dlg-conflicto").close("cerrar");
    mostrarAviso("Se guardó tu versión en el archivo. La que había quedó en «Mis datos», entre las versiones anteriores.");
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
  montarConflicto();
  montarPlantilla();

  registrarPersistencia((datos) => gestor.programar(datos));

  // Última oportunidad de guardar si la pestaña se cierra con cambios recientes.
  window.addEventListener("pagehide", () => gestor.guardarAlSalir());
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") gestor.guardarAlSalir();
  });

  let aviso = "";
  let inicio = null;
  try {
    inicio = await gestor.iniciar();
    aviso = inicio.aviso;
    cargarEnElPanel(inicio.datos || DATOS_DE_EJEMPLO);
    // Copia de seguridad del estado con el que se abrió, si había algo guardado.
    if (inicio.datos) archivarCopia(estado.datos, "al abrir el panel");
    if (inicio.hayConflicto) abrirConflicto();
    retomarClaseTrasRecarga();
  } catch (error) {
    cargarEnElPanel(DATOS_DE_EJEMPLO);
    /* Antes este aviso decía «nada se ha sobrescrito todavía», y el primer
       cambio sobrescribía justo lo que no se había podido leer. Ahora se
       conserva aparte, y si venía del archivo vinculado ese archivo deja de
       recibir escrituras: la frase es cierta. */
    const aSalvo = gestor.lecturaInvalida(inicio?.datos ?? null);
    const copias = leerCopias().length;
    avisar(
      "Lo guardado no se pudo leer, así que se abrieron los datos de ejemplo. " +
        (aSalvo ? "Lo que no se pudo leer se conservó aparte, sin tocarlo, y puedes descargarlo desde «Mis datos». " : "") +
        (gestor.estado().necesitaReconectar ? "No se escribirá nada en tu archivo hasta que lo reconectes o elijas otro. " : "") +
        (copias
          ? `Hay ${copias} ${copias === 1 ? "versión anterior" : "versiones anteriores"}: restaura la más reciente en «Mis datos» antes de hacer cambios.`
          : "Si tienes tus datos descargados, cárgalos en «Mis datos» antes de hacer cambios.") +
        `\n\n${error instanceof ErrorDeDatos ? error.message : "El archivo guardado está dañado."}`
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
    avisar("Pauta no pudo arrancar. Vuelve a cargar la página; si sigue igual, carga tus datos desde «Mis datos» → Cargar datos de un archivo.");
  });
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", arrancarConRed, { once: true });
} else {
  arrancarConRed();
}
