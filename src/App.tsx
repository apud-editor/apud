import Editor from "./editor/Editor";
import { documentoVazio } from "./documento/modelo";

// Nesta etapa o Apud abre direto no editor, com um trabalho em branco.
// O painel com a lista de trabalhos e o salvamento chegam na próxima etapa.
export default function App() {
  return (
    <div className="tela">
      <header className="topo">
        <span className="marca">Apud</span>
        <span className="barra" aria-hidden="true">
          /
        </span>
        <span className="nome-do-trabalho">Trabalho sem título</span>
        <span className="aviso">Ainda não salva: o salvamento chega na próxima etapa</span>
      </header>
      <Editor inicial={documentoVazio()} />
    </div>
  );
}
