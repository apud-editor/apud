# Perfis de norma do Apud

Esta pasta guarda as regras que o Apud aplica nos trabalhos. Cada norma tem um
arquivo de texto, que abre no Bloco de Notas. Quando uma norma mudar, você
atualiza o arquivo, sem mexer no código.

| Arquivo | O que é |
| --- | --- |
| `abnt.txt` | Perfil ABNT 2025 (NBR 14724:2024, 6023:2025, 10520:2023, 6024:2012, 6027:2012, 6028:2021) |
| `apa.txt` | Perfil APA 7ª edição |
| `estilos/abnt.csl` e `estilos/apa.csl` | Estilos de citação no formato do Zotero (CSL), que montam a lista de referências |
| `exemplos/` | Exemplo de perfil personalizado, que herda de outro |
| `prova/` | Documento de prova, as referências dele e os gabaritos |

## Como ler uma linha

```
recuo de parágrafo: 1,25 cm  | NBR 14724:2024, que não fixa o recuo | faculdade
└── nome da regra ─┘ └ valor ┘   └──────── norma de origem ────────┘   └ situação ┘
```

- **Nome da regra**, dois-pontos e **valor**.
- Depois da primeira barra `|`, a **norma de origem** e, entre parênteses, o
  manual onde a regra foi conferida.
- Depois da segunda barra, a **situação**, que é opcional:

| Situação | Quer dizer |
| --- | --- |
| (nada) | Confirmada na norma |
| `faculdade` | A norma não fixa o valor. O da linha é o padrão, e cada pessoa pode trocar nas configurações do trabalho |
| `escolha: a, b` | A norma aceita mais de uma forma. A pessoa escolhe entre as opções; o valor da linha é o padrão e precisa ser uma delas |
| `desligada` | Regra guardada para depois (fora da versão 1). Ainda não tem efeito |

Linhas que começam com `#` são comentários. Linhas como `== ABNT: citações ==`
são títulos de seção, só para organizar. As regras seguem a ordem do checklist.

Os valores aceitam pequenas diferenças de digitação: "nao" vale como "não", e
"1.25 cm" vale como "1,25 cm".

## Como atualizar um perfil quando a norma muda

1. Abra o arquivo (`abnt.txt` ou `apa.txt`) e troque o valor da regra. Exemplo:
   para mudar o recuo da citação longa, troque `4 cm` por outro valor na linha
   `citação longa, recuo`.
2. Atualize a norma de origem da linha, se ela mudou.
3. No começo do arquivo, some 1 à `revisão`, troque a `data da revisão` e
   escreva na `nota da revisão`, em uma linha, o que mudou. É essa nota que os
   trabalhos antigos vão mostrar ao perguntar se você quer atualizá-los.
4. Confira o perfil (veja abaixo). Um perfil com erro nunca é aplicado.
5. Confira o documento de prova contra o gabarito.

### Conferir sem instalar nada (pelo GitHub)

1. No GitHub, abra o arquivo do perfil e clique no lápis para editar.
2. Ao salvar, escolha "Create a new branch" e abra o pull request.
3. A verificação "Testes" roda sozinha. Se aparecer um X vermelho, clique em
   "Details": a conferência mostra cada erro com a linha e o que fazer, como
   `linha 12: falta a unidade em “recuo de parágrafo”: escreva 1,25 cm.`
4. Com tudo verde, os PDFs do documento de prova ficam para baixar na página da
   verificação, em "Artifacts".

### Conferir no computador

Para quem tem o Node instalado, na pasta do projeto:

```
npm run conferir-perfis   # confere os perfis e mostra os erros
npm run prova             # roda o documento de prova e compara com os gabaritos
npm test                  # todos os testes, inclusive a cobertura do checklist
```

Na versão 1 do Apud, a tela Perfis vai ter um botão que abre o arquivo e outro
que recarrega e confere depois de salvar.

## O que dá para mudar só no perfil, e o que não dá

**Dá para mudar sozinho:** qualquer valor (medidas, tamanhos, espaçamentos,
textos como `Disponível em:` e `[S. l.]`, as abreviaturas dos meses), as opções
de uma escolha e a situação de uma regra. As escolhas do autor e os termos das
referências comandam o estilo CSL: mudou no perfil, muda no PDF.

**Precisa de quem programa:**

- **Um tipo novo de regra**, que o Apud ainda não sabe aplicar. A conferência
  avisa quando um valor não é aceito, por exemplo:
  `“papel” só aceita “A4”, que é como o Apud aplica esta regra.`
