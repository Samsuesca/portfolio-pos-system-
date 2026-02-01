use std::process::Command;

#[cfg(target_os = "windows")]
use serialport::{available_ports, SerialPortType};
#[cfg(target_os = "windows")]
use std::io::Write;
#[cfg(target_os = "windows")]
use std::time::Duration;

#[cfg(target_os = "linux")]
use serialport::{available_ports, SerialPortType};
#[cfg(target_os = "linux")]
use std::io::Write;
#[cfg(target_os = "linux")]
use std::time::Duration;

/// Information about a printer/port
#[derive(serde::Serialize)]
pub struct PortInfo {
    pub name: String,
    pub port_type: String,
    pub description: Option<String>,
}

/// List available printers
/// On macOS: Lists CUPS printers using lpstat
/// On Windows: Lists Windows printers AND serial ports
/// On Linux: Lists serial ports
#[tauri::command]
pub fn list_serial_ports() -> Result<Vec<PortInfo>, String> {
    #[cfg(target_os = "macos")]
    {
        list_cups_printers()
    }

    #[cfg(target_os = "windows")]
    {
        list_windows_printers_and_ports()
    }

    #[cfg(target_os = "linux")]
    {
        list_serial_ports_impl()
    }
}

/// List CUPS printers on macOS
#[cfg(target_os = "macos")]
fn list_cups_printers() -> Result<Vec<PortInfo>, String> {
    // Run lpstat -p to get list of printers
    let output = Command::new("lpstat")
        .arg("-p")
        .output()
        .map_err(|e| format!("Error ejecutando lpstat: {}", e))?;

    if !output.status.success() {
        // No printers or lpstat error - return empty list
        return Ok(Vec::new());
    }

    let stdout = String::from_utf8_lossy(&output.stdout);
    let mut printers: Vec<PortInfo> = Vec::new();

    // Parse lpstat output: "printer PrinterName is idle. enabled since..."
    for line in stdout.lines() {
        if line.starts_with("printer ") {
            // Extract printer name between "printer " and " is"
            if let Some(name_end) = line.find(" is ") {
                let name = line[8..name_end].to_string();

                // Determine status from the line
                let status = if line.contains("idle") {
                    "Disponible"
                } else if line.contains("printing") {
                    "Imprimiendo"
                } else {
                    "Conectada"
                };

                printers.push(PortInfo {
                    name,
                    port_type: "CUPS".to_string(),
                    description: Some(status.to_string()),
                });
            }
        }
    }

    Ok(printers)
}

/// List Windows printers using wmic command AND serial ports
#[cfg(target_os = "windows")]
fn list_windows_printers_and_ports() -> Result<Vec<PortInfo>, String> {
    let mut printers: Vec<PortInfo> = Vec::new();

    // First, list Windows printers using wmic
    let output = Command::new("wmic")
        .args(["printer", "get", "name,status", "/format:csv"])
        .output();

    if let Ok(output) = output {
        if output.status.success() {
            let stdout = String::from_utf8_lossy(&output.stdout);
            // Parse CSV output: Node,Name,Status
            for line in stdout.lines().skip(1) {
                // Skip header
                let parts: Vec<&str> = line.split(',').collect();
                if parts.len() >= 2 {
                    let name = parts[1].trim();
                    if !name.is_empty() {
                        let status = if parts.len() >= 3 {
                            match parts[2].trim() {
                                "OK" | "3" => "Disponible",
                                "Printing" | "4" => "Imprimiendo",
                                _ => "Conectada",
                            }
                        } else {
                            "Conectada"
                        };

                        printers.push(PortInfo {
                            name: name.to_string(),
                            port_type: "Windows".to_string(),
                            description: Some(status.to_string()),
                        });
                    }
                }
            }
        }
    }

    // Also try PowerShell as fallback (more reliable on newer Windows)
    if printers.is_empty() {
        let ps_output = Command::new("powershell")
            .args([
                "-Command",
                "Get-Printer | Select-Object -Property Name | ForEach-Object { $_.Name }",
            ])
            .output();

        if let Ok(output) = ps_output {
            if output.status.success() {
                let stdout = String::from_utf8_lossy(&output.stdout);
                for line in stdout.lines() {
                    let name = line.trim();
                    if !name.is_empty() {
                        printers.push(PortInfo {
                            name: name.to_string(),
                            port_type: "Windows".to_string(),
                            description: Some("Disponible".to_string()),
                        });
                    }
                }
            }
        }
    }

    // Also list serial ports for thermal printers that use COM ports
    if let Ok(ports) = available_ports() {
        for p in ports {
            let (port_type, description) = match &p.port_type {
                SerialPortType::UsbPort(info) => {
                    let desc = info
                        .product
                        .clone()
                        .or_else(|| info.manufacturer.clone());
                    ("USB-Serial".to_string(), desc)
                }
                SerialPortType::PciPort => ("PCI".to_string(), None),
                SerialPortType::BluetoothPort => ("Bluetooth".to_string(), None),
                SerialPortType::Unknown => ("COM".to_string(), None),
            };
            printers.push(PortInfo {
                name: p.port_name,
                port_type,
                description,
            });
        }
    }

    Ok(printers)
}

