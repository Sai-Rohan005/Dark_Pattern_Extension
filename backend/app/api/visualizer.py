
"""
dark_pattern_visualizer.py

CLIENT-SIDE / FASTAPI-SIDE visualization module.

This module DOES NOT perform model inference.

Architecture:

    FastAPI
        |
        v
    Hugging Face model API
        |
        v
    Analysis JSON
        |
        +---- prediction == 0
        |        |
        |        +---- no visualization
        |
        +---- prediction == 1
                 |
                 v
          localization
                 |
                 v
        responsible_components
                 |
                 v
             draw boxes

Only components identified by the model's attribution-based
localization are visualized.

The model does NOT directly predict bounding boxes for dark patterns.
The localization uses YOLO UI component bounding boxes together with
leave-one-component-out attribution scores.

Expected response structure:

{
    "prediction": 1,
    "dark_pattern_detected": true,
    "label": "dark_pattern",
    "confidence": 0.72,

    "detected_widgets": [...],

    "localization": {
        "detected": true,
        "method": "leave_one_component_out_attribution",
        "trained_localizer": false,

        "components": [
            {
                "rank": 1,
                "node_index": 0,
                "detection_index": 2,
                "class_id": 0,
                "class_name": "Other",
                "confidence": 0.91,
                "bbox": [0, 0, 772, 822],
                "base_probability": 0.727,
                "ablated_probability": 0.677,
                "attribution_logit": 0.238,
                "probability_diff": 0.049,
                "contribution_percent": 55.2
            }
        ],

        "responsible_components": [...]
    }
}

Only components with positive attribution are considered responsible.
"""


from __future__ import annotations

import argparse
import os
from dataclasses import dataclass
from typing import Any, Optional

from PIL import Image, ImageDraw, ImageFont


# --------------------------------------------------------------------------- #
# Data model
# --------------------------------------------------------------------------- #


@dataclass
class Component:
    """
    A localized UI component responsible for part of the
    dark-pattern prediction.
    """

    rank: Optional[int]
    node_index: Optional[int]
    detection_index: Optional[int]

    class_id: Optional[int]
    class_name: str
    confidence: float

    bbox: list[float]

    base_probability: float
    ablated_probability: float

    attribution_logit: float
    probability_diff: float

    contribution_percent: float = 0.0

    structured_element: Optional[dict] = None

    @classmethod
    def from_json(cls, data: dict) -> "Component":

        bbox = data.get("bbox", [])

        if not isinstance(bbox, list) or len(bbox) != 4:
            bbox = [0.0, 0.0, 0.0, 0.0]

        structured_element = data.get(
            "structured_element",
            {}
        )

        if not isinstance(structured_element, dict):
            structured_element = {}

        return cls(
            rank=data.get("rank"),
            node_index=data.get("node_index"),
            detection_index=data.get("detection_index"),

            class_id=data.get("class_id"),

            class_name=data.get(
                "class_name",
                "Unknown"
            ),

            confidence=float(
                data.get(
                    "confidence",
                    0.0
                )
            ),

            bbox=[
                float(x)
                for x in bbox
            ],

            base_probability=float(
                data.get(
                    "base_probability",
                    0.0
                )
            ),

            ablated_probability=float(
                data.get(
                    "ablated_probability",
                    0.0
                )
            ),

            attribution_logit=float(
                data.get(
                    "attribution_logit",
                    0.0
                )
            ),

            probability_diff=float(
                data.get(
                    "probability_diff",
                    0.0
                )
            ),

            contribution_percent=float(
                data.get(
                    "contribution_percent",
                    0.0
                )
            ),

            structured_element=structured_element
        )


# --------------------------------------------------------------------------- #
# Geometry
# --------------------------------------------------------------------------- #


