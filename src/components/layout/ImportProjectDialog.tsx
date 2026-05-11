import { useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { Upload, FileText } from 'lucide-react'
import {
  Button,
  Input,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui'
import { ENGINES } from '@/constants'
import { ProjectRepository } from '@/services/projectRepository'
import { VersionRepository } from '@/services/versionRepository'
import type { EngineType } from '@/types'

interface ImportProjectDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

type ImportMode = 'file' | 'text'

export function ImportProjectDialog({ open, onOpenChange }: ImportProjectDialogProps) {
  const navigate = useNavigate()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [title, setTitle] = useState('未命名')
  const [engine, setEngine] = useState<EngineType>('mermaid')
  const [importMode, setImportMode] = useState<ImportMode>('file')
  const [textContent, setTextContent] = useState('')
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [isImporting, setIsImporting] = useState(false)

  // Exclude html engine from import (out-of-scope for first pass)
  const importableEngines = ENGINES.filter((e) => e.value !== 'html')

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      setSelectedFile(file)
      // 使用文件名作为项目名称（去掉扩展名）
      const fileName = file.name.replace(/\.[^/.]+$/, '')
      if (fileName) {
        setTitle(fileName)
      }
    }
  }

  const handleImport = async () => {
    if (!title.trim()) return

    let content = ''

    if (importMode === 'file') {
      if (!selectedFile) return
      content = await selectedFile.text()
    } else {
      if (!textContent.trim()) return
      content = textContent.trim()
    }

    setIsImporting(true)
    try {
      // 创建项目
      const project = await ProjectRepository.create({
        title: title.trim(),
        engineType: engine,
      })

      // 创建初始版本
      await VersionRepository.create({
        projectId: project.id,
        content,
        changeSummary: '导入',
      })

      onOpenChange(false)
      resetForm()
      navigate(`/editor/${project.id}`)
    } catch (error) {
      console.error('Failed to import project:', error)
    } finally {
      setIsImporting(false)
    }
  }

  const resetForm = () => {
    setTitle('未命名')
    setEngine('mermaid')
    setImportMode('file')
    setTextContent('')
    setSelectedFile(null)
  }

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      resetForm()
    }
    onOpenChange(newOpen)
  }

  const isSubmitDisabled = () => {
    if (!title.trim()) return true
    if (importMode === 'file' && !selectedFile) return true
    if (importMode === 'text' && !textContent.trim()) return true
    return isImporting
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="rounded-2xl">
        <DialogHeader>
          <DialogTitle>导入项目</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-4">
          {/* 项目名称 */}
          <div>
            <label className="mb-2 block text-sm font-medium">项目名称</label>
            <Input
              placeholder="请输入项目名称"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="rounded-xl"
            />
          </div>

          {/* 引擎选择 */}
          <div>
            <label className="mb-2 block text-sm font-medium">引擎</label>
            <div className="flex gap-2">
              {importableEngines.map((e) => (
                <button
                  key={e.value}
                  onClick={() => setEngine(e.value)}
                  className={`flex-1 rounded-xl border p-3 text-sm transition-colors ${
                    engine === e.value
                      ? 'border-primary bg-primary text-surface'
                      : 'border-border bg-surface text-primary hover:border-primary'
                  }`}
                >
                  {e.label}
                </button>
              ))}
            </div>
            <p className="mt-2 text-xs text-muted">
              请确保引擎类型符合你导入的项目，否则将不能正确渲染
            </p>
          </div>

          {/* 导入方式 Tab */}
          <div>
            <label className="mb-2 block text-sm font-medium">导入内容</label>
            <div className="flex border-b border-border">
              <button
                onClick={() => setImportMode('file')}
                className={`flex items-center gap-2 px-4 py-2 text-sm transition-colors ${
                  importMode === 'file'
                    ? 'border-b-2 border-primary text-primary'
                    : 'text-muted hover:text-primary'
                }`}
              >
                <Upload className="h-4 w-4" />
                文件上传
              </button>
              <button
                onClick={() => setImportMode('text')}
                className={`flex items-center gap-2 px-4 py-2 text-sm transition-colors ${
                  importMode === 'text'
                    ? 'border-b-2 border-primary text-primary'
                    : 'text-muted hover:text-primary'
                }`}
              >
                <FileText className="h-4 w-4" />
                文本输入
              </button>
            </div>

            {/* 文件上传区域 */}
            {importMode === 'file' && (
              <div className="mt-3">
                <input
                  ref={fileInputRef}
                  type="file"
                  onChange={handleFileChange}
                  className="hidden"
                  accept=".mmd,.mermaid,.excalidraw,.drawio,.xml,.json,.txt"
                />
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="flex w-full flex-col items-center justify-center rounded-xl border-2 border-dashed border-border bg-surface p-6 transition-colors hover:border-primary"
                >
                  <Upload className="mb-2 h-8 w-8 text-muted" />
                  {selectedFile ? (
                    <span className="text-sm text-primary">{selectedFile.name}</span>
                  ) : (
                    <>
                      <span className="text-sm text-muted">点击选择文件</span>
                      <span className="mt-1 text-xs text-muted">
                        支持 .mmd, .excalidraw, .drawio, .xml, .json 等格式
                      </span>
                    </>
                  )}
                </button>
              </div>
            )}

            {/* 文本输入区域 */}
            {importMode === 'text' && (
              <div className="mt-3">
                <textarea
                  value={textContent}
                  onChange={(e) => setTextContent(e.target.value)}
                  placeholder="请粘贴图表代码内容..."
                  className="h-32 w-full resize-none rounded-xl border border-border bg-surface p-3 text-sm text-primary placeholder:text-muted focus:border-primary focus:outline-none"
                />
              </div>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="rounded-full"
          >
            取消
          </Button>
          <Button
            onClick={handleImport}
            disabled={isSubmitDisabled()}
            className="rounded-full bg-primary text-surface hover:bg-primary/90"
          >
            {isImporting ? '导入中...' : '导入'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
