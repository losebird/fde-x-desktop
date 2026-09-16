import type { ReactNode } from 'react'
import { useLocation } from 'react-router-dom'
import Sidebar from './Sidebar'
import Header from './Header'

// IM 路由(/im)走全屏模式:不显示全局 Sidebar + Header,IM 自带顶栏和左栏
export default function AppShell({ children }: { children: ReactNode }) {
  const { pathname } = useLocation()
  const isIM = pathname === '/im'
  if (isIM) {
    return <div className="h-full w-full">{children}</div>
  }
  return (
    <div className="h-full w-full flex bg-canvas">
      <Sidebar />
      <div className="flex-1 min-w-0 flex flex-col">
        <Header />
        <main className="flex-1 overflow-y-auto">
          {/* @container:让页面内的 @md/@3xl 等容器查询断点以这里为准(整页模式) */}
          <div className="max-w-[1400px] mx-auto px-8 py-8 @container">
            {children}
          </div>
        </main>
      </div>
    </div>
  )
}
