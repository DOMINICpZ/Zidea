import type { Course, CourseDetail, Page, UploadResponse } from '@/types'

/**
 * IPC 调用辅助函数
 * 统一处理 IPC 响应，将 { success, data, error } 解包
 * @param channel - IPC 通道名称
 * @param args - 传递给主进程的参数
 * @returns {Promise<T>} 响应数据
 * @throws {Error} 当 success 为 false 时抛出错误
 */
async function ipcInvoke<T>(channel: string, ...args: any[]): Promise<T> {
  const response = await window.electronAPI.invoke(channel, ...args)
  if (response && typeof response === 'object' && 'success' in response) {
    if (response.success) {
      return response.data as T
    } else {
      throw new Error(response.error || '操作失败')
    }
  }
  return response as T
}

/**
 * 将 File 对象读取为 ArrayBuffer
 * @param file - 浏览器 File 对象
 * @returns {Promise<ArrayBuffer>} 文件内容
 */
function readFileAsArrayBuffer(file: File): Promise<ArrayBuffer> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      if (reader.result instanceof ArrayBuffer) {
        resolve(reader.result)
      } else {
        reject(new Error('文件读取失败'))
      }
    }
    reader.onerror = () => reject(reader.error || new Error('文件读取失败'))
    reader.readAsArrayBuffer(file)
  })
}

// ========== 课程 API ==========

/**
 * 获取所有课程列表
 * @returns {Promise<Course[]>} 课程数组
 */
export const getCourses = async (): Promise<Course[]> => {
  const data = await ipcInvoke<any[]>('courses:getAll')
  return data.map((c) => normalizeCourse(c))
}

/**
 * 获取课程详情
 * @param courseId - 课程 ID
 * @returns {Promise<CourseDetail>} 课程详情对象
 */
export const getCourseDetail = async (courseId: string): Promise<CourseDetail> => {
  const data = await ipcInvoke<any>('courses:getDetail', courseId)
  return normalizeCourseDetail(data)
}

/**
 * 创建课程
 * @param data - 课程信息
 * @returns {Promise<Course>} 创建的课程对象
 */
export const createCourse = async (data: { name: string; description?: string }): Promise<Course> => {
  const result = await ipcInvoke<any>('courses:create', data)
  return normalizeCourse(result)
}

/**
 * 更新课程
 * @param courseId - 课程 ID
 * @param data - 更新的字段
 * @returns {Promise<Course>} 更新后的课程对象
 */
export const updateCourse = async (
  courseId: string,
  data: { name?: string; description?: string; pageIds?: string[] }
): Promise<Course> => {
  // 将前端驼峰命名转换为后端下划线命名
  const backendData: Record<string, any> = {}
  if (data.name !== undefined) backendData.name = data.name
  if (data.description !== undefined) backendData.description = data.description
  if (data.pageIds !== undefined) backendData.page_ids = data.pageIds

  const result = await ipcInvoke<any>('courses:update', courseId, backendData)
  return normalizeCourse(result)
}

/**
 * 删除课程
 * @param courseId - 课程 ID
 * @returns {Promise<void>}
 */
export const deleteCourse = async (courseId: string): Promise<void> => {
  await ipcInvoke<void>('courses:delete', courseId)
}

// ========== 页面 API ==========

/**
 * 上传 ZIP 压缩包
 * @param courseId - 课程 ID
 * @param file - ZIP 文件
 * @returns {Promise<UploadResponse>} 上传结果
 */
export const uploadZip = async (courseId: string, file: File): Promise<UploadResponse> => {
  const content = await readFileAsArrayBuffer(file)
  const pages = await ipcInvoke<any[]>('pages:uploadZip', courseId, {
    filename: file.name,
    content,
  })
  return { pages: pages.map((p) => normalizePage(p)) }
}

/**
 * 上传单个 HTML 文件
 * @param courseId - 课程 ID
 * @param file - HTML 文件
 * @returns {Promise<Page>} 创建的页面对象
 */
export const uploadHtml = async (courseId: string, file: File): Promise<Page> => {
  const content = await readFileAsArrayBuffer(file)
  const page = await ipcInvoke<any>('pages:uploadHtml', courseId, {
    filename: file.name,
    content,
  })
  return normalizePage(page)
}

/**
 * 上传单个图片文件
 * @param courseId - 课程 ID
 * @param file - 图片文件
 * @param displayMode - 显示模式
 * @returns {Promise<Page>} 创建的页面对象
 */
