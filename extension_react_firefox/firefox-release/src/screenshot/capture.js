
/* ============================================================
   DARK PATTERN DETECTOR
   SCREENSHOT / CAPTURE UTILITIES
   ============================================================ */

/**
 * Screenshot capture utilities for the Chrome extension.
 *
 * Main responsibilities:
 * 1. Capture the currently visible browser tab.
 * 2. Convert data URLs into Blobs.
 * 3. Crop a screenshot to a selected region.
 * 4. Convert screenshots into Files for backend upload.
 *
 * NOTE:
 * chrome.tabs.captureVisibleTab() can only capture the
 * currently visible tab/window and cannot directly capture
 * an entire long webpage.
 */

class ScreenshotCapture {

    /* ============================================================
       CAPTURE VISIBLE TAB
    ============================================================ */

    static async captureVisibleTab(windowId = null, options = {}) {

        const format = options.format || "png";
        const quality = options.quality || 100;

        try {

            const captureOptions = {
                format
            };

            // JPEG quality is only relevant for JPEG screenshots.
            if (format === "jpeg") {
                captureOptions.quality = quality;
            }


            const dataUrl = await new Promise(
                (resolve, reject) => {

                    const callback = (result) => {

                        if (chrome.runtime.lastError) {

                            reject(
                                new Error(
                                    chrome.runtime.lastError.message
                                )
                            );

                            return;
                        }

                        if (!result) {

                            reject(
                                new Error(
                                    "Screenshot capture returned no image."
                                )
                            );

                            return;
                        }

                        resolve(result);
                    };


                    if (
                        windowId !== null &&
                        windowId !== undefined
                    ) {

                        chrome.tabs.captureVisibleTab(
                            windowId,
                            captureOptions,
                            callback
                        );

                    } else {

                        chrome.tabs.captureVisibleTab(
                            captureOptions,
                            callback
                        );
                    }
                }
            );


            return {
                success: true,
                dataUrl,
                format,
                width: null,
                height: null
            };

        } catch (error) {

            console.error(
                "Screenshot capture failed:",
                error
            );

            return {
                success: false,
                dataUrl: null,
                format,
                width: null,
                height: null,
                error: error.message
            };
        }
    }


    /* ============================================================
       CAPTURE CURRENT TAB
    ============================================================ */

    static async captureCurrentTab(options = {}) {

        try {

            const tabs = await chrome.tabs.query({
                active: true,
                currentWindow: true
            });


            const tab = tabs[0];

            if (!tab) {

                throw new Error(
                    "No active tab found."
                );
            }


            if (
                tab.url &&
                this.isRestrictedUrl(tab.url)
            ) {

                throw new Error(
                    "This page cannot be captured by the extension."
                );
            }


            const result =
                await this.captureVisibleTab(
                    tab.windowId,
                    options
                );


            if (!result.success) {

                throw new Error(
                    result.error ||
                    "Failed to capture the current tab."
                );
            }


            return {
                ...result,
                tab
            };

        } catch (error) {

            console.error(
                "Current tab capture failed:",
                error
            );

            return {
                success: false,
                dataUrl: null,
                tab: null,
                error: error.message
            };
        }
    }


    /* ============================================================
       DATA URL → BLOB
    ============================================================ */

    static dataUrlToBlob(dataUrl) {

        if (!dataUrl) {

            throw new Error(
                "Invalid image data URL."
            );
        }


        const parts = dataUrl.split(",");

        if (parts.length !== 2) {

            throw new Error(
                "Invalid data URL format."
            );
        }


        const header = parts[0];
        const base64Data = parts[1];


        const mimeMatch =
            header.match(
                /data:([^;]+);base64/
            );


        const mimeType =
            mimeMatch
                ? mimeMatch[1]
                : "image/png";


        const binaryString =
            atob(base64Data);


        const length =
            binaryString.length;


        const bytes =
            new Uint8Array(length);


        for (let i = 0; i < length; i++) {

            bytes[i] =
                binaryString.charCodeAt(i);
        }


        return new Blob(
            [bytes],
            {
                type: mimeType
            }
        );
    }


    /* ============================================================
       DATA URL → FILE
    ============================================================ */

