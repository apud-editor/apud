// O que sobrou dos perfis de norma da versão 1: os tipos que o motor de
// citações lê (PerfilResolvido, Regra), o esquema das regras de citações e
// referências e o ajuste do estilo CSL. Os modelos (src/modelos) montam essa
// forma pela ponte (modelos/ponte.ts). Tudo isso muda na etapa 5, quando as
// citações passarem a ler os modelos direto.

export { aplicarPerfilNoCsl } from "./csl";
export { ESQUEMAS } from "./normas";
export { formatarMensagem, nomeCompleto } from "./tipos";
export type { Mensagem, PerfilResolvido, Regra, Situacao, Valor } from "./tipos";
