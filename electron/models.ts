/**
 * 数据模型定义模块
 * 将 Python Pydantic 模型翻译为 TypeScript 类型定义和类
 * 保持与原有 Python 版本的数据格式兼容
 */

/**
 * 页面类型枚举
 */
export enum PageType {
  LOCAL = 'local',
  EXTERNAL = 'external',
  IMAGE = 'image',
  PDF = 'pdf',
  VIDEO = 'video',
  TITLE = 'title',
}

/**
 * 图片显示模式枚举
 */
export enum ImageDisplayMode {
  FIT = 'fit',
  ORIGINAL = 'original',
}

/**
 * 外部链接打开模式枚举
 */
export enum ExternalUrlMode {
  IFRAME = 'iframe',
  NEW_WINDOW = 'new_window',
}

/**
 * 页面接口定义
 */
export interface IPage {
  id: string;
  course_id: string;
  type: PageType;
  name: string;
  order: number;
  files?: string[];
  url?: string;
  display_mode?: ImageDisplayMode;
  external_url_mode?: ExternalUrlMode;
  // 标题字段
  title_text?: string;
  title_font_size?: number;
  title_color?: string;
  title_bg_color?: string;
  created_at: string;
  updated_at: string;
}

/**
 * 页面类
 * 提供页面数据的构造和序列化能力
 */
export class Page implements IPage {
  id: string;
  course_id: string;
  type: PageType;
  name: string;
  order: number;
  files?: string[];
  url?: string;
  display_mode?: ImageDisplayMode;
  external_url_mode?: ExternalUrlMode;
  // 标题字段
  title_text?: string;
  title_font_size?: number;
  title_color?: string;
  title_bg_color?: string;
  created_at: string;
  updated_at: string;

  /**
   * 创建 Page 实例
   * @param data - 页面数据对象
   */
  constructor(data: IPage) {
    this.id = data.id;
    this.course_id = data.course_id;
    this.type = data.type;
    this.name = data.name;
    this.order = data.order;
    this.files = data.files;
    this.url = data.url;
    this.display_mode = data.display_mode;
    this.external_url_mode = data.external_url_mode;
    // 标题字段
    this.title_text = data.title_text;
    this.title_font_size = data.title_font_size;
    this.title_color = data.title_color;
    this.title_bg_color = data.title_bg_color;
    this.created_at = data.created_at;
    this.updated_at = data.updated_at;
  }

  /**
   * 将 Page 实例转换为普通对象
   * @returns {Record<string, any>} 包含页面数据的对象，字段使用下划线命名
   */
  toJSON(): Record<string, any> {
    const result: Record<string, any> = {
      id: this.id,
      course_id: this.course_id,
      type: this.type,
      name: this.name,
      order: this.order,
      created_at: this.created_at,
      updated_at: this.updated_at,
    };
    if (this.files !== undefined) result.files = this.files;
    if (this.url !== undefined) result.url = this.url;
    if (this.display_mode !== undefined) result.display_mode = this.display_mode;
    if (this.external_url_mode !== undefined) result.external_url_mode = this.external_url_mode;
    if (this.title_text !== undefined) result.title_text = this.title_text;
    if (this.title_font_size !== undefined) result.title_font_size = this.title_font_size;
    if (this.title_color !== undefined) result.title_color = this.title_color;
    if (this.title_bg_color !== undefined) result.title_bg_color = this.title_bg_color;
    return result;
  }
}

/**
 * 课程接口定义
 */
export interface ICourse {
  id: string;
  name: string;
  description?: string;
  page_ids: string[];
  created_at: string;
  updated_at: string;
}

/**
 * 课程类
 * 提供课程数据的构造和序列化能力
 */
export class Course implements ICourse {
  id: string;
  name: string;
  description?: string;
  page_ids: string[];
  created_at: string;
  updated_at: string;

  /**
   * 创建 Course 实例
   * @param data - 课程数据对象
   */
  constructor(data: ICourse) {
    this.id = data.id;
    this.name = data.name;
    this.description = data.description;
    this.page_ids = data.page_ids;
    this.created_at = data.created_at;
    this.updated_at = data.updated_at;
  }

  /**
   * 将 Course 实例转换为普通对象
   * @returns {Record<string, any>} 包含课程数据的对象，字段使用下划线命名
   */
  toJSON(): Record<string, any> {
    const result: Record<string, any> = {
      id: this.id,
      name: this.name,
      page_ids: this.page_ids,
      created_at: this.created_at,
      updated_at: this.updated_at,
    };
    if (this.description !== undefined) result.description = this.description;
    return result;
  }
}

/**
 * 课程详情接口
 * 包含课程基本信息及其下属页面列表
 */
export interface CourseDetail extends ICourse {
  pages: Page[];
}

/**
 * 创建课程请求类型
 */
export interface CreateCourseRequest {
  name: string;
  description?: string;
}

/**
 * 更新课程请求类型
 */
export interface UpdateCourseRequest {
  name?: string;
  description?: string;
  page_ids?: string[];
}

/**
 * 添加外部链接请求类型
 */
export interface AddExternalUrlRequest {
  url: string;
}

/**
 * 更新外部链接请求类型
 */
export interface UpdateExternalUrlRequest {
  url?: string;
  name?: string;
}

/**
 * 更新页面名称请求类型
 */
export interface UpdatePageNameRequest {
  name: string;
}

/**
 * IPC 调用通用响应结构
 */
export interface IpcResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
}
