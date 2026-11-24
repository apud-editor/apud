<!--
  TRABALHO DE TESTE DO APUD

  Um TCC em ABNT com todos os elementos que o Apud tem, para o Francisco testar
  cada etapa no programa. As obras são as do documento de prova
  (testes/prova/referencias.json): fictícias, menos a Lei nº 10.216.

  Gerar o .apud: npm run trabalho-de-teste (sai em saida/Trabalho de teste do Apud.apud).
  O script (scripts/trabalho-de-teste.ts) lê este texto com a mesma forma curta
  do documento de prova e acrescenta o que ela não tem:
    **negrito**, *itálico*, ^sobrescrito^    marcas no texto
    1. item                                   lista em sequência
    ::: quebra :::                            quebra de página posta à mão
    [[tabela longa]]                          a tabela de várias páginas
    {só este: propriedade = valor; ...}       exceção no fim de um parágrafo ou título

  O QUE ESTÁ AQUI DE PROPÓSITO
  - Títulos dos 5 níveis; dois com o número escrito à mão ("1 Introdução",
    "1.1 Objetivos"), que o Apud tira sozinho quando numera.
  - Um título sem número ("Apresentação") e um sem maiúsculas, com "só este".
  - Parágrafos com exceção: centralizado, entrelinha simples, sem recuo.
  - Uma quebra de página à mão antes de um Título 1 (a linha "Página nova" não se repete).
  - Níveis 4 e 5 seguidos de parágrafo (na APA saem na mesma linha do texto).
  - Citações de todos os jeitos e dos 10 tipos de obra; duas escritas à mão,
    sem "@", para o reconhecimento ("Tab transformar em citação").
-->

# Apresentação {só este: numerar sozinho = não; página nova = não}

Este trabalho existe para testar o Apud. Cada parte usa um elemento diferente do programa: títulos de cinco níveis, listas, notas de rodapé, figuras, quadros, gráficos, tabelas, citações de todos os jeitos e a lista de referências. O texto conta uma experiência de estágio em saúde mental, com obras fictícias.

Este parágrafo está **centralizado só aqui**, como uma exceção “só este”: os outros parágrafos seguem o alinhamento do modelo. {só este: alinhamento = centralizado}

# 1 Introdução

O acolhimento é a primeira forma de cuidado oferecida a quem chega a um serviço de saúde mental [@silva2019, p. 15]. Segundo @lima2018, ele começa antes da primeira consulta. A Lei da Reforma Psiquiátrica redirecionou o modelo assistencial para serviços abertos [@brasil2001]. A ideia de cuidado em liberdade também aparece em textos de formação (Silva, 2019), e Lima, Costa e Reis (2018) chamam a atenção para a atenção básica.

Neste trabalho, palavras em *itálico* marcam termos estrangeiros, como *setting*, e o **negrito** marca o que é mais importante. Fórmulas simples usam o sobrescrito, como m^2^ ou o 1^o^ atendimento.^[As atividades descritas foram autorizadas pela coordenação do serviço e pelo supervisor de estágio.]

## 1.1 Objetivos

O trabalho tem três objetivos, nesta ordem:

1. descrever o serviço e as atividades do estágio;
2. discutir o acolhimento como prática clínica;
3. apontar os desafios da articulação com a rede.

## Justificativa {só este: maiúsculas sozinho = não}

O relato está dividido em partes que não dependem da ordem de leitura:

- a descrição do serviço;
- a discussão sobre o acolhimento, que se divide em:
  - escuta inicial;
  - encaminhamento;
- as considerações finais.

# Referencial teórico

## A reforma psiquiátrica

A rede de atenção psicossocial depende da articulação entre serviços [@costa2021, p. 12]. O conceito de pulsão já aparecia nos primeiros textos metapsicológicos [Freud, 1915 apud @costa2021, p. 12]. A diferença entre psicopatologia e psicoterapia também é discutida por autores com o mesmo sobrenome [@silvaj2021; @silvam2021].

