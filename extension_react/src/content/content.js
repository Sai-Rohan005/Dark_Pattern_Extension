
/* ============================================================
   DARK PATTERN DETECTOR
   CONTENT SCRIPT
   ============================================================ */

/*
 * This script runs inside webpages.
 *
 * Responsibilities:
 * 1. Listen for messages from the Side Panel/background.
 * 2. Activate/deactivate the detector.
 * 3. Start area selection.
 * 4. Provide webpage information.
 * 5. Coordinate with selection.js and overlay.js.
 *
 * Screenshot capture is handled by screenshot/capture.js.
 * AI analysis is handled by the backend.
 */


/* ============================================================
   STATE
============================================================ */

const ContentDetector = {

    active: false,

    initialized: false,

    analyzing: false,

    lastAnalysis: null,

    selectionActive: false,

    /* --------------------------------------------------------
       Initialize
    -------------------------------------------------------- */

    init() {

        if (this.initialized) {
            return;
        }

        this.initialized = true;

        this.setupMessageListener();

        this.restoreState();

        console.log(
            "[Dark Pattern Detector] Content script initialized."
        );
    },


    /* --------------------------------------------------------
       Setup message listener
    -------------------------------------------------------- */

    setupMessageListener() {

        chrome.runtime.onMessage.addListener(
            (message, sender, sendResponse) => {

                this.handleMessage(
                    message,
                    sender,
                    sendResponse
                );

                /*
                 * Return true because some handlers
                 * respond asynchronously.
                 */

                return true;
            }
        );
    },


    /* ========================================================
       MESSAGE HANDLER
    ======================================================== */

    async handleMessage(
        message,
        sender,
        sendResponse
    ) {

        if (!message || !message.type) {

            sendResponse({
                success: false,
                error: "Invalid message."
            });

            return;
        }


        try {

            switch (message.type) {

                /* ------------------------------------------------
                   ACTIVATE DETECTOR
                ------------------------------------------------ */

                case "DETECTOR_ACTIVATED":

                    await this.activate();

                    sendResponse({
                        success: true,
                        active: true
                    });

                    break;


                /* ------------------------------------------------
                   DEACTIVATE DETECTOR
                ------------------------------------------------ */

                case "DETECTOR_DEACTIVATED":

                    await this.deactivate();

                    sendResponse({
                        success: true,
                        active: false
                    });

                    break;


                /* ------------------------------------------------
                   GET DETECTOR STATE
                ------------------------------------------------ */

                case "GET_DETECTOR_STATE":

                    sendResponse({
                        success: true,
                        active: this.active
                    });

                    break;


                /* ------------------------------------------------
                   GET PAGE INFORMATION
                ------------------------------------------------ */

                case "GET_PAGE_INFO":

                    sendResponse({
                        success: true,
                        page: this.getPageInfo()
                    });

                    break;


                /* ------------------------------------------------
                   START AREA SELECTION
                ------------------------------------------------ */

                case "START_AREA_SELECTION":

                    if (!this.active) {
                        sendResponse({
                            success: false,
                            error: "Detector is not active."
                        });
                        break;
                    }

                    console.log(
                        "[Dark Pattern Detector] Starting area selection..."
                    );

                    this.startAreaSelection();

                    sendResponse({
                        success: true
                    });

                    break;


                /* ------------------------------------------------
                   CANCEL AREA SELECTION
                ------------------------------------------------ */

                case "CANCEL_AREA_SELECTION":

                    this.cancelAreaSelection();

                    sendResponse({
                        success: true
                    });

                    break;


                /* ------------------------------------------------
                   ANALYSIS STARTED
                ------------------------------------------------ */

                case "ANALYSIS_STARTED":

                    this.analyzing = true;

                    this.showAnalyzingState();

                    sendResponse({
                        success: true
                    });

                    break;


                /* ------------------------------------------------
                   ANALYSIS COMPLETED
                ------------------------------------------------ */

                case "ANALYSIS_COMPLETED":

                    this.analyzing = false;

                    this.lastAnalysis =
                        message.result || null;

                    this.handleAnalysisCompleted(
                        message.result
                    );

                    sendResponse({
                        success: true
                    });

                    break;


                /* ------------------------------------------------
                   ANALYSIS FAILED
                ------------------------------------------------ */

                case "ANALYSIS_FAILED":

                    this.analyzing = false;

                    this.handleAnalysisFailed(
                        message.error
                    );

                    sendResponse({
                        success: true
                    });

                    break;


                
                /* ------------------------------------------------
                SHOW DETECTIONS
                ------------------------------------------------ */

                case "SHOW_DETECTIONS":

                    this.lastAnalysis = {
                        dark_pattern_detected:
                            message.dark_pattern_detected === true,

                        detections:
                            Array.isArray(message.detections)
                                ? message.detections
                                : []
                    };

                    this.showDetections(
                        this.lastAnalysis
                    );

                    sendResponse({
                        success: true
                    });

                    break;
                



                /* ------------------------------------------------
                   CLEAR DETECTIONS
                ------------------------------------------------ */

                case "CLEAR_DETECTIONS":

                    this.lastAnalysis = null;

                    this.clearDetections();

                    sendResponse({
                        success: true
                    });

                    break;


                /* ------------------------------------------------
                   HEALTH CHECK
                ------------------------------------------------ */

                case "PING":

                    sendResponse({
                        success: true,
                        message: "Content script is running.",
                        active: this.active
                    });

                    break;


                /* ------------------------------------------------
                   UNKNOWN MESSAGE
                ------------------------------------------------ */

                default:

                    console.warn(
                        "[Dark Pattern Detector] Unknown message:",
                        message.type
                    );

                    sendResponse({
                        success: false,
                        error:
                            `Unknown message type: ${message.type}`
                    });
            }

        } catch (error) {

            console.error(
                "[Dark Pattern Detector] Message handling error:",
                error
            );

            sendResponse({
                success: false,
                error: error.message
            });
        }
    },


    /* ========================================================
       ACTIVATE
    ======================================================== */

    async activate() {

        if (this.active) {

            console.log(
                "[Dark Pattern Detector] Already active."
            );

            return;
        }


        this.active = true;


        // ------------------------------------------------------
        // Save state
        // ------------------------------------------------------

        await this.saveState();


        // ------------------------------------------------------
        // Add detector class to page
        // ------------------------------------------------------

        document.documentElement.classList.add(
            "dark-pattern-detector-active"
        );


        // ------------------------------------------------------
        // Notify overlay
        // ------------------------------------------------------

        this.sendInternalMessage(
            "ACTIVATE_OVERLAY"
        );


        console.log(
            "[Dark Pattern Detector] Detector activated."
        );
    },


    /* ========================================================
       DEACTIVATE
    ======================================================== */

    async deactivate() {

        this.active = false;

        this.analyzing = false;


        // ------------------------------------------------------
        // Cancel selection
        // ------------------------------------------------------

        this.cancelAreaSelection();


        // ------------------------------------------------------
        // Remove detector class
        // ------------------------------------------------------

        document.documentElement.classList.remove(
            "dark-pattern-detector-active"
        );


        // ------------------------------------------------------
        // Remove overlays
        // ------------------------------------------------------

        this.clearDetections();

        this.sendInternalMessage(
            "DEACTIVATE_OVERLAY"
        );


        // ------------------------------------------------------
        // Save state
        // ------------------------------------------------------

        await this.saveState();


        console.log(
            "[Dark Pattern Detector] Detector deactivated."
        );
    },


    /* ========================================================
       SAVE STATE
    ======================================================== */

    async saveState() {

        try {

            await chrome.storage.local.set({
                detectorActive: this.active
            });

        } catch (error) {

            console.warn(
                "[Dark Pattern Detector] Failed to save state:",
                error
            );
        }
    },


    /* ========================================================
       RESTORE STATE
    ======================================================== */

    async restoreState() {

        try {

            const result =
                await chrome.storage.local.get([
                    "detectorActive"
                ]);


            this.active =
                result.detectorActive === true;


            if (this.active) {

                document.documentElement.classList.add(
                    "dark-pattern-detector-active"
                );

                this.sendInternalMessage(
                    "ACTIVATE_OVERLAY"
                );
            }

        } catch (error) {

            console.warn(
                "[Dark Pattern Detector] Failed to restore state:",
                error
            );

            this.active = false;
        }
    },


    /* ========================================================
       START AREA SELECTION
    ======================================================== */

    startAreaSelection() {

        if (!this.active) {

            console.warn(
                "[Dark Pattern Detector] Cannot select area while inactive."
            );

            return;
        }


        if (this.selectionActive) {

            console.warn(
                "[Dark Pattern Detector] Selection already active."
            );

            return;
        }


        this.selectionActive = true;

        window.dispatchEvent(
            new CustomEvent(
                "dark-pattern-detector",
                {
                    detail: {
                        type: "START_AREA_SELECTION"
                    }
                }
            )
        );


        // ------------------------------------------------------
        // Notify selection.js
        // ------------------------------------------------------

        this.sendInternalMessage(
            "START_AREA_SELECTION"
        );


        console.log(
            "[Dark Pattern Detector] Area selection started."
        );
    },


    /* ========================================================
       CANCEL AREA SELECTION
    ======================================================== */

    cancelAreaSelection() {

        if (!this.selectionActive) {
            return;
        }


        this.selectionActive = false;


        this.sendInternalMessage(
            "CANCEL_AREA_SELECTION"
        );


        console.log(
            "[Dark Pattern Detector] Area selection cancelled."
        );
    },


    /* ========================================================
       HANDLE SELECTION
    ======================================================== */

    handleAreaSelected(selection) {

        if (!this.selectionActive) {

            console.warn(
                "[Dark Pattern Detector] Ignoring AREA_SELECTED because selection is not active."
            );

            return;
        }

        this.selectionActive = false;


        if (!selection) {

            console.warn(
                "[Dark Pattern Detector] Invalid selection."
            );

            return;
        }


        const selectionWithViewport = {

            ...selection,

            viewportWidth:
                window.innerWidth,

            viewportHeight:
                window.innerHeight,

            devicePixelRatio:
                window.devicePixelRatio || 1
        };


        console.log(
            "[Dark Pattern Detector] Area selected:",
            selectionWithViewport
        );


        chrome.runtime.sendMessage({

            type: "AREA_SELECTED",

            selection:
                selectionWithViewport

        }).catch(error => {

            console.warn(
                "[Dark Pattern Detector] Failed to send AREA_SELECTED:",
                error
            );
        });
    },


    /* ========================================================
       GET PAGE INFORMATION
    ======================================================== */

    getPageInfo() {

        return {

            url: window.location.href,

            title: document.title,

            domain: window.location.hostname,

            pathname: window.location.pathname,

            protocol: window.location.protocol,

            viewport: {
                width: window.innerWidth,
                height: window.innerHeight
            },

            page: {
                width: document.documentElement.scrollWidth,
                height: document.documentElement.scrollHeight
            },

            scroll: {
                x: window.scrollX,
                y: window.scrollY
            },

            devicePixelRatio:
                window.devicePixelRatio || 1,

            timestamp:
                new Date().toISOString()
        };
    },


    /* ========================================================
       GET VIEWPORT
    ======================================================== */

    getViewportInfo() {

        return {

            width: window.innerWidth,

            height: window.innerHeight,

            scrollX: window.scrollX,

            scrollY: window.scrollY,

            devicePixelRatio:
                window.devicePixelRatio || 1
        };
    },


    /* ========================================================
       ANALYSIS STARTED
    ======================================================== */

    showAnalyzingState() {

        document.documentElement.classList.add(
            "dark-pattern-detector-analyzing"
        );
    },


    /* ========================================================
       ANALYSIS COMPLETED
    ======================================================== */

    handleAnalysisCompleted(result) {

        document.documentElement.classList.remove(
            "dark-pattern-detector-analyzing"
        );


        if (!result) {
            return;
        }


        if (
            result.dark_pattern_detected &&
            Array.isArray(result.detections)
        ) {

            this.showDetections(result);

        } else {

            this.clearDetections();
        }
    },


    /* ========================================================
       ANALYSIS FAILED
    ======================================================== */

    handleAnalysisFailed(error) {

        document.documentElement.classList.remove(
            "dark-pattern-detector-analyzing"
        );


        console.error(
            "[Dark Pattern Detector] Analysis failed:",
            error
        );
    },


    /* ========================================================
       SHOW DETECTIONS
    ======================================================== */

    showDetections(result) {

        if (!result) {
            return;
        }


        const detections =
            Array.isArray(result.detections)
                ? result.detections
                : [];


        /*
         * IMPORTANT:
         *
         * Bounding boxes should ONLY be shown when a
         * dark pattern is actually detected.
         */

        const darkPatternDetected =
            result.dark_pattern_detected === true ||
            detections.length > 0;


        if (!darkPatternDetected) {

            this.clearDetections();

            return;
        }


        /*
         * Prefer overlay.js for drawing bounding boxes.
         */

        this.sendInternalMessage(
            "SHOW_DETECTIONS",
            {
                detections: detections
            }
        );
    },


    /* ========================================================
       CLEAR DETECTIONS
    ======================================================== */

    clearDetections() {

        this.sendInternalMessage(
            "CLEAR_DETECTIONS"
        );
    },


    /* ========================================================
       INTERNAL MESSAGE BUS
    ======================================================== */

    sendInternalMessage(
        type,
        data = {}
    ) {

        /*
         * These messages are dispatched as CustomEvents.
         *
         * selection.js and overlay.js can listen for them
         * without needing another Chrome message round-trip.
         */

        try {

            window.dispatchEvent(
                new CustomEvent(
                    "dark-pattern-detector",
                    {
                        detail: {
                            type,
                            ...data
                        }
                    }
                )
            );

        } catch (error) {

            console.warn(
                "[Dark Pattern Detector] Internal message failed:",
                error
            );
        }
    },


    /* ========================================================
       GET LAST ANALYSIS
    ======================================================== */

    getLastAnalysis() {

        return this.lastAnalysis;
    },


    /* ========================================================
       IS ACTIVE
    ======================================================== */

    isActive() {

        return this.active;
    },


    /* ========================================================
       IS ANALYZING
    ======================================================== */

    isAnalyzing() {

        return this.analyzing;
    }
};


