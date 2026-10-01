/* Fechas en formato ISO corto (YYYY-MM-DD), siempre en hora local.
   Se evita new Date("2026-09-08") porque el navegador lo interpreta en UTC
   y la fecha se recorre un día en México. */

export function aFecha(f) {
  if (!f) return null;
  const partes = String(f).split("-").map(Number);
  if (partes.length !== 3 || partes.some((n) => !Number.isFinite(n))) return null;
  const [anio, mes, dia] = partes;
  const d = new Date(anio, mes - 1, dia);
  if (Number.isNaN(d.getTime())) return null;
  // JavaScript normaliza los desbordes en silencio: new Date(2026, 12, 45) da un
  // día válido de 2027. Se comprueba que la fecha construida sea la que se pidió.
  const igual = d.getFullYear() === anio && d.getMonth() === mes - 1 && d.getDate() === dia;
  return igual ? d : null;
}

export function fechaLarga(f) {
  const d = aFecha(f);
  return d
    ? d.toLocaleDateString("es-MX", { weekday: "long", day: "numeric", month: "long", year: "numeric" })
    : "Sin fecha";
}

export function fechaCorta(f) {
  const d = aFecha(f);
  return d ? d.toLocaleDateString("es-MX", { day: "numeric", month: "short" }).replace(".", "") : "sin fecha";
}

/** Suma días a una fecha ISO y devuelve otra fecha ISO. Cadena vacía si no hay fecha. */
export function sumarDias(f, dias) {
  const d = aFecha(f);
  if (!d) return "";
  d.setDate(d.getDate() + dias);
  const dos = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${dos(d.getMonth() + 1)}-${dos(d.getDate())}`;
}

/** Fecha y hora legibles a partir de una marca ISO. Para las copias guardadas. */
export function fechaHoraCorta(iso) {
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? "fecha desconocida"
    : d.toLocaleString("es-MX", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}

/** Hora del reloj, para el indicador de guardado. */
export const horaCorta = (fecha = new Date()) =>
  fecha.toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" });
