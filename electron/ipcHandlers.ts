/**
 * IPC 事件处理器注册模块
 * 为所有存储操作注册 ipcMain.handle 处理器
 * 所有 handler 使用 try-catch 包裹，错误时返回 { success: false, error: string }
 */

import { ipcMain, dialog, app } from 'electron';
import {
  getAllCourses,
  getCourse,
  getCourseDetail,
  createCourse,
  updateCourse,
  deleteCourse,
  getPagesByCourse,
  getPage,
  addExternalPage,
  updatePage,
  updatePageOrder,
  deletePage,
  saveHtmlFile,
  saveImageFile,
  savePdfFile,
  saveVideoFile,
  saveTitlePage,
  extractZipFile,
  exportCourse,
  importCourse,
  getPageContent,
  getPageFilePath,
} from './storage';
import { PageType } from './models';
import { IpcResponse } from './models';

/**
 * 创建成功的 IPC 响应对象
 * @param data - 响应数据
 * @returns {IpcResponse} 包含 success: true 的响应对象
 */
function successResponse<T>(data: T): IpcResponse<T> {
  return { success: true, data };
}

/**
 * 创建失败的 IPC 响应对象
 * @param error - 错误信息
 * @returns {IpcResponse} 包含 success: false 的响应对象
 */
function errorResponse(error: string): IpcResponse {
  return { success: false, error };
}

/**
 * 注册所有 IPC 事件处理器
 * 应在 app.whenReady() 之后调用
 */