/// List serial ports on Linux
#[cfg(target_os = "linux")]
fn list_serial_ports_impl() -> Result<Vec<PortInfo>, String> {
    let ports = available_ports().map_err(|e| format!("Error listing ports: {}", e))?;

    let port_infos: Vec<PortInfo> = ports
        .into_iter()
        .map(|p| {
            let (port_type, description) = match &p.port_type {
                SerialPortType::UsbPort(info) => {
                    let desc = info
                        .product
                        .clone()
                        .or_else(|| info.manufacturer.clone());
                    ("USB".to_string(), desc)
                }
                SerialPortType::PciPort => ("PCI".to_string(), None),
                SerialPortType::BluetoothPort => ("Bluetooth".to_string(), None),
                SerialPortType::Unknown => ("Unknown".to_string(), None),
            };
            PortInfo {
                name: p.port_name,
                port_type,
                description,
            }
        })
        .collect();

    Ok(port_infos)
}

/// Send raw ESC/POS data to a thermal printer
/// On macOS: Uses lp command with CUPS
/// On Windows: Uses Windows spooler or serial port (auto-detect)
/// On Linux: Uses serial port
#[tauri::command]
pub fn print_thermal(port_name: String, data: Vec<u8>) -> Result<bool, String> {
    #[cfg(target_os = "macos")]
    {
        print_via_cups(&port_name, &data)
    }

    #[cfg(target_os = "windows")]
    {
        // Detect if it's a COM port or a Windows printer
        if port_name.to_uppercase().starts_with("COM") {
            print_via_serial(&port_name, &data)
        } else {
            print_via_windows_spooler(&port_name, &data)
        }
    }

    #[cfg(target_os = "linux")]
    {
        print_via_serial(&port_name, &data)
    }
}

/// Print via CUPS on macOS using lp command
#[cfg(target_os = "macos")]
fn print_via_cups(printer_name: &str, data: &[u8]) -> Result<bool, String> {
    use std::io::Write;

    // Create a temporary file with the ESC/POS data
    let temp_dir = std::env::temp_dir();
    let temp_file = temp_dir.join(format!("receipt_{}.bin", std::process::id()));

    // Write data to temp file
    let mut file = std::fs::File::create(&temp_file)
        .map_err(|e| format!("Error creando archivo temporal: {}", e))?;

    file.write_all(data)
        .map_err(|e| format!("Error escribiendo datos: {}", e))?;

    file.flush()
        .map_err(|e| format!("Error en flush: {}", e))?;

    drop(file); // Close the file before lp reads it

    // Use lp command to print raw data
    let output = Command::new("lp")
        .arg("-d")
        .arg(printer_name)
        .arg("-o")
        .arg("raw")
        .arg(&temp_file)
        .output()
        .map_err(|e| format!("Error ejecutando lp: {}", e))?;

    // Clean up temp file
    let _ = std::fs::remove_file(&temp_file);

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(format!("Error de impresion: {}", stderr));
    }

    Ok(true)
}

