
class AnalyzeButton {
    constructor(buttonId, options = {}) {
        this.button = document.getElementById(buttonId);

        this.defaultText = options.defaultText || "Analyze";
        this.loadingText = options.loadingText || "Analyzing...";
        this.successText = options.successText || "Analysis Complete";
        this.errorText = options.errorText || "Try Again";

        this.onAnalyze = options.onAnalyze || null;

        this.isAnalyzing = false;

        this.initialize();
    }

    // ------------------------------------------------------------
    // Initialize button
    // ------------------------------------------------------------

    initialize() {
        if (!this.button) {
            console.warn(
                `AnalyzeButton: Button with ID "${this.buttonId}" not found.`
            );
            return;
        }

        this.button.addEventListener("click", async () => {
            await this.handleClick();
        });
    }

    // ------------------------------------------------------------
    // Handle click
    // ------------------------------------------------------------

    async handleClick() {
        if (this.isAnalyzing) {
            return;
        }

        if (!this.onAnalyze) {
            console.warn(
                "AnalyzeButton: No analysis callback was provided."
            );
            return;
        }

        try {
            this.setLoading();

            await this.onAnalyze();

            this.setSuccess();
        } catch (error) {
            console.error(
                "AnalyzeButton: Analysis failed:",
                error
            );

            this.setError();
        }
    }

    // ------------------------------------------------------------
    // Loading state
    // ------------------------------------------------------------

    setLoading() {
        if (!this.button) return;

        this.isAnalyzing = true;

        this.button.disabled = true;
        this.button.classList.add("loading");

        const textElement =
            this.button.querySelector(".analysis-btn-content strong");

        if (textElement) {
            textElement.textContent = this.loadingText;
        } else {
            this.button.textContent = this.loadingText;
        }

        const arrow =
            this.button.querySelector(".arrow");

        if (arrow) {
            arrow.textContent = "⏳";
        }
    }

    // ------------------------------------------------------------
    // Success state
    // ------------------------------------------------------------

    setSuccess() {
        if (!this.button) return;

        this.isAnalyzing = false;

        this.button.disabled = false;
        this.button.classList.remove("loading");
        this.button.classList.add("success");

        const textElement =
            this.button.querySelector(".analysis-btn-content strong");

        if (textElement) {
            textElement.textContent = this.successText;
        } else {
            this.button.textContent = this.successText;
        }

        const arrow =
            this.button.querySelector(".arrow");

        if (arrow) {
            arrow.textContent = "✓";
        }

        // Restore the normal button after a short delay
        setTimeout(() => {
            this.reset();
        }, 2000);
    }

    // ------------------------------------------------------------
    // Error state
    // ------------------------------------------------------------

    setError() {
        if (!this.button) return;

        this.isAnalyzing = false;

        this.button.disabled = false;
        this.button.classList.remove("loading");
        this.button.classList.add("error");

        const textElement =
            this.button.querySelector(".analysis-btn-content strong");

        if (textElement) {
            textElement.textContent = this.errorText;
        } else {
            this.button.textContent = this.errorText;
        }

        const arrow =
            this.button.querySelector(".arrow");

        if (arrow) {
            arrow.textContent = "↻";
        }

        setTimeout(() => {
            this.reset();
        }, 2000);
    }

    // ------------------------------------------------------------
    // Reset button
    // ------------------------------------------------------------

    reset() {
        if (!this.button) return;

        this.isAnalyzing = false;

        this.button.disabled = false;

        this.button.classList.remove(
            "loading",
            "success",
            "error"
        );

        const textElement =
            this.button.querySelector(".analysis-btn-content strong");

        if (textElement) {
            textElement.textContent = this.defaultText;
        } else {
            this.button.textContent = this.defaultText;
        }

        const arrow =
            this.button.querySelector(".arrow");

        if (arrow) {
            arrow.textContent = "→";
        }
    }

    // ------------------------------------------------------------
    // Enable / disable
    // ------------------------------------------------------------

    enable() {
        if (!this.button) return;

        this.button.disabled = false;
        this.button.classList.remove("disabled");
    }

    disable() {
        if (!this.button) return;

        this.button.disabled = true;
        this.button.classList.add("disabled");
    }

    // ------------------------------------------------------------
    // Update button text
    // ------------------------------------------------------------

    setText(text) {
        if (!this.button) return;

        const textElement =
            this.button.querySelector(".analysis-btn-content strong");

        if (textElement) {
            textElement.textContent = text;
        } else {
            this.button.textContent = text;
        }
    }

    // ------------------------------------------------------------
    // Check state
    // ------------------------------------------------------------

    isLoading() {
        return this.isAnalyzing;
    }
}

// ------------------------------------------------------------
// Make available globally
// ------------------------------------------------------------

window.AnalyzeButton = AnalyzeButton;

