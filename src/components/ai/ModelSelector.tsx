import {useEffect, useRef, useState} from 'react'
import {Check, ChevronDown, Search, Server, Settings} from 'lucide-react'
import {Button, Dialog, DialogContent, Input} from '@/components/ui'
import {ProviderIcon} from '@/components/icons/ProviderIcon'
import {authService} from '@/services/authService'
import {useToast} from '@/hooks/useToast'
import {useStorageModeStore} from '@/stores/storageModeStore'
import {useSystemStore} from '@/stores/systemStore'
import {useNavigate} from 'react-router-dom'

interface Provider {
  id: string
  name: string
  type: string
  baseUrl: string
  apiKey: string
  modelId: string
  models?: string[]
}

interface ModelSelectorProps {
  className?: string
}

const ScrollableText = ({ text, className }: { text: string, className?: string }) => {
  const containerRef = useRef<HTMLDivElement>(null)
  const textRef = useRef<HTMLSpanElement>(null)
  const [shouldScroll, setShouldScroll] = useState(false)

  useEffect(() => {
    if (containerRef.current && textRef.current) {
      setShouldScroll(textRef.current.offsetWidth > containerRef.current.offsetWidth)
    }
  }, [text])

  return (
    <div
      ref={containerRef}
      className={`relative overflow-hidden ${className}`}
      title={text}
    >
      {shouldScroll ? (
        <>
          <div className="flex animate-marquee">
            <span className="whitespace-nowrap mr-4">{text}</span>
            <span className="whitespace-nowrap mr-4">{text}</span>
          </div>
          <style>{`
            @keyframes marquee {
              0% { transform: translateX(0); }
              100% { transform: translateX(-50%); }
            }
            .animate-marquee {
              animation: marquee 8s linear infinite;
              width: fit-content;
            }
            .animate-marquee:hover {
              animation-play-state: paused;
            }
          `}</style>
        </>
      ) : (
        <span ref={textRef} className="whitespace-nowrap block truncate">
          {text}
        </span>
      )}
    </div>
  )
}

