import {create} from 'zustand'
import type {EngineType} from '@/types'
import type {Locale} from '@/lib/i18n'

export interface I18nTexts {
  // 菜单
  menuHome: { zh: string; en: string }
  menuProjects: { zh: string; en: string }
  menuProfile: { zh: string; en: string }
  menuAdmin: { zh: string; en: string }
  menuAbout: { zh: string; en: string }
  // 按钮
  btnNewProject: { zh: string; en: string }
  btnBackHome: { zh: string; en: string }
  btnLogout: { zh: string; en: string }
  // 首页
  homeTitle: { zh: string; en: string }
  homeSubtitle: { zh: string; en: string }
  homePlaceholder: { zh: string; en: string }
  homeUploadFile: { zh: string; en: string }
  homeAddLink: { zh: string; en: string }
  homePasteImageTip: { zh: string; en: string }
  homeSystemDefault: { zh: string; en: string }
  homeQuickStart: { zh: string; en: string }
  homeRecentFiles: { zh: string; en: string }
  homeUserManual: { zh: string; en: string }
  homeChangelog: { zh: string; en: string }
  homeFeedback: { zh: string; en: string }
  // 个人设置 - 用户信息
  profileUserInfo: { zh: string; en: string }
  profileUsername: { zh: string; en: string }
  profileNickname: { zh: string; en: string }
  profileNicknamePlaceholder: { zh: string; en: string }
  profileSave: { zh: string; en: string }
  profileChangePassword: { zh: string; en: string }
  profileOldPassword: { zh: string; en: string }
  profileNewPassword: { zh: string; en: string }
  profileConfirmPassword: { zh: string; en: string }
  profileCancel: { zh: string; en: string }
  profileConfirm: { zh: string; en: string }
  // 个人设置 - AI模型配置
  profileAIConfig: { zh: string; en: string }
  profileSystemDefault: { zh: string; en: string }
  profileDefaultModel: { zh: string; en: string }
  profileSystemDefaultHint: { zh: string; en: string }
  profileAddProvider: { zh: string; en: string }
  profileProviderType: { zh: string; en: string }
  profileProviderName: { zh: string; en: string }
  profileAPIAddress: { zh: string; en: string }
  profileAPIKey: { zh: string; en: string }
  profileModelID: { zh: string; en: string }
  profileGetModels: { zh: string; en: string }
  profileDelete: { zh: string; en: string }
  profileSetDefault: { zh: string; en: string }
  profileSearchModel: { zh: string; en: string }
  profileLocalModeHint: { zh: string; en: string }
  profileServerDefault: { zh: string; en: string }
  profileConfigModel: { zh: string; en: string }
  // 用户菜单
  userProfile: { zh: string; en: string }
  userLogout: { zh: string; en: string }
  userLogin: { zh: string; en: string }
  // 管理后台子菜单
  adminUsers: { zh: string; en: string }
  adminBasicSettings: { zh: string; en: string }
  adminLLMModel: { zh: string; en: string }
  adminNotifications: { zh: string; en: string }
  adminI18n: { zh: string; en: string }
  adminExamples: { zh: string; en: string }
  adminStats: { zh: string; en: string }
  adminDefaultModels: { zh: string; en: string }
  // 管理后台 - 用户管理
  adminLocalUsers: { zh: string; en: string }
  adminCloudUsers: { zh: string; en: string }
  adminRole: { zh: string; en: string }
  adminRegisteredAt: { zh: string; en: string }
  adminUserID: { zh: string; en: string }
  adminUserName: { zh: string; en: string }
  adminUserNickname: { zh: string; en: string }
  adminUserRemark: { zh: string; en: string }
  adminCurrentUser: { zh: string; en: string }
  adminCopyUserIDTitle: { zh: string; en: string }
  adminLastSeenAt: { zh: string; en: string }
  adminRoleLabel: { zh: string; en: string }
  adminCommonUser: { zh: string; en: string }
  adminAdminUser: { zh: string; en: string }
  adminResetPassword: { zh: string; en: string }
  adminDeleteUser: { zh: string; en: string }
  adminCannotDeleteSelf: { zh: string; en: string }
  adminRoleUpdateSuccess: { zh: string; en: string }
  adminRoleUpdateFailed: { zh: string; en: string }
  adminUserDeleted: { zh: string; en: string }
  adminDeleteUserFailed: { zh: string; en: string }
  adminConfirmDeleteUser: { zh: string; en: string }
  adminLoadUsersFailed: { zh: string; en: string }
  adminLoading: { zh: string; en: string }
  adminEditNickname: { zh: string; en: string }
  adminNicknameUpdated: { zh: string; en: string }
  adminUpdateNicknameFailed: { zh: string; en: string }
  adminLocalUserLabel: { zh: string; en: string }
  adminFirstSeenAt: { zh: string; en: string }
  // 管理后台 - 基础设置
  adminSystemName: { zh: string; en: string }
  adminDefaultEngine: { zh: string; en: string }
  adminLogoColor: { zh: string; en: string }
  adminAllowRegister: { zh: string; en: string }
  adminSaveConfig: { zh: string; en: string }
  // 管理后台 - 全局LLM模型
  adminAPIType: { zh: string; en: string }
  adminAPIAddress: { zh: string; en: string }
  adminModelID: { zh: string; en: string }
  adminLLMHint: { zh: string; en: string }
  // 管理后台 - 通知设置
  adminNotificationTitle: { zh: string; en: string }
  adminNotificationPlaceholder: { zh: string; en: string }
  // 管理后台 - 示例文件
  adminExampleHint: { zh: string; en: string }
  // 管理后台 - 使用统计
  adminChatStats: { zh: string; en: string }
  adminFileStats: { zh: string; en: string }
  adminLast7Days: { zh: string; en: string }
  adminDailyChats: { zh: string; en: string }
  adminChatRecords: { zh: string; en: string }
  adminDailyFiles: { zh: string; en: string }
  adminFileRecords: { zh: string; en: string }
  adminDate: { zh: string; en: string }
  adminCount: { zh: string; en: string }
  adminUser: { zh: string; en: string }
  adminPrompt: { zh: string; en: string }
  adminCreatedAt: { zh: string; en: string }
  // 文件管理页面
  projectsPageTitle: { zh: string; en: string }
  projectsAllFiles: { zh: string; en: string }
  projectsUncategorized: { zh: string; en: string }
  projectsSearchPlaceholder: { zh: string; en: string }
  projectsSortByUpdated: { zh: string; en: string }
  projectsSortByCreated: { zh: string; en: string }
  projectsSortUpdated: { zh: string; en: string }
  projectsSortCreated: { zh: string; en: string }
  projectsImport: { zh: string; en: string }
  projectsNew: { zh: string; en: string }
  projectsCreatedAt: { zh: string; en: string }
  projectsUpdatedAt: { zh: string; en: string }
  projectsPreviewTitle: { zh: string; en: string }
  projectsEnterEdit: { zh: string; en: string }
  projectsNoPreview: { zh: string; en: string }
  projectsCreateTime: { zh: string; en: string }
  projectsUpdateTime: { zh: string; en: string }
  // 首页
  homeSend: { zh: string; en: string }
  homeCreating: { zh: string; en: string }
  // 新建文件弹窗
  dialogNewFile: { zh: string; en: string }
  dialogFileName: { zh: string; en: string }
  dialogFileNamePlaceholder: { zh: string; en: string }
  dialogGroup: { zh: string; en: string }
  dialogSelectGroup: { zh: string; en: string }
  dialogEngine: { zh: string; en: string }
  dialogEngineTip: { zh: string; en: string }
  dialogCancel: { zh: string; en: string }
  dialogCreate: { zh: string; en: string }
  dialogCreating: { zh: string; en: string }
  dialogUntitled: { zh: string; en: string }
  // 文档导航
  docNavTitle: { zh: string; en: string }
  docBackToHome: { zh: string; en: string }
  docSupportTitle: { zh: string; en: string }
  docSupportDesc: { zh: string; en: string }
  docWechatPay: { zh: string; en: string }
  docAlipay: { zh: string; en: string }
  docWechatScan: { zh: string; en: string }
  docAlipayScan: { zh: string; en: string }
  // 引擎描述
  engineMermaidDesc: { zh: string; en: string }
  engineExcalidrawDesc: { zh: string; en: string }
  engineDrawioDesc: { zh: string; en: string }
  // 编辑器页面
  editorExport: { zh: string; en: string }
  editorExportSVG: { zh: string; en: string }
  editorExportPNG: { zh: string; en: string }
  editorExportSource: { zh: string; en: string }
  editorSourceCode: { zh: string; en: string }
  editorSave: { zh: string; en: string }
  editorHistory: { zh: string; en: string }
  editorAIAssistant: { zh: string; en: string }
  editorNewDiagram: { zh: string; en: string }
  editorModifyDiagram: { zh: string; en: string }
  editorThinking: { zh: string; en: string }
  editorThinkingProcess: { zh: string; en: string }
  editorCodeGeneration: { zh: string; en: string }
  editorGeneratingCode: { zh: string; en: string }
  editorAIThinking: { zh: string; en: string }
  editorComplete: { zh: string; en: string }
  editorError: { zh: string; en: string }
  editorWaiting: { zh: string; en: string }
  editorProcessing: { zh: string; en: string }
  // 其他
  storageMode: { zh: string; en: string }
  localMode: { zh: string; en: string }
  cloudMode: { zh: string; en: string }
  localModeDesc: { zh: string; en: string }
  cloudModeDesc: { zh: string; en: string }
  currentMode: { zh: string; en: string }
  collapseMenu: { zh: string; en: string }
  expandMenu: { zh: string; en: string }
  // 分页
  paginationPage: { zh: string; en: string }
  paginationOf: { zh: string; en: string }
  paginationTotal: { zh: string; en: string }
  paginationPrevious: { zh: string; en: string }
  paginationNext: { zh: string; en: string }
  paginationShowing: { zh: string; en: string }
  paginationTo: { zh: string; en: string }
  // AI对话框
  chatInputPlaceholder: { zh: string; en: string }
  chatCollapsePanel: { zh: string; en: string }
  chatNewConversation: { zh: string; en: string }
  chatEmptyPrompt: { zh: string; en: string }
  chatRetry: { zh: string; en: string }
  chatCopyCode: { zh: string; en: string }
  chatCopied: { zh: string; en: string }
  chatViewSourceCode: { zh: string; en: string }
  // 编辑器工具栏提示
  editorExportTooltip: { zh: string; en: string }
  editorSourceCodeTooltip: { zh: string; en: string }
  editorExpandPanel: { zh: string; en: string }
  // 后台管理-使用统计额外文本
  statsSearchByUserID: { zh: string; en: string }
  statsSearch: { zh: string; en: string }
  statsClear: { zh: string; en: string }
  statsLast7DaysDailyChats: { zh: string; en: string }
  statsLast7DaysDailyFiles: { zh: string; en: string }
  statsUserLabel: { zh: string; en: string }
  statsLoading: { zh: string; en: string }
  statsNoData: { zh: string; en: string }
  statsNoRecords: { zh: string; en: string }
  statsChatRecords: { zh: string; en: string }
  statsFileRecords: { zh: string; en: string }
  statsTotal: { zh: string; en: string }
  statsRecords: { zh: string; en: string }
  statsUserType: { zh: string; en: string }
  statsModel: { zh: string; en: string }
  statsIP: { zh: string; en: string }
  statsTime: { zh: string; en: string }
  statsFile: { zh: string; en: string }
  statsLocalUser: { zh: string; en: string }
  statsCloudUser: { zh: string; en: string }
  statsLocalUserType: { zh: string; en: string }
  statsCopyUserID: { zh: string; en: string }
  statsCopyUserIDTitle: { zh: string; en: string }
  // 后台管理-基础设置额外文本
  basicDefaultEngineDesc: { zh: string; en: string }
  basicLogoColorDesc: { zh: string; en: string }
  basicDrawioConfig: { zh: string; en: string }
  basicUseLocalDrawio: { zh: string; en: string }
  basicDrawioAddress: { zh: string; en: string }
  basicDrawioAddressPlaceholder: { zh: string; en: string }
  basicDrawioDesc: { zh: string; en: string }
  basicSaving: { zh: string; en: string }
  basicLoadFailed: { zh: string; en: string }
  basicSaveFailed: { zh: string; en: string }
  basicSaveSuccess: { zh: string; en: string }
}

