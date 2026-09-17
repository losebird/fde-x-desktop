import { installLatin1Http } from '@/lib/latin1-http'
import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App'
import './index.css'
import { installFdeAskDev } from '@/lib/fde-ask-dev'
import { ensureBizRecordsAutoOpen } from '@/lib/biz-records-auto-open'

installLatin1Http()
installFdeAskDev()
ensureBizRecordsAutoOpen()

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>,
)
