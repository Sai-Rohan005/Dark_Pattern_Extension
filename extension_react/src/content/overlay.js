
/* ============================================================
   DARK PATTERN DETECTOR
   CONTENT OVERLAY
   ============================================================ */

/*
 * Responsibilities:
 *
 * 1. Display dark-pattern bounding boxes.
 * 2. Display pattern type and confidence.
 * 3. Remove bounding boxes when analysis is cleared.
 * 4. Keep overlays aligned while scrolling/resizing.
 * 5. Never display boxes when there are no detections.
 *
 * This file does NOT:
 *
 * - Capture screenshots
 * - Call the backend
 * - Run YOLO/OCR
 * - Perform AI inference
 */


/* ============================================================
   OVERLAY MANAGER
============================================================ */

const DarkPatternOverlay = {

    /* --------------------------------------------------------
       State
    -------------------------------------------------------- */

    initialized: false,

    active: false,

    detections: [],

    overlayContainer: null,

    resizeObserver: null,

    scrollHandler: null,

    resizeHandler: null,


    /* ========================================================
       INITIALIZE
    ======================================================== */

    init() {

        if (this.initialized) {
            return;
        }

        this.initialized = true;

        this.setupEventListener();

        this.setupScrollListener();

        this.setupResizeListener();

        console.log(
            "[Dark Pattern Detector] Overlay initialized."
        );
    },


    /* ========================================================
       EVENT LISTENER
    ======================================================== */

    setupEventListener() {

        window.addEventListener(
            "dark-pattern-detector",
            (event) => {

                const detail =
                    event.detail || {};

                this.handleMessage(detail);
            }
        );
    },


    /* ========================================================
       HANDLE INTERNAL MESSAGE
    ======================================================== */

    handleMessage(message) {

        if (!message || !message.type) {
            return;
        }


        switch (message.type) {

            case "ACTIVATE_OVERLAY":

                this.activate();

                break;


            case "DEACTIVATE_OVERLAY":

                this.deactivate();

                break;


            case "SHOW_DETECTIONS":

                this.showDetections(
                    message.detections || []
                );

                break;


            case "CLEAR_DETECTIONS":

                this.clear();

                break;


            case "START_AREA_SELECTION":

                /*
                 * Selection UI is handled by selection.js.
                 * Overlay only makes sure old detections are
                 * removed while selecting.
                 */

                this.clear();

                break;


            case "CANCEL_AREA_SELECTION":

                break;


            default:

                break;
        }
    },


    /* ========================================================
       ACTIVATE
    ======================================================== */

    activate() {

        this.active = true;

        this.createContainer();

        console.log(
            "[Dark Pattern Detector] Overlay activated."
        );
    },


    /* ========================================================
       DEACTIVATE
    ======================================================== */

    deactivate() {

        this.active = false;

        this.clear();

        this.removeContainer();

        console.log(
            "[Dark Pattern Detector] Overlay deactivated."
        );
    },


    /* ========================================================
       CREATE CONTAINER
    ======================================================== */

    createContainer() {

        if (this.overlayContainer) {
            return;
        }


        const container =
            document.createElement("div");


        container.id =
            "dark-pattern-detector-overlay";


        /*
         * The container covers the entire document.
         *
         * pointer-events: none ensures that the overlay
         * never blocks buttons, links, forms, etc.
         */

        Object.assign(
            container.style,
            {
                position: "absolute",
                top: "0",
                left: "0",
                width: "0",
                height: "0",
                zIndex: "2147483646",
                pointerEvents: "none"
            }
        );


        /*
         * Append to body when possible.
         */

        if (document.body) {

            document.body.appendChild(
                container
            );

        } else {

            document.documentElement.appendChild(
                container
            );
        }


        this.overlayContainer =
            container;
    },


    /* ========================================================
       REMOVE CONTAINER
    ======================================================== */

    removeContainer() {

        if (
            this.overlayContainer &&
            this.overlayContainer.parentNode
        ) {

            this.overlayContainer.parentNode.removeChild(
                this.overlayContainer
            );
        }


        this.overlayContainer = null;
    },


    /* ========================================================
       SHOW DETECTIONS
    ======================================================== */

    showDetections(detections) {

        /*
         * Never show boxes if detector is inactive.
         */

        if (!this.active) {

            console.warn(
                "[Dark Pattern Detector] Cannot show overlays while inactive."
            );

            return;
        }


        /*
         * Normalize input.
         */

        const normalized =
            this.normalizeDetections(
                detections
            );


        /*
         * IMPORTANT:
         *
         * No detections = no bounding boxes.
         */

        if (normalized.length === 0) {

            this.clear();

            return;
        }


        this.detections =
            normalized;


        this.createContainer();

        this.render();
    },


    /* ========================================================
       NORMALIZE DETECTIONS
    ======================================================== */

    normalizeDetections(detections) {

        if (!Array.isArray(detections)) {
            return [];
        }


        return detections
            .map(
                (detection, index) => {

                    if (!detection) {
                        return null;
                    }


                    const type =
                        detection.type ||
                        detection.pattern ||
                        detection.label ||
                        "Dark Pattern";


                    const confidence =
                        this.normalizeConfidence(
                            detection.confidence ??
                            detection.score ??
                            0
                        );


                    const bbox =
                        this.normalizeBoundingBox(
                            detection.bbox ??
                            detection.bounding_box ??
                            detection.box
                        );


                    if (!bbox) {
                        return null;
                    }


                    return {
                        id:
                            detection.id ??
                            `dark-pattern-${index}`,

                        type:
                            this.formatPatternName(
                                type
                            ),

                        confidence,

                        bbox,

                        description:
                            detection.description ||
                            ""
                    };
                }
            )
            .filter(Boolean);
    },


    /* ========================================================
       NORMALIZE CONFIDENCE
    ======================================================== */

    normalizeConfidence(value) {

        let confidence =
            Number(value);


        if (!Number.isFinite(confidence)) {
            return 0;
        }


        /*
         * Backend may return:
         *
         * 0.92
         * or
         * 92
         */

        if (
            confidence >= 0 &&
            confidence <= 1
        ) {

            confidence *= 100;
        }


        return Math.max(
            0,
            Math.min(
                100,
                confidence
            )
        );
    },


    /* ========================================================
       NORMALIZE BOUNDING BOX
    ======================================================== */

    normalizeBoundingBox(bbox) {

        if (!bbox) {
            return null;
        }


        /*
         * Array:
         *
         * [x1, y1, x2, y2]
         */

        if (
            Array.isArray(bbox) &&
            bbox.length >= 4
        ) {

            const x1 =
                Number(bbox[0]);

            const y1 =
                Number(bbox[1]);

            const x2 =
                Number(bbox[2]);

            const y2 =
                Number(bbox[3]);


            if (
                !Number.isFinite(x1) ||
                !Number.isFinite(y1) ||
                !Number.isFinite(x2) ||
                !Number.isFinite(y2)
            ) {

                return null;
            }


            return this.createBoundingBox(
                x1,
                y1,
                x2,
                y2
            );
        }


        /*
         * Object:
         *
         * {
         *   x,
         *   y,
         *   width,
         *   height
         * }
         */

        if (
            typeof bbox === "object" &&
            Number.isFinite(
                Number(bbox.x)
            ) &&
            Number.isFinite(
                Number(bbox.y)
            ) &&
            Number.isFinite(
                Number(bbox.width)
            ) &&
            Number.isFinite(
                Number(bbox.height)
            )
        ) {

            return {
                x:
                    Number(bbox.x),

                y:
                    Number(bbox.y),

                width:
                    Math.max(
                        0,
                        Number(bbox.width)
                    ),

                height:
                    Math.max(
                        0,
                        Number(bbox.height)
                    )
            };
        }


        /*
         * Object:
         *
         * {
         *   x1,
         *   y1,
         *   x2,
         *   y2
         * }
         */

        if (
            typeof bbox === "object" &&
            Number.isFinite(
                Number(bbox.x1)
            ) &&
            Number.isFinite(
                Number(bbox.y1)
            ) &&
            Number.isFinite(
                Number(bbox.x2)
            ) &&
            Number.isFinite(
                Number(bbox.y2)
            )
        ) {

            return this.createBoundingBox(
                Number(bbox.x1),
                Number(bbox.y1),
                Number(bbox.x2),
                Number(bbox.y2)
            );
        }


        /*
         * Nested coordinates.
         */

        if (bbox.coordinates) {

            return this.normalizeBoundingBox(
                bbox.coordinates
            );
        }


        return null;
    },


    /* ========================================================
       CREATE BOUNDING BOX
    ======================================================== */

    createBoundingBox(
        x1,
        y1,
        x2,
        y2
    ) {

        const left =
            Math.min(x1, x2);

        const top =
            Math.min(y1, y2);

        const right =
            Math.max(x1, x2);

        const bottom =
            Math.max(y1, y2);


        return {

            x: left,

            y: top,

            width:
                Math.max(
                    0,
                    right - left
                ),

            height:
                Math.max(
                    0,
                    bottom - top
                )
        };
    },


    /* ========================================================
       RENDER
    ======================================================== */

    render() {

        if (!this.overlayContainer) {
            return;
        }


        /*
         * Remove previous boxes.
         */

        this.overlayContainer.innerHTML = "";


        /*
         * Render every detection.
         */

        this.detections.forEach(
            (detection, index) => {

                this.renderDetection(
                    detection,
                    index
                );
            }
        );
    },


    /* ========================================================
       RENDER SINGLE DETECTION
    ======================================================== */

    renderDetection(
        detection,
        index
    ) {

        const box =
            document.createElement("div");


        box.className =
            "dark-pattern-detection-box";


        box.dataset.detectionId =
            detection.id;


        box.dataset.detectionIndex =
            String(index);


        /*
         * Bounding box styling.
         */

        Object.assign(
            box.style,
            {
                position: "absolute",

                left:
                    `${detection.bbox.x}px`,

                top:
                    `${detection.bbox.y}px`,

                width:
                    `${detection.bbox.width}px`,

                height:
                    `${detection.bbox.height}px`,

                border:
                    "3px solid #dc2626",

                background:
                    "rgba(220, 38, 38, 0.08)",

                boxSizing:
                    "border-box",

                pointerEvents:
                    "none",

                zIndex:
                    "2147483647"
            }
        );


        /*
         * Create label.
         */

        const label =
            this.createLabel(
                detection
            );


        box.appendChild(
            label
        );


        this.overlayContainer.appendChild(
            box
        );
    },


    /* ========================================================
       CREATE LABEL
    ======================================================== */

    createLabel(detection) {

        const label =
            document.createElement("div");


        label.className =
            "dark-pattern-detection-label";


        /*
         * Prevent label from inheriting page styles.
         */

        Object.assign(
            label.style,
            {
                position: "absolute",

                left: "0",

                top: "0",

                transform:
                    "translateY(-100%)",

                marginTop: "-4px",

                padding:
                    "5px 8px",

                borderRadius:
                    "5px 5px 0 0",

                background:
                    "#dc2626",

                color:
                    "#ffffff",

                fontFamily:
                    "Arial, Helvetica, sans-serif",

                fontSize:
                    "12px",

                fontWeight:
                    "700",

                lineHeight:
                    "1.2",

                whiteSpace:
                    "nowrap",

                boxShadow:
                    "0 2px 6px rgba(0, 0, 0, 0.2)",

                pointerEvents:
                    "none",

                zIndex:
                    "2147483647"
            }
        );


        const confidence =
            `${Math.round(
                detection.confidence
            )}%`;


        label.textContent =
            `${detection.type} · ${confidence}`;


        return label;
    },


    /* ========================================================
       CLEAR
    ======================================================== */

    clear() {

        this.detections = [];


        if (this.overlayContainer) {

            this.overlayContainer.innerHTML =
                "";
        }
    },


    /* ========================================================
       SCROLL LISTENER
    ======================================================== */

    setupScrollListener() {

        this.scrollHandler =
            () => {

                /*
                 * The overlay uses document coordinates,
                 * so scrolling normally does not require
                 * changing the box positions.
                 *
                 * We still keep this hook available in case
                 * future coordinate modes require updates.
                 */

                if (
                    this.active &&
                    this.detections.length > 0
                ) {

                    this.updatePositions();
                }
            };


        window.addEventListener(
            "scroll",
            this.scrollHandler,
            {
                passive: true
            }
        );
    },


    /* ========================================================
       RESIZE LISTENER
    ======================================================== */

    setupResizeListener() {

        this.resizeHandler =
            () => {

                if (
                    this.active &&
                    this.detections.length > 0
                ) {

                    this.updatePositions();
                }
            };


        window.addEventListener(
            "resize",
            this.resizeHandler
        );
    },


    /* ========================================================
       UPDATE POSITIONS
    ======================================================== */

    updatePositions() {

        if (!this.overlayContainer) {
            return;
        }


        const boxes =
            this.overlayContainer.querySelectorAll(
                ".dark-pattern-detection-box"
            );


        boxes.forEach(
            (box, index) => {

                const detection =
                    this.detections[index];


                if (!detection) {
                    return;
                }


                box.style.left =
                    `${detection.bbox.x}px`;


                box.style.top =
                    `${detection.bbox.y}px`;


                box.style.width =
                    `${detection.bbox.width}px`;


                box.style.height =
                    `${detection.bbox.height}px`;
            }
        );
    },


    /* ========================================================
       FORMAT PATTERN NAME
    ======================================================== */

    formatPatternName(type) {

        if (!type) {
            return "Dark Pattern";
        }


        const value =
            String(type)
                .trim()
                .replace(/[_-]+/g, " ");


        return value
            .split(/\s+/)
            .map(
                word =>
                    word.charAt(0).toUpperCase() +
                    word.slice(1).toLowerCase()
            )
            .join(" ");
    },


    /* ========================================================
       GET DETECTIONS
    ======================================================== */

    getDetections() {

        return [
            ...this.detections
        ];
    },


    /* ========================================================
       IS ACTIVE
    ======================================================== */

    isActive() {

        return this.active;
    }
};


/* ============================================================
   INITIALIZE
============================================================ */

DarkPatternOverlay.init();


/* ============================================================
   GLOBAL EXPORT
============================================================ */

window.DarkPatternOverlay =
    DarkPatternOverlay;