/// Print via serial port on Windows
#[cfg(target_os = "windows")]
fn print_via_serial(port_name: &str, data: &[u8]) -> Result<bool, String> {
    let mut port = serialport::new(port_name, 9600)
        .timeout(Duration::from_millis(5000))
        .open()
        .map_err(|e| format!("Error opening port '{}': {}", port_name, e))?;

    port.write_all(data)
        .map_err(|e| format!("Error writing to port: {}", e))?;

    port.flush()
        .map_err(|e| format!("Error flushing port: {}", e))?;

    Ok(true)
}

/// Print via serial port on Linux
#[cfg(target_os = "linux")]
fn print_via_serial(port_name: &str, data: &[u8]) -> Result<bool, String> {
    let mut port = serialport::new(port_name, 9600)
        .timeout(Duration::from_millis(5000))
        .open()
        .map_err(|e| format!("Error opening port '{}': {}", port_name, e))?;

    port.write_all(data)
        .map_err(|e| format!("Error writing to port: {}", e))?;

    port.flush()
        .map_err(|e| format!("Error flushing port: {}", e))?;

    Ok(true)
}

/// Print via Windows - writes directly to printer port file
/// This sends RAW binary data without any conversion
#[cfg(target_os = "windows")]
fn print_via_windows_spooler(printer_name: &str, data: &[u8]) -> Result<bool, String> {
    use std::io::Write;
    use std::fs::OpenOptions;

    // Method 1: Try to write directly to the printer as a file device
    // Windows allows writing to printers via \\.\printername or the port directly

    // First, try to get the printer port using wmic
    let port_output = Command::new("wmic")
        .args(["printer", "where", &format!("name='{}'", printer_name), "get", "portname", "/value"])
        .output();

    if let Ok(output) = port_output {
        if output.status.success() {
            let stdout = String::from_utf8_lossy(&output.stdout);
            // Parse PortName=XXX
            for line in stdout.lines() {
                if line.starts_with("PortName=") {
                    let port = line.trim_start_matches("PortName=").trim();
                    if !port.is_empty() {
                        // If it's a USB port like USB001, try writing to it
                        if port.starts_with("USB") || port.starts_with("LPT") {
                            // Try opening the port directly
                            let port_path = format!("\\\\.\\{}", port);
                            if let Ok(mut file) = OpenOptions::new()
                                .write(true)
                                .open(&port_path)
                            {
                                if file.write_all(data).is_ok() && file.flush().is_ok() {
                                    return Ok(true);
                                }
                            }
                        }
                        // If it's a COM port, use serial
                        if port.starts_with("COM") {
                            return print_via_serial(port, data);
                        }
                    }
                }
            }
        }
    }

    // Method 2: Try PowerShell with proper byte handling
    let temp_dir = std::env::temp_dir();
    let temp_file = temp_dir.join(format!("receipt_{}.bin", std::process::id()));
    let temp_path = temp_file.to_string_lossy().to_string();

    // Write data to temp file
    let mut file = std::fs::File::create(&temp_file)
        .map_err(|e| format!("Error creando archivo temporal: {}", e))?;
    file.write_all(data)
        .map_err(|e| format!("Error escribiendo datos: {}", e))?;
    file.flush()
        .map_err(|e| format!("Error en flush: {}", e))?;
    drop(file);

    // Use PowerShell to send RAW data using .NET printing classes
    let ps_script = format!(
        r#"
        Add-Type -AssemblyName System.Drawing
        $printerName = '{}'
        $filePath = '{}'

        # Read file as bytes
        $bytes = [System.IO.File]::ReadAllBytes($filePath)

        # Use RawPrinterHelper via P/Invoke
        $signature = @'
        [DllImport("winspool.drv", CharSet = CharSet.Unicode, SetLastError = true)]
        public static extern bool OpenPrinter(string pPrinterName, out IntPtr phPrinter, IntPtr pDefault);

        [DllImport("winspool.drv", SetLastError = true)]
        public static extern bool ClosePrinter(IntPtr hPrinter);

        [DllImport("winspool.drv", CharSet = CharSet.Unicode, SetLastError = true)]
        public static extern bool StartDocPrinter(IntPtr hPrinter, int Level, ref DOCINFO pDocInfo);

        [DllImport("winspool.drv", SetLastError = true)]
        public static extern bool EndDocPrinter(IntPtr hPrinter);

        [DllImport("winspool.drv", SetLastError = true)]
        public static extern bool StartPagePrinter(IntPtr hPrinter);

        [DllImport("winspool.drv", SetLastError = true)]
        public static extern bool EndPagePrinter(IntPtr hPrinter);

        [DllImport("winspool.drv", SetLastError = true)]
        public static extern bool WritePrinter(IntPtr hPrinter, IntPtr pBytes, int dwCount, out int dwWritten);

        [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Unicode)]
        public struct DOCINFO {{
            public string pDocName;
            public string pOutputFile;
            public string pDataType;
        }}
'@

        Add-Type -MemberDefinition $signature -Name RawPrinter -Namespace Win32

        $hPrinter = [IntPtr]::Zero
        $docInfo = New-Object Win32.RawPrinter+DOCINFO
        $docInfo.pDocName = "Receipt"
        $docInfo.pOutputFile = $null
        $docInfo.pDataType = "RAW"

        if ([Win32.RawPrinter]::OpenPrinter($printerName, [ref]$hPrinter, [IntPtr]::Zero)) {{
            if ([Win32.RawPrinter]::StartDocPrinter($hPrinter, 1, [ref]$docInfo)) {{
                if ([Win32.RawPrinter]::StartPagePrinter($hPrinter)) {{
                    $ptr = [System.Runtime.InteropServices.Marshal]::AllocHGlobal($bytes.Length)
                    [System.Runtime.InteropServices.Marshal]::Copy($bytes, 0, $ptr, $bytes.Length)
                    $written = 0
                    [Win32.RawPrinter]::WritePrinter($hPrinter, $ptr, $bytes.Length, [ref]$written)
                    [System.Runtime.InteropServices.Marshal]::FreeHGlobal($ptr)
                    [Win32.RawPrinter]::EndPagePrinter($hPrinter)
                }}
                [Win32.RawPrinter]::EndDocPrinter($hPrinter)
            }}
            [Win32.RawPrinter]::ClosePrinter($hPrinter)
            Write-Output "OK"
        }} else {{
            Write-Error "Failed to open printer"
        }}
        "#,
        printer_name.replace("'", "''"),
        temp_path.replace("\\", "\\\\").replace("'", "''")
    );

    let ps_result = Command::new("powershell")
        .args(["-ExecutionPolicy", "Bypass", "-Command", &ps_script])
        .output();

    // Clean up temp file
    let _ = std::fs::remove_file(&temp_file);

    match ps_result {
        Ok(output) => {
            let stdout = String::from_utf8_lossy(&output.stdout);
            if stdout.contains("OK") || output.status.success() {
                Ok(true)
            } else {
                let stderr = String::from_utf8_lossy(&output.stderr);
                Err(format!("Error de impresion: {} {}", stdout, stderr))
            }
        }
        Err(e) => Err(format!("Error ejecutando PowerShell: {}", e)),
    }
}

