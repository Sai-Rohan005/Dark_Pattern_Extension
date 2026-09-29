
class AnalysisStatus {
    constructor() {
        this.statusContainer = document.getElementById("analysis-status");
        this.statusTitle = document.getElementById("analysis-status-title");
        this.statusMessage = document.getElementById("analysis-status-message");
        this.spinner = this.statusContainer?.querySelector(".loading-spinner");
    }

    // ------------------------------------------------------------
    // Show analysis status
    // ------------------------------------------------------------

    show(
        title = "Analyzing webpage...",
        message = "Please wait while the AI analyzes the page."
    ) {
        if (!this.statusContainer) return;

        this.statusContainer.classList.remove("hidden");

        if (this.statusTitle) {
            this.statusTitle.textContent = title;
        }

        if (this.statusMessage) {
            this.statusMessage.textContent = message;
        }

        if (this.spinner) {
            this.spinner.style.display = "block";
        }
    }

    // ------------------------------------------------------------
    // Update current status
    // ------------------------------------------------------------

    update(title, message) {
        if (title && this.statusTitle) {
            this.statusTitle.textContent = title;
        }

        if (message && this.statusMessage) {
            this.statusMessage.textContent = message;
        }
    }

    // ------------------------------------------------------------
    // Hide status
    // ------------------------------------------------------------

    hide() {
        if (!this.statusContainer) return;

        this.statusContainer.classList.add("hidden");
    }

    // ------------------------------------------------------------
    // Check visibility
    // ------------------------------------------------------------

    isVisible() {
        return (
            this.statusContainer &&
            !this.statusContainer.classList.contains("hidden")
        );
    }

    // ------------------------------------------------------------
    // Analysis pipeline steps
    // ------------------------------------------------------------

    setStep(step) {
        const steps = {
            preparing: {
                title: "Preparing analysis...",
                message: "Preparing the webpage for analysis."
            },

            capturing: {
                title: "Capturing webpage...",
                message: "Taking a screenshot of the webpage."
            },

            uploading: {
                title: "Uploading image...",
                message: "Sending the webpage image to the AI backend."
            },

            detecting: {
                title: "Detecting UI elements...",
                message:
                    "Finding buttons, text, images, and other UI components."
            },

            ocr: {
                title: "Reading webpage text...",
                message:
                    "Extracting visible text using OCR."
            },

            analyzing: {
                title: "Analyzing dark patterns...",
                message:
                    "The AI is checking the webpage for potentially manipulative patterns."
            },

            finalizing: {
                title: "Finalizing results...",
                message:
                    "Preparing the analysis results."
            }
        };

        const currentStep = steps[step];

        if (!currentStep) {
            console.warn(`Unknown analysis step: ${step}`);
            return;
        }

        this.show(
            currentStep.title,
            currentStep.message
        );
    }

    // ------------------------------------------------------------
    // Show error
    // ------------------------------------------------------------

    showError(
        message = "An error occurred during analysis."
    ) {
        if (!this.statusContainer) return;

        this.statusContainer.classList.remove("hidden");

        if (this.statusTitle) {
            this.statusTitle.textContent = "Analysis failed";
        }

        if (this.statusMessage) {
            this.statusMessage.textContent = message;
        }

        if (this.spinner) {
            this.spinner.style.display = "none";
        }
    }

    // ------------------------------------------------------------
    // Reset status
    // ------------------------------------------------------------

    reset() {
        if (!this.statusContainer) return;

        this.statusContainer.classList.add("hidden");

        if (this.statusTitle) {
            this.statusTitle.textContent =
                "Analyzing webpage...";
        }

        if (this.statusMessage) {
            this.statusMessage.textContent =
                "Please wait while the AI analyzes the page.";
        }

        if (this.spinner) {
            this.spinner.style.display = "block";
        }
    }
}

// ------------------------------------------------------------
// Create global instance
// ------------------------------------------------------------

const analysisStatus = new AnalysisStatus();

// Make class and instance available to sidepanel.js
window.AnalysisStatus = AnalysisStatus;
window.analysisStatus = analysisStatus;