/* ============================================================
   SELECTION EVENT BRIDGE
============================================================ */

/*
 * selection.js should dispatch:
 *
 * window.dispatchEvent(
 *     new CustomEvent(
 *         "dark-pattern-detector-selection",
 *         {
 *             detail: {
 *                 type: "AREA_SELECTED",
 *                 selection: {...}
 *             }
 *         }
 *     )
 * );
 *
 * This listener forwards it to the extension runtime.
 */

/* ============================================================
   SELECTION EVENT BRIDGE
============================================================ */

if (!window.__DARK_PATTERN_SELECTION_BRIDGE_INITIALIZED__) {

    window.__DARK_PATTERN_SELECTION_BRIDGE_INITIALIZED__ = true;

    window.addEventListener(
        "dark-pattern-detector-selection",
        (event) => {

            const detail =
                event.detail || {};

            if (
                detail.type === "AREA_SELECTED"
            ) {

                console.log(
                    "[Dark Pattern Detector] Selection event received."
                );

                ContentDetector.handleAreaSelected(
                    detail.selection
                );
            }
        }
    );

    console.log(
        "[Dark Pattern Detector] Selection event bridge initialized."
    );

} else {

    console.log(
        "[Dark Pattern Detector] Duplicate selection event bridge skipped."
    );
}

/* ============================================================
   GLOBAL EXPORT + INITIALIZE
============================================================ */

if (!window.__DARK_PATTERN_CONTENT_INITIALIZED__) {

    window.__DARK_PATTERN_CONTENT_INITIALIZED__ = true;

    window.DarkPatternDetector = ContentDetector;

    try {

        console.log(
            "[Dark Pattern Detector] Starting content script..."
        );

        ContentDetector.init();

        console.log(
            "[Dark Pattern Detector] Content script ready."
        );

    } catch (error) {

        console.error(
            "[Dark Pattern Detector] Content script initialization failed:",
            error
        );
    }

} else {

    console.log(
        "[Dark Pattern Detector] Duplicate content.js detected. Initialization skipped."
    );
}