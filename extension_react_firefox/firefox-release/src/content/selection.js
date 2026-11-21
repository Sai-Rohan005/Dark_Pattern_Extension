
/* ============================================================
   DARK PATTERN DETECTOR
   AREA SELECTION
   ============================================================ */

/*
 * Responsibilities:
 *
 * 1. Start area selection when requested by content.js.
 * 2. Display a selection rectangle while the user drags.
 * 3. Capture accurate viewport coordinates.
 * 4. Prevent accidental page interaction while selecting.
 * 5. Return the selected area through a CustomEvent.
 *
 * Coordinates returned:
 *
 * {
 *     x: 100,
 *     y: 200,
 *     width: 500,
 *     height: 300,
 *     x1: 100,
 *     y1: 200,
 *     x2: 600,
 *     y2: 500
 * }
 *
 * Coordinates are relative to the browser viewport.
 */


/* ============================================================
   SELECTION MANAGER
============================================================ */

const DarkPatternSelection = {

    /* --------------------------------------------------------
       State
    -------------------------------------------------------- */

    initialized: false,

    active: false,

    dragging: false,

    startX: 0,

    startY: 0,

    currentX: 0,

    currentY: 0,

    selectionBox: null,

    instructionBox: null,

    previousBodyCursor: "",

    previousDocumentUserSelect: "",

    previousBodyUserSelect: "",


    /* ========================================================
       INITIALIZE
    ======================================================== */

    init() {
        

        if (this.initialized) {
            return;
        }

        this.initialized = true;

        this.setupEventListener();

        console.log(
            "[Dark Pattern Detector] Selection initialized."
        );
    },


    /* ========================================================
       INTERNAL EVENT LISTENER
    ======================================================== */

    setupEventListener() {

        window.addEventListener(
            "dark-pattern-detector",
            (event) => {

                const detail =
                    event.detail || {};

                this.handleMessage(detail);
            }
        );
    },


    /* ========================================================
       HANDLE MESSAGE
    ======================================================== */

    handleMessage(message) {

        if (!message || !message.type) {
            return;
        }


        switch (message.type) {

            case "START_AREA_SELECTION":

                this.start();

                break;


            case "CANCEL_AREA_SELECTION":

                this.cancel();

                break;


            case "DEACTIVATE_OVERLAY":

                this.cancel();

                break;


            default:

                break;
        }
    },


    /* ========================================================
       START SELECTION
    ======================================================== */

    start() {

        if (this.active) {

            console.warn(
                "[Dark Pattern Detector] Selection is already active."
            );

            return;
        }


        this.active = true;

        this.dragging = false;


        /*
         * Save existing page styles so they can
         * be restored when selection finishes.
         */

        this.previousBodyCursor =
            document.body?.style.cursor || "";

        this.previousDocumentUserSelect =
            document.documentElement.style.userSelect || "";

        this.previousBodyUserSelect =
            document.body?.style.userSelect || "";


        /*
         * Disable normal text selection.
         */

        document.documentElement.style.userSelect =
            "none";

        if (document.body) {

            document.body.style.userSelect =
                "none";

            document.body.style.cursor =
                "crosshair";
        }


        /*
         * Create instruction message.
         */

        this.createInstruction();


        /*
         * Create selection rectangle.
         */

        this.createSelectionBox();


        /*
         * Register mouse listeners.
         */

        this.addMouseListeners();


        console.log(
            "[Dark Pattern Detector] Select an area by dragging."
        );
    },


    /* ========================================================
       CREATE INSTRUCTION
    ======================================================== */

    createInstruction() {

        this.removeInstruction();


        const instruction =
            document.createElement("div");


        instruction.id =
            "dark-pattern-selection-instruction";


        Object.assign(
            instruction.style,
            {
                position: "fixed",

                top: "20px",

                left: "50%",

                transform:
                    "translateX(-50%)",

                zIndex:
                    "2147483647",

                padding:
                    "10px 16px",

                background:
                    "#0f172a",

                color:
                    "#ffffff",

                borderRadius:
                    "8px",

                fontFamily:
                    "Arial, Helvetica, sans-serif",

                fontSize:
                    "13px",

                fontWeight:
                    "600",

                lineHeight:
                    "1.4",

                boxShadow:
                    "0 4px 16px rgba(0, 0, 0, 0.25)",

                pointerEvents:
                    "none",

                whiteSpace:
                    "nowrap"
            }
        );


        instruction.textContent =
            "Drag to select an area • Press Esc to cancel";


        document.documentElement.appendChild(
            instruction
        );


        this.instructionBox =
            instruction;
    },


    /* ========================================================
       REMOVE INSTRUCTION
    ======================================================== */

    removeInstruction() {

        if (
            this.instructionBox &&
            this.instructionBox.parentNode
        ) {

            this.instructionBox.parentNode.removeChild(
                this.instructionBox
            );
        }


        this.instructionBox = null;


        const existing =
            document.getElementById(
                "dark-pattern-selection-instruction"
            );


        if (
            existing &&
            existing.parentNode
        ) {

            existing.parentNode.removeChild(
                existing
            );
        }
    },


    /* ========================================================
       CREATE SELECTION BOX
    ======================================================== */

    createSelectionBox() {

        this.removeSelectionBox();


        const box =
            document.createElement("div");


        box.id =
            "dark-pattern-selection-box";


        Object.assign(
            box.style,
            {
                position: "fixed",

                left: "0px",

                top: "0px",

                width: "0px",

                height: "0px",

                border:
                    "2px solid #2563eb",

                background:
                    "rgba(37, 99, 235, 0.12)",

                boxShadow:
                    "0 0 0 99999px rgba(15, 23, 42, 0.18)",

                zIndex:
                    "2147483646",

                pointerEvents:
                    "none",

                display:
                    "none",

                boxSizing:
                    "border-box"
            }
        );


        document.documentElement.appendChild(
            box
        );


        this.selectionBox =
            box;
    },


    /* ========================================================
       REMOVE SELECTION BOX
    ======================================================== */

    removeSelectionBox() {

        if (
            this.selectionBox &&
            this.selectionBox.parentNode
        ) {

            this.selectionBox.parentNode.removeChild(
                this.selectionBox
            );
        }


        this.selectionBox = null;


        const existing =
            document.getElementById(
                "dark-pattern-selection-box"
            );


        if (
            existing &&
            existing.parentNode
        ) {

            existing.parentNode.removeChild(
                existing
            );
        }
    },


    /* ========================================================
       ADD MOUSE LISTENERS
    ======================================================== */

    addMouseListeners() {

        this.boundMouseDown =
            this.handleMouseDown.bind(this);

        this.boundMouseMove =
            this.handleMouseMove.bind(this);

        this.boundMouseUp =
            this.handleMouseUp.bind(this);

        this.boundKeyDown =
            this.handleKeyDown.bind(this);


        document.addEventListener(
            "mousedown",
            this.boundMouseDown,
            true
        );

        document.addEventListener(
            "mousemove",
            this.boundMouseMove,
            true
        );

        document.addEventListener(
            "mouseup",
            this.boundMouseUp,
            true
        );

        document.addEventListener(
            "keydown",
            this.boundKeyDown,
            true
        );

        console.log(
            "[Dark Pattern Selection] Drag listeners attached."
        );
    },


    /* ========================================================
       REMOVE MOUSE LISTENERS
    ======================================================== */

    removeMouseListeners() {

        if (this.boundMouseDown) {
            document.removeEventListener(
                "mousedown",
                this.boundMouseDown,
                true
            );
        }

        if (this.boundMouseMove) {
            document.removeEventListener(
                "mousemove",
                this.boundMouseMove,
                true
            );
        }

        if (this.boundMouseUp) {
            document.removeEventListener(
                "mouseup",
                this.boundMouseUp,
                true
            );
        }

        if (this.boundKeyDown) {
            document.removeEventListener(
                "keydown",
                this.boundKeyDown,
                true
            );
        }

        this.boundMouseDown = null;
        this.boundMouseMove = null;
        this.boundMouseUp = null;
        this.boundKeyDown = null;
    },


    /* ========================================================
       MOUSE DOWN
    ======================================================== */

    handleMouseDown: function(event) {

        console.log(
            "[Dark Pattern Selection] Mouse down:",
            event.clientX,
            event.clientY,
            "active:",
            this.active
        );

        if (!this.active) {
            return;
        }

        /*
         * Only respond to primary mouse button.
         */

        if (event.button !== 0) {
            return;
        }


        /*
         * Prevent the webpage from receiving the click.
         */

        event.preventDefault();

        event.stopPropagation();


        this.dragging = true;


        /*
         * clientX/clientY are viewport coordinates.
         *
         * This is exactly what we need because
         * captureVisibleTab() captures the viewport.
         */

        this.startX =
            event.clientX;

        this.startY =
            event.clientY;


        this.currentX =
            event.clientX;

        this.currentY =
            event.clientY;


        this.updateSelectionBox();
    },


    /* ========================================================
       MOUSE MOVE
    ======================================================== */

    handleMouseMove: function(event) {

        if (
            !this.active ||
            !this.dragging
        ) {

            return;
        }


        event.preventDefault();

        event.stopPropagation();


        this.currentX =
            event.clientX;

        this.currentY =
            event.clientY;


        this.updateSelectionBox();
    },


    /* ========================================================
       MOUSE UP
    ======================================================== */

    handleMouseUp: function(event) {

        if (
            !this.active ||
            !this.dragging
        ) {

            return;
        }


        event.preventDefault();

        event.stopPropagation();


        this.currentX =
            event.clientX;

        this.currentY =
            event.clientY;


        this.dragging = false;


        const selection =
            this.getSelection();


        /*
         * Ignore extremely small selections.
         */

        if (
            selection.width < 5 ||
            selection.height < 5
        ) {

            console.warn(
                "[Dark Pattern Detector] Selection too small."
            );

            this.cancel();

            return;
        }


        console.log(
            "[Dark Pattern Detector] Area selected:",
            selection
        );


        /*
         * Finish the UI first.
         */

        this.cleanup();


        /*
         * Send selection to content.js.
         */

        this.emitSelection(
            selection
        );
    },


    /* ========================================================
       KEYBOARD HANDLER
    ======================================================== */

    handleKeyDown: function(event) {

        if (!this.active) {
            return;
        }


        if (event.key === "Escape") {

            event.preventDefault();

            event.stopPropagation();

            console.log(
                "[Dark Pattern Detector] Selection cancelled."
            );

            this.cancel();
        }
    },


    /* ========================================================
       UPDATE SELECTION BOX
    ======================================================== */

    updateSelectionBox() {

        if (!this.selectionBox) {
            return;
        }


        const selection =
            this.getSelection();


        this.selectionBox.style.display =
            "block";


        this.selectionBox.style.left =
            `${selection.x}px`;


        this.selectionBox.style.top =
            `${selection.y}px`;


        this.selectionBox.style.width =
            `${selection.width}px`;


        this.selectionBox.style.height =
            `${selection.height}px`;
    },


    /* ========================================================
       GET SELECTION
    ======================================================== */

    getSelection() {

        const x1 =
            this.startX;

        const y1 =
            this.startY;

        const x2 =
            this.currentX;

        const y2 =
            this.currentY;


        const x =
            Math.min(
                x1,
                x2
            );


        const y =
            Math.min(
                y1,
                y2
            );


        const width =
            Math.abs(
                x2 - x1
            );


        const height =
            Math.abs(
                y2 - y1
            );


        return {

            x,

            y,

            width,

            height,

            x1: x,

            y1: y,

            x2:
                x + width,

            y2:
                y + height
        };
    },


    /* ========================================================
       EMIT SELECTION
    ======================================================== */

    emitSelection(selection) {

        console.log(
            "[Dark Pattern Detector] emitSelection() CALLED",
            selection
        );

        window.dispatchEvent(
            new CustomEvent(
                "dark-pattern-detector-selection",
                {
                    detail: {
                        type: "AREA_SELECTED",
                        selection
                    }
                }
            )
        );
    },


    /* ========================================================
       CANCEL
    ======================================================== */

    cancel() {

        if (!this.active) {
            return;
        }


        this.dragging = false;

        this.active = false;


        this.cleanup();


        /*
         * Notify content.js that selection was cancelled.
         */

        window.dispatchEvent(
            new CustomEvent(
                "dark-pattern-detector-selection",
                {
                    detail: {
                        type:
                            "AREA_SELECTION_CANCELLED"
                    }
                }
            )
        );
    },


    /* ========================================================
       CLEANUP
    ======================================================== */

    cleanup() {

        this.removeMouseListeners();

        this.removeSelectionBox();

        this.removeInstruction();


        /*
         * Restore page interaction.
         */

        document.documentElement.style.userSelect =
            this.previousDocumentUserSelect;


        if (document.body) {

            document.body.style.userSelect =
                this.previousBodyUserSelect;

            document.body.style.cursor =
                this.previousBodyCursor;
        }


        this.active = false;

        this.dragging = false;
    },


    /* ========================================================
       IS ACTIVE
    ======================================================== */

    isActive() {

        return this.active;
    }
};


/* ============================================================
   GLOBAL EXPORT
============================================================ */
if (!window.__DARK_PATTERN_SELECTION_INITIALIZED__) {

    window.__DARK_PATTERN_SELECTION_INITIALIZED__ = true;

    window.DarkPatternSelection =
        DarkPatternSelection;

    DarkPatternSelection.init();

    console.log(
        "[Dark Pattern Detector] selection.js loaded and initialized."
    );

} else {

    console.log(
        "[Dark Pattern Selection] Duplicate script detected. Initialization skipped."
    );
}