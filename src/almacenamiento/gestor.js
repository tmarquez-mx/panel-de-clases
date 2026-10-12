/* =========================================================
   Gestor de almacenamiento: decide dónde se guarda y avisa del estado.

   Tres modos, de más a menos duradero:
     archivo    — hay un .json vinculado en disco (o en la carpeta sincronizada
                  sincronizada). Se escribe ahí y además se deja copia en el
                  navegador, por si el permiso se pierde.
     navegador  — localStorage. Sobrevive a cerrar el navegador, pero vive en
                  esta computadora y en este navegador.
     memoria    — no se puede guardar nada. Solo exportar e importar a mano.

   Esta es la capa que habría que ampliar si algún día entra Microsoft Graph:
   bastaría con agregar un módulo con las mismas funciones (leer, escribir) y
   un modo más aquí, sin tocar las vistas.

   El archivo y el navegador pueden divergir, y por eso hay una regla que
   protege lo escrito.

   El archivo vive en una carpeta que se sincroniza, así que otra computadora
   puede cambiarlo mientras esta pestaña sigue abierta; y el navegador puede
   seguir guardando solo su copia mientras el permiso del archivo está
   caído. Guardar «lo que hay en memoria» sobre el archivo, sin mirar, pisa en
   silencio lo que el otro lado escribió. Antes se hacía así: la pestaña que
   se quedó abierta el martes borraba el trabajo del miércoles, y la app
   decía «guardado».

   Para distinguir quién cambió qué se recuerda la BASE: el sello de la
   última versión en que el archivo y este navegador coincidieron. Si el
   archivo se apartó de ella, cambió afuera; si el navegador se apartó,
   cambió aquí; si se apartaron los dos, hay un conflicto y decide la
   usuaria. Solo se comparan sellos por IGUALDAD, nunca por orden: cada
   sello viene del reloj de una computadora distinta, y con relojes
   desajustados el más reciente puede parecer el más viejo.
   ========================================================= */

import * as local from "./local.js";
import * as archivo from "./archivo.js";

const ESPERA_MS = 600;

/* Marca de tiempo del guardado. Sirve para reconocer una versión, no solo
   para ordenarla: como se compara por igualdad, dos guardados no pueden
   compartir sello. Con el reloj a milisegundos dos guardados seguidos podían
   caer en el mismo, y entonces «esta pestaña cambió» se confundía con «nada
   cambió». Por eso cada sello es estrictamente mayor que el anterior. */
let ultimoSello = 0;
const sellar = (datos) => {
  const t = Math.max(Date.now(), ultimoSello + 1);
  ultimoSello = t;
  return { ...datos, guardadoEn: new Date(t).toISOString() };
};
const selloDe = (datos) => {
  const t = Date.parse(datos?.guardadoEn ?? "");
  return Number.isFinite(t) ? t : 0;
};

const MENSAJE_CONFLICTO =
  "Otra computadora, u otra pestaña, cambió tu archivo mientras tenías Pauta abierta. No se guardó nada en él para no pisar esos cambios. Los tuyos están a salvo en este navegador.";

const AVISO_NAVEGADOR_MAS_RECIENTE =
  "La copia de este navegador era más reciente que la de tu archivo: se abrió esa. Al primer cambio, el archivo se pone al día.";

/* Cuánto se espera entre un intento de escritura y el siguiente cuando el
   archivo está ocupado. Suman unos dos segundos y medio: lo que tarda un
   cliente de nube en soltarlo, no más, para no retener el guardado. */
const ESPERAS_DE_REINTENTO_MS = [250, 750, 1500];
const esperar = (ms) => new Promise((resolver) => window.setTimeout(resolver, ms));

/* Cuánto se espera al abrir la página antes de dar por «tardando» lo que se
   pidió. Sin límite, un archivo que la nube todavía está descargando —o un
   IndexedDB que no contesta— dejaba a Pauta vacía y muda para siempre. */
const ESPERA_MANIJA_MS = 5000;
const ESPERA_ARCHIVO_MS = 10000;

