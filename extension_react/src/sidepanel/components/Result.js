
// ============================================================
// DARK PATTERN DETECTOR
// Result UI Component
//
// File:
// extension/src/components/result.js
//
// Handles backend responses such as:
//
// {
//     prediction: 1,
//     visualization: {
//         generated: true,
//         image: "..."
//     }
// }
//
// OR:
//
// {
//     prediction: 0
// }
//
// OR:
//
// {
//     dark_pattern_detected: true,
//     detections: [...]
// }
//
// ============================================================

"use strict";


class Result {

    constructor(options = {}) {

        // ----------------------------------------------------
        // DOM IDs
        // ----------------------------------------------------

        this.resultsSectionId =
            options.resultsSectionId ||
            "results-section";

        this.resultsContainerId =
            options.resultsContainerId ||
            "results-container";

        this.noResultsId =
            options.noResultsId ||
            "no-results";

        this.resultCountId =
            options.resultCountId ||
            "result-count";


        // ----------------------------------------------------
        // DOM references
        // ----------------------------------------------------

        this.resultsSection = null;

        this.resultsContainer = null;

        this.noResults = null;

        this.resultCount = null;


        // ----------------------------------------------------
        // Data
        // ----------------------------------------------------

        this.detections = [];

        this.analysisData = null;


        // ----------------------------------------------------
        // Analysis modal
        // ----------------------------------------------------

        this.analysisModalEscapeHandler = null;


        // ----------------------------------------------------
        // Callback
        // ----------------------------------------------------

        this.onViewAnalysis =
            options.onViewAnalysis ||
            null;


        // ----------------------------------------------------
        // Initialize
        // ----------------------------------------------------

        this.initialize();
    }


    // ========================================================
    // INITIALIZE
    // ========================================================

    initialize() {

        this.resultsSection =
            document.getElementById(
                this.resultsSectionId
            );


        this.resultsContainer =
            document.getElementById(
                this.resultsContainerId
            );


        this.noResults =
            document.getElementById(
                this.noResultsId
            );


        this.resultCount =
            document.getElementById(
                this.resultCountId
            );


        if (!this.resultsContainer) {

            console.warn(
                `[Result] Element "${this.resultsContainerId}" not found.`
            );
        }


        if (!this.noResults) {

            console.warn(
                `[Result] Element "${this.noResultsId}" not found.`
            );
        }


        if (!this.resultCount) {

            console.warn(
                `[Result] Element "${this.resultCountId}" not found.`
            );
        }
    }


    // ========================================================
    // SHOW ANALYSIS RESULT
    // ========================================================

