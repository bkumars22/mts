import { Route, Routes } from "react-router-dom"
import Dashboard from "./pages/Dashboard"
import Help from "./pages/Help"

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Dashboard />} />
      <Route path="/help" element={<Help />} />
    </Routes>
  )
}
