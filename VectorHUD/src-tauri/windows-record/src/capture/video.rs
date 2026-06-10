use log::{debug, info, trace, warn};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::mpsc::{SendError, Sender};
use std::sync::Arc;
use std::sync::{Barrier, Mutex};
use std::time::{Duration, Instant};
use windows::core::Error;
use windows::core::{ComInterface, Error as WindowsError, Result};
use windows::Win32::Foundation::HWND;
use windows::Win32::Graphics::Direct3D11::{ID3D11Device, ID3D11DeviceContext, ID3D11Texture2D};
use windows::Win32::Graphics::Dxgi::{IDXGIOutputDuplication, IDXGIResource};
use windows::Win32::System::Threading::*;
use windows::Win32::UI::WindowsAndMessaging::GetForegroundWindow;

use super::dxgi::{create_blank_dxgi_texture, setup_dxgi_duplication};
use super::window::{get_window_title, is_window_valid};
use crate::capture::dxgi::create_staging_texture;
use crate::types::{PooledTexture, SamplePool, SendableSample, TexturePool};

/// Struct to manage window target state
struct WindowTracker {
    /// The original target window handle
    hwnd: HWND,
    /// The process name to search for if the window handle becomes invalid
    process_name: String,
    /// The last time we checked if the window is still valid
    last_check: Instant,
    /// Time between validity checks (to avoid checking every frame)
    check_interval: Duration,
    /// Whether we have seen the window in focus at least once
    ever_focused: bool,
    /// Whether to use exact matching
    use_exact_match: bool,
}

impl WindowTracker {
    /// Create a new window tracker
    fn new(hwnd: HWND, process_name: &str) -> Self {
        Self::new_with_exact_match(hwnd, process_name, false)
    }

    /// Create a new window tracker with option for exact matching
    fn new_with_exact_match(hwnd: HWND, process_name: &str, use_exact_match: bool) -> Self {
        Self {
            hwnd,
            process_name: process_name.to_string(),
            last_check: Instant::now(),
            check_interval: Duration::from_secs(2), // Check every 2 seconds
            ever_focused: false,
            use_exact_match,
        }
    }

    /// Check if the window is currently in focus
    fn is_focused(&mut self) -> bool {
        let foreground_window = unsafe { GetForegroundWindow() };
        let is_target_window = foreground_window == self.hwnd;

        if is_target_window {
            // If window is now in focus, remember this
            self.ever_focused = true;
        }

        is_target_window
    }

    /// Ensure the window handle is still valid, and try to find it again if needed
    fn ensure_valid_window(&mut self) -> bool {
        let now = Instant::now();

        // Don't check too frequently
        if now.duration_since(self.last_check) < self.check_interval {
            return true;
        }

        self.last_check = now;

        // If the window is still valid, we're good
        if is_window_valid(self.hwnd) {
            return true;
        }

        // If not, try to find the window again
        if self.use_exact_match {
            debug!(
                "Window handle no longer valid, attempting to find '{}' again with exact match",
                self.process_name
            );

            if let Some(new_hwnd) = super::window::get_window_by_exact_string(&self.process_name) {
                debug!("Found window again with new handle: {:?}", new_hwnd);
                self.hwnd = new_hwnd;
                return true;
            }
        } else {
            debug!(
                "Window handle no longer valid, attempting to find '{}' again with substring match",
                self.process_name
            );

            if let Some(new_hwnd) = super::window::get_window_by_string(&self.process_name) {
                debug!("Found window again with new handle: {:?}", new_hwnd);
                self.hwnd = new_hwnd;
                return true;
            }
        }

        debug!("Failed to find window '{}'", self.process_name);
        false
    }
}

#[derive(Debug)]
enum FrameError {
    SendError(SendError<SendableSample>),
    WindowsError(WindowsError),
    ChannelClosed,
    TexturePoolError,
}

// Keep your existing impls unchanged
impl From<SendError<SendableSample>> for FrameError {
    fn from(err: SendError<SendableSample>) -> Self {
        FrameError::SendError(err)
    }
}

