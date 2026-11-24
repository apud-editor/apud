import { useCallback, useEffect, useState } from "react";
import {
  CONSULTA_ESCURO,
  aplicarTema,
  gravarEscolhaDeTema,
  lerEscolhaDeTema,
  sistemaEstaEscuro,
  temaAplicado,
  type EscolhaDeTema,
} from "./tema";

/**
 * A escolha de tema da pessoa e o tema que aparece. Quando a escolha é "Sistema",
 * acompanha o Windows com o programa aberto (o navegador avisa quando ele muda).
 */
export function useTema() {
  const [escolha, setEscolha] = useState<EscolhaDeTema>(() => lerEscolhaDeTema());
  const [sistemaEscuro, setSistemaEscuro] = useState<boolean>(() => sistemaEstaEscuro());

  useEffect(() => {
    if (typeof matchMedia !== "function") return;
    const consulta = matchMedia(CONSULTA_ESCURO);
    const mudou = () => setSistemaEscuro(consulta.matches);
    mudou();
    consulta.addEventListener("change", mudou);
    return () => consulta.removeEventListener("change", mudou);
  }, []);

  const aplicado = temaAplicado(escolha, sistemaEscuro);

  useEffect(() => {
    aplicarTema(aplicado, document.documentElement);
  }, [aplicado]);

  const escolher = useCallback((nova: EscolhaDeTema) => {
    setEscolha(nova);
    gravarEscolhaDeTema(nova);
  }, []);

  return { escolha, aplicado, escolher };
}
