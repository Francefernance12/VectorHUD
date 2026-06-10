use windows::core::{ComInterface, Result};
use windows::Win32::Graphics::Direct3D11::{ID3D11Device, ID3D11Texture2D};
use windows::Win32::Graphics::Dxgi::Common::*;
use windows::Win32::Graphics::Dxgi::*;

pub unsafe fn setup_dxgi_duplication(
    device: &ID3D11Device,
) -> Result<(IDXGIOutputDuplication, bool)> {
    use windows::Win32::Graphics::Gdi::{MonitorFromWindow, MONITOR_DEFAULTTOPRIMARY};
    use windows::Win32::UI::WindowsAndMessaging::GetForegroundWindow;

    // Get DXGI device
    let dxgi_device: IDXGIDevice = device.cast()?;

    // Get adapter
    let dxgi_adapter: IDXGIAdapter = dxgi_device.GetAdapter()?;

    // Find the monitor the active window is on
    let hwnd = GetForegroundWindow();
    let target_hmonitor = MonitorFromWindow(hwnd, MONITOR_DEFAULTTOPRIMARY);

    let mut selected_output = None;
    let mut i = 0;
    while let Ok(output) = dxgi_adapter.EnumOutputs(i) {
        let mut desc: DXGI_OUTPUT_DESC = std::mem::zeroed();
        if output.GetDesc(&mut desc).is_ok() {
            if desc.Monitor == target_hmonitor {
                selected_output = Some(output);
                break;
            }
        }
        i += 1;
    }

    // Fallback to primary monitor (index 0) if not found
    let output = selected_output.unwrap_or_else(|| dxgi_adapter.EnumOutputs(0).unwrap());

    let mut is_hdr = false;
    match output.cast::<IDXGIOutput6>() {
        Ok(output6) => {
            let mut desc1 = std::mem::zeroed();
            match output6.GetDesc1(&mut desc1) {
                Ok(_) => {
                    log::info!(
                        "DXGI Output Duplication: BitsPerColor={}, ColorSpace={}",
                        desc1.BitsPerColor,
                        desc1.ColorSpace.0
                    );
                    if desc1.BitsPerColor > 8
                        || desc1.ColorSpace == DXGI_COLOR_SPACE_RGB_FULL_G2084_NONE_P2020
                        || desc1.ColorSpace == DXGI_COLOR_SPACE_RGB_FULL_G10_NONE_P709
                        || desc1.ColorSpace.0 == 14 // DXGI_COLOR_SPACE_RGB_STUDIO_G2084_LEFT_P2020
                        || desc1.ColorSpace.0 == 17
                    // DXGI_COLOR_SPACE_RGB_FULL_G22_NONE_P2020
                    {
                        is_hdr = true;
                    }
                }
                Err(e) => {
                    log::warn!("IDXGIOutput6::GetDesc1 failed: {:?}", e);
                }
            }
        }
        Err(e) => {
            log::warn!("Failed to cast IDXGIOutput to IDXGIOutput6: {:?}", e);
        }
    }

    let mut duplication = None;
    let mut actual_is_hdr = false;

    if is_hdr {
        if let Ok(output5) = output.cast::<IDXGIOutput5>() {
            let formats = [DXGI_FORMAT_R16G16B16A16_FLOAT, DXGI_FORMAT_B8G8R8A8_UNORM];
            log::info!("Attempting IDXGIOutput5::DuplicateOutput1 with HDR formats...");
            match output5.DuplicateOutput1(device, 0, &formats) {
                Ok(dupl) => {
                    duplication = Some(dupl);
                    actual_is_hdr = true;
                    log::info!("IDXGIOutput5::DuplicateOutput1 succeeded, using HDR capture mode.");
                }
                Err(e) => {
                    log::warn!("IDXGIOutput5::DuplicateOutput1 failed: {:?}. Falling back to default DuplicateOutput.", e);
                }
            }
        }
    }

    let duplication = match duplication {
        Some(dupl) => dupl,
        None => {
            log::info!("Using fallback IDXGIOutput1::DuplicateOutput.");
            actual_is_hdr = false;
            let output1: IDXGIOutput1 = output.cast()?;
            output1.DuplicateOutput(device)?
        }
    };

    Ok((duplication, actual_is_hdr))
}

