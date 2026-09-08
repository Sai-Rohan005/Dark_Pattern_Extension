
// ============================================================
// DARK PATTERN DETECTOR
// Backend API Client
// File: extension/src/api/api.js
// ============================================================

"use strict";

/* ============================================================
   CONFIGURATION
   ============================================================ */

const API_CONFIG = {
    BASE_URL: "http://localhost:8000",

    ENDPOINTS: {
        ANALYZE: "/api/v1/analyze",
        HEALTH: "/health"
    },

    /*
     * Maximum time to wait for the backend.
     *
     * Your pipeline contains YOLO + OCR + DINOv2 + GAT +
     * ModernBERT, so analysis can take a while.
     */
    TIMEOUT: 5 * 60 * 1000
};


function base64ToBlob(base64, contentType) {

        const byteCharacters =
            atob(base64);

        const byteNumbers =
            new Array(byteCharacters.length);

        for (
            let i = 0;
            i < byteCharacters.length;
            i++
        ) {
            byteNumbers[i] =
                byteCharacters.charCodeAt(i);
        }

        const byteArray =
            new Uint8Array(byteNumbers);

        return new Blob(
            [byteArray],
            {
                type: contentType
            }
        );
    }





/* ============================================================
   API CLIENT
   ============================================================ */

class DarkPatternAPI {

    constructor(config = {}) {

        this.baseUrl =
            config.baseUrl ||
            API_CONFIG.BASE_URL;

        this.timeout =
            config.timeout ||
            API_CONFIG.TIMEOUT;

        this.endpoints = {
            ...API_CONFIG.ENDPOINTS,
            ...(config.endpoints || {})
        };
    }


    /* ========================================================
       URL BUILDER
       ======================================================== */

    buildUrl(endpoint) {

        const base =
            this.baseUrl.replace(/\/+$/, "");

        const path =
            endpoint.startsWith("/")
                ? endpoint
                : `/${endpoint}`;

        return `${base}${path}`;
    }


    


    /* ========================================================
       ANALYZE IMAGE
       ======================================================== */

    async analyze(formData, options = {}) {

        if (!(formData instanceof FormData)) {
            throw new Error(
                "analyze() expects a FormData object."
            );
        }

        const endpoint =
            options.endpoint ||
            this.endpoints.ANALYZE;

        const url =
            this.buildUrl(endpoint);

        const timeout =
            options.timeout ||
            this.timeout;

        console.log(
            "[Dark Pattern Detector] Sending analysis request:",
            url
        );

        const controller =
            new AbortController();

        const timeoutId =
            setTimeout(() => {
                controller.abort();
            }, timeout);

        try {

            const response =
                await fetch(url, {
                    method: "POST",

                    /*
                     * Do NOT manually set Content-Type here.
                     *
                     * Browser automatically creates:
                     *
                     * multipart/form-data;
                     * boundary=...
                     *
                     */
                    body: formData,

                    signal: controller.signal,

                    headers: {
                        "Accept": "application/json"
                    }
                });


            clearTimeout(timeoutId);


            /* ------------------------------------------------
               HTTP ERROR
               ------------------------------------------------ */

            if (!response.ok) {

                const errorDetails =
                    await this.extractError(response);

                throw new APIError(
                    errorDetails.message,
                    response.status,
                    errorDetails.details
                );
            }


            /* ------------------------------------------------
               RESPONSE
               ------------------------------------------------ */


            const data =
                await this.parseJSON(response);


            return this.normalizeAnalysisResponse(data);

        } catch (error) {

            clearTimeout(timeoutId);


            if (error.name === "AbortError") {

                throw new APIError(
                    "Analysis request timed out. The AI backend took too long to respond.",
                    408,
                    {
                        reason: "timeout",
                        timeout
                    }
                );
            }


            if (error instanceof APIError) {
                throw error;
            }


            /*
             * Usually indicates that the backend is not running,
             * the URL is incorrect, CORS is blocking the request,
             * or the browser could not connect.
             */
            if (
                error instanceof TypeError ||
                error.message?.includes("Failed to fetch")
            ) {

                throw new APIError(
                    "Could not connect to the Dark Pattern Detector backend.",
                    0,
                    {
                        reason: "connection_error",
                        url,
                        originalError: error.message
                    }
                );
            }


            throw error;
        }
    }