interface SystemState {
  systemName: string
  showAbout: boolean
  sidebarCollapsed: boolean
  defaultEngine: EngineType
  defaultModelPrompt: string
  logoColor: string
  language: Locale
  i18nTexts: I18nTexts
  notifications: {
    homepage?: string
    homepageEnabled?: boolean
    editor?: string
    editorEnabled?: boolean
    homepageAnnouncement?: string
    homepageAnnouncementEnabled?: boolean
  }
  drawioConfig: {
    useLocalDrawio: boolean
    drawioBaseUrl: string
  }
  setSystemName: (name: string) => void
  setShowAbout: (show: boolean) => void
  setSidebarCollapsed: (collapsed: boolean) => void
  setDefaultEngine: (engine: EngineType) => void
  setDefaultModelPrompt: (prompt: string) => void
  setLogoColor: (color: string) => void
  setLanguage: (language: Locale) => void
  setI18nTexts: (texts: I18nTexts) => void
  setNotifications: (notifications: {
    homepage?: string;
    homepageEnabled?: boolean;
    editor?: string;
    editorEnabled?: boolean;
    homepageAnnouncement?: string;
    homepageAnnouncementEnabled?: boolean;
  }) => void
  setDrawioConfig: (config: { useLocalDrawio: boolean; drawioBaseUrl: string }) => void
}

