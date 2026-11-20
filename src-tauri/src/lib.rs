// Parte "de dentro" do programa: abre a janela e cuida dos arquivos .apud.
// A interface chama os comandos abaixo; a lógica de gravação segura fica no
// módulo apud-arquivos (pasta arquivos/), que tem os próprios testes.

use apud_arquivos::Pasta;
use serde::Serialize;
use std::sync::Mutex;
use tauri::{Manager, State};

/// A pasta dos trabalhos e uma trava, para duas gravações nunca acontecerem ao mesmo tempo.
struct Estado {
    pasta: Result<Pasta, String>,
    trava: Mutex<()>,
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
    let programa = if cfg!(windows) { "explorer" } else if cfg!(target_os = "macos") { "open" } else { "xdg-open" };
    std::process::Command::new(programa)
        .arg(raiz)
        .spawn()
        .map(|_| ())
        .map_err(|e| format!("não consegui abrir a pasta: {e}"))
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .setup(|app| {
            // No Windows: Documentos\Apud.
            let pasta = app
                .path()
                .document_dir()
                .map_err(|e| format!("não encontrei a pasta Documentos: {e}"))
                .and_then(|d| Pasta::abrir(d.join("Apud")));
            app.manage(Estado { pasta, trava: Mutex::new(()) });
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            pasta_dos_trabalhos,
            listar_trabalhos,
            ler_trabalho,
            criar_trabalho,
            salvar_trabalho,
            renomear_trabalho,
            mostrar_pasta
        ])
        .run(tauri::generate_context!())
        .expect("erro ao iniciar o Apud");
}
