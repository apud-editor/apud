# Artigo da UNIVALI (ABNT): o que o Apud monta diferente do original

Conferência final da fase 2, parte 5b (20/11/2026; leis conferidas no texto da
NBR 6023:2025 em 21/11/2026). O texto e as 43 fontes do
original estão em `artigo.md` e `referencias.json`. O Apud monta as citações e
a lista com o perfil ABNT 2025, revisão 6. A comparação ponto a ponto sai com
`npm run artigos`.

**Decisão do Francisco (21/11/2026):** onde o texto do artigo e a norma
divergem, vale a norma. Por isso os itens 3 e 4 abaixo seguem a norma, e o que
o Apud ainda não faz está marcado como tal. A saída conferida está em `gabarito-abnt.txt`, e os testes
usam esse arquivo.

Cada diferença cai num de quatro casos:
**erro do Apud** (corrigido aqui), **regra de perfil** (mudou o perfil),
**o original não segue a norma** (o Apud está certo) ou
**falta algo no Apud** (fica para você decidir).

## 1. Erros do Apud, corrigidos neste PR

| O que estava errado | Exemplo | Correção |
|---|---|---|
| O subtítulo do capítulo ia para o título do livro | GARDELLA. A urgência como cronopolítica. *In*: […] **Novas faces da vida nas ruas**: o abrigo para pessoas… | O subtítulo fica junto do título do capítulo. Vale também para artigos, trabalhos em evento, notícias e leis. |
| O subtítulo do artigo sumia | CEOLIN […]. População em situação de rua. **Humanidades…** | Volta: "População em situação de rua: estudo da realidade vivida". |
| O subtítulo da revista sumia | **Distinktion**, v. 12… | **Distinktion**: Journal of Social Theory, sem negrito no subtítulo. |
| Revista sem cidade ficava sem nada | **Psico**, v. 38… | **Psico**, *[S. l.]*, v. 38… A cidade é elemento essencial do artigo (NBR 6023:2025). Pela sua decisão "monta e avisa", o Apud usa a forma da norma. |
| As iniciais entravam mesmo quando as chamadas já eram diferentes | Spink, P. (2013) e Spink, M. J. P. e Medrado (2013) | Spink (2013) e Spink e Medrado (2013). As iniciais só entram quando as duas chamadas ficariam iguais (NBR 10520:2023). |

## 2. Regra de perfil nova: instituição com subordinação (ABNT, revisão 5)

O original escreve "BRASIL. Ministério do Desenvolvimento Social e Combate à
Fome" na lista e "(Brasil, 2014)" na chamada. Essa é a forma da norma. O Apud
punha o nome inteiro nos dois lugares, e tudo em maiúsculas. Agora:

- **Na lista:** só a entidade principal vai em maiúsculas: BRASIL. Ministério do Desenvolvimento Social…; SANTA CATARINA. Secretaria de Estado…
- **Na chamada:** só a entidade principal aparece: (Brasil, 2014), (Santa Catarina, 2019).
- **Como cadastrar:** escreva os níveis com ponto entre eles, como em "Brasil. Ministério da Saúde". O formulário agora dá essa dica.
- **Dois órgãos do mesmo governo no mesmo ano:** a chamada ficaria igual, então entram as letras, como em (Brasil, 2014a) e (Brasil, 2014b).
- **Na APA:** nada muda. A APA não separa os níveis.

## 3. O original não segue a norma (o Apud está certo)

- **Três autores com et al.:** a ABNT cita até três autores pelo nome. O original tem (Monzelli et al., 2023) e (Ceolin et al., 2020). O Apud escreve (Monzelli; Navarro; Cagnin, 2023), e na narrativa, Monzelli, Navarro e Cagnin (2023).
- **"&" na ABNT:** (Pires & Lotta, 2019) e (Pereira & Guareschi, 2017) são da APA. Na ABNT o separador é o ponto e vírgula: (Pires; Lotta, 2019).
- **Várias obras numa chamada:** vão em ordem alfabética. Onde o original tem (Silva, 2009; Medeiros, 2020), o Apud escreve (Medeiros, 2020; Silva, 2009). A regra é da NBR 10520:2023 e já estava no perfil.
- **Coautor esquecido na chamada:**
  - (Dias, 2022): a obra tem dois autores, então vira (Dias; Migliari, 2022).
  - Spink (2011): a obra é Spink, Figueiredo e Brasilino, então vira Spink, Figueiredo e Brasilino (2011).
- **Ano diferente da referência:** Palhares (2020), mas a referência é de 2021. O Apud escreve Palhares (2021).
- **Notícia sem autor:** (NSC Total, 2023) não corresponde a nada na lista. A notícia entra pelo título e é de 2024, então vira (Morador [...], 2024).
- **Erro de digitação:** (CDNH, 2024) vira (Conselho Nacional de Direitos Humanos, 2024).
- **Ordem da lista:**
  - ASSOCIAÇÃO vinha antes de ARANTES, e SOUZA depois dos SPINK.
  - As duas obras do MPSC estavam fora da ordem dos anos (2025 antes de 2024).
  - O Apud ordena tudo sozinho.
- **Termos que faltavam:**
  - ARANTES e CNDH não têm editora, então o Apud põe *[s. n.]*.
  - Seis revistas sem cidade ganharam *[S. l.]* (veja o item 1).
