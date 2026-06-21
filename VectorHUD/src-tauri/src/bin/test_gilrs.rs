use gilrs::Gilrs;
use std::thread;
use std::time::Duration;

fn main() {
    println!("Initializing gilrs...");
    let mut gilrs = match Gilrs::new() {
        Ok(g) => g,
        Err(e) => {
            println!("Failed to initialize gilrs: {}", e);
            return;
        }
    };

    println!("Connected gamepads on start:");
    for (id, gamepad) in gilrs.gamepads() {
        println!(
            "ID: {}, Name: {}, VID: {:?}, PID: {:?}",
            id,
            gamepad.name(),
            gamepad.vendor_id(),
            gamepad.product_id()
        );
    }

    println!("\nListening for gamepad events (press buttons / move sticks). Ctrl+C to exit...");
    loop {
        while let Some(event) = gilrs.next_event() {
            println!("Event: {:?}", event);
        }
        thread::sleep(Duration::from_millis(50));
    }
}
