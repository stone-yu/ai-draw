import {useEffect, useState} from 'react'
import {authService} from '@/services/authService'
import {useToast} from '@/hooks/useToast'
import {Button, Input} from '@/components/ui'
import {Search} from 'lucide-react'

export function UsageStatistics() {
  const [activeStatsTab, setActiveStatsTab] = useState<'chat' | 'file'>('chat')

  return (
    <div className="space-y-4">
      <div className="flex gap-2 border-b border-border">
        <button
          onClick={() => setActiveStatsTab('chat')}
          className={`px-4 py-2 text-sm font-medium transition-colors ${
            activeStatsTab === 'chat'
              ? 'border-b-2 border-primary text-primary'
              : 'text-muted hover:text-primary'
          }`}
        >
          AI 对话统计
        </button>
        <button
          onClick={() => setActiveStatsTab('file')}
          className={`px-4 py-2 text-sm font-medium transition-colors ${
            activeStatsTab === 'file'
              ? 'border-b-2 border-primary text-primary'
              : 'text-muted hover:text-primary'
          }`}
        >
          文件创建统计
        </button>
      </div>

      {activeStatsTab === 'chat' && <ChatStatistics />}
      {activeStatsTab === 'file' && <FileStatistics />}
    </div>
  )
}

function ChatStatistics() {
  const [logs, setLogs] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [userIdFilter, setUserIdFilter] = useState('')
  const { error: showError } = useToast()

  useEffect(() => {
    loadLogs()
  }, [])

  const loadLogs = async (userId?: string) => {
    setLoading(true)
    try {
      const data = await authService.getChatLogs({ userId })
      setLogs(data)
    } catch (err) {
      showError('加载对话日志失败')
    } finally {
      setLoading(false)
    }
  }

  const handleSearch = () => {
    loadLogs(userIdFilter || undefined)
  }

  // Group logs by date for chart
  const logsByDate = logs.reduce((acc: Record<string, number>, log) => {
    const date = new Date(log.timestamp).toLocaleDateString('zh-CN')
    acc[date] = (acc[date] || 0) + 1
    return acc
  }, {})

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
          <Input
            placeholder="按用户ID搜索..."
            value={userIdFilter}
            onChange={(e) => setUserIdFilter(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            className="pl-9"
          />
        </div>
        <Button onClick={handleSearch} size="sm">搜索</Button>
        {userIdFilter && (
          <Button
            onClick={() => {
              setUserIdFilter('')
              loadLogs()
            }}
            variant="outline"
            size="sm"
          >
            清除
          </Button>
        )}
      </div>

      {/* Simple Chart */}
      <div className="rounded-lg border border-border bg-card p-4">
        <h3 className="mb-4 font-medium">每日对话次数</h3>
        <div className="space-y-2">
          {Object.entries(logsByDate).slice(-7).map(([date, count]) => (
            <div key={date} className="flex items-center gap-2">
              <span className="text-xs text-muted w-24">{date}</span>
              <div className="flex-1 bg-muted rounded-full h-6 relative">
                <div
                  className="bg-primary rounded-full h-6 flex items-center justify-end pr-2"
                  style={{ width: `${Math.min((count / Math.max(...Object.values(logsByDate))) * 100, 100)}%` }}
                >
                  <span className="text-xs text-white font-medium">{count}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Log List */}
      <div className="rounded-lg border border-border bg-card">
        <div className="p-4">
          <h3 className="mb-4 font-medium">对话记录 (最近1000条)</h3>
          {loading ? (
            <div className="text-center py-8 text-muted">加载中...</div>
          ) : logs.length === 0 ? (
            <div className="text-center py-8 text-muted">暂无记录</div>
          ) : (
            <div className="space-y-2">
              {logs.map((log) => (
                <div
                  key={log.id}
                  className="flex items-center justify-between rounded-lg border border-border p-3 text-sm hover:bg-muted/50"
                >
                  <div className="flex-1 grid grid-cols-5 gap-4">
                    <div>
                      <span className="text-xs text-muted">用户ID:</span>
                      <div className="font-mono text-xs truncate">{log.userId}</div>
                    </div>
                    <div>
                      <span className="text-xs text-muted">类型:</span>
                      <div>
                        <span className={`inline-block px-2 py-0.5 rounded text-xs ${
                          log.userType === 'cloud' ? 'bg-blue-100 text-blue-700' : 'bg-green-100 text-green-700'
                        }`}>
                          {log.userType === 'cloud' ? '云端' : '本地'}
                        </span>
                      </div>
                    </div>
                    <div>
                      <span className="text-xs text-muted">模型:</span>
                      <div className="truncate">{log.modelName || 'N/A'}</div>
                    </div>
                    <div>
                      <span className="text-xs text-muted">IP:</span>
                      <div className="truncate">{log.ipAddress}</div>
                    </div>
                    <div>
                      <span className="text-xs text-muted">时间:</span>
                      <div className="truncate">{new Date(log.timestamp).toLocaleString('zh-CN')}</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function FileStatistics() {
  const [logs, setLogs] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [userIdFilter, setUserIdFilter] = useState('')
  const { error: showError } = useToast()

  useEffect(() => {
    loadLogs()
  }, [])

  const loadLogs = async (userId?: string) => {
    setLoading(true)
    try {
      const data = await authService.getFileLogs({ userId })
      setLogs(data)
    } catch (err) {
      showError('加载文件日志失败')
    } finally {
      setLoading(false)
    }
  }

  const handleSearch = () => {
    loadLogs(userIdFilter || undefined)
  }

  // Group logs by date for chart
  const logsByDate = logs.reduce((acc: Record<string, number>, log) => {
    const date = new Date(log.timestamp).toLocaleDateString('zh-CN')
    acc[date] = (acc[date] || 0) + 1
    return acc
  }, {})

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
          <Input
            placeholder="按用户ID搜索..."
            value={userIdFilter}
            onChange={(e) => setUserIdFilter(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            className="pl-9"
          />
        </div>
        <Button onClick={handleSearch} size="sm">搜索</Button>
        {userIdFilter && (
          <Button
            onClick={() => {
              setUserIdFilter('')
              loadLogs()
            }}
            variant="outline"
            size="sm"
          >
            清除
          </Button>
        )}
      </div>

      {/* Simple Chart */}
      <div className="rounded-lg border border-border bg-card p-4">
        <h3 className="mb-4 font-medium">每日创建文件次数</h3>
        <div className="space-y-2">
          {Object.entries(logsByDate).slice(-7).map(([date, count]) => (
            <div key={date} className="flex items-center gap-2">
              <span className="text-xs text-muted w-24">{date}</span>
              <div className="flex-1 bg-muted rounded-full h-6 relative">
                <div
                  className="bg-primary rounded-full h-6 flex items-center justify-end pr-2"
                  style={{ width: `${Math.min((count / Math.max(...Object.values(logsByDate))) * 100, 100)}%` }}
                >
                  <span className="text-xs text-white font-medium">{count}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Log List */}
      <div className="rounded-lg border border-border bg-card">
        <div className="p-4">
          <h3 className="mb-4 font-medium">文件创建记录 (最近1000条)</h3>
          {loading ? (
            <div className="text-center py-8 text-muted">加载中...</div>
          ) : logs.length === 0 ? (
            <div className="text-center py-8 text-muted">暂无记录</div>
          ) : (
            <div className="space-y-2">
              {logs.map((log) => (
                <div
                  key={log.id}
                  className="flex items-center justify-between rounded-lg border border-border p-3 text-sm hover:bg-muted/50"
                >
                  <div className="flex-1 grid grid-cols-5 gap-4">
                    <div>
                      <span className="text-xs text-muted">用户ID:</span>
                      <div className="font-mono text-xs truncate">{log.userId}</div>
                    </div>
                    <div>
                      <span className="text-xs text-muted">类型:</span>
                      <div>
                        <span className={`inline-block px-2 py-0.5 rounded text-xs ${
                          log.userType === 'cloud' ? 'bg-blue-100 text-blue-700' : 'bg-green-100 text-green-700'
                        }`}>
                          {log.userType === 'cloud' ? '云端' : '本地'}
                        </span>
                      </div>
                    </div>
                    <div>
                      <span className="text-xs text-muted">文件:</span>
                      <div className="truncate" title={log.fileTitle}>{log.fileTitle}</div>
                    </div>
                    <div>
                      <span className="text-xs text-muted">IP:</span>
                      <div className="truncate">{log.ipAddress}</div>
                    </div>
                    <div>
                      <span className="text-xs text-muted">时间:</span>
                      <div className="truncate">{new Date(log.timestamp).toLocaleString('zh-CN')}</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

