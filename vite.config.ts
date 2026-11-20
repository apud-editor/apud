import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// A interface do Apud é uma página web comum. O Tauri a coloca dentro de uma
// janela de programa; o mesmo código também roda no navegador (modo de prévia).
export default defineConfig({
  plugins: [react()],
  clearScreen: false,
  server: {
    port: 1420,
    strictPort: true,
  },
});
