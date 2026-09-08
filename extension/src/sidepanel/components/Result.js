
class Result {
    constructor(options = {}) {
        this.resultsSectionId =
            options.resultsSectionId || "results-section";

        this.resultsContainerId =
            options.resultsContainerId || "results-container";

        this.noResultsId =
            options.noResultsId || "no-results";

        this.resultCountId =
            options.resultCountId || "result-count";

        this.resultsSection = null;
        this.resultsContainer = null;
        this.noResults = null;
        this.resultCount = null;

        this.detections = [];
        this.analysisData = null;

        this.onViewAnalysis =
            options.onViewAnalysis || null;

        this.initialize();
    }

    // ------------------------------------------------------------
    // Initialize
    // ------------------------------------------------------------

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
                `Result: Element "${this.resultsContainerId}" not found.`
            );
        }
    }

    // ------------------------------------------------------------
    // Display analysis result
    // ------------------------------------------------------------

    show(data) {

        console.log(
            "[Result] ========================================"
        );

        console.log(
            "[Result] Data received:",
            data
        );

        console.log(
            "[Result] Data type:",
            typeof data
        );

        console.log(
            "[Result] Data keys:",
            data && typeof data === "object"
                ? Object.keys(data)
                : []
        );

        console.log(
            "[Result] dark_pattern_detected:",
            data?.dark_pattern_detected
        );

        console.log(
            "[Result] detections:",
            data?.detections
        );

        console.log(
            "[Result] detections is array:",
            Array.isArray(data?.detections)
        );

        console.log(
            "[Result] detections count:",
            Array.isArray(data?.detections)
                ? data.detections.length
                : 0
        );

        console.log(
            "[Result] ========================================"
        );


        if (!data) {

            this.showError(
                "No analysis result was received."
            );

            return;
        }


        this.analysisData = data;


        const detections =
            Array.isArray(data.detections)
                ? data.detections
                : [];


        this.detections =
            detections;


        this.updateCount(
            detections.length
        );


        const darkPatternDetected =
            data.dark_pattern_detected === true ||
            detections.length > 0;


        console.log(
            "[Result] FINAL darkPatternDetected:",
            darkPatternDetected
        );


        console.log(
            "[Result] FINAL detection count:",
            detections.length
        );


        if (
            darkPatternDetected &&
            detections.length > 0
        ) {

            console.log(
                "[Result] Showing detections"
            );

            this.showDetections(
                detections
            );

        } else {

            console.log(
                "[Result] Showing NO RESULTS"
            );

            this.showNoResults();
        }


        this.showSection();
    }

    // ------------------------------------------------------------
    // Show detections
    // ------------------------------------------------------------

    showDetections(detections) {
        if (!this.resultsContainer) return;

        this.resultsContainer.innerHTML = "";

        if (this.noResults) {
            this.noResults.classList.add("hidden");
        }

        detections.forEach(
            (detection, index) => {
                const card =
                    new DetectionCard(
                        detection,
                        {
                            onViewAnalysis:
                                (selectedDetection) => {
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
                    this.resultsContainer.appendChild(
                        element
                    );
                }
            }
        );
    }

    // ------------------------------------------------------------
    // Show no dark patterns
    // ------------------------------------------------------------

    showNoResults() {
        if (this.resultsContainer) {
            this.resultsContainer.innerHTML = "";
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
                this.noResults.querySelector("h3");

            const message =
                this.noResults.querySelector("p");

            if (icon) {
                icon.textContent = "🛡️";
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

        this.updateCount(0);
    }

    // ------------------------------------------------------------
    // Show error
    // ------------------------------------------------------------

    showError(message) {
        if (this.resultsContainer) {
            this.resultsContainer.innerHTML = "";
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
                this.noResults.querySelector("h3");

            const messageElement =
                this.noResults.querySelector("p");

            if (icon) {
                icon.textContent = "⚠️";
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

        this.updateCount(0);
        this.showSection();
    }

    // ------------------------------------------------------------
    // Update detection count
    // ------------------------------------------------------------

    updateCount(count) {
        if (!this.resultCount) return;

        const safeCount =
            Number.isFinite(Number(count))
                ? Math.max(
                    0,
                    Number(count)
                )
                : 0;

        this.resultCount.textContent =
            safeCount;

        this.resultCount.classList.toggle(
            "has-results",
            safeCount > 0
        );
    }

    // ------------------------------------------------------------
    // Handle View Analysis
    // ------------------------------------------------------------

    handleViewAnalysis(
        detection,
        index
    ) {
        if (
            typeof this.onViewAnalysis ===
            "function"
        ) {
            this.onViewAnalysis(
                detection,
                index,
                this.analysisData
            );

            return;
        }

        console.warn(
            "Result: No onViewAnalysis callback provided."
        );
    }

    // ------------------------------------------------------------
    // Get detections
    // ------------------------------------------------------------

    getDetections() {
        return this.detections;
    }

    // ------------------------------------------------------------
    // Get analysis data
    // ------------------------------------------------------------

    getAnalysisData() {
        return this.analysisData;
    }

    // ------------------------------------------------------------
    // Get detection count
    // ------------------------------------------------------------

    getCount() {
        return this.detections.length;
    }

    // ------------------------------------------------------------
    // Check whether dark pattern exists
    // ------------------------------------------------------------

    hasDarkPatterns() {
        return (
            this.detections.length > 0
        );
    }

    // ------------------------------------------------------------
    // Clear results
    // ------------------------------------------------------------

    clear() {
        this.detections = [];
        this.analysisData = null;

        if (this.resultsContainer) {
            this.resultsContainer.innerHTML = "";
        }

        this.updateCount(0);

        if (this.noResults) {
            this.noResults.classList.remove(
                "hidden"
            );

            const icon =
                this.noResults.querySelector(
                    ".empty-icon"
                );

            const title =
                this.noResults.querySelector("h3");

            const message =
                this.noResults.querySelector("p");

            if (icon) {
                icon.textContent = "🛡️";
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

    // ------------------------------------------------------------
    // Show results section
    // ------------------------------------------------------------

    showSection() {
        if (!this.resultsSection) return;

        this.resultsSection.classList.remove(
            "hidden"
        );
    }

    // ------------------------------------------------------------
    // Hide results section
    // ------------------------------------------------------------

    hideSection() {
        if (!this.resultsSection) return;

        this.resultsSection.classList.add(
            "hidden"
        );
    }

    // ------------------------------------------------------------
    // Render a single detection
    // ------------------------------------------------------------

    addDetection(detection) {
        if (!detection) return;

        this.detections.push(
            detection
        );

        this.updateCount(
            this.detections.length
        );

        if (this.noResults) {
            this.noResults.classList.add(
                "hidden"
            );
        }

        if (!this.resultsContainer) return;

        const index =
            this.detections.length - 1;

        const card =
            new DetectionCard(
                detection,
                {
                    onViewAnalysis:
                        (selectedDetection) => {
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
            this.resultsContainer.appendChild(
                element
            );
        }
    }
}

// ------------------------------------------------------------
// Create global instance
// ------------------------------------------------------------

const result = new Result();

window.Result = Result;
window.result = result;
