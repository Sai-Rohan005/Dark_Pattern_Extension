
// ============================================================
// DARK PATTERN DETECTOR
// Side Panel Controller
// File: extension/src/sidepanel/sidepanel.js
// ============================================================

"use strict";


// ============================================================
// DOM ELEMENTS
// ============================================================

const activationSection =
    document.getElementById("activation-section");

const analysisSection =
    document.getElementById("analysis-section");

const activateBtn =
    document.getElementById("activate-btn");

const deactivateBtn =
    document.getElementById("deactivate-btn");

const analyzePageBtn =
    document.getElementById("analyze-page-btn");

const analyzeVisibleBtn =
    document.getElementById("analyze-visible-btn");

const analyzeSelectedBtn =
    document.getElementById("analyze-selected-btn");


// ============================================================
// COMPONENTS
// ============================================================

let pageAnalyzeButton = null;
let visibleAnalyzeButton = null;
let selectedAnalyzeButton = null;


// ============================================================
// STATE
// ============================================================

let detectorActive = false;

let currentAnalysis = null;

let isAnalyzing = false;

let selectionListener = null;


// ============================================================
// INITIALIZATION
// ============================================================

document.addEventListener(
    "DOMContentLoaded",
    async () => {

        console.log(
            "[Dark Pattern Detector] Side panel initialized."
        );

        try {

            initializeComponents();

            initializeEventListeners();

            await loadDetectorState();

            await updateCurrentTabState();

        } catch (error) {

            console.log(
                "[Dark Pattern Detector] Initialization failed:",
                error
            );

            showError(
                "Failed to initialize the detector."
            );
        }
        console.log(
            "[Dark Pattern Detector] Side panel setup complete."
        );
    }
);


// ============================================================
// INITIALIZE COMPONENTS
// ============================================================

function initializeComponents() {

    // --------------------------------------------------------
    // Analyze Entire Page
    // --------------------------------------------------------

    pageAnalyzeButton =
        new AnalyzeButton(
            "analyze-page-btn",
            {
                defaultText:
                    "Analyze Entire Page",

                loadingText:
                    "Analyzing...",

                successText:
                    "Analysis Complete",

                errorText:
                    "Try Again",

                onAnalyze:
                    async () => {
                        await analyze("page");
                    }
            }
        );


    // --------------------------------------------------------
    // Analyze Visible Area
    // --------------------------------------------------------

    visibleAnalyzeButton =
        new AnalyzeButton(
            "analyze-visible-btn",
            {
                defaultText:
                    "Analyze Visible Area",

                loadingText:
                    "Analyzing...",

                successText:
                    "Analysis Complete",

                errorText:
                    "Try Again",

                onAnalyze:
                    async () => {
                        await analyze("visible");
                    }
            }
        );


    // --------------------------------------------------------
    // Analyze Selected Area
    // --------------------------------------------------------

    selectedAnalyzeButton =
        new AnalyzeButton(
            "analyze-selected-btn",
            {
                defaultText:
                    "Analyze Selected Area",

                loadingText:
                    "Selecting...",

                successText:
                    "Analysis Complete",

                errorText:
                    "Try Again",

                onAnalyze:
                    async () => {
                        await analyzeSelectedArea();
                    }
            }
        );
}



// ============================================================
// DISPLAY ANNOTATED IMAGE
// ============================================================

let annotatedImageUrl = null;

function base64ToBlob(base64, contentType = "image/png") {

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
        new Uint8Array(
            byteNumbers
        );

    return new Blob(
        [byteArray],
        {
            type: contentType
        }
    );
}


function displayAnnotatedImage(result) {

    const section =
        document.getElementById(
            "annotated-image-section"
        );

    const image =
        document.getElementById(
            "annotated-image"
        );

    if (!section || !image) {

        console.warn(
            "[Dark Pattern Detector] Annotated image elements not found."
        );

        return;
    }


    const visualization =
        result?.visualization;


    // --------------------------------------------------------
    // No visualization
    // --------------------------------------------------------

    if (
        !visualization ||
        visualization.generated !== true ||
        !visualization.image
    ) {

        section.classList.add("hidden");

        image.removeAttribute("src");

        if (annotatedImageUrl) {

            URL.revokeObjectURL(
                annotatedImageUrl
            );

            annotatedImageUrl = null;
        }

        return;
    }


    // --------------------------------------------------------
    // Revoke previous Blob URL
    // --------------------------------------------------------

    if (annotatedImageUrl) {

        URL.revokeObjectURL(
            annotatedImageUrl
        );

        annotatedImageUrl = null;
    }


    // --------------------------------------------------------
    // Base64 → Blob
    // --------------------------------------------------------

    const blob =
        base64ToBlob(
            visualization.image,
            visualization.content_type ||
                "image/png"
        );


    // --------------------------------------------------------
    // Blob → Object URL
    // --------------------------------------------------------

    annotatedImageUrl =
        URL.createObjectURL(
            blob
        );


    // --------------------------------------------------------
    // Display image
    // --------------------------------------------------------

    image.src =
        annotatedImageUrl;

    image.alt =
        "Dark pattern localization result";


    section.classList.remove(
        "hidden"
    );


    console.log(
        "[Dark Pattern Detector] Annotated localization image displayed."
    );
}


// ============================================================
// EVENT LISTENERS
// ============================================================

function initializeEventListeners() {

    if (activateBtn) {

        activateBtn.addEventListener(
            "click",
            activateDetector
        );
    }


    if (deactivateBtn) {

        deactivateBtn.addEventListener(
            "click",
            deactivateDetector
        );
    }
}


// ============================================================
// LOAD DETECTOR STATE
// ============================================================

async function loadDetectorState() {

    try {

        const storage =
            await chrome.storage.local.get(
                ["detectorActive"]
            );

        detectorActive =
            storage.detectorActive === true;

        updateDetectorUI();

    } catch (error) {

        console.log(
            "[Dark Pattern Detector] Failed to load detector state:",
            error
        );

        detectorActive = false;

        updateDetectorUI();
    }
}


// ============================================================
// SAVE DETECTOR STATE
// ============================================================

async function saveDetectorState(
    active
) {

    try {

        await chrome.storage.local.set({
            detectorActive:
                active === true
        });

    } catch (error) {

        console.log(
            "[Dark Pattern Detector] Failed to save detector state:",
            error
        );

        throw error;
    }
}


// ============================================================
// UPDATE DETECTOR UI
// ============================================================

function updateDetectorUI() {

    if (detectorActive) {

        if (activationSection) {

            activationSection.classList.add(
                "hidden"
            );
        }


        if (analysisSection) {

            analysisSection.classList.remove(
                "hidden"
            );
        }


        if (
            window.header &&
            typeof window.header.setActive ===
                "function"
        ) {

            window.header.setActive();
        }

    } else {

        if (activationSection) {

            activationSection.classList.remove(
                "hidden"
            );
        }


        if (analysisSection) {

            analysisSection.classList.add(
                "hidden"
            );
        }


        if (
            window.header &&
            typeof window.header.setInactive ===
                "function"
        ) {

            window.header.setInactive();
        }
    }
}


