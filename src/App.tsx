import { useEffect, useState } from "react";
import Painel from "./telas/Painel";
import TelaDoTrabalho from "./telas/TelaDoTrabalho";
import { vigiarFechamento } from "./telas/sair";
import type { Trabalho } from "./arquivos/formato";

type Tela = { tipo: "painel" } | { tipo: "trabalho"; arquivo: string; trabalho: Trabalho; novo: boolean };

export default function App() {
  const [tela, setTela] = useState<Tela>({ tipo: "painel" });

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
      />
    );
  }
  return <Painel aoAbrir={(arquivo, trabalho, novo) => setTela({ tipo: "trabalho", arquivo, trabalho, novo })} />;
}
