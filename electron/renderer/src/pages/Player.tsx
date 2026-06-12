import { useEffect, useState, useRef, useCallback } from 'react'
import { useParams, useNavigate, useLocation } from 'react-router-dom'
import { Button, Drawer, List } from 'antd'
import {
  ArrowLeftOutlined,
  LeftOutlined,
  RightOutlined,
  MenuOutlined,
  LinkOutlined,
  PictureOutlined,
  FilePdfOutlined,
  PlayCircleOutlined,
  FontSizeOutlined,
  EditOutlined,
} from '@ant-design/icons'
import { useCourseStore } from '@/store/courseStore'
import { useHistoryStore } from '@/store/historyStore'
import * as api from '@/services/api'
import { PageType } from '@/types'

// 预留底部空间给工具栏（20px 工具栏 + 5px 上下间隙）
const TOOLBAR_HEIGHT = 25

const Player = () => {
  const { courseId } = useParams<{ courseId: string }>()
  const navigate = useNavigate()
  const location = useLocation()
  const { currentCourse, fetchCourseDetail } = useCourseStore()
  const { getHistory, setHistory } = useHistoryStore()
  const [currentIndex, setCurrentIndex] = useState(0)
  const [controlsVisible, setControlsVisible] = useState(true)
  const [navDrawerOpen, setNavDrawerOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // 加载课程和历史位置
  useEffect(() => {
    console.log('Player: courseId changed:', courseId, 'currentCourse:', currentCourse?.id)
    if (courseId) {
      console.log('Player: calling fetchCourseDetail')
      fetchCourseDetail(courseId)
    }
  }, [courseId, fetchCourseDetail])

  // 恢复历史位置或使用编辑页指定的页面
  useEffect(() => {
    if (!courseId || !currentCourse || currentCourse.pages.length === 0) return
    // 确保当前课程与 URL 中的 courseId 匹配
    if (currentCourse.id !== courseId) return

    const targetPageId = (location.state as any)?.pageId

    if (targetPageId) {
      const targetIndex = currentCourse.pages.findIndex(p => p.id === targetPageId)
      if (targetIndex >= 0) {
        setCurrentIndex(targetIndex)
      }
    } else {
      getHistory(courseId).then((history) => {
        if (history && history.pageIndex >= 0 && history.pageIndex < currentCourse.pages.length) {
          setCurrentIndex(history.pageIndex)
        }
      })
    }
  }, [courseId, currentCourse, location.state, getHistory])

  // 保存播放位置
  useEffect(() => {
    if (courseId && currentCourse && currentCourse.pages.length > 0) {
      setHistory(courseId, currentIndex)
    }
  }, [courseId, currentIndex, currentCourse, setHistory])

  // 页面切换时更新 BrowserView
  // 使用 ref 跟踪当前有效的 loadPage 调用，防止并发调用导致竞态条件
  const loadSeqRef = useRef(0)

  useEffect(() => {
    console.log('Player: load page effect triggered, currentCourse:', currentCourse?.id, 'courseId:', courseId, 'pages:', currentCourse?.pages?.length)
    if (!currentCourse || currentCourse.pages.length === 0) {
      console.log('Player: no currentCourse or empty pages')
      return
    }
    // 确保当前课程与 URL 中的 courseId 匹配，避免显示错误的课程
    if (currentCourse.id !== courseId) {
      console.log('Player: courseId mismatch, currentCourse.id:', currentCourse.id, 'courseId:', courseId)
      return
    }

    const page = currentCourse.pages[currentIndex]
    if (!page) {
      console.log('Player: no page at index', currentIndex)
      return
    }

    console.log('Player: loading page', page.id, page.type)
    const seq = ++loadSeqRef.current
    let cancelled = false

    /**
     * 生成标题页面的HTML内容
     * @param page - 标题页面数据
     * @returns {string} 生成的HTML字符串
     */
    const generateTitleHtml = (page: any): string => {
      const text = page.titleText || page.name || ''
      const fontSize = page.titleFontSize || 88
      const color = page.titleColor || '#ffffff'
      const bgColor = page.titleBgColor || '#1f1f1f'
      // 将换行符转换为<br>标签，支持多行显示
      const formattedText = text.replace(/\n/g, '<br>')

      return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${text}</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    body {
      width: 100vw;
      height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      background-color: ${bgColor};
      overflow: hidden;
    }
    .title {
      font-size: ${fontSize}px;
      color: ${color};
      font-weight: bold;
      text-align: center;
      padding: 20px;
      word-wrap: break-word;
      max-width: 90%;
      line-height: 1.4;
    }
  </style>
</head>
<body>
  <div class="title">${formattedText}</div>
</body>
</html>`
    }

    /**
     * 加载页面到 BrowserView
     * 根据页面类型选择不同的加载方式，并在创建后立即调整大小
     */
    const loadPage = async () => {
      await api.destroyBrowserView()

      // 如果已经被新的 loadPage 取消，不再创建新的 BrowserView
      if (cancelled || loadSeqRef.current !== seq) return

      if (page.type === PageType.EXTERNAL) {
        await api.createBrowserView({ url: page.url!, type: 'url' })
      } else if (page.type === PageType.TITLE) {
        // 标题页面：生成HTML内容并通过data URL加载
        const htmlContent = generateTitleHtml(page)
        const dataUrl = 'data:text/html;charset=utf-8,' + encodeURIComponent(htmlContent)
        await api.createBrowserView({ url: dataUrl, type: 'url' })
      } else {
        try {
          const filePath = await api.getPageFilePath(courseId!, page.id)
          if (cancelled || loadSeqRef.current !== seq) return
          await api.createBrowserView({ filePath, type: 'file' })
        } catch (error) {
          console.error('Failed to load page:', error)
        }
      }

      // 创建 BrowserView 后立即调整大小，确保正确显示
      // 使用 requestAnimationFrame 和 setTimeout 确保容器已完全渲染
      if (!cancelled && loadSeqRef.current === seq) {
        requestAnimationFrame(() => {
          setTimeout(() => {
            if (cancelled || loadSeqRef.current !== seq) return
            if (containerRef.current) {
              const rect = containerRef.current.getBoundingClientRect()
              console.log('Player loadPage resize:', rect.width, rect.height)
              api.resizeBrowserView({
                x: rect.left,
                y: rect.top,
                width: rect.width,
                height: Math.max(rect.height - TOOLBAR_HEIGHT, 0),
              })
            }
          }, 200)
        })
      }
    }

    loadPage()

    return () => {
      cancelled = true
      api.destroyBrowserView()
    }
  }, [currentIndex, currentCourse])

  // 调整 BrowserView 大小的工具函数
  const adjustBrowserView = useCallback(() => {
    if (containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect()
      api.resizeBrowserView({
        x: rect.left,
        y: rect.top,
        width: rect.width,
        height: Math.max(rect.height - TOOLBAR_HEIGHT, 0),
      })
    }
  }, [])

  // 当容器准备好后，调整 BrowserView 大小
  useEffect(() => {
    if (!currentCourse || currentCourse.pages.length === 0) return
    // 确保当前课程与 URL 中的 courseId 匹配
    if (currentCourse.id !== courseId) return

    const page = currentCourse.pages[currentIndex]
    if (!page) return

    // 使用 requestAnimationFrame 和 setTimeout 确保容器已完全渲染
    let rafId: number
    const timer = setTimeout(() => {
      adjustBrowserView()
    }, 200)
    rafId = requestAnimationFrame(() => {
      // 在下一帧再次调整，确保布局稳定
      setTimeout(adjustBrowserView, 50)
    })

    return () => {
      clearTimeout(timer)
      cancelAnimationFrame(rafId)
    }
  }, [currentIndex, currentCourse, adjustBrowserView, courseId])

  // 监听窗口 resize 事件，同步调整 BrowserView 大小
  useEffect(() => {
    if (!currentCourse || currentCourse.pages.length === 0) return
    // 确保当前课程与 URL 中的 courseId 匹配
    if (currentCourse.id !== courseId) return

    let resizeTimer: ReturnType<typeof setTimeout> | null = null
    const handleResize = () => {
      if (resizeTimer) clearTimeout(resizeTimer)
      resizeTimer = setTimeout(adjustBrowserView, 50)
    }

    window.addEventListener('resize', handleResize)
    return () => {
      window.removeEventListener('resize', handleResize)
      if (resizeTimer) clearTimeout(resizeTimer)
    }
  }, [currentCourse, adjustBrowserView, courseId])

  // 导航抽屉打开/关闭时隐藏/显示 BrowserView
  useEffect(() => {
    if (navDrawerOpen) {
      api.hideBrowserView()
    } else {
      api.showBrowserView()
    }
  }, [navDrawerOpen, currentIndex, currentCourse])

  // 全屏切换函数
  const toggleFullscreen = useCallback(() => {
    if (!document.fullscreenElement) {
      if (containerRef.current?.requestFullscreen) {
        containerRef.current.requestFullscreen()
      }
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen()
      }
    }
  }, [])

  // 监听全屏状态变化，调整 BrowserView
  useEffect(() => {
    const handleFullscreenChange = () => {
      setTimeout(adjustBrowserView, 100)
    }
    document.addEventListener('fullscreenchange', handleFullscreenChange)
    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange)
    }
  }, [])

  // 键盘事件
  const handleKeyPress = useCallback(
    (event: KeyboardEvent) => {
      switch (event.key) {
        case 'ArrowLeft':
          handlePrevious()
          event.preventDefault()
          break
        case 'ArrowRight':
        case ' ':
          handleNext()
          event.preventDefault()
          break
        case 'Escape':
          if (document.fullscreenElement) {
            toggleFullscreen()
            event.preventDefault()
          }
          break
        case 'F11':
          event.preventDefault()
          toggleFullscreen()
          break
      }
    },
    [currentIndex, currentCourse, toggleFullscreen]
  )

  useEffect(() => {
    window.addEventListener('keydown', handleKeyPress)
    return () => {
      window.removeEventListener('keydown', handleKeyPress)
    }
  }, [handleKeyPress])

  const handleNext = () => {
    if (currentCourse && currentIndex < currentCourse.pages.length - 1) {
      setCurrentIndex(currentIndex + 1)
    }
  }

  const handlePrevious = () => {
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1)
    }
  }

  const handleExit = () => {
    api.destroyBrowserView()
    navigate('/')
  }

  /**
   * 跳转到当前集合的编辑页
   */
  const handleEdit = () => {
    api.destroyBrowserView()
    navigate(`/courses/${courseId}/edit`)
  }

  // 鼠标移动时显示控制栏，并自动隐藏
  const handleMouseMove = useCallback((event: MouseEvent) => {
    const container = containerRef.current
    if (!container) return

    const rect = container.getBoundingClientRect()
    const y = event.clientY - rect.top
    const isInBottomZone = y > rect.height - 40

    if (isInBottomZone) {
      setControlsVisible(true)
      if (hideTimerRef.current) {
        clearTimeout(hideTimerRef.current)
      }
      hideTimerRef.current = setTimeout(() => {
        setControlsVisible(false)
      }, 2000)
    } else {
      if (hideTimerRef.current) {
        clearTimeout(hideTimerRef.current)
      }
      setControlsVisible(false)
    }
  }, [])

  useEffect(() => {
    const container = containerRef.current
    if (container) {
      container.addEventListener('mousemove', handleMouseMove)
      window.addEventListener('mousemove', handleMouseMove)
      return () => {
        container.removeEventListener('mousemove', handleMouseMove)
        window.removeEventListener('mousemove', handleMouseMove)
      }
    }
  }, [handleMouseMove])

  if (!currentCourse || currentCourse.pages.length === 0) {
    return <div>加载中...</div>
  }

  return (
    <div
      ref={containerRef}
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100vw',
        height: '100vh',
        background: '#000',
        zIndex: 9999,
      }}
    >
      {/* 内容区域 - 所有页面类型统一使用 BrowserView 渲染 */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          background: '#000',
        }}
      />

      {/* 极简浮窗控制栏 - 高度20px */}
      <div
        style={{
          position: 'absolute',
          bottom: '2px',
          left: '50%',
          transform: 'translateX(-50%)',
          height: '20px',
          background: 'rgba(0, 0, 0, 0.15)',
          backdropFilter: 'blur(8px)',
          borderRadius: '4px',
          padding: '0 8px',
          opacity: controlsVisible ? 1 : 0,
          transition: 'opacity 0.3s ease',
          zIndex: 10001,
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
        }}
      >
        <Button
          size="small"
          icon={<MenuOutlined style={{ fontSize: '10px' }} />}
          onClick={() => setNavDrawerOpen(true)}
          style={{ 
            height: '16px', 
            padding: '0 4px', 
            fontSize: '10px',
            background: 'rgba(255, 255, 255, 0.08)', 
            borderColor: 'rgba(255, 255, 255, 0.15)', 
            color: '#fff' 
          }}
          title="页面导航"
        />
        <Button
          size="small"
          icon={<ArrowLeftOutlined style={{ fontSize: '10px' }} />}
          onClick={handleExit}
          style={{ 
            height: '16px', 
            padding: '0 4px', 
            fontSize: '10px',
            background: 'rgba(255, 255, 255, 0.08)', 
            borderColor: 'rgba(255, 255, 255, 0.15)', 
            color: '#fff' 
          }}
          title="返回"
        />
        <Button
          size="small"
          icon={<LeftOutlined style={{ fontSize: '10px' }} />}
          onClick={handlePrevious}
          disabled={currentIndex === 0}
          style={{ 
            height: '16px', 
            padding: '0 4px', 
            fontSize: '10px',
            background: 'rgba(255, 255, 255, 0.08)', 
            borderColor: 'rgba(255, 255, 255, 0.15)', 
            color: '#fff' 
          }}
          title="上一页"
        />
        <span style={{ fontSize: '11px', color: '#fff', minWidth: '40px', textAlign: 'center', userSelect: 'none' }}>
          {currentIndex + 1}/{currentCourse.pages.length}
        </span>
        <Button
          size="small"
          icon={<RightOutlined style={{ fontSize: '10px' }} />}
          onClick={handleNext}
          disabled={currentIndex === currentCourse.pages.length - 1}
          style={{ 
            height: '16px', 
            padding: '0 4px', 
            fontSize: '10px',
            background: 'rgba(255, 255, 255, 0.08)', 
            borderColor: 'rgba(255, 255, 255, 0.15)', 
            color: '#fff' 
          }}
          title="下一页"
        />
        <Button
          size="small"
          icon={<EditOutlined style={{ fontSize: '10px' }} />}
          onClick={handleEdit}
          style={{ 
            height: '16px', 
            padding: '0 4px', 
            fontSize: '10px',
            background: 'rgba(255, 255, 255, 0.08)', 
            borderColor: 'rgba(255, 255, 255, 0.15)', 
            color: '#fff' 
          }}
          title="编辑"
        />
      </div>

      {/* 左侧导航抽屉 */}
      <Drawer
        title={
          <span style={{ color: '#fff', fontWeight: 500 }}>页面导航</span>
        }
        placement="left"
        open={navDrawerOpen}
        onClose={() => setNavDrawerOpen(false)}
        width={320}
        zIndex={10002}
        styles={{
          body: { padding: 0, background: 'rgba(30, 30, 30, 0.95)' },
          header: {
            background: 'rgba(30, 30, 30, 0.95)',
            borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
          },
          mask: { backgroundColor: 'rgba(0, 0, 0, 0.5)' },
        }}
        push={false}
      >
        <List
          dataSource={currentCourse.pages}
          renderItem={(page, index) => (
            <List.Item
              key={page.id}
              onClick={() => {
                setCurrentIndex(index)
                setNavDrawerOpen(false)
              }}
              style={{
                padding: '12px 16px',
                cursor: 'pointer',
                background: index === currentIndex ? 'rgba(24, 144, 255, 0.2)' : 'transparent',
                borderBottom: '1px solid rgba(255, 255, 255, 0.05)',
                transition: 'background 0.2s ease',
              }}
              className="nav-list-item"
              onMouseEnter={(e) => {
                if (index !== currentIndex) {
                  e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)'
                }
              }}
              onMouseLeave={(e) => {
                if (index !== currentIndex) {
                  e.currentTarget.style.background = 'transparent'
                }
              }}
            >
              <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ color: 'rgba(255, 255, 255, 0.5)', fontSize: '13px', minWidth: '24px' }}>
                  {index + 1}.
                </span>
                {(page.type === PageType.LOCAL || page.type === PageType.EXTERNAL) && <LinkOutlined style={{ color: 'rgba(255, 255, 255, 0.5)', fontSize: '14px' }} />}
                {page.type === PageType.IMAGE && <PictureOutlined style={{ color: 'rgba(255, 255, 255, 0.5)', fontSize: '14px' }} />}
                {page.type === PageType.PDF && <FilePdfOutlined style={{ color: 'rgba(255, 255, 255, 0.5)', fontSize: '14px' }} />}
                {page.type === PageType.VIDEO && <PlayCircleOutlined style={{ color: 'rgba(255, 255, 255, 0.5)', fontSize: '14px' }} />}
                {page.type === PageType.TITLE && <FontSizeOutlined style={{ color: 'rgba(255, 255, 255, 0.5)', fontSize: '14px' }} />}
                <span style={{ color: '#fff', fontSize: '14px', flex: 1 }}>
                  {page.name}
                </span>
              </div>
            </List.Item>
          )}
        />
      </Drawer>
    </div>
  )
}

export default Player
