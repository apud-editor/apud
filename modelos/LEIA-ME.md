# Modelos do Apud (versão 2)

Esta pasta guarda os modelos que vêm no Apud. Um modelo diz como cada elemento
do trabalho fica no PDF: a fonte do texto, o destaque dos títulos, o recuo da
citação longa, os campos da capa. Cada modelo é um arquivo de texto, que abre no
Bloco de Notas.

| Arquivo | O que é |
| --- | --- |
| `em-branco.txt` | O modelo **Em branco**: a raiz de todos os outros, com valores neutros |
| `abnt.txt` | ABNT 2025 (NBR 14724:2024, 6023:2025, 10520:2023, 6024:2012, 6027:2012, 6028:2021) = Em branco + diferenças |
| `apa.txt` | APA 7ª edição = Em branco + diferenças |
| `exemplos/` | Exemplo de modelo de uma faculdade, que herda da ABNT |

Os modelos ABNT e APA continuam os perfis da versão 1 (pasta `perfis/`): cada
regra foi para o elemento a que pertence, com a mesma origem, a mesma situação
e o mesmo comentário, e nenhum valor mudou. A tabela de correspondência está em
`src/modelos/correspondencia.ts`, e um teste confere regra por regra. Até a
parte 1c, o programa ainda usa os perfis; depois, só os modelos.

## A árvore de elementos

Os elementos formam uma árvore. Cada um segue o de cima até ser mudado: o
Nível 2 que não diz a fonte usa a de Títulos, que usa a do Texto. O Texto é a
raiz, e tudo herda dele (até a capa e o número da página).

```
Texto
├ Página › Número da página
├ Parágrafo
├ Títulos › Nível 1 (› Título sem número, › Título repetido), Nível 2 … Nível 5
├ Listas · Citação longa · Nota de rodapé
├ Ilustrações › Figura, Tabela, Identificação, Fonte e nota
├ Lista de referências
├ Abertura › Capa, Folha de rosto (› Natureza), Página de título, Dedicatória,
│            Epígrafe, Agradecimentos, Resumo (› Palavras-chave), Sumário
└ Citações e referências
```

A lista completa, com o que cada elemento aceita, está em
`src/modelos/elementos.ts`.

## Como ler um modelo

```
modelo: ABNT
herda de: Em branco, revisão 1
versão: 2025
revisão: 10
data da revisão: 24/11/2026
nota da revisão: o que mudou nesta revisão

== Títulos › Nível 1 ==
# A NBR 6024 manda diferenciar os níveis, mas não diz como.
destaque: maiúsculas, negrito | NBR 6024:2012 (UFSCar) | ajustável
```

- **A ficha**, no começo: o nome do modelo, de quem ele herda (o Em branco não
  herda de ninguém), a versão da norma, a revisão, a data e o que mudou.
- **Cada seção** (`== ... ==`) é um elemento, pelo caminho na árvore.
- **Cada linha** é `propriedade: valor | origem | situação`, como nos perfis:
  - a **origem** diz de onde vem o valor (a norma e o manual onde foi conferido);
  - a **situação** é opcional: sem nada, o valor é confirmado; `ajustável`
    quer dizer que a norma não fixa: o valor é o padrão, e cada trabalho pode
    trocar (nos perfis da versão 1 se chamava `faculdade`); `escolha: a, b`
    dá as opções; `desligada` guarda a regra sem efeito.
- **O comentário** (`#`) logo acima de uma linha, sem linha em branco no meio,
  fica guardado junto com o valor: é a decisão por trás dele.

Um modelo guarda só o que muda em relação ao modelo de onde vem. O que ele não
disser vem do modelo de cima, e assim até o Em branco.

### Atalhos

Algumas linhas escrevem várias propriedades de uma vez:

| Atalho | Onde | Escreve |
| --- | --- | --- |
| `margens` | Página | as quatro margens |
| `fonte e tamanho` | Texto | a fonte e o tamanho ("Arial 11 pt"); uma escolha de pares continua de pares |
| `distância das bordas` | Número da página | a distância vertical e a lateral |
| `espaço antes e depois` | qualquer elemento | as linhas em branco antes e depois |
| `marcador` | Listas | o marcador das listas em sequência e sem sequência |

### Os quatro grupos

Cada propriedade é de um grupo (decisão 3 da versão 2):

- **Aparência:** fonte, tamanho, entrelinha, alinhamento, recuos, destaque e
  espaço em volta.
- **Montagem:** as partes e a ordem delas (rótulos, separadores, campos da capa).
- **Opções:** comportamentos prontos (título na mesma linha do texto, ponto
  final da citação longa). Algumas estão reservadas e ainda não têm efeito:
  numerar os títulos, pôr em maiúsculas e página nova chegam na etapa 2.
- **O que a norma diz:** regras que o Apud guarda e ainda não aplica sozinho
  (a extensão do resumo, a pontuação das alíneas), com o mesmo nome que tinham
  nos perfis.

As regras de **Citações e referências** também mantêm os nomes dos perfis: o
motor de citações e o estilo CSL as leem assim até a etapa 5.

## Como conferir

```
npm run conferir-modelos
```

Mostra cada problema em português, com o número da linha.
