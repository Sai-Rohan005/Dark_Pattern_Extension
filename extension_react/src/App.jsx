import { lazy, Suspense } from 'react'
import './index.css'

const Popup = lazy(() => import('./popup/Popup.jsx'))
const SidePanel = lazy(() => import('./sidepanel/SidePanel.jsx'))

function App() {
  const isPopup = window.location.pathname.endsWith('/popup.html')
  const Page = isPopup ? Popup : SidePanel

  return (
    <Suspense fallback={<p className="app-loading">Loading detector…</p>}>
      <Page />
    </Suspense>
  )
}

export default App