    show(data) {

        console.log(
            "[Result] ========================================"
        );

        console.log(
            "[Result] Showing analysis result"
        );

        console.log(
            "[Result] Data received:",
            data
        );


        // ----------------------------------------------------
        // Validate response
        // ----------------------------------------------------

        if (
            !data ||
            typeof data !== "object"
        ) {

            console.error(
                "[Result] Invalid analysis data:",
                data
            );

            this.showError(
                "No analysis result was received."
            );

            return;
        }


        // ----------------------------------------------------
        // Store original response
        // ----------------------------------------------------

        this.analysisData =
            data;


        console.log(
            "[Result] Data keys:",
            Object.keys(data)
        );


        console.log(
            "[Result] prediction:",
            data.prediction
        );


        console.log(
            "[Result] dark_pattern_detected:",
            data.dark_pattern_detected
        );


        console.log(
            "[Result] detections:",
            data.detections
        );


        // ====================================================
        // NORMALIZE DETECTIONS
        // ====================================================

        let detections = [];


        if (
            Array.isArray(
                data.detections
            )
        ) {

            detections =
                data.detections
                    .filter(
                        detection =>
                            detection &&
                            typeof detection ===
                                "object"
                    );
        }


        // ====================================================
        // DETERMINE DARK PATTERN STATE
        // ====================================================

        const prediction =
            Number(
                data.prediction
            );


        let darkPatternDetected;


        // ----------------------------------------------------
        // Highest priority:
        //
        // prediction = 1
        // prediction = 0
        // ----------------------------------------------------

        if (
            prediction === 1
        ) {

            darkPatternDetected =
                true;

        } else if (
            prediction === 0
        ) {

            darkPatternDetected =
                false;
        }


        // ----------------------------------------------------
        // Backend boolean
        // ----------------------------------------------------

        else if (
            data.dark_pattern_detected ===
            true
        ) {

            darkPatternDetected =
                true;

        } else if (
            data.dark_pattern_detected ===
            false
        ) {

            darkPatternDetected =
                false;
        }


        // ----------------------------------------------------
        // Existing detections
        // ----------------------------------------------------

        else {

            darkPatternDetected =
                detections.length > 0;
        }


        // ====================================================
        // CREATE UI-LEVEL DETECTION
        //
        // If prediction=1 but backend didn't send a
        // detections array, create a UI-level detection.
        // ====================================================

        if (
            darkPatternDetected &&
            detections.length === 0
        ) {

            console.log(
                "[Result] Prediction indicates a dark pattern."
            );

            console.log(
                "[Result] No detection objects were returned."
            );

            console.log(
                "[Result] Creating UI-level detection."
            );


            detections.push({

                type:
                    data.pattern_type ||
                    data.patternType ||
                    data.pattern ||
                    data.label ||
                    "Dark Pattern",


                confidence:
                    this.normalizeConfidence(
                        data.confidence ??
                        data.score ??
                        1
                    ),


                prediction:
                    prediction === 1
                        ? 1
                        : undefined,


                bbox:
                    null,


                source:
                    "prediction"
            });
        }


        // ----------------------------------------------------
        // Save normalized detections
        // ----------------------------------------------------

        this.detections =
            detections;


        // ----------------------------------------------------
        // Final state
        // ----------------------------------------------------

        const finalDarkPatternDetected =
            darkPatternDetected ||
            this.detections.length > 0;


        console.log(
            "[Result] ----------------------------------------"
        );

        console.log(
            "[Result] Prediction:",
            prediction
        );

        console.log(
            "[Result] Final dark pattern detected:",
            finalDarkPatternDetected
        );

        console.log(
            "[Result] Final detection count:",
            this.detections.length
        );

        console.log(
            "[Result] Final detections:",
            this.detections
        );

        console.log(
            "[Result] ----------------------------------------"
        );


        // ----------------------------------------------------
        // Update count
        // ----------------------------------------------------

        this.updateCount(
            this.detections.length
        );


        // ====================================================
        // DISPLAY
        // ====================================================

        if (
            finalDarkPatternDetected &&
            this.detections.length > 0
        ) {

            console.log(
                "[Result] Rendering detection cards."
            );


            this.showDetections(
                this.detections
            );

        } else {

            console.log(
                "[Result] Rendering no-results state."
            );


            this.showNoResults();
        }


        // ----------------------------------------------------
        // Make section visible
        // ----------------------------------------------------

        this.showSection();


        console.log(
            "[Result] ========================================"
        );
    }


    // ========================================================
    // SHOW DETECTIONS
    // ========================================================

