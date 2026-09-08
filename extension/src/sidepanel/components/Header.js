
class Header {
    constructor(options = {}) {
        this.statusDotId = options.statusDotId || "status-dot";
        this.statusTextId = options.statusTextId || "status-text";

        this.header = null;
        this.statusDot = null;
        this.statusText = null;

        this.initialize();
    }

    // ------------------------------------------------------------
    // Initialize
    // ------------------------------------------------------------

    initialize() {
        this.statusDot =
            document.getElementById(this.statusDotId);

        this.statusText =
            document.getElementById(this.statusTextId);

        this.header =
            document.querySelector(".header");

        if (!this.statusDot) {
            console.warn(
                `Header: Element "${this.statusDotId}" not found.`
            );
        }

        if (!this.statusText) {
            console.warn(
                `Header: Element "${this.statusTextId}" not found.`
            );
        }
    }

    // ------------------------------------------------------------
    // Set detector active
    // ------------------------------------------------------------

    setActive() {
        this.updateStatus(
            "Active",
            "active"
        );
    }

    // ------------------------------------------------------------
    // Set detector inactive
    // ------------------------------------------------------------

    setInactive() {
        this.updateStatus(
            "Inactive",
            "inactive"
        );
    }

    // ------------------------------------------------------------
    // Set analyzing state
    // ------------------------------------------------------------

    setAnalyzing() {
        this.updateStatus(
            "Analyzing...",
            "analyzing"
        );
    }

    // ------------------------------------------------------------
    // Set successful state
    // ------------------------------------------------------------

    setSuccess() {
        this.updateStatus(
            "Analysis Complete",
            "success"
        );
    }

    // ------------------------------------------------------------
    // Set error state
    // ------------------------------------------------------------

    setError(message = "Analysis Failed") {
        this.updateStatus(
            message,
            "error"
        );
    }

    // ------------------------------------------------------------
    // Update status
    // ------------------------------------------------------------

    updateStatus(text, state = "inactive") {
        if (this.statusText) {
            this.statusText.textContent = text;
        }

        if (this.statusDot) {
            this.statusDot.classList.remove(
                "active",
                "inactive",
                "analyzing",
                "success",
                "error"
            );

            this.statusDot.classList.add(state);
        }

        if (this.header) {
            this.header.classList.remove(
                "active",
                "inactive",
                "analyzing",
                "success",
                "error"
            );

            this.header.classList.add(state);
        }
    }

    // ------------------------------------------------------------
    // Get current status
    // ------------------------------------------------------------

    getStatus() {
        if (!this.statusDot) {
            return "inactive";
        }

        if (
            this.statusDot.classList.contains("active")
        ) {
            return "active";
        }

        if (
            this.statusDot.classList.contains("analyzing")
        ) {
            return "analyzing";
        }

        if (
            this.statusDot.classList.contains("success")
        ) {
            return "success";
        }

        if (
            this.statusDot.classList.contains("error")
        ) {
            return "error";
        }

        return "inactive";
    }

    // ------------------------------------------------------------
    // Check active state
    // ------------------------------------------------------------

    isActive() {
        return this.getStatus() === "active";
    }

    // ------------------------------------------------------------
    // Check analyzing state
    // ------------------------------------------------------------

    isAnalyzing() {
        return this.getStatus() === "analyzing";
    }

    // ------------------------------------------------------------
    // Reset
    // ------------------------------------------------------------

    reset() {
        this.setInactive();
    }
}

// ------------------------------------------------------------
// Create global instance
// ------------------------------------------------------------

const header = new Header();

window.Header = Header;
window.header = header;
