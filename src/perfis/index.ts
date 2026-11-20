// Porta de entrada dos perfis de norma. O resto do Apud usa só o que sai daqui.

export { conferirPerfis, type Arquivo, type ResultadoDaConferencia } from "./conferir";
export { aplicarPerfilNoCsl } from "./csl";
export { ajustarParaTrabalho, regrasAjustaveis } from "./ajustes";
export { ESQUEMAS } from "./normas";
export { formatarMensagem, nomeCompleto } from "./tipos";
export type { Mensagem, PerfilResolvido, Regra, Situacao, Valor } from "./tipos";
