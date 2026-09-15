import { BrowserRouter } from 'react-router-dom'
import AuthGate from '@/auth/AuthGate'
import AppRoutes from '@/routes'

export default function App() {
  return (
    <AuthGate>
      <BrowserRouter>
        <AppRoutes />
      </BrowserRouter>
    </AuthGate>
  )
}