pub unsafe fn create_blank_dxgi_texture(
    device: &ID3D11Device,
    input_width: u32,
    input_height: u32,
) -> Result<(ID3D11Texture2D, IDXGIResource)> {
    use windows::Win32::Graphics::Direct3D11::*;

    let desc = D3D11_TEXTURE2D_DESC {
        Width: input_width,
        Height: input_height,
        MipLevels: 1,
        ArraySize: 1,
        Format: DXGI_FORMAT_B8G8R8A8_UNORM,
        SampleDesc: DXGI_SAMPLE_DESC {
            Count: 1,
            Quality: 0,
        },
        Usage: D3D11_USAGE_DEFAULT,
        BindFlags: D3D11_BIND_SHADER_RESOURCE,
        CPUAccessFlags: D3D11_CPU_ACCESS_FLAG(0),
        MiscFlags: D3D11_RESOURCE_MISC_FLAG(0),
    };

    let mut texture = None;
    device.CreateTexture2D(&desc, None, Some(&mut texture))?;

    let texture = texture.unwrap();
    let dxgi_resource: IDXGIResource = texture.cast()?;

    Ok((texture, dxgi_resource))
}

pub unsafe fn create_staging_texture(
    device: &ID3D11Device,
    input_width: u32,
    input_height: u32,
) -> Result<ID3D11Texture2D> {
    use windows::Win32::Graphics::Direct3D11::*;
    use windows::Win32::Graphics::Dxgi::Common::*;

    let desc = D3D11_TEXTURE2D_DESC {
        Width: input_width,
        Height: input_height,
        MipLevels: 1,
        ArraySize: 1,
        Format: DXGI_FORMAT_B8G8R8A8_UNORM,
        SampleDesc: DXGI_SAMPLE_DESC {
            Count: 1,
            Quality: 0,
        },
        Usage: D3D11_USAGE_DEFAULT,
        BindFlags: D3D11_BIND_SHADER_RESOURCE | D3D11_BIND_RENDER_TARGET,
        CPUAccessFlags: D3D11_CPU_ACCESS_FLAG(0),
        MiscFlags: D3D11_RESOURCE_MISC_GDI_COMPATIBLE,
    };

    let mut staging_texture = None;
    device.CreateTexture2D(&desc, None, Some(&mut staging_texture))?;
    Ok(staging_texture.unwrap())
}

