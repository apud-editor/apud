# Artigo da revista (APA): o que o Apud monta diferente do original

Conferência final da fase 2, parte 5b (20/11/2026). Esta é a versão do artigo
com as alterações da Revista Psicologia Política. Ela tem texto e fontes
diferentes da versão da UNIVALI: são 52 fontes, muitas delas vídeos do
Instagram, citados pelo minuto (0:57).

O trabalho usa as três escolhas de revista que o perfil já tinha
(`trabalho.json`):
- todos os autores na primeira citação: (Monzelli, Navarro, & Cagnin, 2023), depois Monzelli et al. (2023);
- prenomes por extenso;
- cidade da editora.

O resultado conferido está em `gabarito-apa.txt`, e os testes usam esse arquivo.

**Decisão do Francisco (21/11/2026):** onde o texto do artigo e a APA divergem,
vale a norma. Os itens abaixo seguem a APA 7; o que o Apud ainda não faz está
marcado como tal.

## 1. Erros do Apud, corrigidos neste PR (perfil APA, revisão 6)

| O que estava errado | Antes | Agora |
|---|---|---|
| As letras de mesmo autor e ano seguiam o título | Coelho (2025a) era o vídeo de 30 de julho | As letras seguem a data completa: 2025a é o de 2 de janeiro, como no original. A APA 7 manda assim (Purdue OWL; UAB). Obras só com o ano vêm primeiro. Na ABNT nada muda. |
| A lei saía com a data duas vezes na citação | (Lei Municipal nº 7.839, de 5 de novembro de 2025, 2025, § 3º) | (Lei Municipal nº 7.839, 2025, § 3º). É como a APA faz com o nome das leis. Na lista, o nome sai inteiro. |
| Duas leis do Brasil se juntavam, como se fossem do mesmo autor | (Constituição…, 1988, 2009) | (Constituição da República Federativa do Brasil, 1988; Decreto nº 7.053, 2009). Na APA, a lei é citada pelo título; na ABNT continua (Brasil, 1988, 2009). |
| Notícia, site ou evento só com o ano deixava uma vírgula sobrando | Catie, Talita. (2023,). | Catie, Talita. (2023). |
| Páginas do capítulo na lista | (p. 350–395) | (pp. 350–395), como nas citações, que já usavam "pp.". |

## 2. O original não segue a APA (o Apud está certo)

- **Ordem das obras na citação:** (Decreto nº 7.053, 2009; Constituição…, 1988) não está em ordem alfabética. A APA pede a ordem da lista.
- **Lei nº 13.840 (2019):** está na lista, mas o texto só a menciona, sem citação. A APA exige que toda referência seja citada. O Apud não a põe na lista. Para resolver, ponha "(Lei nº 13.840, 2019)" depois da menção.

## 3. Decididos (Francisco, 20 e 21/11/2026)

1. **"Em", e não "In".** O perfil APA usa "Em", a palavra em português, sem opção de revista. O original usa "In".
2. **Lei na lista: o modelo do site da APA.** "Decreto nº 7.053, de 23 de dezembro de 2009 (2009). URL". O original usa a forma comum no Brasil, com ementa e quem publicou.
3. **Sigla da instituição: segue a APA.** O padrão da APA é o nome por extenso. A sigla é opcional: ela é apresentada na primeira citação e usada depois, e o Apud ainda não faz essa troca sozinho. O original usa (MPSC, 2025) e (MPF & MPT, 2025) sem apresentar a sigla na primeira citação. O Apud escreve o nome inteiro.
4. **Prenomes no texto: segue a APA.** O original escreve "Mary Jane Spink (2013)", "Peter Spink (2013, p. 112)" e "Leonel Pavan (2025b)". Como há dois Spink e dois Pavan, a APA pede as iniciais: "M. J. P. Spink (2013)", "P. Spink (2013, p. 112)" e "L. Pavan (2025b)". É o que o Apud faz.
5. **Livro organizado (Org.): resolvido (decisão do Francisco, 20/11/2026).** Com a caixa "São os organizadores do livro" marcada, sai "Spink, Mary Jane Paris (Org.). (2013)", como no original. Na APA, as notas (campo "Notas") saem no fim da referência.
6. **Detalhes da tese e do relatório:**
   - "em Psicologia" na tese: a APA mostra só "[Tese de doutorado, Universidade]". Segue a APA.
   - **Falta no Apud:** o nome do repositório (Repositório Institucional da UFRN). A APA 7 pede esse nome na tese publicada em repositório, antes do endereço, e o Apud ainda não tem onde guardá-lo.
   - **Falta no Apud:** o "Disoc" da Nota Técnica do Ipea, que faz parte do número da série.
7. **Título terminado em "?":** "…São Paulo?*." ganha um ponto a mais, como na ABNT. É uma limitação do motor de PDF.

## 4. Fora da comparação

- **Página de título e resumos.** Os títulos e os resumos em português, espanhol e inglês ficam para a fase 3 (títulos e resumos em vários idiomas). O texto começa direto na introdução.
- **Citações em bloco: resolvido na parte 2 da fase 3 (22/11/2026).** Saem com recuo de 1,27 cm e espaço duplo, sem espaço a mais antes e depois, e com o ponto final antes da chamada, como a APA pede: "…desta Missão. (Conselho…, 2024, p. 37)".
- **Espaçamento: segue a APA.** O original usa 1,5 no texto e espaço simples na lista. O Apud usa espaço duplo, como a APA pede.
- **Títulos de seção.** Saem como você escreveu ("A Construção Do Sujeito Nos Decretos Narrativos"): o Apud não muda as maiúsculas dos títulos.
- **"BC Notícias".** Cadastrei como "Site", porque o original a formata como página de site de notícias (título em itálico). Batista e Catie estão como "Notícia" (jornal em itálico), também como no original.