def compute_iou(
    box_a: list[float],
    box_b: list[float]
) -> float:
    """
    Compute IoU between:

        [x1, y1, x2, y2]

    boxes.
    """

    if len(box_a) != 4 or len(box_b) != 4:
        return 0.0

    ax1, ay1, ax2, ay2 = box_a
    bx1, by1, bx2, by2 = box_b

    inter_x1 = max(ax1, bx1)
    inter_y1 = max(ay1, by1)

    inter_x2 = min(ax2, bx2)
    inter_y2 = min(ay2, by2)

    inter_w = max(
        0.0,
        inter_x2 - inter_x1
    )

    inter_h = max(
        0.0,
        inter_y2 - inter_y1
    )

    inter_area = (
        inter_w * inter_h
    )

    area_a = (
        max(0.0, ax2 - ax1)
        *
        max(0.0, ay2 - ay1)
    )

    area_b = (
        max(0.0, bx2 - bx1)
        *
        max(0.0, by2 - by1)
    )

    union = (
        area_a
        +
        area_b
        -
        inter_area
    )

    if union <= 0:
        return 0.0

    return inter_area / union


# --------------------------------------------------------------------------- #
# Localization extraction
# --------------------------------------------------------------------------- #


def parse_responsible_components(
    response: dict,
) -> list[Component]:
    """
    Extract only components that contributed positively
    to the dark-pattern prediction.

    Priority:

        localization.responsible_components

    If that field is unavailable, fall back to:

        localization.components

    and keep only:

        attribution_logit > 0
    """

    localization = response.get(
        "localization",
        {}
    )

    if not isinstance(localization, dict):
        return []

    responsible = localization.get(
        "responsible_components"
    )

    if isinstance(responsible, list):

        raw_components = responsible

    else:

        raw_components = localization.get(
            "components",
            []
        )

    if not isinstance(raw_components, list):
        return []

    components: list[Component] = []

    for item in raw_components:

        if not isinstance(item, dict):
            continue

        try:
            component = Component.from_json(item)

        except Exception:
            continue

        # Only positive attribution is considered
        # responsible for the dark-pattern prediction.
        if component.attribution_logit <= 0:
            continue

        components.append(component)

    # Highest attribution first.
    components.sort(
        key=lambda c: c.attribution_logit,
        reverse=True
    )

    return components


# --------------------------------------------------------------------------- #
# Duplicate suppression
# --------------------------------------------------------------------------- #


def suppress_duplicate_components(
    components: list[Component],
    iou_threshold: float = 0.85,
) -> list[Component]:
    """
    Remove nearly identical component boxes.

    Higher-attribution components are processed first.

    This is intentionally more conservative than the previous
    IoU=0.1 behavior because UI components can legitimately overlap.

    Example:

        Component A: attribution = 0.24
        Component B: attribution = 0.22
        IoU(A, B) = 0.98

    Keep A and remove B.
    """

    kept: list[Component] = []

    for candidate in components:

        duplicate = False

        for existing in kept:

            if compute_iou(
                candidate.bbox,
                existing.bbox
            ) >= iou_threshold:

                duplicate = True
                break

        if not duplicate:
            kept.append(candidate)

    return kept


# --------------------------------------------------------------------------- #
# Coordinate handling
# --------------------------------------------------------------------------- #


def rescale_to_original(
    component: Component,
    original_width: int,
    original_height: int,
    response: dict,
) -> list[float]:
    """
    Convert component coordinates into original screenshot
    coordinates.

    Localization bboxes normally already correspond to the
    original YOLO image coordinates.

    This function therefore first checks for explicit image
    dimensions in the localization component.

    If dimensions are unavailable, the bbox is assumed to already
    be in original image coordinates.
    """

    x1, y1, x2, y2 = component.bbox

    structured_element = (
        component.structured_element
        or {}
    )

    component_width = (
        structured_element.get(
            "image_width"
        )
    )

    component_height = (
        structured_element.get(
            "image_height"
        )
    )

    if (
        component_width
        and component_height
    ):

        component_width = float(
            component_width
        )

        component_height = float(
            component_height
        )

        if (
            component_width != original_width
            or component_height != original_height
        ):

            scale_x = (
                original_width
                /
                component_width
            )

            scale_y = (
                original_height
                /
                component_height
            )

            return [
                x1 * scale_x,
                y1 * scale_y,
                x2 * scale_x,
                y2 * scale_y,
            ]

    return [
        x1,
        y1,
        x2,
        y2,
    ]


# --------------------------------------------------------------------------- #
# Font
# --------------------------------------------------------------------------- #


