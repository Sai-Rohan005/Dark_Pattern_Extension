# Run the Dark Pattern Detector

## Build and load the Chrome extension

From this directory, build the React popup and side panel:

```sh
npm install
npm run build
```

Set `backend_url` in this directory's `.env` file to the FastAPI base URL
(for example, `backend_url=http://localhost:8000`). Vite embeds this value when
the app starts or builds; rebuild the extension after changing it.

In Chrome, open `chrome://extensions`, enable **Developer mode**, choose **Load
unpacked**, and select this `extension_react` folder (the folder containing
`manifest.json`). The manifest loads the compiled pages from `dist`; do not load
the source HTML files directly. After rebuilding, use the extension's **Reload**
button on that page.

Click the extension toolbar icon to open the popup, then choose **Open
Detector** to activate the detector and open the side panel.

For frontend development, `npm run dev` starts Vite and serves the side-panel
UI at <http://localhost:5173/>. Browser-tab analysis requires the extension's
Chrome APIs, so load the unpacked extension to try the complete flow. Popup
preview: <http://localhost:5173/src/popup/popup.html>.

## Start the analysis backend

In a second terminal, start the FastAPI backend from the repository's `backend`
directory. Activate its existing virtual environment first if one is available,
then run:

```sh
python -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
```

The extension sends analysis requests to `http://localhost:8000`. Check that
the backend is reachable at <http://localhost:8000/health>.