::: citação-longa
O acolhimento não é uma etapa, um lugar ou uma pessoa: é uma postura ética que atravessa todo o serviço. Ele exige que cada profissional se pergunte, a cada atendimento, o que aquela pessoa precisa e o que o serviço pode oferecer, sem reduzir o sofrimento a uma queixa a ser triada e encaminhada [@silva2019, p. 47, +grifo].
:::

### O vínculo terapêutico

Para @dias2025 [p. 4], o vínculo terapêutico se constrói “na regularidade do encontro e na confiança de que o serviço estará lá” [@dias2025, p. 4]. Grupos terapêuticos também favorecem esse vínculo [@ferraz2024].

#### A supervisão clínica

A supervisão ajuda o estagiário a “sustentar o não saber diante do sofrimento do outro” [@smith2019, p. 4, +tradução]. Técnicas cognitivas podem complementar a escuta [@garcia2015, local. 7].

##### O lugar do estagiário

O estagiário aprende a escutar antes de intervir [@rudio2002; @rudio2003]. Nos primeiros contatos, a escuta qualificada orienta a conduta da equipe [@souza2020a; @souza2020b].

# Método

O estágio aconteceu num serviço que atende adultos com sofrimento psíquico intenso e segue as diretrizes da formação em psicologia [@abep2023]. Dados nacionais mostram a distribuição dos profissionais pelo país [@inpsi2011].

Este parágrafo está com entrelinha simples só aqui, como uma nota de método: os registros de campo foram feitos ao fim de cada turno e revistos na supervisão semanal. {só este: entrelinha = simples}

::: figura
título: Fluxo do acolhimento no serviço
imagem: fluxo-acolhimento.png
fonte: Elaborado pelo próprio autor
:::

::: figura
espécie: quadro
título: Tipos de demanda na chegada ao serviço
imagem: quadro-demandas.png
fonte: Registro do serviço (2026)
:::

As demandas mais comuns aparecem no quadro acima. A tabela abaixo resume os atendimentos de acolhimento nos dois primeiros meses.

::: tabela
título: Atendimentos de acolhimento por mês
dados: | Mês | Atendimentos | ; | Março | 32 | ; | Abril | 41 |
fonte: Registro do serviço (2026)
nota: Contam só os primeiros atendimentos.
:::

::: quebra
:::

A tabela seguinte tem uma linha por semana do estágio e ocupa mais de uma página: no PDF, o título e o cabeçalho se repetem em cada página.

[[tabela longa]]

# Resultados e discussão

::: figura
espécie: gráfico
título: Atendimentos de acolhimento de março a agosto
imagem: grafico-atendimentos.png
largura: 80%
fonte: Registro do serviço (2026)
:::

## Escuta inicial

Uma usuária descreveu assim a chegada ao serviço: “aqui ninguém me apressou” [sem referência: Usuária A]. O supervisor lembrou que o primeiro atendimento define o vínculo [sem referência: R. Melo, comunicação pessoal, 3 de março de 2026].

Este parágrafo começa sem recuo só aqui, para testar a exceção do recuo da primeira linha. {só este: recuo da primeira linha = nenhum}

## Encaminhamento

A avaliação inicial pode usar instrumentos padronizados [@alves2022], com cuidado para não reduzir o sujeito ao diagnóstico, como lembram @alves2022 [p. 40]. Na universidade, o sofrimento psíquico de estudantes tem crescido [@morais2024]. As normas de trabalhos acadêmicos também orientam como relatar essas experiências [@guia2025, p. 3].^[O guia citado é o da própria instituição; outras instituições podem pedir regras diferentes.]

Relatos antigos de internação ajudam a entender o modelo que a reforma superou [@moura201x], assim como cartas e diários de profissionais [@pinto2017; @nunes2016]. A população em situação de rua cresceu na última década [@nogueira2023], e a proteção social a esse grupo ainda é frágil [@freitas2017]. Discursos de gestores circulam em redes sociais [@prado2025] e na imprensa [@abrigo2024], e já foram estudados em eventos científicos [@teles2024].

::: quebra
:::

# Considerações finais

O estágio mostrou que o acolhimento é uma prática de toda a equipe [@lima2018; @silva2019]. A escuta, o vínculo e a articulação com a rede dependem uns dos outros.

::: referências
:::
