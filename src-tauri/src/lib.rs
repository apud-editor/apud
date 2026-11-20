// Parte "de dentro" do programa. Nesta etapa ela só abre a janela.
// Nas próximas etapas é aqui que entram abrir e salvar os arquivos .apud.
#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .run(tauri::generate_context!())
        .expect("erro ao iniciar o Apud");
}
