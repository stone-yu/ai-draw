import {useEffect, useState} from 'react'
import {useLocation, useNavigate} from 'react-router-dom'
import {
  ArrowDownUp,
  ChevronLeft,
  ChevronRight,
  Edit,
  Folder,
  FolderOpen,
  MoreVertical,
  Plus,
  Search,
  Sparkles,
  Upload
} from 'lucide-react'
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  Input,
  Loading,
  Logo,
} from '@/components/ui'
import {AppSidebar, CreateProjectDialog, ImportProjectDialog} from '@/components/layout'
import {formatDate} from '@/lib/utils'
import type {Group, Project} from '@/types'
import {ProjectRepository} from '@/services/projectRepository'
import {GroupRepository} from '@/services/groupRepository'

export function ProjectsPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const [projects, setProjects] = useState<Project[]>([])
  const [groups, setGroups] = useState<Group[]>([])
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null) // null = All, 'uncategorized' = Uncategorized
  const [isLoading, setIsLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [page, setPage] = useState(1)
  const [pageSize] = useState(18)
  const [total, setTotal] = useState(0)
  const [sortBy, setSortBy] = useState<'createdAt' | 'updatedAt'>('updatedAt')

  // Create dialog state
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false)

  // Import dialog state
  const [isImportDialogOpen, setIsImportDialogOpen] = useState(false)

  // Delete dialog state
  const [deleteTarget, setDeleteTarget] = useState<Project | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)

  // Rename dialog state
  const [renameTarget, setRenameTarget] = useState<Project | null>(null)
  const [newTitle, setNewTitle] = useState('')
  const [isRenaming, setIsRenaming] = useState(false)

  // Group dialogs state
  const [isCreateGroupDialogOpen, setIsCreateGroupDialogOpen] = useState(false)
  const [newGroupName, setNewGroupName] = useState('')
  const [isCreatingGroup, setIsCreatingGroup] = useState(false)

  const [editGroupTarget, setEditGroupTarget] = useState<Group | null>(null)
  const [editGroupName, setEditGroupName] = useState('')
  const [isEditingGroup, setIsEditingGroup] = useState(false)

  const [deleteGroupTarget, setDeleteGroupTarget] = useState<Group | null>(null)
  const [isDeletingGroup, setIsDeletingGroup] = useState(false)

  // Move project dialog state
  const [moveProjectTarget, setMoveProjectTarget] = useState<Project | null>(null)
  const [targetGroupId, setTargetGroupId] = useState<string>('')
  const [isMovingProject, setIsMovingProject] = useState(false)

  const [previewProject, setPreviewProject] = useState<Project | null>(null)

  // Load data
  useEffect(() => {
    loadData()
  }, [page, selectedGroupId, searchQuery, sortBy])

  // Open create dialog if navigated with state
  useEffect(() => {
    if (location.state?.openCreateDialog) {
      setIsCreateDialogOpen(true)
      // Clear the state to prevent reopening on refresh
      navigate(location.pathname, { replace: true, state: {} })
    }
  }, [location.state])

  const loadData = async () => {
    setIsLoading(true)
    try {
      const { items, total } = await ProjectRepository.getAll(page, pageSize, searchQuery, selectedGroupId, sortBy)
      const groupsData = await GroupRepository.getAll()
      setProjects(items)
      setTotal(total)
      setGroups(groupsData)
    } catch (error) {
      console.error('Failed to load data:', error)
    } finally {
      setIsLoading(false)
    }
  }

  // Removed filteredProjects useMemo as filtering is now server-side

  // --- Project Actions ---

  const handleDelete = async () => {
    if (!deleteTarget) return

    setIsDeleting(true)
    try {
      await ProjectRepository.delete(deleteTarget.id)
      setDeleteTarget(null)
      loadData() // Reload all data to be safe
    } catch (error) {
      console.error('Failed to delete project:', error)
    } finally {
      setIsDeleting(false)
    }
  }

  const handleRename = async () => {
    if (!renameTarget || !newTitle.trim()) return

    setIsRenaming(true)
    try {
      await ProjectRepository.update(renameTarget.id, { title: newTitle.trim() })
      setRenameTarget(null)
      setNewTitle('')
      loadData()
    } catch (error) {
      console.error('Failed to rename project:', error)
    } finally {
      setIsRenaming(false)
    }
  }

  const handleMoveProject = async () => {
    if (!moveProjectTarget) return

    setIsMovingProject(true)
    try {
      // If targetGroupId is empty string, it means 'Uncategorized' (remove groupId)
      // Hack: cast to any to allow null if needed, or just rely on the fact that we are updating.
      await ProjectRepository.update(moveProjectTarget.id, { groupId: targetGroupId || null } as any)

      setMoveProjectTarget(null)
      setTargetGroupId('')
      loadData()
    } catch (error) {
      console.error('Failed to move project:', error)
    } finally {
      setIsMovingProject(false)
    }
  }

  const openRenameDialog = (project: Project) => {
    setRenameTarget(project)
    setNewTitle(project.title)
  }

  // --- Group Actions ---

  const handleCreateGroup = async () => {
    if (!newGroupName.trim()) return

    setIsCreatingGroup(true)
    try {
      await GroupRepository.create(newGroupName.trim())
      setNewGroupName('')
      setIsCreateGroupDialogOpen(false)
      loadData()
    } catch (error) {
      console.error('Failed to create group:', error)
    } finally {
      setIsCreatingGroup(false)
    }
  }

  const handleEditGroup = async () => {
    if (!editGroupTarget || !editGroupName.trim()) return

    setIsEditingGroup(true)
    try {
      await GroupRepository.update(editGroupTarget.id, editGroupName.trim())
      setEditGroupTarget(null)
      setEditGroupName('')
      loadData()
    } catch (error) {
      console.error('Failed to update group:', error)
    } finally {
      setIsEditingGroup(false)
    }
  }

  const handleDeleteGroup = async () => {
    if (!deleteGroupTarget) return

    setIsDeletingGroup(true)
    try {
      await GroupRepository.delete(deleteGroupTarget.id)
      // If we deleted the currently selected group, switch to All
      if (selectedGroupId === deleteGroupTarget.id) {
        setSelectedGroupId(null)
      }
      setDeleteGroupTarget(null)
      loadData()
    } catch (error) {
      console.error('Failed to delete group:', error)
    } finally {
      setIsDeletingGroup(false)
    }
  }

  return (
    <div className="flex min-h-screen bg-white overflow-hidden">
      {/* Floating Sidebar Navigation */}
      <AppSidebar onCreateProject={() => setIsCreateDialogOpen(true)} />

      {/* Main Content */}
      <main className="flex flex-1 pl-[72px] h-screen">
        {/* Middle Column: Groups & Search */}
        <div className="flex w-64 flex-col border-r border-border bg-surface/50">
          {/* Header */}
          <div className="flex h-14 items-center justify-between border-b border-border px-4">
            <h2 className="font-semibold text-primary">文件管理</h2>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => setIsCreateGroupDialogOpen(true)}
              title="新建分组"
            >
              <Plus className="h-4 w-4" />
            </Button>
          </div>

          {/* Search */}
          <div className="p-4 border-b border-border">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
              <Input
                placeholder="搜索文件..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value)
                  setPage(1)
                }}
                className="h-9 rounded-lg border-border bg-background pl-9 pr-4 text-sm focus:border-primary"
              />
            </div>
          </div>

          {/* Groups List */}
          <div className="flex-1 overflow-y-auto p-2 space-y-1">
            <button
              onClick={() => {
                setSelectedGroupId(null)
                setPage(1)
              }}
              className={`flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors ${
                selectedGroupId === null
                  ? 'bg-primary/10 text-primary font-medium'
                  : 'text-muted-foreground hover:bg-muted hover:text-primary'
              }`}
            >
              <Folder className="h-4 w-4" />
              全部文件
              <span className="ml-auto text-xs opacity-60">{total}</span>
            </button>

            <button
              onClick={() => {
                setSelectedGroupId('uncategorized')
                setPage(1)
              }}
              className={`flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors ${
                selectedGroupId === 'uncategorized'
                  ? 'bg-primary/10 text-primary font-medium'
                  : 'text-muted-foreground hover:bg-muted hover:text-primary'
              }`}
            >
              <FolderOpen className="h-4 w-4" />
              未分组
              <span className="ml-auto text-xs opacity-60">
                {/* Count is not available for uncategorized without fetching */}
              </span>
            </button>

            {groups.map(group => (
              <div key={group.id} className="group/item relative">
                <button
                  onClick={() => {
                    setSelectedGroupId(group.id)
                    setPage(1)
                  }}
                  className={`flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors ${
                    selectedGroupId === group.id
                      ? 'bg-primary/10 text-primary font-medium'
                      : 'text-muted-foreground hover:bg-muted hover:text-primary'
                  }`}
                >
                  <Folder className="h-4 w-4" />
                  <span className="truncate">{group.name}</span>
                  <span className="ml-auto text-xs opacity-60">
                    {group.projectCount || 0}
                  </span>
                </button>

                {/* Group Actions Dropdown */}
                <div className="absolute right-1 top-1/2 -translate-y-1/2 opacity-0 transition-opacity group-hover/item:opacity-100">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-6 w-6">
                        <MoreVertical className="h-3 w-3" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => {
                        setEditGroupTarget(group)
                        setEditGroupName(group.name)
                      }}>
                        重命名
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        className="text-red-600 focus:text-red-600"
                        onClick={() => setDeleteGroupTarget(group)}
                      >
                        删除
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Right Column: Projects Grid */}
        <div className="flex flex-1 flex-col overflow-hidden bg-white">
          {/* Header */}
          <div className="flex h-14 items-center justify-between border-b border-border px-6">
            <div className="flex items-center gap-3">
              <h1 className="text-lg font-semibold text-primary">
                {selectedGroupId === null ? '全部文件' :
                 selectedGroupId === 'uncategorized' ? '未分组' :
                 groups.find(g => g.id === selectedGroupId)?.name || '文件列表'}
              </h1>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className="rounded-full h-8 gap-1.5">
                    <ArrowDownUp className="h-3.5 w-3.5" />
                    <span className="text-xs">
                      {sortBy === 'updatedAt' ? '最后更新' : '创建时间'}
                    </span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start">
                  <DropdownMenuItem
                    onClick={() => {
                      setSortBy('updatedAt')
                      setPage(1)
                    }}
                    className={sortBy === 'updatedAt' ? 'bg-primary/10 text-primary' : ''}
                  >
                    按最后更新时间
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => {
                      setSortBy('createdAt')
                      setPage(1)
                    }}
                    className={sortBy === 'createdAt' ? 'bg-primary/10 text-primary' : ''}
                  >
                    按创建时间
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsImportDialogOpen(true)}
                className="rounded-full"
              >
                <Upload className="mr-2 h-3.5 w-3.5" />
                导入
              </Button>
              <Button
                size="sm"
                onClick={() => setIsCreateDialogOpen(true)}
                className="rounded-full bg-primary text-surface hover:bg-primary/90"
              >
                <Plus className="mr-2 h-3.5 w-3.5" />
                新建
              </Button>
            </div>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-6">
            {isLoading ? (
              <div className="flex h-full items-center justify-center">
                <Loading size="lg" />
              </div>
            ) : projects.length === 0 ? (
              <div className="flex h-full flex-col items-center justify-center">
                <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-border bg-surface p-12">
                  <Sparkles className="mb-4 h-12 w-12 text-muted" />
                  <p className="mb-4 text-muted">
                    {searchQuery ? '未找到匹配的文件' : '暂无文件'}
                  </p>
                  {!searchQuery && (
                    <Button
                      onClick={() => setIsCreateDialogOpen(true)}
                      className="rounded-full bg-primary px-6 text-surface hover:bg-primary/90"
                    >
                      创建你的第一个文件
                    </Button>
                  )}
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6">
                {/* Project Cards */}
                {projects.map((project) => (
                  <div
                    key={project.id}
                    className="group relative cursor-pointer overflow-hidden rounded-2xl bg-background/80 transition-all duration-300 hover:-translate-y-1 hover:bg-surface hover:shadow-[0_8px_30px_rgb(0,0,0,0.06)] border border-transparent hover:border-border/50"
                    onClick={() => setPreviewProject(project)}
                    onDoubleClick={() => navigate(`/editor/${project.id}`)}
                  >
                    {/* Edit Button - 左上角 */}
                    <div className="absolute left-2 top-2 z-10 opacity-0 transition-opacity group-hover:opacity-100">
                      <Button
                        size="icon"
                        variant="secondary"
                        className="h-8 w-8 rounded-full bg-surface/90 shadow-sm backdrop-blur-sm hover:bg-surface"
                        onClick={(e) => {
                          e.stopPropagation()
                          navigate(`/editor/${project.id}`)
                        }}
                      >
                        <Edit className="h-4 w-4 text-primary" />
                      </Button>
                    </div>

                    {/* Action Buttons - 右上角 */}
                    <div className="absolute right-2 top-2 z-10 flex gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                      <div className="flex items-center rounded-md bg-surface/90 px-2 py-1 text-[10px] font-medium text-muted-foreground shadow-sm backdrop-blur-sm">
                        更新于 {formatDate(project.updatedAt)}
                      </div>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 bg-surface/80 backdrop-blur-sm hover:bg-surface"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <MoreVertical className="h-3.5 w-3.5" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={(e) => {
                            e.stopPropagation()
                            openRenameDialog(project)
                          }}>
                            重命名
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={(e) => {
                            e.stopPropagation()
                            setMoveProjectTarget(project)
                            setTargetGroupId(project.groupId || '')
                          }}>
                            移动到...
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            className="text-red-600 focus:text-red-600"
                            onClick={(e) => {
                              e.stopPropagation()
                              setDeleteTarget(project)
                            }}
                          >
                            删除
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>

                    {/* Thumbnail */}
                    <div className="flex h-32 items-center justify-center bg-background/50 p-6 border-b border-dashed border-border/60">
                      {project.thumbnail ? (
                        <img
                          src={project.thumbnail}
                          alt={project.title}
                          className="h-full w-full object-contain"
                        />
                      ) : (
                        <Logo className="h-8 w-8 text-muted/50 group-hover:text-primary/50 transition-colors" />
                      )}
                    </div>

                    {/* Info */}
                    <div className="p-4 text-left w-full bg-white">
                      <div className="mb-2 flex items-center gap-2">
                        <h3 className="truncate text-sm font-medium text-primary/90 group-hover:text-primary pl-1">
                          {project.title}
                        </h3>
                      </div>
                      <div className="flex items-center justify-between gap-2">
                        <span className={`flex-shrink-0 rounded-md px-1.5 py-0.5 text-[10px] font-medium ${
                          project.engineType === 'excalidraw'
                            ? 'bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400'
                            : project.engineType === 'drawio'
                              ? 'bg-green-50 text-green-600 dark:bg-green-900/20 dark:text-green-400'
                              : 'bg-purple-50 text-purple-600 dark:bg-purple-900/20 dark:text-purple-400'
                        }`}>
                          {project.engineType.toUpperCase()}
                        </span>
                        <p className="text-[10px] text-muted-foreground/60">
                          创建于 {formatDate(project.createdAt)}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Pagination */}
            {total > pageSize && (
              <div className="flex items-center justify-center gap-2 py-4 border-t border-border mt-4">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="h-8 w-8 p-0"
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <span className="text-sm text-muted-foreground">
                  第 {page} 页 / 共 {Math.ceil(total / pageSize)} 页
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage(p => Math.min(Math.ceil(total / pageSize), p + 1))}
                  disabled={page >= Math.ceil(total / pageSize)}
                  className="h-8 w-8 p-0"
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            )}
          </div>
        </div>
      </main>

      {/* Create Dialog */}
      <CreateProjectDialog
        open={isCreateDialogOpen}
        onOpenChange={setIsCreateDialogOpen}
      />

      {/* Import Dialog */}
      <ImportProjectDialog
        open={isImportDialogOpen}
        onOpenChange={setIsImportDialogOpen}
      />

      {/* Rename Dialog */}
      <Dialog open={!!renameTarget} onOpenChange={() => setRenameTarget(null)}>
        <DialogContent className="rounded-2xl">
          <DialogHeader>
            <DialogTitle>重命名文件</DialogTitle>
          </DialogHeader>
          <Input
            className='my-4'
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            placeholder="文件名称"
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleRename()
            }}
          />
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setRenameTarget(null)}
              className="rounded-full"
            >
              取消
            </Button>
            <Button
              onClick={handleRename}
              disabled={isRenaming || !newTitle.trim()}
              className="rounded-full bg-primary text-surface hover:bg-primary/90"
            >
              {isRenaming ? '保存中...' : '保存'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <DialogContent className="rounded-2xl">
          <DialogHeader>
            <DialogTitle>删除文件</DialogTitle>
            <DialogDescription className='my-4'>
              确定要删除 &quot;{deleteTarget?.title}&quot; 吗？此操作无法撤销。
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeleteTarget(null)}
              className="rounded-full"
            >
              取消
            </Button>
            <Button
              onClick={handleDelete}
              disabled={isDeleting}
              className="rounded-full bg-red-600 text-surface hover:bg-red-700"
            >
              {isDeleting ? '删除中...' : '删除'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create Group Dialog */}
      <Dialog open={isCreateGroupDialogOpen} onOpenChange={setIsCreateGroupDialogOpen}>
        <DialogContent className="rounded-2xl">
          <DialogHeader>
            <DialogTitle>新建分组</DialogTitle>
          </DialogHeader>
          <Input
            className='my-4'
            value={newGroupName}
            onChange={(e) => setNewGroupName(e.target.value)}
            placeholder="分组名称"
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleCreateGroup()
            }}
          />
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsCreateGroupDialogOpen(false)}
              className="rounded-full"
            >
              取消
            </Button>
            <Button
              onClick={handleCreateGroup}
              disabled={isCreatingGroup || !newGroupName.trim()}
              className="rounded-full bg-primary text-surface hover:bg-primary/90"
            >
              {isCreatingGroup ? '创建中...' : '创建'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Group Dialog */}
      <Dialog open={!!editGroupTarget} onOpenChange={() => setEditGroupTarget(null)}>
        <DialogContent className="rounded-2xl">
          <DialogHeader>
            <DialogTitle>重命名分组</DialogTitle>
          </DialogHeader>
          <Input
            className='my-4'
            value={editGroupName}
            onChange={(e) => setEditGroupName(e.target.value)}
            placeholder="分组名称"
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleEditGroup()
            }}
          />
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setEditGroupTarget(null)}
              className="rounded-full"
            >
              取消
            </Button>
            <Button
              onClick={handleEditGroup}
              disabled={isEditingGroup || !editGroupName.trim()}
              className="rounded-full bg-primary text-surface hover:bg-primary/90"
            >
              {isEditingGroup ? '保存中...' : '保存'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Group Dialog */}
      <Dialog open={!!deleteGroupTarget} onOpenChange={() => setDeleteGroupTarget(null)}>
        <DialogContent className="rounded-2xl">
          <DialogHeader>
            <DialogTitle>删除分组</DialogTitle>
            <DialogDescription className='my-4'>
              确定要删除分组 &quot;{deleteGroupTarget?.name}&quot; 吗？组内的文件将变为未分组状态。
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeleteGroupTarget(null)}
              className="rounded-full"
            >
              取消
            </Button>
            <Button
              onClick={handleDeleteGroup}
              disabled={isDeletingGroup}
              className="rounded-full bg-red-600 text-surface hover:bg-red-700"
            >
              {isDeletingGroup ? '删除中...' : '删除'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Move Project Dialog */}
      <Dialog open={!!moveProjectTarget} onOpenChange={() => setMoveProjectTarget(null)}>
        <DialogContent className="rounded-2xl">
          <DialogHeader>
            <DialogTitle>移动文件到分组</DialogTitle>
          </DialogHeader>
          <div className="my-4 space-y-2">
            <button
              onClick={() => setTargetGroupId('')}
              className={`flex w-full items-center gap-2 rounded-lg border p-3 text-sm transition-colors ${
                targetGroupId === ''
                  ? 'border-primary bg-primary/5 text-primary'
                  : 'border-border hover:bg-muted'
              }`}
            >
              <FolderOpen className="h-4 w-4" />
              未分组
            </button>
            {groups.map(group => (
              <button
                key={group.id}
                onClick={() => setTargetGroupId(group.id)}
                className={`flex w-full items-center gap-2 rounded-lg border p-3 text-sm transition-colors ${
                  targetGroupId === group.id
                    ? 'border-primary bg-primary/5 text-primary'
                    : 'border-border hover:bg-muted'
                }`}
              >
                <Folder className="h-4 w-4" />
                {group.name}
              </button>
            ))}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setMoveProjectTarget(null)}
              className="rounded-full"
            >
              取消
            </Button>
            <Button
              onClick={handleMoveProject}
              disabled={isMovingProject}
              className="rounded-full bg-primary text-surface hover:bg-primary/90"
            >
              {isMovingProject ? '移动中...' : '移动'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Project Preview Dialog */}
      <Dialog open={!!previewProject} onOpenChange={() => setPreviewProject(null)}>
        <DialogContent className="max-w-3xl p-0 overflow-hidden bg-transparent border-none shadow-none">
          <div className="relative flex flex-col items-center justify-center">
            <div className="relative w-full bg-white rounded-lg overflow-hidden shadow-2xl">
              <div className="flex items-center justify-center bg-white p-8 min-h-[400px]">
                {previewProject?.thumbnail ? (
                  <img
                    src={previewProject.thumbnail}
                    alt={previewProject.title}
                    className="max-w-full max-h-[60vh] object-contain shadow-lg rounded-md"
                  />
                ) : (
                  <div className="flex flex-col items-center justify-center text-muted-foreground">
                    <Logo className="h-24 w-24 opacity-20 mb-4" />
                    <p>暂无预览图</p>
                  </div>
                )}
              </div>
              <div className="bg-white p-6 flex items-center justify-between border-t border-border">
                <div className="flex flex-col gap-2 flex-1 mr-4">
                  <h2 className="text-xl font-semibold text-primary truncate" title={previewProject?.title}>{previewProject?.title}</h2>
                  <div className="flex items-center gap-4 text-sm text-muted-foreground">
                    <span>创建时间：{previewProject && formatDate(previewProject.createdAt, true)}</span>
                    <span className="w-px h-3 bg-border"></span>
                    <span>更新时间：{previewProject && formatDate(previewProject.updatedAt, true)}</span>
                  </div>
                </div>
                <Button
                  onClick={() => {
                    if (previewProject) {
                      navigate(`/editor/${previewProject.id}`)
                    }
                  }}
                  className="rounded-full px-8 h-12 text-base shrink-0"
                >
                  进入编辑
                </Button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