    showDetections(detections) {

        if (!this.resultsContainer) {

            console.warn(
                "[Result] Results container is missing."
            );

            return;
        }


        // ----------------------------------------------------
        // Clear old content
        // ----------------------------------------------------

        this.resultsContainer.innerHTML =
            "";


        // ----------------------------------------------------
        // Hide no-results message
        // ----------------------------------------------------

        if (this.noResults) {

            this.noResults.classList.add(
                "hidden"
            );
        }


        // ----------------------------------------------------
        // Render cards
        // ----------------------------------------------------

        detections.forEach(
            (detection, index) => {

                try {

                    if (
                        typeof DetectionCard !==
                        "function"
                    ) {

                        console.error(
                            "[Result] DetectionCard class is not available."
                        );

                        return;
                    }


                    const card =
                        new DetectionCard(
                            detection,
                            {

                                onViewAnalysis:
                                    (
                                        selectedDetection
                                    ) => {

                                        this.handleViewAnalysis(
                                            selectedDetection,
                                            index
                                        );
                                    }
                            }
                        );


                    const element =
                        card.render();


                    if (element) {

                        this.resultsContainer
                            .appendChild(
                                element
                            );

                    } else {

                        console.warn(
                            "[Result] DetectionCard.render() returned no element."
                        );
                    }

                } catch (error) {

                    console.error(
                        "[Result] Failed to render detection card:",
                        error,
                        detection
                    );
                }
            }
        );


        // ----------------------------------------------------
        // Make sure count remains correct
        // ----------------------------------------------------

        this.updateCount(
            detections.length
        );
    }


    // ========================================================
    // SHOW NO RESULTS
    // ========================================================

    showNoResults() {

        if (this.resultsContainer) {

            this.resultsContainer.innerHTML =
                "";
        }


        if (this.noResults) {

            this.noResults.classList.remove(
                "hidden"
            );


            const icon =
                this.noResults.querySelector(
                    ".empty-icon"
                );


            const title =
                this.noResults.querySelector(
                    "h3"
                );


            const message =
                this.noResults.querySelector(
                    "p"
                );


            if (icon) {

                icon.textContent =
                    "🛡️";
            }


            if (title) {

                title.textContent =
                    "No dark patterns detected";
            }


            if (message) {

                message.textContent =
                    "The AI did not identify any potentially manipulative design patterns.";
            }
        }


        // ----------------------------------------------------
        // No detections means zero
        // ----------------------------------------------------

        this.updateCount(
            0
        );
    }


    // ========================================================
    // SHOW ERROR
    // ========================================================

    showError(message) {

        if (this.resultsContainer) {

            this.resultsContainer.innerHTML =
                "";
        }


        if (this.noResults) {

            this.noResults.classList.remove(
                "hidden"
            );


            const icon =
                this.noResults.querySelector(
                    ".empty-icon"
                );


            const title =
                this.noResults.querySelector(
                    "h3"
                );


            const messageElement =
                this.noResults.querySelector(
                    "p"
                );


            if (icon) {

                icon.textContent =
                    "⚠️";
            }


            if (title) {

                title.textContent =
                    "Analysis unavailable";
            }


            if (messageElement) {

                messageElement.textContent =
                    message ||
                    "Unable to display the analysis result.";
            }
        }


        this.updateCount(
            0
        );


        this.showSection();
    }


    // ========================================================
    // UPDATE COUNT
    // ========================================================

    updateCount(count) {

        if (!this.resultCount) {
            return;
        }


        const numericCount =
            Number(count);


        const safeCount =
            Number.isFinite(
                numericCount
            )
                ? Math.max(
                    0,
                    numericCount
                )
                : 0;


        this.resultCount.textContent =
            safeCount;


        this.resultCount.classList.toggle(
            "has-results",
            safeCount > 0
        );
    }


    // ========================================================
    // HANDLE VIEW ANALYSIS
    //
    // Called by the dynamically created DetectionCard
    // when the user clicks "View Analysis".
    // ========================================================

    handleViewAnalysis(
        detection,
        index
    ) {

        console.log(
            "[Result] ========================================"
        );

        console.log(
            "[Result] View Analysis clicked"
        );

        console.log(
            "[Result] Detection:",
            detection
        );

        console.log(
            "[Result] Detection index:",
            index
        );

        console.log(
            "[Result] Full analysis data:",
            this.analysisData
        );


        // ----------------------------------------------------
        // Open popup
        // ----------------------------------------------------

        this.showAnalysisModal(
            detection,
            index
        );


        // ----------------------------------------------------
        // Preserve existing callback
        // ----------------------------------------------------

        if (
            typeof this.onViewAnalysis ===
            "function"
        ) {

            this.onViewAnalysis(
                detection,
                index,
                this.analysisData
            );
        }


        console.log(
            "[Result] ========================================"
        );
    }