def _load_font(
    size: int = 16
) -> ImageFont.ImageFont:

    candidates = [

        "/usr/share/fonts/truetype/dejavu/"
        "DejaVuSans-Bold.ttf",

        "/usr/share/fonts/truetype/dejavu/"
        "DejaVuSans.ttf",

        "/Library/Fonts/Arial Bold.ttf",

        "/System/Library/Fonts/"
        "Helvetica.ttc",
    ]

    for path in candidates:

        if os.path.exists(path):

            try:
                return ImageFont.truetype(
                    path,
                    size
                )

            except Exception:
                pass

    return ImageFont.load_default()


# --------------------------------------------------------------------------- #
# Drawing
# --------------------------------------------------------------------------- #


_PALETTE = [
    (255, 59, 48),
    (0, 122, 255),
    (52, 199, 89),
    (255, 149, 0),
    (175, 82, 222),
    (255, 45, 85),
    (90, 200, 250),
    (255, 214, 10),
]


def draw_annotated_image(
    image_path: str,
    components: list[Component],
    output_path: str,
    response: dict,
) -> str:
    """
    Draw responsible dark-pattern components onto the
    ORIGINAL screenshot.

    The boxes are based on localization attribution,
    not simply YOLO detection confidence.
    """

    image = (
        Image.open(image_path)
        .convert("RGB")
    )

    original_width, original_height = (
        image.size
    )

    draw = ImageDraw.Draw(image)

    font = _load_font(16)

    for index, component in enumerate(
        components
    ):

        color = _PALETTE[
            index % len(_PALETTE)
        ]

        bbox = rescale_to_original(
            component,
            original_width,
            original_height,
            response,
        )

        x1, y1, x2, y2 = [
            int(round(value))
            for value in bbox
        ]

        # Clamp coordinates to image.
        x1 = max(
            0,
            min(x1, original_width - 1)
        )

        y1 = max(
            0,
            min(y1, original_height - 1)
        )

        x2 = max(
            0,
            min(x2, original_width - 1)
        )

        y2 = max(
            0,
            min(y2, original_height - 1)
        )

        # -----------------------------------------------------
        # Bounding box
        # -----------------------------------------------------

        draw.rectangle(
            [x1, y1, x2, y2],
            outline=color,
            width=4,
        )

        # -----------------------------------------------------
        # Label
        # -----------------------------------------------------

        contribution = (
            component.contribution_percent
        )

        label = (
            f"{index + 1}. "
            f"{component.class_name} "
            f"| {contribution:.1f}%"
        )

        text_bbox = draw.textbbox(
            (0, 0),
            label,
            font=font,
        )

        text_width = (
            text_bbox[2]
            -
            text_bbox[0]
        )

        text_height = (
            text_bbox[3]
            -
            text_bbox[1]
        )

        label_height = (
            text_height + 8
        )

        label_width = (
            text_width + 12
        )

        # Put label above box when possible.
        label_y = (
            y1
            -
            label_height
            -
            2
        )

        if label_y < 0:
            label_y = y1

        label_x = x1

        # Prevent label from going outside image.
        if (
            label_x + label_width
            > original_width
        ):

            label_x = max(
                0,
                original_width
                -
                label_width
            )

        draw.rounded_rectangle(
            [
                label_x,
                label_y,
                label_x + label_width,
                label_y + label_height,
            ],
            radius=4,
            fill=color,
        )

        draw.text(
            (
                label_x + 6,
                label_y + 4
            ),
            label,
            fill=(255, 255, 255),
            font=font,
        )

    # Make sure output directory exists.
    output_directory = os.path.dirname(
        os.path.abspath(output_path)
    )

    os.makedirs(
        output_directory,
        exist_ok=True
    )

    image.save(
        output_path
    )

    return output_path


# --------------------------------------------------------------------------- #
# Top-level visualization
# --------------------------------------------------------------------------- #


