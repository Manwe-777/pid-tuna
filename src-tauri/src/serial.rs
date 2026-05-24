// USB serial transport for the FC → MSC trigger flow. Mirrors the surface of
// `src/msp/portWeb.ts` so the JS-side `portTauri.ts` wrapper can present an
// identical FcPort interface.
//
// Intentionally minimal: list known FC ports, open one at 115200 baud, write a
// byte buffer, read up to N bytes with a timeout, close. No state beyond a
// per-port handle map keyed by an integer ID we hand back to the frontend.

use std::collections::HashMap;
use std::io::{Read, Write};
use std::sync::{Mutex, OnceLock};
use std::time::{Duration, Instant};

use serde::Serialize;
use serialport::{SerialPort, SerialPortType, UsbPortInfo};
use tauri::ipc::InvokeError;

/// USB VID/PID pairs known to be Betaflight-compatible. Kept in sync with
/// `FC_USB_FILTERS` in src/msp/port.ts.
const FC_USB_IDS: &[(u16, u16)] = &[
    (0x0403, 0x6001), // FT232R USB UART
    (0x0483, 0x3256), // STM32 HID
    (0x0483, 0x374e), // STM32 STLink VCP
    (0x0483, 0x5740), // STM32 Virtual COM Port
    (0x10c4, 0xea60), // Silicon Labs CP210x
    (0x10c4, 0xea61),
    (0x10c4, 0xea62),
    (0x28e9, 0x018a), // GD32 VCP
    (0x2e3c, 0x5740), // AT32 VCP
    (0x314b, 0x5740), // APM32 VCP
    (0x2e8a, 0x0009), // Raspberry Pi Pico VCP
];

#[derive(Serialize, Clone)]
pub struct FcPortInfo {
    pub path: String,
    pub vendor_id: u16,
    pub product_id: u16,
    pub product: Option<String>,
    pub manufacturer: Option<String>,
}

struct OpenPort {
    port: Box<dyn SerialPort>,
    /// Bytes that arrived before the matching `read()` call was made, kept so
    /// the next `read()` doesn't lose them. Mirrors the WebSerial buffer logic.
    buffer: Vec<u8>,
    label: String,
}

fn registry() -> &'static Mutex<HashMap<u32, OpenPort>> {
    static REG: OnceLock<Mutex<HashMap<u32, OpenPort>>> = OnceLock::new();
    REG.get_or_init(|| Mutex::new(HashMap::new()))
}

fn next_handle() -> u32 {
    use std::sync::atomic::{AtomicU32, Ordering};
    static NEXT: AtomicU32 = AtomicU32::new(1);
    NEXT.fetch_add(1, Ordering::Relaxed)
}

fn is_fc_usb(info: &UsbPortInfo) -> bool {
    FC_USB_IDS.iter().any(|(v, p)| *v == info.vid && *p == info.pid)
}

#[tauri::command]
pub fn fc_serial_list_ports() -> Result<Vec<FcPortInfo>, InvokeError> {
    let ports = serialport::available_ports()
        .map_err(|e| InvokeError::from(format!("enumerate serial ports: {e}")))?;
    Ok(ports
        .into_iter()
        .filter_map(|p| match &p.port_type {
            SerialPortType::UsbPort(usb) if is_fc_usb(usb) => Some(FcPortInfo {
                path: p.port_name,
                vendor_id: usb.vid,
                product_id: usb.pid,
                product: usb.product.clone(),
                manufacturer: usb.manufacturer.clone(),
            }),
            _ => None,
        })
        .collect())
}

#[tauri::command]
pub fn fc_serial_open(path: String, baud_rate: u32) -> Result<u32, InvokeError> {
    let port = serialport::new(&path, baud_rate)
        // 1s timeout per I/O is plenty for MSP frames; the application also
        // enforces its own overall timeout on top of this.
        .timeout(Duration::from_millis(1000))
        .open()
        .map_err(|e| InvokeError::from(format!("open {path}: {e}")))?;
    let handle = next_handle();
    let label = format!("USB serial @ {path}");
    let mut reg = registry().lock().map_err(|_| InvokeError::from("registry poisoned"))?;
    reg.insert(handle, OpenPort { port, buffer: Vec::new(), label });
    Ok(handle)
}

#[tauri::command]
pub fn fc_serial_write(handle: u32, data: Vec<u8>) -> Result<(), InvokeError> {
    let mut reg = registry().lock().map_err(|_| InvokeError::from("registry poisoned"))?;
    let entry = reg.get_mut(&handle).ok_or_else(|| InvokeError::from("unknown port handle"))?;
    entry
        .port
        .write_all(&data)
        .map_err(|e| InvokeError::from(format!("write: {e}")))?;
    entry.port.flush().map_err(|e| InvokeError::from(format!("flush: {e}")))?;
    Ok(())
}

#[tauri::command]
pub fn fc_serial_read(handle: u32, len: usize, timeout_ms: u64) -> Result<Vec<u8>, InvokeError> {
    let deadline = Instant::now() + Duration::from_millis(timeout_ms);
    let mut tmp = [0u8; 256];
    loop {
        {
            let mut reg = registry().lock().map_err(|_| InvokeError::from("registry poisoned"))?;
            let entry = reg.get_mut(&handle).ok_or_else(|| InvokeError::from("unknown port handle"))?;
            if entry.buffer.len() >= len {
                let out = entry.buffer.drain(..len).collect();
                return Ok(out);
            }
            match entry.port.read(&mut tmp) {
                Ok(0) => { /* keep looping until deadline */ }
                Ok(n) => entry.buffer.extend_from_slice(&tmp[..n]),
                Err(e) if e.kind() == std::io::ErrorKind::TimedOut => { /* check deadline */ }
                Err(e) => return Err(InvokeError::from(format!("read: {e}"))),
            }
        }
        if Instant::now() >= deadline {
            let reg = registry().lock().map_err(|_| InvokeError::from("registry poisoned"))?;
            let have = reg.get(&handle).map(|e| e.buffer.len()).unwrap_or(0);
            return Err(InvokeError::from(format!(
                "read timeout (got {have}/{len} bytes)"
            )));
        }
    }
}

#[tauri::command]
pub fn fc_serial_close(handle: u32) -> Result<(), InvokeError> {
    let mut reg = registry().lock().map_err(|_| InvokeError::from("registry poisoned"))?;
    // Drop the SerialPort to close; ignore "already gone" — that's the
    // normal post-MSC outcome where the FC rebooted out from under us.
    let removed = reg.remove(&handle);
    let _ = removed.map(|e| {
        log::debug!("Closed {} (handle {})", e.label, handle);
    });
    Ok(())
}
