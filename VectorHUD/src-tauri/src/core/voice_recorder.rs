use cpal::traits::{DeviceTrait, HostTrait, StreamTrait};
use std::sync::{Arc, Mutex};
use tracing::{error, info};

pub struct VoiceRecorder {
    _stream: cpal::Stream,
    pub samples: Arc<Mutex<Vec<i16>>>,
    pub sample_rate: u32,
    pub channels: u16,
}

pub struct VoiceRecorderState(pub std::sync::Mutex<Option<VoiceRecorder>>);

pub fn encode_wav(samples: &[i16], sample_rate: u32, channels: u16) -> Result<Vec<u8>, String> {
    if samples.is_empty() {
        return Err("No samples recorded".to_string());
    }

    // Downmix to mono if multi-channel to save payload size
    let mono_samples = if channels > 1 {
        let mut mono = Vec::with_capacity(samples.len() / channels as usize);
        let c = channels as usize;
        for chunk in samples.chunks_exact(c) {
            let sum: i32 = chunk.iter().map(|&s| s as i32).sum();
            let avg = (sum / c as i32) as i16;
            mono.push(avg);
        }
        mono
    } else {
        samples.to_vec()
    };

    let channels = 1u16; // Downmixed to mono

    let mut spec = Vec::new();
    let subchunk2_size = mono_samples.len() as u32 * 2; // 16-bit PCM (2 bytes per sample)
    let file_size = 36 + subchunk2_size;

    spec.reserve(44 + mono_samples.len() * 2);

    spec.extend_from_slice(b"RIFF");
    spec.extend_from_slice(&file_size.to_le_bytes());
    spec.extend_from_slice(b"WAVEfmt ");
    spec.extend_from_slice(&16u32.to_le_bytes()); // Subchunk1Size (16 for PCM)
    spec.extend_from_slice(&1u16.to_le_bytes()); // AudioFormat (1 = PCM)
    spec.extend_from_slice(&channels.to_le_bytes());
    spec.extend_from_slice(&sample_rate.to_le_bytes());

    let byte_rate = sample_rate * channels as u32 * 2;
    spec.extend_from_slice(&byte_rate.to_le_bytes());

    let block_align = channels * 2;
    spec.extend_from_slice(&block_align.to_le_bytes());
    spec.extend_from_slice(&16u16.to_le_bytes()); // BitsPerSample

    spec.extend_from_slice(b"data");
    spec.extend_from_slice(&subchunk2_size.to_le_bytes());

    for &s in &mono_samples {
        spec.extend_from_slice(&s.to_le_bytes());
    }

    Ok(spec)
}

impl VoiceRecorder {
    pub fn start() -> Result<Self, String> {
        let host = cpal::default_host();
        let device = host
            .default_input_device()
            .ok_or_else(|| "No default input device available".to_string())?;

        let device_name = format!("{}", device);
        info!(
            "Using default input device for voice assistant: {}",
            device_name
        );

        let config = device
            .default_input_config()
            .map_err(|e| format!("Failed to get default input config: {}", e))?;

        let sample_rate = config.sample_rate();
        let channels = config.channels();

        info!(
            "Mic default input config - sample rate: {}, channels: {}, format: {:?}",
            sample_rate,
            channels,
            config.sample_format()
        );

        let samples = Arc::new(Mutex::new(Vec::new()));
        let samples_clone = samples.clone();

        // Safety limit: 30 seconds maximum recording duration
        let max_samples = (sample_rate * channels as u32 * 30) as usize;

        let err_fn = |err| error!("An error occurred on voice stream: {}", err);

        let stream = match config.sample_format() {
            cpal::SampleFormat::F32 => device.build_input_stream(
                config.into(),
                move |data: &[f32], _: &cpal::InputCallbackInfo| {
                    let mut buf = samples_clone.lock().unwrap();
                    if buf.len() >= max_samples {
                        return;
                    }
                    for &sample in data {
                        if buf.len() >= max_samples {
                            break;
                        }
                        // Clamp and scale to i16
                        let s = (sample.clamp(-1.0, 1.0) * 32767.0) as i16;
                        buf.push(s);
                    }
                },
                err_fn,
                None,
            ),
            cpal::SampleFormat::I16 => device.build_input_stream(
                config.into(),
                move |data: &[i16], _: &cpal::InputCallbackInfo| {
                    let mut buf = samples_clone.lock().unwrap();
                    if buf.len() >= max_samples {
                        return;
                    }
                    for &sample in data {
                        if buf.len() >= max_samples {
                            break;
                        }
                        buf.push(sample);
                    }
                },
                err_fn,
                None,
            ),
            cpal::SampleFormat::U16 => device.build_input_stream(
                config.into(),
                move |data: &[u16], _: &cpal::InputCallbackInfo| {
                    let mut buf = samples_clone.lock().unwrap();
                    if buf.len() >= max_samples {
                        return;
                    }
                    for &sample in data {
                        if buf.len() >= max_samples {
                            break;
                        }
                        // Offset binary format to 16-bit signed
                        let s = (sample as i32 - 32768) as i16;
                        buf.push(s);
                    }
                },
                err_fn,
                None,
            ),
            _ => return Err("Unsupported sample format for microphone capture".to_string()),
        }
        .map_err(|e| format!("Failed to build input stream: {}", e))?;

        stream
            .play()
            .map_err(|e| format!("Failed to play input stream: {}", e))?;

        Ok(Self {
            _stream: stream,
            samples,
            sample_rate,
            channels,
        })
    }

    pub fn get_wav_bytes(&self) -> Result<Vec<u8>, String> {
        let raw_samples = self.samples.lock().unwrap().clone();
        encode_wav(&raw_samples, self.sample_rate, self.channels)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_encode_wav_structure() {
        let samples = vec![0i16, 1000, -1000, 2000, -2000];
        let wav_bytes = encode_wav(&samples, 16000, 1).unwrap();
        assert_eq!(&wav_bytes[0..4], b"RIFF");
        assert_eq!(&wav_bytes[8..12], b"WAVE");
        assert_eq!(&wav_bytes[12..16], b"fmt ");
        assert_eq!(&wav_bytes[36..40], b"data");

        // Header (44 bytes) + 5 samples * 2 bytes = 54 bytes
        assert_eq!(wav_bytes.len(), 54);
    }
}