    static dataUrlToFile(
        dataUrl,
        filename = "screenshot.png"
    ) {

        const blob =
            this.dataUrlToBlob(dataUrl);


        return new File(
            [blob],
            filename,
            {
                type: blob.type
            }
        );
    }


    /* ============================================================
       GET IMAGE DIMENSIONS
    ============================================================ */

    static async getImageDimensions(dataUrl) {

        if (!dataUrl) {

            throw new Error(
                "Image data URL is required."
            );
        }


        return new Promise(
            (resolve, reject) => {

                const image =
                    new Image();


                image.onload = () => {

                    resolve({
                        width: image.naturalWidth,
                        height: image.naturalHeight
                    });
                };


                image.onerror = () => {

                    reject(
                        new Error(
                            "Unable to read image dimensions."
                        )
                    );
                };


                image.src = dataUrl;
            }
        );
    }


    /* ============================================================
       CROP SCREENSHOT
    ============================================================ */

  /* ============================================================
   CROP SCREENSHOT
============================================================ */

static async cropScreenshot(
        dataUrl,
        selection
    ) {

        try {

            if (!dataUrl) {
                throw new Error(
                    "Screenshot data is required."
                );
            }


            const coordinates =
                this.normalizeSelection(selection);


            if (!coordinates) {
                throw new Error(
                    "Invalid selection coordinates."
                );
            }


            const dimensions =
                await this.getImageDimensions(dataUrl);


            /*
            * IMPORTANT:
            *
            * Selection coordinates come from the WEBPAGE.
            *
            * cropScreenshot() runs in the SIDE PANEL, so we must
            * NOT use window.innerWidth / window.innerHeight here.
            *
            * selection.viewportWidth and selection.viewportHeight
            * are provided by content.js.
            */

            const viewportWidth =
                Number(selection.viewportWidth) ||
                Number(selection.viewport?.width);


            const viewportHeight =
                Number(selection.viewportHeight) ||
                Number(selection.viewport?.height);


            /*
            * Fallback for older selections that don't contain
            * viewport information.
            */

            if (
                !Number.isFinite(viewportWidth) ||
                !Number.isFinite(viewportHeight) ||
                viewportWidth <= 0 ||
                viewportHeight <= 0
            ) {

                throw new Error(
                    "Selection viewport dimensions are missing or invalid."
                );
            }


            /*
            * Screenshot dimensions are physical image pixels.
            *
            * Selection coordinates are CSS pixels.
            *
            * Therefore:
            *
            * screenshot pixel / webpage CSS pixel
            */

            const scaleX =
                dimensions.width /
                viewportWidth;


            const scaleY =
                dimensions.height /
                viewportHeight;


            console.log(
                "[Dark Pattern Detector] Crop dimensions:",
                {
                    screenshotWidth: dimensions.width,
                    screenshotHeight: dimensions.height,
                    viewportWidth,
                    viewportHeight,
                    scaleX,
                    scaleY
                }
            );


            let x =
                Math.round(
                    coordinates.x * scaleX
                );


            let y =
                Math.round(
                    coordinates.y * scaleY
                );


            let width =
                Math.round(
                    coordinates.width * scaleX
                );


            let height =
                Math.round(
                    coordinates.height * scaleY
                );


            // ----------------------------------------------------
            // Clamp coordinates
            // ----------------------------------------------------

            x =
                Math.max(
                    0,
                    Math.min(
                        x,
                        dimensions.width
                    )
                );


            y =
                Math.max(
                    0,
                    Math.min(
                        y,
                        dimensions.height
                    )
                );


            width =
                Math.min(
                    width,
                    dimensions.width - x
                );


            height =
                Math.min(
                    height,
                    dimensions.height - y
                );


            if (
                width <= 0 ||
                height <= 0
            ) {

                throw new Error(
                    "Selected area has invalid dimensions."
                );
            }


            // ----------------------------------------------------
            // CREATE CANVAS
            // ----------------------------------------------------

            const image =
                await this.loadImage(
                    dataUrl
                );


            const canvas =
                document.createElement(
                    "canvas"
                );


            canvas.width =
                width;

            canvas.height =
                height;


            const context =
                canvas.getContext(
                    "2d"
                );


            if (!context) {

                throw new Error(
                    "Unable to create canvas context."
                );
            }


            context.drawImage(
                image,

                x,
                y,
                width,
                height,

                0,
                0,
                width,
                height
            );


            // ----------------------------------------------------
            // CONVERT TO DATA URL
            // ----------------------------------------------------

            const croppedDataUrl =
                canvas.toDataURL(
                    "image/png"
                );


            console.log(
                "[Dark Pattern Detector] Crop completed:",
                {
                    x,
                    y,
                    width,
                    height
                }
            );


            return {
                success: true,
                dataUrl: croppedDataUrl,
                width,
                height,
                selection: {
                    ...coordinates,
                    viewportWidth,
                    viewportHeight,
                    devicePixelRatio:
                        Number(selection.devicePixelRatio) || 1
                }
            };

        } catch (error) {

            console.error(
                "Screenshot cropping failed:",
                error
            );

            return {
                success: false,
                dataUrl: null,
                width: 0,
                height: 0,
                selection: null,
                error: error.message
            };
        }
    }

