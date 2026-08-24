import { defineConfig } from "vite";

/* Escapa los caracteres que tienen significado dentro de una expresión regular. */
function escaparRegExp(texto) {
  return texto.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Plugin propio, sin dependencias externas.
 *
 * Vite genera por omisión un index.html que carga el JavaScript con
 * <script type="module" src="...">. Los módulos ES no se pueden cargar desde
 * file:// (el navegador los bloquea por origen cruzado), así que la aplicación
 * abierta con doble clic quedaría en blanco.
 *
 * Este plugin incrusta el CSS y el JavaScript dentro del propio index.html y
 * quita el type="module". El resultado es un solo archivo que funciona igual
 * publicado en GitHub Pages que abierto con doble clic desde el disco.
 */
function unSoloArchivo() {
  return {
    name: "un-solo-archivo",
    enforce: "post",
    apply: "build",
    generateBundle(_opciones, paquete) {
      const html = Object.values(paquete).find(
        (a) => a.type === "asset" && a.fileName.endsWith(".html")
      );
      if (!html) return;
      let codigo = String(html.source);

      for (const nombre of Object.keys(paquete)) {
        const parte = paquete[nombre];

        if (parte.type === "chunk" && parte.isEntry) {
          // "</script" dentro de una cadena de JavaScript cerraría la etiqueta.
          const js = parte.code.replace(/<\/script/gi, "<\\/script");
          const etiqueta = new RegExp(
            `<script[^>]*src="[^"]*${escaparRegExp(nombre)}"[^>]*>\\s*</script>`
          );
          codigo = codigo.replace(etiqueta, () => `<script>\n${js}\n</script>`);
          delete paquete[nombre];
        } else if (parte.type === "asset" && nombre.endsWith(".css")) {
          const css = String(parte.source);
          const etiqueta = new RegExp(
            `<link[^>]*href="[^"]*${escaparRegExp(nombre)}"[^>]*>`
          );
          codigo = codigo.replace(etiqueta, () => `<style>\n${css}\n</style>`);
          delete paquete[nombre];
        }
      }

      html.source = codigo;
    },
  };
}

export default defineConfig({
  // Rutas relativas: necesarias para GitHub Pages en subcarpeta y para file://
  base: "./",
  plugins: [unSoloArchivo()],
  build: {
    target: "es2020",
    cssCodeSplit: false,
    modulePreload: false,
    assetsInlineLimit: 100_000_000,
    rollupOptions: {
      output: {
        format: "iife",
        inlineDynamicImports: true,
        entryFileNames: "panel.js",
        assetFileNames: "panel.[ext]",
      },
    },
  },
});
