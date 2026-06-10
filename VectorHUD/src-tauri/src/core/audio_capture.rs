use cpal::traits::{DeviceTrait, HostTrait, StreamTrait};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use tokio::io::AsyncWriteExt;
use tokio::net::windows::named_pipe::ServerOptions;
use tracing::{error, info};

pub struct AudioCapture {
    _stream: cpal::Stream,
    pub is_running: Arc<AtomicBool>,
}

pub async fn start_loopback_capture(pipe_name: &str) -> Result<(AudioCapture, u32, u16), String> {
    let host = cpal::default_host();
    let device = host
        .default_output_device()
        .ok_or_else(|| "No default output device available".to_string())?;

    info!("Using output device: {}", device);

    let config = device
        .default_output_config()
        .map_err(|e| format!("Failed to get default output config: {}", e))?;

    info!("Default output config: {:?}", config);

    let sample_rate = config.sample_rate();
    let channels = config.channels();

    // We must ensure the format is f32
    if config.sample_format() != cpal::SampleFormat::F32 {
        // Technically WASAPI loopback is usually F32, but just in case
        info!("Sample format is not F32: {:?}", config.sample_format());
    }

    // Create the named pipe server
    let mut server = ServerOptions::new()
        .first_pipe_instance(true)
        .create(pipe_name)
        .map_err(|e| format!("Failed to create named pipe: {}", e))?;

    info!(
        "Named pipe {} created, background task will wait for FFmpeg to connect...",
        pipe_name
    );

    let is_running = Arc::new(AtomicBool::new(true));
    let is_running_clone = is_running.clone();

    // Use a flume channel to send data from the real-time audio thread to the tokio task
    // because writing to a pipe is an async/blocking operation, which we can't do in the cpal callback.
    let (tx, rx) = flume::unbounded::<Vec<u8>>();

    let err_fn = |err| error!("an error occurred on stream: {}", err);

    let stream = match config.sample_format() {
        cpal::SampleFormat::F32 => device.build_input_stream(
            config.config(),
            move |data: &[f32], _: &cpal::InputCallbackInfo| {
                if !is_running_clone.load(Ordering::Relaxed) {
                    return;
                }
                // Convert f32 slice to u8 bytes
                let byte_slice: &[u8] = bytemuck::cast_slice(data);
                let _ = tx.send(byte_slice.to_vec());
            },
            err_fn,
            None,
        ),
        _ => return Err("Only F32 sample format is currently supported for loopback".to_string()),
    }
    .map_err(|e| format!("Failed to build input stream: {}", e))?;

    stream
        .play()
        .map_err(|e| format!("Failed to play stream: {}", e))?;

    // Spawn task to drain the channel and write to the named pipe
    let is_running_writer = is_running.clone();
    tokio::spawn(async move {
        // Wait for FFmpeg to connect
        if let Err(e) = server.connect().await {
            error!("Failed to connect to named pipe: {}", e);
            return;
        }
        info!("FFmpeg connected to audio pipe.");

        while is_running_writer.load(Ordering::Relaxed) {
            if let Ok(data) = rx.recv_async().await {
                if let Err(e) = server.write_all(&data).await {
                    error!("Failed to write to audio named pipe: {}", e);
                    break;
                }
            } else {
                break; // Channel closed
            }
        }
        info!("Audio pipe writer task exited.");
    });

    Ok((
        AudioCapture {
            _stream: stream,
            is_running,
        },
        sample_rate,
        channels,
    ))
}

impl Drop for AudioCapture {
    fn drop(&mut self) {
        self.is_running.store(false, Ordering::Relaxed);
        info!("AudioCapture dropped, stopping loopback stream.");
    }
}
