import {type Dispatch, type SetStateAction, useEffect, useState} from 'react'
import {AppSidebar, CreateProjectDialog} from '@/components/layout'
import {
  Button,
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  Input,
} from '@/components/ui'
import {quotaService} from '@/services/quotaService'
import {authService} from '@/services/authService'
import {useToast} from '@/hooks/useToast'
import {
  Bot,
  Check,
  ChevronDown,
  Copy,
  Download,
  Eye,
  EyeOff,
  Plus,
  Search,
  Server,
  Sparkles,
  Trash2,
  User
} from 'lucide-react'
import {useAuthStore} from '@/stores/authStore'
import {useSystemStore} from '@/stores/systemStore'
import {useStorageModeStore} from '@/stores/storageModeStore'

interface Provider {
  id: string
  name: string
  type: string
  baseUrl: string
  apiKey: string
  modelId: string
  models?: string[]
}

const PRESET_PROVIDERS = [
  { type: 'custom', name: '自定义', baseUrl: '' },
  { type: 'openai', name: 'OpenAI', baseUrl: 'https://api.openai.com/v1' },
  { type: 'deepseek', name: 'DeepSeek', baseUrl: 'https://api.deepseek.com' },
  { type: 'siliconflow', name: '硅基流动', baseUrl: 'https://api.siliconflow.cn/v1' },
  { type: 'volcengine', name: '火山引擎', baseUrl: 'https://ark.cn-beijing.volces.com/api/v3' },
  { type: 'ollama', name: 'Ollama', baseUrl: 'http://localhost:11434/v1' },
  { type: 'moonshot', name: '月之暗面', baseUrl: 'https://api.moonshot.cn/v1' },
  { type: 'hunyuan', name: '腾讯混元', baseUrl: 'https://api.hunyuan.cloud.tencent.com/v1' },
  { type: 'newapi', name: 'New API', baseUrl: '' },
]

const ProviderIcon = ({ type }: { type: string }) => {
  switch (type) {
    case 'openai':
      return (
        <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="h-4 w-4">
          <path d="M22.2819 9.8211a5.9847 5.9847 0 0 0-.5157-4.9108 6.0462 6.0462 0 0 0-6.5098-2.9A6.0651 6.0651 0 0 0 4.9807 4.1818a5.9847 5.9847 0 0 0-3.9977 2.9 6.0462 6.0462 0 0 0 .7427 7.0966 5.98 5.98 0 0 0 .511 4.9107 6.051 6.051 0 0 0 6.5146 2.9001A5.9847 5.9847 0 0 0 13.2599 24a6.0557 6.0557 0 0 0 5.7718-4.2058 5.9894 5.9894 0 0 0 3.9977-2.9001 6.0557 6.0557 0 0 0-.7475-7.0729zm-9.022 12.6081a4.4755 4.4755 0 0 1-2.8764-1.0408l.1419-.0804 1.9016-1.116a.3194.3194 0 0 0 .1465-.2632v-2.6742l.8141.4716v4.4819a4.4755 4.4755 0 0 1-.1277.2211zm-9.6684-4.2634a4.466 4.466 0 0 1-.0852-3.0623l.142.0852 1.8921 1.116a.3241.3241 0 0 0 .3076 0L7.9757 15.17l-2.2936 3.8545a4.466 4.466 0 0 1-2.0918-2.8668zm6.5098-9.1183a4.4708 4.4708 0 0 1 3.0908-.0851l-.142.0851-1.8921 1.116a.3241.3241 0 0 0-.3076 0l-2.1341 1.2309-2.2936-3.8545a4.466 4.466 0 0 1 3.6786 1.5076zm12.349 2.2237a4.466 4.466 0 0 1 .0852 3.0623l-.142-.0852-1.8921-1.116a.3241.3241 0 0 0-.3076 0l-2.1341 1.2309 2.2936-3.8545a4.466 4.466 0 0 1 2.097 2.7625zm-3.3018 8.2628l-2.1341-1.231.0614-.0331 1.8921-1.116a.3241.3241 0 0 0 .1563-.2632v-2.4658l2.2841 3.9446a4.4708 4.4708 0 0 1-2.2598 1.1645zm-8.3766-5.346l-2.1341-1.2309 2.2936-3.8545a4.466 4.466 0 0 1 2.0918 2.8668l-.1419-.0804-1.9016-1.116a.3194.3194 0 0 0-.1465.2632v2.6742l-.8141-.4716a.3194.3194 0 0 0-.0473-.0506zm-1.2642 1.3065a1.79 1.79 0 0 1-1.7308-.0048 1.79 1.79 0 0 1-1.013-1.5434 1.79 1.79 0 0 1 1.0035-1.5481 1.79 1.79 0 0 1 1.7356-.0048 1.79 1.79 0 0 1 1.013 1.5481 1.79 1.79 0 0 1-1.0083 1.553z" fill="currentColor" />
        </svg>
      )
    case 'deepseek':
      return (
        <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="h-4 w-4">
          <path d="M12 2C6.48 2 2 6.48 2 12C2 17.52 6.48 22 12 22C17.52 22 22 17.52 22 12C22 6.48 17.52 2 12 2ZM10 17L5 12L6.41 10.59L10 14.17L17.59 6.58L19 8L10 17Z" fill="currentColor"/>
        </svg>
      )
    case 'siliconflow':
      return (
        <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="h-4 w-4">
          <path d="M4 4H20V20H4V4ZM6 6V18H18V6H6ZM8 8H16V16H8V8Z" fill="currentColor"/>
        </svg>
      )
    case 'volcengine':
      return (
        <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="h-4 w-4">
           <path d="M12 2L2 22H22L12 2Z" fill="currentColor"/>
        </svg>
      )
    case 'ollama':
      return (
        <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="h-4 w-4">
           <path d="M12 2C6.48 2 2 6.48 2 12C2 17.52 6.48 22 12 22C17.52 22 22 17.52 22 12C22 6.48 17.52 2 12 2ZM12 20C7.59 20 4 16.41 4 12C4 7.59 7.59 4 12 4C16.41 4 20 7.59 20 12C20 16.41 16.41 20 12 20Z" fill="currentColor"/>
           <circle cx="9" cy="10" r="1.5" fill="currentColor" className="text-background"/>
           <circle cx="15" cy="10" r="1.5" fill="currentColor" className="text-background"/>
           <path d="M12 16C10 16 9 15 9 15H15C15 15 14 16 12 16Z" fill="currentColor" className="text-background"/>
        </svg>
      )
    case 'moonshot':
      return (
        <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="h-4 w-4">
           <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" fill="currentColor"/>
        </svg>
      )
    case 'hunyuan':
      return (
        <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="h-4 w-4">
           <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2"/>
           <path d="M12 2C12 2 16 7 16 12C16 17 12 22 12 22" stroke="currentColor" strokeWidth="2"/>
           <path d="M12 2C12 2 8 7 8 12C8 17 12 22 12 22" stroke="currentColor" strokeWidth="2"/>
           <path d="M2 12H22" stroke="currentColor" strokeWidth="2"/>
        </svg>
      )
    case 'newapi':
      return (
        <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="h-4 w-4">
           <path d="M13 2L3 14H12L11 22L21 10H12L13 2Z" fill="currentColor"/>
        </svg>
      )
    default:
      return <Bot className="h-4 w-4" />
  }
}