// ============================================================
// ACTIVATE DETECTOR
// ============================================================

/**
 * Show analysis controls and hide activation controls.
 */
function showAnalysisSection() {

    const activationSection =
        document.getElementById("activation-section");

    const analysisSection =
        document.getElementById("analysis-section");


    // Hide Activate Detector section
    if (activationSection) {
        activationSection.style.display = "none";
        activationSection.classList.add("hidden");
    }


    // Show Analysis section
    if (analysisSection) {
        analysisSection.style.display = "";
        analysisSection.classList.remove("hidden");
    }


    console.log(
        "[Dark Pattern Detector] Analysis section shown."
    );
}


/**
 * Hide analysis controls and show activation controls.
 */
function hideAnalysisSection() {

    const activationSection =
        document.getElementById("activation-section");

    const analysisSection =
        document.getElementById("analysis-section");


    // Show Activate Detector section
    if (activationSection) {
        activationSection.style.display = "";
        activationSection.classList.remove("hidden");
    }


    // Hide Analysis section
    if (analysisSection) {
        analysisSection.style.display = "none";
        analysisSection.classList.add("hidden");
    }


    console.log(
        "[Dark Pattern Detector] Analysis section hidden."
    );
}


/**
 * Enable all analysis buttons.
 */
function enableAnalysisButtons() {

    const buttonIds = [
        "analyze-page-btn",
        "analyze-visible-btn",
        "analyze-selected-btn"
    ];


    buttonIds.forEach((id) => {

        const button =
            document.getElementById(id);

        if (button) {
            button.disabled = false;
        }

    });


    console.log(
        "[Dark Pattern Detector] Analysis buttons enabled."
    );
}


/**
 * Disable all analysis buttons.
 */
function disableAnalysisButtons() {

    const buttonIds = [
        "analyze-page-btn",
        "analyze-visible-btn",
        "analyze-selected-btn"
    ];


    buttonIds.forEach((id) => {

        const button =
            document.getElementById(id);

        if (button) {
            button.disabled = true;
        }

    });


    console.log(
        "[Dark Pattern Detector] Analysis buttons disabled."
    );
}


/**
 * Show activation error.
 */
function showActivationError(message) {

    console.error(
        "[Dark Pattern Detector] Activation error:",
        message
    );


    const status =
        document.getElementById("analysis-status");


    if (status) {

        status.style.display = "";

        status.textContent =
            message ||
            "Failed to activate detector.";
    }
}



async function activateDetector() {

    console.log(
        "[Dark Pattern Detector] Activating detector..."
    );

    try {

        // ============================================================
        // GET ACTIVE TAB
        // ============================================================

        const tabs = await chrome.tabs.query({
            active: true,
            currentWindow: true
        });

        const tab = tabs[0];

        if (!tab || !tab.id) {
            throw new Error("No active tab found.");
        }

        console.log(
            "[Dark Pattern Detector] Active tab:",
            tab.id,
            tab.url
        );


        // ============================================================
        // CHECK RESTRICTED URL
        // ============================================================

        if (
            window.ScreenshotCapture &&
            typeof window.ScreenshotCapture.isRestrictedUrl === "function"
        ) {

            if (
                window.ScreenshotCapture.isRestrictedUrl(tab.url)
            ) {

                throw new Error(
                    "Detector cannot run on this Chrome/system page. " +
                    "Please open a normal website."
                );
            }
        }


        // ============================================================
        // CHECK WHETHER CONTENT SCRIPT IS ALREADY RUNNING
        // ============================================================

        let contentScriptReady = false;

        try {

            const response =
                await chrome.tabs.sendMessage(tab.id, {
                    type: "PING"
                });

            if (response?.success === true) {

                contentScriptReady = true;

                console.log(
                    "[Dark Pattern Detector] Content script already running."
                );
            }

        } catch (error) {

            console.log(
                "[Dark Pattern Detector] Content script not detected. Injecting..."
            );
        }


        // ============================================================
        // INJECT CONTENT SCRIPTS IF NEEDED
        // ============================================================

        if (!contentScriptReady) {

            try {

                await chrome.scripting.executeScript({
                    target: {
                        tabId: tab.id
                    },
                    files: [
                        "src/content/content.js",
                        "src/content/selection.js",
                        "src/content/overlay.js"
                    ]
                });

                console.log(
                    "[Dark Pattern Detector] Content scripts injected."
                );


                // Give the scripts time to initialize.
                await new Promise(resolve =>
                    setTimeout(resolve, 200)
                );


                // ----------------------------------------------------
                // Inject CSS
                // ----------------------------------------------------

                try {

                    await chrome.scripting.insertCSS({
                        target: {
                            tabId: tab.id
                        },
                        files: [
                            "src/content/content.css"
                        ]
                    });

                    console.log(
                        "[Dark Pattern Detector] Content CSS injected."
                    );

                } catch (cssError) {

                    console.warn(
                        "[Dark Pattern Detector] CSS injection warning:",
                        cssError
                    );
                }


                // ----------------------------------------------------
                // Verify content script after injection
                // ----------------------------------------------------

                const pingResponse =
                    await chrome.tabs.sendMessage(tab.id, {
                        type: "PING"
                    });

                if (pingResponse?.success !== true) {

                    throw new Error(
                        "Content script was injected but did not respond."
                    );
                }

                console.log(
                    "[Dark Pattern Detector] Content script verified."
                );

            } catch (injectError) {

                console.error(
                    "[Dark Pattern Detector] Failed to inject content scripts:",
                    injectError
                );

                throw new Error(
                    "Could not initialize detector on this page. " +
                    (injectError.message || injectError)
                );
            }
        }


        // ============================================================
        // ACTIVATE CONTENT DETECTOR
        // ============================================================

        const activationResponse =
            await chrome.tabs.sendMessage(tab.id, {
                type: "DETECTOR_ACTIVATED"
            });

        console.log(
            "[Dark Pattern Detector] Activation response:",
            activationResponse
        );


        if (
            !activationResponse ||
            activationResponse.success !== true
        ) {

            throw new Error(
                activationResponse?.error ||
                "Content script failed to activate."
            );
        }


        // ============================================================
        // SAVE ACTIVE STATE
        // ============================================================

        detectorActive = true;

        await chrome.storage.local.set({
            detectorActive: true
        });


        // ============================================================
        // UPDATE SIDE PANEL UI
        // ============================================================

        // Hide Activate Detector section
        // and show analysis controls.
        showAnalysisSection();


        // Update header
        if (
            window.header &&
            typeof window.header.setActive === "function"
        ) {

            window.header.setActive();
        }


        // Hide analysis progress/status
        if (
            window.analysisStatus &&
            typeof window.analysisStatus.hide === "function"
        ) {

            window.analysisStatus.hide();
        }


        // Enable analysis buttons
        enableAnalysisButtons();


        // ============================================================
        // SUCCESS
        // ============================================================

        console.log(
            "[Dark Pattern Detector] Detector activated successfully."
        );

        return {
            success: true
        };

    } catch (error) {

        // ============================================================
        // ACTIVATION FAILED
        // ============================================================

        console.error(
            "[Dark Pattern Detector] Activation failed:",
            error
        );


        detectorActive = false;


        try {

            await chrome.storage.local.set({
                detectorActive: false
            });

        } catch (storageError) {

            console.warn(
                "[Dark Pattern Detector] Failed to reset detector state:",
                storageError
            );
        }


        // Update header to error state
        if (
            window.header &&
            typeof window.header.setError === "function"
        ) {

            window.header.setError();
        }


        // Show error in UI
        if (
            typeof showActivationError === "function"
        ) {

            showActivationError(
                error.message ||
                "Failed to activate detector."
            );
        }


        throw error;
    }
}