/** Rechaza con un error «TimeoutError» si la promesa no se resuelve a tiempo. */
const conLimite = (promesa, ms) =>
  new Promise((resolver, rechazar) => {
    const reloj = window.setTimeout(
      () => rechazar(Object.assign(new Error("tiempo agotado"), { name: "TimeoutError" })),
      ms
    );
    promesa.then(
      (valor) => { window.clearTimeout(reloj); resolver(valor); },
      (error) => { window.clearTimeout(reloj); rechazar(error); }
    );
  });

/** Mensajes de un fallo de escritura que NO obliga a reconectar. */
const MENSAJE_DE_ESCRITURA = {
  ocupado:
    "No se pudo escribir en tu archivo porque está en uso —a veces pasa mientras la nube lo sincroniza—. Tus cambios están a salvo en este navegador y se reintentará en el siguiente cambio.",
  disco:
    "No se pudo escribir en tu archivo: el disco parece estar lleno. Tus cambios están a salvo en este navegador; libera espacio y se reintentará en el siguiente cambio.",
  otro:
    "No se pudo escribir en tu archivo. Tus cambios están a salvo en este navegador y se reintentará en el siguiente cambio. Si sigue igual, entra a «Mis datos».",
};

export function crearGestor({
  alCambiarEstado = () => {},
  esperasDeReintentoMs = ESPERAS_DE_REINTENTO_MS,
  esperaManijaMs = ESPERA_MANIJA_MS,
  esperaArchivoMs = ESPERA_ARCHIVO_MS,
} = {}) {
  let manija = null;
  let modo = local.disponible() ? "navegador" : "memoria";
  let necesitaReconectar = false;
  let ultimaHora = null;
  let temporizador = 0;
  let ultimosDatos = null;
  let problemaLocal = "";

  /* Cuántas copias de seguridad hubo que soltar para poder guardar, en lo que
     va de la sesión. El aviso no se apaga en el siguiente guardado: quien
     tiene datos muy grandes debe saber que tiene menos copias de las
     habituales mientras dure, no enterarse el día que necesite una. */
  let copiasSoltadas = 0;

  /* Sincronía con el archivo. `base` es null mientras no se sepa; `conflicto`
     guarda lo que el archivo trae ahora, para mostrarlo y para archivarlo
     antes de sobrescribirlo; `confiarEnDisco` deja que UNA escritura pase sin
     comprobar, cuando la usuaria ya decidió pisar el archivo a propósito. */
  let base = local.leerBase();
  let conflicto = null;
  let confiarEnDisco = false;

  let enCurso = null;
  let repetir = false;

  /* De dónde vinieron los datos con que se abrió la página. Si vinieron del
     archivo y luego resultan inservibles, ese archivo no debe recibir
     escrituras hasta que se resuelva. */
  let deArchivoLaUltimaLectura = false;

  const estado = () => ({
    modo,
    hora: ultimaHora,
    necesitaReconectar,
    nombreArchivo: manija?.name || "",
    soportaArchivo: archivo.soportado(),
    hayManija: !!manija,
    hayConflicto: !!conflicto,
  });

  const anunciar = (situacion, detalle = "", extra = {}) =>
    alCambiarEstado({ ...estado(), situacion, detalle, ...extra });

  function fijarBase(sello) {
    base = sello;
    local.escribirBase(sello);
  }

  /** Lee el archivo y dice si sigue siendo la versión que este navegador conoce. */
  async function revisarArchivo() {
    let contenido;
    try {
      contenido = await archivo.leer(manija);
    } catch (error) {
      // Sin permiso o sin archivo no es «ilegible un instante»: es otra cosa
      // y quien guarda debe tratarla como tal.
      const tipo = archivo.clasificarError(error);
      if (tipo === "permiso" || tipo === "no-existe") throw error;
      return { estado: "ilegible" };
    }
    const sello = selloDe(contenido);
    // Sin base no hay contra qué comparar: se adopta lo que hay.
    if (base === null || sello === base) return { estado: "igual" };
    return { estado: "cambio", sello, contenido };
  }

  /** Escribe en el archivo, reintentando solo si está ocupado. */
  async function escribirEnElArchivo(sellados) {
    for (let intento = 0; ; intento++) {
      try {
        await archivo.escribir(manija, sellados);
        return;
      } catch (error) {
        const espera = esperasDeReintentoMs[intento];
        if (archivo.clasificarError(error) !== "ocupado" || espera === undefined) throw error;
        await esperar(espera);
      }
    }
  }

  /** Una pasada de guardado. Nunca lanza: los problemas se informan por el estado. */
  async function guardarUnaVez(datos) {
    window.clearTimeout(temporizador);
    temporizador = 0;

    if (modo === "memoria") {
      anunciar("sin-guardar");
      return;
    }

    anunciar("guardando");
    const sellados = sellar(datos);

    // Copia en el navegador: rápida y sirve de red de seguridad.
    problemaLocal = "";
    let hayCopiaLocal = false;
    if (local.disponible()) {
      try {
        // No es un fallo si suelta copias: el guardado salió bien.
        copiasSoltadas += local.escribirConEspacio(sellados);
        hayCopiaLocal = true;
      } catch (error) {
        problemaLocal =
          error?.name === "QuotaExceededError"
            ? "El almacenamiento del navegador está lleno, incluso sin versiones anteriores, y lo último que hiciste no se pudo guardar aquí. Entra a «Mis datos» y descárgalos, o guárdalos en un archivo, para no perderlo."
            : "El navegador no dejó guardar la copia local.";
      }
    }
    // Se compone después de escribir, con la cuenta ya al día.
    if (hayCopiaLocal && copiasSoltadas) {
      problemaLocal = `El almacenamiento del navegador está casi lleno: para poder guardar se han soltado ${copiasSoltadas} copia${copiasSoltadas === 1 ? "" : "s"} de seguridad antigua${copiasSoltadas === 1 ? "" : "s"}, así que hay menos de las habituales.`;
    }

    // Mientras el archivo esté desconectado no se reintenta en cada tecla:
    // solo se escribe la copia local hasta que haya una reconexión explícita.
    let archivoIntacto = false;
    if (manija && !necesitaReconectar) {
      if (conflicto) {
        // Hay una decisión pendiente: el archivo no se toca hasta que se tome.
        archivoIntacto = true;
      } else {
        try {
          const permiso = await archivo.permiso(manija, false);
          if (permiso !== "granted") throw Object.assign(new Error("sin permiso"), { name: "NotAllowedError" });

          if (confiarEnDisco) {
            confiarEnDisco = false;
          } else {
            const revision = await revisarArchivo();
            if (revision.estado === "ilegible") {
              // No poder leerlo no es lo mismo que no tener permiso: a lo mejor
              // la nube lo está sincronizando en este instante. No se pisa a
              // ciegas y tampoco se abandona el archivo: se reintenta luego.
              anunciar(
                "error",
                "No se pudo leer tu archivo para comprobar que nadie más lo cambió, así que no se guardó nada en él. Tus cambios están a salvo en este navegador y se reintentará en el siguiente cambio."
              );
              return;
            }
            if (revision.estado === "cambio") {
              conflicto = { sello: revision.sello, contenido: revision.contenido };
              anunciar("conflicto", MENSAJE_CONFLICTO, { abrirDialogo: true });
              return;
            }
          }

          await escribirEnElArchivo(sellados);
          fijarBase(selloDe(sellados));
        } catch (error) {
          /* Antes cualquier fallo se tomaba por «se perdió el permiso»: se
             marcaba el archivo como desconectado y no se volvía a escribir en
             él hasta reconectar a mano. Un solo bloqueo pasajero bastaba, y
             aunque el archivo quedara libre al instante, los guardados
             siguientes no le llegaban: la otra computadora veía un archivo
             congelado. Ahora solo se desconecta cuando de verdad falta el
             permiso o el archivo ya no existe; lo demás se reintenta. */
          const tipo = archivo.clasificarError(error);

          if (tipo === "permiso" || tipo === "no-existe") {
            necesitaReconectar = true;
            modo = hayCopiaLocal ? "navegador" : "memoria";
          }

          // Si tampoco se pudo guardar la copia local, «a salvo» no sería
          // verdad: el mensaje tiene que decir que hay que respaldar a mano.
          if (!hayCopiaLocal) {
            anunciar(
              "error",
              "No se pudo escribir en tu archivo ni guardar la copia en este navegador. Entra a «Mis datos» y usa «Descargar mis datos» ahora para no perder lo que llevas."
            );
          } else if (tipo === "permiso") {
            anunciar("error", "Se perdió el permiso sobre tu archivo. Reconéctalo desde «Mis datos».");
          } else if (tipo === "no-existe") {
            anunciar(
              "error",
              "Tu archivo ya no está donde estaba: quizá lo movieron o lo borraron. Tus cambios están a salvo en este navegador. Entra a «Mis datos» y elige otro archivo o crea uno nuevo."
            );
          } else {
            anunciar("error", MENSAJE_DE_ESCRITURA[tipo] || MENSAJE_DE_ESCRITURA.otro);
          }
          return;
        }
      }
    }

    if (!hayCopiaLocal && !manija) {
      anunciar("error", problemaLocal || "No se pudo guardar.");
      return;
    }

    ultimaHora = new Date();

    // Copia de seguridad mientras se trabaja. No es con cada dato capturado:
    // se toma como mucho una cada pocos minutos, para que las ranuras no se
    // llenen de versiones casi idénticas de hace un rato y siga siendo
    // posible volver a ayer. Nunca estorba al guardado, que ya ocurrió.
    local.archivarCopia(datos, "mientras trabajabas", local.MINUTOS_ENTRE_COPIAS);

    // Si mientras se escribía entró otro cambio, el rótulo lo dice el nuevo aviso.
    if (temporizador) return;
    if (archivoIntacto) {
      anunciar("conflicto", MENSAJE_CONFLICTO);
      return;
    }
    anunciar("guardado", problemaLocal);
  }

  /**
   * Guarda de verdad, ya. Las llamadas que llegan mientras otra sigue en
   * curso no arrancan una escritura paralela al mismo archivo: se anotan y,
   * al terminar la actual, se hace UNA más con los datos más nuevos. Dos
   * flujos de escritura abiertos a la vez sobre el mismo archivo dejan que el
   * que cierra último se quede con el archivo, sea o no el más nuevo.
   */
  function guardarAhora(datos) {
    ultimosDatos = datos;
    if (enCurso) {
      repetir = true;
      return enCurso;
    }
    enCurso = (async () => {
      do {
        repetir = false;
        await guardarUnaVez(ultimosDatos);
      } while (repetir);
    })().finally(() => {
      enCurso = null;
    });
    return enCurso;
  }

  /** Guardado con espera: agrupa los cambios seguidos en una sola escritura. */
  function programar(datos) {
    ultimosDatos = datos;
    if (modo === "memoria") {
      anunciar("sin-guardar");
      return;
    }
    // Con una decisión pendiente el rótulo no debe volver a decir «guardado».
    if (conflicto) anunciar("conflicto", MENSAJE_CONFLICTO);
    else anunciar("pendiente");
    window.clearTimeout(temporizador);
    temporizador = window.setTimeout(() => {
      guardarAhora(datos).catch(() => anunciar("error", "No se pudo guardar."));
    }, ESPERA_MS);
  }

  /** Escritura inmediata y síncrona, solo al navegador. Para cuando la pestaña
   *  se va a cerrar: ahí ya no hay tiempo para operaciones asíncronas. */
  function guardarAlSalir() {
    if (!temporizador || !ultimosDatos || !local.disponible()) return;
    try {
      local.escribirConEspacio(sellar(ultimosDatos));
    } catch {
      /* si no se pudo, no hay nada más que intentar */
    }
  }

  /**
   * Arranque. Devuelve { datos, aviso, hayConflicto }.
   * datos es null si no había nada guardado (entonces se usan los de ejemplo).
   */
  async function iniciar() {
    let aviso = "";
    let delArchivo = null;
    let leyoElArchivo = false;

    if (archivo.soportado()) {
      anunciar("abriendo"); // la pantalla dice qué se está esperando, en vez de quedarse vacía

      let noSePudoConsultar = false;
      const guardada = await conLimite(archivo.recordada(), esperaManijaMs).catch(() => {
        noSePudoConsultar = true;
        return null;
      });
      if (noSePudoConsultar) {
        aviso =
          "No se pudo comprobar si guardabas en un archivo: el navegador tardó demasiado en responder. Se abrió la copia de este navegador. Si usabas un archivo, vuelve a cargar la página.";
      }

      if (guardada) {
        manija = guardada;
        try {
          // Al cargar la página no hay gesto del usuario: solo se puede consultar
          // el permiso, no pedirlo. Si está en "prompt", se pide con un clic.
          const permiso = await archivo.permiso(manija, false);
          if (permiso === "granted") {
            delArchivo = await conLimite(archivo.leer(manija), esperaArchivoMs);
            modo = "archivo";
            leyoElArchivo = true;
          } else {
            necesitaReconectar = true;
            aviso = `Tu archivo (${manija.name}) necesita tu permiso otra vez. Entra a «Mis datos» y presiona Reconectar.`;
          }
        } catch (error) {
          necesitaReconectar = true;
          /* Tardar no es lo mismo que fallar. Un archivo «solo en línea» puede
             estar descargándose, y entonces basta con esperar y reconectar; la
             copia del navegador se abre mientras tanto y, como el archivo no
             se leyó, no se escribe nada en él hasta reconectar. */
          aviso =
            error?.name === "TimeoutError"
              ? `Tu archivo (${manija.name}) tardó demasiado en responder —quizá la nube lo está descargando—. Se abrió la copia de este navegador; cuando el archivo esté disponible, entra a «Mis datos» y presiona Reconectar.`
              : `No se pudo leer tu archivo (${manija.name}). Se usa la copia del navegador.`;
        }
      }
    }

    const guardadoLocal = local.leerConEstado();
    const delNavegador = guardadoLocal.datos;
    let datos = delArchivo || delNavegador;
    let hayConflicto = false;
    deArchivoLaUltimaLectura = !!delArchivo;

    /* Guardado dañado y ninguna otra fuente: se abrirán los datos de ejemplo.
       Antes salía en silencio y el primer cambio sobrescribía lo dañado, sin
       dejar rastro. Ahora se conserva aparte y se le dice a la usuaria qué
       hacer, empezando por lo que ya tiene guardado. */
    if (!datos && guardadoLocal.estado === "danado") {
      const aSalvo = local.conservarDanado(guardadoLocal.crudo);
      const copias = local.leerCopias().length;
      const explicacion =
        "Lo guardado en este navegador está dañado y no se pudo leer, así que se abrieron los datos de ejemplo. " +
        (aSalvo
          ? "Lo dañado se conservó aparte, sin tocarlo, y puedes descargarlo desde «Mis datos». "
          : "No se pudo conservar aparte lo dañado. ") +
        (copias
          ? `Hay ${copias} ${copias === 1 ? "versión anterior" : "versiones anteriores"}: entra a «Mis datos» y restaura la más reciente antes de hacer cambios.`
          : "Si tienes tus datos descargados, cárgalos desde «Mis datos» antes de hacer cambios.");
      aviso = aviso ? `${aviso}\n\n${explicacion}` : explicacion;
    }

    if (leyoElArchivo && !delArchivo) {
      // Archivo vacío: no hay nada que proteger en él.
      fijarBase(0);
    } else if (leyoElArchivo) {
      const delSello = selloDe(delArchivo);
      const haySelloLocal = !!delNavegador;
      const localSello = selloDe(delNavegador);

      if (base === null) {
        // Sin historia de sincronía: se decide por el sello, como siempre,
        // y desde aquí se lleva la cuenta.
        if (haySelloLocal && localSello > delSello) {
          datos = delNavegador;
          aviso = aviso || AVISO_NAVEGADOR_MAS_RECIENTE;
        }
        fijarBase(delSello);
      } else {
        const cambioAfuera = delSello !== base;
        const cambioAqui = haySelloLocal && localSello !== base;

        if (cambioAfuera && cambioAqui) {
          // Los dos se apartaron de la última versión común. Se abre con lo de
          // esta pestaña, que es lo que la usuaria reconoce como suyo, y el
          // archivo no se toca hasta que decida.
          datos = delNavegador;
          conflicto = { sello: delSello, contenido: delArchivo };
          hayConflicto = true;
        } else if (cambioAqui) {
          datos = delNavegador;
          aviso = aviso || AVISO_NAVEGADOR_MAS_RECIENTE;
        } else {
          datos = delArchivo;
          fijarBase(delSello);
        }
      }
    }

    if (hayConflicto) anunciar("conflicto", MENSAJE_CONFLICTO);
    else anunciar(datos ? "cargado" : "vacio");
    return { datos, aviso, hayConflicto };
  }

  /** Vincula un archivo nuevo y escribe en él los datos actuales. */
  async function vincularNuevo(datos, nombreSugerido) {
    const nueva = await archivo.elegirNuevo(nombreSugerido);
    if (!nueva) return false;
    manija = nueva;
    modo = "archivo";
    necesitaReconectar = false;
    conflicto = null;
    // La usuaria eligió ese archivo, y el sistema ya le preguntó si quería
    // reemplazarlo si existía: esta primera escritura no compara nada.
    base = null;
    local.borrarBase();
    confiarEnDisco = true;
    await archivo.recordar(manija);
    await guardarAhora(datos);
    return true;
  }

  /**
   * Abre un archivo existente y lo vincula. `validar` recibe el contenido crudo
   * y debe lanzar si no es un respaldo: el archivo NO se adopta como destino de
   * guardado hasta que pasa esa prueba, para no machacar un archivo equivocado.
   * Devuelve el contenido, o null si se canceló.
   */
  async function abrirExistente(validar = () => {}) {
    const nueva = await archivo.elegirExistente();
    if (!nueva) return null;

    // Si algo de esto falla, la excepción sale sin haber tocado el vínculo
    // anterior: el archivo equivocado nunca se vuelve destino de guardado.
    const permiso = await archivo.permiso(nueva, true);
    if (permiso !== "granted") throw new Error("No diste permiso de escritura sobre ese archivo.");
    const contenido = await archivo.leer(nueva);
    if (contenido) validar(contenido); // un archivo vacío sí se puede adoptar

    manija = nueva;
    modo = "archivo";
    necesitaReconectar = false;
    conflicto = null;
    fijarBase(selloDe(contenido)); // lo que se acaba de leer es el punto de partida
    await archivo.recordar(manija);
    anunciar("cargado");
    return contenido;
  }

  /**
   * Vuelve a pedir permiso sobre el archivo ya recordado. Requiere un clic.
   *
   * Mientras el permiso estuvo caído el navegador siguió guardando solo su
   * copia, y el archivo pudo cambiar afuera. Antes se cargaba siempre lo que
   * hubiera en el archivo, y todo lo escrito sin permiso desaparecía: sin
   * que interviniera ninguna otra computadora. Ahora se compara con la base.
   *
   * Devuelve el contenido del archivo SOLO cuando hay que cargarlo; si lo que
   * hay en memoria es lo más nuevo se escribe en el archivo y devuelve null.
   * `datosActuales` son los datos de la pestaña, por si hay que escribirlos.
   */
  async function reconectar(validar = () => {}, datosActuales = null) {
    if (!manija) return null;
    const permiso = await archivo.permiso(manija, true);
    if (permiso !== "granted") throw new Error("No se concedió el permiso sobre el archivo.");
    const contenido = await archivo.leer(manija);
    if (contenido) validar(contenido);

    modo = "archivo";
    necesitaReconectar = false;

    const delSello = selloDe(contenido);
    const delNavegador = local.leer();
    const haySelloLocal = !!delNavegador;
    const localSello = selloDe(delNavegador);
    let cargar = false;
    let empujar = false;

    if (!contenido) {
      // Archivo vacío: nada que proteger, se escribe lo que hay.
      fijarBase(0);
      empujar = true;
    } else if (base === null) {
      if (haySelloLocal && localSello > delSello) empujar = true;
      else cargar = true;
      fijarBase(delSello);
    } else {
      const cambioAfuera = delSello !== base;
      const cambioAqui = haySelloLocal && localSello !== base;

      if (cambioAfuera && cambioAqui) {
        conflicto = { sello: delSello, contenido };
        anunciar("conflicto", MENSAJE_CONFLICTO, { abrirDialogo: true });
        return null;
      }
      if (cambioAqui) {
        empujar = true; // solo cambió esta pestaña, mientras estaba desconectada
      } else if (cambioAfuera) {
        cargar = true; // solo cambió el archivo: no hay nada propio que perder
        fijarBase(delSello);
      }
      // Ni uno ni otro: ya coinciden, no hay nada que cargar ni que escribir.
    }

    anunciar("cargado");
    if (empujar) await guardarAhora(datosActuales || ultimosDatos || delNavegador);
    return cargar ? contenido : null;
  }

  /**
   * Los datos leídos no sirven: migrar() los rechazó. Se conservan aparte y,
   * si venían del archivo vinculado, ese archivo deja de recibir escrituras:
   * antes se decía «nada se ha sobrescrito todavía» y el primer cambio
   * sobrescribía el archivo con los datos de ejemplo. Devuelve si lo
   * rechazado quedó a salvo.
   */
  function lecturaInvalida(crudos) {
    let texto = null;
    try {
      texto = typeof crudos === "string" ? crudos : JSON.stringify(crudos);
    } catch {
      /* no se puede convertir a texto: no hay nada que conservar */
    }
    const aSalvo = !!texto && local.conservarDanado(texto);
    if (deArchivoLaUltimaLectura && manija && modo === "archivo") {
      necesitaReconectar = true;
      modo = local.disponible() ? "navegador" : "memoria";
    }
    return aSalvo;
  }

  /** Suelta el archivo. Los datos siguen en el navegador. */
  async function desvincular() {
    manija = null;
    necesitaReconectar = false;
    conflicto = null;
    confiarEnDisco = false;
    base = null;
    local.borrarBase();
    modo = local.disponible() ? "navegador" : "memoria";
    await archivo.olvidar();
    anunciar("guardado");
  }

  /* ---------- Resolver un conflicto ---------- */

  /** Lo que el archivo trae ahora, tal cual, para archivarlo o cargarlo. */
  const contenidoEnConflicto = () => conflicto?.contenido ?? null;

  /** Datos para explicarle a la usuaria de qué se trata, sin mostrarle un JSON. */
  function detalleDeConflicto() {
    if (!conflicto) return null;
    const materias = Array.isArray(conflicto.contenido?.materias) ? conflicto.contenido.materias : [];
    const sesiones = materias.reduce((n, m) => n + (Array.isArray(m?.sesiones) ? m.sesiones.length : 0), 0);
    return {
      cuando: conflicto.sello ? new Date(conflicto.sello) : null,
      materias: materias.length,
      sesiones,
      nombreArchivo: manija?.name || "",
    };
  }

  /** Se queda con la versión del archivo. Devuelve su contenido para cargarlo. */
  function usarArchivo() {
    if (!conflicto) return null;
    const { sello, contenido } = conflicto;
    fijarBase(sello); // la versión del archivo pasa a ser el punto de partida
    conflicto = null;
    return contenido;
  }

  /** Se queda con la de esta pestaña: la escribe encima, a propósito. */
  async function guardarLaMia(datos) {
    conflicto = null;
    confiarEnDisco = true;
    await guardarAhora(datos);
  }

  return {
    estado,
    iniciar,
    programar,
    guardarAhora,
    guardarAlSalir,
    vincularNuevo,
    abrirExistente,
    reconectar,
    desvincular,
    contenidoEnConflicto,
    detalleDeConflicto,
    usarArchivo,
    guardarLaMia,
    lecturaInvalida,
  };
}
