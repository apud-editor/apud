#set document(title: "Documento de prova")
#set page(
  paper: "a4",
  margin: (left: 3cm, top: 3cm, right: 2cm, bottom: 2cm),
  foreground: context { let i = query(<apud-texto>); if i.len() == 0 or here().page() >= i.first().location().page() { place(top + right, dx: -2cm, dy: 2cm, text(size: 10pt, top-edge: "cap-height", bottom-edge: "baseline", counter(page).display("1"))) } },
)
#set text(font: ("Arial", "Liberation Sans"), size: 12pt, lang: "pt", region: "BR", top-edge: 0.8em, bottom-edge: -0.35em, hyphenate: false, overhang: false)
#set par(justify: true, leading: 0.575em, spacing: 0.575em, first-line-indent: (amount: 1.5cm, all: true))
#let destaque-do-titulo(n, x) = {
  if n == 1 { strong(x) }
  else if n == 2 { x }
  else if n == 3 { strong(x) }
  else if n == 4 { x }
  else if n == 5 { emph(x) }
  else { x }
}
#let posicao-do-titulo(n, x) = {
  if n == 1 { x }
  else if n == 2 { x }
  else if n == 3 { x }
  else if n == 4 { x }
  else if n == 5 { x }
  else { x }
}
#show heading: it => {
  set par(justify: false, first-line-indent: 0pt)
  let d(x) = destaque-do-titulo(it.level, x)
  let corpo = if it.numbering == none { d(it.body) } else { grid(columns: (auto, 1fr), column-gutter: 0.25em, d(counter(heading).display(it.numbering)), d(it.body)) }
  block(width: 100%, above: 0.575em + 1 * 1.725em, below: 0.575em + 1 * 1.725em, sticky: true, posicao-do-titulo(it.level, corpo))
}
#show heading: set text(size: 12pt, weight: "regular")
#set footnote.entry(separator: box(height: 0.5em, line(length: 5cm, stroke: 0.5pt)), clearance: 1.15em, gap: 0em, indent: 0pt)
#show footnote.entry: it => {
  let n = numbering(it.note.numbering, ..counter(footnote).at(it.note.location()))
  set text(size: 10pt)
  set par(justify: true, leading: 0em, spacing: 0em, first-line-indent: 0pt)
  grid(columns: (auto, 1fr), column-gutter: 0.2em, super(n), it.note.body)
}
#let alinea(recuo, marcador, corpo) = block(above: 0.575em, below: 0.575em, pad(left: recuo, grid(columns: (auto, 1fr), column-gutter: 0.25em, marcador, {
  set par(first-line-indent: 0pt)
  corpo
})))

#block(width: 100%, height: 100%, {
  set par(first-line-indent: 0pt, justify: false)
  align(center, grid(rows: (auto, 1fr, auto, 1fr, auto, 2fr, auto), [Universidade do Vale do Itajaí \
Psicologia], [], [Ana Beatriz Souza \
Carlos Eduardo Lima], [], [#strong[O acolhimento em saúde mental]: relato de uma experiência de estágio], [], [Itajaí \
2026]))
})
#pagebreak()

#counter(page).update(1)
#block(width: 100%, height: 100%, {
  set par(first-line-indent: 0pt, justify: false)
  grid(rows: (auto, 1fr, auto, auto, 1fr, auto), align(center)[Ana Beatriz Souza \
Carlos Eduardo Lima], [], align(center)[#strong[O acolhimento em saúde mental]: relato de uma experiência de estágio], [#v(2 * 1.725em)#pad(left: 50%, {
  set par(justify: true, leading: 0em, spacing: 1.725em)
  [Trabalho apresentado à disciplina de Estágio Básico em Psicologia\, do curso de Psicologia da Universidade do Vale do Itajaí\, como requisito parcial para aprovação na disciplina\.

Professor\(a\)\: Profa\. Dra\. Marta Ribeiro]
})], [], align(center)[Itajaí \
2026])
})
#pagebreak()

