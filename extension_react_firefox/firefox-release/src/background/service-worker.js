
// ============================================================
// DARK PATTERN DETECTOR
// Background Service Worker
// File: extension/src/background/service-worker.js
// ============================================================

"use strict";

/* ============================================================
   CONFIGURATION
   ============================================================ */

const EXTENSION_NAME = "Dark Pattern Detector";

/* ============================================================
   INITIALIZATION
   ============================================================ */

/**
 * Configure the extension so clicking the extension icon
 * opens the side panel for the current tab.
 */
async function initializeSidePanel() {
    try {
        if (!chrome.sidePanel) {
            console.warn(
                `[${EXTENSION_NAME}] Side Panel API is not available.`
            );
            return;
        }

        await chrome.sidePanel.setPanelBehavior({
            openPanelOnActionClick: true
        });

        console.log(
            `[${EXTENSION_NAME}] Side panel configured successfully.`
        );
    } catch (error) {
        console.error(
            `[${EXTENSION_NAME}] Failed to configure side panel:`,
            error
        );
    }
}

/**
 * Service worker startup.
 */
chrome.runtime.onStartup.addListener(() => {
    console.log(`[${EXTENSION_NAME}] Service worker started.`);
    initializeSidePanel();
});

/**
 * Service worker installation.
 */
chrome.runtime.onInstalled.addListener((details) => {
    console.log(
        `[${EXTENSION_NAME}] Extension installed/updated:`,
        details.reason
    );

    initializeSidePanel();

    // Initialize default storage values.
    chrome.storage.local.get(
        ["detectorActive"],
        (result) => {
            if (chrome.runtime.lastError) {
                console.error(
                    `[${EXTENSION_NAME}] Storage initialization error:`,
                    chrome.runtime.lastError
                );
                return;
            }

            if (typeof result.detectorActive === "undefined") {
                chrome.storage.local.set({
                    detectorActive: false
                });
            }
        }
    );
});

/**
 * Also configure the side panel immediately when the service
 * worker is loaded.
 */
initializeSidePanel();

/* ============================================================
   MESSAGE HANDLING
   ============================================================ */

chrome.runtime.onMessage.addListener(
    (message, sender, sendResponse) => {

        if (!message || !message.type) {
            return false;
        }

        console.log(
            `[${EXTENSION_NAME}] Message received:`,
            message.type
        );

        switch (message.type) {

            /* ------------------------------------------------
               GET ACTIVE TAB
               ------------------------------------------------ */

            case "GET_ACTIVE_TAB":
                handleGetActiveTab(sendResponse);
                return true;


            /* ------------------------------------------------
               GET DETECTOR STATE
               ------------------------------------------------ */

            case "GET_DETECTOR_STATE":
                handleGetDetectorState(sendResponse);
                return true;


            /* ------------------------------------------------
               SET DETECTOR STATE
               ------------------------------------------------ */

            case "SET_DETECTOR_STATE":
                handleSetDetectorState(
                    message,
                    sendResponse
                );
                return true;


            /* ------------------------------------------------
               OPEN SIDE PANEL
               ------------------------------------------------ */

            case "OPEN_SIDE_PANEL":
                handleOpenSidePanel(
                    message,
                    sender,
                    sendResponse
                );
                return true;


            case "AREA_SELECTED":

                console.log(
                    "[Dark Pattern Detector] Area selection received."
                );

                // The side panel is already listening for AREA_SELECTED.
                // The service worker does not need to process the selection.

                sendResponse({
                    success: true
                });

                return false;


            /* ------------------------------------------------
               PING
               ------------------------------------------------ */

            case "PING":
                sendResponse({
                    success: true,
                    message: "Background service worker is running."
                });
                return false;


            /* ------------------------------------------------
               UNKNOWN MESSAGE
               ------------------------------------------------ */

            default:
                console.warn(
                    `[${EXTENSION_NAME}] Unknown message type:`,
                    message.type
                );

                sendResponse({
                    success: false,
                    error: `Unknown message type: ${message.type}`
                });

                return false;
        }
    }
);

/* ============================================================
   GET ACTIVE TAB
   ============================================================ */

async function handleGetActiveTab(sendResponse) {
    try {
        const tabs = await chrome.tabs.query({
            active: true,
            currentWindow: true
        });

        if (!tabs || tabs.length === 0) {
            sendResponse({
                success: false,
                error: "No active tab found."
            });
            return;
        }

        const tab = tabs[0];

        sendResponse({
            success: true,
            tab: {
                id: tab.id,
                url: tab.url || "",
                title: tab.title || "",
                windowId: tab.windowId
            }
        });

    } catch (error) {
        console.error(
            `[${EXTENSION_NAME}] Failed to get active tab:`,
            error
        );

        sendResponse({
            success: false,
            error: error.message || "Failed to get active tab."
        });
    }
}

/* ============================================================
   GET DETECTOR STATE
   ============================================================ */

async function handleGetDetectorState(sendResponse) {
    try {
        const result = await chrome.storage.local.get([
            "detectorActive"
        ]);

        sendResponse({
            success: true,
            detectorActive: result.detectorActive === true
        });

    } catch (error) {
        console.error(
            `[${EXTENSION_NAME}] Failed to get detector state:`,
            error
        );

        sendResponse({
            success: false,
            error: error.message || "Failed to get detector state."
        });
    }
}

/* ============================================================
   SET DETECTOR STATE
   ============================================================ */

