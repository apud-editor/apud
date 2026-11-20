//! Os arquivos .apud no disco: listar, ler, criar, salvar e renomear.
//!
//! Este módulo não sabe o que tem dentro de um .apud (isso é da interface).
//! O trabalho dele é nunca perder nem estragar um arquivo:
//!
//! - Salvar é "atômico": o texto novo vai primeiro para um arquivo temporário,
//!   que é gravado até o fim no disco e só então toma o lugar do antigo. Se o
//!   computador desligar no meio, fica o arquivo antigo inteiro, nunca metade.
//! - Criar e renomear nunca passam por cima de um arquivo que já existe:
//!   o nome ganha "(2)", "(3)"...
//! - Só se aceita um nome de arquivo simples, dentro da pasta dos trabalhos.

use std::fs::{self, File, OpenOptions};
use std::io::{self, Write};
use std::path::{Path, PathBuf};
use std::thread::sleep;
use std::time::{Duration, UNIX_EPOCH};

pub const EXTENSAO: &str = ".apud";

/// Um arquivo encontrado na pasta, para o painel.
#[derive(Debug, Clone, PartialEq)]
pub struct ArquivoLido {
    /// Nome do arquivo, como "Relato de estágio.apud".
    pub arquivo: String,
    /// Última modificação, em milissegundos desde 1970.
    pub modificado: u64,
    /// O conteúdo, ou o motivo de não ter conseguido ler.
    pub conteudo: Result<String, String>,
}

/// A pasta dos trabalhos (no Windows, Documentos\Apud).
pub struct Pasta {
    raiz: PathBuf,
}

impl Pasta {
    /// Abre a pasta, criando se ainda não existir.
    pub fn abrir(raiz: impl Into<PathBuf>) -> Result<Pasta, String> {
        let raiz = raiz.into();
        fs::create_dir_all(&raiz)
            .map_err(|e| format!("não consegui criar a pasta {}: {}", raiz.display(), traduzir(&e)))?;
        Ok(Pasta { raiz })
    }

    pub fn raiz(&self) -> &Path {
        &self.raiz
    }

    /// Lista os arquivos .apud, do mais recente para o mais antigo.
    pub fn listar(&self) -> Result<Vec<ArquivoLido>, String> {
        let entradas = fs::read_dir(&self.raiz).map_err(|e| format!("não consegui ler a pasta: {}", traduzir(&e)))?;
        let mut lista = Vec::new();
        for entrada in entradas.flatten() {
            let arquivo = entrada.file_name().to_string_lossy().into_owned();
            if nome_valido(&arquivo).is_err() || !entrada.path().is_file() {
                continue;
            }
            let modificado = entrada
                .metadata()
                .and_then(|m| m.modified())
                .ok()
                .and_then(|t| t.duration_since(UNIX_EPOCH).ok())
                .map(|d| d.as_millis() as u64)
                .unwrap_or(0);
            let conteudo = fs::read_to_string(entrada.path()).map_err(|e| traduzir(&e));
            lista.push(ArquivoLido { arquivo, modificado, conteudo });
        }
        lista.sort_by(|a, b| b.modificado.cmp(&a.modificado).then(a.arquivo.cmp(&b.arquivo)));
        Ok(lista)
    }

    pub fn ler(&self, arquivo: &str) -> Result<String, String> {
        let caminho = self.caminho(arquivo)?;
        fs::read_to_string(&caminho).map_err(|e| format!("não consegui abrir {arquivo}: {}", traduzir(&e)))
    }

    /// Grava o conteúdo de um arquivo que já existe, sem risco de deixar o arquivo pela metade.
    pub fn salvar(&self, arquivo: &str, conteudo: &str) -> Result<(), String> {
        let destino = self.caminho(arquivo)?;
        if !destino.is_file() {
            return Err(format!("o arquivo {arquivo} não está mais na pasta (foi apagado ou renomeado?)"));
        }
        self.gravar_atomico(&destino, conteudo)
            .map_err(|e| format!("não consegui salvar {arquivo}: {}", traduzir(&e)))
    }