    /* ============================================================
       LOAD IMAGE
    ============================================================ */

    static loadImage(dataUrl) {

        return new Promise(
            (resolve, reject) => {

                const image =
                    new Image();


                image.onload = () => {

                    resolve(image);
                };


                image.onerror = () => {

                    reject(
                        new Error(
                            "Failed to load screenshot."
                        )
                    );
                };


                image.src = dataUrl;
            }
        );
    }


    /* ============================================================
       NORMALIZE SELECTION
    ============================================================ */

    static normalizeSelection(selection) {

        if (!selection) {
            return null;
        }


        // --------------------------------------------------------
        // Array
        // [x1, y1, x2, y2]
        // --------------------------------------------------------

        if (
            Array.isArray(selection) &&
            selection.length >= 4
        ) {

            const x1 =
                Number(selection[0]);

            const y1 =
                Number(selection[1]);

            const x2 =
                Number(selection[2]);

            const y2 =
                Number(selection[3]);


            return this.createSelection(
                x1,
                y1,
                x2,
                y2
            );
        }


        // --------------------------------------------------------
        // { x, y, width, height }
        // --------------------------------------------------------

        if (
            typeof selection === "object" &&
            Number.isFinite(
                Number(selection.x)
            ) &&
            Number.isFinite(
                Number(selection.y)
            ) &&
            Number.isFinite(
                Number(selection.width)
            ) &&
            Number.isFinite(
                Number(selection.height)
            )
        ) {

            return {
                x: Number(selection.x),
                y: Number(selection.y),
                width: Number(selection.width),
                height: Number(selection.height)
            };
        }


        // --------------------------------------------------------
        // { x1, y1, x2, y2 }
        // --------------------------------------------------------

        if (
            typeof selection === "object" &&
            Number.isFinite(
                Number(selection.x1)
            ) &&
            Number.isFinite(
                Number(selection.y1)
            ) &&
            Number.isFinite(
                Number(selection.x2)
            ) &&
            Number.isFinite(
                Number(selection.y2)
            )
        ) {

            return this.createSelection(
                Number(selection.x1),
                Number(selection.y1),
                Number(selection.x2),
                Number(selection.y2)
            );
        }


        // --------------------------------------------------------
        // { coordinates: ... }
        // --------------------------------------------------------

        if (selection.coordinates) {

            return this.normalizeSelection(
                selection.coordinates
            );
        }


        return null;
    }


    /* ============================================================
       CREATE SELECTION
    ============================================================ */

    static createSelection(
        x1,
        y1,
        x2,
        y2
    ) {

        const left =
            Math.min(x1, x2);

        const top =
            Math.min(y1, y2);

        const right =
            Math.max(x1, x2);

        const bottom =
            Math.max(y1, y2);


        return {
            x: left,
            y: top,
            width: right - left,
            height: bottom - top,

            x1: left,
            y1: top,
            x2: right,
            y2: bottom
        };
    }


    /* ============================================================
       SCREENSHOT → FILE
    ============================================================ */

    static screenshotToFile(
        dataUrl,
        filename = "webpage.png"
    ) {

        if (!dataUrl) {

            throw new Error(
                "Screenshot data is required."
            );
        }


        return this.dataUrlToFile(
            dataUrl,
            filename
        );
    }