export function registerIpcHandlers(): void {
  // ========== 课程相关 ==========

  /**
   * 获取所有课程列表
   * 通道: courses:getAll
   */
  ipcMain.handle('courses:getAll', async (): Promise<IpcResponse> => {
    try {
      const courses = getAllCourses();
      return successResponse(courses.map((c) => c.toJSON()));
    } catch (e: any) {
      return errorResponse(e.message || '获取课程列表失败');
    }
  });

  /**
   * 获取单个课程
   * 通道: courses:get
   * 参数: courseId
   */
  ipcMain.handle(
    'courses:get',
    async (_event, courseId: string): Promise<IpcResponse> => {
      try {
        const course = getCourse(courseId);
        if (!course) {
          return errorResponse('课程不存在');
        }
        return successResponse(course.toJSON());
      } catch (e: any) {
        return errorResponse(e.message || '获取课程失败');
      }
    }
  );

  /**
   * 获取课程详情（含页面列表）
   * 通道: courses:getDetail
   * 参数: courseId
   */
  ipcMain.handle(
    'courses:getDetail',
    async (_event, courseId: string): Promise<IpcResponse> => {
      try {
        const detail = getCourseDetail(courseId);
        if (!detail) {
          return errorResponse('课程不存在');
        }
        return successResponse({
          ...detail,
          pages: detail.pages.map((p) => p.toJSON()),
        });
      } catch (e: any) {
        return errorResponse(e.message || '获取课程详情失败');
      }
    }
  );

  /**
   * 创建新课程
   * 通道: courses:create
   * 参数: { name: string, description?: string }
   */
  ipcMain.handle(
    'courses:create',
    async (_event, args: { name: string; description?: string }): Promise<IpcResponse> => {
      try {
        const course = createCourse(args.name, args.description);
        return successResponse(course.toJSON());
      } catch (e: any) {
        return errorResponse(e.message || '创建课程失败');
      }
    }
  );

  /**
   * 更新课程信息
   * 通道: courses:update
   * 参数: courseId, { name?, description?, page_ids? }
   */
  ipcMain.handle(
    'courses:update',
    async (
      _event,
      courseId: string,
      updates: { name?: string; description?: string; page_ids?: string[] }
    ): Promise<IpcResponse> => {
      try {
        const course = updateCourse(courseId, updates);
        if (!course) {
          return errorResponse('课程不存在');
        }
        return successResponse(course.toJSON());
      } catch (e: any) {
        return errorResponse(e.message || '更新课程失败');
      }
    }
  );

  /**
   * 删除课程
   * 通道: courses:delete
   * 参数: courseId
   */
  ipcMain.handle(
    'courses:delete',
    async (_event, courseId: string): Promise<IpcResponse> => {
      try {
        const result = deleteCourse(courseId);
        if (!result) {
          return errorResponse('课程不存在');
        }
        return successResponse(true);
      } catch (e: any) {
        return errorResponse(e.message || '删除课程失败');
      }
    }
  );

  // ========== 页面上传相关 ==========

  /**
   * 上传 ZIP 文件并解压为本地页面
   * 通道: pages:uploadZip
   * 参数: courseId, { filename: string, content: ArrayBuffer }
   */
  ipcMain.handle(
    'pages:uploadZip',
    async (_event, courseId: string, args: { filename: string; content: ArrayBuffer }): Promise<IpcResponse> => {
      try {
        // 将文件内容保存到临时文件
        const tempDir = require('os').tmpdir();
        const tempZipPath = require('path').join(tempDir, `upload_${Date.now()}_${args.filename}`);
        require('fs').writeFileSync(tempZipPath, Buffer.from(args.content));

        const pages = extractZipFile(courseId, tempZipPath);

        // 清理临时文件
        try {
          require('fs').unlinkSync(tempZipPath);
        } catch {
          // 忽略清理错误
        }

        if (pages.length === 0) {
          return errorResponse('ZIP文件中没有找到有效的网页文件（需要包含index.html或knowledge.html）');
        }

        return successResponse(pages.map((p) => p.toJSON()));
      } catch (e: any) {
        return errorResponse(e.message || '上传ZIP失败');
      }
    }
  );

  /**
   * 上传 HTML 文件作为本地页面
   * 通道: pages:uploadHtml
   * 参数: courseId, { filename: string, content: ArrayBuffer }
   */
  ipcMain.handle(
    'pages:uploadHtml',
    async (
      _event,
      courseId: string,
      args: { filename: string; content: ArrayBuffer }
    ): Promise<IpcResponse> => {
      try {
        const buffer = Buffer.from(args.content);
        const page = saveHtmlFile(courseId, buffer, args.filename);
        return successResponse(page.toJSON());
      } catch (e: any) {
        return errorResponse(e.message || '上传HTML失败');
      }
    }
  );

  /**
   * 上传图片文件作为页面
   * 通道: pages:uploadImage
   * 参数: courseId, { filename: string, content: ArrayBuffer, displayMode?: string }
   */
  ipcMain.handle(
    'pages:uploadImage',
    async (
      _event,
      courseId: string,
      args: { filename: string; content: ArrayBuffer; displayMode?: string }
    ): Promise<IpcResponse> => {
      try {
        const buffer = Buffer.from(args.content);
        const page = saveImageFile(courseId, buffer, args.filename, args.displayMode);
        return successResponse(page.toJSON());
      } catch (e: any) {
        return errorResponse(e.message || '上传图片失败');
      }
    }
  );

  /**
   * 上传 PDF 文件作为页面
   * 通道: pages:uploadPdf
   * 参数: courseId, { filename: string, content: ArrayBuffer }
   */
  ipcMain.handle(
    'pages:uploadPdf',
    async (
      _event,
      courseId: string,
      args: { filename: string; content: ArrayBuffer }
    ): Promise<IpcResponse> => {
      try {
        const buffer = Buffer.from(args.content);
        const page = savePdfFile(courseId, buffer, args.filename);
        return successResponse(page.toJSON());
      } catch (e: any) {
        return errorResponse(e.message || '上传PDF失败');
      }
    }
  );

  /**
   * 上传视频文件作为页面
   * 通道: pages:uploadVideo
   * 参数: courseId, { filename: string, content: ArrayBuffer }
   */
  ipcMain.handle(
    'pages:uploadVideo',
    async (
      _event,
      courseId: string,
      args: { filename: string; content: ArrayBuffer }
    ): Promise<IpcResponse> => {
      try {
        const buffer = Buffer.from(args.content);
        const page = saveVideoFile(courseId, buffer, args.filename);
        return successResponse(page.toJSON());
      } catch (e: any) {
        return errorResponse(e.message || '上传视频失败');
      }
    }
  );

  /**
   * 添加标题页面
   * 通道: pages:addTitle
   * 参数: courseId, { text: string, fontSize?: number, color?: string, bgColor?: string }
   */
  ipcMain.handle(
    'pages:addTitle',
    async (
      _event,
      courseId: string,
      args: { text: string; fontSize?: number; color?: string; bgColor?: string }
    ): Promise<IpcResponse> => {
      try {
        const page = saveTitlePage(courseId, {
          text: args.text,
          fontSize: args.fontSize,
          color: args.color,
          bgColor: args.bgColor,
        });
        return successResponse(page.toJSON());
      } catch (e: any) {
        return errorResponse(e.message || '添加标题失败');
      }
    }
  );

  /**
   * 添加外部链接页面
   * 通道: pages:addExternalUrl
   * 参数: courseId, { url: string, name?: string, externalUrlMode?: string }
   */
  ipcMain.handle(
    'pages:addExternalUrl',
    async (
      _event,
      courseId: string,
      args: { url: string; name?: string; externalUrlMode?: string }
    ): Promise<IpcResponse> => {
      try {
        const page = addExternalPage(courseId, args.url, args.externalUrlMode, args.name);
        return successResponse(page.toJSON());
      } catch (e: any) {
        return errorResponse(e.message || '添加外部链接失败');
      }
    }
  );

  /**
   * 更新外部链接页面
   * 通道: pages:updateExternalUrl
   * 参数: courseId, pageId, { url?: string, name?: string }
   */
  ipcMain.handle(
    'pages:updateExternalUrl',
    async (
      _event,
      courseId: string,
      pageId: string,
      args: { url?: string; name?: string }
    ): Promise<IpcResponse> => {
      try {
        const page = updatePage(courseId, pageId, args);
        if (!page) {
          return errorResponse('页面不存在');
        }
        return successResponse(page.toJSON());
      } catch (e: any) {
        return errorResponse(e.message || '更新外部链接失败');
      }
    }
  );

  /**
   * 更新页面名称
   * 通道: pages:updateName
   * 参数: courseId, pageId, { name: string }
   */
  ipcMain.handle(
    'pages:updateName',
    async (
      _event,
      courseId: string,
      pageId: string,
      args: { name: string }
    ): Promise<IpcResponse> => {
      try {
        const page = updatePage(courseId, pageId, { name: args.name });
        if (!page) {
          return errorResponse('页面不存在');
        }
        return successResponse(page.toJSON());
      } catch (e: any) {
        return errorResponse(e.message || '更新页面名称失败');
      }
    }
  );

  /**
   * 更新页面信息（通用更新）
   * 通道: pages:update
   * 参数: courseId, pageId, updates: Record<string, any>
   */
  ipcMain.handle(
    'pages:update',
    async (
      _event,
      courseId: string,
      pageId: string,
      args: Record<string, any>
    ): Promise<IpcResponse> => {
      try {
        const page = updatePage(courseId, pageId, args);
        if (!page) {
          return errorResponse('页面不存在');
        }
        return successResponse(page.toJSON());
      } catch (e: any) {
        return errorResponse(e.message || '更新页面失败');
      }
    }
  );

  /**
   * 删除页面
   * 通道: pages:delete
   * 参数: courseId, pageId
   */
  ipcMain.handle(
    'pages:delete',
    async (_event, courseId: string, pageId: string): Promise<IpcResponse> => {
      try {
        const result = deletePage(courseId, pageId);
        if (!result) {
          return errorResponse('页面不存在');
        }
        return successResponse(true);
      } catch (e: any) {
        return errorResponse(e.message || '删除页面失败');
      }
    }
  );

  /**
   * 重新排序页面
   * 通道: pages:reorder
   * 参数: courseId, { pageIds: string[] }
   */
  ipcMain.handle(
    'pages:reorder',
    async (
      _event,
      courseId: string,
      args: { pageIds: string[] }
    ): Promise<IpcResponse> => {
      try {
        updatePageOrder(courseId, args.pageIds);
        return successResponse(true);
      } catch (e: any) {
        return errorResponse(e.message || '页面排序失败');
      }
    }
  );

  // ========== 导入导出 ==========

  /**
   * 导出课程为 ZIP 文件
   * 通道: courses:export
   * 参数: courseId, { exportFilePath: string }
   */
  ipcMain.handle(
    'courses:export',
    async (
      _event,
      courseId: string,
      args: { exportFilePath: string }
    ): Promise<IpcResponse> => {
      try {
        const result = exportCourse(courseId, args.exportFilePath);
        if (!result) {
          return errorResponse('导出失败');
        }
        return successResponse(true);
      } catch (e: any) {
        return errorResponse(e.message || '导出课程失败');
      }
    }
  );

  /**
   * 从 ZIP 文件导入课程
   * 通道: courses:import
   * 参数: { zipFilePath: string }
   */
  ipcMain.handle(
    'courses:import',
    async (_event, args: { zipFilePath: string }): Promise<IpcResponse> => {
      try {
        const course = importCourse(args.zipFilePath);
        if (!course) {
          return errorResponse('导入失败');
        }
        return successResponse(course.toJSON());
      } catch (e: any) {
        return errorResponse(e.message || '导入课程失败');
      }
    }
  );

  // ========== 本地页面内容 ==========

  /**
   * 获取本地页面文件内容
   * 通道: pages:getContent
   * 参数: courseId, pageId
   * 返回: { content: number[] } 或错误响应
   */
  ipcMain.handle(
    'pages:getContent',
    async (_event, courseId: string, pageId: string): Promise<IpcResponse> => {
      try {
        const content = getPageContent(courseId, pageId);
        if (!content) {
          return errorResponse('页面内容不存在');
        }
        return successResponse({ content: Array.from(content) });
      } catch (e: any) {
        return errorResponse(e.message || '获取页面内容失败');
      }
    }
  );

  /**
   * 获取页面文件的真实路径
   * 用于视频等大文件直接通过路径访问
   * 通道: pages:getFilePath
   * 参数: courseId, pageId
   * 返回: { filePath: string } 或错误响应
   */
  ipcMain.handle(
    'pages:getFilePath',
    async (_event, courseId: string, pageId: string): Promise<IpcResponse> => {
      try {
        const filePath = getPageFilePath(courseId, pageId);
        if (!filePath) {
          return errorResponse('页面文件不存在');
        }
        return successResponse({ filePath });
      } catch (e: any) {
        return errorResponse(e.message || '获取页面文件路径失败');
      }
    }
  );

  /**
   * 获取本地页面资源的访问 URL
   * 返回 local-page:// 协议 URL，前端可用于加载图片、PDF、视频等非网页内容
   * 通道: pages:getLocalPageUrl
   * 参数: courseId, pageId
   * 返回: { url: string } 或错误响应
   */
  ipcMain.handle(
    'pages:getLocalPageUrl',
    async (_event, courseId: string, pageId: string): Promise<IpcResponse> => {
      try {
        const page = getPage(courseId, pageId);
        if (!page || !page.files || page.files.length === 0) {
          return errorResponse('页面不存在或没有可访问的文件');
        }

        // 非外部链接页面，使用 local-page 协议访问
        const mainFile = page.files[0];
        const url = `local-page://${courseId}/${pageId}/${mainFile}`;
        return successResponse({ url, type: page.type });
      } catch (e: any) {
        return errorResponse(e.message || '获取页面访问 URL 失败');
      }
    }
  );

  // ========== 对话框 ==========

  /**
   * 显示保存文件对话框
   * 通道: dialog:showSaveDialog
   * 参数: options — Electron SaveDialogOptions
   */
  ipcMain.handle(
    'dialog:showSaveDialog',
    async (_event, options: any): Promise<IpcResponse> => {
      try {
        const result = await dialog.showSaveDialog(options);
        if (result.canceled || !result.filePath) {
          return successResponse(null);
        }
        return successResponse(result.filePath);
      } catch (e: any) {
        return errorResponse(e.message || '显示保存对话框失败');
      }
    }
  );

  /**
   * 显示打开文件对话框
   * 通道: dialog:showOpenDialog
   * 参数: options — Electron OpenDialogOptions
   */
  ipcMain.handle(
    'dialog:showOpenDialog',
    async (_event, options: any): Promise<IpcResponse> => {
      try {
        const result = await dialog.showOpenDialog(options);
        if (result.canceled || result.filePaths.length === 0) {
          return successResponse(null);
        }
        return successResponse(result.filePaths);
      } catch (e: any) {
        return errorResponse(e.message || '显示打开对话框失败');
      }
    }
  );
}