export const uploadImage = async (courseId: string, file: File, displayMode: string = 'fit'): Promise<Page> => {
  const content = await readFileAsArrayBuffer(file)
  const page = await ipcInvoke<any>('pages:uploadImage', courseId, {
    filename: file.name,
    content,
    displayMode,
  })
  return normalizePage(page)
}

/**
 * 上传单个 PDF 文件
 * @param courseId - 课程 ID
 * @param file - PDF 文件
 * @returns {Promise<Page>} 创建的页面对象
 */
export const uploadPdf = async (courseId: string, file: File): Promise<Page> => {
  const content = await readFileAsArrayBuffer(file)
  const page = await ipcInvoke<any>('pages:uploadPdf', courseId, {
    filename: file.name,
    content,
  })
  return normalizePage(page)
}

/**
 * 上传单个视频文件
 * @param courseId - 课程 ID
 * @param file - 视频文件
 * @returns {Promise<Page>} 创建的页面对象
 */
export const uploadVideo = async (courseId: string, file: File): Promise<Page> => {
  const content = await readFileAsArrayBuffer(file)
  const page = await ipcInvoke<any>('pages:uploadVideo', courseId, {
    filename: file.name,
    content,
  })
  return normalizePage(page)
}

/**
 * 添加标题页面
 * @param courseId - 课程 ID
 * @param data - 标题数据
 * @returns {Promise<Page>} 创建的页面对象
 */
export const addTitlePage = async (
  courseId: string,
  data: { text: string; fontSize?: number; color?: string; bgColor?: string }
): Promise<Page> => {
  const page = await ipcInvoke<any>('pages:addTitle', courseId, data)
  return normalizePage(page)
}

/**
 * 添加第三方网址
 * @param courseId - 课程 ID
 * @param data - 网址信息
 * @returns {Promise<Page>} 创建的页面对象
 */
export const addExternalUrl = async (
  courseId: string,
  data: { url: string; name?: string; externalUrlMode?: string }
): Promise<Page> => {
  const page = await ipcInvoke<any>('pages:addExternalUrl', courseId, data)
  return normalizePage(page)
}

/**
 * 更新第三方网址
 * @param courseId - 课程 ID
 * @param pageId - 页面 ID
 * @param data - 更新的字段
 * @returns {Promise<Page>} 更新后的页面对象
 */
export const updateExternalUrl = async (
  courseId: string,
  pageId: string,
  data: { url?: string; name?: string; externalUrlMode?: string }
): Promise<Page> => {
  const page = await ipcInvoke<any>('pages:updateExternalUrl', courseId, pageId, data)
  return normalizePage(page)
}

/**
 * 更新页面名称
 * @param courseId - 课程 ID
 * @param pageId - 页面 ID
 * @param name - 新名称
 * @returns {Promise<Page>} 更新后的页面对象
 */
export const updatePageName = async (
  courseId: string,
  pageId: string,
  name: string
): Promise<Page> => {
  const page = await ipcInvoke<any>('pages:updateName', courseId, pageId, { name })
  return normalizePage(page)
}

/**
 * 更新页面信息（通用更新）
 * @param courseId - 课程 ID
 * @param pageId - 页面 ID
 * @param data - 更新的字段
 * @returns {Promise<Page>} 更新后的页面对象
 */
export const updatePage = async (
  courseId: string,
  pageId: string,
  data: Record<string, any>
): Promise<Page> => {
  const page = await ipcInvoke<any>('pages:update', courseId, pageId, data)
  return normalizePage(page)
}

/**
 * 删除页面
 * @param courseId - 课程 ID
 * @param pageId - 页面 ID
 * @returns {Promise<void>}
 */
export const deletePage = async (courseId: string, pageId: string): Promise<void> => {
  await ipcInvoke<void>('pages:delete', courseId, pageId)
}

/**
 * 重新排序页面
 * @param courseId - 课程 ID
 * @param pageIds - 新的页面顺序
 * @returns {Promise<void>}
 */
export const reorderPages = async (courseId: string, pageIds: string[]): Promise<void> => {
  await ipcInvoke<void>('pages:reorder', courseId, { pageIds })
}

// ========== 导入导出 API ==========

/**
 * 导出课程为 .lgbh 文件（ZIP 格式）
 * @param courseId - 课程 ID
 * @param courseName - 课程名称（用于生成文件名）
 * @returns {Promise<void>}
 */
export const exportCourse = async (courseId: string, courseName?: string): Promise<void> => {
  const defaultName = courseName ? `${courseName}_${Date.now()}.lgbh` : `course_${Date.now()}.lgbh`
  const filePath = await ipcInvoke<string>('dialog:showSaveDialog', {
    defaultPath: defaultName,
    filters: [{ name: '灵光宝盒集合文件', extensions: ['lgbh'] }],
  })
  if (!filePath) {
    return
  }
  await ipcInvoke<void>('courses:export', courseId, { exportFilePath: filePath })
}

