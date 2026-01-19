import {Link, useLocation} from 'react-router-dom'
import {Book, ChevronLeft, History, MessageSquare} from 'lucide-react'
import {AppHeader} from '@/components/layout/AppHeader'

interface DocLayoutProps {
  children: React.ReactNode
  title: string
}

export function DocLayout({ children, title }: DocLayoutProps) {
  const location = useLocation()

  const menuItems = [
    { icon: Book, label: '使用手册', path: '/docs/manual' },
    { icon: History, label: '更新日志', path: '/docs/changelog' },
    { icon: MessageSquare, label: '问题反馈', path: '/docs/feedback' },
  ]

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <AppHeader />
      <div className="flex-1 flex max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-8 gap-12">
        {/* Sidebar */}
        <aside className="w-64 flex-shrink-0 hidden md:block">
          <div className="sticky top-24 space-y-1">
            <Link to="/" className="flex items-center gap-2 text-sm text-muted-foreground hover:text-primary mb-6 px-3 transition-colors">
              <ChevronLeft className="h-4 w-4" />
              返回首页
            </Link>
            <h3 className="font-semibold text-xs text-muted-foreground px-3 mb-3 uppercase tracking-wider">文档导航</h3>
            {menuItems.map((item) => {
              const isActive = location.pathname === item.path
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className={`flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-lg transition-all ${
                    isActive
                      ? 'bg-primary/10 text-primary'
                      : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                  }`}
                >
                  <item.icon className="h-4 w-4" />
                  {item.label}
                </Link>
              )
            })}
          </div>
        </aside>

        {/* Main Content */}
        <main className="flex-1 min-w-0">
          <div className="max-w-3xl">
            <h1 className="text-3xl font-bold text-slate-900 mb-8 tracking-tight">{title}</h1>
            <div className="prose prose-slate max-w-none prose-headings:font-semibold prose-a:text-primary hover:prose-a:text-primary/80">
              {children}
            </div>
          </div>
        </main>
      </div>
    </div>
  )
}

