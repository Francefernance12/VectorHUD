#![allow(
    dead_code,
    unused_variables,
    unused_imports,
    unused_assignments,
    unused_unsafe
)]

// Private modules
mod capture;
mod device;
mod error;
mod processing;
mod recorder;
mod types;

pub use device::audio::{enumerate_audio_input_devices, AudioInputDevice};
pub use device::video::{enumerate_video_encoders, VideoEncoder, VideoEncoderType};
pub use error::{RecorderError, Result};
pub use recorder::{AudioSource, Recorder, RecorderConfig, RecorderConfigBuilder};
