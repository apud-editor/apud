import { useEffect, useState } from "react";
import Painel from "./telas/Painel";
import TelaDoTrabalho from "./telas/TelaDoTrabalho";
import { vigiarFechamento } from "./telas/sair";
import { useTema } from "./tema/useTema";
import type { Trabalho } from "./arquivos/formato";

type Tela = { tipo: "painel" } | { tipo: "trabalho"; arquivo: string; trabalho: Trabalho; novo: boolean };

export default function App() {
  const [tela, setTela] = useState<Tela>({ tipo: "painel" });
  // O tema vale para o programa todo; o seletor fica no Painel e em Arquivo › Preferências do editor.
  const tema = useTema();

  useEffect(() => {
    void vigiarFechamento();
  }, []);

  if (tela.tipo === "trabalho") {
    return (
      <TelaDoTrabalho
        key={tela.arquivo}
        arquivo={tela.arquivo}
        trabalho={tela.trabalho}
        novo={tela.novo}
        aoVoltar={() => setTela({ tipo: "painel" })}
        temaEscolhido={tema.escolha}
        aoEscolherTema={tema.escolher}
      />
    );
  }
  return (
    <Painel
      aoAbrir={(arquivo, trabalho, novo) => setTela({ tipo: "trabalho", arquivo, trabalho, novo })}
      temaEscolhido={tema.escolha}
      aoEscolherTema={tema.escolher}
    />
  );
}
