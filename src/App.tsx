import {useEffect} from 'react'
import {BrowserRouter, Route, Routes} from 'react-router-dom'
import {Toaster, TooltipProvider} from '@/components/ui'
import {
  AboutPage,
  AdminPage,
  ChangelogPage,
  EditorPage,
  FeedbackPage,
  HomePage,
  LoginPage,
  ManualPage,
  ProfilePage,
  ProjectsPage,
  RegisterPage
} from '@/pages'
import {ProtectedRoute} from '@/components/auth/ProtectedRoute'
import {useSystemStore} from '@/stores/systemStore'
import {updateFaviconColor} from '@/utils/favicon'
import {authService} from '@/services/authService'

function App() {
  const logoColor = useSystemStore((state) => state.logoColor)
  const setLogoColor = useSystemStore((state) => state.setLogoColor)
  const setSystemName = useSystemStore((state) => state.setSystemName)
  const setDefaultEngine = useSystemStore((state) => state.setDefaultEngine)
  const setDefaultModelPrompt = useSystemStore((state) => state.setDefaultModelPrompt)
  const setNotifications = useSystemStore((state) => state.setNotifications)
  const setDrawioConfig = useSystemStore((state) => state.setDrawioConfig)

  // Load system settings on app startup
  useEffect(() => {
    const loadSystemSettings = async () => {
      try {
        const settings = await authService.getSystemSettings()
        if (settings.system) {
          if (settings.system.name) setSystemName(settings.system.name)
          if (settings.system.logoColor) setLogoColor(settings.system.logoColor)
          if (settings.system.defaultEngine) setDefaultEngine(settings.system.defaultEngine)
          if (settings.system.defaultModelPrompt) setDefaultModelPrompt(settings.system.defaultModelPrompt)
          if (settings.system.notifications) setNotifications(settings.system.notifications)
          if (settings.system.useLocalDrawio !== undefined && settings.system.drawioBaseUrl !== undefined) {
            setDrawioConfig({
              useLocalDrawio: settings.system.useLocalDrawio,
              drawioBaseUrl: settings.system.drawioBaseUrl
            })
          }
        }
      } catch (error) {
        // Silently fail if settings can't be loaded (e.g., not logged in or server unavailable)
        console.debug('Failed to load system settings:', error)
      }
    }
    loadSystemSettings()
  }, [setLogoColor, setSystemName, setDefaultEngine, setDefaultModelPrompt, setNotifications, setDrawioConfig])

  // Update favicon when logo color changes
  useEffect(() => {
    updateFaviconColor(logoColor)
  }, [logoColor])

  return (
    <TooltipProvider>
      <BrowserRouter>
        <Routes>
          {/* Public Routes */}
          <Route path="/" element={<HomePage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/about" element={<AboutPage />} />

          {/* Documentation Routes */}
          <Route path="/docs/manual" element={<ManualPage />} />
          <Route path="/docs/changelog" element={<ChangelogPage />} />
          <Route path="/docs/feedback" element={<FeedbackPage />} />

          {/* Protected Routes */}
          <Route element={<ProtectedRoute />}>
            <Route path="/projects" element={<ProjectsPage />} />
            <Route path="/editor/:projectId" element={<EditorPage />} />
            <Route path="/editor/example/:projectId" element={<EditorPage mode="example" />} />
            <Route path="/profile" element={<ProfilePage />} />
            <Route path="/admin" element={<AdminPage />} />
          </Route>
        </Routes>
      </BrowserRouter>
      <Toaster />
    </TooltipProvider>
  )
}

export default App