pub unsafe fn capture_raw_frame() -> Result<(Vec<u8>, u32, u32, bool)> {
    use windows::Win32::Graphics::Direct3D::*;
    use windows::Win32::Graphics::Direct3D11::*;

    // 1. Create D3D11 device and context
    let feature_levels = [
        D3D_FEATURE_LEVEL_11_1,
        D3D_FEATURE_LEVEL_11_0,
        D3D_FEATURE_LEVEL_10_1,
        D3D_FEATURE_LEVEL_10_0,
    ];
    let mut device = None;
    let mut context = None;
    let mut flags = D3D11_CREATE_DEVICE_BGRA_SUPPORT;

    #[cfg(debug_assertions)]
    {
        flags |= D3D11_CREATE_DEVICE_DEBUG;
    }

    let mut res = D3D11CreateDevice(
        None,
        D3D_DRIVER_TYPE_HARDWARE,
        None,
        flags,
        Some(&feature_levels),
        D3D11_SDK_VERSION,
        Some(&mut device),
        None,
        Some(&mut context),
    );

    if res.is_err() && cfg!(debug_assertions) {
        flags &= !D3D11_CREATE_DEVICE_DEBUG;
        res = D3D11CreateDevice(
            None,
            D3D_DRIVER_TYPE_HARDWARE,
            None,
            flags,
            Some(&feature_levels),
            D3D11_SDK_VERSION,
            Some(&mut device),
            None,
            Some(&mut context),
        );
    }

    res?;

    let device = device.unwrap();
    let context = context.unwrap();

    // 2. Set up DXGI Duplication (automatically targets the monitor with active window)
    let (duplication, is_hdr) = setup_dxgi_duplication(&device)?;

    // 3. Acquire frame with proper DXGI Desktop Duplication semantics.
    //
    // Desktop Duplication is delta-based: it only produces frames when the desktop changes.
    // On a static screen, AcquireNextFrame returns DXGI_ERROR_WAIT_TIMEOUT until something redraws.
    //
    // IMPORTANT: Always call ReleaseFrame() after every successful AcquireNextFrame.
    //            If resource is None (cursor-only update), release and retry.
    //            If resource is Some, copy texture BEFORE releasing (frame stays valid until ReleaseFrame).
    let mut acquired_texture: Option<ID3D11Texture2D> = None;

    // Small initial delay to allow the compositor to generate the first frame after initialization
    std::thread::sleep(std::time::Duration::from_millis(50));

    for attempt in 0..60 {
        let mut resource: Option<IDXGIResource> = None;
        let mut info = windows::Win32::Graphics::Dxgi::DXGI_OUTDUPL_FRAME_INFO::default();

        match duplication.AcquireNextFrame(50, &mut info, &mut resource) {
            Ok(_) => {
                if let Some(res) = resource {
                    // Got a real desktop image — copy it before releasing
                    let source_texture: ID3D11Texture2D = res.cast()?;
                    acquired_texture = Some(source_texture);
                    // NOTE: do NOT ReleaseFrame here — we release after CopyResource below
                    break;
                } else {
                    // Cursor-only update (no desktop image change) — MUST release frame
                    let _ = duplication.ReleaseFrame();
                    log::trace!(
                        "capture_raw_frame: cursor-only frame (attempt {}), retrying",
                        attempt
                    );
                }
            }
            Err(e) => {
                use windows::Win32::Graphics::Dxgi::DXGI_ERROR_WAIT_TIMEOUT;
                if e.code() == DXGI_ERROR_WAIT_TIMEOUT {
                    // No desktop update yet — keep waiting
                    log::trace!("capture_raw_frame: timeout (attempt {}), retrying", attempt);
                    std::thread::sleep(std::time::Duration::from_millis(16));
                } else {
                    log::warn!("capture_raw_frame: AcquireNextFrame error {:?}", e);
                    return Err(e);
                }
            }
        }
    }

    let source_texture = acquired_texture.ok_or_else(|| {
        windows::core::Error::new(
            windows::core::HRESULT(-2147467259), // E_FAIL
            windows::core::HSTRING::from("Failed to acquire frame from DXGI duplication"),
        )
    })?;

    let mut desc = D3D11_TEXTURE2D_DESC::default();
    source_texture.GetDesc(&mut desc);

    // 4. Create staging texture
    let staging_desc = D3D11_TEXTURE2D_DESC {
        Width: desc.Width,
        Height: desc.Height,
        MipLevels: 1,
        ArraySize: 1,
        Format: desc.Format,
        SampleDesc: DXGI_SAMPLE_DESC {
            Count: 1,
            Quality: 0,
        },
        Usage: D3D11_USAGE_STAGING,
        BindFlags: windows::Win32::Graphics::Direct3D11::D3D11_BIND_FLAG(0),
        CPUAccessFlags: D3D11_CPU_ACCESS_READ,
        MiscFlags: windows::Win32::Graphics::Direct3D11::D3D11_RESOURCE_MISC_FLAG(0),
    };

    let mut staging_texture = None;
    device.CreateTexture2D(&staging_desc, None, Some(&mut staging_texture))?;
    let staging_texture = staging_texture.unwrap();

    // 5. Copy resource to staging texture
    context.CopyResource(&staging_texture, &source_texture);

    // Draw cursor if showing
    if let Ok(surface) = staging_texture.cast::<IDXGISurface1>() {
        if let Ok(hdc) = surface.GetDC(false) {
            use windows::Win32::Graphics::Gdi::{
                GetMonitorInfoW, MonitorFromWindow, MONITORINFO, MONITOR_DEFAULTTOPRIMARY,
            };
            use windows::Win32::UI::WindowsAndMessaging::{
                DrawIconEx, GetCursorInfo, GetForegroundWindow, GetIconInfo, CURSORINFO,
                CURSOR_SHOWING, DI_NORMAL, ICONINFO,
            };

            let mut cursor_info = CURSORINFO {
                cbSize: std::mem::size_of::<CURSORINFO>() as u32,
                ..Default::default()
            };

            let hwnd = GetForegroundWindow();
            let target_hmonitor = MonitorFromWindow(hwnd, MONITOR_DEFAULTTOPRIMARY);
            let mut minfo = MONITORINFO {
                cbSize: std::mem::size_of::<MONITORINFO>() as u32,
                ..Default::default()
            };

            let mut offset_x = 0;
            let mut offset_y = 0;
            if GetMonitorInfoW(target_hmonitor, &mut minfo).into() {
                offset_x = minfo.rcMonitor.left;
                offset_y = minfo.rcMonitor.top;
            }

            if GetCursorInfo(&mut cursor_info).into() && cursor_info.flags.0 == CURSOR_SHOWING.0 {
                let mut pos = cursor_info.ptScreenPos;
                pos.x -= offset_x;
                pos.y -= offset_y;

                let mut ii = ICONINFO::default();
                if GetIconInfo(cursor_info.hCursor, &mut ii).as_bool() {
                    let h_x = ii.xHotspot as i32;
                    let h_y = ii.yHotspot as i32;
                    DrawIconEx(
                        hdc,
                        pos.x - h_x,
                        pos.y - h_y,
                        cursor_info.hCursor,
                        0,
                        0,
                        0,
                        None,
                        DI_NORMAL,
                    );

                    if !ii.hbmMask.is_invalid() {
                        let _ = windows::Win32::Graphics::Gdi::DeleteObject(ii.hbmMask);
                    }
                    if !ii.hbmColor.is_invalid() {
                        let _ = windows::Win32::Graphics::Gdi::DeleteObject(ii.hbmColor);
                    }
                }
            }
            let _ = surface.ReleaseDC(None);
        }
    }

    let _ = duplication.ReleaseFrame();

    // 6. Map and read pixels
    let mut mapped = D3D11_MAPPED_SUBRESOURCE::default();
    context.Map(&staging_texture, 0, D3D11_MAP_READ, 0, Some(&mut mapped))?;

    let row_pitch = mapped.RowPitch as usize;
    let mut bgra_data = vec![0u8; (desc.Width * desc.Height * 4) as usize];

    if desc.Format == DXGI_FORMAT_R16G16B16A16_FLOAT {
        let row_pitch_pixels = row_pitch / 2;
        let pixels_f16 = std::slice::from_raw_parts(
            mapped.pData as *const u16,
            row_pitch_pixels * desc.Height as usize,
        );
        bgra_data = tone_map_scrgb_to_bgra(pixels_f16, desc.Width, desc.Height, row_pitch_pixels);
    } else {
        let data_slice =
            std::slice::from_raw_parts(mapped.pData as *const u8, row_pitch * desc.Height as usize);
        for y in 0..desc.Height as usize {
            let src_start = y * row_pitch;
            let src_end = src_start + (desc.Width * 4) as usize;
            let dest_start = y * (desc.Width * 4) as usize;
            bgra_data[dest_start..dest_start + (desc.Width * 4) as usize]
                .copy_from_slice(&data_slice[src_start..src_end]);
        }
    }
    context.Unmap(&staging_texture, 0);

    Ok((bgra_data, desc.Width, desc.Height, is_hdr))
}