impl From<WindowsError> for FrameError {
    fn from(err: WindowsError) -> Self {
        FrameError::WindowsError(err)
    }
}

pub unsafe fn get_frames(
    send: Sender<SendableSample>,
    recording: Arc<AtomicBool>,
    hwnd: HWND,
    process_name: &str,
    fps_num: u32,
    fps_den: u32,
    input_width: u32,
    input_height: u32,
    started: Arc<Barrier>,
    device: Arc<ID3D11Device>,
    context_mutex: Arc<Mutex<ID3D11DeviceContext>>,
    use_exact_match: bool,
) -> Result<()> {
    info!(
        "Starting frame collection for window: '{}'",
        get_window_title(hwnd)
    );
    SetThreadPriority(GetCurrentThread(), THREAD_PRIORITY_ABOVE_NORMAL);

    // Create window tracker to handle focus and window validity
    let mut window_tracker =
        WindowTracker::new_with_exact_match(hwnd, process_name, use_exact_match);

    let frame_duration = Duration::from_nanos(1_000_000_000 * fps_den as u64 / fps_num as u64);
    let mut next_frame_time = Instant::now();
    let mut frame_count = 0;
    let mut accumulated_delay = Duration::ZERO;
    let mut num_duped = 0;

    // Initialize duplication first to detect if we're on an HDR screen
    let (mut duplication_result, actual_is_hdr) = match setup_dxgi_duplication(&device) {
        Ok((dupl, hdr)) => (Ok(dupl), hdr),
        Err(e) => (Err(e), false),
    };

    let texture_format = if actual_is_hdr {
        DXGI_FORMAT_R16G16B16A16_FLOAT
    } else {
        DXGI_FORMAT_B8G8R8A8_UNORM
    };

    let misc_flags = if actual_is_hdr {
        0
    } else {
        D3D11_RESOURCE_MISC_GDI_COMPATIBLE.0 as u32
    };

    // Initialize texture pool for reusable textures (for Media Foundation samples)
    use windows::Win32::Graphics::Direct3D11::*;
    use windows::Win32::Graphics::Dxgi::Common::*;

    let texture_pool = TexturePool::new(
        device.clone(),
        10, // Capacity
        input_width,
        input_height,
        texture_format,
        D3D11_USAGE_DEFAULT.0.try_into().unwrap(),
        (D3D11_BIND_SHADER_RESOURCE.0 | D3D11_BIND_RENDER_TARGET.0)
            .try_into()
            .unwrap(),
        0,                              // CPU access flags
        misc_flags.try_into().unwrap(), // Misc flags
    )?;
    let texture_pool = Arc::new(texture_pool);

    // Create blank texture with matching format to prevent CopyResource crashes
    let blank_desc = D3D11_TEXTURE2D_DESC {
        Width: input_width,
        Height: input_height,
        MipLevels: 1,
        ArraySize: 1,
        Format: texture_format,
        SampleDesc: DXGI_SAMPLE_DESC {
            Count: 1,
            Quality: 0,
        },
        Usage: D3D11_USAGE_DEFAULT,
        BindFlags: D3D11_BIND_SHADER_RESOURCE,
        CPUAccessFlags: D3D11_CPU_ACCESS_FLAG(0),
        MiscFlags: D3D11_RESOURCE_MISC_FLAG(0),
    };
    let mut blank_texture = None;
    device.CreateTexture2D(&blank_desc, None, Some(&mut blank_texture))?;
    let blank_texture = blank_texture.unwrap();

    // Create a pool for IMFSample objects that are bound to the textures
    let sample_pool = SamplePool::new(fps_num, 10);
    let sample_pool = Arc::new(sample_pool);

    // Signal that we're ready
    started.wait();

    let mut staging_texture = None;

    // Main recording loop
    while recording.load(Ordering::Relaxed) {
        if let Err(e) = &duplication_result {
            warn!("DXGI duplication error: {:?}. Retrying...", e);
            spin_sleep::sleep(Duration::from_millis(500));
            duplication_result = setup_dxgi_duplication(&device).map(|(d, _)| d);
            if duplication_result.is_err() {
                continue;
            }
        }

        let duplication = duplication_result.as_ref().unwrap();

        match process_frame(
            duplication,
            &context_mutex,
            &blank_texture,
            &mut window_tracker,
            fps_num,
            &send,
            frame_count,
            &mut next_frame_time,
            frame_duration,
            &mut accumulated_delay,
            &mut num_duped,
            &texture_pool,
            &sample_pool,
            &mut staging_texture,
        ) {
            Ok(_) => {
                frame_count += 1;
                //trace!("Collected frame {}", frame_count);
            }
            Err(e) => match e {
                FrameError::SendError(_) | FrameError::ChannelClosed => {
                    warn!("Channel closed or receiver disconnected, stopping frame collection");
                    break;
                }
                FrameError::WindowsError(e) => {
                    if e.code() == windows::Win32::Graphics::Dxgi::DXGI_ERROR_WAIT_TIMEOUT {
                        continue;
                    }

                    // Handle "keyed mutex abandoned" and access lost errors
                    if e.code() == windows::Win32::Graphics::Dxgi::DXGI_ERROR_ACCESS_LOST {
                        warn!("DXGI access lost (possibly keyed mutex abandoned), recreating duplication interface");
                        // Mark the duplication interface as invalid
                        duplication_result = Err(e);
                        continue;
                    }

                    // For other errors, return as before
                    return Err(e);
                }
                FrameError::TexturePoolError => {
                    // Handle texture pool error - log and continue
                    warn!("Texture pool error occurred, trying to continue");
                    continue;
                }
            },
        }
    }

    info!(
        "Frame collection finished. Number of duped frames: {}",
        num_duped
    );
    Ok(())
}

