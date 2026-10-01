/* Barra lateral: materias, enlaces del curso y sesiones. */

import { $, esc } from "../util/dom.js";
import { fechaCorta } from "../util/fechas.js";
import { urlSegura } from "../util/urls.js";
import { indiceVigente } from "../datos/modelo.js";
import { estado, materia, irAMateria, irASesion, repintar, suscribir } from "../estado.js";
import { voz, rotuloDeLaLista } from "../datos/vocabulario.js";
import { rotuloDeCuaderno } from "../datos/nubes.js";
import { abrirDlgMateria, abrirDlgSesion } from "./dialogos.js";
import { abrirRevision } from "./revision.js";
import { abrirMenu } from "./menu.js";

/* Lo que se hace CON una materia vive en su propio menú: editarla,
   duplicarla y descargarla como texto. Antes las dos últimas estaban en
   «Archivo», revueltas con lo que se hace con los datos. Duplicar y
   descargar actúan sobre la materia abierta, así que primero se abre. */
function menuDeMateria(boton, i) {
  const ir = () => {
    if (estado.materiaActiva !== i) {
      irAMateria(i);
      repintar();
    }
  };
  abrirMenu(boton, [
    { etiqueta: "Editar…", titulo: "Cambiar nombre, periodo, tipo, carpeta y cuaderno, o eliminarla", accion: () => abrirDlgMateria(i) },
    { etiqueta: "Duplicar…", titulo: $("#btn-plantilla").title, accion: () => { ir(); $("#btn-plantilla").click(); } },
    { etiqueta: "Descargar como texto (.md)", titulo: $("#btn-md").title, accion: () => { ir(); $("#btn-md").click(); } },
  ]);
}

function pintarMaterias() {
  // El rótulo sigue a lo que hay: «Materias» si todo son cursos, «Talleres»
  // si todo son talleres, y «Actividades» cuando está mezclado.
  $("#rotulo-materias").textContent = rotuloDeLaLista(estado.datos.materias);
  $("#lista-materias").innerHTML = estado.datos.materias
    .map(
      (m, i) => `
    <div class="fila materia" data-activo="${i === estado.materiaActiva}">
      <button class="principalbtn" data-ir="${i}" title="Abrir ${esc(voz(m).etiqueta.toLowerCase())}">${esc(m.nombre)}${m.clase && m.clase !== "curso" ? `<span class="clase">${esc(voz(m).etiqueta)}</span>` : ""}<small>${esc(m.clave || "")}</small></button>
      <button class="lapiz" data-opciones="${i}" aria-haspopup="menu" title="Editar, duplicar o descargar como texto" aria-label="Opciones de ${esc(voz(m).etiqueta.toLowerCase())} ${esc(m.nombre)}">⋯</button>
    </div>`
    )
    .join("");

  const m = materia();
  /* Una liga con un esquema que no se puede abrir se muestra como texto, nunca
     como enlace: un respaldo ajeno podría traer una liga preparada. */
  const enlace = (url, texto, sinLiga) => {
    if (!url) return `<span>${esc(sinLiga)}</span>`;
    if (!urlSegura(url)) return `<span>${esc(texto)}: la liga guardada no es válida</span>`;
    /* El cartelito lleva la dirección entera: el rótulo dice la nube, no
       adónde apunta, y estas ligas no se ven en ningún otro lado. */
    return `<a href="${esc(url)}" target="_blank" rel="noopener noreferrer"
      title="Abrir en otra pestaña · ${esc(url)}">${esc(texto)}</a>`;
  };

  /* Cuando no hay nada vinculado, dos renglones diciendo «sin esto» y «sin
     aquello» son ruido: se sustituyen por una sola opción de configuración. */
  const sinEnlaces = m && !m.carpeta && !m.cuaderno;
  $("#enlaces-materia").innerHTML = !m
    ? ""
    : sinEnlaces
      ? `<button class="config-materia" data-configurar title="Agregar la carpeta donde viven los materiales y el cuaderno del curso, estén en la nube que estén">Vincular carpeta y cuaderno…</button>`
      : [
          /* La carpeta no lleva el nombre de la nube. Antes decía siempre
             «OneDrive», que era falso la mitad de las veces; nombrarla de
             verdad tampoco sirve —el OneDrive institucional se anuncia
             como «SharePoint», que no es como nadie lo llama— y a fin de
             cuentas la carpeta del curso es la carpeta del curso, esté
             donde esté. La dirección entera vive en el cartelito.
             El cuaderno es otra cosa: si es de OneNote se dice, porque
             quien lo usa lo llama así y no tiene nombre genérico mejor. */
          m.carpeta ? enlace(m.carpeta, "Carpeta del curso", "") : "",
          m.cuaderno ? enlace(m.cuaderno, rotuloDeCuaderno(m.cuaderno), "") : "",
          `<button class="config-materia" data-configurar title="Cambiar la carpeta y el cuaderno vinculados">Configurar…</button>`,
        ].join("");
}

