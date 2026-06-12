import { useEffect, useState, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Button, Input, message, Modal, Upload, Form, Space, Row, Col } from 'antd'
import type { UploadChangeParam } from 'antd/es/upload'
import type { UploadFile } from 'antd/es/upload/interface'
import { FolderOutlined, FileTextOutlined, PictureOutlined, FilePdfOutlined, VideoCameraOutlined, LinkOutlined, FontSizeOutlined } from '@ant-design/icons'
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors } from '@dnd-kit/core'
import { arrayMove, SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { useCourseStore } from '@/store/courseStore'
import { useNaming } from '@/hooks/useNaming'
import * as api from '@/services/api'
import type { Page } from '@/types'
import { PageType, ImageDisplayMode } from '@/types'

const CourseEdit = () => {
  const { courseId } = useParams<{ courseId: string }>()
  const navigate = useNavigate()
  const naming = useNaming()
  const { currentCourse, fetchCourseDetail, updateCourse } = useCourseStore()
  const [uploading, setUploading] = useState(false)
  const [addUrlModalOpen, setAddUrlModalOpen] = useState(false)
  const [editUrlModalOpen, setEditUrlModalOpen] = useState(false)
  const [addTitleModalOpen, setAddTitleModalOpen] = useState(false)
  const [editTitleModalOpen, setEditTitleModalOpen] = useState(false)
  const [selectedPage, setSelectedPage] = useState<Page | null>(null)
  const [editingPageId, setEditingPageId] = useState<string | null>(null)
  const [editingName, setEditingName] = useState('')
  const [editingUrlPageId, setEditingUrlPageId] = useState<string | null>(null)
  const [editingTitlePageId, setEditingTitlePageId] = useState<string | null>(null)
  const [urlForm] = Form.useForm()
  const [titleForm] = Form.useForm()

  // 使用 ref 跟踪已处理的文件，防止重复上传
  const processedFilesRef = useRef<Set<string>>(new Set())
  const lastUploadTimeRef = useRef<number>(0)

  // 预览区域引用
  const previewContainerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (courseId) {
      fetchCourseDetail(courseId)
    }
  }, [courseId, fetchCourseDetail])

  useEffect(() => {
    if (currentCourse) {
      // 默认选中第一个页面
      if (currentCourse.pages.length > 0 && !selectedPage) {
        setSelectedPage(currentCourse.pages[0])
      }
    }
  }, [currentCourse])

  // 页面切换时更新 BrowserView 预览
  useEffect(() => {
    if (!selectedPage || !courseId) {
      // 如果没有选中页面，销毁 BrowserView
      api.destroyBrowserView()
      return
    }

    // 销毁旧的 BrowserView，创建新的
    const loadPage = async () => {
      await api.destroyBrowserView()

      if (selectedPage.type === PageType.EXTERNAL) {
        // 外部链接使用 URL 加载
        await api.createBrowserView({ url: selectedPage.url!, type: 'url' })
      } else if (selectedPage.type === PageType.TITLE) {
        // 标题页面：生成HTML内容并通过data URL加载
        const text = selectedPage.titleText || selectedPage.name || ''
        const fontSize = selectedPage.titleFontSize || 88
        const color = selectedPage.titleColor || '#ffffff'
        const bgColor = selectedPage.titleBgColor || '#1f1f1f'
        // 将换行符转换为<br>标签，支持多行显示
        const formattedText = text.replace(/\n/g, '<br>')

        const htmlContent = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${text}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { width: 100vw; height: 100vh; display: flex; align-items: center; justify-content: center; background-color: ${bgColor}; overflow: hidden; }
    .title { font-size: ${fontSize}px; color: ${color}; font-weight: bold; text-align: center; padding: 20px; word-wrap: break-word; max-width: 90%; line-height: 1.4; }
  </style>
</head>
<body>
  <div class="title">${formattedText}</div>
</body>
</html>`
        const dataUrl = 'data:text/html;charset=utf-8,' + encodeURIComponent(htmlContent)
        await api.createBrowserView({ url: dataUrl, type: 'url' })
      } else {
        // 其他本地文件使用文件路径加载
        try {
          const filePath = await api.getPageFilePath(courseId, selectedPage.id)
          await api.createBrowserView({ filePath, type: 'file' })
        } catch (error) {
          console.error('Failed to load page:', error)
        }
      }

      // 延迟调整大小
      setTimeout(() => {
        if (previewContainerRef.current) {
          const rect = previewContainerRef.current.getBoundingClientRect()
          api.resizeBrowserView({
            x: rect.left,
            y: rect.top,
            width: rect.width,
            height: rect.height,
          })
        }
      }, 100)
    }

    loadPage()

    return () => {
      api.destroyBrowserView()
    }
  }, [selectedPage, courseId])

  // 窗口大小变化时调整 BrowserView
  useEffect(() => {
    const handleResize = () => {
      if (selectedPage && previewContainerRef.current) {
        const rect = previewContainerRef.current.getBoundingClientRect()
        api.resizeBrowserView({
          x: rect.left,
          y: rect.top,
          width: rect.width,
          height: rect.height,
        })
      }
    }

    window.addEventListener('resize', handleResize)
    return () => {
      window.removeEventListener('resize', handleResize)
    }
  }, [selectedPage])

  // 添加网址对话框打开/关闭时隐藏/显示 BrowserView
  useEffect(() => {
    if (addUrlModalOpen) {
      api.hideBrowserView()
    } else {
      // 对话框关闭后，延迟显示 BrowserView 以确保布局已稳定
      setTimeout(() => {
        api.showBrowserView()
        // 重新调整 BrowserView 大小和位置
        if (previewContainerRef.current && selectedPage) {
          const rect = previewContainerRef.current.getBoundingClientRect()
          api.resizeBrowserView({
            x: rect.left,
            y: rect.top,
            width: rect.width,
            height: rect.height,
          })
        }
      }, 100)
    }
  }, [addUrlModalOpen, selectedPage])

  // 编辑网址对话框打开/关闭时隐藏/显示 BrowserView
  useEffect(() => {
    if (editUrlModalOpen) {
      api.hideBrowserView()
    } else {
      // 对话框关闭后，延迟显示 BrowserView 以确保布局已稳定
      setTimeout(() => {
        api.showBrowserView()
        // 重新调整 BrowserView 大小和位置
        if (previewContainerRef.current && selectedPage) {
          const rect = previewContainerRef.current.getBoundingClientRect()
          api.resizeBrowserView({
            x: rect.left,
            y: rect.top,
            width: rect.width,
            height: rect.height,
          })
        }
      }, 100)
    }
  }, [editUrlModalOpen, selectedPage])

  // 添加标题对话框打开/关闭时隐藏/显示 BrowserView
  useEffect(() => {
    if (addTitleModalOpen) {
      api.hideBrowserView()
    } else {
      setTimeout(() => {
        api.showBrowserView()
        if (previewContainerRef.current && selectedPage) {
          const rect = previewContainerRef.current.getBoundingClientRect()
          api.resizeBrowserView({
            x: rect.left,
            y: rect.top,
            width: rect.width,
            height: rect.height,
          })
        }
      }, 100)
    }
  }, [addTitleModalOpen, selectedPage])

  // 编辑标题对话框打开/关闭时隐藏/显示 BrowserView
  useEffect(() => {
    if (editTitleModalOpen) {
      api.hideBrowserView()
    } else {
      setTimeout(() => {
        api.showBrowserView()
        if (previewContainerRef.current && selectedPage) {
          const rect = previewContainerRef.current.getBoundingClientRect()
          api.resizeBrowserView({
            x: rect.left,
            y: rect.top,
            width: rect.width,
            height: rect.height,
          })
        }
      }, 100)
    }
  }, [editTitleModalOpen, selectedPage])

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  )

  const handleDragEnd = (event: any) => {
    const { active, over } = event

    if (!over || active.id === over.id || !currentCourse) return

    const oldIndex = currentCourse.pages.findIndex((p) => p.id === active.id)
    const newIndex = currentCourse.pages.findIndex((p) => p.id === over.id)

    const newPages = arrayMove(currentCourse.pages, oldIndex, newIndex)
    const newPageIds = newPages.map((p) => p.id)

    updateCourse(courseId!, { pageIds: newPageIds })
  }

  const handleUploadZip = async (file: File) => {
    setUploading(true)
    try {
      const result = await api.uploadZip(courseId!, file)
      message.success(`成功添加 ${result.pages.length} 个页面`)
      await fetchCourseDetail(courseId!)

      // 自动选中并预览最新上传的页面（最后一个）
      const updatedCourse = useCourseStore.getState().currentCourse
      if (result.pages.length > 0 && updatedCourse && updatedCourse.pages.length > 0) {
        const lastPage = updatedCourse.pages[updatedCourse.pages.length - 1]
        if (lastPage) {
          setSelectedPage(lastPage)
        }
      }
    } catch (error: any) {
      message.error('上传失败')
    } finally {
      setUploading(false)
    }
    return false
  }

  const handleUploadMultipleHtml = async (info: UploadChangeParam<UploadFile>) => {
    // 防止重复上传：检查是否正在上传或距离上次上传时间太短
    const now = Date.now()
    if (uploading || (now - lastUploadTimeRef.current < 500)) {
      return
    }

    const files = info.fileList
      .filter(file => {
        if (!file.originFileObj || file.status === 'removed') return false
        // 使用文件名+大小作为唯一标识，防止重复处理
        const fileKey = `${file.name}-${file.size}`
        if (processedFilesRef.current.has(fileKey)) return false
        processedFilesRef.current.add(fileKey)
        return true
      })
      .map(file => file.originFileObj as File)

    if (files.length === 0) {
      // 清空已处理文件记录，允许下次上传
      setTimeout(() => {
        processedFilesRef.current.clear()
      }, 1000)
      return
    }

    lastUploadTimeRef.current = now
    setUploading(true)
    let successCount = 0
    let failCount = 0

    try {
      // 并发上传所有文件
      const uploadPromises = files.map(async (file) => {
        try {
          await api.uploadHtml(courseId!, file)
          successCount++
        } catch (error) {
          failCount++
        }
      })

      await Promise.all(uploadPromises)

      if (successCount > 0) {
        message.success(`成功添加 ${successCount} 个HTML页面`)
      }
      if (failCount > 0) {
        message.warning(`${failCount} 个文件上传失败`)
      }

      await fetchCourseDetail(courseId!)

      // 自动选中并预览最新上传的页面（最后一个）
      const updatedCourse = useCourseStore.getState().currentCourse
      if (successCount > 0 && updatedCourse && updatedCourse.pages.length > 0) {
        const lastPage = updatedCourse.pages[updatedCourse.pages.length - 1]
        if (lastPage) {
          setSelectedPage(lastPage)
        }
      }
    } catch (error) {
      message.error('批量上传失败')
    } finally {
      setUploading(false)
      // 清空已处理文件记录
      processedFilesRef.current.clear()
    }
  }

  const handleUploadMultipleImages = async (info: UploadChangeParam<UploadFile>) => {
    const now = Date.now()
    if (now - lastUploadTimeRef.current < 500) {
      return
    }

    const files = info.fileList
      .filter(file => {
        if (!file.originFileObj || file.status === 'removed') return false
        const fileKey = `${file.name}-${file.size}`
        if (processedFilesRef.current.has(fileKey)) return false
        processedFilesRef.current.add(fileKey)
        return true
      })
      .map(file => file.originFileObj as File)

    if (files.length === 0) {
      setTimeout(() => {
        processedFilesRef.current.clear()
      }, 1000)
      return
    }

    lastUploadTimeRef.current = now
    // 直接上传，使用默认的适应屏幕模式
    await uploadImagesDirectly(files)
  }

  const uploadImagesDirectly = async (files: File[]) => {
    setUploading(true)
    let successCount = 0
    let failCount = 0

    try {
      // 并发上传所有文件，使用适应屏幕模式
      const uploadPromises = files.map(async (file) => {
        try {
          await api.uploadImage(courseId!, file, ImageDisplayMode.FIT)
          successCount++
        } catch (error) {
          failCount++
        }
      })

      await Promise.all(uploadPromises)

      if (successCount > 0) {
        message.success(`成功添加 ${successCount} 个图片`)
      }
      if (failCount > 0) {
        message.warning(`${failCount} 个文件上传失败`)
      }

      await fetchCourseDetail(courseId!)

      // 自动选中并预览最新上传的页面（最后一个）
      const updatedCourse = useCourseStore.getState().currentCourse
      if (successCount > 0 && updatedCourse && updatedCourse.pages.length > 0) {
        const lastPage = updatedCourse.pages[updatedCourse.pages.length - 1]
        if (lastPage) {
          setSelectedPage(lastPage)
        }
      }
    } catch (error) {
      message.error('批量上传失败')
    } finally {
      setUploading(false)
      processedFilesRef.current.clear()
    }
  }

  const handleUploadMultiplePdfs = async (info: UploadChangeParam<UploadFile>) => {
    // 防止重复上传
    const now = Date.now()
    if (uploading || (now - lastUploadTimeRef.current < 500)) {
      return
    }

    const files = info.fileList
      .filter(file => {
        if (!file.originFileObj || file.status === 'removed') return false
        const fileKey = `${file.name}-${file.size}`
        if (processedFilesRef.current.has(fileKey)) return false
        processedFilesRef.current.add(fileKey)
        return true
      })
      .map(file => file.originFileObj as File)

    if (files.length === 0) {
      setTimeout(() => {
        processedFilesRef.current.clear()
      }, 1000)
      return
    }

    lastUploadTimeRef.current = now
    setUploading(true)
    let successCount = 0
    let failCount = 0

    try {
      // 并发上传所有文件
      const uploadPromises = files.map(async (file) => {
        try {
          await api.uploadPdf(courseId!, file)
          successCount++
        } catch (error) {
          failCount++
        }
      })

      await Promise.all(uploadPromises)

      if (successCount > 0) {
        message.success(`成功添加 ${successCount} 个PDF文件`)
      }
      if (failCount > 0) {
        message.warning(`${failCount} 个文件上传失败`)
      }

      await fetchCourseDetail(courseId!)

      // 自动选中并预览最新上传的页面（最后一个）
      const updatedCourse = useCourseStore.getState().currentCourse
      if (successCount > 0 && updatedCourse && updatedCourse.pages.length > 0) {
        const lastPage = updatedCourse.pages[updatedCourse.pages.length - 1]
        if (lastPage) {
          setSelectedPage(lastPage)
        }
      }
    } catch (error) {
      message.error('批量上传失败')
    } finally {
      setUploading(false)
      processedFilesRef.current.clear()
    }
  }

  const handleUploadMultipleVideos = async (info: UploadChangeParam<UploadFile>) => {
    // 防止重复上传
    const now = Date.now()
    if (uploading || (now - lastUploadTimeRef.current < 500)) {
      return
    }

    const files = info.fileList
      .filter(file => {
        if (!file.originFileObj || file.status === 'removed') return false
        const fileKey = `${file.name}-${file.size}`
        if (processedFilesRef.current.has(fileKey)) return false
        processedFilesRef.current.add(fileKey)
        return true
      })
      .map(file => file.originFileObj as File)

    if (files.length === 0) {
      setTimeout(() => {
        processedFilesRef.current.clear()
      }, 1000)
      return
    }

    lastUploadTimeRef.current = now
    setUploading(true)
    let successCount = 0
    let failCount = 0

    try {
      // 并发上传所有文件
      const uploadPromises = files.map(async (file) => {
        try {
          await api.uploadVideo(courseId!, file)
          successCount++
        } catch (error) {
          failCount++
        }
      })

      await Promise.all(uploadPromises)

      if (successCount > 0) {
        message.success(`成功添加 ${successCount} 个视频文件`)
      }
      if (failCount > 0) {
        message.warning(`${failCount} 个文件上传失败`)
      }

      await fetchCourseDetail(courseId!)

      // 自动选中并预览最新上传的页面（最后一个）
      const updatedCourse = useCourseStore.getState().currentCourse
      if (successCount > 0 && updatedCourse && updatedCourse.pages.length > 0) {
        const lastPage = updatedCourse.pages[updatedCourse.pages.length - 1]
        if (lastPage) {
          setSelectedPage(lastPage)
        }
      }
    } catch (error) {
      message.error('批量上传失败')
    } finally {
      setUploading(false)
      processedFilesRef.current.clear()
    }
  }

  const handleAddUrl = async () => {
    try {
      const values = await urlForm.validateFields()
      await api.addExternalUrl(courseId!, { url: values.url, name: values.name })
      message.success('添加成功')
      setAddUrlModalOpen(false)
      urlForm.resetFields()
      await fetchCourseDetail(courseId!)

      // 自动选中并预览最新添加的外部链接（最后一个）
      const updatedCourse = useCourseStore.getState().currentCourse
      if (updatedCourse && updatedCourse.pages.length > 0) {
        const lastPage = updatedCourse.pages[updatedCourse.pages.length - 1]
        if (lastPage) {
          setSelectedPage(lastPage)
        }
      }
    } catch (error: any) {
      if (error.errorFields) return
      message.error('添加失败')
    }
  }

  const handleEditPage = (page: Page) => {
    if (page.type === PageType.EXTERNAL) {
      urlForm.setFieldsValue({
        url: page.url,
        name: page.name
      })
      setEditingUrlPageId(page.id)
      setEditUrlModalOpen(true)
    } else if (page.type === PageType.TITLE) {
      titleForm.setFieldsValue({
        text: page.titleText || page.name,
        fontSize: page.titleFontSize || 88,
        color: page.titleColor || '#ffffff',
        bgColor: page.titleBgColor || '#1f1f1f'
      })
      setEditingTitlePageId(page.id)
      setEditTitleModalOpen(true)
    } else {
      setEditingPageId(page.id)
      setEditingName(page.name)
    }
  }

  const handleUpdateExternalUrl = async () => {
    try {
      const values = await urlForm.validateFields()
      if (!editingUrlPageId) {
        message.error('未选择要编辑的页面')
        return
      }
      await api.updateExternalUrl(courseId!, editingUrlPageId, {
        url: values.url,
        name: values.name
      })
      message.success('修改成功')
      setEditUrlModalOpen(false)
      setEditingUrlPageId(null)
      urlForm.resetFields()
      await fetchCourseDetail(courseId!)
    } catch (error: any) {
      if (error.errorFields) return
      message.error('修改失败')
    }
  }

  const handleDeletePage = async (pageId: string) => {
    try {
      await api.deletePage(courseId!, pageId)
      message.success('删除成功')
      // 如果删除的是当前选中的页面，清空选中状态
      if (selectedPage?.id === pageId) {
        setSelectedPage(null)
      }
      await fetchCourseDetail(courseId!)
    } catch (error) {
      message.error('删除失败')
    }
  }

  const handleSaveEdit = async (pageId: string) => {
    if (!editingName.trim()) {
      message.error('页面名称不能为空')
      return
    }
    try {
      await api.updatePageName(courseId!, pageId, editingName)
      message.success('修改成功')
      setEditingPageId(null)
      await fetchCourseDetail(courseId!)
    } catch (error) {
      message.error('修改失败')
    }
  }

  const handleCancelEdit = () => {
    setEditingPageId(null)
    setEditingName('')
  }

  /**
   * 处理添加标题页面
   */
  const handleAddTitle = async () => {
    try {
      const values = await titleForm.validateFields()
      await api.addTitlePage(courseId!, {
        text: values.text,
        fontSize: values.fontSize,
        color: values.color,
        bgColor: values.bgColor
      })
      message.success('添加成功')
      setAddTitleModalOpen(false)
      titleForm.resetFields()
      await fetchCourseDetail(courseId!)

      // 自动选中并预览最新添加的标题页面（最后一个）
      const updatedCourse = useCourseStore.getState().currentCourse
      if (updatedCourse && updatedCourse.pages.length > 0) {
        const lastPage = updatedCourse.pages[updatedCourse.pages.length - 1]
        if (lastPage) {
          setSelectedPage(lastPage)
        }
      }
    } catch (error: any) {
      if (error.errorFields) return
      message.error('添加失败')
    }
  }

  /**
   * 处理更新标题页面
   */
  const handleUpdateTitle = async () => {
    try {
      const values = await titleForm.validateFields()
      if (!editingTitlePageId) {
        message.error('未选择要编辑的页面')
        return
      }
      await api.updatePage(courseId!, editingTitlePageId, {
        name: values.text.slice(0, 20),
        title_text: values.text.slice(0, 20),
        title_font_size: values.fontSize,
        title_color: values.color,
        title_bg_color: values.bgColor
      })
      message.success('修改成功')
      setEditTitleModalOpen(false)
      setEditingTitlePageId(null)
      titleForm.resetFields()
      await fetchCourseDetail(courseId!)
    } catch (error: any) {
      if (error.errorFields) return
      message.error('修改失败')
    }
  }

  if (!currentCourse) {
    return <div>加载中...</div>
  }

  return (
    <div style={{ maxWidth: '1400px', margin: '0 auto', paddingBottom: '80px' }}>
      {/* 顶部导航栏 */}
      <div
        style={{
          background: '#fff',
          padding: '16px 24px',
          marginBottom: '16px',
          borderRadius: '4px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <span style={{ fontSize: '18px', fontWeight: 'bold' }}>
          {currentCourse.name}
        </span>
        <div style={{ display: 'flex', gap: '12px' }}>
          <Button type="primary" size="large" onClick={() => {
            api.destroyBrowserView()
            navigate(`/player/${courseId}`)
          }}>
            播放
          </Button>
          <Button type="primary" size="large" onClick={() => {
            api.destroyBrowserView()
            navigate('/')
          }}>
            返回
          </Button>
        </div>
      </div>

      {/* 网页列表 + 预览区域 */}
      <Row gutter={16} style={{ marginBottom: '80px' }}>
        {/* 左侧：网页列表 */}
        <Col span={10}>
          <div
            style={{
              background: '#fff',
              padding: '16px',
              borderRadius: '4px',
              height: 'calc(100vh - 200px)',
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            <div style={{ marginBottom: '16px', fontWeight: 'bold', flexShrink: 0 }}>元素列表:</div>
            <div style={{ flex: 1, overflowY: 'auto', minHeight: 0 }}>
              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={handleDragEnd}
              >
                <SortableContext items={currentCourse.pages.map((p) => p.id)} strategy={verticalListSortingStrategy}>
                  {currentCourse.pages.map((page, index) => (
                    <SortablePageItem
                      key={page.id}
                      page={page}
                      index={index}
                      isSelected={selectedPage?.id === page.id}
                      onSelect={() => setSelectedPage(page)}
                      isEditing={editingPageId === page.id}
                      editingName={editingName}
                      onEditingNameChange={setEditingName}
                      onStartEdit={() => { setEditingPageId(page.id); setEditingName(page.name) }}
                      onSaveEdit={() => handleSaveEdit(page.id)}
                      onCancelEdit={handleCancelEdit}
                      onDelete={() => handleDeletePage(page.id)}
                      onEdit={() => handleEditPage(page)}
                    />
                  ))}
                  {currentCourse.pages.length === 0 && (
                    <div style={{ textAlign: 'center', padding: '40px', color: '#8c8c8c' }}>
                      暂无{naming.pageName}，请上传ZIP压缩包或添加第三方网址
                    </div>
                  )}
                </SortableContext>
              </DndContext>
            </div>
          </div>
        </Col>

        {/* 右侧：预览区域 - 使用 BrowserView */}
        <Col span={14}>
          <div
            style={{
              background: '#fff',
              padding: '16px',
              borderRadius: '4px',
              height: 'calc(100vh - 200px)',
            }}
          >
            <div style={{ marginBottom: '16px', fontWeight: 'bold' }}>预览区域:</div>
            <div
              ref={previewContainerRef}
              style={{
                height: 'calc(100% - 40px)',
                border: '1px solid #d9d9d9',
                borderRadius: '4px',
                overflow: 'hidden',
                background: selectedPage ? '#f5f5f5' : 'transparent',
              }}
            >
              {selectedPage ? (
                // BrowserView 预览区域 - 所有页面类型统一使用 BrowserView
                <div style={{ width: '100%', height: '100%' }} />
              ) : (
                <div
                  style={{
                    height: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#8c8c8c',
                  }}
                >
                  请选择左侧{naming.pageName}进行预览
                </div>
              )}
            </div>
          </div>
        </Col>
      </Row>

      {/* 底部上传区域 */}
      <div
        style={{
          position: 'fixed',
          bottom: 0,
          left: 0,
          right: 0,
          height: '64px',
          background: '#fff',
          borderTop: '1px solid #d9d9d9',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '12px',
          zIndex: 1000,
        }}
      >
        <Upload
          beforeUpload={handleUploadZip}
          showUploadList={false}
          accept=".zip"
          disabled={uploading}
        >
          <Button type="primary" icon={<FolderOutlined />} loading={uploading} size="large">
            ZIP
          </Button>
        </Upload>
        <Upload
          multiple
          beforeUpload={() => false}
          onChange={handleUploadMultipleHtml}
          showUploadList={false}
          accept=".html,.htm"
          disabled={uploading}
        >
          <Button type="primary" icon={<FileTextOutlined />} loading={uploading} size="large">
            HTML
          </Button>
        </Upload>
        <Upload
          multiple
          beforeUpload={() => false}
          onChange={handleUploadMultipleImages}
          showUploadList={false}
          accept=".jpg,.jpeg,.png,.gif,.webp,.bmp,.svg"
          disabled={uploading}
        >
          <Button type="primary" icon={<PictureOutlined />} loading={uploading} size="large">
            图片
          </Button>
        </Upload>
        <Upload
          multiple
          beforeUpload={() => false}
          onChange={handleUploadMultiplePdfs}
          showUploadList={false}
          accept=".pdf"
          disabled={uploading}
        >
          <Button type="primary" icon={<FilePdfOutlined />} loading={uploading} size="large">
            PDF
          </Button>
        </Upload>
        <Upload
          multiple
          beforeUpload={() => false}
          onChange={handleUploadMultipleVideos}
          showUploadList={false}
          accept=".mp4,.webm,.ogg"
          disabled={uploading}
        >
          <Button type="primary" icon={<VideoCameraOutlined />} loading={uploading} size="large">
            视频
          </Button>
        </Upload>
        <Button
          type="primary"
          icon={<LinkOutlined />}
          onClick={() => setAddUrlModalOpen(true)}
          size="large"
        >
          网址
        </Button>
        <Button
          type="primary"
          icon={<FontSizeOutlined />}
          onClick={() => setAddTitleModalOpen(true)}
          size="large"
        >
          标题
        </Button>
      </div>

      {/* 添加第三方网址对话框 */}
      <Modal
        title="添加第三方网址"
        open={addUrlModalOpen}
        onOk={handleAddUrl}
        onCancel={() => {
          setAddUrlModalOpen(false)
          urlForm.resetFields()
        }}
        okText="添加"
        cancelText="取消"
      >
        <Form form={urlForm} layout="vertical">
          <Form.Item
            label="显示名称"
            name="name"
            rules={[{ required: true, message: '请输入显示名称' }]}
          >
            <Input placeholder="页面名称" />
          </Form.Item>
          <Form.Item
            label="网址URL"
            name="url"
            rules={[
              { required: true, message: '请输入网址' },
              { type: 'url', message: '请输入有效的URL' },
            ]}
          >
            <Input placeholder="https://example.com" />
          </Form.Item>
          <div style={{ color: '#faad14', fontSize: '12px' }}>
            注意：部分网站禁止在iframe中嵌入，可能无法正常显示
          </div>
        </Form>
      </Modal>

      {/* 编辑第三方网址对话框 */}
      <Modal
        title="编辑第三方网址"
        open={editUrlModalOpen}
        onOk={handleUpdateExternalUrl}
        onCancel={() => {
          setEditUrlModalOpen(false)
          setEditingUrlPageId(null)
          urlForm.resetFields()
        }}
        okText="保存"
        cancelText="取消"
      >
        <Form form={urlForm} layout="vertical">
          <Form.Item
            label="显示名称"
            name="name"
            rules={[{ required: true, message: '请输入显示名称' }]}
          >
            <Input placeholder="页面名称" />
          </Form.Item>
          <Form.Item
            label="网址URL"
            name="url"
            rules={[
              { required: true, message: '请输入网址' },
              { type: 'url', message: '请输入有效的URL' },
            ]}
          >
            <Input placeholder="https://example.com" />
          </Form.Item>
        </Form>
      </Modal>

      {/* 添加标题对话框 */}
      <Modal
        title="添加标题"
        open={addTitleModalOpen}
        onOk={handleAddTitle}
        onCancel={() => {
          setAddTitleModalOpen(false)
          titleForm.resetFields()
        }}
        okText="添加"
        cancelText="取消"
        width={480}
      >
        <Form
          form={titleForm}
          layout="vertical"
          initialValues={{
            text: '',
            fontSize: 88,
            color: '#ffffff',
            bgColor: '#1f1f1f'
          }}
        >
          <Form.Item
            label="标题文字"
            name="text"
            rules={[
              { required: true, message: '请输入标题文字' },
              { max: 40, message: '标题文字不能超过40个字符' }
            ]}
          >
            <Input.TextArea placeholder="请输入标题文字（最多40个字符）" maxLength={40} showCount autoSize={{ minRows: 3, maxRows: 6 }} />
          </Form.Item>
          <Row gutter={16}>
            <Col span={8}>
              <Form.Item
                label="字体大小"
                name="fontSize"
                rules={[{ required: true, message: '请输入字体大小' }]}
              >
                <Input type="number" min={12} max={200} />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item
                label="文字颜色"
                name="color"
                rules={[{ required: true, message: '请选择文字颜色' }]}
              >
                <Input type="color" style={{ width: '100%', height: '32px', padding: '2px' }} />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item
                label="背景颜色"
                name="bgColor"
                rules={[{ required: true, message: '请选择背景颜色' }]}
              >
                <Input type="color" style={{ width: '100%', height: '32px', padding: '2px' }} />
              </Form.Item>
            </Col>
          </Row>
        </Form>
      </Modal>

      {/* 编辑标题对话框 */}
      <Modal
        title="编辑标题"
        open={editTitleModalOpen}
        onOk={handleUpdateTitle}
        onCancel={() => {
          setEditTitleModalOpen(false)
          setEditingTitlePageId(null)
          titleForm.resetFields()
        }}
        okText="保存"
        cancelText="取消"
        width={480}
      >
        <Form form={titleForm} layout="vertical">
          <Form.Item
            label="标题文字"
            name="text"
            rules={[
              { required: true, message: '请输入标题文字' },
              { max: 40, message: '标题文字不能超过40个字符' }
            ]}
          >
            <Input.TextArea placeholder="请输入标题文字（最多40个字符）" maxLength={40} showCount autoSize={{ minRows: 3, maxRows: 6 }} />
          </Form.Item>
          <Row gutter={16}>
            <Col span={8}>
              <Form.Item
                label="字体大小"
                name="fontSize"
                rules={[{ required: true, message: '请输入字体大小' }]}
              >
                <Input type="number" min={12} max={200} />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item
                label="文字颜色"
                name="color"
                rules={[{ required: true, message: '请选择文字颜色' }]}
              >
                <Input type="color" style={{ width: '100%', height: '32px', padding: '2px' }} />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item
                label="背景颜色"
                name="bgColor"
                rules={[{ required: true, message: '请选择背景颜色' }]}
              >
                <Input type="color" style={{ width: '100%', height: '32px', padding: '2px' }} />
              </Form.Item>
            </Col>
          </Row>
        </Form>
      </Modal>

    </div>
  )
}

// 可排序页面项组件
interface SortablePageItemProps {
  page: Page
  index: number
  isSelected: boolean
  onSelect: () => void
  isEditing: boolean
  editingName: string
  onEditingNameChange: (name: string) => void
  onStartEdit: () => void
  onSaveEdit: () => void
  onCancelEdit: () => void
  onDelete: () => void
  onEdit: () => void
}

const SortablePageItem = ({
  page,
  index,
  isSelected,
  onSelect,
  isEditing,
  editingName,
  onEditingNameChange,
  onSaveEdit,
  onCancelEdit,
  onDelete,
  onEdit,
}: SortablePageItemProps) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: page.id,
  })

  const itemStyle: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    padding: '12px',
    border: `1px solid ${isSelected ? '#1890ff' : '#d9d9d9'}`,
    borderRadius: '4px',
    marginBottom: '8px',
    background: isSelected ? '#e6f7ff' : '#fff',
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    cursor: isEditing ? 'default' : 'pointer',
  }

  return (
    <div
      ref={setNodeRef}
      style={itemStyle}
      className="sortable-item"
      onClick={!isEditing ? onSelect : undefined}
    >
      <div {...attributes} {...listeners} style={{ cursor: 'grab', color: '#8c8c8c', flexShrink: 0 }}>
        ☰
      </div>
      <div style={{ width: '30px', color: '#8c8c8c', flexShrink: 0 }}>{index + 1}.</div>

      {isEditing ? (
        // 编辑模式
        <div style={{ flex: 1, display: 'flex', gap: '8px' }}>
          <Input
            value={editingName}
            onChange={(e) => onEditingNameChange(e.target.value)}
            onPressEnter={onSaveEdit}
            onClick={(e) => e.stopPropagation()}
            style={{ flex: 1 }}
          />
          <Button size="small" type="primary" onClick={onSaveEdit}>
            保存
          </Button>
          <Button size="small" onClick={onCancelEdit}>
            取消
          </Button>
        </div>
      ) : (
        // 查看模式
        <>
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '8px' }}>
            {page.type === PageType.LOCAL && <FolderOutlined style={{ color: '#8c8c8c' }} />}
            {page.type === PageType.EXTERNAL && <LinkOutlined style={{ color: '#8c8c8c' }} />}
            {page.type === PageType.IMAGE && <PictureOutlined style={{ color: '#8c8c8c' }} />}
            {page.type === PageType.PDF && <FilePdfOutlined style={{ color: '#8c8c8c' }} />}
            {page.type === PageType.VIDEO && <VideoCameraOutlined style={{ color: '#8c8c8c' }} />}
            {page.type === PageType.TITLE && <FontSizeOutlined style={{ color: '#8c8c8c' }} />}
            {page.name}
          </div>
          <span style={{ color: '#8c8c8c', fontSize: '12px', marginRight: '8px' }}>
            {page.type === PageType.LOCAL && 'HTML'}
            {page.type === PageType.EXTERNAL && '网址'}
            {page.type === PageType.IMAGE && '图片'}
            {page.type === PageType.PDF && 'PDF'}
            {page.type === PageType.VIDEO && '视频'}
            {page.type === PageType.TITLE && '标题'}
          </span>
          <Space size="small">
            <Button onClick={(e) => { e.stopPropagation(); onEdit() }} style={{ padding: '4px 12px', height: '32px' }}>
              编辑
            </Button>
            <Button danger onClick={(e) => { e.stopPropagation(); onDelete() }} style={{ padding: '4px 12px', height: '32px' }}>
              删除
            </Button>
          </Space>
        </>
      )}
    </div>
  )
}

export default CourseEdit