pub fn tone_map_scrgb_to_bgra(
    pixels_f16: &[u16],
    width: u32,
    height: u32,
    row_pitch_pixels: usize,
) -> Vec<u8> {
    // In Windows scRGB (used by Desktop Duplication with DuplicateOutput1):
    //   1.0 = 80 nits (the scRGB reference white)
    //   Windows default SDR content brightness = ~200 nits = 2.5 scRGB units
    //
    // Goal: Map scRGB range to [0, 1] with correct brightness for SDR content
    // and smooth compression for HDR highlights.
    //
    // We normalize by SDR_WHITE so that SDR white maps to 1.0.
    // To prevent SDR content from becoming dark, we use a piecewise soft-knee curve:
    //   For v <= 0.8: v_out = v (perfectly linear, preserves contrast/brightness)
    //   For v > 0.8: v_out = 0.8 + 0.2 * ((v - 0.8) / (0.2 + (v - 0.8)))
    // This maps SDR white (1.0) to 0.9 (bright and vivid), and maps HDR highlights up
    // to infinity into the [0.9, 1.0] range.

    const SDR_WHITE: f32 = 2.5; // 200 nits / 80 nits per scRGB unit

    #[inline(always)]
    fn soft_knee_tonemap(v: f32) -> f32 {
        if v <= 0.8 {
            v
        } else {
            0.8 + 0.2 * ((v - 0.8) / (0.2 + (v - 0.8)))
        }
    }

    #[inline(always)]
    fn linear_to_srgb(v: f32) -> f32 {
        if v <= 0.0031308 {
            v * 12.92
        } else {
            1.055 * v.powf(1.0 / 2.4) - 0.055
        }
    }

    let mut bgra = vec![0u8; (width * height * 4) as usize];
    for y in 0..height as usize {
        let src_start = y * row_pitch_pixels;
        let dest_start = y * (width * 4) as usize;

        for x in 0..width as usize {
            let pixel_idx = src_start + x * 4;

            // Decode half-float (scRGB linear)
            let mut r = half::f16::from_bits(pixels_f16[pixel_idx])
                .to_f32()
                .max(0.0);
            let mut g = half::f16::from_bits(pixels_f16[pixel_idx + 1])
                .to_f32()
                .max(0.0);
            let mut b = half::f16::from_bits(pixels_f16[pixel_idx + 2])
                .to_f32()
                .max(0.0);

            // Normalize to SDR reference: 1.0 = SDR white
            r /= SDR_WHITE;
            g /= SDR_WHITE;
            b /= SDR_WHITE;

            // Apply soft-knee tone mapping to each channel
            r = soft_knee_tonemap(r);
            g = soft_knee_tonemap(g);
            b = soft_knee_tonemap(b);

            // Apply sRGB transfer function (linear → gamma)
            let r_srgb = linear_to_srgb(r.clamp(0.0, 1.0));
            let g_srgb = linear_to_srgb(g.clamp(0.0, 1.0));
            let b_srgb = linear_to_srgb(b.clamp(0.0, 1.0));

            // Write as BGRA8
            let dest_pixel = dest_start + x * 4;
            bgra[dest_pixel] = (b_srgb * 255.0 + 0.5) as u8;
            bgra[dest_pixel + 1] = (g_srgb * 255.0 + 0.5) as u8;
            bgra[dest_pixel + 2] = (r_srgb * 255.0 + 0.5) as u8;
            bgra[dest_pixel + 3] = 255;
        }
    }
    bgra
}
