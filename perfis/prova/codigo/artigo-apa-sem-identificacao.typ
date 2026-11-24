#set document(title: "Artigo de teste")
#set page(
  paper: "a4",
  margin: (left: 2.54cm, top: 2.54cm, right: 2.54cm, bottom: 2.54cm),
  foreground: context place(top + right, dx: -2.54cm, dy: 1.5cm, text(size: 11pt, top-edge: "cap-height", bottom-edge: "baseline", counter(page).display("1"))),
)
#set text(font: ("Arial", "Liberation Sans"), size: 11pt, lang: "pt", region: "BR", top-edge: 0.8em, bottom-edge: -0.35em, hyphenate: false, overhang: false)
#set par(justify: false, leading: 1.15em, spacing: 1.15em, first-line-indent: (amount: 1.27cm, all: true))
#let destaque-do-titulo(n, x) = {
  if n == 1 { strong(x) }
  else if n == 2 { strong(x) }
  else if n == 3 { emph(strong(x)) }
  else if n == 4 { strong(x) }
  else if n == 5 { emph(strong(x)) }
  else { x }
}
#let posicao-do-titulo(n, x) = {
  if n == 1 { align(center, x) }
  else if n == 2 { x }
  else if n == 3 { x }
  else if n == 4 { pad(left: 1.27cm, x) }
  else if n == 5 { pad(left: 1.27cm, x) }
  else { x }
}
#show heading: it => {
  set par(justify: false, first-line-indent: 0pt)
  let d(x) = destaque-do-titulo(it.level, x)
  let corpo = if it.numbering == none { d(it.body) } else { grid(columns: (auto, 1fr), column-gutter: 0.25em, d(counter(heading).display(it.numbering)), d(it.body)) }
  block(width: 100%, above: 1.15em + 0 * 2.3em, below: 1.15em + 0 * 2.3em, sticky: true, posicao-do-titulo(it.level, corpo))
}
#show heading: set text(size: 11pt, weight: "regular")
#set footnote.entry(separator: box(height: 0.5em, line(length: 5cm, stroke: 0.5pt)), clearance: 1.15em, gap: 0em, indent: 0pt)
#show footnote.entry: it => {
  let n = numbering(it.note.numbering, ..counter(footnote).at(it.note.location()))
  set text(size: 10pt)
  set par(justify: false, leading: 0em, spacing: 0em, first-line-indent: 0pt)
  [#super(n) #it.note.body]
}
#let alinea(recuo, marcador, corpo) = block(above: 1.15em, below: 1.15em, pad(left: recuo, grid(columns: (auto, 1fr), column-gutter: 0.25em, marcador, {
  set par(first-line-indent: 0pt)
  corpo
})))

#{
  set par(first-line-indent: 0pt, justify: false, leading: 1.15em, spacing: 1.15em)
  set align(center)
  v(3 * 2.3em)
  [#strong[O acolhimento em saúde mental: relato de uma experiência de estágio]]
  v(1 * 2.3em)
  [Psicologia, Universidade do Vale do Itajaí]
}
#pagebreak()

