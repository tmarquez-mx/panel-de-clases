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
   ========================================================= */

import * as local from "./local.js";
import * as archivo from "./archivo.js";

const ESPERA_MS = 600;

/** Marca de tiempo del guardado, para saber qué copia es la más reciente. */
const sellar = (datos) => ({ ...datos, guardadoEn: new Date().toISOString() });
const selloDe = (datos) => {
  const t = Date.parse(datos?.guardadoEn ?? "");
  return Number.isFinite(t) ? t : 0;
};

export function crearGestor({ alCambiarEstado = () => {} } = {}) {
  let manija = null;
  let modo = local.disponible() ? "navegador" : "memoria";
  let necesitaReconectar = false;
  let ultimaHora = null;
  let temporizador = 0;
  let ultimosDatos = null;
  let problemaLocal = "";

  const estado = () => ({
    modo,
    hora: ultimaHora,
    necesitaReconectar,
    nombreArchivo: manija?.name || "",
    soportaArchivo: archivo.soportado(),
    hayManija: !!manija,
  });

  const anunciar = (situacion, detalle = "") =>
    alCambiarEstado({ ...estado(), situacion, detalle });

  /** Guarda de verdad. Nunca lanza: los problemas se informan por el estado. */
  async function guardarAhora(datos) {
    ultimosDatos = datos;
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
        local.escribir(sellados);
        hayCopiaLocal = true;
      } catch (error) {
        problemaLocal =
          error?.name === "QuotaExceededError"
            ? "El almacenamiento del navegador está lleno."
            : "El navegador no dejó guardar la copia local.";
      }
    }

    // Mientras el archivo esté desconectado no se reintenta en cada tecla:
    // solo se escribe la copia local hasta que haya una reconexión explícita.
    if (manija && !necesitaReconectar) {
      try {
        const permiso = await archivo.permiso(manija, false);
        if (permiso !== "granted") throw new Error("sin permiso");
        await archivo.escribir(manija, sellados);
      } catch {
        necesitaReconectar = true;
        modo = hayCopiaLocal ? "navegador" : "memoria";
        anunciar("error", "Se perdió el permiso sobre el archivo vinculado. Reconéctalo desde «Vincular archivo».");
        return;
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
    anunciar("guardado", problemaLocal);
  }

  /** Guardado con espera: agrupa los cambios seguidos en una sola escritura. */
  function programar(datos) {
    ultimosDatos = datos;
    if (modo === "memoria") {
      anunciar("sin-guardar");
      return;
    }
    anunciar("pendiente");
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
      local.escribir(sellar(ultimosDatos));
    } catch {
      /* si no se pudo, no hay nada más que intentar */
    }
  }

  /**
   * Arranque. Devuelve { datos, aviso }.
   * datos es null si no había nada guardado (entonces se usan los de ejemplo).
   */
  async function iniciar() {
    let aviso = "";
    let delArchivo = null;

    if (archivo.soportado()) {
      const guardada = await archivo.recordada();
      if (guardada) {
        manija = guardada;
        try {
          // Al cargar la página no hay gesto del usuario: solo se puede consultar
          // el permiso, no pedirlo. Si está en "prompt", se pide con un clic.
          const permiso = await archivo.permiso(manija, false);
          if (permiso === "granted") {
            delArchivo = await archivo.leer(manija);
            modo = "archivo";
          } else {
            necesitaReconectar = true;
            aviso = `El archivo vinculado (${manija.name}) necesita tu permiso otra vez. Entra a «Vincular archivo» y presiona Reconectar.`;
          }
        } catch {
          necesitaReconectar = true;
          aviso = `No se pudo leer el archivo vinculado (${manija.name}). Se usa la copia del navegador.`;
        }
      }
    }

    const delNavegador = local.leer();

    // Puede haber dos copias: la del archivo y la del navegador (esta última se
    // escribe también al cerrar la pestaña de golpe). Gana la más reciente.
    let datos = delArchivo || delNavegador;
    if (delArchivo && delNavegador && selloDe(delNavegador) > selloDe(delArchivo)) {
      datos = delNavegador;
      aviso = aviso || "La copia de este navegador era más reciente que la del archivo vinculado: se abrió esa. Al primer cambio, el archivo se pone al día.";
    }

    if (modo === "memoria") {
      aviso = aviso || "Este navegador no permite guardar. Todo se pierde al cerrar la pestaña: usa «Guardar respaldo» antes de salir.";
    }

    anunciar(datos ? "cargado" : "vacio");
    return { datos, aviso };
  }

  /** Vincula un archivo nuevo y escribe en él los datos actuales. */
  async function vincularNuevo(datos, nombreSugerido) {
    const nueva = await archivo.elegirNuevo(nombreSugerido);
    if (!nueva) return false;
    manija = nueva;
    modo = "archivo";
    necesitaReconectar = false;
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
    await archivo.recordar(manija);
    anunciar("cargado");
    return contenido;
  }

  /** Vuelve a pedir permiso sobre el archivo ya recordado. Requiere un clic. */
  async function reconectar(validar = () => {}) {
    if (!manija) return null;
    const permiso = await archivo.permiso(manija, true);
    if (permiso !== "granted") throw new Error("No se concedió el permiso sobre el archivo.");
    const contenido = await archivo.leer(manija);
    if (contenido) validar(contenido);
    modo = "archivo";
    necesitaReconectar = false;
    anunciar("cargado");
    return contenido;
  }

  /** Suelta el archivo. Los datos siguen en el navegador. */
  async function desvincular() {
    manija = null;
    necesitaReconectar = false;
    modo = local.disponible() ? "navegador" : "memoria";
    await archivo.olvidar();
    anunciar("guardado");
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
  };
}
