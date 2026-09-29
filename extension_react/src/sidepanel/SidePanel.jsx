import { useEffect, useState } from 'react'
import './sidepanel.css'

function Header() {
  return (
    <header className="header">
      <div className="brand">
        <div className="brand-icon">🛡️</div>
        <div className="brand-text">
          <h1>Dark Pattern Detector</h1>
          <p>AI-powered website analysis</p>
        </div>
      </div>
      <div className="status-container">
        <span id="status-dot" className="status-dot inactive" />
        <span id="status-text">Inactive</span>
      </div>
    </header>
  )
}

function ActivationSection() {
  return (
    <section id="activation-section" className="section">
      <div className="activation-card">
        <div className="activation-icon">🔍</div>
        <h2>Analyze websites for dark patterns</h2>
        <p>
          Activate the detector to analyze webpage UI and identify potentially
          manipulative design patterns.
        </p>
        <p
          id="restricted-page-message"
          className="restricted-page-message hidden"
          role="alert"
        />
        <button id="activate-btn" className="primary-btn" type="button">
          Activate Detector
        </button>
      </div>
    </section>
  )
}

const ANALYSIS_OPTIONS = [
  {
    id: 'analyze-page-btn',
    icon: '📄',
    title: 'Analyze Entire Page',
    description: 'Analyze the complete webpage',
  },
  {
    id: 'analyze-visible-btn',
    icon: '👁️',
    title: 'Analyze Visible Area',
    description: 'Analyze what is currently visible',
  },
  {
    id: 'analyze-selected-btn',
    icon: '✂️',
    title: 'Analyze Selected Area',
    description: 'Select a specific area of the webpage',
  },
]

function AnalysisOptions() {
  return (
    <section className="analysis-options">
      <div className="section-title">
        <h2>Analyze Page</h2>
        <p>Choose what part of the webpage you want to analyze.</p>
      </div>
      {ANALYSIS_OPTIONS.map(({ id, icon, title, description }) => (
        <button id={id} className="analysis-btn" key={id} type="button">
          <span className="analysis-btn-icon">{icon}</span>
          <span className="analysis-btn-content">
            <strong>{title}</strong>
            <small>{description}</small>
          </span>
          <span className="arrow">→</span>
        </button>
      ))}
    </section>
  )
}

function AnalysisStatus() {
  return (
    <section id="analysis-status" className="analysis-status hidden">
      <div className="loading-spinner" />
      <div>
        <strong id="analysis-status-title">Analyzing webpage...</strong>
        <p id="analysis-status-message">
          Please wait while the AI analyzes the page.
        </p>
      </div>
    </section>
  )
}

function ResultsSection() {
  return (
    <section id="results-section" className="results-section">
      <div className="section-title results-title">
        <div>
          <h2>Analysis Results</h2>
          <p>Detected dark patterns will appear here.</p>
        </div>
        <span id="result-count" className="result-count">
          0
        </span>
      </div>

      <div
        id="annotated-image-section"
        className="annotated-image-section hidden"
      >
        <div className="annotated-image-header">
          <div>
            <h3>Dark Pattern Localization</h3>
            <p>
              Components that contributed to the prediction are highlighted
              below.
            </p>
          </div>
        </div>
        <div className="annotated-image-container">
          <img
            id="annotated-image"
            className="annotated-image"
            alt="Annotated dark pattern detection result"
          />
        </div>
      </div>

      <div id="no-results" className="empty-state">
        <div className="empty-icon">🛡️</div>
        <h3>No analysis yet</h3>
        <p>
          Analyze a webpage to see whether dark patterns are present.
        </p>
      </div>

      <div id="results-container" className="results-container" />
    </section>
  )
}

function AnalysisSection() {
  return (
    <main id="analysis-section" className="section hidden">
      <AnalysisOptions />
      <AnalysisStatus />
      <ResultsSection />
      <section className="deactivate-section">
        <button id="deactivate-btn" className="secondary-btn" type="button">
          Deactivate Detector
        </button>
      </section>
    </main>
  )
}

function SidePanel() {
  const [initializationError, setInitializationError] = useState('')
  const extensionApiUnavailable =
    !globalThis.chrome?.tabs || !globalThis.chrome?.storage

  useEffect(() => {
    let mounted = true

    if (extensionApiUnavailable) {
      return () => {
        mounted = false
      }
    }

    import('./sidepanel.js').catch((error) => {
      console.error('Failed to load the detector:', error)
      if (mounted) {
        setInitializationError('Failed to initialize the detector.')
      }
    })

    return () => {
      mounted = false
    }
  }, [extensionApiUnavailable])

  return (
    <div id="app">
      <Header />
      {(extensionApiUnavailable || initializationError) && (
        <p className="initialization-error" role="alert">
          {initializationError ||
            'Load the unpacked Chrome extension to use browser tab analysis.'}
        </p>
      )}
      <ActivationSection />
      <AnalysisSection />
      <footer className="footer">
        <span>Dark Pattern Detector</span>
        <span>v1.0.0</span>
      </footer>
    </div>
  )
}

export default SidePanel