#align(center, heading(level: 1, numbering: none, outlined: false)[Resumo])
#{
  set text(lang: "pt", region: "BR")
  set par(justify: false, leading: 1.15em, spacing: 1.15em, first-line-indent: (amount: 0pt, all: true))
  [Este trabalho relata a experiência de estágio em um serviço de saúde mental\, com foco no acolhimento das pessoas que chegam ao serviço\. Descreve as atividades de escuta inicial e de encaminhamento e discute o acolhimento como prática clínica\, a partir da literatura da #emph[reforma psiquiátrica] brasileira\. Conclui que o acolhimento é o primeiro momento do cuidado e pede escuta qualificada de toda a equipe\.]
  parbreak()
  set par(first-line-indent: (amount: 1.27cm, all: true))
  [#emph[Palavras\-chave\:] acolhimento\, saúde mental\, estágio\, Psicologia]
}
#pagebreak()

#align(center, block(below: 2.3em)[#strong[Welcoming in mental health\: an internship experience report]])
#align(center, heading(level: 1, numbering: none, outlined: false)[Abstract])
#{
  set text(lang: "en")
  set par(justify: false, leading: 1.15em, spacing: 1.15em, first-line-indent: (amount: 0pt, all: true))
  [This paper reports an internship experience in a mental health service\, focusing on how people are welcomed when they arrive\. It describes the initial listening and referral activities and discusses welcoming as a clinical practice\, based on the literature of the Brazilian psychiatric reform\. It concludes that welcoming is the first moment of care and requires qualified listening from the whole team\.]
  parbreak()
  set par(first-line-indent: (amount: 1.27cm, all: true))
  [#emph[Keywords\:] welcoming\, mental health\, internship\, Psychology]
}
#pagebreak()

#metadata("texto") <apud-texto>
#heading(level: 1, numbering: none, outlined: false)[O acolhimento em saúde mental: relato de uma experiência de estágio]

#heading(level: 1, numbering: none)[Introdução]

O acolhimento é a primeira forma de cuidado oferecida a quem chega a um serviço de saúde mental #cite(label("silva2019"), form: none)\(J\. P\. Silva\, 2019\, p\. 15\)\. Segundo #cite(label("lima2018"), form: none)Lima et al\. \(2018\)\, ele começa antes da primeira consulta\. A Lei da Reforma Psiquiátrica redirecionou o modelo assistencial para serviços abertos #cite(label("brasil2001"), form: none)\(Lei nº 10\.216\, 2001\)\.

Este relato está dividido em três partes\:

#alinea(1.27cm, [•], [a descrição do serviço e das atividades\;])
#alinea(1.27cm, [•], [a discussão sobre o acolhimento\, que se divide em\:])
#alinea(1.27cm + 1 * 1.27cm, [•], [escuta inicial\;])
#alinea(1.27cm + 1 * 1.27cm, [•], [encaminhamento\;])
#alinea(1.27cm, [•], [as considerações finais\.])

#heading(level: 1, numbering: none)[Desenvolvimento]

#heading(level: 2, numbering: none)[O serviço de saúde mental]

O serviço atende adultos com sofrimento psíquico intenso e segue as diretrizes da formação em psicologia #cite(label("abep2023"), form: none)\(Associação Brasileira de Ensino de Psicologia\, 2023\)\. Dados nacionais mostram a distribuição dos profissionais pelo país #cite(label("inpsi2011"), form: none)\(INPSI\, 2011\)\.#footnote[As atividades descritas foram autorizadas pela coordenação do serviço e pelo supervisor de estágio\.]

#heading(level: 3, numbering: none)[Atividades realizadas]

#heading(level: 4, numbering: none)[Escuta inicial\.]

#destaque-do-titulo(5, [Primeiros contatos\.]) Nos primeiros contatos\, a escuta qualificada orienta a conduta da equipe #cite(label("souza2020a"), form: none)#cite(label("souza2020b"), form: none)\(Souza\, 2020a\, 2020b\)\. Uma usuária descreveu assim a chegada ao serviço\: “aqui ninguém me apressou” \(Usuária A\)\. O supervisor lembrou que o primeiro atendimento define o vínculo \(R\. Melo\, comunicação pessoal\, 3 de março de 2026\)\.

#block(above: 1.15em + 1 * 2.3em, below: 1.15em + 1 * 2.3em, breakable: false, width: 100%)[
#set par(first-line-indent: 0pt, justify: false)
#block(above: 0pt, below: 1.15em, sticky: true)[#strong[Figura 1]]
#block(above: 0pt, below: 1.15em, sticky: true)[#emph[Fluxo do acolhimento no serviço]]
#block(above: 0pt, below: 0pt, width: 100%, align(center, block(width: 100%)[#image("/imagens/0-6a4e80a049583610.png", width: 100%)]))
]

#destaque-do-titulo(4, [Encaminhamento\.]) A rede de atenção psicossocial depende da articulação entre serviços #cite(label("costa2021"), form: none)\(Costa\, 2021\, p\. 12\)\. A avaliação inicial pode usar instrumentos padronizados #cite(label("alves2022"), form: none)\(Alves et al\.\, 2022\)\, com cuidado para não reduzir o sujeito ao diagnóstico\, como lembram #cite(label("alves2022"), form: none)Alves et al\. \(2022\, p\. 40\)\.

#block(above: 1.15em + 1 * 2.3em, below: 1.15em + 1 * 2.3em, width: 100%, {
let grade(colunas, topo: true) = {
  set par(leading: 0em, spacing: 0em)
  let ultima = 2
  table(columns: colunas, stroke: (x, y) => if y == ultima { (bottom: 0.5pt) } else { none }, inset: (x: 0.4em, y: 0.15em), align: (x, y) => if y < 1 { center } else if x == 0 { left } else { center },
    table.header(repeat: true, table.hline(stroke: 0.5pt), [Mês], [Atendimentos], table.hline(stroke: 0.5pt),),
    [Março], [32], [Abril], [41],
    table.cell(colspan: 2, inset: 0pt, breakable: false)[],
  )
}
[
#set align(left)
#set par(first-line-indent: 0pt, justify: false)
#block(above: 0pt, below: 1.15em, sticky: true)[#strong[Tabela 1]]
#block(above: 0pt, below: 1.15em, sticky: true)[#emph[Atendimentos de acolhimento por mês]]
#block(above: 0pt, below: 0pt, grade((auto, ..((1fr,) * 1))))
#block(above: 1.15em + 0.3em, below: 0pt)[#set text(size: 11pt); #set par(leading: 1.15em, spacing: 1.15em); #emph[Nota\.] Registro do serviço \(2026\)]
]
})

