// Troca o ícone da janela no Windows: o pequeno (alt-tab) e o grande (barra de tarefas).
// O Tauri só troca o pequeno, que não aparece quando a janela não tem barra de título.

use windows_sys::Win32::UI::WindowsAndMessaging::{CreateIcon, SendMessageW, ICON_BIG, ICON_SMALL, WM_SETICON};

/// Põe o ícone (pixels RGBA, largura x altura) na janela.
pub fn definir_icone(hwnd: *mut core::ffi::c_void, rgba: &[u8], largura: u32, altura: u32) -> Result<(), String> {
    let n = (largura * altura) as usize;
    if rgba.len() != n * 4 {
        return Err("a imagem do ícone está com o tamanho errado".into());
    }
    let mut bgra = rgba.to_vec();
    let mut mascara = Vec::with_capacity(n);
    for p in bgra.chunks_exact_mut(4) {
        mascara.push(p[3].wrapping_sub(u8::MAX));
        p.swap(0, 2);
    }
    let icone = unsafe { CreateIcon(core::ptr::null_mut(), largura as i32, altura as i32, 1, 32, mascara.as_ptr(), bgra.as_ptr()) };
    if icone.is_null() {
        return Err("o Windows não aceitou o ícone".into());
    }
    unsafe {
        SendMessageW(hwnd, WM_SETICON, ICON_SMALL as usize, icone as isize);
        SendMessageW(hwnd, WM_SETICON, ICON_BIG as usize, icone as isize);
    }
    Ok(())
}