// ============================================================
// DEACTIVATE DETECTOR
// ============================================================

async function deactivateDetector() {

    console.log(
        "[Dark Pattern Detector] Deactivating detector..."
    );

    try {

        const tabs = await chrome.tabs.query({
            active: true,
            currentWindow: true
        });

        const tab = tabs[0];

        if (tab?.id) {

            try {

                await chrome.tabs.sendMessage(tab.id, {
                    type: "DETECTOR_DEACTIVATED"
                });

            } catch (error) {

                console.warn(
                    "[Dark Pattern Detector] Could not notify content script:",
                    error
                );
            }
        }


        detectorActive = false;


        await chrome.storage.local.set({
            detectorActive: false
        });


        // Clear analysis/results
        if (window.result) {
            window.result.clear();
        }


        // Disable analysis buttons
        disableAnalysisButtons();


        // Show Activate button again
        hideAnalysisSection();


        // Update header
        if (
            window.header &&
            typeof window.header.setInactive === "function"
        ) {
            window.header.setInactive();
        }


        console.log(
            "[Dark Pattern Detector] Detector deactivated successfully."
        );

    } catch (error) {

        console.error(
            "[Dark Pattern Detector] Deactivation failed:",
            error
        );
    }
}



// ============================================================
// UPDATE CURRENT TAB STATE
// ============================================================

async function updateCurrentTabState() {

    if (!detectorActive) {
        return;
    }

    try {

        const tab = await getActiveTab();

        if (
            !tab ||
            typeof tab.id !== "number"
        ) {
            return;
        }


        // ----------------------------------------------------
        // Restricted URL
        // ----------------------------------------------------

        if (
            tab.url &&
            isRestrictedUrl(tab.url)
        ) {

            console.warn(
                "[Dark Pattern Detector] Current tab is restricted."
            );

            return;
        }


        // ----------------------------------------------------
        // Check whether content script exists
        // ----------------------------------------------------

        let contentScriptReady = false;

        try {

            const response =
                await chrome.tabs.sendMessage(
                    tab.id,
                    {
                        type: "PING"
                    }
                );

            if (
                response?.success === true
            ) {

                contentScriptReady = true;

                console.log(
                    "[Dark Pattern Detector] Content script already available."
                );
            }

        } catch (error) {

            console.log(
                "[Dark Pattern Detector] Content script not available. Injecting..."
            );
        }


        // ----------------------------------------------------
        // Inject content scripts if necessary
        // ----------------------------------------------------

        if (!contentScriptReady) {

            try {

                await chrome.scripting.executeScript({
                    target: {
                        tabId: tab.id
                    },
                    files: [
                        "src/content/content.js",
                        "src/content/selection.js",
                        "src/content/overlay.js"
                    ]
                });

                console.log(
                    "[Dark Pattern Detector] Content scripts injected."
                );


                // Give scripts time to initialize.
                await new Promise(
                    resolve =>
                        setTimeout(resolve, 200)
                );


                // ------------------------------------------------
                // Inject CSS
                // ------------------------------------------------

                try {

                    await chrome.scripting.insertCSS({
                        target: {
                            tabId: tab.id
                        },
                        files: [
                            "src/content/content.css"
                        ]
                    });

                } catch (cssError) {

                    console.warn(
                        "[Dark Pattern Detector] CSS injection warning:",
                        cssError
                    );
                }


                // ------------------------------------------------
                // Verify injection
                // ------------------------------------------------

                const pingResponse =
                    await chrome.tabs.sendMessage(
                        tab.id,
                        {
                            type: "PING"
                        }
                    );


                if (
                    pingResponse?.success !== true
                ) {

                    throw new Error(
                        "Content script was injected but did not respond."
                    );
                }


                console.log(
                    "[Dark Pattern Detector] Content script verified."
                );

            } catch (injectError) {

                console.warn(
                    "[Dark Pattern Detector] Could not initialize content script:",
                    injectError
                );

                return;
            }
        }


        // ----------------------------------------------------
        // Restore detector state on this tab
        // ----------------------------------------------------

        try {

            const activationResponse =
                await chrome.tabs.sendMessage(
                    tab.id,
                    {
                        type:
                            "DETECTOR_ACTIVATED"
                    }
                );

            console.log(
                "[Dark Pattern Detector] Current tab detector state restored:",
                activationResponse
            );

        } catch (messageError) {

            console.warn(
                "[Dark Pattern Detector] Could not activate detector on current tab:",
                messageError
            );
        }

    } catch (error) {

        console.warn(
            "[Dark Pattern Detector] Could not update current tab state:",
            error
        );
    }
}



// ============================================================
// ANALYZE PAGE / VISIBLE AREA
// ============================================================