    /* ========================================================
       ANALYZE IMAGE FILE
       ======================================================== */

    async analyzeFile(
        file,
        options = {}
    ) {

        if (!(file instanceof Blob)) {
            throw new Error(
                "analyzeFile() expects a File or Blob."
            );
        }


        const formData =
            new FormData();

        formData.append(
            "image",
            file,
            options.filename || "screenshot.png"
        );


        /*
         * Optional metadata.
         */

        if (options.analysisType) {

            formData.append(
                "analysis_type",
                options.analysisType
            );
        }

        if (options.url) {

            formData.append(
                "url",
                options.url
            );
        }

        if (options.pageTitle) {

            formData.append(
                "page_title",
                options.pageTitle
            );
        }


        if (options.selection) {

            formData.append(
                "selection",
                JSON.stringify(options.selection)
            );
        }


        return this.analyze(
            formData,
            options
        );
    }


    /* ========================================================
       ANALYZE DATA URL
       ======================================================== */

    async analyzeDataUrl(
        dataUrl,
        options = {}
    ) {

        if (
            typeof dataUrl !== "string" ||
            !dataUrl.startsWith("data:")
        ) {
            throw new Error(
                "analyzeDataUrl() expects a valid data URL."
            );
        }


        const blob =
            this.dataUrlToBlob(dataUrl);


        return this.analyzeFile(
            blob,
            {
                ...options,
                filename:
                    options.filename ||
                    "screenshot.png"
            }
        );
    }


    /* ========================================================
       HEALTH CHECK
       ======================================================== */

    async healthCheck(
        options = {}
    ) {

        const endpoint =
            options.endpoint ||
            this.endpoints.HEALTH;

        const url =
            this.buildUrl(endpoint);

        const timeout =
            options.timeout ||
            10000;

        const controller =
            new AbortController();

        const timeoutId =
            setTimeout(() => {
                controller.abort();
            }, timeout);


        try {

            const response =
                await fetch(url, {
                    method: "GET",

                    headers: {
                        "Accept": "application/json"
                    },

                    signal:
                        controller.signal
                });


            clearTimeout(timeoutId);


            if (!response.ok) {

                return {
                    success: false,
                    status: response.status,
                    message:
                        `Backend returned HTTP ${response.status}.`
                };
            }


            let data = null;

            try {
                data =
                    await response.json();
            } catch {
                data = null;
            }


            return {
                success: true,
                status: response.status,
                data
            };

        } catch (error) {

            clearTimeout(timeoutId);


            if (error.name === "AbortError") {

                return {
                    success: false,
                    status: 408,
                    message:
                        "Backend health check timed out."
                };
            }


            return {
                success: false,
                status: 0,
                message:
                    "Backend is unreachable.",
                error:
                    error.message
            };
        }
    }


    /* ========================================================
       PARSE JSON
       ======================================================== */

    async parseJSON(response) {

        const contentType =
            response.headers.get(
                "content-type"
            ) || "";


        if (
            !contentType.includes(
                "application/json"
            )
        ) {

            const text =
                await response.text();

            throw new APIError(
                "Backend returned a non-JSON response.",
                response.status,
                {
                    response: text.substring(
                        0,
                        1000
                    )
                }
            );
        }


        try {

            return await response.json();

        } catch (error) {

            throw new APIError(
                "Backend returned invalid JSON.",
                response.status,
                {
                    originalError:
                        error.message
                }
            );
        }
    }


    /* ========================================================
       EXTRACT HTTP ERROR
       ======================================================== */

