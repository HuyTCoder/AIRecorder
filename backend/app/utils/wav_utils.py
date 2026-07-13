import numpy as np


def normalize(audio_data: np.ndarray) -> np.ndarray:
    """
    Normalize audio data to -1.0 to 1.0 or based on dtype max to prevent clipping.
    Mainly used for mixed audio.
    """
    if len(audio_data) == 0:
        return audio_data

    if audio_data.dtype.kind == "f":
        max_val = np.max(np.abs(audio_data))
        if max_val > 1.0:
            return audio_data / max_val
        return audio_data
    elif audio_data.dtype == np.int16:
        float_data = audio_data.astype(np.float32) / 32768.0
        max_val = np.max(np.abs(float_data))
        if max_val > 1.0:
            float_data = float_data / max_val
        return (float_data * 32767).astype(np.int16)
    return audio_data


def resample(audio_data: np.ndarray, orig_sr: int, target_sr: int) -> np.ndarray:
    """
    Resample audio data from orig_sr to target_sr using linear interpolation.
    """
    if orig_sr == target_sr:
        return audio_data

    duration = len(audio_data) / orig_sr
    new_length = int(duration * target_sr)

    orig_indices = np.arange(len(audio_data))
    new_indices = np.linspace(0, len(audio_data) - 1, new_length)

    if audio_data.ndim == 1:
        resampled = np.interp(new_indices, orig_indices, audio_data)
    else:
        resampled = np.zeros((new_length, audio_data.shape[1]), dtype=audio_data.dtype)
        for i in range(audio_data.shape[1]):
            resampled[:, i] = np.interp(new_indices, orig_indices, audio_data[:, i])

    return resampled.astype(audio_data.dtype)
