/* =========================================================
   Nubes y suites de ofimática.

   Pauta nunca ha dependido de Microsoft. El guardado usa la API estándar
   del navegador (showSaveFilePicker) y escribe un archivo normal del
   disco; quien lo sincroniza es la aplicación de escritorio de cada nube,
   sea cual sea. Lo único que ataba la herramienta a Microsoft eran las
   palabras: rótulos que decían «Carpeta de OneDrive» aunque aceptaran
   cualquier dirección, un distintivo que decía «OneDrive» en ligas de
   Google, y una fila de botones que solo sabía crear archivos de Office.

   Aquí viven esas palabras, igual que en vocabulario.js viven las de
   curso/taller/ponencia: solo rótulos y textos de ayuda. Ni los datos ni
   las vistas saben de esto; piden lo que toca y siguen.

   Dos piezas distintas:

     · La NUBE se deduce de la liga. No hace falta preguntar nada: si la
       dirección es de Drive, el distintivo dice Drive. Es lo que antes
       mentía.
     · La SUITE —qué se abre al pedir un documento en blanco— no se puede
       deducir cuando todavía no hay ninguna liga, así que se elige por
       materia, junto a curso/taller/ponencia. Una profesora puede tener
       el OneDrive institucional en un curso y su Drive personal en un
       taller de fuera.
   ========================================================= */

/* ---------------------------------------------------------
   Nubes reconocidas

   Solo sirven para nombrar lo que ya está guardado: el distintivo de la
   tarjeta, el rótulo del enlace de la materia y la instrucción de cómo se
   copia una liga en cada una. Una liga de una nube que no esté en esta
   lista no es un error: simplemente se muestra por su dominio.
   --------------------------------------------------------- */
export const NUBES = [
  {
    id: "onedrive",
    nombre: "OneDrive",
    dominios: /(^|\.)(onedrive\.live\.com|1drv\.ms|onedrive\.com)$/i,
    comoCopiar: "clic derecho sobre el archivo → Compartir → Copiar vínculo",
    sinConexion: "En OneDrive, clic derecho sobre la carpeta → Conservar siempre en este dispositivo.",
  },
  {
    /* El OneDrive de una cuenta institucional vive en un host del tipo
       «organizacion-my.sharepoint.com». Por dentro es SharePoint, pero
       quien lo usa lo abre desde OneDrive y así lo llama su propia
       aplicación: decirle SharePoint solo desconcierta. Los sitios de
       equipo, sin el «-my», sí son SharePoint y se nombran aparte. */
    id: "onedrive-institucional",
    nombre: "OneDrive",
    dominios: /-my\.sharepoint\.com$/i,
    comoCopiar: "clic derecho sobre el archivo → Compartir → Copiar vínculo",
    sinConexion: "En OneDrive, clic derecho sobre la carpeta → Conservar siempre en este dispositivo.",
  },
  {
    id: "sharepoint",
    nombre: "SharePoint",
    dominios: /(^|\.)sharepoint\.com$/i,
    comoCopiar: "clic derecho sobre el archivo → Compartir → Copiar vínculo",
    sinConexion: "En OneDrive, clic derecho sobre la carpeta → Conservar siempre en este dispositivo.",
  },
  {
    id: "onenote",
    nombre: "OneNote",
    dominios: /(^|\.)onenote\.com$/i,
    comoCopiar: "Compartir → Copiar vínculo",
    sinConexion: "",
  },
  {
    id: "office",
    nombre: "Microsoft 365",
    /* Solo Office en línea. Antes también entraba «live.com» entero, que es
       el inicio de sesión y el correo de Outlook: no son archivos. */
    dominios: /(^|\.)(office\.com|office365\.com)$/i,
    comoCopiar: "Compartir → Copiar vínculo",
    sinConexion: "",
  },
  {
    id: "drive",
    nombre: "Google Drive",
    /* Los dominios donde viven los ARCHIVOS: Drive y las hojas, documentos y
       presentaciones. Antes la regla terminaba en «google.com» a secas, y con
       eso Gmail, Meet, Calendar, Classroom, Sites, Académico y hasta el
       buscador salían etiquetados como «Google Drive». */
    dominios: /(^|\.)(drive\.google\.com|docs\.google\.com|sheets\.google\.com|slides\.google\.com|drive\.usercontent\.google\.com)$/i,
    comoCopiar: "clic derecho sobre el archivo → Compartir → Copiar vínculo",
    sinConexion:
      "En Drive para escritorio, clic derecho sobre la carpeta → Acceso sin conexión → Disponible sin conexión. En modo «transmisión» el archivo no está en el disco.",
  },
  {
    id: "dropbox",
    nombre: "Dropbox",
    dominios: /(^|\.)dropbox\.com$/i,
    comoCopiar: "clic derecho sobre el archivo → Copiar enlace de Dropbox",
    sinConexion:
      "En Dropbox, clic derecho sobre la carpeta → Sincronización inteligente → Local. Si está «solo en línea», el archivo no está en el disco.",
  },
  {
    id: "icloud",
    nombre: "iCloud Drive",
    dominios: /(^|\.)icloud\.com$/i,
    comoCopiar: "clic derecho sobre el archivo → Compartir → Copiar enlace",
    sinConexion:
      "En el Finder, clic derecho sobre la carpeta → Descargar ahora, y evita «Optimizar almacenamiento del Mac» para esa carpeta.",
  },
  {
    id: "box",
    nombre: "Box",
    dominios: /(^|\.)(box\.com|app\.box\.com)$/i,
    comoCopiar: "Compartir → Copiar enlace",
    sinConexion: "En Box Drive, clic derecho sobre la carpeta → Make Available Offline.",
  },
];