function pintarSesiones() {
  const m = materia();
  const sesiones = m?.sesiones || [];
  const vigente = indiceVigente(m);
  const verTodas = estado.verTodasLasSesiones;

  const v = voz(m);
  $("#rotulo-sesiones").textContent = verTodas ? v.encuentrosDe : v.vigente;
  $("#btn-sesion-nueva").textContent = v.nuevoEncuentro;
  $("#btn-sesion-nueva").title = `Crear ${v.encuentro.toLowerCase()} en esto`;

  if (!sesiones.length) {
    $("#lista-sesiones").innerHTML = `<p class="sin-sesiones">${v.sinEncuentros}.</p>`;
    $("#btn-ver-todas").hidden = true;
    return;
  }

  const indices = verTodas ? sesiones.map((_, i) => i) : [estado.sesionActiva];
  $("#lista-sesiones").innerHTML = indices
    .map((i) => {
      const s = sesiones[i];
      const num = String(s.num || i + 1).padStart(2, "0");
      /* El título se abrevia a una línea para que el número y la fecha se
         recorran de un vistazo; completo sigue en los datos, en el atributo
         title y en la cabecera de la vista principal. */
      return `
    <div class="fila sesion" data-activo="${i === estado.sesionActiva}">
      <button class="principalbtn" data-ir="${i}" title="${esc(s.titulo)}">
        <span class="linea-meta">
          <span class="num-ses">${esc(v.encuentro.slice(0, 1).toUpperCase())}${num}</span>
          <span class="fecha-chip${s.fecha ? "" : " sin-fecha"}">${esc(fechaCorta(s.fecha))}</span>
          ${i === vigente ? '<span class="vigente">vigente</span>' : ""}
        </span>
        <span class="titulo-ses">${esc(s.titulo)}</span>
      </button>
      <button class="lapiz" data-editar="${i}" title="Editar número, fecha, título y propósito" aria-label="Editar ${esc(v.encuentro.toLowerCase())} ${esc(s.titulo)}">editar</button>
    </div>`;
    })
    .join("");

  $("#btn-ver-todas").hidden = sesiones.length <= 1;
  $("#btn-ver-todas").textContent = verTodas
    ? v.verVigente
    : `Ver ${sesiones.length} ${v.encuentros.toLowerCase()}`;
}

export function montarLateral() {
  $("#lista-materias").addEventListener("click", (e) => {
    const opciones = e.target.closest("[data-opciones]");
    if (opciones) {
      menuDeMateria(opciones, Number(opciones.dataset.opciones));
      return;
    }
    const ir = e.target.closest("[data-ir]");
    if (ir) {
      irAMateria(Number(ir.dataset.ir)); // ya sale de la vista de semestre
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

  $("#enlaces-materia").addEventListener("click", (e) => {
    if (e.target.closest("[data-configurar]")) abrirDlgMateria(estado.materiaActiva);
  });

  /* La barra de arriba cambia de alto según el logotipo y según si se
     envuelve en pantallas angostas. Se mide y se publica, para que el lateral
     pegajoso empiece justo debajo en lugar de confiar en un número escrito
     a mano que se quedaba viejo a cada cambio de cabecera. */
  const barra = document.querySelector(".barra");
  const medirBarra = () =>
    document.documentElement.style.setProperty("--alto-barra", `${Math.round(barra.getBoundingClientRect().height)}px`);
  medirBarra();
  if (window.ResizeObserver) new ResizeObserver(medirBarra).observe(barra);
  else addEventListener("resize", medirBarra);

  /* Plegado de la barra lateral. La preferencia vive en el navegador, no en
     los datos: es de esta pantalla y de este equipo, no del curso. */
  const CLAVE_PLEGADO = "panel-de-clases:lateral-plegado";
  const boton = $("#btn-plegar");
  const aplicarPlegado = (plegado) => {
    document.body.classList.toggle("lateral-plegado", plegado);
    boton.setAttribute("aria-expanded", String(!plegado));
    boton.title = plegado ? "Mostrar la barra lateral" : "Ocultar la barra lateral";
  };
  let plegado = false;
  try { plegado = localStorage.getItem(CLAVE_PLEGADO) === "1"; } catch { /* sin memoria */ }
  aplicarPlegado(plegado);
  boton.addEventListener("click", () => {
    plegado = !plegado;
    aplicarPlegado(plegado);
    try { localStorage.setItem(CLAVE_PLEGADO, plegado ? "1" : "0"); } catch { /* sin memoria */ }
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
    const vm = voz(materia());
    $("#btn-semestre").textContent = estado.vistaSemestre
      ? `Volver a ${vm.encuentro.toLowerCase() === "sesión" ? "la sesión" : "lo anterior"}`
      : vm.vistaGeneral;
  });
}
