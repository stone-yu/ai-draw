import {Link, useLocation} from 'react-router-dom'
import {Book, ChevronLeft, History, MessageSquare, Heart, Smartphone, CreditCard} from 'lucide-react'
import {AppHeader} from '@/components/layout/AppHeader'
import {useState} from 'react'

interface DocLayoutProps {
  children: React.ReactNode
  title: string
}

export function DocLayout({ children, title }: DocLayoutProps) {
  const location = useLocation()
  const [showQRCode, setShowQRCode] = useState<'wechat' | 'alipay' | null>(null)

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

            {/* Support Section */}
            <div className="mt-8 pt-6 border-t border-slate-200">
              <div className="px-3 mb-3 flex items-center gap-1.5">
                <Heart className="h-3.5 w-3.5 text-rose-400" />
                <h3 className="font-semibold text-xs text-muted-foreground uppercase tracking-wider">支持和打赏</h3>
              </div>
              <p className="px-5 text-xs text-slate-400 leading-relaxed mb-3">
                感谢支持开源，您的打赏将用于项目的持续开发和维护。
              </p>

              <div className="px-3 space-y-2">
                <button
                  onClick={() => setShowQRCode(showQRCode === 'wechat' ? null : 'wechat')}
                  className="w-full flex items-center gap-2 text-left text-xs text-slate-500 hover:text-slate-700 transition-colors py-1.5 px-2 rounded hover:bg-slate-50"
                >
                  <Smartphone className="h-3.5 w-3.5 text-slate-400" />
                  微信赞赏
                </button>
                <button
                  onClick={() => setShowQRCode(showQRCode === 'alipay' ? null : 'alipay')}
                  className="w-full flex items-center gap-2 text-left text-xs text-slate-500 hover:text-slate-700 transition-colors py-1.5 px-2 rounded hover:bg-slate-50"
                >
                  <CreditCard className="h-3.5 w-3.5 text-slate-400" />
                  支付宝赞赏
                </button>
                {showQRCode && (
                  <div className="mt-3 p-2 bg-white rounded-lg border border-slate-200 shadow-sm">
                    <img
                      src={showQRCode === 'wechat' ? '/wechart-pay.png' : '/ali-pay.png'}
                      alt={showQRCode === 'wechat' ? '微信赞赏码' : '支付宝赞赏码'}
                      className="w-full h-auto rounded"
                    />
                    <p className="text-center text-xs text-slate-400 mt-2">
                      {showQRCode === 'wechat' ? '微信扫码' : '支付宝扫码'}
                    </p>
                  </div>
                )}
              </div>
            </div>
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