/**
 * 导入课程 .lgbh 文件（ZIP 格式）
 * @returns {Promise<Course>} 导入的课程对象
 */
export const importCourse = async (): Promise<Course> => {
  const filePaths = await ipcInvoke<string[]>('dialog:showOpenDialog', {
    filters: [
      { name: '灵光宝盒集合文件', extensions: ['lgbh'] },
      { name: 'ZIP 文件', extensions: ['zip'] },
    ],
    properties: ['openFile'],
  })
  if (!filePaths || filePaths.length === 0) {
    throw new Error('未选择文件')
  }
  const course = await ipcInvoke<any>('courses:import', { zipFilePath: filePaths[0] })
  return normalizeCourse(course)
}

/**
 * 获取页面内容 URL
 * @param courseId - 课程 ID
 * @param pageId - 页面 ID
 * @returns {string} 本地页面协议 URL
 * @deprecated 请使用 pages:getLocalPageUrl IPC 调用获取完整的 local-page URL
 */
export const getPageUrl = (courseId: string, pageId: string): string => {
  return `local-page://${courseId}/${pageId}`
}

/**
 * 获取本地页面文件内容并创建 Blob URL
 * 用于在渲染进程中安全加载本地文件（图片、PDF 等）
 * 注意：视频文件建议使用 getPageFileUrl 直接通过路径访问，避免大文件传输
 * @param courseId - 课程 ID
 * @param pageId - 页面 ID
 * @returns {Promise<string>} Blob URL
 * @throws {Error} 当文件读取失败时抛出异常
 * @deprecated 请使用 local-page:// 协议直接访问文件，不再使用 Blob URL
 */
export const getPageBlobUrl = async (courseId: string, pageId: string): Promise<string> => {
  const response = await window.electronAPI.invoke('pages:getContent', courseId, pageId)
  if (response && typeof response === 'object' && 'success' in response) {
    if (response.success) {
      const content = new Uint8Array(response.data.content)
      const page = await window.electronAPI.invoke('courses:getDetail', courseId)
      let filename = 'file'
      if (page && page.success && page.data.pages) {
        const p = page.data.pages.find((p: any) => p.id === pageId)
        if (p && p.files && p.files.length > 0) {
          filename = p.files[0]
        }
      }
      const mimeType = getMimeTypeFromFilename(filename)
      const blob = new Blob([content], { type: mimeType })
      return URL.createObjectURL(blob)
    } else {
      throw new Error(response.error || '获取文件内容失败')
    }
  }
  throw new Error('获取文件内容失败')
}

/**
 * 获取页面文件的本地路径 URL
 * 用于视频等大文件直接通过 file:// 协议访问，避免 IPC 传输整个文件
 * 注意：由于 Electron 的 webSecurity 限制，file:// 协议可能无法正常使用
 * 建议使用 getLocalPageUrl 获取 local-page:// 协议的 URL
 * @param courseId - 课程 ID
 * @param pageId - 页面 ID
 * @returns {Promise<string>} file:// 协议的 URL
 * @throws {Error} 当文件路径获取失败时抛出异常
 * @deprecated 请使用 getLocalPageUrl 替代
 */
export const getPageFileUrl = async (courseId: string, pageId: string): Promise<string> => {
  const response = await window.electronAPI.invoke('pages:getFilePath', courseId, pageId)
  if (response && typeof response === 'object' && 'success' in response) {
    if (response.success) {
      const filePath = response.data.filePath as string
      // 将 Windows 路径转换为 file:// URL
      const normalizedPath = filePath.replace(/\\/g, '/')
      return `file:///${normalizedPath}`
    } else {
      throw new Error(response.error || '获取文件路径失败')
    }
  }
  throw new Error('获取文件路径失败')
}

/**
 * 获取本地页面资源的访问 URL
 * 返回 local-page:// 协议 URL，可用于加载图片、PDF、视频等非网页内容
 * 这是推荐的方式，避免了 file:// 协议的 CORS 限制
 * @param courseId - 课程 ID
 * @param pageId - 页面 ID
 * @returns {Promise<{url: string, type: PageType}>} local-page:// 协议的 URL 和页面类型
 * @throws {Error} 当 URL 获取失败时抛出异常
 */