def visualize_response(
    image_path: str,
    response: dict,
    output_path: Optional[str] = None,
    iou_threshold: float = 0.6,
) -> dict:
    """
    Visualize only attribution-positive components.

    Behavior:

        prediction == 0
            -> no boxes

        prediction == 1
            -> use localization
            -> select positive attribution components
            -> suppress duplicate boxes
            -> draw responsible components
    """

    prediction = response.get("prediction")

    dark_pattern_detected = (
        prediction == 1
    )

    summary: dict[str, Any] = {

        "prediction": prediction,

        "dark_pattern_detected":
            dark_pattern_detected,

        "label":
            response.get("label"),

        "confidence":
            float(
                response.get(
                    "confidence",
                    0.0
                )
            ),

        "annotated_image_path":
            None,

        "components": [],

        "num_responsible_components":
            0,
    }

    # ---------------------------------------------------------
    # No dark pattern
    # ---------------------------------------------------------

    if not dark_pattern_detected:

        summary["message"] = (
            "No dark pattern detected. "
            "No visualization generated."
        )

        return summary

    # ---------------------------------------------------------
    # Extract attribution-positive components
    # ---------------------------------------------------------

    components = parse_responsible_components(
        response
    )

    # ---------------------------------------------------------
    # De-duplicate overlapping boxes
    # ---------------------------------------------------------

    components = suppress_duplicate_components(
        components,
        iou_threshold=iou_threshold,
    )

    summary[
        "num_responsible_components"
    ] = len(components)

    # ---------------------------------------------------------
    # No localization components
    # ---------------------------------------------------------

    if not components:

        summary["message"] = (
            "Dark pattern detected, "
            "but no positive attribution "
            "components were available."
        )

        return summary

    # ---------------------------------------------------------
    # Output path
    # ---------------------------------------------------------

    if output_path is None:

        root, extension = (
            os.path.splitext(image_path)
        )

        extension = (
            extension
            if extension
            else ".png"
        )

        output_path = (
            f"{root}_annotated"
            f"{extension}"
        )

    # ---------------------------------------------------------
    # Draw
    # ---------------------------------------------------------

    draw_annotated_image(
        image_path=image_path,
        components=components,
        output_path=output_path,
        response=response,
    )

    summary[
        "annotated_image_path"
    ] = output_path

    # ---------------------------------------------------------
    # Component information
    # ---------------------------------------------------------

    summary["components"] = [

        {
            "rank": index + 1,

            "node_index":
                component.node_index,

            "detection_index":
                component.detection_index,

            "class_id":
                component.class_id,

            "class_name":
                component.class_name,

            "confidence":
                round(
                    component.confidence,
                    4
                ),

            "bbox":
                component.bbox,

            "attribution_logit":
                round(
                    component.attribution_logit,
                    6
                ),

            "probability_diff":
                round(
                    component.probability_diff,
                    6
                ),

            "contribution_percent":
                round(
                    component.contribution_percent,
                    2
                ),
        }

        for index, component
        in enumerate(components)
    ]

    return summary


# --------------------------------------------------------------------------- #
# Human-readable report
# --------------------------------------------------------------------------- #


def print_report(
    summary: dict
) -> None:

    if not summary.get(
        "dark_pattern_detected",
        False
    ):

        print(
            "No Dark Pattern Detected"
        )

        print(
            "Confidence: "
            f"{summary.get('confidence', 0.0) * 100:.2f}%"
        )

        return

    print(
        "Dark Pattern Detected"
    )

    print(
        "Confidence: "
        f"{summary.get('confidence', 0.0) * 100:.2f}%"
    )

    print(
        "Responsible Components: "
        f"{summary.get('num_responsible_components', 0)}"
    )

    print()

    for component in summary.get(
        "components",
        []
    ):

        print(
            f"{component['rank']}. "
            f"{component['class_name']} "
            f"| detection={component['detection_index']} "
            f"| attribution="
            f"{component['attribution_logit']:.4f} "
            f"| contribution="
            f"{component['contribution_percent']:.1f}%"
        )

    annotated_path = summary.get(
        "annotated_image_path"
    )

    if annotated_path:

        print(
            "\nAnnotated image saved to: "
            f"{annotated_path}"
        )

    else:

        print(
            "\nNo annotated image generated."
        )


# --------------------------------------------------------------------------- #
# CLI
# --------------------------------------------------------------------------- #