async function analyze(
    mode
) {

    if (isAnalyzing) {

        console.warn(
            "[Dark Pattern Detector] Analysis already running."
        );

        return;
    }


    if (!detectorActive) {

        showError(
            "Please activate the detector first."
        );

        return;
    }


    if (
        mode !== "page" &&
        mode !== "visible"
    ) {

        throw new Error(
            `Unsupported analysis mode: ${mode}`
        );
    }


    isAnalyzing = true;


    try {

        // ----------------------------------------------------
        // Step 1: Preparing
        // ----------------------------------------------------

        setAnalysisStep(
            "preparing"
        );


        const tab =
            await getActiveTab();


        if (
            !tab ||
            typeof tab.id !== "number"
        ) {

            throw new Error(
                "Could not find the active tab."
            );
        }


        // ----------------------------------------------------
        // Restricted page check
        // ----------------------------------------------------

        if (
            tab.url &&
            isRestrictedUrl(tab.url)
        ) {

            throw new Error(
                "This webpage cannot be analyzed because Chrome restricts extensions on this page."
            );
        }


        // ----------------------------------------------------
        // Tell content script analysis started
        // ----------------------------------------------------

        await sendMessageSafely(
            tab.id,
            {
                type:
                    "ANALYSIS_STARTED",
                analysis_type:
                    mode
            }
        );


        // ----------------------------------------------------
        // Clear previous overlay
        // ----------------------------------------------------

        await sendMessageSafely(
            tab.id,
            {
                type:
                    "CLEAR_DETECTIONS"
            }
        );


        // ----------------------------------------------------
        // Step 2: Capture screenshot
        // ----------------------------------------------------

        setAnalysisStep(
            "capturing"
        );


        const screenshot =
            await captureVisibleScreenshot(
                tab.windowId
            );


        if (!screenshot) {

            throw new Error(
                "Failed to capture the webpage."
            );
        }


        // ----------------------------------------------------
        // Step 3: Create FormData
        // ----------------------------------------------------

        setAnalysisStep(
            "uploading"
        );


        const formData =
            await createFormData(
                screenshot,
                {
                    mode,
                    tab
                }
            );


        // ----------------------------------------------------
        // Step 4: Send to API
        // ----------------------------------------------------

        setAnalysisStep(
            "analyzing"
        );


        if (
            !window.darkPatternAPI ||
            typeof window.darkPatternAPI.analyze !==
                "function"
        ) {

            throw new Error(
                "API client is not available. Make sure api.js is loaded before sidepanel.js."
            );
        }


        const data =
            await window.darkPatternAPI.analyze(
                formData
            );


        console.log(
            "[Dark Pattern Detector] Backend response:",
            data
        );


        // ----------------------------------------------------
        // Step 5: Finalize
        // ----------------------------------------------------

        setAnalysisStep(
            "finalizing"
        );


        currentAnalysis =
            data;


        handleAnalysisResult(
            data
        );


        // ----------------------------------------------------
        // Tell content script analysis completed
        // ----------------------------------------------------

        await sendMessageSafely(
            tab.id,
            {
                type:
                    "ANALYSIS_COMPLETED",
                result:
                    currentAnalysis
            }
        );


    } catch (error) {

        console.log(
            "[Dark Pattern Detector] Analysis failed:",
            error
        );


        handleAnalysisError(
            error
        );


        try {

            const tab =
                await getActiveTab();


            if (
                tab &&
                typeof tab.id === "number"
            ) {

                await sendMessageSafely(
                    tab.id,
                    {
                        type:
                            "ANALYSIS_FAILED",
                        error:
                            error?.message ||
                            "Analysis failed."
                    }
                );
            }

        } catch (_) {
            // Ignore notification failure.
        }

    } finally {

        isAnalyzing = false;


        setTimeout(
            () => {
                hideAnalysisStatus();
            },
            500
        );
    }
}


// ============================================================
// ANALYZE SELECTED AREA
// ============================================================