    /// Cria um arquivo novo a partir de um nome ("Relato de estágio"). Devolve o nome do arquivo criado.
    pub fn criar(&self, nome: &str, conteudo: &str) -> Result<String, String> {
        let arquivo = self.nome_livre(&nome_de_arquivo(nome), None);
        let destino = self.raiz.join(&arquivo);
        // create_new: falha se o arquivo aparecer de repente, em vez de passar por cima.
        let mut f = OpenOptions::new()
            .write(true)
            .create_new(true)
            .open(&destino)
            .map_err(|e| format!("não consegui criar {arquivo}: {}", traduzir(&e)))?;
        f.write_all(conteudo.as_bytes())
            .and_then(|_| f.sync_all())
            .map_err(|e| format!("não consegui gravar {arquivo}: {}", traduzir(&e)))?;
        Ok(arquivo)
    }

    /// Troca o nome do arquivo para combinar com o novo nome do trabalho. Devolve o novo nome do arquivo.
    pub fn renomear(&self, arquivo: &str, novo_nome: &str) -> Result<String, String> {
        let origem = self.caminho(arquivo)?;
        let desejado = nome_de_arquivo(novo_nome);
        if desejado.to_lowercase() == arquivo.to_lowercase() {
            // Mesmo nome (no Windows, maiúsculas e minúsculas não contam): só troca a grafia.
            if desejado != arquivo {
                renomear_com_tentativas(&origem, &self.raiz.join(&desejado))
                    .map_err(|e| format!("não consegui renomear: {}", traduzir(&e)))?;
            }
            return Ok(desejado);
        }
        let novo = self.nome_livre(&desejado, Some(arquivo));
        if novo.eq_ignore_ascii_case(arquivo) {
            // O nome livre é o atual ("Relato (2)" renomeado para "Relato", que está ocupado).
            return Ok(arquivo.to_string());
        }
        let destino = self.raiz.join(&novo);
        if destino.exists() {
            return Err(format!("já existe um arquivo {novo}"));
        }
        renomear_com_tentativas(&origem, &destino).map_err(|e| format!("não consegui renomear: {}", traduzir(&e)))?;
        Ok(novo)
    }

    /// Caminho completo de um arquivo, depois de conferir que o nome é aceitável.
    fn caminho(&self, arquivo: &str) -> Result<PathBuf, String> {
        nome_valido(arquivo)?;
        Ok(self.raiz.join(arquivo))
    }

    /// "Nome.apud", ou "Nome (2).apud" se já existir, e assim por diante.
    fn nome_livre(&self, desejado: &str, ignorar: Option<&str>) -> String {
        let base = desejado.strip_suffix(EXTENSAO).unwrap_or(desejado);
        let ocupado = |n: &str| {
            ignorar.map_or(true, |i| !i.eq_ignore_ascii_case(n)) && self.raiz.join(n).exists()
        };
        if !ocupado(desejado) {
            return desejado.to_string();
        }
        (2..)
            .map(|i| format!("{base} ({i}){EXTENSAO}"))
            .find(|n| !ocupado(n))
            .unwrap()
    }

    fn gravar_atomico(&self, destino: &Path, conteudo: &str) -> io::Result<()> {
        // O temporário começa com ponto, para o painel não listá-lo, e fica na mesma
        // pasta, para a troca final ser instantânea.
        let nome = destino.file_name().unwrap().to_string_lossy();
        let temporario = self.raiz.join(format!(".{nome}.salvando"));
        {
            let mut f = File::create(&temporario)?;
            f.write_all(conteudo.as_bytes())?;
            f.sync_all()?; // garante que está no disco antes da troca
        }
        if let Err(e) = renomear_com_tentativas(&temporario, destino) {
            let _ = fs::remove_file(&temporario);
            return Err(e);
        }
        Ok(())
    }
}

