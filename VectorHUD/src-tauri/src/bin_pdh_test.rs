use windows::Win32::Graphics::Dxgi::*;

fn main() -> Result<(), Box<dyn std::error::Error>> {
    unsafe {
        if let Ok(factory) = CreateDXGIFactory1::<IDXGIFactory1>() {
            if let Ok(adapter) = factory.EnumAdapters1(0) {
                if let Ok(adapter3) = adapter.cast::<IDXGIAdapter3>() {
                    let mut memory_info = Default::default();
                    if adapter3.QueryVideoMemoryInfo(0, DXGI_MEMORY_SEGMENT_GROUP_LOCAL, &mut memory_info).is_ok() {
                        let used = memory_info.CurrentUsage as f32 / 1_073_741_824.0;
                        let budget = memory_info.Budget as f32 / 1_073_741_824.0;
                        let percent = if budget > 0.0 { (used / budget) * 100.0 } else { 0.0 };
                        println!("VRAM Used: {:.2} GB / {:.2} GB ({:.1}%)", used, budget, percent);
                    }
                }
            }
        }
    }
    Ok(())
}
