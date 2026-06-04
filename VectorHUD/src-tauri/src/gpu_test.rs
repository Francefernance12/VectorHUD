use windows::core::{PCWSTR, w};
use windows::Win32::System::Performance::*;

fn main() {
    unsafe {
        let mut query: isize = 0;
        if PdhOpenQueryW(PCWSTR::null(), 0, &mut query) != 0 {
            println!("PdhOpenQueryW failed");
            return;
        }
        let mut counter: isize = 0;
        let status = PdhAddEnglishCounterW(query, w!("\\GPU Engine(*\\engtype_3D)\\Utilization Percentage"), 0, &mut counter);
        if status != 0 {
            println!("PdhAddEnglishCounterW failed: {:x}", status);
            return;
        }
        
        PdhCollectQueryData(query);
        std::thread::sleep(std::time::Duration::from_millis(1000));
        let status2 = PdhCollectQueryData(query);
        if status2 != 0 {
            println!("PdhCollectQueryData failed: {:x}", status2);
        }

        let mut buf_size: u32 = 0;
        let mut item_count: u32 = 0;
        let _ = PdhGetFormattedCounterArrayW(counter, PDH_FMT_DOUBLE, &mut buf_size, &mut item_count, None);
        
        println!("buf_size: {}, item_count: {}", buf_size, item_count);
        
        if buf_size > 0 && item_count > 0 {
            let mut buffer = vec![0u8; buf_size as usize];
            if PdhGetFormattedCounterArrayW(counter, PDH_FMT_DOUBLE, &mut buf_size, &mut item_count, Some(buffer.as_mut_ptr() as *mut _)) == 0 {
                let items = std::slice::from_raw_parts(buffer.as_ptr() as *const PDH_FMT_COUNTERVALUE_ITEM_W, item_count as usize);
                let mut sum_usage = 0.0;
                for item in items {
                    let val = item.FmtValue.Anonymous.doubleValue as f32;
                    let name = item.szName.to_string().unwrap_or_default();
                    println!("Item: {} - Value: {}", name, val);
                    sum_usage += val;
                }
                println!("Total GPU 3D: {}", sum_usage);
            } else {
                println!("PdhGetFormattedCounterArrayW failed to read");
            }
        }
    }
}