    async extractError(response) {

        let message =
            `Backend request failed with HTTP ${response.status}.`;

        let details = null;


        try {

            const contentType =
                response.headers.get(
                    "content-type"
                ) || "";


            if (
                contentType.includes(
                    "application/json"
                )
            ) {

                const data =
                    await response.json();

                details = data;


                if (typeof data === "string") {

                    message = data;

                } else if (data?.detail) {

                    if (
                        typeof data.detail ===
                        "string"
                    ) {
                        message =
                            data.detail;
                    } else {
                        message =
                            JSON.stringify(
                                data.detail
                            );
                    }

                } else if (data?.message) {

                    message =
                        data.message;

                } else if (data?.error) {

                    message =
                        data.error;
                }

            } else {

                const text =
                    await response.text();

                if (text) {
                    message = text;
                }
            }

        } catch (error) {

            details = {
                parseError:
                    error.message
            };
        }


        return {
            message,
            details
        };
    }


    /* ========================================================
       NORMALIZE ANALYSIS RESPONSE
       ======================================================== */

    normalizeAnalysisResponse(data) {

        if (!data || typeof data !== "object") {

            throw new APIError(
                "Backend returned an invalid analysis response.",
                200,
                {
                    response: data
                }
            );
        }


        /*
         * Support several possible backend field names.
         */

        const rawDetections =
            Array.isArray(data.detections)
                ? data.detections
                : Array.isArray(data.results)
                    ? data.results
                    : Array.isArray(data.patterns)
                        ? data.patterns
                        : [];


        const detections =
            rawDetections
                .map(
                    detection =>
                        this.normalizeDetection(
                            detection
                        )
                )
                .filter(Boolean);


        /*
         * Backend explicitly says whether a dark pattern
         * was detected.
         *
         * If that field is absent, detections are used as
         * the fallback.
         */

        let darkPatternDetected;


        if (
            typeof data.dark_pattern_detected ===
            "boolean"
        ) {

            darkPatternDetected =
                data.dark_pattern_detected;

        } else if (
            typeof data.darkPatternDetected ===
            "boolean"
        ) {

            darkPatternDetected =
                data.darkPatternDetected;

        } else {

            darkPatternDetected =
                detections.length > 0;
        }


        return {

            ...data,

            success:
                data.success !== false,

            dark_pattern_detected:
                darkPatternDetected,

            detections,

            /*
             * Keep useful backend output.
             */

            annotated_image:
                data.annotated_image ||
                data.annotatedImage ||
                null,

            annotated_image_url:
                data.annotated_image_url ||
                data.annotatedImageUrl ||
                null,

            image:
                data.image ||
                null,

            analysis_type:
                data.analysis_type ||
                data.analysisType ||
                null
        };
    }


    /* ========================================================
       NORMALIZE DETECTION
       ======================================================== */

    normalizeDetection(
        detection
    ) {

        if (
            !detection ||
            typeof detection !== "object"
        ) {
            return null;
        }


        const type =
            detection.type ||
            detection.pattern ||
            detection.label ||
            detection.class_name ||
            detection.className ||
            "unknown";


        const rawConfidence =
            detection.confidence ??
            detection.score ??
            detection.probability ??
            0;


        const confidence =
            this.normalizeConfidence(
                rawConfidence
            );


        const bbox =
            this.normalizeBoundingBox(
                detection.bbox ||
                detection.bounding_box ||
                detection.box ||
                detection.coordinates
            );


        return {

            ...detection,

            type:
                String(type),

            confidence,

            bbox
        };
    }


    /* ========================================================
       NORMALIZE CONFIDENCE
       ======================================================== */

