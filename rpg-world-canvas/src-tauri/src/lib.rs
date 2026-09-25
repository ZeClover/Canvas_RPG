// RPG World Canvas roda inteiramente sobre o que já está em dist/: React +
// IndexedDB dentro do WebView nativo (WebView2 no Windows, WebKitGTK no
// Linux). Não existe nenhum comando Rust nem backend próprio aqui — o
// mesmo motivo pelo qual o app inteiro é "um dado, várias lentes":
// IndexedDB já é o banco local, e o WebView já dá diálogo de
// abrir/salvar arquivo nativo para importar/exportar campanha
// (`<input type="file">` / download de Blob), então empacotar como
// desktop app é só trocar a janela do navegador por uma janela própria.
#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .run(tauri::generate_context!())
        .expect("erro ao executar RPG World Canvas");
}
