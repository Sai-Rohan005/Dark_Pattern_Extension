
from gradio_client import Client, handle_file
import time


HF_SPACE = (
    "https://sai-rohan-dark-pattern-detection-api.hf.space/"
)


class AnalysisService:

    def __init__(self):

        print(
            "[AnalysisService] "
            "Initializing Hugging Face client..."
        )

        # Lazy initialization.
        # This prevents the application from failing during
        # startup if Hugging Face has a temporary connection issue.
        self.client = None

        self.max_retries = 3
        self.retry_delay = 5

    # ================================================================
    # Hugging Face client
    # ================================================================

    def _get_client(self):

        if self.client is None:

            print(
                "[AnalysisService] "
                "Connecting to Hugging Face API..."
            )

            self.client = Client(
                HF_SPACE
            )

            print(
                "[AnalysisService] "
                "Connected successfully."
            )

        return self.client

    # ================================================================
    # Reset client
    # ================================================================

    def _reset_client(self):

        print(
            "[AnalysisService] "
            "Resetting Hugging Face client..."
        )

        self.client = None

    # ================================================================
    # Analyze image
    # ================================================================

    def analyze_image(
        self,
        image_path: str
    ):

        print(
            "[AnalysisService] "
            f"Sending image to HF API: {image_path}"
        )

        last_error = None

        for attempt in range(
            1,
            self.max_retries + 1
        ):

            try:

                client = self._get_client()

                print(
                    "[AnalysisService] "
                    f"Prediction attempt "
                    f"{attempt}/{self.max_retries}"
                )

                result = client.predict(
                    image=handle_file(
                        image_path
                    ),
                    api_name="/predict"
                )

                print(
                    "[AnalysisService] "
                    "Raw model result:"
                )

                print(result)

                return self.parse_result(
                    result
                )

            except Exception as e:

                last_error = e

                print(
                    "[AnalysisService] "
                    f"Prediction attempt {attempt} "
                    f"failed: {e}"
                )

                # Reset client so the next attempt
                # creates a fresh connection.
                self._reset_client()

                if attempt < self.max_retries:

                    print(
                        "[AnalysisService] "
                        f"Retrying in "
                        f"{self.retry_delay} seconds..."
                    )

                    time.sleep(
                        self.retry_delay
                    )

        raise RuntimeError(
            "Detection API failed after "
            f"{self.max_retries} attempts: "
            f"{last_error}"
        )

    # ================================================================
    # Parse HF response
    # ================================================================

    def parse_result(
        self,
        result
    ):

        print(
            "[AnalysisService] "
            "Parsing result..."
        )

        # ------------------------------------------------------------
        # Validate
        # ------------------------------------------------------------

        if not isinstance(
            result,
            dict
        ):

            raise ValueError(
                "Unexpected model response type: "
                f"{type(result)}"
            )

        # ------------------------------------------------------------
        # Overall prediction
        # ------------------------------------------------------------

        prediction = result.get(
            "prediction",
            0
        )

        # Handle normal integer/float prediction.
        if isinstance(
            prediction,
            (int, float)
        ):

            prediction = int(
                prediction
            )

        # Handle nested prediction just in case.
        elif isinstance(
            prediction,
            dict
        ):

            nested_prediction = (
                prediction.get(
                    "prediction",
                    prediction.get(
                        "value",
                        0
                    )
                )
            )

            try:

                prediction = int(
                    nested_prediction
                )

            except (
                TypeError,
                ValueError
            ):

                prediction = 0

        # Handle string prediction.
        else:

            try:

                prediction = int(
                    prediction
                )

            except (
                TypeError,
                ValueError
            ):

                prediction = 0

        # ------------------------------------------------------------
        # Label
        # ------------------------------------------------------------

        label = result.get(
            "label",
            "no_dark_pattern"
        )

        # ------------------------------------------------------------
        # Confidence
        # ------------------------------------------------------------

        confidence = float(
            result.get(
                "confidence",
                result.get(
                    "probability",
                    0.0
                )
            )
        )

        # ------------------------------------------------------------
        # Dark pattern flag
        # ------------------------------------------------------------

        dark_pattern_detected = (
            prediction == 1
        )

        # ============================================================
        # Detected UI widgets
        # ============================================================

        detected_widgets = result.get(
            "detected_widgets",
            []
        )

        if not isinstance(
            detected_widgets,
            list
        ):

            detected_widgets = []

        # ============================================================
        # Normalize widgets
        # ============================================================

        widgets = []

        for widget in detected_widgets:

            if not isinstance(
                widget,
                dict
            ):
                continue

            bbox = widget.get(
                "bbox",
                []
            )

            if (
                not isinstance(
                    bbox,
                    list
                )
                or len(bbox) != 4
            ):
                continue

            try:

                normalized_bbox = [
                    float(x)
                    for x in bbox
                ]

                widget_confidence = float(
                    widget.get(
                        "confidence",
                        0.0
                    )
                )

            except (
                TypeError,
                ValueError
            ):

                continue

            widgets.append({

                "class_id":
                    widget.get(
                        "class_id"
                    ),

                "class_name":
                    widget.get(
                        "class_name",
                        "Unknown"
                    ),

                "confidence":
                    widget_confidence,

                "bbox":
                    normalized_bbox,

                "image_width":
                    widget.get(
                        "image_width"
                    ),

                "image_height":
                    widget.get(
                        "image_height"
                    )
            })

        # ============================================================
        # Localization
        # ============================================================

        localization = result.get(
            "localization",
            {}
        )

        if not isinstance(
            localization,
            dict
        ):

            localization = {}

        # ------------------------------------------------------------
        # All localization components
        # ------------------------------------------------------------

        localization_components = (
            localization.get(
                "components",
                []
            )
        )

        if not isinstance(
            localization_components,
            list
        ):

            localization_components = []

        normalized_components = []

        for component in (
            localization_components
        ):

            if not isinstance(
                component,
                dict
            ):
                continue

            bbox = component.get(
                "bbox",
                []
            )

            if (
                not isinstance(
                    bbox,
                    list
                )
                or len(bbox) != 4
            ):
                continue

            try:

                normalized_bbox = [
                    float(x)
                    for x in bbox
                ]

                component_confidence = float(
                    component.get(
                        "confidence",
                        0.0
                    )
                )

                base_probability = float(
                    component.get(
                        "base_probability",
                        confidence
                    )
                )

                ablated_probability = float(
                    component.get(
                        "ablated_probability",
                        0.0
                    )
                )

                attribution_logit = float(
                    component.get(
                        "attribution_logit",
                        0.0
                    )
                )

                probability_diff = float(
                    component.get(
                        "probability_diff",
                        0.0
                    )
                )

            except (
                TypeError,
                ValueError
            ):

                continue

            normalized_components.append({

                "rank":
                    component.get(
                        "rank"
                    ),

                "node_index":
                    component.get(
                        "node_index"
                    ),

                "detection_index":
                    component.get(
                        "detection_index"
                    ),

                "class_id":
                    component.get(
                        "class_id"
                    ),

                "class_name":
                    component.get(
                        "class_name",
                        "Unknown"
                    ),

                "confidence":
                    component_confidence,

                "bbox":
                    normalized_bbox,

                "base_probability":
                    base_probability,

                "ablated_probability":
                    ablated_probability,

                "attribution_logit":
                    attribution_logit,

                "probability_diff":
                    probability_diff,

                "structured_element":
                    component.get(
                        "structured_element",
                        {}
                    )
            })

        # ============================================================
        # Responsible components
        # ============================================================

        responsible_components = [

            component

            for component
            in normalized_components

            if component[
                "attribution_logit"
            ] > 0
        ]

        # Highest attribution first.
        responsible_components.sort(
            key=lambda x:
                x["attribution_logit"],
            reverse=True
        )

        # ============================================================
        # Contribution percentages
        # ============================================================

        total_positive_attribution = sum(

            component[
                "attribution_logit"
            ]

            for component
            in responsible_components

        )

        if (
            total_positive_attribution
            > 0
        ):

            for component in (
                responsible_components
            ):

                component[
                    "contribution_percent"
                ] = (

                    component[
                        "attribution_logit"
                    ]

                    /
                    total_positive_attribution

                ) * 100.0

        else:

            for component in (
                responsible_components
            ):

                component[
                    "contribution_percent"
                ] = 0.0

        # ============================================================
        # Localization response
        # ============================================================

        normalized_localization = {

            "detected":
                bool(
                    localization.get(
                        "detected",
                        False
                    )
                ),

            "method":
                localization.get(
                    "method"
                ),

            "trained_localizer":
                bool(
                    localization.get(
                        "trained_localizer",
                        False
                    )
                ),

            "components":
                normalized_components,

            "responsible_components":
                responsible_components
        }

        # ============================================================
        # Final response
        # ============================================================

        response = {

            "success":
                True,

            # Keep prediction explicitly.
            # FastAPI and Visualizer use this.
            "prediction":
                prediction,

            "dark_pattern_detected":
                dark_pattern_detected,

            "label":
                label,

            "confidence":
                confidence,

            "probability":
                confidence,

            "detections":
                [],

            # All YOLO detections.
            "detected_widgets":
                widgets,

            "num_detected_widgets":
                result.get(
                    "num_detected_widgets",
                    len(widgets)
                ),

            # Graph information.
            "num_graph_nodes":
                result.get(
                    "num_graph_nodes"
                ),

            "num_graph_edges":
                result.get(
                    "num_graph_edges"
                ),

            # Feature information.
            "feature_dimensions":
                result.get(
                    "feature_dimensions"
                ),

            "fusion_weights":
                result.get(
                    "fusion_weights"
                ),

            # Structured OCR/UI representation.
            "structured_text":
                result.get(
                    "structured_text"
                ),

            "structured_representation":
                result.get(
                    "structured_representation"
                ),

            # IMPORTANT:
            # Localization is preserved here so the
            # FastAPI-side visualizer can use it.
            "localization":
                normalized_localization
        }

        # ============================================================
        # Logging
        # ============================================================

        print(
            "[AnalysisService] "
            "Parsed response:"
        )

        print(
            f"  Prediction: "
            f"{response['prediction']}"
        )

        print(
            f"  Dark pattern: "
            f"{response['dark_pattern_detected']}"
        )

        print(
            f"  Label: "
            f"{response['label']}"
        )

        print(
            f"  Confidence: "
            f"{response['confidence']:.4f}"
        )

        print(
            f"  Widgets: "
            f"{len(response['detected_widgets'])}"
        )

        print(
            f"  Localization components: "
            f"{len(
                response[
                    'localization'
                ][
                    'components'
                ]
            )}"
        )

        print(
            f"  Responsible components: "
            f"{len(
                response[
                    'localization'
                ][
                    'responsible_components'
                ]
            )}"
        )

        for component in (
            response[
                "localization"
            ][
                "responsible_components"
            ]
        ):

            print(
                "    - "
                f"{component['class_name']} "
                f"(detection="
                f"{component['detection_index']}, "
                f"attribution="
                f"{component['attribution_logit']:.6f}, "
                f"contribution="
                f"{component['contribution_percent']:.2f}%)"
            )

        return response


# ================================================================
# Singleton
# ================================================================