    normalizeConfidence(
        value
    ) {

        let confidence =
            Number(value);


        if (!Number.isFinite(confidence)) {
            return 0;
        }


        /*
         * Backend may return:
         *
         * 0.92
         *
         * or
         *
         * 92
         *
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
    }


    /* ========================================================
       NORMALIZE BOUNDING BOX
       ======================================================== */

    normalizeBoundingBox(
        bbox
    ) {

        if (!bbox) {
            return null;
        }


        /*
         * [x1, y1, x2, y2]
         */

        if (
            Array.isArray(bbox) &&
            bbox.length >= 4
        ) {

            const values =
                bbox
                    .slice(0, 4)
                    .map(Number);


            if (
                values.every(
                    Number.isFinite
                )
            ) {

                return values;
            }
        }


        /*
         * {
         *   x1,
         *   y1,
         *   x2,
         *   y2
         * }
         */

        if (
            typeof bbox === "object" &&
            ["x1", "y1", "x2", "y2"]
                .every(
                    key =>
                        bbox[key] !== undefined
                )
        ) {

            const values = [
                Number(bbox.x1),
                Number(bbox.y1),
                Number(bbox.x2),
                Number(bbox.y2)
            ];


            if (
                values.every(
                    Number.isFinite
                )
            ) {

                return values;
            }
        }


        /*
         * {
         *   x,
         *   y,
         *   width,
         *   height
         * }
         */

        if (
            typeof bbox === "object" &&
            bbox.x !== undefined &&
            bbox.y !== undefined &&
            bbox.width !== undefined &&
            bbox.height !== undefined
        ) {

            const x =
                Number(bbox.x);

            const y =
                Number(bbox.y);

            const width =
                Number(bbox.width);

            const height =
                Number(bbox.height);


            if (
                [
                    x,
                    y,
                    width,
                    height
                ].every(
                    Number.isFinite
                )
            ) {

                return [
                    x,
                    y,
                    x + width,
                    y + height
                ];
            }
        }


        /*
         * Nested coordinates.
         */

        if (
            typeof bbox === "object" &&
            bbox.coordinates
        ) {

            return this.normalizeBoundingBox(
                bbox.coordinates
            );
        }


        return null;
    }


    /* ========================================================
       DATA URL → BLOB
       ======================================================== */

    dataUrlToBlob(
        dataUrl
    ) {

        const parts =
            dataUrl.split(",");


        if (parts.length !== 2) {

            throw new Error(
                "Invalid data URL."
            );
        }


        const header =
            parts[0];

        const data =
            parts[1];


        const mimeMatch =
            header.match(
                /data:([^;]+)/
            );


        const mimeType =
            mimeMatch
                ? mimeMatch[1]
                : "application/octet-stream";


        const isBase64 =
            header.includes(
                ";base64"
            );


        const byteString =
            isBase64
                ? atob(data)
                : decodeURIComponent(data);


        const arrayBuffer =
            new Uint8Array(
                byteString.length
            );


        for (
            let i = 0;
            i < byteString.length;
            i++
        ) {

            arrayBuffer[i] =
                byteString.charCodeAt(i);
        }


        return new Blob(
            [arrayBuffer],
            {
                type: mimeType
            }
        );
    }


    /* ========================================================
       SET BASE URL
       ======================================================== */

    setBaseUrl(
        baseUrl
    ) {

        if (
            typeof baseUrl !== "string" ||
            !baseUrl.trim()
        ) {

            throw new Error(
                "Invalid API base URL."
            );
        }


        this.baseUrl =
            baseUrl.replace(
                /\/+$/,
                ""
            );
    }


    /* ========================================================
       GET BASE URL
       ======================================================== */

    getBaseUrl() {

        return this.baseUrl;
    }
}


/* ============================================================
   CUSTOM API ERROR
   ============================================================ */

class APIError extends Error {

    constructor(
        message,
        status = 0,
        details = null
    ) {

        super(message);

        this.name =
            "APIError";

        this.status =
            status;

        this.details =
            details;
    }
}


/* ============================================================
   GLOBAL INSTANCE
   ============================================================ */

const darkPatternAPI =
    new DarkPatternAPI();


/* ============================================================
   GLOBAL EXPORTS
   ============================================================ */

window.DarkPatternAPI =
    DarkPatternAPI;

window.APIError =
    APIError;

window.darkPatternAPI =
    darkPatternAPI;


/*
 * Convenient helper:
 */

window.analyzeDarkPattern =
    function (
        formData,
        options = {}
    ) {

        return darkPatternAPI.analyze(
            formData,
            options
        );
    };


console.log(
    "[Dark Pattern Detector] API client loaded."
);
