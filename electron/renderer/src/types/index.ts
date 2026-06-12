// 页面类型：本地网页、第三方网址、图片、PDF、视频、标题
export enum PageType {
  LOCAL = 'local',      // 本地网页
  EXTERNAL = 'external', // 第三方网址
  IMAGE = 'image',      // 图片
  PDF = 'pdf',          // PDF文件
  VIDEO = 'video',      // 视频文件
  TITLE = 'title',      // 标题页面
}

// 图片显示模式
export enum ImageDisplayMode {
  FIT = 'fit',      // 适应屏幕
  ORIGINAL = 'original' // 原始大小
}

// 外部链接打开方式
export enum ExternalUrlMode {
  IFRAME = 'iframe',        // 内嵌显示
  NEW_WINDOW = 'new_window'  // 新窗口打开
}

// 单个页面（本地网页、第三方网址、图片、PDF、视频、标题）
export interface Page {
  id: string
  courseId: string
  type: PageType
  name: string
  order: number
  // 本地网页字段
  files?: string[]      // 主要文件列表
  // 第三方网址字段
  url?: string          // 网址URL
  // 图片字段
  displayMode?: ImageDisplayMode  // 图片显示模式
  // 标题字段
  titleText?: string        // 标题文字内容
  titleFontSize?: number    // 标题字体大小（默认88）
  titleColor?: string       // 标题颜色（默认白色 #ffffff）
  titleBgColor?: string     // 标题背景颜色
  createdAt: string
  updatedAt: string
}

// 课程
export interface Course {
  id: string
  name: string
  description?: string
  pageIds: string[]    // 页面ID列表（按顺序）
  createdAt: string
  updatedAt: string
}

// 课程详情（包含页面列表）
export interface CourseDetail extends Course {
  pages: Page[]
}

// API响应
export interface ApiResponse<T> {
  success: boolean
  data?: T
  message?: string
}

// 上传ZIP响应
export interface UploadResponse {
  pages: Page[]
}

// 播放历史记录（IndexedDB）
export interface PlayHistory {
  courseId: string
  pageIndex: number
  lastPlayedAt: string
}

// Electron IPC API 声明
declare global {
  interface Window {
    electronAPI: {
      invoke: (channel: string, ...args: any[]) => Promise<any>
    }
  }
}
