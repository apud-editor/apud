import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// A interface do Apud é uma página web comum. O Tauri a coloca dentro de uma
// janela de programa; o mesmo código também roda no navegador (modo de prévia).
export default defineConfig({
  plugins: [react()],
  clearScreen: false,
  // O programa roda no computador, sem baixar nada pela internet: um arquivo
  // grande de interface não atrasa nada, então o aviso de tamanho fica mais alto.
  build: { chunkSizeWarningLimit: 2000 },
  server: {
    port: 1420,
    strictPort: true,
  },
});
