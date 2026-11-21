import { useEffect, useRef, useState } from 'react'
import './popup.css'

const RESTRICTED_URL_PREFIXES = [
  'chrome://',
  'chrome-extension://',
  'edge://',
  'about:',
  'view-source:',
  'devtools://',
  'file://',
]

function isRestrictedUrl(url) {
  return !url || RESTRICTED_URL_PREFIXES.some((prefix) => url.startsWith(prefix))
}

function Popup() {
  const currentTab = useRef(null)
  const [view, setView] = useState('inactive')
  const [status, setStatus] = useState('inactive')
  const [inactiveMessage, setInactiveMessage] = useState(
    'Open the Dark Pattern Detector side panel to analyze webpages for potentially manipulative design patterns.',
  )
  const [restrictedMessage, setRestrictedMessage] = useState(
    'Chrome does not allow extensions to analyze this page.',
  )

  useEffect(() => {
    let mounted = true

    async function initialize() {
      try {
        const tabs = await chrome.tabs.query({
          active: true,
          currentWindow: true,
        })
        currentTab.current = tabs[0] || null

        const result = await chrome.storage.local.get(['detectorActive'])
        if (!mounted) return

        if (!currentTab.current) {
          setRestrictedMessage('Unable to access the current browser tab.')
          setView('restricted')
          setStatus('error')
        } else if (isRestrictedUrl(currentTab.current.url)) {
          setRestrictedMessage(
            'Chrome does not allow extensions to analyze this page.',
          )
          setView('restricted')
          setStatus('error')
        } else if (result.detectorActive === true) {
          setView('active')
          setStatus('active')
        }
      } catch (error) {
        console.error('Popup initialization failed:', error)
        if (mounted) {
          setInactiveMessage('Unable to initialize the detector.')
          setStatus('error')
        }
      }
    }

    initialize()

    return () => {
      mounted = false
    }
  }, [])

  async function openDetector() {
    try {
      if (!currentTab.current) {
        const tabs = await chrome.tabs.query({
          active: true,
          currentWindow: true,
        })
        currentTab.current = tabs[0] || null
      }

      if (!currentTab.current) {
        setInactiveMessage('No active tab found.')
        setStatus('error')
        setView('inactive')
        return
      }

      if (isRestrictedUrl(currentTab.current.url)) {
        setRestrictedMessage(
          'Chrome does not allow extensions to analyze this page.',
        )
        setView('restricted')
        setStatus('error')
        return
      }

      await chrome.storage.local.set({ detectorActive: true })
      setView('active')
      setStatus('active')

      try {
        await chrome.tabs.sendMessage(currentTab.current.id, {
          type: 'DETECTOR_ACTIVATED',
        })
      } catch (error) {
        console.debug('Could not notify content script:', error)
      }

      if (!chrome.sidePanel?.open) {
        throw new Error('Chrome Side Panel API is unavailable.')
      }

      await chrome.sidePanel.open({ tabId: currentTab.current.id })
      window.close()
    } catch (error) {
      console.error('Failed to open detector:', error)
      setInactiveMessage('Could not open the detector. Please try again.')
      setStatus('error')
      setView('inactive')
    }
  }

  async function deactivateDetector() {
    try {
      await chrome.storage.local.set({ detectorActive: false })

      if (currentTab.current) {
        try {
          await chrome.tabs.sendMessage(currentTab.current.id, {
            type: 'DETECTOR_DEACTIVATED',
          })
        } catch (error) {
          console.debug('Could not notify content script:', error)
        }
      }

      setInactiveMessage(
        'Open the Dark Pattern Detector side panel to analyze webpages for potentially manipulative design patterns.',
      )
      setView('inactive')
      setStatus('inactive')
    } catch (error) {
      console.error('Failed to deactivate detector:', error)
      setInactiveMessage('Could not deactivate the detector.')
      setStatus('error')
      setView('inactive')
    }
  }

  return (
    <div id="popup">
      <header className="popup-header">
        <div className="brand">
          <div className="brand-icon">🛡️</div>
          <div className="brand-text">
            <h1>Dark Pattern Detector</h1>
            <p>AI-powered website analysis</p>
          </div>
        </div>
      </header>

      <section className="status-section">
        <div className="status-indicator">
          <span className={`status-dot ${status}`} />
          <span>
            {status === 'error'
              ? view === 'restricted'
                ? 'Page Restricted'
                : 'Error'
              : status === 'active'
                ? 'Detector Active'
                : 'Detector Inactive'}
          </span>
        </div>
      </section>

      <main className="popup-content">
        {view === 'inactive' && (
          <div className="view">
            <div className="info-icon">🔍</div>
            <h2>Analyze websites for dark patterns</h2>
            <p>{inactiveMessage}</p>
            <button
              className="primary-btn"
              onClick={openDetector}
              type="button"
            >
              Open Detector
            </button>
          </div>
        )}

        {view === 'active' && (
          <div className="view">
            <div className="success-icon">✓</div>
            <h2>Detector is Active</h2>
            <p>The detector is ready to analyze the current webpage.</p>
            <button
              className="primary-btn"
              onClick={openDetector}
              type="button"
            >
              Open Analysis Panel
            </button>
            <button
              className="secondary-btn"
              onClick={deactivateDetector}
              type="button"
            >
              Deactivate Detector
            </button>
          </div>
        )}

        {view === 'restricted' && (
          <div className="view">
            <div className="warning-icon">⚠️</div>
            <h2>Page Cannot Be Analyzed</h2>
            <p>{restrictedMessage}</p>
          </div>
        )}
      </main>

      <footer className="popup-footer">
        <span>Dark Pattern Detector</span>
        <span>v1.0.0</span>
      </footer>
    </div>
  )
}

export default Popup
