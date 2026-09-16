import { QueryClientProvider } from '@tanstack/react-query'
import { queryClient } from './queryClient'
import { AppRouter } from './routes/AppRouter'
import { useApplyBranding } from './hooks/useApplyBranding'

function Branded({ children }) {
  useApplyBranding()
  return children
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <Branded>
        <AppRouter />
      </Branded>
    </QueryClientProvider>
  )
}
