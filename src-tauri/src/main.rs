// Impede que o Windows abra uma janela de terminal junto com o programa.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    apud_lib::run()
}
