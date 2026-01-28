import {useEffect, useState} from 'react'
import {authService} from '@/services/authService'
import {useToast} from '@/hooks/useToast'
import {useFormatDate} from '@/hooks/useTranslation'
import {Button, Input} from '@/components/ui'
import {Copy, Search} from 'lucide-react'
import {useSystemStore} from '@/stores/systemStore'

export function UsageStatistics() {
  const [activeStatsTab, setActiveStatsTab] = useState<'chat' | 'file'>('chat')
  const language = useSystemStore((state) => state.language)
  const i18nTexts = useSystemStore((state) => state.i18nTexts)

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
          {i18nTexts.adminChatStats[language]}
        </button>
        <button
          onClick={() => setActiveStatsTab('file')}
          className={`px-4 py-2 text-sm font-medium transition-colors ${
            activeStatsTab === 'file'
              ? 'border-b-2 border-primary text-primary'
              : 'text-muted hover:text-primary'
          }`}
        >
          {i18nTexts.adminFileStats[language]}
        </button>
      </div>

      {activeStatsTab === 'chat' && <ChatStatistics />}
      {activeStatsTab === 'file' && <FileStatistics />}
    </div>
  )
}

function ChatStatistics() {
  const [logs, setLogs] = useState<any[]>([])
  const [stats, setStats] = useState<Array<{ date: string, count: number }>>([])
  const [loading, setLoading] = useState(true)
  const [statsLoading, setStatsLoading] = useState(true)
  const [userIdFilter, setUserIdFilter] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [userMap, setUserMap] = useState<Record<string, { username?: string, nickname?: string, type: 'cloud' | 'local' }>>({})
  const pageSize = 5
  const { error: showError, success } = useToast()
  const { formatDate: formatDateByLocale } = useFormatDate()
  const language = useSystemStore((state) => state.language)
  const i18nTexts = useSystemStore((state) => state.i18nTexts)

  useEffect(() => {
    loadUsers()
  }, [])

  useEffect(() => {
    loadLogs()
  }, [currentPage])

  useEffect(() => {
    loadStats()
  }, [userIdFilter])

  const loadUsers = async () => {
    try {
      const [cloudUsers, localUsers] = await Promise.all([
        authService.getUsers(),
        authService.getLocalUsers()
      ])

      const map: Record<string, { username?: string, nickname?: string, type: 'cloud' | 'local' }> = {}
      cloudUsers.forEach((u: any) => {
        map[u.id] = { username: u.username, nickname: u.nickname, type: 'cloud' }
      })
      localUsers.forEach((u: any) => {
        map[u.id] = { nickname: u.nickname, type: 'local' }
      })

      setUserMap(map)
    } catch (err) {
      // Silently fail, user info is optional
    }
  }

  const getUserDisplay = (userId: string, userType: string) => {
    const user = userMap[userId]
    if (!user) return userId

    if (user.type === 'cloud') {
      return user.nickname || user.username || userId
    } else {
      return user.nickname || i18nTexts.statsLocalUser[language]
    }
  }

  const loadLogs = async (userId?: string, page?: number) => {
    setLoading(true)
    try {
      const params: any = { page: page || currentPage, pageSize }
      if (userId) params.userId = userId
      const data = await authService.getChatLogs(params)
      setLogs(data.items || [])
      setTotal(data.total || 0)
    } catch (err) {
      showError(language === 'zh' ? '加载对话日志失败' : 'Failed to load chat logs')
    } finally {
      setLoading(false)
    }
  }

  const loadStats = async () => {
    setStatsLoading(true)
    try {
      const params = userIdFilter ? { userId: userIdFilter } : undefined
      const data = await authService.getChatStatsByDate(params)
      setStats(data)
    } catch (err) {
      showError(language === 'zh' ? '加载统计数据失败' : 'Failed to load statistics')
    } finally {
      setStatsLoading(false)
    }
  }

  const handleSearch = () => {
    setCurrentPage(1)
    loadLogs(userIdFilter || undefined, 1)
    loadStats()
  }

  // Format date for display
  const formatDate = (dateStr: string) => {
    return formatDateByLocale(new Date(dateStr), 'short')
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
          <Input
            placeholder={i18nTexts.statsSearchByUserID[language]}
            value={userIdFilter}
            onChange={(e) => setUserIdFilter(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            className="pl-9"
          />
        </div>
        <Button onClick={handleSearch} size="sm">{i18nTexts.statsSearch[language]}</Button>
        {userIdFilter && (
          <Button
            onClick={() => {
              setUserIdFilter('')
              setCurrentPage(1)
              loadLogs(undefined, 1)
              loadStats()
            }}
            variant="outline"
            size="sm"
          >
            {i18nTexts.statsClear[language]}
          </Button>
        )}
      </div>

      {/* Simple Chart */}
      <div className="rounded-lg border border-border bg-card p-4">
        <h3 className="mb-4 font-medium">{i18nTexts.statsLast7DaysDailyChats[language]} {userIdFilter && `(${i18nTexts.statsUserLabel[language]} ${userIdFilter})`}</h3>
        {statsLoading ? (
          <div className="text-center py-8 text-muted">{i18nTexts.statsLoading[language]}</div>
        ) : stats.length === 0 ? (
          <div className="text-center py-8 text-muted">{i18nTexts.statsNoData[language]}</div>
        ) : (
          <div className="space-y-2">
            {stats.map(({ date, count }) => (
              <div key={date} className="flex items-center gap-2">
                <span className="text-xs text-muted w-24">{formatDate(date)}</span>
                <div className="flex-1 bg-muted rounded-full h-6 relative">
                  <div
                    className="bg-primary rounded-full h-6 flex items-center justify-end pr-2"
                    style={{ width: `${Math.min((count / Math.max(...stats.map(s => s.count))) * 100, 100)}%` }}
                  >
                    <span className="text-xs text-white font-medium">{count}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Log List */}
      <div className="rounded-lg border border-border bg-card">
        <div className="p-4">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="font-medium">{i18nTexts.statsChatRecords[language]} ({i18nTexts.statsTotal[language]} {total} {i18nTexts.statsRecords[language]})</h3>
            {total > 0 && (
              <div className="flex items-center gap-2 text-sm text-muted">
                <span>{i18nTexts.paginationPage[language]} {currentPage} {i18nTexts.paginationOf[language]} {Math.ceil(total / pageSize)} {i18nTexts.paginationTotal[language]}</span>
              </div>
            )}
          </div>
          {loading ? (
            <div className="text-center py-8 text-muted">{i18nTexts.statsLoading[language]}</div>
          ) : logs.length === 0 ? (
            <div className="text-center py-8 text-muted">{i18nTexts.statsNoRecords[language]}</div>
          ) : (
            <div className="space-y-2">
              {logs.map((log) => (
                <div
                  key={log.id}
                  className="flex items-center justify-between rounded-lg border border-border p-3 text-sm hover:bg-muted/50"
                >
                  <div className="flex-1 grid grid-cols-5 gap-4">
                    <div>
                      <span className="text-xs text-muted">{i18nTexts.adminUser[language]}: <span className="font-medium text-foreground">{getUserDisplay(log.userId, log.userType)}</span></span>
                      <div className="flex items-center gap-1">
                        <div className="font-mono text-xs text-muted" title={log.userId}>{log.userId}</div>
                        <button
                          onClick={() => {
                            navigator.clipboard.writeText(log.userId)
                            success(i18nTexts.statsCopyUserID[language])
                          }}
                          className="inline-flex items-center justify-center hover:bg-muted rounded p-0.5 transition-colors"
                          title={i18nTexts.statsCopyUserIDTitle[language]}
                        >
                          <Copy className="h-3 w-3" />
                        </button>
                      </div>
                    </div>
                    <div>
                      <span className="text-xs text-muted">{i18nTexts.statsUserType[language]}</span>
                      <div>
                        <span className={`inline-block px-2 py-0.5 rounded text-xs ${
                          log.userType === 'cloud' ? 'bg-blue-100 text-blue-700' : 'bg-green-100 text-green-700'
                        }`}>
                          {log.userType === 'cloud' ? i18nTexts.statsCloudUser[language] : i18nTexts.statsLocalUserType[language]}
                        </span>
                      </div>
                    </div>
                    <div>
                      <span className="text-xs text-muted">{i18nTexts.statsModel[language]}</span>
                      <div className="truncate">{log.modelName || 'N/A'}</div>
                    </div>
                    <div>
                      <span className="text-xs text-muted">{i18nTexts.statsIP[language]}</span>
                      <div className="truncate">{log.ipAddress}</div>
                    </div>
                    <div>
                      <span className="text-xs text-muted">{i18nTexts.statsTime[language]}</span>
                      <div className="truncate">{formatDateByLocale(new Date(log.timestamp), 'datetime')}</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Pagination */}
          {!loading && logs.length > 0 && (
            <div className="mt-4 flex items-center justify-between border-t border-border pt-4">
              <div className="text-sm text-muted">
                {i18nTexts.paginationShowing[language]} {(currentPage - 1) * pageSize + 1} - {Math.min(currentPage * pageSize, total)} {i18nTexts.paginationTo[language]} {total} {i18nTexts.statsRecords[language]}
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                >
                  {i18nTexts.paginationPrevious[language]}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(p => Math.min(Math.ceil(total / pageSize), p + 1))}
                  disabled={currentPage >= Math.ceil(total / pageSize)}
                >
                  {i18nTexts.paginationNext[language]}
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function FileStatistics() {
  const [logs, setLogs] = useState<any[]>([])
  const [stats, setStats] = useState<Array<{ date: string, count: number }>>([])
  const [loading, setLoading] = useState(true)
  const [statsLoading, setStatsLoading] = useState(true)
  const [userIdFilter, setUserIdFilter] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [userMap, setUserMap] = useState<Record<string, { username?: string, nickname?: string, type: 'cloud' | 'local' }>>({})
  const pageSize = 5
  const { error: showError, success } = useToast()
  const { formatDate: formatDateByLocale } = useFormatDate()
  const language = useSystemStore((state) => state.language)
  const i18nTexts = useSystemStore((state) => state.i18nTexts)

  useEffect(() => {
    loadUsers()
  }, [])

  useEffect(() => {
    loadLogs()
  }, [currentPage])

  useEffect(() => {
    loadStats()
  }, [userIdFilter])

  const loadUsers = async () => {
    try {
      const [cloudUsers, localUsers] = await Promise.all([
        authService.getUsers(),
        authService.getLocalUsers()
      ])

      const map: Record<string, { username?: string, nickname?: string, type: 'cloud' | 'local' }> = {}
      cloudUsers.forEach((u: any) => {
        map[u.id] = { username: u.username, nickname: u.nickname, type: 'cloud' }
      })
      localUsers.forEach((u: any) => {
        map[u.id] = { nickname: u.nickname, type: 'local' }
      })

      setUserMap(map)
    } catch (err) {
      // Silently fail, user info is optional
    }
  }

  const getUserDisplay = (userId: string, userType: string) => {
    const user = userMap[userId]
    if (!user) return userId

    if (user.type === 'cloud') {
      return user.nickname || user.username || userId
    } else {
      return user.nickname || i18nTexts.statsLocalUser[language]
    }
  }

  const loadLogs = async (userId?: string, page?: number) => {
    setLoading(true)
    try {
      const params: any = { page: page || currentPage, pageSize }
      if (userId) params.userId = userId
      const data = await authService.getFileLogs(params)
      setLogs(data.items || [])
      setTotal(data.total || 0)
    } catch (err) {
      showError(language === 'zh' ? '加载文件日志失败' : 'Failed to load file logs')
    } finally {
      setLoading(false)
    }
  }

  const loadStats = async () => {
    setStatsLoading(true)
    try {
      const params = userIdFilter ? { userId: userIdFilter } : undefined
      const data = await authService.getFileStatsByDate(params)
      setStats(data)
    } catch (err) {
      showError(language === 'zh' ? '加载统计数据失败' : 'Failed to load statistics')
    } finally {
      setStatsLoading(false)
    }
  }

  const handleSearch = () => {
    setCurrentPage(1)
    loadLogs(userIdFilter || undefined, 1)
    loadStats()
  }

  // Format date for display
  const formatDate = (dateStr: string) => {
    return formatDateByLocale(new Date(dateStr), 'short')
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
          <Input
            placeholder={i18nTexts.statsSearchByUserID[language]}
            value={userIdFilter}
            onChange={(e) => setUserIdFilter(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            className="pl-9"
          />
        </div>
        <Button onClick={handleSearch} size="sm">{i18nTexts.statsSearch[language]}</Button>
        {userIdFilter && (
          <Button
            onClick={() => {
              setUserIdFilter('')
              setCurrentPage(1)
              loadLogs(undefined, 1)
              loadStats()
            }}
            variant="outline"
            size="sm"
          >
            {i18nTexts.statsClear[language]}
          </Button>
        )}
      </div>

      {/* Simple Chart */}
      <div className="rounded-lg border border-border bg-card p-4">
        <h3 className="mb-4 font-medium">{i18nTexts.statsLast7DaysDailyFiles[language]} {userIdFilter && `(${i18nTexts.statsUserLabel[language]} ${userIdFilter})`}</h3>
        {statsLoading ? (
          <div className="text-center py-8 text-muted">{i18nTexts.statsLoading[language]}</div>
        ) : stats.length === 0 ? (
          <div className="text-center py-8 text-muted">{i18nTexts.statsNoData[language]}</div>
        ) : (
          <div className="space-y-2">
            {stats.map(({ date, count }) => (
              <div key={date} className="flex items-center gap-2">
                <span className="text-xs text-muted w-24">{formatDate(date)}</span>
                <div className="flex-1 bg-muted rounded-full h-6 relative">
                  <div
                    className="bg-primary rounded-full h-6 flex items-center justify-end pr-2"
                    style={{ width: `${Math.min((count / Math.max(...stats.map(s => s.count))) * 100, 100)}%` }}
                  >
                    <span className="text-xs text-white font-medium">{count}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Log List */}
      <div className="rounded-lg border border-border bg-card">
        <div className="p-4">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="font-medium">{i18nTexts.statsFileRecords[language]} ({i18nTexts.statsTotal[language]} {total} {i18nTexts.statsRecords[language]})</h3>
            {total > 0 && (
              <div className="flex items-center gap-2 text-sm text-muted">
                <span>{i18nTexts.paginationPage[language]} {currentPage} {i18nTexts.paginationOf[language]} {Math.ceil(total / pageSize)} {i18nTexts.paginationTotal[language]}</span>
              </div>
            )}
          </div>
          {loading ? (
            <div className="text-center py-8 text-muted">{i18nTexts.statsLoading[language]}</div>
          ) : logs.length === 0 ? (
            <div className="text-center py-8 text-muted">{i18nTexts.statsNoRecords[language]}</div>
          ) : (
            <div className="space-y-2">
              {logs.map((log) => (
                <div
                  key={log.id}
                  className="flex items-center justify-between rounded-lg border border-border p-3 text-sm hover:bg-muted/50"
                >
                  <div className="flex-1 grid grid-cols-5 gap-4">
                    <div>
                      <span className="text-xs text-muted">{i18nTexts.adminUser[language]}: <span className="font-medium text-foreground">{getUserDisplay(log.userId, log.userType)}</span></span>
                      <div className="flex items-center gap-1">
                        <div className="font-mono text-xs text-muted" title={log.userId}>{log.userId}</div>
                        <button
                          onClick={() => {
                            navigator.clipboard.writeText(log.userId)
                            success(i18nTexts.statsCopyUserID[language])
                          }}
                          className="inline-flex items-center justify-center hover:bg-muted rounded p-0.5 transition-colors"
                          title={i18nTexts.statsCopyUserIDTitle[language]}
                        >
                          <Copy className="h-3 w-3" />
                        </button>
                      </div>
                    </div>
                    <div>
                      <span className="text-xs text-muted">{i18nTexts.statsUserType[language]}</span>
                      <div>
                        <span className={`inline-block px-2 py-0.5 rounded text-xs ${
                          log.userType === 'cloud' ? 'bg-blue-100 text-blue-700' : 'bg-green-100 text-green-700'
                        }`}>
                          {log.userType === 'cloud' ? i18nTexts.statsCloudUser[language] : i18nTexts.statsLocalUserType[language]}
                        </span>
                      </div>
                    </div>
                    <div>
                      <span className="text-xs text-muted">{i18nTexts.statsFile[language]}</span>
                      <div className="truncate" title={log.fileTitle}>{log.fileTitle}</div>
                    </div>
                    <div>
                      <span className="text-xs text-muted">{i18nTexts.statsIP[language]}</span>
                      <div className="truncate">{log.ipAddress}</div>
                    </div>
                    <div>
                      <span className="text-xs text-muted">{i18nTexts.statsTime[language]}</span>
                      <div className="truncate">{formatDateByLocale(new Date(log.timestamp), 'datetime')}</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Pagination */}
          {!loading && logs.length > 0 && (
            <div className="mt-4 flex items-center justify-between border-t border-border pt-4">
              <div className="text-sm text-muted">
                {i18nTexts.paginationShowing[language]} {(currentPage - 1) * pageSize + 1} - {Math.min(currentPage * pageSize, total)} {i18nTexts.paginationTo[language]} {total} {i18nTexts.statsRecords[language]}
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                >
                  {i18nTexts.paginationPrevious[language]}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(p => Math.min(Math.ceil(total / pageSize), p + 1))}
                  disabled={currentPage >= Math.ceil(total / pageSize)}
                >
                  {i18nTexts.paginationNext[language]}
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