async function handleSetDetectorState(
    message,
    sendResponse
) {
    try {
        const active = message.active === true;

        await chrome.storage.local.set({
            detectorActive: active
        });

        sendResponse({
            success: true,
            detectorActive: active
        });

    } catch (error) {
        console.error(
            `[${EXTENSION_NAME}] Failed to set detector state:`,
            error
        );

        sendResponse({
            success: false,
            error: error.message || "Failed to set detector state."
        });
    }
}

/* ============================================================
   OPEN SIDE PANEL
   ============================================================ */

async function handleOpenSidePanel(
    message,
    sender,
    sendResponse
) {
    try {
        let tabId = message.tabId;

        /*
         * If no tab ID was supplied, try to use the sender's tab.
         */
        if (
            typeof tabId !== "number" &&
            sender &&
            sender.tab &&
            typeof sender.tab.id === "number"
        ) {
            tabId = sender.tab.id;
        }

        /*
         * If we still don't have a tab ID, get the active tab.
         */
        if (typeof tabId !== "number") {
            const tabs = await chrome.tabs.query({
                active: true,
                currentWindow: true
            });

            if (!tabs.length || typeof tabs[0].id !== "number") {
                sendResponse({
                    success: false,
                    error: "Unable to determine active tab."
                });
                return;
            }

            tabId = tabs[0].id;
        }

        if (!chrome.sidePanel) {
            sendResponse({
                success: false,
                error: "Side Panel API is not available."
            });
            return;
        }

        await chrome.sidePanel.open({
            tabId: tabId
        });

        sendResponse({
            success: true,
            tabId: tabId
        });

    } catch (error) {
        console.error(
            `[${EXTENSION_NAME}] Failed to open side panel:`,
            error
        );

        sendResponse({
            success: false,
            error: error.message || "Failed to open side panel."
        });
    }
}

/* ============================================================
   TAB EVENTS
   ============================================================ */

/**
 * When the user changes tabs, notify the new tab that the
 * detector state may need to be synchronized.
 */
chrome.tabs.onActivated.addListener(async (activeInfo) => {
    try {
        const result = await chrome.storage.local.get([
            "detectorActive"
        ]);

        const detectorActive =
            result.detectorActive === true;

        try {
            await chrome.tabs.sendMessage(
                activeInfo.tabId,
                {
                    type: detectorActive
                        ? "DETECTOR_ACTIVATED"
                        : "DETECTOR_DEACTIVATED"
                }
            );
        } catch (error) {
            /*
             * Content scripts may not exist on restricted pages.
             * This is expected and should not crash the worker.
             */
        }

    } catch (error) {
        console.error(
            `[${EXTENSION_NAME}] Tab activation handler error:`,
            error
        );
    }
});

/**
 * When a page finishes loading, synchronize detector state.
 */
chrome.tabs.onUpdated.addListener(
    async (tabId, changeInfo, tab) => {

        if (changeInfo.status !== "complete") {
            return;
        }

        try {
            const result = await chrome.storage.local.get([
                "detectorActive"
            ]);

            const detectorActive =
                result.detectorActive === true;

            /*
             * Do not try to inject or message restricted pages.
             */
            if (isRestrictedUrl(tab.url)) {
                return;
            }

            try {
                await chrome.tabs.sendMessage(
                    tabId,
                    {
                        type: detectorActive
                            ? "DETECTOR_ACTIVATED"
                            : "DETECTOR_DEACTIVATED"
                    }
                );
            } catch (error) {
                /*
                 * Content script may not be ready or may not be
                 * available on the current page.
                 */
            }

        } catch (error) {
            console.error(
                `[${EXTENSION_NAME}] Tab update handler error:`,
                error
            );
        }
    }
);

/* ============================================================
   RESTRICTED URL CHECK
   ============================================================ */

function isRestrictedUrl(url) {

    if (!url || typeof url !== "string") {
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
   EXTENSION MESSAGE HELPERS
   ============================================================ */

/**
 * Send a message to a specific tab safely.
 */
async function sendMessageToTab(tabId, message) {
    try {
        return await chrome.tabs.sendMessage(
            tabId,
            message
        );
    } catch (error) {
        console.warn(
            `[${EXTENSION_NAME}] Could not send message to tab ${tabId}:`,
            error.message
        );

        return null;
    }
}

/* ============================================================
   CONTEXT MENU SUPPORT
   ============================================================ */

/*
 * Optional context-menu entry.
 *
 * This is intentionally disabled for now.
 *
 * If you later want:
 *
 *   Right click → Analyze selected area
 *
 * we can enable it here.
 */

/*
chrome.runtime.onInstalled.addListener(() => {
    chrome.contextMenus.create({
        id: "analyze-selected-area",
        title: "Analyze selected area for dark patterns",
        contexts: ["page", "selection"]
    });
});

chrome.contextMenus.onClicked.addListener(
    async (info, tab) => {
        if (!tab || typeof tab.id !== "number") {
            return;
        }

        await sendMessageToTab(
            tab.id,
            {
                type: "START_AREA_SELECTION"
            }
        );
    }
);
*/

/* ============================================================
   ERROR HANDLING
   ============================================================ */

self.addEventListener("unhandledrejection", (event) => {
    console.error(
        `[${EXTENSION_NAME}] Unhandled promise rejection:`,
        event.reason
    );
});

console.log(
    `[${EXTENSION_NAME}] Service worker loaded successfully.`
);