export const useSystemStore = create<SystemState>((set) => ({
  systemName: (window as any)._ENV_?.SYSTEM_NAME || 'AI Draw',
  showAbout: (window as any)._ENV_?.SHOW_ABOUT !== false, // Default to true if not set
  sidebarCollapsed: localStorage.getItem('sidebarCollapsed') === 'true',
  defaultEngine: (localStorage.getItem('defaultEngine') as EngineType) || (window as any)._ENV_?.DEFAULT_ENGINE || 'drawio',
  defaultModelPrompt: (window as any)._ENV_?.DEFAULT_MODEL_PROMPT || '使用服务端配置的模型，此信息管理员可以在系统设置-基础设置里面进行自定义',
  logoColor: (window as any)._ENV_?.LOGO_COLOR || '#000000', // Default to black
  language: (localStorage.getItem('language') as Locale) || (window as any)._ENV_?.LANGUAGE || 'zh',
  drawioConfig: {
    useLocalDrawio: false,
    drawioBaseUrl: ''
  },
  i18nTexts: {
    menuHome: { zh: '系统首页', en: 'Home' },
    menuProjects: { zh: '文件管理', en: 'Projects' },
    menuProfile: { zh: '个人设置', en: 'Profile' },
    menuAdmin: { zh: '管理后台', en: 'Admin' },
    menuAbout: { zh: '关于我们', en: 'About' },
    btnNewProject: { zh: '新建文件', en: 'New Project' },
    btnBackHome: { zh: '返回首页', en: 'Back to Home' },
    btnLogout: { zh: '退出', en: 'Logout' },
    homeTitle: { zh: '一句话见所想', en: 'Visualize Your Ideas' },
    homeSubtitle: { zh: '与 AI 对话,让所想即刻呈现', en: 'Chat with AI, bring your ideas to life' },
    homePlaceholder: { zh: '输入你的想法，开始创作吧...', en: 'Enter your ideas to start creating...' },
    homeUploadFile: { zh: '上传文件', en: 'File' },
    homeAddLink: { zh: '添加链接', en: 'Link' },
    homePasteImageTip: { zh: '支持粘贴图片', en: 'Paste image supported' },
    homeSystemDefault: { zh: '系统默认', en: 'System Default' },
    homeQuickStart: { zh: '快速开始', en: 'Quick Start' },
    homeRecentFiles: { zh: '最近文件', en: 'Recent Files' },
    homeUserManual: { zh: '使用手册', en: 'User Manual' },
    homeChangelog: { zh: '更新日志', en: 'Changelog' },
    homeFeedback: { zh: '问题反馈', en: 'Feedback' },
    profileUserInfo: { zh: '个人信息', en: 'User Information' },
    profileUsername: { zh: '用户名', en: 'Username' },
    profileNickname: { zh: '昵称', en: 'Nickname' },
    profileNicknamePlaceholder: { zh: '请输入昵称', en: 'Enter nickname' },
    profileSave: { zh: '保存', en: 'Save' },
    profileChangePassword: { zh: '修改登录密码', en: 'Change Password' },
    profileOldPassword: { zh: '原密码', en: 'Old Password' },
    profileNewPassword: { zh: '新密码', en: 'New Password' },
    profileConfirmPassword: { zh: '确认新密码', en: 'Confirm Password' },
    profileCancel: { zh: '取消', en: 'Cancel' },
    profileConfirm: { zh: '确认', en: 'Confirm' },
    profileAIConfig: { zh: 'AI模型配置', en: 'AI Model Configuration' },
    profileSystemDefault: { zh: '系统默认', en: 'System Default' },
    profileDefaultModel: { zh: '默认模型', en: 'Default Model' },
    profileSystemDefaultHint: { zh: '使用服务端配置的模型，此信息管理员可以在系统设置-基础设置里面进行自定义', en: 'Use server-configured model. Administrators can customize this in System Settings - Basic Settings' },
    profileAddProvider: { zh: '添加新模型', en: 'Add Provider' },
    profileProviderType: { zh: 'API 类型', en: 'API Type' },
    profileProviderName: { zh: '模型名称', en: 'Provider Name' },
    profileAPIAddress: { zh: 'API 地址', en: 'API Address' },
    profileAPIKey: { zh: 'API Key', en: 'API Key' },
    profileModelID: { zh: '模型 ID', en: 'Model ID' },
    profileGetModels: { zh: '获取模型列表', en: 'Get Models' },
    profileDelete: { zh: '删除', en: 'Delete' },
    profileSetDefault: { zh: '设为默认', en: 'Set as Default' },
    profileSearchModel: { zh: '搜索模型...', en: 'Search model...' },
    profileLocalModeHint: { zh: '目前是本地模式，个人配置的AI模型密钥信息，只存储在本地浏览器，请放心配置', en: 'Local mode: Your AI model API keys are stored only in your browser, safe to configure' },
    profileServerDefault: { zh: '服务器默认', en: 'Server Default' },
    profileConfigModel: { zh: '配置模型', en: 'Configure Model' },
    userProfile: { zh: '个人信息', en: 'Profile' },
    userLogout: { zh: '退出登录', en: 'Logout' },
    userLogin: { zh: '登录 / 注册', en: 'Login / Register' },
    adminUsers: { zh: '用户管理', en: 'User Management' },
    adminBasicSettings: { zh: '基础设置', en: 'Basic Settings' },
    adminLLMModel: { zh: '全局 LLM 模型', en: 'Global LLM Model' },
    adminNotifications: { zh: '通知设置', en: 'Notifications' },
    adminI18n: { zh: '多语言设置', en: 'Multi-language' },
    adminExamples: { zh: '示例文件管理', en: 'Example Files' },
    adminStats: { zh: '使用统计', en: 'Statistics' },
    adminDefaultModels: { zh: '默认模型管理', en: 'Default Models' },
    adminLocalUsers: { zh: '本地用户', en: 'Local Users' },
    adminCloudUsers: { zh: '云端用户', en: 'Cloud Users' },
    adminRole: { zh: '角色', en: 'Role' },
    adminRegisteredAt: { zh: '注册时间', en: 'Registered At' },
    adminUserID: { zh: '用户ID', en: 'User ID' },
    adminUserName: { zh: '用户名', en: 'Username' },
    adminUserNickname: { zh: '昵称', en: 'Nickname' },
    adminUserRemark: { zh: '备注', en: 'Remark' },
    adminCurrentUser: { zh: '登录用户', en: 'Current User' },
    adminCopyUserIDTitle: { zh: '复制用户ID', en: 'Copy User ID' },
    adminLastSeenAt: { zh: '最近访问', en: 'Last Seen' },
    adminRoleLabel: { zh: '角色:', en: 'Role:' },
    adminCommonUser: { zh: '普通用户', en: 'User' },
    adminAdminUser: { zh: '管理员', en: 'Admin' },
    adminResetPassword: { zh: '重置密码', en: 'Reset Password' },
    adminDeleteUser: { zh: '删除用户', en: 'Delete User' },
    adminCannotDeleteSelf: { zh: '不能删除自己', en: 'Cannot delete yourself' },
    adminRoleUpdateSuccess: { zh: '角色更新成功', en: 'Role updated successfully' },
    adminRoleUpdateFailed: { zh: '角色更新失败', en: 'Failed to update role' },
    adminUserDeleted: { zh: '用户已删除', en: 'User deleted' },
    adminDeleteUserFailed: { zh: '删除用户失败', en: 'Failed to delete user' },
    adminConfirmDeleteUser: { zh: '确定要删除该用户吗？此操作不可恢复。', en: 'Are you sure to delete this user? This action cannot be undone.' },
    adminLoadUsersFailed: { zh: '加载用户列表失败', en: 'Failed to load user list' },
    adminLoading: { zh: '加载中...', en: 'Loading...' },
    adminEditNickname: { zh: '编辑备注名', en: 'Edit Nickname' },
    adminNicknameUpdated: { zh: '备注名已更新', en: 'Nickname updated' },
    adminUpdateNicknameFailed: { zh: '更新备注名失败', en: 'Failed to update nickname' },
    adminLocalUserLabel: { zh: '本地用户', en: 'Local User' },
    adminFirstSeenAt: { zh: '首次访问', en: 'First Seen' },
    adminSystemName: { zh: '系统名称', en: 'System Name' },
    adminDefaultEngine: { zh: '默认绘图引擎', en: 'Default Drawing Engine' },
    adminLogoColor: { zh: 'Logo 颜色', en: 'Logo Color' },
    adminAllowRegister: { zh: '开放用户注册', en: 'Allow Registration' },
    adminSaveConfig: { zh: '保存配置', en: 'Save Configuration' },
    adminAPIType: { zh: 'API 类型', en: 'API Type' },
    adminAPIAddress: { zh: 'API 地址', en: 'API Address' },
    adminModelID: { zh: '模型 ID', en: 'Model ID' },
    adminLLMHint: { zh: '配置全局 LLM API 后，所有用户使用默认服务器都使用此配置', en: 'After configuring global LLM API, all users using default server will use this configuration' },
    adminNotificationTitle: { zh: '首页顶部滚动通知', en: 'Homepage Top Notification' },
    adminNotificationPlaceholder: { zh: '请输入通知内容', en: 'Enter notification content' },
    adminExampleHint: { zh: '这些文件将在新用户注册时自动复制到其文件列表中（仅复制前4个）', en: 'These files will be automatically copied to new users\' file list upon registration (only first 4)' },
    adminChatStats: { zh: 'AI 对话统计', en: 'AI Chat Statistics' },
    adminFileStats: { zh: '文件创建统计', en: 'File Creation Statistics' },
    adminLast7Days: { zh: '最近7天', en: 'Last 7 Days' },
    adminDailyChats: { zh: '每日对话次数', en: 'Daily Chats' },
    adminChatRecords: { zh: '对话记录', en: 'Chat Records' },
    adminDailyFiles: { zh: '每日创建文件次数', en: 'Daily File Creations' },
    adminFileRecords: { zh: '文件创建记录', en: 'File Creation Records' },
    adminDate: { zh: '日期', en: 'Date' },
    adminCount: { zh: '次数', en: 'Count' },
    adminUser: { zh: '用户', en: 'User' },
    adminPrompt: { zh: '提示词', en: 'Prompt' },
    adminCreatedAt: { zh: '创建时间', en: 'Created At' },
    projectsPageTitle: { zh: '文件管理', en: 'Projects' },
    projectsAllFiles: { zh: '全部文件', en: 'All Files' },
    projectsUncategorized: { zh: '未分组', en: 'Uncategorized' },
    projectsSearchPlaceholder: { zh: '搜索文件...', en: 'Search files...' },
    projectsSortByUpdated: { zh: '按最后更新时间', en: 'Sort by Last Updated' },
    projectsSortByCreated: { zh: '按创建时间', en: 'Sort by Created Time' },
    projectsSortUpdated: { zh: '最后更新', en: 'Last Updated' },
    projectsSortCreated: { zh: '创建时间', en: 'Created Time' },
    projectsImport: { zh: '导入', en: 'Import' },
    projectsNew: { zh: '新建', en: 'New' },
    projectsCreatedAt: { zh: '创建于', en: 'Created' },
    projectsUpdatedAt: { zh: '更新于', en: 'Updated' },
    projectsPreviewTitle: { zh: '暂无预览图', en: 'No Preview' },
    projectsEnterEdit: { zh: '进入编辑', en: 'Enter Edit' },
    projectsNoPreview: { zh: '暂无预览图', en: 'No Preview' },
    projectsCreateTime: { zh: '创建时间', en: 'Created Time' },
    projectsUpdateTime: { zh: '更新时间', en: 'Updated Time' },
    homeSend: { zh: '发送', en: 'Send' },
    homeCreating: { zh: '创建中...', en: 'Creating...' },
    dialogNewFile: { zh: '新建文件', en: 'New File' },
    dialogFileName: { zh: '文件名称', en: 'File Name' },
    dialogFileNamePlaceholder: { zh: '请输入文件名称', en: 'Enter file name' },
    dialogGroup: { zh: '分组', en: 'Group' },
    dialogSelectGroup: { zh: '选择分组', en: 'Select Group' },
    dialogEngine: { zh: '引擎', en: 'Engine' },
    dialogEngineTip: { zh: '如需使用其他引擎，请在首页左上角或系统设置中进行切换。', en: 'To use other engines, please switch in the top left corner of the homepage or in system settings.' },
    dialogCancel: { zh: '取消', en: 'Cancel' },
    dialogCreate: { zh: '创建', en: 'Create' },
    dialogCreating: { zh: '创建中...', en: 'Creating...' },
    dialogUntitled: { zh: '未命名', en: 'Untitled' },
    docNavTitle: { zh: '文档导航', en: 'Documentation' },
    docBackToHome: { zh: '返回首页', en: 'Back to Home' },
    docSupportTitle: { zh: '支持和打赏', en: 'Support & Donate' },
    docSupportDesc: { zh: '感谢支持开源，您的打赏将用于项目的持续开发和维护。', en: 'Thank you for supporting open source. Your donation will be used for the continuous development and maintenance of the project.' },
    docWechatPay: { zh: '微信赞赏', en: 'WeChat Tip' },
    docAlipay: { zh: '支付宝赞赏', en: 'Alipay Tip' },
    docWechatScan: { zh: '微信扫码', en: 'Scan with WeChat' },
    docAlipayScan: { zh: '支付宝扫码', en: 'Scan with Alipay' },
    engineMermaidDesc: { zh: '基于文本的图表生成，适合快速绘制结构化图表', en: 'Text-based diagram generation, suitable for quickly drawing structured diagrams' },
    engineExcalidrawDesc: { zh: '手绘风格白板工具，自由绘制，界面简洁直观', en: 'Hand-drawn style whiteboard tool, free drawing, simple and intuitive interface' },
    engineDrawioDesc: { zh: '专业级图表编辑器，功能丰富，适合复杂技术文档', en: 'Professional-grade diagram editor, feature-rich, suitable for complex technical documentation' },
    editorExport: { zh: '导出', en: 'Export' },
    editorExportSVG: { zh: '导出为 SVG', en: 'Export as SVG' },
    editorExportPNG: { zh: '导出为 PNG', en: 'Export as PNG' },
    editorExportSource: { zh: '导出原文件', en: 'Export Source File' },
    editorSourceCode: { zh: '源码', en: 'Source Code' },
    editorSave: { zh: '保存', en: 'Save' },
    editorHistory: { zh: '历史版本', en: 'History' },
    editorAIAssistant: { zh: 'AI 助手', en: 'AI Assistant' },
    editorNewDiagram: { zh: '新建图表', en: 'New Diagram' },
    editorModifyDiagram: { zh: '基于当前图表修改', en: 'Modify Current Diagram' },
    editorThinking: { zh: '思考中...', en: 'Thinking...' },
    editorThinkingProcess: { zh: '思考过程', en: 'Thinking Process' },
    editorCodeGeneration: { zh: '代码生成', en: 'Code Generation' },
    editorGeneratingCode: { zh: '生成代码中...', en: 'Generating Code...' },
    editorAIThinking: { zh: 'AI 思考中...', en: 'AI Thinking...' },
    editorComplete: { zh: '绘制完成', en: 'Complete' },
    editorError: { zh: '出错了', en: 'Error' },
    editorWaiting: { zh: '等待中...', en: 'Waiting...' },
    editorProcessing: { zh: '处理中...', en: 'Processing...' },
    storageMode: { zh: '存储模式切换', en: 'Storage Mode' },
    localMode: { zh: '本地模式', en: 'Local Mode' },
    cloudMode: { zh: '云端模式', en: 'Cloud Mode' },
    localModeDesc: { zh: '所有信息存储在本地，包含AI 密钥，图表文件，适用于数据安全要求比较高的场景。', en: 'All information is stored locally, including AI keys and diagram files, suitable for scenarios with high data security requirements.' },
    cloudModeDesc: { zh: '需要登录使用，配置信息及图表文件会保存到云端，适合私有部署的用户，这样切换电脑或浏览器，数据和配置保持同步。', en: 'Requires login. Configuration and diagram files are saved to the cloud, suitable for privately deployed users to keep data and configuration synchronized across devices or browsers.' },
    currentMode: { zh: '当前使用', en: 'Current' },
    collapseMenu: { zh: '折叠菜单', en: 'Collapse Menu' },
    expandMenu: { zh: '展开菜单', en: 'Expand Menu' },
    // 分页
    paginationPage: { zh: '第', en: 'Page' },
    paginationOf: { zh: '页 / 共', en: 'of' },
    paginationTotal: { zh: '页', en: 'pages' },
    paginationPrevious: { zh: '上一页', en: 'Previous' },
    paginationNext: { zh: '下一页', en: 'Next' },
    paginationShowing: { zh: '显示', en: 'Showing' },
    paginationTo: { zh: '条，共', en: 'to' },
    // AI对话框
    chatInputPlaceholder: { zh: '输入你的消息...（支持粘贴图片）', en: 'Enter your message... (Paste images supported)' },
    chatCollapsePanel: { zh: '收起对话面板', en: 'Collapse Chat Panel' },
    chatNewConversation: { zh: '新建对话', en: 'New Conversation' },
    chatEmptyPrompt: { zh: '开始与 AI 对话，创建你的图表', en: 'Start chatting with AI to create your diagram' },
    chatRetry: { zh: '重试', en: 'Retry' },
    chatCopyCode: { zh: '复制代码', en: 'Copy Code' },
    chatCopied: { zh: '已复制', en: 'Copied' },
    chatViewSourceCode: { zh: '查看源码', en: 'View Source Code' },
    // 编辑器工具栏提示
    editorExportTooltip: { zh: '导出图表', en: 'Export Diagram' },
    editorSourceCodeTooltip: { zh: '查看源码', en: 'View Source Code' },
    editorExpandPanel: { zh: '展开对话面板', en: 'Expand Chat Panel' },
    // 后台管理-使用统计额外文本
    statsSearchByUserID: { zh: '按用户ID搜索...', en: 'Search by User ID...' },
    statsSearch: { zh: '搜索', en: 'Search' },
    statsClear: { zh: '清除', en: 'Clear' },
    statsLast7DaysDailyChats: { zh: '最近7天每日对话次数', en: 'Daily Chats in Last 7 Days' },
    statsLast7DaysDailyFiles: { zh: '最近7天每日创建文件次数', en: 'Daily File Creations in Last 7 Days' },
    statsUserLabel: { zh: '用户:', en: 'User:' },
    statsLoading: { zh: '加载中...', en: 'Loading...' },
    statsNoData: { zh: '暂无统计数据', en: 'No Statistics Data' },
    statsNoRecords: { zh: '暂无记录', en: 'No Records' },
    statsChatRecords: { zh: '对话记录', en: 'Chat Records' },
    statsFileRecords: { zh: '文件创建记录', en: 'File Creation Records' },
    statsTotal: { zh: '共', en: 'Total' },
    statsRecords: { zh: '条', en: 'records' },
    statsUserType: { zh: '类型:', en: 'Type:' },
    statsModel: { zh: '模型:', en: 'Model:' },
    statsIP: { zh: 'IP:', en: 'IP:' },
    statsTime: { zh: '时间:', en: 'Time:' },
    statsFile: { zh: '文件:', en: 'File:' },
    statsLocalUser: { zh: '本地用户', en: 'Local User' },
    statsCloudUser: { zh: '云端', en: 'Cloud' },
    statsLocalUserType: { zh: '本地', en: 'Local' },
    statsCopyUserID: { zh: '用户ID已复制', en: 'User ID copied' },
    statsCopyUserIDTitle: { zh: '复制用户ID', en: 'Copy User ID' },
    // 后台管理-基础设置额外文本
    basicDefaultEngineDesc: { zh: '设置系统默认的绘图引擎，新用户或重置后将使用此引擎。', en: 'Set the default drawing engine for new users or after reset.' },
    basicLogoColorDesc: { zh: '设置系统 Logo 的主题颜色，将应用到首页、侧边栏等所有 Logo 显示位置。支持十六进制颜色码（如 #000000）。', en: 'Set the theme color for system Logo. Supports hex color codes (e.g., #000000).' },
    basicDrawioConfig: { zh: 'Draw.io 引擎配置', en: 'Draw.io Engine Configuration' },
    basicUseLocalDrawio: { zh: '使用本地 Draw.io 服务', en: 'Use Local Draw.io Service' },
    basicDrawioAddress: { zh: 'Draw.io 服务地址', en: 'Draw.io Service Address' },
    basicDrawioAddressPlaceholder: { zh: 'http://localhost:8080 或 https://drawio.your-domain.com', en: 'http://localhost:8080 or https://drawio.your-domain.com' },
    basicDrawioDesc: { zh: '配置自托管的 Draw.io 服务地址。可以使用 Docker 快速部署：', en: 'Configure self-hosted Draw.io service address. Quick deploy with Docker:' },
    basicSaving: { zh: '保存中...', en: 'Saving...' },
    basicLoadFailed: { zh: '加载配置失败', en: 'Failed to load configuration' },
    basicSaveFailed: { zh: '保存配置失败', en: 'Failed to save configuration' },
    basicSaveSuccess: { zh: '基础配置已保存', en: 'Basic configuration saved' },
  },
  notifications: {},
  setSystemName: (name) => set({ systemName: name }),
  setShowAbout: (show) => set({ showAbout: show }),
  setSidebarCollapsed: (collapsed) => {
    localStorage.setItem('sidebarCollapsed', String(collapsed))
    set({ sidebarCollapsed: collapsed })
  },
  setDefaultEngine: (engine) => {
    localStorage.setItem('defaultEngine', engine)
    set({ defaultEngine: engine })
  },
  setDefaultModelPrompt: (prompt) => set({ defaultModelPrompt: prompt }),
  setLogoColor: (color) => set({ logoColor: color }),
  setLanguage: (language) => {
    localStorage.setItem('language', language)
    set({ language })
  },
  setI18nTexts: (texts) => set({ i18nTexts: texts }),
  setNotifications: (notifications) => set({ notifications }),
  setDrawioConfig: (config) => set({ drawioConfig: config }),
}))

