import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { aplicarTemaInicial } from "./tema/tema";
import "./tema/tema.css";
import "./App.css";

// Põe o tema antes da primeira tela, para não piscar branco no tema escuro.
aplicarTemaInicial();

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