#heading(level: 2, numbering: none)[O acolhimento como prática clínica]

Para #cite(label("dias2025"), form: none)Dias e Lopes \(2025\, p\. 4\)\, o vínculo terapêutico se constrói “na regularidade do encontro e na confiança de que o serviço estará lá” #cite(label("dias2025"), form: none)\(Dias \& Lopes\, 2025\, p\. 4\)\. Grupos terapêuticos também favorecem esse vínculo #cite(label("ferraz2024"), form: none)\(Ferraz\, 2024\)\.

O conceito de pulsão já aparecia nos primeiros textos metapsicológicos #cite(label("costa2021"), form: none)\(Freud\, 1915\, como citado em Costa\, 2021\, p\. 12\)\. A diferença entre psicopatologia e psicoterapia também é discutida por autores com o mesmo sobrenome #cite(label("silvaj2021"), form: none)#cite(label("silvam2021"), form: none)\(J\. Silva\, 2021\; M\. Silva\, 2021\)\. A pesquisa clínica tem uma longa tradição de orientação não diretiva #cite(label("rudio2002"), form: none)#cite(label("rudio2003"), form: none)\(Rudio\, 2002\, 2003\)\.

#block(above: 1.15em, below: 1.15em, pad(left: 1.27cm)[
#set text(size: 11pt)
#set par(first-line-indent: 0pt, leading: 1.15em, spacing: 1.15em)
O acolhimento não é uma etapa\, um lugar ou uma pessoa\: é uma postura ética que atravessa todo o serviço\. Ele exige que cada profissional se pergunte\, a cada atendimento\, o que aquela pessoa precisa e o que o serviço pode oferecer\, sem reduzir o sofrimento a uma queixa a ser triada e encaminhada\. #cite(label("silva2019"), form: none)\(J\. P\. Silva\, 2019\, p\. 47\)
])

A supervisão clínica ajuda o estagiário a “sustentar o não saber diante do sofrimento do outro” #cite(label("smith2019"), form: none)\(Smith\, 2019\, p\. 4\, tradução nossa\)\. Técnicas cognitivas podem complementar a escuta #cite(label("garcia2015"), form: none)\(Garcia\, 2015\, local\. 7\)\.

Na universidade\, o sofrimento psíquico de estudantes tem crescido #cite(label("morais2024"), form: none)\(Morais\, 2024\)\. As normas de trabalhos acadêmicos também orientam como relatar essas experiências #cite(label("guia2025"), form: none)\(#emph[Guia de normalização de trabalhos acadêmicos]\, 2025\, p\. 3\)\. Relatos antigos de internação ajudam a entender o modelo que a reforma superou #cite(label("moura201x"), form: none)\(Moura\, s\.d\.\)\, assim como cartas e diários de profissionais #cite(label("pinto2017"), form: none)#cite(label("nunes2016"), form: none)\(Nunes\, 2016\; Pinto\, 2017\)\.

A população em situação de rua cresceu na última década #cite(label("nogueira2023"), form: none)\(Nogueira\, 2023\)\, e a proteção social a esse grupo ainda é frágil #cite(label("freitas2017"), form: none)\(Freitas\, 2017\)\. Discursos de gestores circulam em redes sociais #cite(label("prado2025"), form: none)\(Prado\, 2025\) e na imprensa #cite(label("abrigo2024"), form: none)\(“Abrigo municipal amplia vagas no inverno”\, 2024\)\, e já foram estudados em eventos científicos #cite(label("teles2024"), form: none)\(Teles \& Andrade\, 2024\)\.

#heading(level: 1, numbering: none)[Considerações finais]

O estágio mostrou que o acolhimento é uma prática de toda a equipe #cite(label("lima2018"), form: none)#cite(label("silva2019"), form: none)\(Lima et al\.\, 2018\; J\. P\. Silva\, 2019\)\.

#align(center, heading(level: 1, numbering: none, outlined: true)[Referências])
#{
  set par(justify: false, first-line-indent: 0pt, hanging-indent: 1.27cm, leading: 1.15em, spacing: 1.15em + 0 * 1.15em)
  set block(spacing: 1.15em + 0 * 1.15em)

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
  bibliography(bytes(<sha256 5fd0975ead7dd645352696c4bd4a7d13, 9260 caracteres>), style: bytes(<sha256 5ed28206e73c4b40056169c6eef6b848, 103437 caracteres>), title: none)
}