/** La nube a la que pertenece una liga, o null si no se reconoce. */
export function nubeDe(url) {
  const texto = String(url || "").trim();
  if (!/^https?:\/\//i.test(texto)) return null;
  let host;
  try {
    host = new URL(texto).hostname;
  } catch {
    return null;
  }
  return NUBES.find((n) => n.dominios.test(host)) || null;
}

/** Nombre de la nube para mostrar, o cadena vacía si no se reconoce. */
export const nombreDeNube = (url) => nubeDe(url)?.nombre || "";

/**
 * Si una liga es un cuaderno de OneNote.
 *
 * A diferencia de la carpeta, aquí sí vale nombrar el producto: OneNote no
 * tiene equivalente genérico —no es «un documento», es un cuaderno con
 * secciones y páginas— y quien lo usa lo llama por su nombre. Cuando el
 * cuaderno es otra cosa, el rótulo se queda en lo genérico.
 *
 * Se reconoce por estas señales:
 *   · el esquema onenote: de la aplicación de escritorio;
 *   · el dominio onenote.com;
 *   · el marcador «:o:» que Microsoft mete en las ligas compartidas para
 *     decir de qué tipo es el archivo (:w: Word, :x: Excel, :p: PowerPoint,
 *     :o: OneNote);
 *   · en SharePoint, la página onenote.aspx y los archivos .one, .onetoc2 y
 *     .onepkg, tanto en la ruta como en el parámetro «file»;
 *   · en SharePoint, un cuaderno guardado en un sitio, que se ve así:
 *     /sites/…/SiteAssets/Nombre del cuaderno?web=1. Se pidió con las tres
 *     condiciones a la vez —bajo SiteAssets, sin extensión de archivo en el
 *     último tramo y con «web=1»— porque un archivo suelto de esa biblioteca
 *     (una imagen, un Word) SÍ lleva extensión, y una carpeta a secas no lleva
 *     «web=1». Esta última señal salió de un caso real: el cuaderno de una
 *     materia con esa forma se rotulaba «Cuaderno del curso».
 */
export function esCuadernoOneNote(url) {
  const texto = String(url || "").trim();
  if (/^onenote:/i.test(texto)) return true;
  if (!/^https?:\/\//i.test(texto)) return false;
  try {
    const u = new URL(texto);
    if (/(^|\.)onenote\.com$/i.test(u.hostname)) return true;
    const enMicrosoft = /(-my\.sharepoint\.com|(^|\.)sharepoint\.com|(^|\.)onedrive\.live\.com)$/i;
    if (!enMicrosoft.test(u.hostname)) return false;

    if (/\/:o:\//i.test(u.pathname)) return true;

    const ruta = decodeURIComponent(u.pathname);
    const tramos = ruta.split("/").filter(Boolean);
    const ultimo = tramos.at(-1) || "";
    const esArchivoOneNote = (nombre) => /\.(one|onetoc2|onepkg)$/i.test(nombre);
    if (/\/onenote\.aspx$/i.test(ruta) || esArchivoOneNote(ultimo)) return true;
    if (esArchivoOneNote(u.searchParams.get("file") || "")) return true;

    // Cuaderno de un sitio: BAJO SiteAssets —no la biblioteca misma, cuyo
    // último tramo es «SiteAssets»—, sin extensión y abierto con web=1.
    const sinExtension = ultimo !== "" && !/\.[A-Za-z0-9]{1,8}$/.test(ultimo);
    const posicionDeSiteAssets = tramos.findIndex((t) => t.toLowerCase() === "siteassets");
    const bajoSiteAssets = posicionDeSiteAssets !== -1 && posicionDeSiteAssets < tramos.length - 1;
    return bajoSiteAssets && sinExtension && u.searchParams.get("web") === "1";
  } catch {
    return false;
  }
}

/* ---------------------------------------------------------
   Suites de ofimática

   Las direcciones son los atajos oficiales para crear un archivo en
   blanco: word.new, docs.new y compañía. Abren la suite ya con sesión
   iniciada y el archivo recién creado queda en la nube de esa cuenta.
   --------------------------------------------------------- */
export const SUITES = {
  microsoft: {
    id: "microsoft",
    etiqueta: "Microsoft 365 — Word, PowerPoint, Excel",
    nube: "OneDrive",
    crear: [
      { clave: "doc", boton: "Word", nombre: "documento de Word", url: "https://word.new" },
      { clave: "presentacion", boton: "PowerPoint", nombre: "presentación de PowerPoint", url: "https://ppt.new" },
      { clave: "hoja", boton: "Excel", nombre: "hoja de cálculo de Excel", url: "https://xl.new" },
    ],
  },
  google: {
    id: "google",
    etiqueta: "Google Workspace — Documentos, Presentaciones, Hojas de cálculo",
    nube: "Google Drive",
    crear: [
      { clave: "doc", boton: "Documentos", nombre: "documento de Google", url: "https://docs.new" },
      { clave: "presentacion", boton: "Presentaciones", nombre: "presentación de Google", url: "https://slides.new" },
      { clave: "hoja", boton: "Hojas de cálculo", nombre: "hoja de cálculo de Google", url: "https://sheets.new" },
    ],
  },
  ninguna: {
    id: "ninguna",
    etiqueta: "Ninguna — solo pego ligas de archivos que ya existen",
    nube: "",
    crear: [],
  },
};

/* Qué suite corresponde a cada nube, cuando la materia no lo dice. */
const SUITE_DE_NUBE = {
  onedrive: "microsoft",
  "onedrive-institucional": "microsoft",
  onenote: "microsoft",
  sharepoint: "microsoft",
  office: "microsoft",
  drive: "google",
  /* Dropbox, iCloud y Box no tienen suite propia en el navegador. Ofrecer
     ahí un «Word en blanco» sería engañoso: word.new guarda el archivo en
     OneDrive, no en Dropbox. Mejor ningún botón que uno que miente; quien
     sí tenga Microsoft 365 o Google lo elige en el formulario. */
  dropbox: "ninguna",
  icloud: "ninguna",
  box: "ninguna",
};

/**
 * La suite de una materia.
 *
 * Si la materia no lo tiene escrito —y ninguna la tenía antes de que esto
 * existiera— se deduce de la carpeta o del cuaderno que sí estén puestos:
 * quien vinculó una carpeta de Drive quiere crear documentos de Google.
 * Sin ninguna señal se queda en Microsoft, que es lo que Pauta hacía
 * antes. Es continuidad para quien ya la usa, no una preferencia: en
 * cuanto se vincula una carpeta, o se elige en el formulario, manda eso.
 */
export function suiteDe(materia) {
  const escrita = materia?.ofimatica;
  if (escrita && SUITES[escrita]) return SUITES[escrita];

  const nube = nubeDe(materia?.carpeta) || nubeDe(materia?.cuaderno);
  return SUITES[SUITE_DE_NUBE[nube?.id]] || SUITES.microsoft;
}

/**
 * Cómo se copia una liga en la nube de esta materia. Se usa en la pista
 * del formulario de recurso, para no explicarlo siempre en términos de
 * OneDrive.
 */
export function comoCopiarEn(materia) {
  const nube = nubeDe(materia?.carpeta) || nubeDe(materia?.cuaderno);
  return nube
    ? `Para un archivo que ya existe: en ${nube.nombre}, ${nube.comoCopiar}.`
    : "Para un archivo que ya existe: en tu nube —OneDrive, Google Drive, Dropbox, iCloud—, busca Compartir o Copiar enlace y pega aquí la dirección.";
}

/**
 * Cómo nombrar el cuaderno de una materia.
 *
 * El cuaderno de Pauta es un concepto, no un producto: un solo lugar donde
 * se lleva una página por sesión, para no crear un archivo suelto cada
 * vez. OneNote es la forma más común de tenerlo y por eso, cuando la liga
 * es de OneNote, se le llama por su nombre —es lo que espera ver quien lo
 * usa—. Para todo lo demás —un documento largo de Google, Dropbox Paper,
 * Notas de Apple, Notion, Obsidian— el rótulo genérico es el correcto: no
 * hay forma de saber cuál es, y adivinar sería volver al problema de antes.
 */
export const rotuloDeCuaderno = (url) =>
  esCuadernoOneNote(url) ? "Cuaderno de OneNote" : "Cuaderno del curso";