- **A estrutura de um tipo de referência** (a ordem das partes de um livro, de
  um artigo). Quem monta essa ordem é o estilo CSL. As linhas `modelo, livro`,
  `modelo, artigo` e as outras servem para conferência: se você mudar o modelo
  no perfil, a conferência dá um aviso dizendo que o CSL ainda segue o modelo
  antigo.

## Perfis personalizados (herança)

Um perfil personalizado guarda só o que muda e herda o resto do original. Veja
`exemplos/abnt-universidade-exemplo.txt`:

```
perfil: ABNT – Universidade Exemplo
herda de: ABNT 2025, revisão 3
revisão: 1
data da revisão: 20/11/2026
nota da revisão: Fonte Arial e recuo de 1,5 cm, como pede o manual.

família da fonte: Arial         | Manual da Universidade Exemplo (2025)
recuo de parágrafo: 1,5 cm      | Manual da Universidade Exemplo (2025)
```

- `herda de` diz o perfil original, a versão e a **revisão** sobre a qual o
  personalizado foi feito. Quando o original ganhar uma revisão nova, a
  conferência avisa para você ver se as mudanças continuam valendo.
- A situação de cada regra (faculdade, escolha) vem do original, a não ser que
  você escreva outra.
- Na versão 2, o editor de perfis vai criar esses arquivos por um formulário.

## Documento de prova e gabaritos

`prova/documento-de-prova.md` é um trabalho de exemplo que usa todas as regras:
títulos dos 5 níveis, alíneas, nota, figura, tabela, citação curta e longa,
cada tipo de chamada e cada tipo de referência. As referências estão em
`prova/referencias.yml`. As obras são fictícias, menos a Lei nº 10.216.

`prova/gabarito-abnt.txt` e `prova/gabarito-apa.txt` dizem como cada chamada e
cada referência devem sair. O comando `npm run prova` monta o documento no
Typst (o motor de PDF do Apud) e compara.

Hoje o teste confere as chamadas e as referências. A página inteira (margens,
títulos, capa) passa a ser conferida quando o conversor para PDF existir.

Depois de mudar um perfil **de propósito**, a comparação vai mostrar as
diferenças. Confira cada uma contra a norma. Se estiverem certas, grave o novo
gabarito com `npm run prova -- --gravar`.

## Regras fora do checklist

Algumas regras não estão no checklist de 20/11/2026, mas são necessárias para
trocar de ABNT para APA sem reescrever o trabalho. Elas ficam no perfil da APA,
com um comentário dizendo que estão fora do checklist:

- citação de citação: `como citado em`, com vírgula antes;
- destaque seu: `[ênfase adicionada]`, dentro da citação;
- tradução sua: `tradução nossa`;
- mesmo autor e mesmo ano: letras depois do ano (2020a, 2020b).

Também fica no perfil da APA uma escolha que vem de revistas: algumas pedem
todos os autores na primeira citação de uma obra com 3 a 5 autores, e *et al.*
dali em diante, como fazia a APA 6. Exemplo: (Monzelli, Navarro, & Cagnin,
2023), depois Monzelli et al. (2023). O padrão continua o da APA 7, com
*et al.* desde a primeira vez.

Mais duas escolhas de revista ficam no perfil da APA, com o padrão da APA 7:

- `referências, prenomes`: `iniciais` (padrão) ou `por extenso`. Por extenso
  vale só na lista; no texto, o Apud usa iniciais quando dois autores têm o
  mesmo sobrenome, como em (J. Pavan, 2025a).
- `referências, cidade da editora`: `não mostrar` (padrão) ou `mostrar`, como
  em "São Paulo: Cortez". Vale para livros, relatórios e o livro de capítulos
  e anais.

## Tipos de referência

Os dois estilos montam livro, capítulo, artigo, site, lei, tese ou
dissertação, relatório de uma série (como uma nota técnica), trabalho em anais
de evento, notícia de jornal e postagem em rede social. Cada tipo tem uma linha
`modelo, ...` no perfil. Os campos que o Apud acrescenta aos dados (grau da
tese, evento, perfil na rede social) estão explicados no começo de
`prova/referencias.yml`.

## Licença dos estilos CSL

Os dois estilos foram feitos a partir dos estilos do repositório do Zotero, que
usam a licença Creative Commons BY-SA 3.0. Por isso eles mantêm os nomes dos
autores originais e a mesma licença.
