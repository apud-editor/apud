// Parte "de dentro" do programa: abre a janela e cuida dos arquivos .apud.
// A interface chama os comandos abaixo; a lógica de gravação segura fica no
// módulo apud-arquivos (pasta arquivos/), que tem os próprios testes.

use apud_arquivos::{gravar_atomico, traduzir_erro, Pasta};
use serde::Serialize;
use std::path::PathBuf;
use std::sync::Mutex;
use tauri::ipc::{InvokeBody, Request, Response};
use tauri::{AppHandle, Manager, State};
use tauri_plugin_dialog::DialogExt;

/// A pasta dos trabalhos e uma trava, para duas gravações nunca acontecerem ao mesmo tempo.
struct Estado {
    pasta: Result<Pasta, String>,
    trava: Mutex<()>,
    /// O último PDF exportado, para o botão "Abrir o PDF".
    ultimo_pdf: Mutex<Option<PathBuf>>,
}

impl Estado {
    fn usar<T>(&self, f: impl FnOnce(&Pasta) -> Result<T, String>) -> Result<T, String> {
        let _vez = self.trava.lock().unwrap_or_else(|e| e.into_inner());
        f(self.pasta.as_ref().map_err(|e| e.clone())?)
    }
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct ArquivoNaPasta {
    arquivo: String,
    modificado: u64,
    conteudo: Option<String>,
    erro: Option<String>,
}

#[tauri::command]
fn pasta_dos_trabalhos(estado: State<Estado>) -> Result<String, String> {
    estado.usar(|p| Ok(p.raiz().display().to_string()))
}

#[tauri::command]
fn listar_trabalhos(estado: State<Estado>) -> Result<Vec<ArquivoNaPasta>, String> {
    estado.usar(|p| {
        Ok(p.listar()?
            .into_iter()
            .map(|a| {
                let (conteudo, erro) = match a.conteudo {
                    Ok(c) => (Some(c), None),
                    Err(e) => (None, Some(e)),
                };
                ArquivoNaPasta { arquivo: a.arquivo, modificado: a.modificado, conteudo, erro }
            })
            .collect())
    })
}

#[tauri::command]
fn ler_trabalho(estado: State<Estado>, arquivo: String) -> Result<String, String> {
    estado.usar(|p| p.ler(&arquivo))
}

#[tauri::command]
fn criar_trabalho(estado: State<Estado>, nome: String, conteudo: String) -> Result<String, String> {
    estado.usar(|p| p.criar(&nome, &conteudo))
}

#[tauri::command]
fn salvar_trabalho(estado: State<Estado>, arquivo: String, conteudo: String) -> Result<(), String> {
    estado.usar(|p| p.salvar(&arquivo, &conteudo))
}

#[tauri::command]
fn renomear_trabalho(estado: State<Estado>, arquivo: String, nome: String) -> Result<String, String> {
    estado.usar(|p| p.renomear(&arquivo, &nome))
}

/// Abre a pasta dos trabalhos no Explorador de Arquivos.
#[tauri::command]
fn mostrar_pasta(estado: State<Estado>) -> Result<(), String> {
    let raiz = estado.usar(|p| Ok(p.raiz().to_path_buf()))?;
    abrir_com_o_sistema(&raiz)
}

/// Abre uma pasta (no Explorador) ou um arquivo (no programa padrão, como o leitor de PDF).
fn abrir_com_o_sistema(caminho: &std::path::Path) -> Result<(), String> {
    let programa = if cfg!(windows) { "explorer" } else if cfg!(target_os = "macos") { "open" } else { "xdg-open" };
    std::process::Command::new(programa)
        .arg(caminho)
        .spawn()
        .map(|_| ())
        .map_err(|e| format!("não consegui abrir: {e}"))
}

/// As fontes do Windows que o PDF pode usar. Só estes nomes são aceitos.
const FONTES_ACEITAS: [&str; 8] = [
    "times.ttf", "timesbd.ttf", "timesi.ttf", "timesbi.ttf", "arial.ttf", "arialbd.ttf", "ariali.ttf", "arialbi.ttf",
];

/// Lê uma fonte instalada no Windows (para o PDF sair com a Times New Roman de verdade).
#[tauri::command]
fn ler_fonte(nome: String) -> Result<Response, String> {
    if !FONTES_ACEITAS.contains(&nome.as_str()) {
        return Err(format!("fonte não aceita: {nome}"));
    }
    let mut pastas = Vec::new();
    if let Some(windir) = std::env::var_os("WINDIR") {
        pastas.push(PathBuf::from(windir).join("Fonts"));
    }
    // Fontes instaladas só para o usuário ficam em outra pasta.
    if let Some(local) = std::env::var_os("LOCALAPPDATA") {
        pastas.push(PathBuf::from(local).join("Microsoft").join("Windows").join("Fonts"));
    }
    for pasta in pastas {
        if let Ok(dados) = std::fs::read(pasta.join(&nome)) {
            return Ok(Response::new(dados));
        }
    }
    Err(format!("a fonte {nome} não está instalada"))
}

/// Pergunta onde salvar e grava o PDF. O PDF chega em bytes; o nome sugerido, no cabeçalho "nome".
/// Devolve onde o PDF ficou, ou nada se a pessoa cancelou.
#[tauri::command]
async fn exportar_pdf(app: AppHandle, estado: State<'_, Estado>, request: Request<'_>) -> Result<Option<String>, String> {
    let InvokeBody::Raw(pdf) = request.body() else {
        return Err("o PDF não chegou".into());
    };
    let nome = request
        .headers()
        .get("nome")
        .and_then(|v| v.to_str().ok())
        .map(|v| percent_decode(v))
        .unwrap_or_else(|| "Trabalho.pdf".into());
    let mut janela = app.dialog().file().set_title("Salvar o PDF").set_file_name(&nome).add_filter("PDF", &["pdf"]);
    if let Ok(pasta) = &estado.pasta {
        janela = janela.set_directory(pasta.raiz());
    }
    let Some(escolhido) = janela.blocking_save_file() else {
        return Ok(None); // a pessoa cancelou
    };
    let mut destino = escolhido.into_path().map_err(|e| format!("caminho inválido: {e}"))?;
    if destino.extension().map_or(true, |e| !e.eq_ignore_ascii_case("pdf")) {
        destino.set_extension("pdf");
    }
    gravar_atomico(&destino, pdf).map_err(|e| format!("não consegui salvar o PDF: {}", traduzir_erro(&e)))?;
    *estado.ultimo_pdf.lock().unwrap_or_else(|e| e.into_inner()) = Some(destino.clone());
    Ok(Some(destino.display().to_string()))
}

#[tauri::command]
fn abrir_pdf_exportado(estado: State<Estado>) -> Result<(), String> {
    let caminho = estado.ultimo_pdf.lock().unwrap_or_else(|e| e.into_inner()).clone();
    match caminho {
        Some(c) => abrir_com_o_sistema(&c),
        None => Err("nenhum PDF foi exportado ainda".into()),
    }
}

/// Desfaz o "%20" e companhia do nome que veio da interface (encodeURIComponent).
fn percent_decode(s: &str) -> String {
    let bytes = s.as_bytes();
    let mut saida = Vec::with_capacity(bytes.len());
    let mut i = 0;
    while i < bytes.len() {
        if bytes[i] == b'%' {
            if let Some(b) = s.get(i + 1..i + 3).and_then(|h| u8::from_str_radix(h, 16).ok()) {
                saida.push(b);
                i += 3;
                continue;
            }
        }
        saida.push(bytes[i]);
        i += 1;
    }
    String::from_utf8_lossy(&saida).into_owned()
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .setup(|app| {
            // No Windows: Documentos\Apud.
            let pasta = app
                .path()
                .document_dir()
                .map_err(|e| format!("não encontrei a pasta Documentos: {e}"))
                .and_then(|d| Pasta::abrir(d.join("Apud")));
            app.manage(Estado { pasta, trava: Mutex::new(()), ultimo_pdf: Mutex::new(None) });
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            pasta_dos_trabalhos,
            listar_trabalhos,
            ler_trabalho,
            criar_trabalho,
            salvar_trabalho,
            renomear_trabalho,
            mostrar_pasta,
            ler_fonte,
            exportar_pdf,
            abrir_pdf_exportado
        ])
        .run(tauri::generate_context!())
        .expect("erro ao iniciar o Apud");
}
