#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod printer;
mod http_client;

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_http::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_shell::init())
        .invoke_handler(tauri::generate_handler![
            printer::list_serial_ports,
            printer::print_thermal,
            printer::open_cash_drawer,
            printer::print_and_open_drawer,
            printer::test_printer,
            printer::test_cash_drawer,
            http_client::http_request,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