class VisualizerCLI:

    def __init__(self):

        self.parser = (
            argparse.ArgumentParser(
                description=(
                    "Visualize attribution-based "
                    "dark-pattern localization."
                )
            )
        )

        self.parser.add_argument(
            "image_path",
            type=str,
            help=(
                "Path to the original "
                "screenshot image."
            ),
        )

        self.parser.add_argument(
            "response_json",
            type=str,
            help=(
                "Path to JSON containing "
                "the analysis response."
            ),
        )

        self.parser.add_argument(
            "--output",
            type=str,
            default=None,
            help=(
                "Path for the annotated "
                "image."
            ),
        )

        self.parser.add_argument(
            "--iou_threshold",
            type=float,
            default=0.85,
            help=(
                "IoU threshold for suppressing "
                "near-identical localization boxes."
            ),
        )

    def visualise(
        self,
        result: Optional[dict] = None,
        image_path: Optional[str] = None,
        output_dir: Optional[str] = None,
        response: Optional[dict] = None,
        output_path: Optional[str] = None,
        iou_threshold: float = 0.85,
    ) -> Optional[str]:
        """
        Programmatic API used by FastAPI.

        Supported call:

            visualizer.visualise(
                result=result,
                image_path=temp_path,
                output_dir="/tmp"
            )

        Returns:

            annotated image path

        or:

            None

        if no visualization is generated.
        """

        # Support both names.
        if result is None:
            result = response

        if result is None:
            raise ValueError(
                "Analysis result is required."
            )

        if not image_path:
            raise ValueError(
                "image_path is required."
            )

        # -----------------------------------------------------
        # Determine output path
        # -----------------------------------------------------

        if output_path is None:

            if output_dir is None:

                root, extension = (
                    os.path.splitext(
                        image_path
                    )
                )

                extension = (
                    extension
                    if extension
                    else ".png"
                )

                output_path = (
                    f"{root}_annotated"
                    f"{extension}"
                )

            else:

                os.makedirs(
                    output_dir,
                    exist_ok=True
                )

                filename = os.path.basename(
                    image_path
                )

                root, extension = (
                    os.path.splitext(
                        filename
                    )
                )

                extension = (
                    extension
                    if extension
                    else ".png"
                )

                output_path = os.path.join(
                    output_dir,
                    f"{root}_annotated"
                    f"{extension}"
                )

        # -----------------------------------------------------
        # Visualize
        # -----------------------------------------------------

        summary = visualize_response(
            image_path=image_path,
            response=result,
            output_path=output_path,
            iou_threshold=iou_threshold,
        )

        print_report(
            summary
        )

        return summary.get(
            "annotated_image_path"
        )

    def run(self) -> None:

        args = self.parser.parse_args()

        # Load JSON.
        import json

        with open(
            args.response_json,
            "r",
            encoding="utf-8",
        ) as file:

            response = json.load(file)

        output_path = args.output

        summary = visualize_response(
            image_path=args.image_path,
            response=response,
            output_path=output_path,
            iou_threshold=args.iou_threshold,
        )

        print_report(
            summary
        )


# --------------------------------------------------------------------------- #
# Main
# --------------------------------------------------------------------------- #


if __name__ == "__main__":

    VisualizerCLI().run()


# ### One important change to your FastAPI route

# Your route is already calling:

# visualization_path = visualizer.visualise(
#     result=result,
#     image_path=temp_path,
#     output_dir=tempfile.gettempdir()
# )

# That will work with the updated class.

# However, **don't stop at returning this:**


# {
#     "visualization": {
#         "generated": true,
#         "path": "/tmp/selected-area_annotated.png"
#     }
# }


# A browser cannot normally access `/tmp/selected-area_annotated.png` on your Mac/server.

# So your next step should be to expose the generated image through FastAPI, e.g.:


# GET /api/v1/visualizations/{filename}


# Then your response can become:

# {
#     "prediction": 1,
#     "dark_pattern_detected": true,
#     "confidence": 0.7273,
#     "localization": {
#         "responsible_components": [
#             {
#                 "class_name": "Other",
#                 "detection_index": 2,
#                 "bbox": [0, 0, 772, 822],
#                 "attribution_logit": 0.2382,
#                 "contribution_percent": 55.2
#             }
#         ]
#     },
#     "visualization": {
#         "generated": true,
#         "url": "/api/v1/visualizations/selected-area_annotated.png"
#     }
# }

