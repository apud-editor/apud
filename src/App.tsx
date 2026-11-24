import { useEffect, useState } from "react";
import Painel from "./telas/Painel";
import TelaDoTrabalho from "./telas/TelaDoTrabalho";
import { vigiarFechamento } from "./telas/sair";
import { useTema } from "./tema/useTema";
import { useIcone } from "./icone/useIcone";
import ControlesDaJanela from "./janela/ControlesDaJanela";
import type { Trabalho } from "./arquivos/formato";

type Tela =
  | { tipo: "painel" }
  | { tipo: "trabalho"; arquivo: string; trabalho: Trabalho; novo: boolean };

export default function App() {
  const [tela, setTela] = useState<Tela>({ tipo: "painel" });
  // O tema vale para o programa todo; o seletor fica no Painel e em Arquivo › Preferências do editor.
  const tema = useTema();
  // O ícone do programa (janela e barra de tarefas) é escolhido no Painel.
  const icone = useIcone();

  useEffect(() => {
    void vigiarFechamento();
  }, []);

  return (
    <>
      {/* Uma vez só, fora das telas: o programa abre sem a barra do Windows. */}
      <ControlesDaJanela />
      {tela.tipo === "trabalho" ? (
        <TelaDoTrabalho
          key={tela.arquivo}
          arquivo={tela.arquivo}
          trabalho={tela.trabalho}
          novo={tela.novo}
          aoVoltar={() => setTela({ tipo: "painel" })}
          temaEscolhido={tema.escolha}
          aoEscolherTema={tema.escolher}
          iconeEscolhido={icone.escolhido}
          aoEscolherIcone={icone.escolher}
        />
      ) : (
        <Painel
          aoAbrir={(arquivo, trabalho, novo) =>
            setTela({ tipo: "trabalho", arquivo, trabalho, novo })
          }
          temaEscolhido={tema.escolha}
          aoEscolherTema={tema.escolher}
          iconeEscolhido={icone.escolhido}
          aoEscolherIcone={icone.escolher}
        />
      )}
    </>
  );
}