/// No Windows, o antivírus ou o OneDrive às vezes seguram o arquivo por um
/// instante. Tenta de novo algumas vezes antes de desistir.
fn renomear_com_tentativas(de: &Path, para: &Path) -> io::Result<()> {
    let mut ultimo = None;
    for tentativa in 0..6 {
        match fs::rename(de, para) {
            Ok(()) => return Ok(()),
            Err(e) if e.kind() == io::ErrorKind::PermissionDenied || e.raw_os_error() == Some(32) => {
                ultimo = Some(e);
                sleep(Duration::from_millis(50 << tentativa));
            }
            Err(e) => return Err(e),
        }
    }
    Err(ultimo.unwrap())
}

/// Confere se é um nome de arquivo .apud simples, sem pastas no meio.
pub fn nome_valido(arquivo: &str) -> Result<(), String> {
    let ok = arquivo.ends_with(EXTENSAO)
        && arquivo.len() > EXTENSAO.len()
        && !arquivo.starts_with('.')
        && !arquivo.contains(['/', '\\', ':'])
        && !arquivo.contains("..");
    if ok {
        Ok(())
    } else {
        Err(format!("nome de arquivo não aceito: {arquivo}"))
    }
}

/// Transforma o nome do trabalho num nome de arquivo que o Windows aceita.
pub fn nome_de_arquivo(nome: &str) -> String {
    let mut base: String = nome
        .chars()
        .map(|c| if "<>:\"/\\|?*".contains(c) || c.is_control() { ' ' } else { c })
        .collect::<String>()
        .split_whitespace()
        .collect::<Vec<_>>()
        .join(" ");
    // O Windows não aceita nome terminado em ponto ou espaço, nem começado por ponto (aqui, temporários).
    base = base.trim_matches(|c: char| c == '.' || c == ' ').to_string();
    // Nomes muito longos dão problema no Windows; corta com folga.
    if base.chars().count() > 120 {
        base = base.chars().take(120).collect::<String>().trim_end_matches(['.', ' ']).to_string();
    }
    // Nomes que o Windows reserva para aparelhos: CON, PRN, AUX, NUL, COM1, LPT1...
    let maiusculo = base.to_uppercase();
    let reservado = ["CON", "PRN", "AUX", "NUL"].contains(&maiusculo.as_str())
        || (maiusculo.is_ascii()
            && maiusculo.len() == 4
            && ["COM", "LPT"].contains(&&maiusculo[..3])
            && maiusculo[3..].chars().all(|c| c.is_ascii_digit()));
    if base.is_empty() || reservado {
        base = format!("Trabalho sem título{}", if reservado { format!(" {base}") } else { String::new() });
    }
    format!("{base}{EXTENSAO}")
}

/// Mensagens de erro do sistema em português.
fn traduzir(e: &io::Error) -> String {
    match e.kind() {
        io::ErrorKind::NotFound => "o arquivo não foi encontrado".into(),
        io::ErrorKind::PermissionDenied => "o Windows não deu permissão (o arquivo pode estar aberto em outro programa)".into(),
        io::ErrorKind::AlreadyExists => "já existe um arquivo com esse nome".into(),
        io::ErrorKind::InvalidData => "o arquivo não é texto válido".into(),
        _ if e.raw_os_error() == Some(112) || e.raw_os_error() == Some(28) => "o disco está cheio".into(),
        _ => e.to_string(),
    }
}

#[cfg(test)]
mod testes {
    use super::*;

    fn pasta_de_teste(nome: &str) -> Pasta {
        let raiz = std::env::temp_dir().join(format!("apud-teste-{nome}-{}", std::process::id()));
        let _ = fs::remove_dir_all(&raiz);
        Pasta::abrir(raiz).unwrap()
    }

    #[test]
    fn cria_salva_le_e_lista() {
        let p = pasta_de_teste("basico");
        let a = p.criar("Relato de estágio", "um").unwrap();
        assert_eq!(a, "Relato de estágio.apud");
        p.salvar(&a, "dois").unwrap();
        assert_eq!(p.ler(&a).unwrap(), "dois");
        let lista = p.listar().unwrap();
        assert_eq!(lista.len(), 1);
        assert_eq!(lista[0].conteudo, Ok("dois".to_string()));
        // O temporário não sobra na pasta.
        assert_eq!(fs::read_dir(p.raiz()).unwrap().count(), 1);
    }