async function analyzeSelectedArea() {

    if (isAnalyzing) {
        console.warn(
            "[Dark Pattern Detector] Analysis already running."
        );
        return;
    }

    if (!detectorActive) {
        showError(
            "Please activate the detector first."
        );
        return;
    }

    isAnalyzing = true;

    let tab = null;
    let selectionStarted = false;

    try {

        // ========================================================
        // PREPARING
        // ========================================================

        setAnalysisStep("preparing");

        // ========================================================
        // GET ACTIVE TAB
        // ========================================================

        tab = await getActiveTab();

        if (
            !tab ||
            typeof tab.id !== "number"
        ) {
            throw new Error(
                "Could not find the active tab."
            );
        }

        console.log(
            "[Dark Pattern Detector] Active tab:",
            tab.id,
            tab.url
        );

        // ========================================================
        // RESTRICTED PAGE CHECK
        // ========================================================

        if (
            tab.url &&
            isRestrictedUrl(tab.url)
        ) {
            throw new Error(
                "This webpage cannot be analyzed because Chrome restricts extensions on this page."
            );
        }

        // ========================================================
        // CLEAR PREVIOUS DETECTIONS
        // ========================================================

        await sendMessageSafely(
            tab.id,
            {
                type: "CLEAR_DETECTIONS"
            }
        );

        // ========================================================
        // START WAITING FOR SELECTION
        // ========================================================

        console.log(
            "[Dark Pattern Detector] Waiting for area selection..."
        );

        /*
         * IMPORTANT:
         * Only call waitForAreaSelection() ONCE.
         */
        const selectionPromise =
            waitForAreaSelection(60000);

        // ========================================================
        // START AREA SELECTION
        // ========================================================

        const selectionStartResponse =
            await sendMessageToTab(
                tab.id,
                {
                    type: "START_AREA_SELECTION"
                }
            );

        selectionStarted = true;

        console.log(
            "[Dark Pattern Detector] Selection start response:",
            selectionStartResponse
        );

        // ========================================================
        // WAIT FOR USER SELECTION
        // ========================================================

        const selection =
            await selectionPromise;

        if (!selection) {
            throw new Error(
                "No area was selected."
            );
        }

        console.log(
            "[Dark Pattern Detector] Selected area:",
            selection
        );

        // ========================================================
        // VALIDATE SELECTION
        // ========================================================

        if (
            !Number.isFinite(Number(selection.x)) ||
            !Number.isFinite(Number(selection.y)) ||
            !Number.isFinite(Number(selection.width)) ||
            !Number.isFinite(Number(selection.height))
        ) {
            throw new Error(
                "Invalid area selection coordinates."
            );
        }

        if (
            Number(selection.width) <= 0 ||
            Number(selection.height) <= 0
        ) {
            throw new Error(
                "Selected area has invalid dimensions."
            );
        }

        // ========================================================
        // ANALYSIS STARTED
        // ========================================================

        await sendMessageSafely(
            tab.id,
            {
                type: "ANALYSIS_STARTED"
            }
        );

        // ========================================================
        // CAPTURE SCREENSHOT
        // ========================================================

        setAnalysisStep("capturing");

        console.log(
            "[Dark Pattern Detector] Capturing visible screenshot..."
        );

        const screenshotResult =
            await captureVisibleScreenshot(
                tab.windowId
            );

        console.log(
            "[Dark Pattern Detector] Screenshot capture result:",
            screenshotResult
        );

        // ========================================================
        // NORMALIZE SCREENSHOT
        // ========================================================

        let screenshotDataUrl = null;

        if (
            typeof screenshotResult === "string"
        ) {

            screenshotDataUrl =
                screenshotResult;

        } else if (
            screenshotResult &&
            typeof screenshotResult.dataUrl === "string"
        ) {

            screenshotDataUrl =
                screenshotResult.dataUrl;

        } else if (
            screenshotResult &&
            typeof screenshotResult.data === "string"
        ) {

            screenshotDataUrl =
                screenshotResult.data;
        }

        // ========================================================
        // VALIDATE SCREENSHOT
        // ========================================================

        if (
            typeof screenshotDataUrl !== "string" ||
            !screenshotDataUrl.startsWith("data:image/")
        ) {

            console.error(
                "[Dark Pattern Detector] Invalid screenshot result:",
                screenshotResult
            );

            throw new Error(
                screenshotResult?.error ||
                "Invalid screenshot data."
            );
        }

        console.log(
            "[Dark Pattern Detector] Screenshot captured successfully."
        );

        // ========================================================
        // CROP SELECTED AREA
        // ========================================================

        let selectedScreenshot =
            screenshotDataUrl;

        if (
            window.ScreenshotCapture &&
            typeof window.ScreenshotCapture.cropScreenshot ===
                "function"
        ) {

            console.log(
                "[Dark Pattern Detector] Cropping selected area..."
            );

            const cropResult =
                await window.ScreenshotCapture.cropScreenshot(
                    screenshotDataUrl,
                    selection
                );

            console.log(
                "[Dark Pattern Detector] Crop result:",
                cropResult
            );

            if (
                !cropResult ||
                cropResult.success !== true ||
                typeof cropResult.dataUrl !== "string"
            ) {

                throw new Error(
                    cropResult?.error ||
                    "Failed to crop selected area."
                );
            }

            selectedScreenshot =
                cropResult.dataUrl;

            console.log(
                "[Dark Pattern Detector] Selected area cropped successfully."
            );

            console.log(
                "[Dark Pattern Detector] Cropped dimensions:",
                cropResult.width,
                "x",
                cropResult.height
            );

        } else {

            console.warn(
                "[Dark Pattern Detector] Screenshot crop helper unavailable. Sending full screenshot."
            );
        }

        // ========================================================
        // FINAL SCREENSHOT VALIDATION
        // ========================================================

        if (
            typeof selectedScreenshot !== "string" ||
            !selectedScreenshot.startsWith("data:image/")
        ) {

            throw new Error(
                "Invalid cropped screenshot data."
            );
        }

        // ========================================================
        // CREATE FORM DATA
        // ========================================================

        setAnalysisStep("uploading");

        console.log(
            "[Dark Pattern Detector] Creating upload data..."
        );

        const formData =
            await createFormData(
                selectedScreenshot,
                {
                    mode: "selected",
                    tab,
                    selection
                }
            );

        if (!(formData instanceof FormData)) {
            throw new Error(
                "Failed to create image upload data."
            );
        }

        console.log(
            "[Dark Pattern Detector] FormData created successfully."
        );

        // ========================================================
        // BACKEND ANALYSIS
        // ========================================================

        setAnalysisStep("analyzing");

        if (
            !window.darkPatternAPI ||
            typeof window.darkPatternAPI.analyze !==
                "function"
        ) {

            throw new Error(
                "API client is not available. Make sure api.js is loaded before sidepanel.js."
            );
        }

        console.log(
            "[Dark Pattern Detector] Sending selected area to backend..."
        );

        const data =
            await window.darkPatternAPI.analyze(
                formData
            );

        console.log(
            "[Dark Pattern Detector] Selected-area response:",
            data
        );

        // ========================================================
        // VALIDATE RESPONSE
        // ========================================================

        if (
            !data ||
            typeof data !== "object"
        ) {

            throw new Error(
                "Backend returned an invalid response."
            );
        }

        // ========================================================
        // FINALIZE
        // ========================================================

        // ========================================================
        // FINALIZE
        // ========================================================

        setAnalysisStep("finalizing");

        // Use values returned by the backend.
        // Do NOT reference undeclared `detections` or
        // `darkPatternDetected` variables.

        currentAnalysis = {
            ...data,

            detections:
                Array.isArray(data.detections)
                    ? data.detections
                    : [],

            dark_pattern_detected:
                typeof data.dark_pattern_detected === "boolean"
                    ? data.dark_pattern_detected
                    : (
                        Array.isArray(data.detections) &&
                        data.detections.length > 0
                    )
        };

        // --------------------------------------------------------
        // Display annotated localization image
        // --------------------------------------------------------

        // displayAnnotatedImage(
        //     currentAnalysis
        // );

        console.log(
            "[Dark Pattern Detector] Final selected-area analysis:",
            currentAnalysis
        );

        // ========================================================
        // UPDATE SIDE PANEL
        // ========================================================

        handleAnalysisResult(
            currentAnalysis
        );

        // ========================================================
        // NOTIFY CONTENT SCRIPT
        // ========================================================

        await sendMessageSafely(
            tab.id,
            {
                type: "ANALYSIS_COMPLETED",
                result: currentAnalysis
            }
        );

        console.log(
            "[Dark Pattern Detector] Selected-area analysis completed successfully."
        );

        return currentAnalysis;


    } catch (error) {

        // ========================================================
        // ERROR
        // ========================================================

        console.error(
            "[Dark Pattern Detector] Selected-area analysis failed:",
            error
        );

        handleAnalysisError(error);

        // ========================================================
        // NOTIFY CONTENT SCRIPT
        // ========================================================

        try {

            if (
                tab &&
                typeof tab.id === "number"
            ) {

                await sendMessageSafely(
                    tab.id,
                    {
                        type: "ANALYSIS_FAILED",
                        error:
                            error?.message ||
                            "Analysis failed."
                    }
                );
            }

        } catch (notificationError) {

            console.warn(
                "[Dark Pattern Detector] Failed to notify content script:",
                notificationError
            );
        }

    } finally {

        // ========================================================
        // CLEANUP
        // ========================================================

        isAnalyzing = false;

        /*
         * Only cancel selection mode if we actually started it.
         */
        if (selectionStarted) {

            try {

                const currentTab =
                    tab ||
                    await getActiveTab();

                if (
                    currentTab &&
                    typeof currentTab.id === "number"
                ) {

                    await sendMessageSafely(
                        currentTab.id,
                        {
                            type:
                                "CANCEL_AREA_SELECTION"
                        }
                    );
                }

            } catch (cleanupError) {

                console.warn(
                    "[Dark Pattern Detector] Failed to cancel selection mode:",
                    cleanupError
                );
            }
        }

        // ========================================================
        // HIDE STATUS
        // ========================================================

        setTimeout(
            () => {
                hideAnalysisStatus();
            },
            500
        );
    }
}

// ============================================================
// WAIT FOR AREA SELECTION
// ============================================================

async function waitForAreaSelection(timeout = 60000) {

    return new Promise((resolve, reject) => {

        let finished = false;

        const finish = (callback, value) => {

            if (finished) {
                return;
            }

            finished = true;

            clearTimeout(timeoutId);

            chrome.runtime.onMessage.removeListener(
                selectionListener
            );

            callback(value);
        };


        const selectionListener = async (
            message,
            sender
        ) => {

            if (
                !message ||
                message.type !== "AREA_SELECTED"
            ) {
                return;
            }


            console.log(
                "[Dark Pattern Detector] AREA_SELECTED received by side panel."
            );


            const selection =
                message.selection ||
                message.coordinates ||
                message.data;


            if (!selection) {
                return;
            }


            try {

                const activeTab =
                    await getActiveTab();


                if (
                    sender?.tab?.id &&
                    activeTab?.id &&
                    sender.tab.id !== activeTab.id
                ) {

                    console.warn(
                        "[Dark Pattern Detector] Ignoring selection from another tab."
                    );

                    return;
                }

            } catch (_) {
                // Continue if tab validation fails.
            }


            finish(
                resolve,
                selection
            );
        };


        chrome.runtime.onMessage.addListener(
            selectionListener
        );


        const timeoutId = setTimeout(() => {

            finish(
                reject,
                new Error(
                    "Area selection timed out."
                )
            );

        }, timeout);
    });
}

// ============================================================
// CREATE FORM DATA
// ============================================================

