import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import ErrorBoundary from './components/ErrorBoundary.tsx'

// 开发环境下 StrictMode 会导致双重渲染，可能导致性能问题和渲染错误
// 生产环境可以启用 StrictMode 来检测潜在问题
const isDev = import.meta.env.DEV

createRoot(document.getElementById('root')!).render(
  isDev ? (
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  ) : (
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  ),
)