    // ========================================================
    // SHOW ANALYSIS MODAL
    //
    // The modal is dynamically created here.
    // No static HTML is required.
    // ========================================================

    
    showAnalysisModal(detection,index){

        console.log(
            "[Result] Creating analysis popup."
        );


        // ----------------------------------------------------
        // Remove existing modal
        // ----------------------------------------------------

        this.closeAnalysisModal();


        // ----------------------------------------------------
        // Detection information
        // ----------------------------------------------------

        const type =
            detection?.type ||
            detection?.label ||
            detection?.pattern_type ||
            detection?.pattern ||
            "Dark Pattern";


        const confidence =
            this.normalizeConfidence(
                detection?.confidence ??
                detection?.score ??
                0
            );


        const source =
            detection?.source ||
            "model";


        // ----------------------------------------------------
        // Create modal
        // ----------------------------------------------------

        const modal =
            document.createElement(
                "div"
            );


        modal.id =
            "dark-pattern-analysis-modal";


        modal.className =
            "analysis-modal";


        // ----------------------------------------------------
        // Create overlay
        // ----------------------------------------------------

        const overlay =
            document.createElement(
                "div"
            );


        overlay.className =
            "analysis-modal-overlay";


        // ----------------------------------------------------
        // Create modal content
        // ----------------------------------------------------

        const content =
            document.createElement(
                "div"
            );


        content.className =
            "analysis-modal-content";


        // ----------------------------------------------------
        // Close button
        // ----------------------------------------------------

        const closeButton =
            document.createElement(
                "button"
            );


        closeButton.type =
            "button";


        closeButton.className =
            "analysis-modal-close";


        closeButton.setAttribute(
            "aria-label",
            "Close analysis"
        );


        closeButton.innerHTML =
            "&times;";


        // ----------------------------------------------------
        // Header
        // ----------------------------------------------------

        const header =
            document.createElement(
                "div"
            );


        header.className =
            "analysis-modal-header";


        const title =
            document.createElement(
                "h2"
            );


        title.textContent =
            "Dark Pattern Analysis";


        header.appendChild(
            title
        );


        // ----------------------------------------------------
        // Body
        // ----------------------------------------------------

        const body =
            document.createElement(
                "div"
            );


        body.className =
            "analysis-modal-body";


        // ====================================================
        // DETECTION DETAILS
        // ====================================================

        const detectionSection =
            document.createElement(
                "div"
            );


        detectionSection.className =
            "analysis-info-section";


        detectionSection.innerHTML = `

            <h3>
                Detection Details
            </h3>

            <div class="analysis-info-row">

                <span class="analysis-label">
                    Pattern
                </span>

                <span class="analysis-value">
                    ${this.escapeHtml(type)}
                </span>

            </div>


            <div class="analysis-info-row">

                <span class="analysis-label">
                    Confidence
                </span>

                <span class="analysis-value analysis-confidence">
                    ${confidence.toFixed(1)}%
                </span>

            </div>


            <div class="analysis-info-row">

                <span class="analysis-label">
                    Detection
                </span>

                <span class="analysis-value">
                    #${Number(index) + 1}
                </span>

            </div>


            <div class="analysis-info-row">

                <span class="analysis-label">
                    Source
                </span>

                <span class="analysis-value">
                    ${this.escapeHtml(source)}
                </span>

            </div>

        `;


        body.appendChild(
            detectionSection
        );


        // ====================================================
        // BOUNDING BOX
        // ====================================================

        if (
            detection &&
            detection.bbox
        ) {

            const bboxSection =
                document.createElement(
                    "div"
                );


            bboxSection.className =
                "analysis-info-section";


            const bboxHeading =
                document.createElement(
                    "h3"
                );


            bboxHeading.textContent =
                "Detection Location";


            bboxSection.appendChild(
                bboxHeading
            );


            const bboxRow =
                document.createElement(
                    "div"
                );


            bboxRow.className =
                "analysis-info-row";


            const bboxLabel =
                document.createElement(
                    "span"
                );


            bboxLabel.className =
                "analysis-label";


            bboxLabel.textContent =
                "Bounding Box";


            const bboxValue =
                document.createElement(
                    "span"
                );


            bboxValue.className =
                "analysis-value";


            bboxValue.textContent =
                JSON.stringify(
                    detection.bbox
                );


            bboxRow.appendChild(
                bboxLabel
            );


            bboxRow.appendChild(
                bboxValue
            );


            bboxSection.appendChild(
                bboxRow
            );


            body.appendChild(
                bboxSection
            );
        }


        // ====================================================
        // MODEL ANALYSIS
        // ====================================================

        if (
            this.analysisData
        ) {

            const modelSection =
                document.createElement(
                    "div"
                );


            modelSection.className =
                "analysis-info-section";


            const modelHeading =
                document.createElement(
                    "h3"
                );


            modelHeading.textContent =
                "Model Analysis";


            modelSection.appendChild(
                modelHeading
            );


            // ------------------------------------------------
            // Prediction
            // ------------------------------------------------

            const predictionRow =
                document.createElement(
                    "div"
                );


            predictionRow.className =
                "analysis-info-row";


            const predictionLabel =
                document.createElement(
                    "span"
                );


            predictionLabel.className =
                "analysis-label";


            predictionLabel.textContent =
                "Prediction";


            const predictionValue =
                document.createElement(
                    "span"
                );


            predictionValue.className =
                "analysis-value";


            const modelPrediction =
                Number(
                    this.analysisData.prediction
                );


            if (
                modelPrediction === 1
            ) {

                predictionValue.textContent =
                    "Dark Pattern Detected";

            } else if (
                modelPrediction === 0
            ) {

                predictionValue.textContent =
                    "No Dark Pattern";

            } else if (
                this.analysisData
                    .dark_pattern_detected ===
                true
            ) {

                predictionValue.textContent =
                    "Dark Pattern Detected";

            } else {

                predictionValue.textContent =
                    "Unknown";
            }


            predictionRow.appendChild(
                predictionLabel
            );


            predictionRow.appendChild(
                predictionValue
            );


            modelSection.appendChild(
                predictionRow
            );


            // ------------------------------------------------
            // Backend dark_pattern_detected
            // ------------------------------------------------

            if (
                typeof this.analysisData
                    .dark_pattern_detected !==
                "undefined"
            ) {

                const detectedRow =
                    document.createElement(
                        "div"
                    );


                detectedRow.className =
                    "analysis-info-row";


                const detectedLabel =
                    document.createElement(
                        "span"
                    );


                detectedLabel.className =
                    "analysis-label";


                detectedLabel.textContent =
                    "Dark Pattern Detected";


                const detectedValue =
                    document.createElement(
                        "span"
                    );


                detectedValue.className =
                    "analysis-value";


                detectedValue.textContent =
                    this.analysisData
                        .dark_pattern_detected
                        ? "Yes"
                        : "No";


                detectedRow.appendChild(
                    detectedLabel
                );


                detectedRow.appendChild(
                    detectedValue
                );


                modelSection.appendChild(
                    detectedRow
                );
            }


            body.appendChild(
                modelSection
            );
        }


        // ====================================================
        // VISUALIZATION
        // ====================================================

        const visualization =
            this.analysisData?.visualization;


        console.log(
            "[Result] Visualization data:",
            visualization
        );


        if (
            visualization &&
            visualization.generated === true &&
            visualization.image
        ) {

            const visualizationSection =
                document.createElement(
                    "div"
                );


            visualizationSection.className =
                "analysis-info-section";


            const visualizationHeading =
                document.createElement(
                    "h3"
                );


            visualizationHeading.textContent =
                "Visualization";


            visualizationSection.appendChild(
                visualizationHeading
            );


            const image =
                document.createElement(
                    "img"
                );


            image.className =
                "analysis-visualization";


            image.alt =
                "Dark pattern detection visualization";


            try {

                // ------------------------------------------------
                // Get base64 image
                // ------------------------------------------------

                let base64 =
                    visualization.image;


                // ------------------------------------------------
                // Support both:
                //
                // "iVBORw0KGgo..."
                //
                // and:
                //
                // "data:image/png;base64,iVBORw0KGgo..."
                // ------------------------------------------------

                let contentType =
                    visualization.content_type ||
                    visualization.contentType ||
                    "image/png";


                if (
                    base64.startsWith(
                        "data:"
                    )
                ) {

                    const commaIndex =
                        base64.indexOf(",");


                    if (
                        commaIndex !== -1
                    ) {

                        const headerPart =
                            base64.substring(
                                0,
                                commaIndex
                            );


                        const base64Part =
                            base64.substring(
                                commaIndex + 1
                            );


                        base64 =
                            base64Part;


                        const mimeMatch =
                            headerPart.match(
                                /data:([^;]+);base64/
                            );


                        if (
                            mimeMatch &&
                            mimeMatch[1]
                        ) {

                            contentType =
                                mimeMatch[1];
                        }
                    }
                }


                // ------------------------------------------------
                // Remove whitespace/newlines
                // ------------------------------------------------

                base64 =
                    base64.replace(
                        /\s/g,
                        ""
                    );


                // ------------------------------------------------
                // Base64 → Binary
                // ------------------------------------------------

                const byteCharacters =
                    atob(base64);


                const byteNumbers =
                    new Uint8Array(
                        byteCharacters.length
                    );


                for (
                    let i = 0;
                    i < byteCharacters.length;
                    i++
                ) {

                    byteNumbers[i] =
                        byteCharacters.charCodeAt(i);
                }


                // ------------------------------------------------
                // Binary → Blob
                // ------------------------------------------------

                const blob =
                    new Blob(
                        [
                            byteNumbers
                        ],
                        {
                            type: contentType
                        }
                    );


                console.log(
                    "[Result] Visualization blob created:",
                    {
                        size: blob.size,
                        type: blob.type
                    }
                );


                // ------------------------------------------------
                // Blob → Object URL
                // ------------------------------------------------

                const imageUrl =
                    URL.createObjectURL(
                        blob
                    );


                console.log(
                    "[Result] Visualization object URL created:",
                    imageUrl
                );


                // ------------------------------------------------
                // Set image source
                // ------------------------------------------------

                image.src =
                    imageUrl;


                // ------------------------------------------------
                // Cleanup Blob URL when image is
                // removed / modal is closed
                // ------------------------------------------------

                image.addEventListener(
                    "load",
                    () => {

                        console.log(
                            "[Result] Visualization image loaded successfully."
                        );

                    },
                    {
                        once: true
                    }
                );


                image.addEventListener(
                    "error",
                    () => {

                        console.error(
                            "[Result] Visualization image failed to load."
                        );


                        URL.revokeObjectURL(
                            imageUrl
                        );

                    },
                    {
                        once: true
                    }
                );


                visualizationSection.appendChild(
                    image
                );


            } catch (error) {

                console.error(
                    "[Result] Failed to decode visualization:",
                    error
                );


                const errorMessage =
                    document.createElement(
                        "p"
                    );


                errorMessage.className =
                    "analysis-visualization-error";


                errorMessage.textContent =
                    "Unable to display the visualization image.";


                visualizationSection.appendChild(
                    errorMessage
                );
            }


            body.appendChild(
                visualizationSection
            );


        } else {

            console.log(
                "[Result] No visualization available."
            );
        }


        // ====================================================
        // APPEND EVERYTHING
        // ====================================================

        content.appendChild(
            closeButton
        );


        content.appendChild(
            header
        );


        content.appendChild(
            body
        );


        modal.appendChild(
            overlay
        );


        modal.appendChild(
            content
        );


        document.body.appendChild(
            modal
        );


        // ====================================================
        // CLOSE BUTTON EVENT
        // ====================================================

        closeButton.addEventListener(
            "click",
            () => {

                this.closeAnalysisModal();

            }
        );


        // ====================================================
        // OVERLAY CLICK
        // ====================================================

        overlay.addEventListener(
            "click",
            () => {

                this.closeAnalysisModal();

            }
        );


        // ====================================================
        // ESCAPE KEY
        // ====================================================

        this.analysisModalEscapeHandler =
            (event) => {

                if (
                    event.key ===
                    "Escape"
                ) {

                    this.closeAnalysisModal();

                }
            };


        document.addEventListener(
            "keydown",
            this.analysisModalEscapeHandler
        );


        console.log(
            "[Result] Analysis popup opened."
        );
    }


    