interface UserAIConfigSectionProps {
  password: string
  setPassword: Dispatch<SetStateAction<string>>
  showPassword: boolean
  setShowPassword: Dispatch<SetStateAction<boolean>>
  onConfigSaved?: () => void
}

function UserAIConfigSection({
  password,
  setPassword,
  showPassword,
  setShowPassword,
  onConfigSaved,
}: UserAIConfigSectionProps) {
  const [providers, setProviders] = useState<Provider[]>([])
  const [selectedId, setSelectedId] = useState<string>('system')
  const [activeId, setActiveId] = useState<string>('system')
  const [loading, setLoading] = useState(false)
  const [showKey, setShowKey] = useState(false)
  const { success, error: showError } = useToast()
  const defaultModelPrompt = useSystemStore((state) => state.defaultModelPrompt)
  const language = useSystemStore((state) => state.language)
  const i18nTexts = useSystemStore((state) => state.i18nTexts)
  const [tempModelId, setTempModelId] = useState('')
  const storageMode = useStorageModeStore((state) => state.mode)
  const [isModelSelectorOpen, setIsModelSelectorOpen] = useState(false)

  // Form state for the selected provider
  const [formData, setFormData] = useState<Provider>({
    id: '',
    name: '',
    type: 'openai',
    baseUrl: '',
    apiKey: '',
    modelId: '',
    models: []
  })

  useEffect(() => {
    loadUserConfig()
  }, [])

  useEffect(() => {
    if (selectedId === 'system') {
      // Reset form data or set to system defaults if needed
    } else {
      const provider = providers.find(p => p.id === selectedId)
      if (provider) {
        setFormData({ ...provider, models: provider.models || [] })
      }
    }
  }, [selectedId, providers])

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

  const handleAddProvider = (preset?: typeof PRESET_PROVIDERS[0]) => {
    const newId = `custom-${Date.now()}`
    const newProvider: Provider = {
      id: newId,
      name: preset ? preset.name : 'New Provider',
      type: preset ? preset.type : 'openai',
      baseUrl: preset ? preset.baseUrl : '',
      apiKey: '',
      modelId: '',
      models: []
    }
    setProviders([...providers, newProvider])
    setSelectedId(newId)
  }

  const handleSetModelActive = (pId: string, mId: string) => {
    const updatedProviders = providers.map(p =>
      p.id === pId ? { ...p, modelId: mId } : p
    )
    setProviders(updatedProviders)
    setActiveId(pId)

    // Auto select the provider to show details
    setSelectedId(pId)

    if (selectedId === pId) {
      setFormData(prev => ({ ...prev, modelId: mId }))
    }

    // Auto save
    handleSave(updatedProviders, pId)
  }

  const handleDeleteProvider = (id: string) => {
    if (activeId === id) {
      setActiveId('system')
    }
    const updatedProviders = providers.filter(p => p.id !== id)
    setProviders(updatedProviders)
    if (selectedId === id) {
      setSelectedId('system')
    }
    // Auto save
    handleSave(updatedProviders, activeId === id ? 'system' : activeId)
  }

  const handleSave = async (currentProviders = providers, currentActiveId = activeId) => {
    setLoading(true)
    try {
      // Update the current provider in the list if we are editing one and not just switching
      let updatedProviders = [...currentProviders]
      if (selectedId !== 'system' && currentProviders === providers) {
         // If called without args (manual save or effect), update from formData
         updatedProviders = providers.map(p => p.id === selectedId ? formData : p)
         setProviders(updatedProviders)
      }

      await authService.updateUserAIConfig({
        useCustom: currentActiveId !== 'system',
        currentProviderId: currentActiveId === 'system' ? undefined : currentActiveId,
        providers: updatedProviders,
        // Legacy fields fallback
        provider: 'openai',
        baseUrl: '',
        apiKey: '',
        modelId: ''
      })

      success('配置已保存')
      onConfigSaved?.()
    } catch (err) {
      showError('保存配置失败')
    } finally {
      setLoading(false)
    }
  }

  // Auto save when formData changes (debounced)
  useEffect(() => {
      if (selectedId === 'system') return

      const timer = setTimeout(() => {
          // Only save if data actually changed from what's in providers
          const currentProvider = providers.find(p => p.id === selectedId)
          if (currentProvider && JSON.stringify(currentProvider) !== JSON.stringify(formData)) {
              handleSave()
          }
      }, 1000)

      return () => clearTimeout(timer)
  }, [formData, selectedId])

  const handleTestConnection = async () => {
    if (selectedId === 'system') return

    try {
      const validation = await authService.validateAIConfig({
        provider: formData.type,
        baseUrl: formData.baseUrl,
        apiKey: formData.apiKey,
        modelId: formData.modelId
      })

      if (validation.valid) {
        success('连接测试成功')
      } else {
        showError(validation.error || '连接测试失败')
      }
    } catch (err) {
      showError('连接测试失败')
    }
  }

  const handleModelsSelected = (selectedModels: string[]) => {
    const currentModels = formData.models || []
    const newModels = [...currentModels]

    selectedModels.forEach(model => {
      if (!newModels.includes(model)) {
        newModels.push(model)
      }
    })

    setFormData({
      ...formData,
      models: newModels
    })

    success(`已添加 ${selectedModels.length} 个模型`)
  }

  return (
    <>
      <ModelSelectorDialog
        open={isModelSelectorOpen}
        onOpenChange={setIsModelSelectorOpen}
        apiKey={formData.apiKey}
        baseUrl={formData.baseUrl}
        existingModels={formData.models || []}
        onConfirm={handleModelsSelected}
      />
    <div className="flex h-[calc(100vh-12rem)] min-h-[600px] rounded-xl border border-border bg-card overflow-hidden">
      {/* Left Sidebar */}
      <div className="w-64 border-r border-border bg-muted/30 flex flex-col">
        <div className="p-4 flex items-center justify-between">
          <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
            提供商
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-6 w-6">
                <Plus className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-56">
              {PRESET_PROVIDERS.map((preset) => (
                <DropdownMenuItem key={preset.type} onClick={() => handleAddProvider(preset)}>
                  {preset.name}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <div className="flex-1 overflow-y-auto px-2 space-y-1">
          {/* System Default */}
          <div className="flex flex-col">
            <button
              onClick={() => setSelectedId('system')}
              className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-sm transition-colors ${
                selectedId === 'system'
                  ? 'bg-background shadow-sm text-primary'
                  : 'text-muted-foreground hover:bg-background/50 hover:text-primary'
              }`}
            >
              <div className="flex items-center gap-2">
                <div className="flex h-6 w-6 items-center justify-center rounded bg-primary/10">
                  <Server className="h-3.5 w-3.5 text-primary" />
                </div>
                <span>系统默认</span>
              </div>
              {activeId === 'system' && <Check className="h-3.5 w-3.5 text-green-500" />}
            </button>

            {/* System Default Models List (Fake one) */}
            <div className="ml-4 pl-2 border-l border-border/50 space-y-0.5 mt-1 mb-2">
                <div
                    className={`flex items-center gap-2 px-2 py-1.5 text-xs rounded-md cursor-pointer hover:bg-background/50 ${activeId === 'system' ? 'text-primary font-medium' : 'text-muted-foreground'}`}
                    onClick={(e) => {
                        e.stopPropagation();
                        setActiveId('system');
                        // Also select it to show details
                        setSelectedId('system');
                        handleSave(providers, 'system');
                    }}
                >
                    <div className={`h-3 w-3 rounded-full border flex items-center justify-center ${activeId === 'system' ? 'border-primary bg-primary' : 'border-muted-foreground/30'}`}>
                        {activeId === 'system' && <Check className="h-2 w-2 text-white" />}
                    </div>
                    <span className="truncate">默认模型</span>
                </div>
            </div>
          </div>

          {/* Custom Providers */}
          {providers.map(provider => (
            <div key={provider.id} className="flex flex-col">
              <button
                onClick={() => setSelectedId(provider.id)}
                className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-sm transition-colors ${
                  selectedId === provider.id
                    ? 'bg-background shadow-sm text-primary'
                    : 'text-muted-foreground hover:bg-background/50 hover:text-primary'
                }`}
              >
                <div className="flex items-center gap-2 overflow-hidden">
                  <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded bg-muted text-muted-foreground">
                    <ProviderIcon type={provider.type} />
                  </div>
                  <span className="truncate">{provider.name}</span>
                </div>
                {/* Provider active check is now on models, but we can keep it if no models or just as indicator */}
                {activeId === provider.id && <Check className="h-3.5 w-3.5 text-green-500" />}
              </button>

              {/* Models List */}
              {provider.models && provider.models.length > 0 && (
                  <div className="ml-4 pl-2 border-l border-border/50 space-y-0.5 mt-1 mb-2">
                      {provider.models.map(model => {
                          const isActive = activeId === provider.id && provider.modelId === model;
                          return (
                              <div
                                  key={model}
                                  className={`flex items-center gap-2 px-2 py-1.5 text-xs rounded-md cursor-pointer hover:bg-background/50 ${isActive ? 'text-primary font-medium' : 'text-muted-foreground'}`}
                                  onClick={(e) => {
                                      e.stopPropagation();
                                      handleSetModelActive(provider.id, model);
                                  }}
                              >
                                  <div className={`h-3 w-3 rounded-full border flex items-center justify-center ${isActive ? 'border-primary bg-primary' : 'border-muted-foreground/30'}`}>
                                      {isActive && <Check className="h-2 w-2 text-white" />}
                                  </div>
                                  <span className="truncate">{model}</span>
                              </div>
                          )
                      })}
                  </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Right Content */}
      <div className="flex-1 flex flex-col h-full overflow-hidden">
              {selectedId === 'system' ? (
                <div className="flex-1 p-8 flex flex-col items-center justify-center text-center">
                  <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center mb-6">
                    <Server className="h-8 w-8 text-primary" />
                  </div>
                  <h3 className="text-xl font-medium text-primary mb-2">{i18nTexts.profileServerDefault[language]}</h3>
                  <p className="text-muted-foreground max-w-md mb-8">
                    {language === 'zh' ? defaultModelPrompt : i18nTexts.profileSystemDefaultHint[language]}
                  </p>
                </div>
              ) : (
          <div className="flex-1 flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-border">
            <div className="flex items-center gap-4">
                <div className="h-12 w-12 rounded-lg bg-muted flex items-center justify-center text-lg font-medium">
                  {formData.name.substring(0, 1).toUpperCase()}
                </div>
                <div>
                  <Input
                    value={formData.name}
                    onChange={(e) => setFormData({...formData, name: e.target.value})}
                    className="h-8 text-lg font-medium border-transparent hover:border-input focus:border-input px-0"
                  />
                  <p className="text-sm text-muted-foreground">自定义模型配置</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    className="text-destructive hover:text-destructive hover:bg-destructive/10"
                    onClick={() => handleDeleteProvider(selectedId)}
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    删除提供商
                  </Button>
              </div>
            </div>

            {/* Form */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {storageMode === 'local' && (
            <div className="mb-4 px-4 py-3 rounded-lg bg-green-500/10 border border-green-500/20 text-sm text-green-600">
              {i18nTexts.profileLocalModeHint[language]}
            </div>
          )}
              <div>
                <label className="mb-2 block text-sm font-medium text-muted">API Key</label>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Input
                      type={showKey ? 'text' : 'password'}
                      value={formData.apiKey}
                      onChange={(e) => setFormData({...formData, apiKey: e.target.value})}
                      placeholder="sk-..."
                      className="pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowKey(!showKey)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-primary"
                    >
                      {showKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                  <Button variant="secondary" onClick={handleTestConnection}>测试</Button>
                </div>
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-muted">基础 URL (可选)</label>
                <Input
                  value={formData.baseUrl}
                  onChange={(e) => setFormData({...formData, baseUrl: e.target.value})}
                  placeholder="https://api.openai.com/v1"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-muted">模型</label>
                <div className="flex flex-col gap-2">
                   {/* Add New Model */}
                   <div className="flex gap-2">
                      <Input
                        value={tempModelId}
                        onChange={(e) => setTempModelId(e.target.value)}
                        placeholder="输入新模型 ID..."
                        className="flex-1"
                      />
                      <Button
                        variant="outline"
                        onClick={() => setIsModelSelectorOpen(true)}
                        disabled={!formData.baseUrl || !formData.apiKey}
                        title={!formData.baseUrl || !formData.apiKey ? '请先配置 API Key 和 Base URL' : '从供应商获取模型列表'}
                      >
                        <Download className="h-4 w-4 mr-1" />
                        获取模型
                      </Button>
                      <Button
                        variant="secondary"
                        onClick={() => {
                          if (tempModelId && !formData.models?.includes(tempModelId)) {
                            const newModels = [...(formData.models || []), tempModelId]
                            setFormData({
                              ...formData,
                              models: newModels,
                              modelId: tempModelId // Auto select new model
                            })
                            setTempModelId('')
                          }
                        }}
                        disabled={!tempModelId}
                      >
                        <Plus className="h-4 w-4" />
                      </Button>
                   </div>

                   {/* Model List (Tag Style) */}
                   <div className="flex flex-wrap gap-2 mt-2 max-h-[300px] overflow-y-auto p-2 border border-dashed border-border rounded-md">
                      {formData.models && formData.models.length > 0 ? (
                        formData.models.map(m => (
                          <div
                            key={m}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm bg-primary/10 text-primary border border-primary/20 hover:bg-primary/20 transition-colors group"
                          >
                            <span className="font-medium" title={m}>{m}</span>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                const newModels = formData.models?.filter(model => model !== m) || [];
                                let newModelId = formData.modelId;
                                if (newModelId === m) {
                                  newModelId = newModels[0] || '';
                                }
                                setFormData({
                                  ...formData,
                                  models: newModels,
                                  modelId: newModelId
                                })
                              }}
                              className="flex items-center justify-center h-4 w-4 rounded-full hover:bg-destructive/20 text-muted-foreground hover:text-destructive transition-colors"
                            >
                              <Trash2 className="h-3 w-3" />
                            </button>
                          </div>
                        ))
                      ) : (
                        <div className="w-full text-sm text-muted-foreground py-4 text-center">
                          暂无模型，请添加
                        </div>
                      )}
                   </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
    </>
  )
}

interface ModelSelectorDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  apiKey: string
  baseUrl: string
  existingModels: string[]
  onConfirm: (selectedModels: string[]) => void
}

interface ModelGroup {
  name: string
  count: number
  models: string[]
  expanded: boolean
}

function ModelSelectorDialog({ open, onOpenChange, apiKey, baseUrl, existingModels, onConfirm }: ModelSelectorDialogProps) {
  const [loading, setLoading] = useState(false)
  const [modelGroups, setModelGroups] = useState<ModelGroup[]>([])
  const [selectedModels, setSelectedModels] = useState<Set<string>>(new Set())
  const [searchQuery, setSearchQuery] = useState('')
  const { error: showError } = useToast()
  const language = useSystemStore((state) => state.language)
  const i18nTexts = useSystemStore((state) => state.i18nTexts)

  useEffect(() => {
    if (open) {
      fetchModels()
    } else {
      // Reset state when dialog closes
      setSelectedModels(new Set())
      setSearchQuery('')
      setModelGroups([])
    }
  }, [open])

  const fetchModels = async () => {
    setLoading(true)
    try {
      const response = await fetch('/api/ai/models', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...authService.getAuthHeader()
        },
        body: JSON.stringify({
          apiKey,
          baseUrl
        })
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || '获取模型列表失败')
      }

      const data = await response.json()
      const models = data.models || []

      // Group models by provider/prefix
      const groups = groupModels(models)
      setModelGroups(groups)
    } catch (err) {
      showError(err instanceof Error ? err.message : '获取模型列表失败')
      onOpenChange(false)
    } finally {
      setLoading(false)
    }
  }

  const groupModels = (models: string[]): ModelGroup[] => {
    const groupMap = new Map<string, string[]>()

    models.forEach(model => {
      // Extract provider name from model ID
      const parts = model.split(/[-_/]/)
      const provider = parts[0] || '其他'

      if (!groupMap.has(provider)) {
        groupMap.set(provider, [])
      }
      groupMap.get(provider)!.push(model)
    })

    return Array.from(groupMap.entries()).map(([name, models]) => ({
      name,
      count: models.length,
      models,
      expanded: false
    }))
  }

  const toggleGroup = (groupName: string) => {
    setModelGroups(modelGroups.map(g =>
      g.name === groupName ? { ...g, expanded: !g.expanded } : g
    ))
  }

  const toggleModel = (model: string) => {
    const newSelected = new Set(selectedModels)
    if (newSelected.has(model)) {
      newSelected.delete(model)
    } else {
      newSelected.add(model)
    }
    setSelectedModels(newSelected)
  }

  const toggleGroupSelection = (group: ModelGroup) => {
    const newSelected = new Set(selectedModels)
    const allSelected = group.models.every(m => newSelected.has(m))

    if (allSelected) {
      group.models.forEach(m => newSelected.delete(m))
    } else {
      group.models.forEach(m => newSelected.add(m))
    }
    setSelectedModels(newSelected)
  }

  const handleConfirm = () => {
    const modelsToAdd = Array.from(selectedModels).filter(m => !existingModels.includes(m))
    if (modelsToAdd.length > 0) {
      onConfirm(modelsToAdd)
    }
    onOpenChange(false)
  }

  const filteredGroups = modelGroups.map(group => ({
    ...group,
    models: group.models.filter(m =>
      m.toLowerCase().includes(searchQuery.toLowerCase())
    )
  })).filter(g => g.models.length > 0)

  const newModelsCount = Array.from(selectedModels).filter(m => !existingModels.includes(m)).length
  const totalAvailableModels = modelGroups.reduce((sum, g) => sum + g.count, 0)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="rounded-2xl sm:max-w-[700px] max-h-[80vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            <span>选择模型</span>
            <span className="text-sm font-normal text-muted-foreground">
              新获取的模型 ({totalAvailableModels}) / 已有的模型 ({existingModels.length})
            </span>
          </DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="py-12 text-center text-muted-foreground">
            <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-current border-r-transparent mb-4"></div>
            <div>正在获取模型列表...</div>
          </div>
        ) : (
          <>
            <div className="relative mb-4">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={i18nTexts.profileSearchModel[language]}
              className="pl-10"
            />
            </div>

            <div className="max-h-[400px] overflow-y-auto border rounded-lg">
              {filteredGroups.length === 0 ? (
                <div className="py-8 text-center text-muted-foreground">
                  {searchQuery ? '没有找到匹配的模型' : '没有可用的模型'}
                </div>
              ) : (
                <div className="divide-y">
                  {filteredGroups.map((group) => {
                    const groupSelected = group.models.filter(m => selectedModels.has(m)).length
                    const allGroupSelected = groupSelected === group.models.length

                    return (
                      <div key={group.name} className="bg-background">
                        <div className="flex items-center gap-2 px-4 py-3 hover:bg-muted/50 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={allGroupSelected}
                            onChange={() => toggleGroupSelection(group)}
                            className="h-4 w-4 rounded border-gray-300"
                          />
                          <button
                            onClick={() => toggleGroup(group.name)}
                            className="flex-1 flex items-center justify-between text-left"
                          >
                            <span className="font-medium">{group.name} ({group.models.length})</span>
                            <ChevronDown className={`h-4 w-4 transition-transform ${group.expanded ? 'rotate-180' : ''}`} />
                          </button>
                        </div>

                        {group.expanded && (
                          <div className="px-4 pb-2 space-y-1">
                            {group.models.map(model => {
                              const isExisting = existingModels.includes(model)
                              const isSelected = selectedModels.has(model)

                              return (
                                <div
                                  key={model}
                                  className={`flex items-center gap-2 px-4 py-2 rounded text-sm ${
                                    isExisting ? 'opacity-50 cursor-not-allowed' : 'hover:bg-muted cursor-pointer'
                                  }`}
                                  onClick={() => !isExisting && toggleModel(model)}
                                >
                                  <input
                                    type="checkbox"
                                    checked={isSelected}
                                    disabled={isExisting}
                                    onChange={() => toggleModel(model)}
                                    className="h-3.5 w-3.5 rounded border-gray-300"
                                  />
                                  <span className="flex-1 truncate" title={model}>
                                    {model}
                                  </span>
                                  {isExisting && (
                                    <span className="text-xs text-muted-foreground">(已添加)</span>
                                  )}
                                </div>
                              )
                            })}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            <div className="text-sm text-muted-foreground text-right">
              已选择 {newModelsCount} / {totalAvailableModels}
            </div>
          </>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} className="rounded-full">
            取消
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={loading || newModelsCount === 0}
            className="rounded-full"
          >
            确定
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

interface ChangePasswordDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSave: (current: string, newPass: string) => Promise<void>
}

function ChangePasswordDialog({ open, onOpenChange, onSave }: ChangePasswordDialogProps) {
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [showCurrent, setShowCurrent] = useState(false)
  const [showNew, setShowNew] = useState(false)
  const { error: showError } = useToast()
  const language = useSystemStore((state) => state.language)
  const i18nTexts = useSystemStore((state) => state.i18nTexts)

  // Reset form when dialog opens/closes
  useEffect(() => {
    if (!open) {
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
      setShowCurrent(false)
      setShowNew(false)
    }
  }, [open])

  const handleSubmit = async () => {
    if (!currentPassword || !newPassword || !confirmPassword) {
      showError('请填写所有字段')
      return
    }

    if (newPassword !== confirmPassword) {
      showError('两次输入的新密码不一致')
      return
    }

    if (newPassword.length < 6) {
      showError('新密码长度不能少于6位')
      return
    }

    setLoading(true)
    try {
      await onSave(currentPassword, newPassword)
      onOpenChange(false)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="rounded-2xl sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>{i18nTexts.profileChangePassword[language]}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="relative">
            <Input
              type={showCurrent ? 'text' : 'password'}
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              placeholder={i18nTexts.profileOldPassword[language]}
              className="pr-10"
            />
            <button
              type="button"
              onClick={() => setShowCurrent(!showCurrent)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-primary"
            >
              {showCurrent ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>

          <div className="relative">
            <Input
              type={showNew ? 'text' : 'password'}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder={i18nTexts.profileNewPassword[language]}
              className="pr-10"
            />
            <button
              type="button"
              onClick={() => setShowNew(!showNew)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-primary"
            >
              {showNew ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>

          <Input
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            placeholder={i18nTexts.profileConfirmPassword[language]}
          />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} className="rounded-full">
            {i18nTexts.profileCancel[language]}
          </Button>
          <Button onClick={handleSubmit} disabled={loading} className="rounded-full">
            {loading ? `${i18nTexts.profileSave[language]}...` : i18nTexts.profileConfirm[language]}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export function ProfilePage() {
  const storageMode = useStorageModeStore((state) => state.mode)
  const language = useSystemStore((state) => state.language)
  const i18nTexts = useSystemStore((state) => state.i18nTexts)
  const [activeTab, setActiveTab] = useState(storageMode === 'local' ? 'settings' : 'profile')
  const [nickname, setNickname] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [quotaUsed, setQuotaUsed] = useState(0)
  const [quotaTotal, setQuotaTotal] = useState(10)
  const { success, error: showError } = useToast()
  const user = useAuthStore((state) => state.user)
  const token = useAuthStore((state) => state.token)
  const [showToken, setShowToken] = useState(false)
  const [isChangePasswordDialogOpen, setIsChangePasswordDialogOpen] = useState(false)
  const [configUpdateTrigger, setConfigUpdateTrigger] = useState(0)
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false)

  useEffect(() => {
    // 加载配额信息
    setQuotaUsed(quotaService.getUsedCount())
    setQuotaTotal(quotaService.getDailyQuota())
    // 加载已保存的密码
    setPassword(quotaService.getAccessPassword())
    // 初始化昵称
    if (user?.nickname) {
      setNickname(user.nickname)
    } else if (user?.username) {
      setNickname(user.username)
    }
  }, [user])

  const handleNicknameUpdate = async () => {
    if (!nickname.trim()) {
      showError('昵称不能为空')
      return
    }
    try {
      await authService.updateUserNickname(nickname)
      success('昵称更新成功')
    } catch (err) {
      showError('昵称更新失败')
    }
  }

  const handlePasswordChange = async (current: string, newPass: string) => {
    try {
      await authService.changePassword(current, newPass)
      success('密码修改成功')
    } catch (err) {
      showError(err instanceof Error ? err.message : '密码修改失败')
    }
  }

  const quotaPercentage = Math.min(100, (quotaUsed / quotaTotal) * 100)
  const hasPassword = quotaService.hasAccessPassword()

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      <AppSidebar onCreateProject={() => setIsCreateDialogOpen(true)} />
      <main className="flex flex-1 flex-col pl-[72px] h-full">
        <div className="flex flex-1 w-full bg-background overflow-hidden">
            <div className="flex h-full w-full">
              {/* 左侧 Tab */}
              <div className="w-64 border-r border-border bg-surface/50 p-4 overflow-y-auto">
                <nav className="space-y-1">
                  {(storageMode !== 'local' || user) && (
                    <button
                      onClick={() => setActiveTab('profile')}
                      className={`flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors ${
                        activeTab === 'profile'
                          ? 'bg-primary text-surface'
                          : 'text-muted hover:bg-background hover:text-primary'
                      }`}
                    >
                      <User className="h-4 w-4" />
                      <span>{i18nTexts.profileUserInfo[language]}</span>
                    </button>
                  )}
                  <button
                    onClick={() => setActiveTab('settings')}
                    className={`flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors ${
                      activeTab === 'settings'
                        ? 'bg-primary text-surface'
                        : 'text-muted hover:bg-background hover:text-primary'
                    }`}
                  >
                    <Sparkles className="h-4 w-4" />
                    <span>{i18nTexts.profileAIConfig[language]}</span>
                  </button>
                </nav>
              </div>

              {/* 右侧内容区 */}
              <div className="flex-1 bg-surface p-6 overflow-y-auto">
                {activeTab === 'profile' && (
                  <>
                    <h2 className="mb-6 text-lg font-medium text-primary">{i18nTexts.profileUserInfo[language]}</h2>
                    <div className="space-y-6">
                      <div>
                        <label className="text-sm font-medium text-muted">{i18nTexts.profileUsername[language]}</label>
                        <div className="mt-1 text-lg font-medium text-primary">{user?.username}</div>
                      </div>
                      <div>
                        <label className="text-sm font-medium text-muted">{i18nTexts.profileNickname[language]}</label>
                        <div className="mt-1 flex items-center gap-2">
                          <Input
                            value={nickname}
                            onChange={(e) => setNickname(e.target.value)}
                            className="max-w-xs"
                            placeholder={i18nTexts.profileNicknamePlaceholder[language]}
                          />
                          <Button onClick={handleNicknameUpdate} size="sm">
                            {i18nTexts.profileSave[language]}
                          </Button>
                        </div>
                      </div>
                      <div>
                        <label className="text-sm font-medium text-muted">API Token</label>
                        <div className="mt-1 flex items-center gap-2">
                          <div className="relative flex-1 max-w-md">
                            <Input
                              type={showToken ? 'text' : 'password'}
                              value={token || ''}
                              readOnly
                              className="pr-10 font-mono text-sm"
                            />
                            <button
                              type="button"
                              onClick={() => setShowToken(!showToken)}
                              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-primary"
                            >
                              {showToken ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                            </button>
                          </div>
                          <Button
                            variant="secondary"
                            onClick={() => {
                              if (token) {
                                navigator.clipboard.writeText(token)
                                success('Token 已复制')
                              }
                            }}
                          >
                            <Copy className="h-4 w-4 mr-2" />
                            复制
                          </Button>
                        </div>
                        <p className="mt-1 text-xs text-muted-foreground">
                          用于浏览器插件或其他 API 调用。请勿泄露给他人。
                        </p>
                      </div>
                      <div>
                        <Button onClick={() => setIsChangePasswordDialogOpen(true)}>
                          {i18nTexts.profileChangePassword[language]}
                        </Button>
                      </div>
                    </div>
                  </>
                )}

                {activeTab === 'settings' && (
                  <>
                    <h2 className="mb-6 text-lg font-medium text-primary">{i18nTexts.profileAIConfig[language]}</h2>
                    <UserAIConfigSection
                      password={password}
                      setPassword={setPassword}
                      showPassword={showPassword}
                      setShowPassword={setShowPassword}
                      onConfigSaved={() => setConfigUpdateTrigger(prev => prev + 1)}
                    />
                  </>
                )}
              </div>
            </div>
        </div>
      </main>

      {/* 修改密码弹窗 */}
      <ChangePasswordDialog
        open={isChangePasswordDialogOpen}
        onOpenChange={setIsChangePasswordDialogOpen}
        onSave={handlePasswordChange}
      />

      <CreateProjectDialog
        open={isCreateDialogOpen}
        onOpenChange={setIsCreateDialogOpen}
      />
    </div>
  )
}
