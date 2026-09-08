
/* ============================================================
   DARK PATTERN DETECTOR - POPUP
   ============================================================ */

class PopupController {

    constructor() {
        // --------------------------------------------------------
        // DOM ELEMENTS
        // --------------------------------------------------------

        this.inactiveView = document.getElementById("inactive-view");
        this.activeView = document.getElementById("active-view");
        this.restrictedView = document.getElementById("restricted-view");

        this.statusDot = document.getElementById("status-dot");
        this.statusText = document.getElementById("status-text");

        this.openSidePanelBtn =
            document.getElementById("open-sidepanel-btn");

        this.openAnalysisBtn =
            document.getElementById("open-analysis-btn");

        this.deactivateBtn =
            document.getElementById("deactivate-btn");

        this.restrictedMessage =
            document.getElementById("restricted-message");

        // --------------------------------------------------------
        // STATE
        // --------------------------------------------------------

        this.detectorActive = false;
        this.currentTab = null;

        // --------------------------------------------------------
        // INITIALIZE
        // --------------------------------------------------------

        this.init();
    }


    /* ============================================================
       INITIALIZATION
    ============================================================ */

    async init() {

        this.setupEventListeners();

        try {
            await this.loadCurrentTab();

            await this.updateUI();

        } catch (error) {

            console.error(
                "Popup initialization failed:",
                error
            );

            this.showError(
                "Unable to initialize the detector."
            );
        }
    }


    /* ============================================================
       EVENT LISTENERS
    ============================================================ */

    setupEventListeners() {

        // Open detector from inactive state
        if (this.openSidePanelBtn) {

            this.openSidePanelBtn.addEventListener(
                "click",
                () => this.openDetector()
            );
        }


        // Open analysis panel when detector is already active
        if (this.openAnalysisBtn) {

            this.openAnalysisBtn.addEventListener(
                "click",
                () => this.openDetector()
            );
        }


        // Deactivate detector
        if (this.deactivateBtn) {

            this.deactivateBtn.addEventListener(
                "click",
                () => this.deactivateDetector()
            );
        }
    }


    /* ============================================================
       GET CURRENT TAB
    ============================================================ */

    async loadCurrentTab() {

        const tabs = await chrome.tabs.query({
            active: true,
            currentWindow: true
        });

        this.currentTab = tabs[0] || null;

        if (!this.currentTab) {

            console.warn(
                "No active tab found."
            );
        }
    }


    /* ============================================================
       LOAD DETECTOR STATE
    ============================================================ */

    async loadDetectorState() {

        const result = await chrome.storage.local.get(
            ["detectorActive"]
        );

        this.detectorActive =
            result.detectorActive === true;
    }


    /* ============================================================
       SAVE DETECTOR STATE
    ============================================================ */

    async saveDetectorState(active) {

        this.detectorActive = active;

        await chrome.storage.local.set({
            detectorActive: active
        });
    }


    /* ============================================================
       UPDATE UI
    ============================================================ */

    async updateUI() {

        await this.loadDetectorState();


        // --------------------------------------------------------
        // CHECK TAB
        // --------------------------------------------------------

        if (!this.currentTab) {

            this.showRestricted(
                "Unable to access the current browser tab."
            );

            return;
        }


        // --------------------------------------------------------
        // CHECK RESTRICTED URL
        // --------------------------------------------------------

        if (this.isRestrictedUrl(this.currentTab.url)) {

            this.showRestricted(
                "Chrome does not allow extensions to analyze this page."
            );

            return;
        }


        // --------------------------------------------------------
        // NORMAL UI
        // --------------------------------------------------------

        if (this.detectorActive) {

            this.showActive();

        } else {

            this.showInactive();
        }
    }


    /* ============================================================
       SHOW INACTIVE
    ============================================================ */

    showInactive() {

        this.hideAllViews();

        if (this.inactiveView) {
            this.inactiveView.classList.remove("hidden");
        }

        this.setStatus(
            "inactive",
            "Detector Inactive"
        );
    }


    /* ============================================================
       SHOW ACTIVE
    ============================================================ */

    showActive() {

        this.hideAllViews();

        if (this.activeView) {
            this.activeView.classList.remove("hidden");
        }

        this.setStatus(
            "active",
            "Detector Active"
        );
    }


    /* ============================================================
       SHOW RESTRICTED
    ============================================================ */

    showRestricted(message) {

        this.hideAllViews();

        if (this.restrictedView) {
            this.restrictedView.classList.remove("hidden");
        }

        if (this.restrictedMessage) {
            this.restrictedMessage.textContent = message;
        }

        this.setStatus(
            "error",
            "Page Restricted"
        );
    }


    /* ============================================================
       HIDE ALL VIEWS
    ============================================================ */