    closeAnalysisModal() {

        const modal =
            document.getElementById(
                "dark-pattern-analysis-modal"
            );


        if (modal) {

            modal.remove();

        }


        // ----------------------------------------------------
        // Revoke visualization Blob URL
        // ----------------------------------------------------

        if (
            this.analysisVisualizationUrl
        ) {

            URL.revokeObjectURL(
                this.analysisVisualizationUrl
            );

            this.analysisVisualizationUrl =
                null;
        }


        // ----------------------------------------------------
        // Remove Escape listener
        // ----------------------------------------------------

        if (
            this.analysisModalEscapeHandler
        ) {

            document.removeEventListener(
                "keydown",
                this.analysisModalEscapeHandler
            );

            this.analysisModalEscapeHandler =
                null;
        }
    }



    // ========================================================
    // CLOSE ANALYSIS MODAL
    // ========================================================

    closeAnalysisModal() {

        const modal =
            document.getElementById(
                "dark-pattern-analysis-modal"
            );


        if (modal) {

            modal.remove();

            console.log(
                "[Result] Analysis popup closed."
            );
        }


        // ----------------------------------------------------
        // Remove Escape listener
        // ----------------------------------------------------

        if (
            this.analysisModalEscapeHandler
        ) {

            document.removeEventListener(
                "keydown",
                this.analysisModalEscapeHandler
            );


            this.analysisModalEscapeHandler =
                null;
        }
    }