/// Open the cash drawer connected to the printer
/// ESC p command: 0x1B 0x70 0x00 0x19 0xFA
#[tauri::command]
pub fn open_cash_drawer(port_name: String) -> Result<bool, String> {
    // ESC p m t1 t2 - Open cash drawer
    // m = drawer pin (0 or 1)
    // t1 = on time (25 * t1 ms)
    // t2 = off time (25 * t2 ms)
    let drawer_command: Vec<u8> = vec![0x1B, 0x70, 0x00, 0x19, 0xFA];

    #[cfg(target_os = "macos")]
    {
        print_via_cups(&port_name, &drawer_command)
    }

    #[cfg(target_os = "windows")]
    {
        // Detect if it's a COM port or a Windows printer
        if port_name.to_uppercase().starts_with("COM") {
            let mut port = serialport::new(&port_name, 9600)
                .timeout(Duration::from_millis(3000))
                .open()
                .map_err(|e| format!("Error opening port '{}': {}", port_name, e))?;

            port.write_all(&drawer_command)
                .map_err(|e| format!("Error sending drawer command: {}", e))?;

            port.flush()
                .map_err(|e| format!("Error flushing port: {}", e))?;

            Ok(true)
        } else {
            print_via_windows_spooler(&port_name, &drawer_command)
        }
    }

    #[cfg(target_os = "linux")]
    {
        let mut port = serialport::new(&port_name, 9600)
            .timeout(Duration::from_millis(3000))
            .open()
            .map_err(|e| format!("Error opening port '{}': {}", port_name, e))?;

        port.write_all(&drawer_command)
            .map_err(|e| format!("Error sending drawer command: {}", e))?;

        port.flush()
            .map_err(|e| format!("Error flushing port: {}", e))?;

        Ok(true)
    }
}

