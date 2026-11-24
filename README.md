# Apud

Editor de texto acadêmico em que você escreve o conteúdo e a ferramenta aplica a norma (ABNT ou APA) sozinha.

**Estado atual:** versão 2 em construção. A etapa 1 trocou os perfis de norma por modelos em árvore (pasta `modelos/`), sem mudar o que a pessoa vê; os trabalhos são gravados no .apud versão 5, que leva uma cópia do modelo.

## Como o projeto é organizado

| Pasta ou arquivo | O que é |
| --- | --- |
| `src/` | A interface (o que aparece na janela), feita com React e TypeScript |
| `src-tauri/` | O programa de computador em volta da interface, feito com Tauri (Rust) |
| `src-tauri/tauri.conf.json` | Nome, versão, tamanho da janela e opções do instalador |
| `src-tauri/icons/` | Ícones do programa |
| `.github/workflows/` | Receitas do GitHub: montar o instalador de Windows e rodar os testes |
| `modelos/` | Modelos de norma (Em branco, ABNT e APA), o exemplo de uma faculdade e os estilos de citação. Guia em `modelos/LEIA-ME.md` |
| `testes/` | Documento de prova (`testes/prova`), com os gabaritos, e os artigos de teste (`testes/artigos`) |
| `src/documento/` | O modelo do documento: como o Apud guarda um trabalho (blocos com significado, sem formatação) |
| `src/conversor/` | O conversor: junta o texto com o modelo da norma e escreve o código Typst; e o motor Typst, que monta a prévia e o PDF |
| `public/fontes/` | Fontes Liberation, de reserva, com as mesmas medidas da Times New Roman e da Arial (licença na mesma pasta) |
| `src/arquivos/` | O formato do arquivo .apud (texto JSON legível), o salvamento automático e a ponte com o disco |
| `src/telas/` | As telas: o painel com a lista de trabalhos e a tela do trabalho |
| `src-tauri/arquivos/` | Gravação segura dos arquivos no disco (Rust), com testes próprios: `cargo test` nesta pasta |
| `src/editor/` | O editor de texto (TipTap): blocos aceitos, barra "/", colagem sem formatação e a tela |
| `src/modelos/` | Os modelos: a árvore de elementos, a leitura e a conferência dos arquivos de modelo (mensagens em português), as heranças e a cópia do modelo no .apud |
| `src/perfis/` | O que as citações ainda leem na forma da versão 1 (esquema das regras e ajuste do estilo CSL), até a etapa 5 |
| `src/citacoes/` | Primeiro pedaço do motor de citações: prepara as referências e monta as chamadas |
| `scripts/` | Comandos de conferência: `npm run conferir-modelos`, `npm run codigo`, `npm run prova` e `npm run artigos` |

## Como baixar a versão de teste

1. Abra a aba **Releases** deste repositório.
2. Entre na versão mais recente ("Apud (teste N)").
3. Baixe o arquivo `.exe` e execute.

O Windows vai mostrar "O Windows protegeu o computador", porque o programa ainda não tem assinatura digital.
Clique em **Mais informações** e depois em **Executar assim mesmo**.

## Para quem for programar

```
npm install        # instala as dependências
npm run dev        # abre a interface no navegador (modo de prévia)
npm run tauri dev  # abre o programa de computador (precisa de Rust instalado)
npm run build      # confere e compila a interface
npm test           # testes (modelos, gabarito do código, documento de prova, editor, arquivos)
cargo test --manifest-path src-tauri/arquivos/Cargo.toml  # testes da gravação dos arquivos
npm run conferir-modelos  # confere os modelos da pasta modelos/
npm run codigo     # código Typst da prova e dos artigos, comparado com o gabarito
npm run prova      # documento de prova no Typst, comparado com os gabaritos
npm run artigos    # artigos de teste reais: .apud, PDF e comparação com o original
npm run exemplo-pdf  # PDF de um texto de exemplo em ABNT (testes/prova/saida/)
```
