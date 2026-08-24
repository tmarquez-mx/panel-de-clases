# Artefacto epistémico: panel de clases

Organiza los materiales de cada curso por materia y por sesión, y durante la clase
deja avanzar recurso por recurso sin buscar nada.

Todo corre en el navegador. No hay servidor, no hay cuentas, no hay analítica y
ningún dato sale de tu computadora.

---

## Instalar y correr

Hace falta [Node.js](https://nodejs.org) 18 o más nuevo. Una sola vez:

```bash
npm install
```

Para trabajar en el código, con recarga automática:

```bash
npm run dev
```

Abre la dirección que imprime la terminal (normalmente `http://localhost:5173`).

Para generar la versión final:

```bash
npm run build
```

Queda un solo archivo, `dist/index.html`, con el CSS y el JavaScript adentro.
Ese archivo es todo lo que hay que publicar o copiar.

Para revisar la versión final antes de publicarla:

```bash
npm run preview
```

### Dependencias

Una sola, y solo para construir: **Vite**. No hay ninguna biblioteca en la página
publicada. No hay React, ni Vue, ni Tailwind, ni fuentes web externas: el panel
abre igual sin conexión. El código es JavaScript de siempre, con módulos ES.

El empaquetado en un solo archivo lo hace un plugin propio de veinte líneas,
escrito dentro de `vite.config.js`, en lugar de agregar una dependencia más.

---

## Dónde está publicado

**https://panel-de-clases.netlify.app**

Ahí vive la versión en línea, en la cuenta de Netlify del proyecto `panel-de-clases`.
El sitio es un solo archivo: `dist/index.html`. Nada más se sube, y nada de lo que
escribas en el panel viaja al servidor: todo se queda en el navegador de quien lo abre.

Conviene usarlo desde esa dirección y no con doble clic, porque al estar servido por
`https` sí funcionan **Vincular archivo** (guardar en un .json de tu OneDrive
sincronizado) y **Pegar**, que el navegador bloquea en las páginas locales.

El código vive en **https://github.com/tmarquez-mx/panel-de-clases**, y el sitio está
conectado a ese repositorio: **cada `git push` a `main` reconstruye y publica solo.**
No hay que arrastrar carpetas ni tocar el tablero de Netlify.

```bash
git add -A && git commit -m "lo que cambiaste" && git push
```

En un minuto el cambio está en línea. El avance se ve en
https://app.netlify.com/projects/panel-de-clases/deploys, y si una construcción falla,
el sitio anterior se queda publicado: no se cae.

Los ajustes de construcción no están en el tablero sino en `netlify.toml`, dentro del
repositorio: comando (`npm run build`), carpeta publicada (`dist`) y versión de Node.
Así el despliegue es reproducible y cualquier cambio queda en la historia de git.

## Publicar en GitHub Pages

1. Sube el proyecto a un repositorio (revisa antes la sección de privacidad).
2. `npm run build`.
3. Publica el contenido de `dist/` en la rama `gh-pages`, o activa Pages sobre la
   carpeta `docs/` y copia ahí `dist/index.html`.
4. En **Settings → Pages**, elige esa rama o carpeta.

El proyecto usa rutas relativas (`base: "./"`), así que funciona igual en
`usuaria.github.io/panel-de-clases/` que en la raíz del dominio.

Con GitHub Actions, un flujo mínimo:

```yaml
name: Publicar
on:
  push:
    branches: [main]
permissions:
  contents: read
  pages: write
  id-token: write
jobs:
  publicar:
    runs-on: ubuntu-latest
    environment: github-pages
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 20, cache: npm }
      - run: npm ci
      - run: npm run build
      - uses: actions/upload-pages-artifact@v3
        with: { path: dist }
      - uses: actions/deploy-pages@v4
```

---

## Cómo se guarda tu trabajo

El panel guarda solo, con cada cambio. Arriba a la derecha, junto a los botones,
siempre dice dónde y a qué hora guardó por última vez.

Hay tres modos, de más a menos duradero:

| Modo | Cuándo entra | Qué significa |
|---|---|---|
| **Archivo** | Chrome o Edge, servido por `https` o `localhost`, y tú vinculaste un archivo | Cada cambio se escribe en tu archivo `.json`. Además queda copia en el navegador. |
| **Navegador** | El caso normal en cualquier navegador | Se guarda en el almacenamiento del navegador (`localStorage`). Sobrevive a cerrar la ventana, pero vive solo en esa computadora y ese navegador. |
| **Memoria** | El navegador no permite almacenamiento (Safari en navegación privada, algunos casos de `file://`) | No se guarda nada. El panel lo dice con todas sus letras y hay que exportar un respaldo antes de cerrar. |

Cada guardado deja en los datos un campo `guardadoEn` con la fecha y la hora. Sirve
para una sola cosa: si al abrir hay copia en el archivo y copia en el navegador (por
ejemplo porque cerraste la pestaña de golpe y solo dio tiempo de escribir en el
navegador), el panel abre la más reciente y te lo dice.

### Vincular un archivo (Chrome y Edge)

El botón **Vincular archivo** usa la File System Access API. Sirve para escribir
directamente en un `.json` del disco; si ese archivo está en tu carpeta de OneDrive
sincronizada, el respaldo viaja solo a tus demás computadoras.

- Solo existe hoy en Chrome y Edge, y solo en contexto seguro (`https` o `localhost`).
  En Firefox y en Safari el botón queda desactivado y explica por qué.
- El navegador recuerda el archivo entre sesiones, pero cada tanto vuelve a pedir
  permiso. Cuando pasa, el indicador dice «Archivo desconectado» y se reconecta desde
  el mismo botón, con **Abrir archivo existente**.
- El vínculo se recuerda en IndexedDB. Es lo único para lo que se usa.

### Qué se pierde al abrir con doble clic (`file://`)

El panel abre y funciona: se ven las materias, se edita, se entra a modo clase.
Pero el navegador aplica restricciones a las páginas locales:

- **No hay «Vincular archivo»**: la File System Access API exige contexto seguro.
- **El guardado automático puede no estar**: Chrome sí permite `localStorage` en
  `file://`, Safari no. Si no está, el panel entra en modo memoria y lo avisa.
- **Copiar y pegar puede fallar**: el portapapeles también exige contexto seguro.
  Si el navegador lo bloquea, el panel ofrece copiar a mano.

Si vas a trabajar así, exporta un respaldo al terminar. Para uso diario conviene
más publicar el panel en GitHub Pages y abrirlo desde ahí.

---

## El orden de los recursos

El orden de la lista es el orden del modo clase. Se fija de dos maneras, y las dos
conviven:

- **Por los minutos.** Si el campo «Momento de la sesión» empieza con un tiempo
  (`0:15–0:40`, `1:05`, `45`), el recurso se acomoda solo en ese punto de la clase en
  cuanto guardas. Cambiar los minutos de un recurso lo mueve al lugar que le toca.
- **A mano.** Los botones Subir y Bajar mueven cualquier recurso. Ese orden se
  respeta: solo se rehace cuando vuelves a cambiar los minutos de algún recurso.
- **A pedido.** El botón **Ordenar por minutos** acomoda toda la sesión de una vez.
  Sirve cuando importaste un respaldo desordenado o cuando los movimientos a mano ya
  no corresponden con los tiempos. Si ya estaba en orden, lo dice y no toca nada.

**Mover a otra sesión.** Cada recurso tiene un botón «Mover a…» que lo pasa a otra
sesión de la misma materia, con su liga, su nota y su estado. Cae en el lugar que le
toca por sus minutos, sin descolocar el orden que esa sesión ya tenía.

Lo que no lleva minuto («previa», «referencia», «cierre») no se va al final: se queda
pegado al recurso con minuto al que sigue, y viaja con él. Lo que está antes de
cualquier minuto se queda al principio.

---

## Respaldos, plantillas y exportación

- **Guardar respaldo**: descarga todo el panel como `panel-de-clases.json`.
- **Importar respaldo**: carga un respaldo. Valida la estructura antes de tocar nada,
  dice cuántas materias y sesiones trae y pide confirmación, porque sustituye todo.
  Acepta también los respaldos del prototipo anterior: se les completan los campos
  nuevos con valores por omisión.
- **Exportar a Markdown**: la materia activa completa, con sesiones, fechas, propósito,
  recursos con liga y nota, y bitácora.
- **Plantilla del curso**: la misma materia **sin ligas y sin bitácoras**, para
  compartirla con colegas sin filtrar tus URLs privadas. Sirve para dos cosas: pasarle
  a alguien más el esqueleto de un curso (sesiones, fechas, títulos, propósitos, y qué
  recursos van en qué momento, con la nota de para qué sirve cada uno) para que ponga
  sus propios archivos; y arrancar tú misma un curso nuevo a partir de otro, importando
  la plantilla y colgándole las ligas del semestre en turno. Es un respaldo normal, así
  que se abre con «Importar respaldo».
- **Imprimir guion**: `Ctrl/Cmd + P` sobre la sesión abierta produce un guion de papel
  sin botones ni interfaz. Desde la vista de semestre, imprime el temario.

### Copias de seguridad automáticas

Además del guardado normal, el panel archiva por su cuenta las **últimas tres
versiones distintas**: una al abrir, y una antes de cada operación que sustituye todo
(importar un respaldo, abrir otro archivo vinculado, restaurar una copia). Se ven y se
restauran desde el botón **Vincular archivo**, al final de esa ventana.

Es una red contra el error que no tiene vuelta: importar el respaldo equivocado encima
del bueno. No sustituye a los respaldos en archivo, porque vive en el mismo navegador:
si se borra el almacenamiento, se van con él.

### Deshacer

Eliminar un recurso, una sesión o una materia se puede deshacer. Abajo a la izquierda
aparece un aviso con el botón **Deshacer** durante unos segundos, y devuelve todo al
momento exacto anterior al borrado. Es una sola marcha atrás, para el arrepentimiento
inmediato: para ir más lejos están las copias de seguridad y los respaldos.

---

## Privacidad

**Tus ligas de OneDrive y de SharePoint llevan claves de uso compartido y apuntan a
tu cuenta institucional. Un respaldo publicado es una llave publicada.**

- El `.gitignore` excluye cualquier `.json` de datos, `datos-locales/` y `respaldos/`.
- Los datos de ejemplo del repositorio son ficticios y no tienen ninguna liga real.
- No subas tu respaldo a un repositorio abierto. Si necesitas compartir la estructura
  de un curso, usa **Plantilla del curso**, que quita las ligas.
- El panel no abre ligas con esquemas raros (`javascript:`, `data:`): si un respaldo
  ajeno trae una, la muestra como texto y avisa.

---

## Limitaciones conocidas, dichas de frente

- **Rutas locales (`file://`)**: no abren con un clic desde ningún navegador, por
  seguridad. El panel las detecta, las marca y, al presionar «Abrir», copia la ruta
  para pegarla en el explorador de archivos. La solución de fondo es subir el archivo
  a OneDrive y sustituir la liga.
- **«Revisar enlaces» revisa la forma, no la existencia**: no se hace ninguna petición
  a las ligas. La restricción de origen cruzado del navegador lo impide y devolvería
  errores donde no los hay. Que una liga esté bien formada no garantiza que el archivo
  exista ni que tengas permiso.
- **Autenticación de OneDrive**: el panel no sabe si tu sesión de Microsoft está
  abierta. Si no lo está, la liga te llevará a iniciar sesión.
- **Incrustar no siempre se puede**: OneDrive, SharePoint y muchos sitios prohíben que
  otra página los muestre dentro de un marco. Por eso el panel abre pestañas en lugar
  de incrustar.
- **«Abrir todo» y el bloqueador de ventanas emergentes**: la primera vez el navegador
  bloqueará las pestañas. Hay que permitirlas para esta página.
- **Deshacer llega hasta la última eliminación**, no más atrás: en cuanto aparece otro
  aviso, la marcha atrás anterior se pierde. Cada eliminación sigue pidiendo
  confirmación y diciendo cuántos elementos se van con ella.
- **La búsqueda abarca la sesión abierta**, no todo el curso, igual que en el prototipo.
  El desplegable de tipos sí ofrece los tipos de toda la materia. Si prefieres que la
  búsqueda recorra el curso entero, es un cambio de una función: `recursosVisibles()`
  en `src/vistas/sesion.js`.
- **Microsoft Graph**: fuera de alcance por ahora. La capa `src/almacenamiento/` está
  hecha para que entre después como un módulo más, sin tocar las vistas.

---

## Cómo está organizado el código

```
index.html                  Todo el marcado de la página
vite.config.js              Configuración y el plugin de un solo archivo
src/
  main.js                   Arranque: monta las vistas y conecta el guardado
  estado.js                 Qué materia y qué sesión están activas; avisa a las vistas
  datos/
    modelo.js               Estructura, migración de respaldos y operaciones
    ejemplo.js              Dos materias ficticias, sin ligas reales
  almacenamiento/
    gestor.js               Decide dónde se guarda y en qué modo está
    local.js                localStorage
    archivo.js              File System Access API
    manijas.js              Recuerda el archivo vinculado (IndexedDB)
  vistas/
    lateral.js              Materias, enlaces del curso y sesiones
    sesion.js               Cabecera, controles, bitácora y riel de recursos
    semestre.js             Todas las sesiones de un vistazo
    modoClase.js            Pantalla completa, un recurso a la vez
    dialogos.js             Formularios de recurso, sesión, duplicar y materia
    revision.js             Revisión de la forma de las ligas
  exportacion/
    markdown.js             Materia a Markdown
    respaldo.js             Respaldo completo y plantilla sin ligas
    descargar.js            Descarga de archivos generados
  util/                     Fechas, ligas, portapapeles y atajos del DOM
  estilos/                  base, componentes e impresión
```

Regla de oro del proyecto: las vistas leen de `estado.js` y llaman a `actualizar()`
cuando cambian algo. `actualizar()` guarda y repinta. Ninguna vista sabe dónde se
guarda ni qué otras vistas existen.

---

## Modo clase

Pantalla completa en negro, un recurso a la vez, con barra de progreso segmentada.
Flechas izquierda y derecha para avanzar, Escape para salir, y un botón para abrir el
recurso visible sin salir del modo.

Arriba a la derecha corre el **reloj de la sesión**: los minutos transcurridos desde
que entraste, comparados con el minuto en que estaba planeado el recurso que tienes
enfrente. Dice «a tiempo», «N min antes de lo planeado» o «N min de retraso», y este
último se pinta en rojo. El reloj arranca de cero cada vez que entras al modo clase.

## Accesibilidad

- Todo se puede usar con el teclado, y el foco siempre se ve.
- Cada botón explica su función al dejar el puntero encima.
- En modo clase, el resto de la página queda fuera del recorrido del teclado y del
  lector de pantalla; al salir, el foco vuelve al botón de origen.
- Los formularios son `<dialog>` nativos, con etiqueta asociada en cada campo.
- El indicador de guardado es una región `aria-live`, para que el cambio se anuncie.
- Se respeta `prefers-reduced-motion`.

## Marca

En el encabezado va la palabra **IBERO** en blanco sobre el rojo institucional. Es
texto vivo compuesto con una serif del sistema (`Times New Roman`, con alternativas),
no un redibujo del logotipo: el manual de identidad gráfica prohíbe recomponer el
escudo o el logotipo, y esto no lo toca. Cuando tengas el archivo autorizado por la
DCI, se sustituye en un solo lugar: la regla `.marca` de `src/estilos/componentes.css`
y su línea en `index.html`. No se carga ninguna fuente web, para que el panel abra sin
conexión.

Colores: rojo `#E00034` (PMS 185 C) y gris `#82786F` (Warm Gray 9 C), del manual 2024.
Los demás neutros son de interfaz y no se usan nunca como color de marca.