/// Print receipt and optionally open cash drawer in one operation
#[tauri::command]
pub fn print_and_open_drawer(
    port_name: String,
    data: Vec<u8>,
    open_drawer: bool,
) -> Result<bool, String> {
    // Combine receipt data with drawer command if needed
    let mut full_data = data;
    if open_drawer {
        let drawer_command: Vec<u8> = vec![0x1B, 0x70, 0x00, 0x19, 0xFA];
        full_data.extend(drawer_command);
    }

    #[cfg(target_os = "macos")]
    {
        print_via_cups(&port_name, &full_data)
    }

    #[cfg(target_os = "windows")]
    {
        // Detect if it's a COM port or a Windows printer
        if port_name.to_uppercase().starts_with("COM") {
            let mut port = serialport::new(&port_name, 9600)
                .timeout(Duration::from_millis(5000))
                .open()
                .map_err(|e| format!("Error opening port '{}': {}", port_name, e))?;

            port.write_all(&full_data)
                .map_err(|e| format!("Error writing receipt: {}", e))?;

            port.flush()
                .map_err(|e| format!("Error flushing port: {}", e))?;

            Ok(true)
        } else {
            print_via_windows_spooler(&port_name, &full_data)
        }
    }

    #[cfg(target_os = "linux")]
    {
        let mut port = serialport::new(&port_name, 9600)
            .timeout(Duration::from_millis(5000))
            .open()
            .map_err(|e| format!("Error opening port '{}': {}", port_name, e))?;

        port.write_all(&full_data)
            .map_err(|e| format!("Error writing receipt: {}", e))?;

        port.flush()
            .map_err(|e| format!("Error flushing port: {}", e))?;

        Ok(true)
    }
}

/// Test the printer connection with a simple print
#[tauri::command]
pub fn test_printer(port_name: String) -> Result<bool, String> {
    // ESC/POS commands for a test print
    let mut test_data: Vec<u8> = Vec::new();

    // Initialize printer
    test_data.extend_from_slice(&[0x1B, 0x40]); // ESC @

    // Center alignment
    test_data.extend_from_slice(&[0x1B, 0x61, 0x01]); // ESC a 1

    // Bold on
    test_data.extend_from_slice(&[0x1B, 0x45, 0x01]); // ESC E 1

    // Test message
    test_data.extend_from_slice(b"=== PRUEBA DE IMPRESORA ===\n");

    // Bold off
    test_data.extend_from_slice(&[0x1B, 0x45, 0x00]); // ESC E 0

    // Left alignment
    test_data.extend_from_slice(&[0x1B, 0x61, 0x00]); // ESC a 0

    test_data.extend_from_slice(b"\n");
    test_data.extend_from_slice(b"Impresora configurada correctamente\n");
    test_data.extend_from_slice(b"--------------------------------\n");
    test_data.extend_from_slice(b"Puerto: ");
    test_data.extend_from_slice(port_name.as_bytes());
    test_data.extend_from_slice(b"\n");
    test_data.extend_from_slice(b"--------------------------------\n");

    // Center alignment for footer
    test_data.extend_from_slice(&[0x1B, 0x61, 0x01]); // ESC a 1
    test_data.extend_from_slice(b"\nUNIFORMES CONSUELO RIOS\n\n");

    // Feed and cut (6 lines calibrated for Jaltech 80mm)
    test_data.extend_from_slice(&[0x1B, 0x64, 0x06]); // ESC d 6 - Feed 6 lines
    test_data.extend_from_slice(&[0x1D, 0x56, 0x00]); // GS V 0 - Full cut

    print_thermal(port_name, test_data)
}

/// Test the cash drawer
#[tauri::command]
pub fn test_cash_drawer(port_name: String) -> Result<bool, String> {
    open_cash_drawer(port_name)
}