    // ========================================================
    // GET DETECTIONS
    // ========================================================

    getDetections() {

        return this.detections;
    }


    // ========================================================
    // GET ANALYSIS DATA
    // ========================================================

    getAnalysisData() {

        return this.analysisData;
    }


    // ========================================================
    // GET DETECTION COUNT
    // ========================================================

    getCount() {

        return this.detections.length;
    }


    // ========================================================
    // CHECK DARK PATTERN
    // ========================================================

    hasDarkPatterns() {

        // ----------------------------------------------------
        // Check actual detections first
        // ----------------------------------------------------

        if (
            this.detections.length > 0
        ) {

            return true;
        }


        // ----------------------------------------------------
        // Also check backend prediction
        // ----------------------------------------------------

        if (
            this.analysisData
        ) {

            return Number(
                this.analysisData.prediction
            ) === 1 ||
            this.analysisData
                .dark_pattern_detected ===
            true;
        }


        return false;
    }


    // ========================================================
    // CLEAR RESULTS
    // ========================================================

    clear() {

        // ----------------------------------------------------
        // Close popup if open
        // ----------------------------------------------------

        this.closeAnalysisModal();


        // ----------------------------------------------------
        // Clear data
        // ----------------------------------------------------

        this.detections = [];

        this.analysisData = null;


        // ----------------------------------------------------
        // Clear result cards
        // ----------------------------------------------------

        if (this.resultsContainer) {

            this.resultsContainer.innerHTML =
                "";
        }


        // ----------------------------------------------------
        // Reset count
        // ----------------------------------------------------

        this.updateCount(
            0
        );


        // ----------------------------------------------------
        // Reset empty state
        // ----------------------------------------------------

        if (this.noResults) {

            this.noResults.classList.remove(
                "hidden"
            );


            const icon =
                this.noResults.querySelector(
                    ".empty-icon"
                );


            const title =
                this.noResults.querySelector(
                    "h3"
                );


            const message =
                this.noResults.querySelector(
                    "p"
                );


            if (icon) {

                icon.textContent =
                    "🛡️";
            }


            if (title) {

                title.textContent =
                    "No analysis yet";
            }


            if (message) {

                message.textContent =
                    "Analyze a webpage to see whether dark patterns are present.";
            }
        }
    }