- **Detalhes de pontuação e destaque do original:**
  - "*In*" em itálico em todas as referências: o original alterna.
  - Os dois-pontos fora do negrito.
  - "p. 237-271." em vez de "p 237-271".
  - O ponto final em DIAS; MIGLIARI.
  - "do;" em vez de "do ;" em RYBKA.
- **Data do artigo:** PALHARES sai com "ago. 2021", sem o dia. Para artigos de revista, o perfil usa mês e ano.
- **Título da lista:** o original usa "Referências Bibliográficas:". O Apud escreve REFERÊNCIAS, como pede a NBR 14724.

## 4. Falta algo: você decide ou completa

**Dados que estão faltando no trabalho.** O Apud marca essas citações em
vermelho no editor:
- Cavalcante et al. (2024), citada 3 vezes. Não está na lista do original.
- Brasil (2019), a Lei nº 13.840, e Brasil (2025). Também não estão na lista.
- Spink e Medrado (1999). Na lista só há a obra de 2013.

Cadastre essas fontes no .apud, e as citações se arrumam sozinhas. O aviso diz
"referência que não existe mais", porque o Apud não sabe se a fonte foi apagada
ou nunca foi cadastrada.

**Fontes na lista que não são citadas.** O Apud só põe na lista as obras
citadas, como você decidiu. Por isso três referências do original ficaram de
fora:
- **A lei de Itajaí.** Ela é discutida e transcrita no texto, mas sem citação. Ponha uma citação depois da transcrição.
- **TOMALIH (2025), a entrevista.** Não é citada.
- **MEDRADO; SPINK (2013).** É uma repetição de SPINK; MEDRADO (2013), e não é citada.

**O que o Apud ainda não faz.** São pequenas mudanças de formato, para decidir
depois:
1. **Livro organizado (org.): resolvido (decisão do Francisco, 20/11/2026).** O livro tem agora a caixa "São os organizadores do livro". Marcada, a lista escreve SPINK, Mary Jane; FIGUEIREDO, Pedro; BRASILINO, Jullyane (org.). A chamada continua pelos nomes: (Spink; Figueiredo; Brasilino, 2011). O original deixou o "(org.)" de fora: aqui o Apud está mais perto da norma que o original.
2. **Elementos complementares: resolvido com o campo "Notas" (decisão do Francisco, 20/11/2026).** Todo tipo tem agora um campo livre "Notas", que sai como foi escrito, logo antes do "Disponível em". Foi usado para:
   - a tradução e a edição de ENGELS;
   - a série "Observatório Brasileiro…" de DIAS; MIGLIARI;
   - a nota "[Entrevista concedida à Redação BC Notícias]" de TOMALIH (que não é citada, então não aparece).

   **Diferença que fica:** as notas saem todas juntas, depois da editora e do ano. O original põe "Tradução de…" logo depois do título e "Observatório…" antes da cidade. A NBR 6023 aceita os elementos complementares nesse lugar quando não há campo próprio; se um dia o Apud ganhar campos de tradutor e de série, eles irão para o lugar certo.
3. **Título terminado em "?" ou "!".** O motor de PDF põe um ponto depois: "…São Paulo?**." e "…a vida pode mais!.". A ABNT não pede esse ponto. É uma limitação do motor de PDF (Typst), sem correção fácil. Fica anotado.
4. **Negrito na lei e na Constituição: resolvido pela NBR 6023:2025 (perfil revisão 6).** Nos exemplos da norma (7.11.1 e 7.11.2), a lei consultada sozinha tem a epígrafe em negrito, como em CURITIBA. **Lei nº 12.092, de 21 de dezembro de 2006**. Na Constituição, o negrito fica no título, depois do colchete: BRASIL. [Constituição (1988)]. **Constituição da República Federativa do Brasil**. O Apud agora faz assim nas três leis do artigo. O original tinha negrito na Lei 10.216 e na Constituição, mas punha o do Decreto 7.053 na ementa; o Apud segue a norma. A lei publicada dentro de outra obra (Diário Oficial, vade-mécum) leva o negrito na obra; esse caso ainda não existe no formulário.
5. **Sigla na chamada: segue a norma.** A NBR 6023 (8.1.2) deixa a instituição entrar "por extenso ou abreviada", e a NBR 10520 manda a chamada repetir a entrada da lista. O que não pode é misturar: sigla na chamada e nome por extenso na lista, como no original. O Apud escreve igual nos dois lugares o que você cadastrou. Para usar MPSC, cadastre a instituição como "MPSC".
6. **Nomes completos na narrativa: segue a norma.** A NBR 10520 pede o sobrenome na citação: "Segundo Spink e Medrado (2013)". O original diz "Segundo Mary Jane Spink e Benedito Medrado (2013)". Se quiser os prenomes mesmo assim, escreva-os no texto antes da citação.
7. **Endereço quebrado no fim da linha.** O motor de PDF repete o hífen do endereço na linha de baixo ("contra-" / "-pessoas"), como manda a regra do português para palavras. Num endereço isso confunde. Fica anotado para a fase 3.

**Fase 3 (como previsto):**
- **Citação longa.** As citações longas saem como parágrafos comuns.
- **Bloco de abertura da UNIVALI.** Não entra no .apud o bloco com escola, curso, título, área, orientador e acadêmico.
