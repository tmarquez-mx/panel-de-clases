/* =========================================================
   Aviso de mudanza.

   El panel cambió de dirección. Quien tenga la liga anterior llega aquí
   reenviado, pero el almacenamiento del navegador está atado al origen: lo
   que guardó allá no viaja. Vería el panel vacío y concluiría, con razón
   aparente, que perdió su planeación.

   El aviso vive aquí y no en la dirección vieja a propósito: aparece en el
   momento exacto de la confusión, cuando ya está mirando el panel vacío, en
   vez de en una página de paso que se cierra sin leer.

   Se muestra una vez por navegador. Cuando pase el semestre y ya nadie
   venga de la dirección anterior, basta con quitar el montaje de main.js.
   ========================================================= */

import { $ } from "../util/dom.js";

const CLAVE = "panel-de-clases:mudanza-vista";

/** Dirección anterior, solo para que la usuaria pueda volver a exportar. */
export const DIRECCION_ANTERIOR = "https://panel-de-clases.netlify.app";

export function montarMudanza() {
  const caja = $("#mudanza");
  if (!caja) return;

  let yaVisto = false;
  try {
    yaVisto = window.localStorage.getItem(CLAVE) === "1";
  } catch {
    // Sin almacenamiento no hay nada que se haya podido perder al mudarse,
    // y tampoco podríamos recordar que ya se cerró: mejor no mostrarlo.
    yaVisto = true;
  }
  if (yaVisto) return;

  $("#mudanza-vieja").textContent = DIRECCION_ANTERIOR.replace(/^https?:\/\//, "");
  $("#mudanza-ir").href = DIRECCION_ANTERIOR;
  caja.hidden = false;

  const cerrar = () => {
    caja.hidden = true;
    try {
      window.localStorage.setItem(CLAVE, "1");
    } catch {
      /* sin memoria: volverá a aparecer, que es lo menos malo */
    }
  };

  $("#mudanza-cerrar").addEventListener("click", cerrar);
  // Ir a exportar cuenta como haberlo leído.
  $("#mudanza-ir").addEventListener("click", cerrar);
}