async function createFormData(
    screenshotDataUrl,
    options = {}
) {

    if (
        !screenshotDataUrl ||
        typeof screenshotDataUrl !==
            "string"
    ) {

        throw new Error(
            "Invalid screenshot data."
        );
    }


    if (
        !window.darkPatternAPI ||
        typeof window.darkPatternAPI.dataUrlToBlob !==
            "function"
    ) {

        throw new Error(
            "API client is not available."
        );
    }


    const blob =
        window.darkPatternAPI
            .dataUrlToBlob(
                screenshotDataUrl
            );


    const formData =
        new FormData();


    // --------------------------------------------------------
    // Screenshot
    // --------------------------------------------------------

    formData.append(
        "image",
        blob,
        options.mode === "selected"
            ? "selected-area.png"
            : "webpage.png"
    );


    // --------------------------------------------------------
    // Analysis type
    // --------------------------------------------------------

    formData.append(
        "analysis_type",
        options.mode ||
            "visible"
    );


    // --------------------------------------------------------
    // Page URL
    // --------------------------------------------------------

    if (
        options.tab?.url
    ) {

        formData.append(
            "url",
            options.tab.url
        );
    }


    // --------------------------------------------------------
    // Page title
    // --------------------------------------------------------

    if (
        options.tab?.title
    ) {

        formData.append(
            "page_title",
            options.tab.title
        );
    }


    // --------------------------------------------------------
    // Selection information
    // --------------------------------------------------------

    if (
        options.selection
    ) {

        formData.append(
            "selection",
            JSON.stringify(
                options.selection
            )
        );


        const coordinates =
            extractCoordinates(
                options.selection
            );


        if (coordinates) {

            formData.append(
                "x1",
                String(
                    coordinates.x1
                )
            );

            formData.append(
                "y1",
                String(
                    coordinates.y1
                )
            );

            formData.append(
                "x2",
                String(
                    coordinates.x2
                )
            );

            formData.append(
                "y2",
                String(
                    coordinates.y2
                )
            );
        }
    }


    return formData;
}


// ============================================================
// EXTRACT COORDINATES
// ============================================================

function extractCoordinates(
    selection
) {

    if (!selection) {
        return null;
    }


    // --------------------------------------------------------
    // Array:
    // [x1, y1, x2, y2]
    // --------------------------------------------------------

    if (
        Array.isArray(selection) &&
        selection.length >= 4
    ) {

        const values =
            selection
                .slice(0, 4)
                .map(Number);


        if (
            values.every(
                Number.isFinite
            )
        ) {

            return {
                x1: values[0],
                y1: values[1],
                x2: values[2],
                y2: values[3]
            };
        }
    }


    // --------------------------------------------------------
    // Object
    // { x, y, width, height }
    // --------------------------------------------------------

    if (
        typeof selection === "object"
    ) {

        if (
            "x" in selection &&
            "y" in selection &&
            "width" in selection &&
            "height" in selection
        ) {

            const x =
                Number(selection.x);

            const y =
                Number(selection.y);

            const width =
                Number(selection.width);

            const height =
                Number(selection.height);


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

                return {
                    x1: x,
                    y1: y,
                    x2: x + width,
                    y2: y + height
                };
            }
        }


        // ----------------------------------------------------
        // Object
        // { x1, y1, x2, y2 }
        // ----------------------------------------------------

        if (
            "x1" in selection &&
            "y1" in selection &&
            "x2" in selection &&
            "y2" in selection
        ) {

            const values = [
                Number(selection.x1),
                Number(selection.y1),
                Number(selection.x2),
                Number(selection.y2)
            ];


            if (
                values.every(
                    Number.isFinite
                )
            ) {

                return {
                    x1: values[0],
                    y1: values[1],
                    x2: values[2],
                    y2: values[3]
                };
            }
        }


        // ----------------------------------------------------
        // Nested coordinates
        // ----------------------------------------------------

        if (
            selection.coordinates
        ) {

            return extractCoordinates(
                selection.coordinates
            );
        }
    }


    return null;
}


// ============================================================
// CAPTURE VISIBLE SCREENSHOT
// ============================================================

async function captureVisibleScreenshot(
    windowId
) {

    /*
     * Use the new ScreenshotCapture class.
     */

    if (
        window.ScreenshotCapture &&
        typeof window.ScreenshotCapture
            .captureVisibleTab ===
            "function"
    ) {

        const result =
            await window.ScreenshotCapture
                .captureVisibleTab(
                    windowId,
                    {
                        format: "png"
                    }
                );


        if (
            result &&
            result.success === false
        ) {

            throw new Error(
                result.error ||
                "Screenshot capture failed."
            );
        }


        if (
            typeof result === "string"
        ) {

            return result;
        }


        if (
            result?.dataUrl
        ) {

            return result.dataUrl;
        }
    }


    /*
     * Fallback.
     *
     * This should normally not be needed because
     * capture.js is loaded before sidepanel.js.
     */

    return new Promise(
        (resolve, reject) => {

            chrome.tabs.captureVisibleTab(
                windowId,
                {
                    format: "png"
                },
                dataUrl => {

                    if (
                        chrome.runtime.lastError
                    ) {

                        reject(
                            new Error(
                                chrome.runtime.lastError
                                    .message
                            )
                        );

                        return;
                    }


                    if (!dataUrl) {

                        reject(
                            new Error(
                                "Screenshot capture returned no data."
                            )
                        );

                        return;
                    }


                    resolve(
                        dataUrl
                    );
                }
            );
        }
    );
}


// ============================================================
// HANDLE ANALYSIS RESULT
// ============================================================

function handleAnalysisResult(
    data
) {

    console.log(
        "[Dark Pattern Detector] Processing result:",
        data
    );


    if (!data) {

        throw new Error(
            "Backend returned an empty response."
        );
    }


    if (
        data.success === false
    ) {

        throw new Error(
            data.message ||
            data.detail ||
            "Analysis failed."
        );
    }


    /*
     * api.js already normalizes detections.
     *
     * We still normalize here for compatibility with
     * older backend responses.
     */

    const detections =
        normalizeDetections(
            data.detections
        );


    const darkPatternDetected =
        data.dark_pattern_detected === true ||
        detections.length > 0;


    currentAnalysis = {
        ...data,

        detections,

        dark_pattern_detected:
            darkPatternDetected
    };
    


    // --------------------------------------------------------
    // Header
    // --------------------------------------------------------

    if (
        window.header &&
        typeof window.header.setSuccess ===
            "function"
    ) {

        window.header.setSuccess();
    }


    // --------------------------------------------------------
    // Result component
    // --------------------------------------------------------

    if (
        window.result &&
        typeof window.result.show ===
            "function"
    ) {

        window.result.show(
            currentAnalysis
        );

    } else {

        console.warn(
            "[Dark Pattern Detector] Result component is not available."
        );
    }


    // --------------------------------------------------------
    // Show detections on webpage
    //
    // IMPORTANT:
    // We only show boxes when dark patterns exist.
    // --------------------------------------------------------

    if (
        darkPatternDetected &&
        detections.length > 0
    ) {

        const tabPromise =
            getActiveTab();


        tabPromise.then(
            tab => {

                if (
                    !tab ||
                    typeof tab.id !==
                        "number"
                ) {
                    return;
                }


                sendMessageSafely(
                    tab.id,
                    {
                        type:
                            "SHOW_DETECTIONS",

                        detections:
                            detections,

                        dark_pattern_detected:
                            true
                    }
                );
            }
        ).catch(
            error => {

                console.warn(
                    "[Dark Pattern Detector] Could not show detections:",
                    error
                );
            }
        );

    } else {

        getActiveTab()
            .then(
                tab => {

                    if (
                        tab &&
                        typeof tab.id ===
                            "number"
                    ) {

                        return sendMessageSafely(
                            tab.id,
                            {
                                type:
                                    "CLEAR_DETECTIONS"
                            }
                        );
                    }
                }
            )
            .catch(
                () => {}
            );
    }


    // --------------------------------------------------------
    // Hide loading
    // --------------------------------------------------------

    hideAnalysisStatus();
}


