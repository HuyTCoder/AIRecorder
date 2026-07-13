import logging
import os
import tarfile
import urllib.request
import sys
import site
import wave
from pathlib import Path
from threading import Event, Lock
from typing import Optional, List
import numpy as np

# Try to add onnxruntime/capi to DLL search path on Windows
if sys.platform == "win32":
    try:
        import onnxruntime
        ort_capi = Path(onnxruntime.__file__).parent / "capi"
        if ort_capi.exists():
            os.add_dll_directory(str(ort_capi))
    except Exception:
        # Fallback to site packages approach
        try:
            for sp in site.getsitepackages():
                ort_capi_fallback = Path(sp) / "onnxruntime" / "capi"
                if ort_capi_fallback.exists():
                    os.add_dll_directory(str(ort_capi_fallback))
                    break
        except Exception:
            pass

try:
    import sherpa_onnx
except ImportError:
    sherpa_onnx = None
from app.services.asr_service import ASRService
from app.models.recording import TranscriptSegment
from app.services.punctuation import PunctuationService
from app.services.diarization import DiarizationService

logger = logging.getLogger(__name__)


class ZipformerService(ASRService):
    MODEL_URL = "https://github.com/k2-fsa/sherpa-onnx/releases/download/asr-models/sherpa-onnx-zipformer-vi-2025-04-20.tar.bz2"
    MODEL_DIR_NAME = "sherpa-onnx-zipformer-vi-2025-04-20"

    def __init__(self, models_dir: str = "models", num_threads: int = 2):
        self.models_dir = Path(models_dir)
        self.model_path = self.models_dir / self.MODEL_DIR_NAME
        self.num_threads = num_threads
        self._recognizer: Optional[sherpa_onnx.OfflineRecognizer] = None
        self._punctuation_service: Optional[PunctuationService] = None
        self.diarization_service = DiarizationService(
            models_dir=str(models_dir),
            num_threads=num_threads
        )
        self._lock = Lock()

    def _download_and_extract_model(self):
        if (
            self.model_path.exists()
            and (self.model_path / "encoder-epoch-12-avg-8.onnx").exists()
        ):
            return

        self.models_dir.mkdir(parents=True, exist_ok=True)
        archive_path = self.models_dir / f"{self.MODEL_DIR_NAME}.tar.bz2"

        if not archive_path.exists():
            logger.info(f"Downloading Zipformer model from {self.MODEL_URL}...")
            try:
                urllib.request.urlretrieve(self.MODEL_URL, archive_path)
                logger.info("Download completed.")
            except Exception as e:
                logger.error(f"Failed to download model: {e}")
                if archive_path.exists():
                    archive_path.unlink()
                raise RuntimeError(f"Could not download Zipformer model: {e}")

        logger.info(f"Extracting model to {self.models_dir}...")
        try:
            with tarfile.open(archive_path, "r:bz2") as tar:
                # Basic protection against zipslip-like attacks
                def is_within_directory(directory, target):
                    abs_directory = os.path.abspath(directory)
                    abs_target = os.path.abspath(target)
                    prefix = os.path.commonprefix([abs_directory, abs_target])
                    return prefix == abs_directory

                def safe_extract(tar, path=".", members=None, *, numeric_owner=False):
                    for member in tar.getmembers():
                        member_path = os.path.join(path, member.name)
                        if not is_within_directory(path, member_path):
                            raise Exception("Attempted Path Traversal in Tar File")
                    tar.extractall(path, members, numeric_owner=numeric_owner)

                safe_extract(tar, path=self.models_dir)

            logger.info("Extraction completed.")
        except Exception as e:
            logger.error(f"Failed to extract model: {e}")
            raise RuntimeError(f"Could not extract Zipformer model: {e}")
        finally:
            # Clean up archive to save space
            if archive_path.exists():
                archive_path.unlink()

        if not self.model_path.exists():
            raise RuntimeError(
                f"Expected model directory {self.model_path} not found after extraction."
            )

    def _get_recognizer(self) -> sherpa_onnx.OfflineRecognizer:
        with self._lock:
            if self._recognizer is None:
                self._download_and_extract_model()
                logger.info(
                    f"Loading Zipformer model from {self.model_path} with {self.num_threads} threads."
                )

                self._recognizer = sherpa_onnx.OfflineRecognizer.from_transducer(
                    encoder=str(self.model_path / "encoder-epoch-12-avg-8.onnx"),
                    decoder=str(self.model_path / "decoder-epoch-12-avg-8.onnx"),
                    joiner=str(self.model_path / "joiner-epoch-12-avg-8.onnx"),
                    tokens=str(self.model_path / "tokens.txt"),
                    num_threads=self.num_threads,
                    model_type="zipformer",
                    debug=False,
                )

                logger.info("Initializing Punctuation service...")
                self._punctuation_service = PunctuationService()
                self._punctuation_service.initialize()

            return self._recognizer

    def _apply_punctuation(self, text: str) -> str:
        if not text:
            return text
        with self._lock:
            if self._punctuation_service:
                return self._punctuation_service.restore(text)
        return text.capitalize()

    def _read_wav(self, audio_path: Path):
        with wave.open(str(audio_path), "rb") as f:
            if f.getnchannels() != 1:
                raise ValueError(
                    f"Zipformer requires mono audio. Found {f.getnchannels()} channels in {audio_path}"
                )
            if f.getsampwidth() != 2:
                raise ValueError(
                    f"Zipformer requires 16-bit audio. Found {f.getsampwidth()} bytes per sample in {audio_path}"
                )

            sample_rate = f.getframerate()
            num_frames = f.getnframes()
            data = f.readframes(num_frames)

            # sherpa-onnx expects float32 samples in range [-1, 1]
            samples = np.frombuffer(data, dtype=np.int16).astype(np.float32) / 32768.0
            duration = num_frames / sample_rate
            return samples, sample_rate, duration

    def _transcribe_raw_file(
        self,
        audio_path: Path,
        cancel_event: Optional[Event] = None,
    ) -> List[TranscriptSegment]:
        if not audio_path.is_file():
            raise FileNotFoundError(f"Audio file not found: {audio_path}")

        if cancel_event and cancel_event.is_set():
            return []

        try:
            recognizer = self._get_recognizer()
            samples, sample_rate, duration = self._read_wav(audio_path)

            if cancel_event and cancel_event.is_set():
                return []

            stream = recognizer.create_stream()
            stream.accept_waveform(sample_rate=sample_rate, waveform=samples)
            if cancel_event and cancel_event.is_set():
                return []

            recognizer.decode_stream(stream)
            tokens = stream.result.tokens
            timestamps = stream.result.timestamps

            if not tokens:
                return []

            words = []
            current_word = ""
            current_word_start = None
            last_timestamp = 0.0

            for token, ts in zip(tokens, timestamps):
                # zipformer token starts with " " (U+2581) to indicate new word
                if token.startswith(" "):
                    if current_word:
                        words.append((current_word, current_word_start, last_timestamp))
                    current_word = token.replace(" ", "")
                    current_word_start = ts
                else:
                    if not current_word:
                        current_word_start = ts
                    current_word += token
                last_timestamp = ts

            if current_word:
                words.append((current_word, current_word_start, last_timestamp))

            segments = []
            if words:
                current_segment_words = []
                segment_start = words[0][1]
                last_end = words[0][2]

                for word, start, end in words:
                    # Break segment if duration > 7.0 seconds to keep segments readable
                    if start - segment_start > 7.0 and current_segment_words:
                        text = " ".join(current_segment_words)
                        text = self._apply_punctuation(text)
                        segments.append(
                            TranscriptSegment(
                                id=len(segments),
                                start=float(segment_start),
                                end=float(last_end),
                                text=text,
                            )
                        )
                        current_segment_words = []
                        segment_start = start

                    current_segment_words.append(word.lower())
                    last_end = end

                if current_segment_words:
                    text = " ".join(current_segment_words)
                    text = self._apply_punctuation(text)
                    segments.append(
                        TranscriptSegment(
                            id=len(segments),
                            start=float(segment_start),
                            end=float(last_end),
                            text=text,
                        )
                    )

            return segments

        except Exception as error:
            logger.error(f"Zipformer raw transcription failed: {error}", exc_info=True)
            raise RuntimeError(f"Zipformer raw transcription failed: {error}") from error

    def _chunk_and_transcribe(
        self,
        audio_path: Path,
        cancel_event: Optional[Event] = None,
        chunk_duration: float = 50.0
    ) -> List[TranscriptSegment]:
        import tempfile
        
        with wave.open(str(audio_path), "rb") as f:
            sample_rate = f.getframerate()
            n_channels = f.getnchannels()
            sampwidth = f.getsampwidth()
            total_frames = f.getnframes()
            
            frames_per_chunk = int(chunk_duration * sample_rate)
            all_segments = []
            segment_id_counter = 0
            
            for chunk_idx, start_frame in enumerate(range(0, total_frames, frames_per_chunk)):
                if cancel_event and cancel_event.is_set():
                    break
                    
                f.setpos(start_frame)
                end_frame = min(start_frame + frames_per_chunk, total_frames)
                num_frames = end_frame - start_frame
                
                if num_frames <= 0:
                    continue
                    
                chunk_data = f.readframes(num_frames)
                
                with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as temp_file:
                    temp_chunk_path = temp_file.name
                    
                try:
                    with wave.open(temp_chunk_path, "wb") as chunk_w:
                        chunk_w.setnchannels(n_channels)
                        chunk_w.setsampwidth(sampwidth)
                        chunk_w.setframerate(sample_rate)
                        chunk_w.writeframes(chunk_data)
                    
                    chunk_offset = start_frame / sample_rate
                    logger.info(f"Transcribing audio chunk {chunk_offset:.2f}s -> {end_frame / sample_rate:.2f}s...")
                    
                    chunk_segments = self._transcribe_raw_file(Path(temp_chunk_path), cancel_event)
                    
                    for seg in chunk_segments:
                        all_segments.append(
                            TranscriptSegment(
                                id=segment_id_counter,
                                start=seg.start + chunk_offset,
                                end=seg.end + chunk_offset,
                                text=seg.text
                            )
                        )
                        segment_id_counter += 1
                finally:
                    if os.path.exists(temp_chunk_path):
                        try:
                            os.remove(temp_chunk_path)
                        except Exception:
                            pass
                            
            return all_segments

    def _read_wav_segment(self, audio_path: Path, start: float, end: float) -> Optional[np.ndarray]:
        try:
            with wave.open(str(audio_path), "rb") as f:
                sample_rate = f.getframerate()
                start_frame = int(start * sample_rate)
                end_frame = min(int(end * sample_rate), f.getnframes())
                num_frames = end_frame - start_frame
                
                if num_frames <= 0:
                    return None
                    
                f.setpos(start_frame)
                data = f.readframes(num_frames)
                return np.frombuffer(data, dtype=np.int16).astype(np.float32) / 32768.0
        except Exception as e:
            logger.warning("Failed to read wav segment for diarization: %s", e)
            return None

    def transcribe(
        self,
        audio_path: Path,
        cancel_event: Optional[Event] = None,
    ) -> List[TranscriptSegment]:
        if not audio_path.is_file():
            raise FileNotFoundError(f"Audio file not found: {audio_path}")

        if cancel_event and cancel_event.is_set():
            return []

        # 1. Nhận diện giọng nói (ASR)
        # Nếu audio dài hơn 50 giây, chạy nhận diện theo chunk để tránh OOM
        try:
            with wave.open(str(audio_path), "rb") as f:
                duration = f.getnframes() / f.getframerate()
            
            if duration > 50.0:
                logger.info(f"Audio duration is {duration:.2f}s (> 50s). Running chunk-based transcription...")
                segments = self._chunk_and_transcribe(audio_path, cancel_event, chunk_duration=50.0)
            else:
                segments = self._transcribe_raw_file(audio_path, cancel_event)
        except Exception as error:
            logger.error(f"ASR transcription failed: {error}", exc_info=True)
            raise RuntimeError(f"ASR transcription failed: {error}") from error

        # 2. Phân biệt người nói (Speaker Diarization)
        if segments and not (cancel_event and cancel_event.is_set()):
            try:
                logger.info("Starting Speaker Diarization post-transcription...")
                embeddings = []
                valid_segments = []
                
                for seg in segments:
                    if cancel_event and cancel_event.is_set():
                        break
                    # Bỏ qua các phân đoạn quá ngắn để đặc trưng trích xuất chính xác hơn
                    if seg.end - seg.start < 0.5:
                        continue
                    samples = self._read_wav_segment(audio_path, seg.start, seg.end)
                    if samples is not None and len(samples) > 0:
                        emb = self.diarization_service.extract_embedding(samples)
                        embeddings.append(emb)
                        valid_segments.append(seg)
                        
                if len(embeddings) > 0 and not (cancel_event and cancel_event.is_set()):
                    embeddings_arr = np.array(embeddings)
                    labels = self.diarization_service.diarize(embeddings_arr, min_speakers=2, max_speakers=4, merge_threshold=0.80)
                    
                    # Gán ngược lại nhãn người nói cho các segment
                    for idx, seg in enumerate(valid_segments):
                        seg.speaker = f"Người nói {labels[idx]}"
                    logger.info("Speaker Diarization completed successfully.")
            except Exception as spk_error:
                logger.error("Speaker Diarization warning (ignoring to protect ASR output): %s", spk_error, exc_info=True)

        return segments