export function ModelSelector({ className }: ModelSelectorProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [providers, setProviders] = useState<Provider[]>([])
  const [activeId, setActiveId] = useState<string>('system')
  const [searchQuery, setSearchQuery] = useState('')
  const { success, error: showError } = useToast()
  const storageMode = useStorageModeStore((state) => state.mode)
  const language = useSystemStore((state) => state.language)
  const i18nTexts = useSystemStore((state) => state.i18nTexts)
  const navigate = useNavigate()

  useEffect(() => {
    if (isOpen) {
      loadUserConfig()
    }
  }, [isOpen])

  // Also load initially to show current model name
  useEffect(() => {
    loadUserConfig()
  }, [])

  const loadUserConfig = async () => {
    try {
      const profile = await authService.getUserProfile()
      if (profile.aiConfig) {
        if (profile.aiConfig.providers) {
          setProviders(profile.aiConfig.providers)
        }

        if (profile.aiConfig.useCustom && profile.aiConfig.currentProviderId) {
          setActiveId(profile.aiConfig.currentProviderId)
        } else {
          setActiveId('system')
        }
      }
    } catch (err) {
      // Ignore error
    }
  }

  const handleSelectModel = async (providerId: string, modelId?: string) => {
    try {
      // If selecting system default
      if (providerId === 'system') {
        await authService.updateUserAIConfig({
          useCustom: false,
          currentProviderId: undefined,
          // Keep existing providers
          providers: providers
        })
        setActiveId('system')
        setIsOpen(false)
        success('已切换到系统默认模型')
        return
      }

      // If selecting a specific model from a provider
      if (modelId) {
        // Update the provider's selected model
        const updatedProviders = providers.map(p =>
          p.id === providerId ? { ...p, modelId } : p
        )
        setProviders(updatedProviders)

        await authService.updateUserAIConfig({
          useCustom: true,
          currentProviderId: providerId,
          providers: updatedProviders
        })
        setActiveId(providerId)
        setIsOpen(false)
        success(`已切换到模型: ${modelId}`)
      }
    } catch (err) {
      showError('切换模型失败')
    }
  }

  const getCurrentModelName = () => {
    if (activeId === 'system') return i18nTexts.homeSystemDefault[language]
    const provider = providers.find(p => p.id === activeId)
    return provider ? (provider.modelId || provider.name) : (language === 'zh' ? '未知模型' : 'Unknown Model')
  }

  const getCurrentProviderType = () => {
    if (activeId === 'system') return 'system'
    const provider = providers.find(p => p.id === activeId)
    return provider ? provider.type : 'bot'
  }

  const filteredProviders = providers.filter(p => {
    if (!searchQuery) return true
    const query = searchQuery.toLowerCase()
    return (
      p.name.toLowerCase().includes(query) ||
      (p.models || []).some(m => m.toLowerCase().includes(query))
    )
  })

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        className={`gap-2 h-8 rounded-full bg-background/50 backdrop-blur-sm border-border/50 hover:bg-muted/50 hover:border-primary/30 transition-all ${className}`}
        onClick={() => setIsOpen(true)}
      >
        <div className="flex items-center gap-1.5">
          {activeId === 'system' ? (
            <Server className="h-3.5 w-3.5 text-primary shrink-0" />
          ) : (
            <div className="shrink-0">
              <ProviderIcon type={getCurrentProviderType()} />
            </div>
          )}
          <ScrollableText
            text={getCurrentModelName()}
            className="text-xs font-medium w-[70px]"
          />
        </div>
        <ChevronDown className="h-3 w-3 text-muted-foreground opacity-50 shrink-0" />
      </Button>

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="sm:max-w-[500px] p-0 gap-0 overflow-hidden rounded-xl">
          <div className="p-4 border-b border-border pr-12">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder={i18nTexts.profileSearchModel[language]}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 border border-border/50 bg-white focus-visible:ring-0 rounded-lg h-9"
              />
            </div>
          </div>

          <div className="h-[400px] overflow-y-auto p-2">
            {/* Local Mode Hint */}
            {storageMode === 'local' && (
              <div className="mb-3 px-3 py-2 rounded-lg bg-green-500/10 border border-green-500/20 text-xs text-green-600">
                {i18nTexts.profileLocalModeHint[language]}
              </div>
            )}

            {/* System Default */}
            {(!searchQuery || '系统默认'.includes(searchQuery) || '服务器默认'.includes(searchQuery)) && (
              <div className="mb-2">
                <div className="px-2 py-1.5 text-xs font-medium text-muted-foreground">默认</div>
                <button
                  onClick={() => handleSelectModel('system')}
                  className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm transition-colors ${
                    activeId === 'system'
                      ? 'bg-primary/10 text-primary'
                      : 'hover:bg-muted text-foreground'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className="flex h-8 w-8 items-center justify-center rounded-md bg-muted">
                      <Server className="h-4 w-4" />
                    </div>
                    <span>{i18nTexts.profileServerDefault[language]}</span>
                  </div>
                  {activeId === 'system' && <Check className="h-4 w-4" />}
                </button>
              </div>
            )}

            {/* Custom Providers */}
            {filteredProviders.map(provider => (
              <div key={provider.id} className="mb-2">
                <div className="px-2 py-1.5 text-xs font-medium text-muted-foreground flex items-center gap-2">
                  {provider.name}
                </div>
                <div className="space-y-1">
                  {provider.models && provider.models.length > 0 ? (
                    provider.models
                      .filter(m => !searchQuery || m.toLowerCase().includes(searchQuery.toLowerCase()))
                      .map(model => {
                        const isActive = activeId === provider.id && provider.modelId === model
                        return (
                          <button
                            key={model}
                            onClick={() => handleSelectModel(provider.id, model)}
                            className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm transition-colors ${
                              isActive
                                ? 'bg-primary/10 text-primary'
                                : 'hover:bg-muted text-foreground'
                            }`}
                          >
                            <div className="flex items-center gap-3 overflow-hidden">
                              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-muted">
                                <ProviderIcon type={provider.type} />
                              </div>
                              <span className="truncate">{model}</span>
                            </div>
                            {isActive && <Check className="h-4 w-4 shrink-0" />}
                          </button>
                        )
                      })
                  ) : (
                    <div className="px-3 py-2 text-sm text-muted-foreground italic">
                      暂无模型配置
                    </div>
                  )}
                </div>
              </div>
            ))}

            {filteredProviders.length === 0 && searchQuery && !'系统默认'.includes(searchQuery) && (
              <div className="py-8 text-center text-sm text-muted-foreground">
                未找到匹配的模型
              </div>
            )}
          </div>

          {/* Footer Config Button */}
          <div className="p-3 border-t border-border bg-muted/30 flex justify-end">
            <Button
              size="sm"
              className="gap-2 rounded-full bg-primary text-surface hover:bg-primary/90"
              onClick={() => {
                setIsOpen(false)
                navigate('/profile')
              }}
            >
              <Settings className="h-3.5 w-3.5" />
              <span>{i18nTexts.profileConfigModel[language]}</span>
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}

