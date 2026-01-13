import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { Layout } from './components/Layout'
import { Dashboard } from './pages/Dashboard'
import { SLOWorkflow } from './pages/SLOWorkflow'
import { MetricsExplorer } from './pages/MetricsExplorer'
import { ToolBrowser } from './pages/ToolBrowser'

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<Dashboard />} />
          <Route path="slo" element={<SLOWorkflow />} />
          <Route path="metrics" element={<MetricsExplorer />} />
          <Route path="tools" element={<ToolBrowser />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}

export default App