#block(width: 100%, height: 100%, {
  set par(first-line-indent: 0pt, justify: false)
  align(bottom, pad(left: 50%, {
  set par(justify: true, leading: 0.575em, spacing: 0.575em)
  [Às equipes dos serviços de saúde mental\, que acolhem todos os dias\.]
}))
})
#pagebreak()

#align(center, heading(level: 1, numbering: none, outlined: false)[AGRADECIMENTOS])
À professora orientadora\, pela escuta atenta e pelas leituras do texto\.

Aos colegas de estágio e à equipe do serviço\, que abriram as portas para este trabalho\.
#pagebreak()

#block(width: 100%, height: 100%, {
  set par(first-line-indent: 0pt, justify: false)
  align(bottom, pad(left: 50%, {
  set par(justify: true, leading: 0.575em, spacing: 0.575em)
  [Ninguém escapa ao sonho de voar\, de ultrapassar os limites do espaço onde nasceu\.

#align(right)[Rubem Alves]]
}))
})
#pagebreak()

#align(center, heading(level: 1, numbering: none, outlined: false)[RESUMO])
#{
  set text(lang: "pt", region: "BR")
  set par(justify: true, leading: 0em, spacing: 0em, first-line-indent: (amount: 0pt, all: true))
  [Este trabalho relata a experiência de estágio em um serviço de saúde mental\, com foco no acolhimento das pessoas que chegam ao serviço\. Descreve as atividades de escuta inicial e de encaminhamento e discute o acolhimento como prática clínica\, a partir da literatura da #emph[reforma psiquiátrica] brasileira\. Conclui que o acolhimento é o primeiro momento do cuidado e pede escuta qualificada de toda a equipe\.]
  parbreak()
  v(1 * 1.15em)
  set par(first-line-indent: (amount: 0pt, all: true))
  [#strong[Palavras\-chave\:] acolhimento\; saúde mental\; estágio\; Psicologia\.]
}
#pagebreak()

#align(center, block(below: 1.725em)[#strong[Welcoming in mental health\: an internship experience report]])
#align(center, heading(level: 1, numbering: none, outlined: false)[ABSTRACT])
#{
  set text(lang: "en")
  set par(justify: true, leading: 0em, spacing: 0em, first-line-indent: (amount: 0pt, all: true))
  [This paper reports an internship experience in a mental health service\, focusing on how people are welcomed when they arrive\. It describes the initial listening and referral activities and discusses welcoming as a clinical practice\, based on the literature of the Brazilian psychiatric reform\. It concludes that welcoming is the first moment of care and requires qualified listening from the whole team\.]
  parbreak()
  v(1 * 1.15em)
  set par(first-line-indent: (amount: 0pt, all: true))
  [#strong[Keywords\:] welcoming\; mental health\; internship\; Psychology\.]
}
#pagebreak()

#align(center, heading(level: 1, numbering: none, outlined: false)[SUMÁRIO])
#{
  set par(first-line-indent: 0pt, justify: false, leading: 0.575em, spacing: 0.575em)
  show outline.entry: it => context {
    let numeros = ()
    let largura = calc.max(0pt, ..numeros.map(x => measure(x).width))
    let numero = if it.element.numbering == none { [] } else { destaque-do-titulo(it.level, numbering(it.element.numbering, ..counter(heading).at(it.element.location()))) }
    let recuo = if largura == 0pt { 0pt } else { largura + 0.5em }
    block(above: 0.575em, below: 0.575em, link(it.element.location(), par(hanging-indent: recuo)[#numero#h(recuo - measure(numero).width)#destaque-do-titulo(it.level, it.body()) #box(width: 1fr, repeat(gap: 0.15em)[.]) #it.page()]))
  }
  outline(title: none, depth: 5)
}
#pagebreak()

#metadata("texto") <apud-texto>
#heading(level: 1, numbering: none)[Introdução]

O acolhimento é a primeira forma de cuidado oferecida a quem chega a um serviço de saúde mental #cite(label("silva2019"), form: none)\(Silva\, 2019\, p\. 15\)\. Segundo #cite(label("lima2018"), form: none)Lima\, Costa e Reis \(2018\)\, ele começa antes da primeira consulta\. A Lei da Reforma Psiquiátrica redirecionou o modelo assistencial para serviços abertos #cite(label("brasil2001"), form: none)\(Brasil\, 2001\)\.

Este relato está dividido em três partes\:

#alinea(1.25cm, [a\)], [a descrição do serviço e das atividades\;])
#alinea(1.25cm, [b\)], [a discussão sobre o acolhimento\, que se divide em\:])
#alinea(1.25cm + 1 * 1.25cm, [—], [escuta inicial\;])
#alinea(1.25cm + 1 * 1.25cm, [—], [encaminhamento\;])
#alinea(1.25cm, [c\)], [as considerações finais\.])

#heading(level: 1, numbering: none)[Desenvolvimento]

#heading(level: 2, numbering: none)[O serviço de saúde mental]

O serviço atende adultos com sofrimento psíquico intenso e segue as diretrizes da formação em psicologia #cite(label("abep2023"), form: none)\(Associação Brasileira de Ensino de Psicologia\, 2023\)\. Dados nacionais mostram a distribuição dos profissionais pelo país #cite(label("inpsi2011"), form: none)\(INPSI\, 2011\)\.#footnote[As atividades descritas foram autorizadas pela coordenação do serviço e pelo supervisor de estágio\.]

#heading(level: 3, numbering: none)[Atividades realizadas]

#heading(level: 4, numbering: none)[Escuta inicial]

#heading(level: 5, numbering: none)[Primeiros contatos]

Nos primeiros contatos\, a escuta qualificada orienta a conduta da equipe #cite(label("souza2020a"), form: none)#cite(label("souza2020b"), form: none)\(Souza\, 2020a\, 2020b\)\. Uma usuária descreveu assim a chegada ao serviço\: “aqui ninguém me apressou” \(Usuária A\)\. O supervisor lembrou que o primeiro atendimento define o vínculo \(R\. Melo\, comunicação pessoal\, 3 de março de 2026\)\.

#block(above: 0.575em + 1 * 1.725em, below: 0.575em + 1 * 1.725em, breakable: false, width: 100%, align(center, block(width: 100%)[
#set align(left)
#set par(first-line-indent: 0pt, justify: false)
#block(above: 0pt, below: 0.575em, sticky: true)[Figura 1 – Fluxo do acolhimento no serviço]
#block(above: 0pt, below: 0pt)[#image("/imagens/0-6a4e80a049583610.png", width: 100%)]
#block(above: 0em + 0.3em, below: 0pt)[#set text(size: 10pt); #set par(leading: 0em, spacing: 0em); Fonte\: Elaborado pelo próprio autor]
]))