export const getLocalPageUrl = async (courseId: string, pageId: string): Promise<{ url: string; type: string }> => {
  const response = await window.electronAPI.invoke('pages:getLocalPageUrl', courseId, pageId)
  if (response && typeof response === 'object' && 'success' in response) {
    if (response.success) {
      return response.data as { url: string; type: string }
    } else {
      throw new Error(response.error || '获取页面访问 URL 失败')
    }
  }
  throw new Error('获取页面访问 URL 失败')
}

/**
 * 根据文件名获取 MIME 类型
 * @param filename - 文件名
 * @returns {string} MIME 类型字符串
 */
function getMimeTypeFromFilename(filename: string): string {
  const ext = filename.split('.').pop()?.toLowerCase() || ''
  const mimeTypes: Record<string, string> = {
    'png': 'image/png',
    'jpg': 'image/jpeg',
    'jpeg': 'image/jpeg',
    'gif': 'image/gif',
    'webp': 'image/webp',
    'bmp': 'image/bmp',
    'svg': 'image/svg+xml',
    'pdf': 'application/pdf',
    'mp4': 'video/mp4',
    'webm': 'video/webm',
    'ogg': 'video/ogg',
    'ogv': 'video/ogg',
    'mov': 'video/quicktime',
    'mkv': 'video/x-matroska',

  }
  return mimeTypes[ext] || 'application/octet-stream'
}

// ========== BrowserView API ==========

/**
 * 创建 BrowserView 并加载指定内容
 * 用于播放器中显示外部网页或本地文件，替代 iframe 以绕过 X-Frame-Options 限制
 * @param options - 加载选项 { url?: string, filePath?: string, type?: 'url' | 'file' }
 */
export const createBrowserView = async (options: { url?: string; filePath?: string; type?: 'url' | 'file' }): Promise<void> => {
  await window.electronAPI.invoke('player:createBrowserView', options)
}

/**
 * 获取页面文件的本地路径
 * @param courseId - 课程 ID
 * @param pageId - 页面 ID
 * @returns {Promise<string>} 文件的本地绝对路径
 */
export const getPageFilePath = async (courseId: string, pageId: string): Promise<string> => {
  const response = await window.electronAPI.invoke('pages:getFilePath', courseId, pageId)
  if (response && typeof response === 'object' && 'success' in response) {
    if (response.success) {
      return response.data.filePath
    } else {
      throw new Error(response.error || '获取文件路径失败')
    }
  }
  throw new Error('获取文件路径失败')
}

/**
 * 销毁 BrowserView
 */
export const destroyBrowserView = async (): Promise<void> => {
  await window.electronAPI.invoke('player:destroyBrowserView')
}

/**
 * 显示 BrowserView
 */
export const showBrowserView = async (): Promise<void> => {
  await window.electronAPI.invoke('player:showBrowserView')
}

/**
 * 隐藏 BrowserView
 */
export const hideBrowserView = async (): Promise<void> => {
  await window.electronAPI.invoke('player:hideBrowserView')
}

/**
 * 调整 BrowserView 尺寸
 * @param bounds - 新的位置和尺寸
 */
export const resizeBrowserView = async (bounds: { x: number; y: number; width: number; height: number }): Promise<void> => {
  await window.electronAPI.invoke('player:resizeBrowserView', bounds)
}

// ========== 数据规范化函数 ==========

/**
 * 将后端返回的课程数据（下划线命名）规范化为前端类型（驼峰命名）
 * @param data - 后端返回的课程数据
 * @returns {Course} 规范化后的课程对象
 */
function normalizeCourse(data: any): Course {
  return {
    id: data.id,
    name: data.name,
    description: data.description,
    pageIds: data.page_ids || [],
    createdAt: data.created_at,
    updatedAt: data.updated_at,
  }
}

/**
 * 将后端返回的课程详情数据规范化为前端类型
 * @param data - 后端返回的课程详情数据
 * @returns {CourseDetail} 规范化后的课程详情对象
 */
function normalizeCourseDetail(data: any): CourseDetail {
  return {
    ...normalizeCourse(data),
    pages: (data.pages || []).map((p: any) => normalizePage(p)),
  }
}

/**
 * 将后端返回的页面数据（下划线命名）规范化为前端类型（驼峰命名）
 * @param data - 后端返回的页面数据
 * @returns {Page} 规范化后的页面对象
 */
function normalizePage(data: any): Page {
  return {
    id: data.id,
    courseId: data.course_id,
    type: data.type,
    name: data.name,
    order: data.order,
    files: data.files,
    url: data.url,
    displayMode: data.display_mode,
    titleText: data.title_text,
    titleFontSize: data.title_font_size,
    titleColor: data.title_color,
    titleBgColor: data.title_bg_color,
    createdAt: data.created_at,
    updatedAt: data.updated_at,
  }
}
