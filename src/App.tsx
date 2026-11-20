import { useEffect, useState } from "react";
import { getVersion } from "@tauri-apps/api/app";

// Dentro do programa de computador o Tauri injeta este objeto na página.
// No navegador (modo de prévia) ele não existe.
const rodandoNoPrograma = "__TAURI_INTERNALS__" in window;

export default function App() {
  const [versao, setVersao] = useState<string>("...");

  useEffect(() => {
    if (!rodandoNoPrograma) {
      setVersao("prévia no navegador");
      return;
    }
    // Pergunta a versão ao lado "de dentro" do programa (Rust).
    // Se isto funcionar, a ponte entre a interface e o programa está ok.
    getVersion()
      .then(setVersao)
      .catch(() => setVersao("não foi possível ler"));
  }, []);

  return (
    <main className="pagina">
      <h1 className="marca">
        apud<span className="ponto">.</span>
      </h1>
      <p className="lema">Escreva o conteúdo. A norma fica por conta do Apud.</p>

      <section className="cartao" aria-label="Estado do programa">
        <p className="status">
          <span className="selo" aria-hidden="true" />
          Tudo certo: o programa abriu e a interface está funcionando.
        </p>
        <dl className="detalhes">
          <div>
            <dt>Versão</dt>
            <dd>{versao}</dd>
          </div>
          <div>
            <dt>Rodando como</dt>
            <dd>{rodandoNoPrograma ? "Programa de computador" : "Navegador (prévia)"}</dd>
          </div>
        </dl>
      </section>

      <p className="rodape">Etapa 0 · esqueleto do projeto. O editor vem nas próximas etapas.</p>
    </main>
  );
}