#heading(level: 4, numbering: none)[Encaminhamento]

A rede de atenção psicossocial depende da articulação entre serviços #cite(label("costa2021"), form: none)\(Costa\, 2021\, p\. 12\)\. A avaliação inicial pode usar instrumentos padronizados #cite(label("alves2022"), form: none)\(Alves\; Brito\; Cunha\; Dias\, 2022\)\, com cuidado para não reduzir o sujeito ao diagnóstico\, como lembram #cite(label("alves2022"), form: none)Alves\, Brito\, Cunha e Dias \(2022\, p\. 40\)\.

#block(above: 0.575em + 1 * 1.725em, below: 0.575em + 1 * 1.725em, width: 100%)[#layout(espaco => {
let grade(colunas, topo: true) = {
  set par(leading: 0em, spacing: 0em)
  let ultima = 2 + if topo { 1 } else { 0 }
  table(columns: colunas, stroke: (x, y) => if y == ultima { (bottom: 0.5pt) } else { none }, inset: (x: 0.4em, y: 0.15em), align: (x, y) => if y < 2 { center } else if x == 0 { left } else { center },
    table.header(repeat: true, ..if topo { (table.cell(colspan: 2, align: left, inset: (x: 0pt, top: 0pt, bottom: 0.575em))[#set par(leading: 0.575em, spacing: 0.575em); Tabela 1 – Atendimentos de acolhimento por mês #context {
  let ini = locate(<apud-tabela-1-inicio>).page()
  let fim = locate(<apud-tabela-1-fim>).page()
  let aqui = here().page()
  if ini != fim {
    block(above: 0.575em, below: 0pt, width: 100%, align(right, if aqui == ini [\(continua\)] else if aqui == fim [\(conclusão\)] else [\(continuação\)]))
  }
}],) } else { () }, table.hline(stroke: 0.5pt), [Mês], [Atendimentos], table.hline(stroke: 0.5pt),),
    [#metadata(none)<apud-tabela-1-inicio>Março], [32], [#metadata(none)<apud-tabela-1-fim>Abril], [41],
    table.cell(colspan: 2, inset: 0pt, breakable: false)[],
  )
}
  let natural = measure(grade((auto,) * 2, topo: false), width: espaco.width).width
  let doTitulo = measure([Tabela 1 – Atendimentos de acolhimento por mês], width: espaco.width).width
  let largura = calc.min(calc.max(natural, doTitulo), espaco.width)
  let final = if doTitulo > natural { grade((1fr,) * 2) } else { grade((auto,) * 2) }
  align(center, block(width: largura)[
#set align(left)
#set par(first-line-indent: 0pt, justify: false)
#block(above: 0pt, below: 0pt, final)
#block(above: 0em + 0.3em, below: 0pt)[#set text(size: 10pt); #set par(leading: 0em, spacing: 0em); Fonte\: Registro do serviço \(2026\)]
])
})]

