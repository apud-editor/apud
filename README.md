# Apud

Editor de texto acadêmico em que você escreve o conteúdo e a ferramenta aplica a norma (ABNT ou APA) sozinha.

**Estado atual:** fase 1 (esqueleto) completa: o editor (títulos, parágrafos, listas, negrito, itálico, sobrescrito e a barra "/"), o painel com a lista de trabalhos, o salvamento automático em arquivos .apud (pasta Documentos\Apud), a prévia do PDF ao lado do texto e a exportação em PDF, com as regras do perfil ABNT.

## Como o projeto é organizado

| Pasta ou arquivo | O que é |
| --- | --- |
| `src/` | A interface (o que aparece na janela), feita com React e TypeScript |
| `src-tauri/` | O programa de computador em volta da interface, feito com Tauri (Rust) |
| `src-tauri/tauri.conf.json` | Nome, versão, tamanho da janela e opções do instalador |
| `src-tauri/icons/` | Ícones do programa |
| `.github/workflows/` | Receitas do GitHub: montar o instalador de Windows e rodar os testes |
| `perfis/` | Perfis de norma (ABNT e APA), estilos de citação e documento de prova. Guia em `perfis/LEIA-ME.md` |
| `src/documento/` | O modelo do documento: como o Apud guarda um trabalho (blocos com significado, sem formatação) |
| `src/conversor/` | O conversor: junta o texto com o perfil da norma e escreve o código Typst; e o motor Typst, que monta a prévia e o PDF |
| `public/fontes/` | Fontes Liberation, de reserva, com as mesmas medidas da Times New Roman e da Arial (licença na mesma pasta) |
| `src/arquivos/` | O formato do arquivo .apud (texto JSON legível), o salvamento automático e a ponte com o disco |
| `src/telas/` | As telas: o painel com a lista de trabalhos e a tela do trabalho |
| `src-tauri/arquivos/` | Gravação segura dos arquivos no disco (Rust), com testes próprios: `cargo test` nesta pasta |
| `src/editor/` | O editor de texto (TipTap): blocos aceitos, barra "/", colagem sem formatação e a tela |
| `src/perfis/` | Leitura e conferência dos perfis, com as mensagens de erro em português |
| `src/citacoes/` | Primeiro pedaço do motor de citações: prepara as referências e monta as chamadas |
| `scripts/` | Comandos de conferência: `npm run conferir-perfis` e `npm run prova` |

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
npm test           # testes (perfis, cobertura do checklist, documento de prova, editor, arquivos)
cargo test --manifest-path src-tauri/arquivos/Cargo.toml  # testes da gravação dos arquivos
npm run conferir-perfis  # confere os perfis da pasta perfis/
npm run prova      # documento de prova no Typst, comparado com os gabaritos
npm run exemplo-pdf  # PDF de um texto de exemplo em ABNT (perfis/prova/saida/)
```