// ============================================================
// NORMALIZE DETECTIONS
// ============================================================

function normalizeDetections(
    detections
) {

    if (
        !Array.isArray(detections)
    ) {

        return [];
    }


    return detections
        .filter(
            detection =>
                detection &&
                typeof detection ===
                    "object"
        )
        .map(
            detection => {

                const type =
                    detection.type ||
                    detection.pattern ||
                    detection.label ||
                    detection.class_name ||
                    "unknown";


                const confidence =
                    normalizeConfidence(
                        detection.confidence ??
                        detection.score ??
                        detection.probability ??
                        0
                    );


                const bbox =
                    normalizeBoundingBox(
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
        );
}


// ============================================================
// NORMALIZE CONFIDENCE
// ============================================================

function normalizeConfidence(
    confidence
) {

    let value =
        Number(confidence);


    if (
        !Number.isFinite(value)
    ) {

        return 0;
    }


    if (
        value >= 0 &&
        value <= 1
    ) {

        value *= 100;
    }


    return Math.max(
        0,
        Math.min(
            100,
            value
        )
    );
}


// ============================================================
// NORMALIZE BOUNDING BOX
// ============================================================

function normalizeBoundingBox(
    bbox
) {

    if (!bbox) {
        return null;
    }


    // --------------------------------------------------------
    // [x1, y1, x2, y2]
    // --------------------------------------------------------

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


    // --------------------------------------------------------
    // { x1, y1, x2, y2 }
    // --------------------------------------------------------

    if (
        typeof bbox === "object" &&
        "x1" in bbox &&
        "y1" in bbox &&
        "x2" in bbox &&
        "y2" in bbox
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


    // --------------------------------------------------------
    // { x, y, width, height }
    // --------------------------------------------------------

    if (
        typeof bbox === "object" &&
        "x" in bbox &&
        "y" in bbox &&
        "width" in bbox &&
        "height" in bbox
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


    // --------------------------------------------------------
    // Nested coordinates
    // --------------------------------------------------------

    if (
        typeof bbox === "object" &&
        bbox.coordinates
    ) {

        return normalizeBoundingBox(
            bbox.coordinates
        );
    }


    return null;
}


// ============================================================
// HANDLE ANALYSIS ERROR
// ============================================================

function handleAnalysisError(
    error
) {

    let message =
        error?.message ||
        "An unexpected error occurred during analysis.";


    /*
     * APIError may contain a more useful backend status.
     */

    if (
        error?.status === 0 &&
        error?.details?.reason ===
            "connection_error"
    ) {

        message =
            "Could not connect to the AI backend. Make sure FastAPI is running on http://localhost:8000.";
    }


    console.log(
        "[Dark Pattern Detector]",
        message
    );


    // --------------------------------------------------------
    // Header
    // --------------------------------------------------------

    if (
        window.header &&
        typeof window.header.setError ===
            "function"
    ) {

        window.header.setError(
            "Analysis Failed"
        );
    }


    // --------------------------------------------------------
    // Status
    // --------------------------------------------------------

    if (
        window.analysisStatus &&
        typeof window.analysisStatus.showError ===
            "function"
    ) {

        window.analysisStatus.showError(
            message
        );
    }


    // --------------------------------------------------------
    // Result
    // --------------------------------------------------------

    if (
        window.result &&
        typeof window.result.showError ===
            "function"
    ) {

        window.result.showError(
            message
        );
    }
}


// ============================================================
// ANALYSIS STATUS
// ============================================================

function setAnalysisStep(
    step
) {

    if (
        window.analysisStatus &&
        typeof window.analysisStatus.setStep ===
            "function"
    ) {

        window.analysisStatus.setStep(
            step
        );
    }


    if (
        window.header &&
        typeof window.header.setAnalyzing ===
            "function"
    ) {

        window.header.setAnalyzing();
    }
}


// ============================================================
// HIDE ANALYSIS STATUS
// ============================================================

function hideAnalysisStatus() {

    if (
        window.analysisStatus &&
        typeof window.analysisStatus.hide ===
            "function"
    ) {

        window.analysisStatus.hide();
    }
}


// ============================================================
// SHOW ERROR
// ============================================================

function showError(
    message
) {

    console.log(
        "[Dark Pattern Detector]",
        message
    );


    if (
        window.analysisStatus &&
        typeof window.analysisStatus.showError ===
            "function"
    ) {

        window.analysisStatus.showError(
            message
        );
    }


    if (
        window.result &&
        typeof window.result.showError ===
            "function"
    ) {

        window.result.showError(
            message
        );
    }
}


// ============================================================
// CLEAR RESULTS
// ============================================================


async function clearResults() {
    console.log("[Dark Pattern Detector] Clearing results...");

    // Clear UI results first.
    try {
        if (window.result) {
            window.result.clear();
        }
    } catch (error) {
        console.warn(
            "[Dark Pattern Detector] Failed to clear Result UI:",
            error
        );
    }

    // Try to clear overlays on the page.
    // This must NOT make activation fail if the content
    // script is not currently available.
    try {
        const tabs = await chrome.tabs.query({
            active: true,
            currentWindow: true
        });

        const tab = tabs[0];

        if (!tab?.id) {
            return;
        }

        try {
            await chrome.tabs.sendMessage(tab.id, {
                type: "CLEAR_DETECTIONS"
            });

            console.log(
                "[Dark Pattern Detector] Page detections cleared."
            );

        } catch (error) {
            console.warn(
                "[Dark Pattern Detector] No content script available while clearing detections."
            );

            // IMPORTANT:
            // Do not throw here.
            //
            // "Receiving end does not exist" simply means the
            // content script isn't running yet.
        }

    } catch (error) {
        console.warn(
            "[Dark Pattern Detector] Failed to clear page detections:",
            error
        );
    }
}


// ============================================================
// GET ACTIVE TAB
// ============================================================

async function getActiveTab() {

    const tabs =
        await chrome.tabs.query({
            active: true,
            currentWindow: true
        });


    if (
        !tabs ||
        tabs.length === 0
    ) {

        return null;
    }


    return tabs[0];
}


// ============================================================
// SEND MESSAGE TO TAB
// ============================================================

async function sendMessageToTab(
    tabId,
    message
) {

    if (
        typeof tabId !== "number"
    ) {

        throw new Error(
            "Invalid tab ID."
        );
    }


    return new Promise(
        (resolve, reject) => {

            chrome.tabs.sendMessage(
                tabId,
                message,
                response => {

                    if (
                        chrome.runtime.lastError
                    ) {

                        reject(
                            new Error(
                                chrome.runtime.lastError
                                    .message
                            )
                        );

                        return;
                    }


                    resolve(
                        response
                    );
                }
            );
        }
    );
}


// ============================================================
// SAFE TAB MESSAGE
// ============================================================

async function sendMessageSafely(
    tabId,
    message
) {

    try {

        return await sendMessageToTab(
            tabId,
            message
        );

    } catch (error) {

        console.warn(
            "[Dark Pattern Detector] Tab message failed:",
            message?.type,
            error.message
        );

        return null;
    }
}


// ============================================================
// RESTRICTED URL CHECK
// ============================================================

function isRestrictedUrl(
    url
) {

    if (
        !url ||
        typeof url !== "string"
    ) {

        return false;
    }


    const restrictedPrefixes = [
        "chrome://",
        "chrome-extension://",
        "edge://",
        "about:",
        "view-source:",
        "devtools://",
        "file:"
    ];


    return restrictedPrefixes.some(
        prefix =>
            url.startsWith(prefix)
    );
}


// ============================================================
// VIEW ANALYSIS RESULT
// ============================================================

function openAnalysisResult(
    detection,
    analysisData =
        currentAnalysis
) {

    console.log(
        "[Dark Pattern Detector] Opening analysis:",
        detection
    );


    // --------------------------------------------------------
    // Backend annotated image URL
    // --------------------------------------------------------

    if (
        analysisData?.annotated_image_url
    ) {

        chrome.tabs.create({
            url:
                analysisData
                    .annotated_image_url
        });

        return;
    }


    // --------------------------------------------------------
    // Backend annotated image
    // --------------------------------------------------------

    if (
        analysisData?.annotated_image
    ) {

        openAnnotatedImage(
            analysisData.annotated_image
        );

        return;
    }


    // --------------------------------------------------------
    // Backend image
    // --------------------------------------------------------

    if (
        analysisData?.image
    ) {

        openAnnotatedImage(
            analysisData.image
        );

        return;
    }


    // --------------------------------------------------------
    // Fallback
    // --------------------------------------------------------

    openFallbackAnalysisPage(
        detection,
        analysisData
    );
}


// ============================================================
// OPEN ANNOTATED IMAGE
// ============================================================

function openAnnotatedImage(
    imageData
) {

    if (!imageData) {
        return;
    }


    let imageUrl =
        imageData;


    if (
        typeof imageData !==
            "string"
    ) {

        console.log(
            "[Dark Pattern Detector] Invalid image data."
        );

        return;
    }


    /*
     * Raw base64 → PNG data URL
     */

    if (
        !imageData.startsWith(
            "data:"
        ) &&
        !imageData.startsWith(
            "http://"
        ) &&
        !imageData.startsWith(
            "https://"
        )
    ) {

        imageUrl =
            `data:image/png;base64,${imageData}`;
    }


    chrome.tabs.create({
        url:
            imageUrl
    });
}


// ============================================================
// FALLBACK ANALYSIS PAGE
// ============================================================

function openFallbackAnalysisPage(
    detection,
    analysisData
) {

    const type =
        escapeHTML(
            formatDetectionType(
                detection?.type
            )
        );


    const confidence =
        Math.round(
            normalizeConfidence(
                detection?.confidence
            )
        );


    const bbox =
        detection?.bbox
            ? escapeHTML(
                JSON.stringify(
                    detection.bbox
                )
            )
            : "Not available";


    const page =
        `
<!DOCTYPE html>

<html lang="en">

<head>

    <meta charset="UTF-8">

    <meta
        name="viewport"
        content="width=device-width, initial-scale=1.0"
    >

    <title>
        Dark Pattern Analysis
    </title>

    <style>

        * {
            box-sizing: border-box;
        }

        body {
            margin: 0;
            padding: 40px;

            font-family:
                -apple-system,
                BlinkMacSystemFont,
                "Segoe UI",
                Roboto,
                Arial,
                sans-serif;

            background: #f8fafc;
            color: #0f172a;
        }

        .container {
            max-width: 800px;
            margin: 0 auto;
        }

        .card {
            background: #ffffff;

            border-radius: 16px;

            padding: 30px;

            box-shadow:
                0 10px 30px
                rgba(0, 0, 0, 0.08);
        }

        h1 {
            margin-top: 0;
        }

        .warning {
            padding: 18px;

            border-left:
                5px solid #dc2626;

            background:
                #fef2f2;

            border-radius: 8px;

            margin-top: 20px;
        }

        .row {
            display: flex;

            justify-content:
                space-between;

            gap: 20px;

            padding: 12px 0;

            border-bottom:
                1px solid #e2e8f0;
        }

        .label {
            font-weight: 600;
        }

        .confidence {
            font-weight: 700;
            color: #dc2626;
        }

    </style>

</head>

<body>

    <div class="container">

        <div class="card">

            <h1>
                Dark Pattern Analysis
            </h1>

            <div class="warning">

                <h2>
                    ${type}
                </h2>

                <p>
                    A potentially manipulative
                    design pattern was detected.
                </p>

            </div>


            <div class="row">

                <span class="label">
                    Pattern
                </span>

                <span>
                    ${type}
                </span>

            </div>


            <div class="row">

                <span class="label">
                    Confidence
                </span>

                <span class="confidence">
                    ${confidence}%
                </span>

            </div>


            <div class="row">

                <span class="label">
                    Bounding Box
                </span>

                <span>
                    ${bbox}
                </span>

            </div>

        </div>

    </div>

</body>

</html>
`;


    const blob =
        new Blob(
            [page],
            {
                type:
                    "text/html"
            }
        );


    const url =
        URL.createObjectURL(
            blob
        );


    chrome.tabs.create({
        url
    });
}


// ============================================================
// FORMAT DETECTION TYPE
// ============================================================

function formatDetectionType(
    type
) {

    if (!type) {

        return "Unknown Pattern";
    }


    return String(type)
        .replace(
            /[_-]+/g,
            " "
        )
        .replace(
            /\s+/g,
            " "
        )
        .trim()
        .replace(
            /\b\w/g,
            char =>
                char.toUpperCase()
        );
}


// ============================================================
// ESCAPE HTML
// ============================================================

function escapeHTML(
    value
) {

    return String(value)
        .replace(
            /&/g,
            "&amp;"
        )
        .replace(
            /</g,
            "&lt;"
        )
        .replace(
            />/g,
            "&gt;"
        )
        .replace(
            /"/g,
            "&quot;"
        )
        .replace(
            /'/g,
            "&#039;"
        );
}


// ============================================================
// GLOBAL API
// ============================================================

window.sidePanel = {

    analyze,

    analyzeSelectedArea,

    activateDetector,

    deactivateDetector,

    clearResults,

    openAnalysisResult,

    getCurrentAnalysis:
        () => currentAnalysis,

    isDetectorActive:
        () => detectorActive,

    isAnalyzing:
        () => isAnalyzing
};


console.log(
    "[Dark Pattern Detector] sidepanel.js loaded successfully."
);