#heading(level: 2, numbering: none)[O acolhimento como prática clínica]

Para #cite(label("dias2025"), form: none)Dias e Lopes \(2025\, p\. 4\)\, o vínculo terapêutico se constrói “na regularidade do encontro e na confiança de que o serviço estará lá” #cite(label("dias2025"), form: none)\(Dias\; Lopes\, 2025\, p\. 4\)\. Grupos terapêuticos também favorecem esse vínculo #cite(label("ferraz2024"), form: none)\(Ferraz\, 2024\)\.

O conceito de pulsão já aparecia nos primeiros textos metapsicológicos #cite(label("costa2021"), form: none)\(Freud\, 1915 #emph[apud] Costa\, 2021\, p\. 12\)\. A diferença entre psicopatologia e psicoterapia também é discutida por autores com o mesmo sobrenome #cite(label("silvaj2021"), form: none)#cite(label("silvam2021"), form: none)\(Silva\, J\.\, 2021\; Silva\, M\.\, 2021\)\. A pesquisa clínica tem uma longa tradição de orientação não diretiva #cite(label("rudio2002"), form: none)#cite(label("rudio2003"), form: none)\(Rudio\, 2002\, 2003\)\.

#block(above: 0.575em + 1 * 1.725em, below: 0.575em + 1 * 1.725em, pad(left: 4cm)[
#set text(size: 10pt)
#set par(first-line-indent: 0pt, leading: 0em, spacing: 0em)
O acolhimento não é uma etapa\, um lugar ou uma pessoa\: é uma postura ética que atravessa todo o serviço\. Ele exige que cada profissional se pergunte\, a cada atendimento\, o que aquela pessoa precisa e o que o serviço pode oferecer\, sem reduzir o sofrimento a uma queixa a ser triada e encaminhada #cite(label("silva2019"), form: none)\(Silva\, 2019\, p\. 47\, grifo nosso\)\.
])

A supervisão clínica ajuda o estagiário a “sustentar o não saber diante do sofrimento do outro” #cite(label("smith2019"), form: none)\(Smith\, 2019\, p\. 4\, tradução nossa\)\. Técnicas cognitivas podem complementar a escuta #cite(label("garcia2015"), form: none)\(Garcia\, 2015\, local\. 7\)\.

