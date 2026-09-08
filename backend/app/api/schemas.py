
from pydantic import BaseModel
from typing import List, Optional, Any


class Detection(BaseModel):

    type: str

    confidence: float

    bbox: List[float]


class DetectedWidget(BaseModel):

    class_id: Optional[int] = None

    class_name: str

    confidence: float

    bbox: List[float]

    image_width: Optional[int] = None

    image_height: Optional[int] = None


class AnalysisResponse(BaseModel):

    success: bool

    dark_pattern_detected: bool

    label: str

    confidence: float

    detections: List[Detection] = []

    detected_widgets: List[DetectedWidget] = []

    num_detected_widgets: int = 0

    num_graph_nodes: Optional[int] = None

    num_graph_edges: Optional[int] = None

    feature_dimensions: Optional[Any] = None

    fusion_weights: Optional[Any] = None

    structured_text: Optional[str] = None