unsafe fn process_frame(
    duplication: &IDXGIOutputDuplication,
    context_mutex: &Arc<Mutex<ID3D11DeviceContext>>,
    blank_texture: &ID3D11Texture2D,
    _window_tracker: &mut WindowTracker,
    _fps_num: u32,
    send: &Sender<SendableSample>,
    frame_count: u64,
    next_frame_time: &mut Instant,
    frame_duration: Duration,
    accumulated_delay: &mut Duration,
    num_duped: &mut u64,
    texture_pool: &Arc<TexturePool>,
    sample_pool: &Arc<SamplePool>,
    staging_texture: &mut Option<ID3D11Texture2D>,
) -> std::result::Result<(), FrameError> {
    let mut resource: Option<IDXGIResource> = None;
    let mut info = windows::Win32::Graphics::Dxgi::DXGI_OUTDUPL_FRAME_INFO::default();

    // Always show content regardless of focus
    let should_show_content = true;

    duplication.AcquireNextFrame(16, &mut info, &mut resource)?;

    let context = context_mutex.lock().unwrap();

    if let Some(resource) = resource {
        // Acquire a texture from the pool rather than creating a new one every time
        let pooled_texture = texture_pool.acquire().map_err(|e| {
            log::error!("Failed to acquire texture from pool: {:?}", e);
            // Convert to WindowsError first if needed, or just use TexturePoolError variant
            FrameError::TexturePoolError
        })?;

        // Get the source texture from the resource
        let source_texture: ID3D11Texture2D = resource.cast()?;

        // Wrap the pooled_texture in PooledTexture to track its lifetime
        let arc_pooled = Arc::new(crate::types::PooledTexture {
            texture: pooled_texture.clone(),
            pool: texture_pool.clone(),
        });

        if should_show_content {
            use windows::Win32::Graphics::Direct3D11::*;
            use windows::Win32::Graphics::Dxgi::Common::*;

            let mut desc = D3D11_TEXTURE2D_DESC::default();
            source_texture.GetDesc(&mut desc);

            // Copy resource directly on the GPU (incredibly fast GPU-to-GPU copy)
            context.CopyResource(&pooled_texture, &source_texture);

            // Draw Mouse Cursor only if NOT HDR (since GDI/GetDC does not support float16 formats)
            if desc.Format != DXGI_FORMAT_R16G16B16A16_FLOAT {
                use windows::Win32::Graphics::Dxgi::IDXGISurface1;
                use windows::Win32::Graphics::Gdi::{
                    GetMonitorInfoW, MonitorFromWindow, MONITORINFO, MONITOR_DEFAULTTOPRIMARY,
                };
                use windows::Win32::UI::WindowsAndMessaging::{
                    DrawIconEx, GetCursorInfo, GetForegroundWindow, CURSORINFO, CURSOR_SHOWING,
                    DI_NORMAL,
                };

                if let Ok(surface) = pooled_texture.cast::<IDXGISurface1>() {
                    match surface.GetDC(false) {
                        Ok(hdc) => {
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

                            if GetCursorInfo(&mut cursor_info).into()
                                && cursor_info.flags.0 == CURSOR_SHOWING.0
                            {
                                let mut pos = cursor_info.ptScreenPos;
                                // Adjust to local texture coordinates
                                pos.x -= offset_x;
                                pos.y -= offset_y;

                                let res = DrawIconEx(
                                    hdc,
                                    pos.x,
                                    pos.y,
                                    cursor_info.hCursor,
                                    0,
                                    0,
                                    0,
                                    None,
                                    DI_NORMAL,
                                );
                                if res.0 == 0 {
                                    log::warn!("DrawIconEx failed");
                                }
                            }
                            let _ = surface.ReleaseDC(None);
                        }
                        Err(e) => {
                            log::warn!("GetDC failed: {:?}", e);
                        }
                    }
                } else {
                    log::warn!("Failed to cast pooled_texture to IDXGISurface1");
                }
            }
        } else {
            // Fill with black if not focused
            context.CopyResource(&pooled_texture, blank_texture);
        }

        // Release the original texture and frame
        drop(source_texture);
        duplication.ReleaseFrame()?;

        // Handle frame timing and duplication
        while *accumulated_delay >= frame_duration {
            debug!("Duping a frame to catch up");
            send_frame(&pooled_texture, frame_count, send, sample_pool, None)
                .map_err(|_| FrameError::ChannelClosed)?;
            *next_frame_time += frame_duration;
            *accumulated_delay -= frame_duration;
            *num_duped += 1;
        }

        // Send the real frame, passing arc_pooled to be released when the SendableSample drops
        send_frame(
            &pooled_texture,
            frame_count,
            send,
            sample_pool,
            Some(arc_pooled),
        )
        .map_err(|_| FrameError::ChannelClosed)?;
    }

    drop(context);

    *next_frame_time += frame_duration;

    let current_time = Instant::now();
    handle_frame_timing(current_time, *next_frame_time, accumulated_delay);

    Ok(())
}

