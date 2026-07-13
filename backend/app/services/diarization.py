import os
import sys
import logging
import urllib.request
import numpy as np

# Đảm bảo DLL search path được đặt chính xác cho onnxruntime trên Windows
if sys.platform == "win32":
    try:
        import onnxruntime
        ort_capi = os.path.join(os.path.dirname(onnxruntime.__file__), "capi")
        if os.path.isdir(ort_capi) and hasattr(os, "add_dll_directory"):
            os.add_dll_directory(ort_capi)
    except Exception:
        pass

try:
    import sherpa_onnx
except ImportError:
    sherpa_onnx = None

logger = logging.getLogger(__name__)


class DiarizationService:
    MODEL_URL = "https://huggingface.co/csukuangfj/speaker-embedding-models/resolve/main/3dspeaker_speech_campplus_sv_zh_en_16k-common_advanced.onnx"
    MODEL_DIR_NAME = "3dspeaker_campplus.onnx"

    def __init__(self, models_dir: str = "models", num_threads: int = 2):
        self.models_dir = os.path.abspath(models_dir)
        self.model_path = os.path.join(self.models_dir, self.MODEL_DIR_NAME)
        self.num_threads = num_threads
        self._extractor = None

    def _get_extractor(self):
        if sherpa_onnx is None:
            raise RuntimeError("Thư viện 'sherpa-onnx' chưa được cài đặt.")
            
        if self._extractor is None:
            self._download_model()
            logger.info("Loading CAM++ Speaker Embedding model from %s", self.model_path)
            
            config = sherpa_onnx.SpeakerEmbeddingExtractorConfig(
                model=self.model_path,
                num_threads=self.num_threads,
                debug=False,
                provider="cpu"
            )
            self._extractor = sherpa_onnx.SpeakerEmbeddingExtractor(config)
        return self._extractor

    def _download_model(self):
        os.makedirs(self.models_dir, exist_ok=True)
        if not os.path.exists(self.model_path):
            logger.info("Downloading CAM++ ONNX model from %s", self.MODEL_URL)
            try:
                urllib.request.urlretrieve(self.MODEL_URL, self.model_path)
                logger.info("CAM++ ONNX model downloaded successfully.")
            except Exception as error:
                logger.error("Failed to download CAM++ model: %s", error)
                raise RuntimeError(f"Failed to download CAM++ model: {error}") from error

    def extract_embedding(self, samples: np.ndarray, sample_rate: int = 16000) -> np.ndarray:
        """Trích xuất speaker embedding từ một mảng samples audio float32 (Mono, 16kHz)."""
        extractor = self._get_extractor()
        
        stream = extractor.create_stream()
        stream.accept_waveform(sample_rate=sample_rate, waveform=samples)
        stream.input_finished()
        
        if extractor.is_ready(stream):
            embedding = extractor.compute(stream)
            # L2 normalize
            embedding = np.array(embedding)
            norm = np.linalg.norm(embedding)
            if norm > 0:
                embedding = embedding / norm
            return embedding
        else:
            raise RuntimeError("Extractor was not ready to compute embedding.")

    def kmeans_plusplus_init(self, X: np.ndarray, k: int) -> np.ndarray:
        n_samples, n_features = X.shape
        centroids = np.empty((k, n_features))
        
        idx = np.random.choice(n_samples)
        centroids[0] = X[idx]
        
        for i in range(1, k):
            distances = np.linalg.norm(X[:, np.newaxis] - centroids[:i], axis=2)
            min_dists = np.min(distances, axis=1)
            probs = min_dists ** 2
            probs_sum = probs.sum()
            if probs_sum == 0:
                idx = np.random.choice(n_samples)
            else:
                probs /= probs_sum
                idx = np.random.choice(n_samples, p=probs)
            centroids[i] = X[idx]
            
        return centroids

    def kmeans(self, X: np.ndarray, k: int, max_iters: int = 100, tol: float = 1e-4, n_init: int = 20):
        n_samples, n_features = X.shape
        best_inertia = np.inf
        best_labels = None
        best_centroids = None
        
        for init_run in range(n_init):
            centroids = self.kmeans_plusplus_init(X, k)
            
            for iteration in range(max_iters):
                distances = np.linalg.norm(X[:, np.newaxis] - centroids, axis=2)
                labels = np.argmin(distances, axis=1)
                
                new_centroids = []
                for i in range(k):
                    members = X[labels == i]
                    if len(members) > 0:
                        new_centroids.append(members.mean(axis=0))
                    else:
                        new_centroids.append(centroids[i])
                new_centroids = np.array(new_centroids)
                
                if np.all(np.abs(new_centroids - centroids) < tol):
                    centroids = new_centroids
                    break
                centroids = new_centroids
                
            distances = np.linalg.norm(X[:, np.newaxis] - centroids, axis=2)
            labels = np.argmin(distances, axis=1)
            inertia = np.sum(np.min(distances, axis=1) ** 2)
            
            if inertia < best_inertia:
                best_inertia = inertia
                best_labels = labels
                best_centroids = centroids
                
        return best_labels, best_centroids

    def calculate_silhouette(self, X: np.ndarray, labels: np.ndarray) -> float:
        n_samples = X.shape[0]
        unique_labels = np.unique(labels)
        k = len(unique_labels)
        if k <= 1 or k >= n_samples:
            return -1.0
            
        a = np.zeros(n_samples)
        b = np.full(n_samples, np.inf)
        
        for label in unique_labels:
            in_mask = (labels == label)
            in_pts = X[in_mask]
            if len(in_pts) <= 1:
                continue
            diffs = in_pts[:, np.newaxis, :] - in_pts[np.newaxis, :, :]
            dists = np.linalg.norm(diffs, axis=2)
            a[in_mask] = dists.sum(axis=1) / (len(in_pts) - 1)
            
            for other_label in unique_labels:
                if other_label == label:
                    continue
                oth_pts = X[labels == other_label]
                if len(oth_pts) == 0:
                    continue
                diffs_oth = in_pts[:, np.newaxis, :] - oth_pts[np.newaxis, :, :]
                dists_oth = np.linalg.norm(diffs_oth, axis=2)
                b[in_mask] = np.minimum(b[in_mask], dists_oth.mean(axis=1))
                
        denom = np.maximum(a, b)
        with np.errstate(divide='ignore', invalid='ignore'):
            s = (b - a) / denom
            s[denom == 0] = 0.0
            s[np.isnan(s)] = 0.0
        return float(np.mean(s))

    def merge_similar_clusters(self, X: np.ndarray, labels: np.ndarray, centroids: np.ndarray, threshold: float = 0.80):
        """Gộp các cụm có độ tương đồng Cosine của centroid lớn hơn ngưỡng (mặc định 0.80)."""
        k = len(centroids)
        if k <= 1:
            return labels, centroids
            
        # Chuẩn hóa L2 cho centroids
        norms = np.linalg.norm(centroids, axis=1, keepdims=True)
        norms[norms == 0] = 1e-12
        norm_centroids = centroids / norms
        
        # Tính toán ma trận độ tương đồng
        sim_matrix = np.dot(norm_centroids, norm_centroids.T)
        
        # Bản đồ gộp cụm (Union-Find)
        merge_map = {i: i for i in range(k)}
        for i in range(k):
            for j in range(i + 1, k):
                if sim_matrix[i, j] > threshold:
                    # Gộp cụm j vào cụm i
                    rep_i = merge_map[i]
                    while rep_i != merge_map[rep_i]:
                        rep_i = merge_map[rep_i]
                    merge_map[j] = rep_i
                    
        # Áp dụng bản đồ gộp cho nhãn
        new_labels = np.array([merge_map[lbl] for lbl in labels])
        
        # Đánh chỉ mục lại nhãn liên tục (0, 1, 2...)
        unique_new_labels = np.unique(new_labels)
        label_mapping = {old: new for new, old in enumerate(unique_new_labels)}
        final_labels = np.array([label_mapping[lbl] for lbl in new_labels])
        
        # Tính toán lại các centroid mới
        final_centroids = []
        for label_idx in range(len(unique_new_labels)):
            members = X[final_labels == label_idx]
            final_centroids.append(members.mean(axis=0))
        final_centroids = np.array(final_centroids)
        
        return final_labels, final_centroids

    def diarize(self, X: np.ndarray, min_speakers: int = 2, max_speakers: int = 4, merge_threshold: float = 0.80) -> np.ndarray:
        """Gom cụm các embedding và trả về danh sách nhãn người nói tương ứng.
        Tự động chọn K tối ưu, sau đó gộp các cụm quá giống nhau.
        """
        n_samples = len(X)
        if n_samples == 0:
            return np.array([], dtype=int)
        if n_samples == 1:
            return np.zeros(1, dtype=int)
            
        best_score = -2.0
        best_labels = None
        best_centroids = None
        
        # Quét chọn K tối ưu dựa trên Silhouette Score
        for k in range(min_speakers, min(max_speakers + 1, n_samples)):
            labels, centroids = self.kmeans(X, k)
            score = self.calculate_silhouette(X, labels)
            if score > best_score:
                best_score = score
                best_labels = labels
                best_centroids = centroids
                
        if best_labels is None:
            # Fallback nếu không gom cụm được
            best_labels, best_centroids = self.kmeans(X, min_speakers)
            
        # Áp dụng cơ chế gộp cụm tương đồng
        final_labels, _ = self.merge_similar_clusters(
            X, best_labels, best_centroids, threshold=merge_threshold
        )
        return final_labels