    hideAllViews() {

        if (this.inactiveView) {
            this.inactiveView.classList.add("hidden");
        }

        if (this.activeView) {
            this.activeView.classList.add("hidden");
        }

        if (this.restrictedView) {
            this.restrictedView.classList.add("hidden");
        }
    }


    /* ============================================================
       SET STATUS
    ============================================================ */

    setStatus(type, text) {

        if (this.statusDot) {

            this.statusDot.className =
                `status-dot ${type}`;
        }

        if (this.statusText) {

            this.statusText.textContent = text;
        }
    }


    /* ============================================================
       OPEN DETECTOR
    ============================================================ */

    async openDetector() {

        try {

            if (!this.currentTab) {

                await this.loadCurrentTab();
            }


            if (!this.currentTab) {

                this.showError(
                    "No active tab found."
                );

                return;
            }


            // ----------------------------------------------------
            // RESTRICTED PAGE CHECK
            // ----------------------------------------------------

            if (
                this.isRestrictedUrl(
                    this.currentTab.url
                )
            ) {

                this.showRestricted(
                    "Chrome does not allow extensions to analyze this page."
                );

                return;
            }


            // ----------------------------------------------------
            // ACTIVATE DETECTOR
            // ----------------------------------------------------

            await this.saveDetectorState(true);


            // ----------------------------------------------------
            // NOTIFY CONTENT SCRIPT
            // ----------------------------------------------------

            try {

                await chrome.tabs.sendMessage(
                    this.currentTab.id,
                    {
                        type: "DETECTOR_ACTIVATED"
                    }
                );

            } catch (error) {

                /*
                 * Content script may not exist on the current page.
                 * This is not necessarily a fatal error because
                 * the Side Panel can still be opened.
                 */

                console.debug(
                    "Could not notify content script:",
                    error
                );
            }


            // ----------------------------------------------------
            // OPEN SIDE PANEL
            // ----------------------------------------------------

            await this.openSidePanel(
                this.currentTab.id
            );


            // ----------------------------------------------------
            // CLOSE POPUP
            // ----------------------------------------------------

            window.close();

        } catch (error) {

            console.error(
                "Failed to open detector:",
                error
            );

            this.showError(
                "Could not open the detector. Please try again."
            );
        }
    }


    /* ============================================================
       OPEN SIDE PANEL
    ============================================================ */

    async openSidePanel(tabId) {

        if (
            !chrome.sidePanel ||
            !chrome.sidePanel.open
        ) {

            throw new Error(
                "Chrome Side Panel API is unavailable."
            );
        }


        await chrome.sidePanel.open({
            tabId: tabId
        });
    }


    /* ============================================================
       DEACTIVATE DETECTOR
    ============================================================ */

    async deactivateDetector() {

        try {

            // ----------------------------------------------------
            // UPDATE STORAGE
            // ----------------------------------------------------

            await this.saveDetectorState(false);


            // ----------------------------------------------------
            // NOTIFY CONTENT SCRIPT
            // ----------------------------------------------------

            if (this.currentTab) {

                try {

                    await chrome.tabs.sendMessage(
                        this.currentTab.id,
                        {
                            type: "DETECTOR_DEACTIVATED"
                        }
                    );

                } catch (error) {

                    console.debug(
                        "Could not notify content script:",
                        error
                    );
                }
            }


            // ----------------------------------------------------
            // UPDATE UI
            // ----------------------------------------------------

            this.showInactive();

        } catch (error) {

            console.error(
                "Failed to deactivate detector:",
                error
            );

            this.showError(
                "Could not deactivate the detector."
            );
        }
    }


    /* ============================================================
       RESTRICTED URL CHECK
    ============================================================ */

    isRestrictedUrl(url) {

        if (!url) {
            return true;
        }


        const restrictedPrefixes = [
            "chrome://",
            "chrome-extension://",
            "edge://",
            "about:",
            "view-source:",
            "devtools://",
            "file://"
        ];


        return restrictedPrefixes.some(
            prefix => url.startsWith(prefix)
        );
    }


    /* ============================================================
       SHOW ERROR
    ============================================================ */

    showError(message) {

        this.setStatus(
            "error",
            "Error"
        );


        if (this.inactiveView) {

            this.inactiveView.classList.remove(
                "hidden"
            );
        }

        if (this.activeView) {

            this.activeView.classList.add(
                "hidden"
            );
        }

        if (this.restrictedView) {

            this.restrictedView.classList.add(
                "hidden"
            );
        }


        const paragraph =
            this.inactiveView?.querySelector("p");

        if (paragraph) {

            paragraph.textContent = message;
        }
    }
}


/* ============================================================
   INITIALIZE POPUP
============================================================ */

document.addEventListener(
    "DOMContentLoaded",
    () => {

        window.popupController =
            new PopupController();
    }
);