unsafe fn send_frame(
    texture: &ID3D11Texture2D,
    frame_count: u64,
    send: &Sender<SendableSample>,
    sample_pool: &Arc<SamplePool>,
    pooled_texture: Option<Arc<PooledTexture>>,
) -> Result<()> {
    // Get a sample from the pool instead of creating a new one each time
    let samp = sample_pool.acquire_for_texture(texture)?;

    // Set the sample time based on frame count
    sample_pool.set_sample_time(&samp, frame_count)?;

    // Create a pooled SendableSample that will return the sample to the pool when dropped
    let sendable = SendableSample::new_pooled(samp, texture, sample_pool.clone(), pooled_texture);

    // Send the sample and return to pool if fails
    match send.send(sendable) {
        Ok(_) => Ok(()),
        Err(_e) => {
            trace!("Failed to send frame (channel closed), sample will be returned to pool");
            Err(Error::from_win32())
        }
    }
}

fn handle_frame_timing(
    current_time: Instant,
    next_frame_time: Instant,
    accumulated_delay: &mut Duration,
) {
    if current_time > next_frame_time {
        let overrun = current_time.duration_since(next_frame_time);
        *accumulated_delay += overrun;
    } else {
        let sleep_time = next_frame_time.duration_since(current_time);
        spin_sleep::sleep(sleep_time);
    }
}
