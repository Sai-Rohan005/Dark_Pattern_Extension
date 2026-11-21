
class DetectionCard {
    constructor(detection, options = {}) {
        this.detection = detection;

        this.onViewAnalysis =
            options.onViewAnalysis || null;

        this.container = null;
    }

    // ------------------------------------------------------------
    // Render detection card
    // ------------------------------------------------------------

    render() {
        if (!this.detection) {
            console.warn("DetectionCard: No detection data provided.");
            return null;
        }

        const card = document.createElement("div");

        card.className = "detection-card";

        const type = this.formatDetectionType(
            this.detection.type
        );

        const confidence = this.formatConfidence(
            this.detection.confidence
        );

        const description = this.getDescription(
            this.detection.type
        );

        card.innerHTML = `
            <div class="detection-card-header">
                <div class="detection-icon">
                    ⚠️
                </div>

                <div class="detection-title">
                    <h3>${this.escapeHTML(type)}</h3>
                    <span class="detection-label">
                        Dark Pattern
                    </span>
                </div>

                <div class="confidence-badge">
                    ${confidence}%
                </div>
            </div>

            <div class="detection-card-body">
                <p class="detection-description">
                    ${this.escapeHTML(description)}
                </p>

                <div class="detection-details">
                    <div class="detail-row">
                        <span class="detail-label">
                            Confidence
                        </span>

                        <div class="confidence-bar-container">
                            <div
                                class="confidence-bar"
                                style="width: ${confidence}%"
                            ></div>
                        </div>
                    </div>

                    <div class="detail-row">
                        <span class="detail-label">
                            Location
                        </span>

                        <span class="detail-value">
                            ${this.formatBoundingBox()}
                        </span>
                    </div>
                </div>
            </div>

            <div class="detection-card-footer">
                <button
                    type="button"
                    class="view-analysis-btn"
                >
                    <span>View Analysis</span>
                    <span>→</span>
                </button>
            </div>
        `;

        this.container = card;

        this.attachEvents();

        return card;
    }

    // ------------------------------------------------------------
    // Attach events
    // ------------------------------------------------------------

    attachEvents() {
        if (!this.container) return;

        const viewButton =
            this.container.querySelector(
                ".view-analysis-btn"
            );

        if (viewButton) {
            viewButton.addEventListener(
                "click",
                () => {
                    this.handleViewAnalysis();
                }
            );
        }
    }

    // ------------------------------------------------------------
    // View analysis
    // ------------------------------------------------------------

    handleViewAnalysis() {
        if (typeof this.onViewAnalysis === "function") {
            this.onViewAnalysis(this.detection);
            return;
        }

        console.warn(
            "DetectionCard: No onViewAnalysis callback provided."
        );
    }

    // ------------------------------------------------------------
    // Format detection type
    // ------------------------------------------------------------

    formatDetectionType(type) {
        if (!type) {
            return "Unknown Pattern";
        }

        return String(type)
            .replace(/[_-]+/g, " ")
            .replace(/\s+/g, " ")
            .trim()
            .replace(/\b\w/g, char => char.toUpperCase());
    }

    // ------------------------------------------------------------
    // Format confidence
    // ------------------------------------------------------------

    formatConfidence(confidence) {
        let value = Number(confidence);

        if (Number.isNaN(value)) {
            return 0;
        }

        // Handle values such as 0.92
        if (value <= 1) {
            value *= 100;
        }

        value = Math.round(value);

        return Math.max(
            0,
            Math.min(100, value)
        );
    }

    // ------------------------------------------------------------
    // Get description
    // ------------------------------------------------------------

    getDescription(type) {
        if (!type) {
            return "A potentially manipulative design pattern was detected.";
        }

        const descriptions = {
            scarcity:
                "Creates a sense of limited availability or urgency to encourage a quick decision.",

            urgency:
                "Uses time pressure or countdown messaging to encourage users to act quickly.",

            social_proof:
                "Uses popularity, reviews, or other social signals to influence the user's decision.",

            confirmshaming:
                "Uses guilt, shame, or emotionally negative language when users decline an option.",

            forced_action:
                "Requires the user to take an unwanted action before continuing.",

            forced_continuity:
                "May make it difficult for users to stop or cancel a service after starting it.",

            hidden_costs:
                "Potential costs or charges may not be clearly presented to the user.",

            disguised_ad:
                "Advertising content may be designed to appear like ordinary website content.",

            bait_and_switch:
                "The interface may suggest one option while directing the user toward another.",

            misdirection:
                "The visual design may draw attention toward one action while making another less prominent.",

            obstruction:
                "The interface may make an intended action unnecessarily difficult to complete.",

            default:
                "A potentially manipulative design pattern was detected on this webpage."
        };

        const normalizedType = String(type)
            .toLowerCase()
            .replace(/[\s-]+/g, "_");

        return (
            descriptions[normalizedType] ||
            descriptions.default
        );
    }

    // ------------------------------------------------------------
    // Format bounding box
    // ------------------------------------------------------------

    formatBoundingBox() {
        const bbox = this.detection.bbox;

        if (
            !Array.isArray(bbox) ||
            bbox.length !== 4
        ) {
            return "Detected on page";
        }

        const [x1, y1, x2, y2] = bbox;

        return `(${Math.round(x1)}, ${Math.round(y1)}) → (${Math.round(x2)}, ${Math.round(y2)})`;
    }

    // ------------------------------------------------------------
    // Get raw bounding box
    // ------------------------------------------------------------

    getBoundingBox() {
        return this.detection.bbox || null;
    }

    // ------------------------------------------------------------
    // Get detection data
    // ------------------------------------------------------------

    getDetection() {
        return this.detection;
    }

    // ------------------------------------------------------------
    // Escape HTML
    // ------------------------------------------------------------

    escapeHTML(value) {
        return String(value)
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }

    // ------------------------------------------------------------
    // Remove card
    // ------------------------------------------------------------

    remove() {
        if (this.container) {
            this.container.remove();
            this.container = null;
        }
    }
}

// ------------------------------------------------------------
// Make available globally
// ------------------------------------------------------------

window.DetectionCard = DetectionCard;