    // ========================================================
    // SHOW SECTION
    // ========================================================

    showSection() {

        if (!this.resultsSection) {
            return;
        }


        this.resultsSection.classList.remove(
            "hidden"
        );
    }


    // ========================================================
    // HIDE SECTION
    // ========================================================

    hideSection() {

        if (!this.resultsSection) {
            return;
        }


        this.resultsSection.classList.add(
            "hidden"
        );
    }


    // ========================================================
    // ADD SINGLE DETECTION
    // ========================================================

    addDetection(detection) {

        if (!detection) {
            return;
        }


        // ----------------------------------------------------
        // Add detection
        // ----------------------------------------------------

        this.detections.push(
            detection
        );


        // ----------------------------------------------------
        // Update count
        // ----------------------------------------------------

        this.updateCount(
            this.detections.length
        );


        // ----------------------------------------------------
        // Hide empty state
        // ----------------------------------------------------

        if (this.noResults) {

            this.noResults.classList.add(
                "hidden"
            );
        }


        // ----------------------------------------------------
        // Render card
        // ----------------------------------------------------

        if (!this.resultsContainer) {
            return;
        }


        const index =
            this.detections.length - 1;


        try {

            if (
                typeof DetectionCard !==
                "function"
            ) {

                console.error(
                    "[Result] DetectionCard class is not available."
                );

                return;
            }


            const card =
                new DetectionCard(
                    detection,
                    {

                        onViewAnalysis:
                            (
                                selectedDetection
                            ) => {

                                this.handleViewAnalysis(
                                    selectedDetection,
                                    index
                                );
                            }
                    }
                );


            const element =
                card.render();


            if (element) {

                this.resultsContainer
                    .appendChild(
                        element
                    );
            }

        } catch (error) {

            console.error(
                "[Result] Failed to add detection:",
                error
            );
        }
    }


    // ========================================================
    // NORMALIZE CONFIDENCE
    // ========================================================

    normalizeConfidence(value) {

        let confidence =
            Number(value);


        if (
            !Number.isFinite(
                confidence
            )
        ) {

            return 0;
        }


        // ----------------------------------------------------
        // Backend may return:
        //
        // 0.94
        // OR
        // 94
        // ----------------------------------------------------

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


    // ========================================================
    // ESCAPE HTML
    // ========================================================

    escapeHtml(value) {

        const element =
            document.createElement(
                "div"
            );


        element.textContent =
            String(
                value ?? ""
            );


        return element.innerHTML;
    }
}


// ============================================================
// GLOBAL INSTANCE
// ============================================================

const result =
    new Result();


// ============================================================
// GLOBAL EXPORTS
// ============================================================

window.Result =
    Result;

window.result =
    result;


console.log(
    "[Dark Pattern Detector] Result component loaded."
);