Na universidade\, o sofrimento psíquico de estudantes tem crescido #cite(label("morais2024"), form: none)\(Morais\, 2024\)\. As normas de trabalhos acadêmicos também orientam como relatar essas experiências #cite(label("guia2025"), form: none)\(Guia \[\.\.\.\]\, 2025\, p\. 3\)\. Relatos antigos de internação ajudam a entender o modelo que a reforma superou #cite(label("moura201x"), form: none)\(Moura\, \[201\-\?\]\)\, assim como cartas e diários de profissionais #cite(label("pinto2017"), form: none)#cite(label("nunes2016"), form: none)\(Nunes\, 2016\; Pinto\, 2017\)\.

A população em situação de rua cresceu na última década #cite(label("nogueira2023"), form: none)\(Nogueira\, 2023\)\, e a proteção social a esse grupo ainda é frágil #cite(label("freitas2017"), form: none)\(Freitas\, 2017\)\. Discursos de gestores circulam em redes sociais #cite(label("prado2025"), form: none)\(Prado\, 2025\) e na imprensa #cite(label("abrigo2024"), form: none)\(Abrigo \[\.\.\.\]\, 2024\)\, e já foram estudados em eventos científicos #cite(label("teles2024"), form: none)\(Teles\; Andrade\, 2024\)\.

#heading(level: 1, numbering: none)[Considerações finais]

O estágio mostrou que o acolhimento é uma prática de toda a equipe #cite(label("lima2018"), form: none)#cite(label("silva2019"), form: none)\(Lima\; Costa\; Reis\, 2018\; Silva\, 2019\)\.

#align(center, heading(level: 1, numbering: none, outlined: true)[REFERÊNCIAS])
#{
  set par(justify: false, first-line-indent: 0pt, hanging-indent: 0pt, leading: 0em, spacing: 1 * 1.15em)
  set block(spacing: 1 * 1.15em)

  let apud-fim-do-texto(c) = {
    if c.has("text") { c.text }
    else if c.has("body") { apud-fim-do-texto(c.body) }
    else if c.has("child") { apud-fim-do-texto(c.child) }
    else if c.has("children") and c.children.len() > 0 { apud-fim-do-texto(c.children.last()) }
    else { "" }
  }
  // Devolve (o conteúdo sem o ponto dobrado, o texto em que ele termina). Desce
  // pelas sequências e pelos invólucros (menos negrito e itálico), levando o fim
  // do texto anterior, porque o ponto pode estar numa camada e o "?" noutra.
  let apud-tira-ponto(c, anterior) = {
    if type(c) != content { return (c, anterior) }
    if c.has("text") {
      if c.text.starts-with(".") and (anterior.ends-with("?") or anterior.ends-with("!")) {
        let resto = c.text.slice(1)
        return (text(resto), if resto == "" { anterior } else { resto })
      }
      return (c, if c.text == "" { anterior } else { c.text })
    }
    if c.has("children") {
      let saida = ()
      let fim = anterior
      for filho in c.children {
        let (novo, f) = apud-tira-ponto(filho, fim)
        saida.push(novo)
        fim = f
      }
      return (saida.join(), fim)
    }
    if c.func() != strong and c.func() != emph and c.has("body") and type(c.body) == content {
      let (novo, f) = apud-tira-ponto(c.body, anterior)
      return (if novo == c.body { c } else { novo }, f)
    }
    let t = apud-fim-do-texto(c)
    (c, if t == "" { anterior } else { t })
  }
  show block: it => {
    if type(it.body) != content { return it }
    let (novo, _) = apud-tira-ponto(it.body, "")
    if novo == it.body { it } else { let f = it.fields(); let _ = f.remove("body"); block(..f, novo) }
  }
  show regex("[?!]\\.( |$)"): m => m.text.slice(0, 1) + m.text.slice(2)

  show link: set text(lang: "en")
  bibliography(bytes(<sha256 3f2b6f907c26d29fc8372291e11040d1, 9395 caracteres>), style: bytes(<sha256 5dd4242eff307c5b83a6de38bd9403d4, 26260 caracteres>), title: none)
}

