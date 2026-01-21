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

function App() {

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