    /* ============================================================
       SCREENSHOT → BLOB
    ============================================================ */

    static screenshotToBlob(dataUrl) {

        return this.dataUrlToBlob(
            dataUrl
        );
    }


    /* ============================================================
       CAPTURE + FILE
    ============================================================ */

    static async captureAsFile(
        filename = "webpage.png"
    ) {

        const result =
            await this.captureCurrentTab({
                format: "png"
            });


        if (!result.success) {

            return result;
        }


        try {

            const file =
                this.screenshotToFile(
                    result.dataUrl,
                    filename
                );


            const dimensions =
                await this.getImageDimensions(
                    result.dataUrl
                );


            return {
                success: true,
                file,
                dataUrl: result.dataUrl,
                width: dimensions.width,
                height: dimensions.height,
                tab: result.tab
            };

        } catch (error) {

            return {
                success: false,
                file: null,
                dataUrl: result.dataUrl,
                error: error.message,
                tab: result.tab
            };
        }
    }


    /* ============================================================
       CAPTURE + CROP SELECTION
    ============================================================ */

    static async captureSelectedArea(
        selection
    ) {

        try {

            // ----------------------------------------------------
            // Capture visible viewport
            // ----------------------------------------------------

            const screenshot =
                await this.captureCurrentTab({
                    format: "png"
                });


            if (!screenshot.success) {

                throw new Error(
                    screenshot.error ||
                    "Unable to capture webpage."
                );
            }


            // ----------------------------------------------------
            // Crop screenshot
            // ----------------------------------------------------

            const cropped =
                await this.cropScreenshot(
                    screenshot.dataUrl,
                    selection
                );


            if (!cropped.success) {

                throw new Error(
                    cropped.error ||
                    "Unable to crop selected area."
                );
            }


            // ----------------------------------------------------
            // Convert to File
            // ----------------------------------------------------

            const file =
                this.screenshotToFile(
                    cropped.dataUrl,
                    "selected-area.png"
                );


            return {
                success: true,

                file,

                dataUrl:
                    cropped.dataUrl,

                width:
                    cropped.width,

                height:
                    cropped.height,

                selection:
                    cropped.selection,

                tab:
                    screenshot.tab
            };

        } catch (error) {

            console.error(
                "Selected-area capture failed:",
                error
            );

            return {
                success: false,
                file: null,
                dataUrl: null,
                width: 0,
                height: 0,
                selection: null,
                tab: null,
                error: error.message
            };
        }
    }


    /* ============================================================
       CHECK RESTRICTED URL
    ============================================================ */

    static isRestrictedUrl(url) {

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
            prefix =>
                url.startsWith(prefix)
        );
    }


    /* ============================================================
       GET CURRENT TAB INFORMATION
    ============================================================ */

    static async getCurrentTab() {

        const tabs =
            await chrome.tabs.query({
                active: true,
                currentWindow: true
            });


        return tabs[0] || null;
    }
}


/* ============================================================
   GLOBAL EXPORT
============================================================ */

window.ScreenshotCapture =
    ScreenshotCapture;


/* ============================================================
   OPTIONAL CONVENIENCE FUNCTIONS
============================================================ */

/**
 * Capture the currently visible webpage.
 */
async function captureVisibleScreenshot() {

    return ScreenshotCapture.captureCurrentTab({
        format: "png"
    });
}


/**
 * Capture the selected area of the webpage.
 */
async function captureSelectedScreenshot(
    selection
) {

    return ScreenshotCapture.captureSelectedArea(
        selection
    );
}


/**
 * Convert screenshot data URL into a File.
 */
function screenshotDataUrlToFile(
    dataUrl,
    filename = "screenshot.png"
) {

    return ScreenshotCapture.screenshotToFile(
        dataUrl,
        filename
    );
}


/* ------------------------------------------------------------
   Global convenience exports
------------------------------------------------------------ */

window.captureVisibleScreenshot =
    captureVisibleScreenshot;

window.captureSelectedScreenshot =
    captureSelectedScreenshot;

window.screenshotDataUrlToFile =
    screenshotDataUrlToFile;