    #[test]
    fn nunca_passa_por_cima_de_outro_arquivo() {
        let p = pasta_de_teste("nomes");
        assert_eq!(p.criar("Relato", "a").unwrap(), "Relato.apud");
        assert_eq!(p.criar("Relato", "b").unwrap(), "Relato (2).apud");
        assert_ne!(p.criar("Relato", "c").unwrap(), "Relato.apud");
        assert_eq!(p.ler("Relato.apud").unwrap(), "a");
        assert_eq!(p.ler("Relato (2).apud").unwrap(), "b");
        fs::remove_file(p.raiz().join("Relato (3).apud")).unwrap();
        // Renomear para um nome ocupado ganha número; se o número livre é o atual, fica como está.
        assert_eq!(p.renomear("Relato (2).apud", "Relato").unwrap(), "Relato (2).apud");
        let c = p.criar("Outro", "c").unwrap();
        assert_eq!(p.renomear(&c, "Relato").unwrap(), "Relato (3).apud");
        assert_eq!(p.ler("Relato.apud").unwrap(), "a");
        assert_eq!(p.ler("Relato (2).apud").unwrap(), "b");
        assert_eq!(p.ler("Relato (3).apud").unwrap(), "c");
    }

    #[test]
    fn renomear_para_o_mesmo_nome_nao_muda_nada() {
        let p = pasta_de_teste("mesmo");
        let a = p.criar("Artigo", "x").unwrap();
        assert_eq!(p.renomear(&a, "Artigo").unwrap(), "Artigo.apud");
        assert_eq!(p.renomear(&a, "  Artigo  ").unwrap(), "Artigo.apud");
        assert_eq!(p.ler("Artigo.apud").unwrap(), "x");
    }

    #[test]
    fn salvar_arquivo_que_sumiu_avisa_em_vez_de_recriar() {
        let p = pasta_de_teste("sumiu");
        let a = p.criar("Artigo", "x").unwrap();
        fs::remove_file(p.raiz().join(&a)).unwrap();
        assert!(p.salvar(&a, "y").unwrap_err().contains("não está mais na pasta"));
    }

    #[test]
    fn recusa_caminhos_fora_da_pasta() {
        let p = pasta_de_teste("caminhos");
        for ruim in ["../fora.apud", "a/b.apud", "a\\b.apud", "C:x.apud", ".escondido.apud", "texto.txt", ".apud"] {
            assert!(p.ler(ruim).is_err(), "{ruim} deveria ser recusado");
            assert!(p.salvar(ruim, "x").is_err());
        }
    }

    #[test]
    fn listar_ignora_temporarios_e_outros_arquivos() {
        let p = pasta_de_teste("lista");
        p.criar("A", "a").unwrap();
        fs::write(p.raiz().join(".A.apud.salvando"), "meio").unwrap();
        fs::write(p.raiz().join("anotacoes.txt"), "x").unwrap();
        let nomes: Vec<_> = p.listar().unwrap().into_iter().map(|a| a.arquivo).collect();
        assert_eq!(nomes, vec!["A.apud"]);
    }

    #[test]
    fn nomes_que_o_windows_aceita() {
        assert_eq!(nome_de_arquivo("Psicologia: teoria e prática"), "Psicologia teoria e prática.apud");
        assert_eq!(nome_de_arquivo("e/ou?"), "e ou.apud");
        assert_eq!(nome_de_arquivo("  ...  "), "Trabalho sem título.apud");
        assert_eq!(nome_de_arquivo("Fim."), "Fim.apud");
        assert_eq!(nome_de_arquivo("CON"), "Trabalho sem título CON.apud");
        assert_eq!(nome_de_arquivo("com1"), "Trabalho sem título com1.apud");
        assert_eq!(nome_de_arquivo("Comida"), "Comida.apud");
        assert_eq!(nome_de_arquivo("abç"), "abç.apud");
        assert_eq!(nome_de_arquivo("Ação: 1ª parte"), "Ação 1ª parte.apud");
        assert_eq!(nome_de_arquivo(&"a".repeat(300)).chars().count(), 120 + 5);
    }
}
