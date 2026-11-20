// Um texto de exemplo com tudo o que a fase 1 sabe fazer, para conferir o PDF:
// títulos de três níveis, parágrafos longos (várias páginas), lista com
// subitens, itálico, negrito, sobrescrito e sinais que o Typst trata como comando.

import type { Bloco, Documento, Trecho } from "../documento/modelo";

const p = (...trechos: Array<string | Trecho>): Bloco => ({
  tipo: "paragrafo",
  trechos: trechos.map((t) => (typeof t === "string" ? { texto: t } : t)),
});
const t = (nivel: 1 | 2 | 3, texto: string): Bloco => ({ tipo: "titulo", nivel, trechos: [{ texto }] });
const it = (texto: string): Trecho => ({ texto, marcas: ["italico"] });

const longo =
  "O estágio supervisionado reúne, no mesmo período, o estudo teórico e a prática no serviço. Ao longo do semestre, " +
  "as atividades incluíram o acolhimento de usuários, a participação em grupos terapêuticos e as reuniões semanais da " +
  "equipe, nas quais os casos eram discutidos à luz da literatura estudada em sala. A supervisão funcionou como um " +
  "espaço para nomear o que foi visto, duvidar do que foi feito e reorganizar o que foi aprendido antes de voltar ao serviço.";

export const TEXTO_DE_EXEMPLO: Documento = {
  versao: 1,
  blocos: [
    t(1, "Introdução"),
    p(longo),
    p("Este relato usa termos como ", it("setting"), " e ", it("rapport"), ", comuns na clínica, e cita o século XX", { texto: "1", marcas: ["sobrescrito"] }, "."),
    p('Sinais que não podem virar comando: #hashtag, *asterisco*, _sublinhado_, @arroba, $10, <tag>, [colchetes], 50% e "aspas".'),
    t(2, "Contexto do estágio"),
    p(longo),
    p("As atividades da semana foram:"),
    {
      tipo: "lista",
      sequencia: false,
      itens: [
        { trechos: [{ texto: "acolhimento de usuários recém-chegados ao serviço, com escuta inicial e registro em prontuário;" }] },
        {
          trechos: [{ texto: "grupos terapêuticos:" }],
          subitens: [{ trechos: [{ texto: "grupo de convivência;" }] }, { trechos: [{ texto: "oficina de expressão;" }] }],
        },
        { trechos: [{ texto: "reunião de equipe." }] },
      ],
    },
    p(longo),
    t(3, "Um título de terceiro nível bem comprido, para conferir se a segunda linha fica alinhada sob a primeira letra do título"),
    p(longo),
    p(longo),
    t(1, "Desenvolvimento"),
    p(longo),
    p(longo),
    p(longo),
    { tipo: "paragrafo", trechos: [] },
    t(2, "Supervisão"),
    p({ texto: "Negrito", marcas: ["negrito"] }, " e ", { texto: "negrito com itálico", marcas: ["negrito", "italico"] }, " no meio do parágrafo."),
    p(longo),
    p(longo),
    t(1, "Considerações finais"),
    p(longo),
    { tipo: "paragrafo", trechos: [] },
  ],
};
