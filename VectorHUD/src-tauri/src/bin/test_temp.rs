use hidapi::HidApi;

fn main() {
    println!("Enumerating HID devices...");
    let api = HidApi::new().expect("failed to init hidapi");
    for dev in api.device_list() {
        if dev.vendor_id() == 0x18d1 || dev.vendor_id() == 0x054c {
            println!(
                "VID: {:04x} | PID: {:04x} | Path: {} | Name: {:?}",
                dev.vendor_id(),
                dev.product_id(),
                dev.path().to_string_lossy(),
                dev.product_string()
            );
        }
    }
}
