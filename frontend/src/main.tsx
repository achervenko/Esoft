import { StrictMode } from 'react'
import { ChakraProvider, defaultSystem } from '@chakra-ui/react'
import { createRoot } from 'react-dom/client'
import './index.css'
import './shared/ui/notifications/notifications.css'
import App from './App.tsx'
import { NotificationProvider } from './shared/ui/notifications'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ChakraProvider value={defaultSystem}>
      <NotificationProvider>
        <App />
      </NotificationProvider>
    </ChakraProvider>
  </StrictMode>,
)
