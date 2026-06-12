/**
 * 数据存储操作模块
 * 将 Python 存储逻辑翻译为 TypeScript，使用 Node.js fs/path 操作文件
 * 数据目录通过运行时传入，不硬编码
 */

import * as fs from 'fs';
import * as path from 'path';

import { promisify } from 'util';
import { randomUUID } from 'crypto';
import AdmZip from 'adm-zip';
import {
  PageType,
  ImageDisplayMode,
  ExternalUrlMode,
  Page,
  Course,
  CourseDetail,
} from './models';

/**
 * 存储配置对象
 * 包含数据目录、元数据目录、资源目录、页面目录和课程文件路径
 */
interface StorageConfig {
  dataDir: string;       // data/
  metadataDir: string;   // metadata/
  assetsDir: string;     // assets/
  coursesFile: string;   // metadata/courses.json
  pagesDir: string;      // metadata/pages/
}

let storageConfig: StorageConfig | null = null;

/**
 * 初始化存储配置
 * @param dataPath - 数据存储根目录路径（已包含 data 层级）
 * @throws {Error} 当 dataPath 为空时抛出异常
 */
export function initStorage(dataPath: string): void {
  if (!dataPath) {
    throw new Error('dataPath 不能为空');
  }
  // dataPath 已经是数据根目录，直接在其下创建 metadata 和 assets
  const metadataDir = path.join(dataPath, 'metadata');
  const assetsDir = path.join(dataPath, 'assets');
  const coursesFile = path.join(metadataDir, 'courses.json');
  const pagesDir = path.join(metadataDir, 'pages');

  storageConfig = {
    dataDir: dataPath,
    metadataDir,
    assetsDir,
    coursesFile,
    pagesDir,
  };

  // 创建目录
  if (!fs.existsSync(dataPath)) {
    fs.mkdirSync(dataPath, { recursive: true });
  }
  if (!fs.existsSync(metadataDir)) {
    fs.mkdirSync(metadataDir, { recursive: true });
  }
  if (!fs.existsSync(assetsDir)) {
    fs.mkdirSync(assetsDir, { recursive: true });
  }
  if (!fs.existsSync(pagesDir)) {
    fs.mkdirSync(pagesDir, { recursive: true });
  }
  if (!fs.existsSync(coursesFile)) {
    fs.writeFileSync(coursesFile, JSON.stringify({}, null, 2), 'utf-8');
  }
}

/**
 * 获取存储配置
 * @returns {StorageConfig} 当前存储配置
 * @throws {Error} 当存储未初始化时抛出异常
 */
export function getConfig(): StorageConfig {
  if (!storageConfig) {
    throw new Error('存储尚未初始化，请先调用 initStorage()');
  }
  return storageConfig;
}

/**
 * 读取课程数据
 * @returns {Record<string, any>} 课程数据字典
 */
function readCourses(): Record<string, any> {
  const config = getConfig();
  if (!fs.existsSync(config.coursesFile)) {
    return {};
  }
  try {
    const content = fs.readFileSync(config.coursesFile, 'utf-8');
    return JSON.parse(content);
  } catch (e) {
    return {};
  }
}

/**
 * 写入课程数据
 * @param courses - 课程数据字典
 */
function writeCourses(courses: Record<string, any>): void {
  const config = getConfig();
  fs.writeFileSync(config.coursesFile, JSON.stringify(courses, null, 2), 'utf-8');
}

/**
 * 生成唯一 ID
 * @returns {string} UUID 字符串
 */
function generateId(): string {
  return randomUUID();
}

/**
 * 获取当前 ISO 格式时间字符串
 * @returns {string} ISO 8601 格式时间
 */
function nowIso(): string {
  return new Date().toISOString();
}

// ========== 课程操作 ==========

/**
 * 获取所有课程列表
 * @returns {Course[]} 课程对象数组
 */
export function getAllCourses(): Course[] {
  const coursesData = readCourses();
  return Object.values(coursesData).map((course: any) => new Course(course));
}

/**
 * 根据 ID 获取单个课程
 * @param courseId - 课程 ID
 * @returns {Course | null} 课程对象，不存在时返回 null
 */
export function getCourse(courseId: string): Course | null {
  const coursesData = readCourses();
  if (!(courseId in coursesData)) {
    return null;
  }
  return new Course(coursesData[courseId]);
}

/**
 * 获取课程详情（包含页面列表）
 * @param courseId - 课程 ID
 * @returns {CourseDetail | null} 课程详情对象，不存在时返回 null
 */
export function getCourseDetail(courseId: string): CourseDetail | null {
  const coursesData = readCourses();
  if (!(courseId in coursesData)) {
    return null;
  }

  const courseData = coursesData[courseId];
  const pages = getPagesByCourse(courseId);

  const pageIds: string[] = courseData.page_ids || [];
  let orderedPages = pages;
  if (pageIds.length > 0) {
    const pageMap = new Map(pages.map((p) => [p.id, p]));
    orderedPages = [];
    for (const pid of pageIds) {
      const page = pageMap.get(pid);
      if (page) {
        orderedPages.push(page);
      }
    }
  }

  return {
    ...courseData,
    pages: orderedPages,
  };
}

/**
 * 创建新课程
 * @param name - 课程名称
 * @param description - 课程描述（可选）
 * @returns {Course} 创建的课程对象
 */
export function createCourse(name: string, description?: string): Course {
  const coursesData = readCourses();
  const courseId = generateId();
  const now = nowIso();

  const course = new Course({
    id: courseId,
    name,
    description,
    page_ids: [],
    created_at: now,
    updated_at: now,
  });

  coursesData[courseId] = course.toJSON();
  writeCourses(coursesData);

  const config = getConfig();
  const coursePagesDir = path.join(config.pagesDir, courseId);
  if (!fs.existsSync(coursePagesDir)) {
    fs.mkdirSync(coursePagesDir, { recursive: true });
  }

  return course;
}

/**
 * 更新课程信息
 * @param courseId - 课程 ID
 * @param updates - 更新的字段对象
 * @returns {Course | null} 更新后的课程对象，不存在时返回 null
 */
export function updateCourse(
  courseId: string,
  updates: { name?: string; description?: string; page_ids?: string[] }
): Course | null {
  const coursesData = readCourses();
  if (!(courseId in coursesData)) {
    return null;
  }

  const courseData = coursesData[courseId];
  for (const [key, value] of Object.entries(updates)) {
    if (value !== undefined && value !== null) {
      courseData[key] = value;
    }
  }

  courseData.updated_at = nowIso();
  writeCourses(coursesData);

  return new Course(courseData);
}

/**
 * 删除课程及其关联数据
 * @param courseId - 课程 ID
 * @returns {boolean} 删除成功返回 true，课程不存在返回 false
 */
export function deleteCourse(courseId: string): boolean {
  const coursesData = readCourses();
  if (!(courseId in coursesData)) {
    return false;
  }

  delete coursesData[courseId];
  writeCourses(coursesData);

  const config = getConfig();

  // 删除课程页面元数据目录
  const coursePagesDir = path.join(config.pagesDir, courseId);
  if (fs.existsSync(coursePagesDir)) {
    fs.rmSync(coursePagesDir, { recursive: true, force: true });
  }

  // 删除课程资源目录
  const courseAssetsDir = path.join(config.assetsDir, courseId);
  if (fs.existsSync(courseAssetsDir)) {
    fs.rmSync(courseAssetsDir, { recursive: true, force: true });
  }

  return true;
}

// ========== 页面操作 ==========

/**
 * 获取指定课程下的所有页面
 * @param courseId - 课程 ID
 * @returns {Page[]} 页面对象数组，按 order 排序
 */
export function getPagesByCourse(courseId: string): Page[] {
  const config = getConfig();
  const pagesFile = path.join(config.pagesDir, `${courseId}.json`);
  if (!fs.existsSync(pagesFile)) {
    return [];
  }
  try {
    const content = fs.readFileSync(pagesFile, 'utf-8');
    const pagesData: any[] = JSON.parse(content);
    return pagesData
      .sort((a, b) => a.order - b.order)
      .map((p) => new Page(p));
  } catch (e) {
    return [];
  }
}

/**
 * 写入指定课程的页面数据
 * @param courseId - 课程 ID
 * @param pages - 页面数据数组
 */
export function writePages(courseId: string, pages: any[]): void {
  const config = getConfig();
  const pagesFile = path.join(config.pagesDir, `${courseId}.json`);
  const dir = path.dirname(pagesFile);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(pagesFile, JSON.stringify(pages, null, 2), 'utf-8');
}

/**
 * 获取指定页面
 * @param courseId - 课程 ID
 * @param pageId - 页面 ID
 * @returns {Page | null} 页面对象，不存在时返回 null
 */
export function getPage(courseId: string, pageId: string): Page | null {
  const pages = getPagesByCourse(courseId);
  for (const page of pages) {
    if (page.id === pageId) {
      return page;
    }
  }
  return null;
}

/**
 * 添加本地页面
 * @param courseId - 课程 ID
 * @param folderName - 文件夹名称
 * @param files - 文件列表
 * @param name - 页面名称（可选，默认使用 folderName）
 * @returns {Page} 创建的页面对象
 */
export function addLocalPage(
  courseId: string,
  folderName: string,
  files: string[],
  name?: string
): Page {
  const pages = getPagesByCourse(courseId);
  const pageId = generateId();
  const now = nowIso();

  const pageName = name ?? folderName;

  const page = new Page({
    id: pageId,
    course_id: courseId,
    type: PageType.LOCAL,
    name: pageName,
    order: pages.length,
    files,
    created_at: now,
    updated_at: now,
  });

  pages.push(page);
  writePages(courseId, pages.map((p) => p.toJSON()));

  const coursesData = readCourses();
  if (courseId in coursesData) {
    coursesData[courseId].page_ids.push(pageId);
    coursesData[courseId].updated_at = now;
    writeCourses(coursesData);
  }

  return page;
}

/**
 * 添加外部链接页面
 * @param courseId - 课程 ID
 * @param url - 外部链接地址
 * @param externalUrlMode - 打开模式，默认为 iframe
 * @returns {Page} 创建的页面对象
 */
export function addExternalPage(
  courseId: string,
  url: string,
  externalUrlMode: string = 'iframe',
  name?: string
): Page {
  const pages = getPagesByCourse(courseId);
  const pageId = generateId();
  const now = nowIso();

  let pageName: string;
  if (name && name.trim()) {
    pageName = name.trim();
  } else {
    try {
      const parsed = new URL(url);
      pageName = parsed.hostname || parsed.pathname || url;
    } catch {
      pageName = url;
    }
  }

  const page = new Page({
    id: pageId,
    course_id: courseId,
    type: PageType.EXTERNAL,
    name: pageName,
    order: pages.length,
    url,
    external_url_mode: externalUrlMode as ExternalUrlMode,
    created_at: now,
    updated_at: now,
  });

  pages.push(page);
  writePages(courseId, pages.map((p) => p.toJSON()));

  const coursesData = readCourses();
  if (courseId in coursesData) {
    coursesData[courseId].page_ids.push(pageId);
    coursesData[courseId].updated_at = now;
    writeCourses(coursesData);
  }

  return page;
}

/**
 * 更新页面信息
 * @param courseId - 课程 ID
 * @param pageId - 页面 ID
 * @param updates - 更新的字段对象
 * @returns {Page | null} 更新后的页面对象，不存在时返回 null
 */
export function updatePage(
  courseId: string,
  pageId: string,
  updates: Record<string, any>
): Page | null {
  const pages = getPagesByCourse(courseId);
  for (let i = 0; i < pages.length; i++) {
    if (pages[i].id === pageId) {
      const pageData: any = pages[i].toJSON();
      for (const [key, value] of Object.entries(updates)) {
        if (value !== undefined && value !== null) {
          pageData[key] = value;
        }
      }
      pageData.updated_at = nowIso();
      pages[i] = new Page(pageData as any);
      writePages(
        courseId,
        pages.map((p) => p.toJSON())
      );
      return pages[i];
    }
  }
  return null;
}

/**
 * 更新页面顺序
 * @param courseId - 课程 ID
 * @param pageIds - 按新顺序排列的页面 ID 数组
 */
export function updatePageOrder(courseId: string, pageIds: string[]): void {
  const pages = getPagesByCourse(courseId);
  const pageOrder = new Map(pageIds.map((id, i) => [id, i]));

  for (const page of pages) {
    const newOrder = pageOrder.get(page.id);
    if (newOrder !== undefined) {
      page.order = newOrder;
    }
  }

  writePages(
    courseId,
    pages.map((p) => p.toJSON())
  );

  const coursesData = readCourses();
  if (courseId in coursesData) {
    coursesData[courseId].page_ids = pageIds;
    coursesData[courseId].updated_at = nowIso();
    writeCourses(coursesData);
  }
}

/**
 * 删除页面
 * @param courseId - 课程 ID
 * @param pageId - 页面 ID
 * @returns {boolean} 删除成功返回 true，页面不存在返回 false
 */
export function deletePage(courseId: string, pageId: string): boolean {
  const pages = getPagesByCourse(courseId);
  const originalLength = pages.length;

  let deletedPage: Page | null = null;
  const remaining: Page[] = [];
  for (const p of pages) {
    if (p.id === pageId) {
      deletedPage = p;
    } else {
      remaining.push(p);
    }
  }

  if (remaining.length === originalLength) {
    return false;
  }

  for (let i = 0; i < remaining.length; i++) {
    remaining[i].order = i;
  }

  writePages(
    courseId,
    remaining.map((p) => p.toJSON())
  );

  const coursesData = readCourses();
  if (courseId in coursesData) {
    coursesData[courseId].page_ids = remaining.map((p) => p.id);
    coursesData[courseId].updated_at = nowIso();
    writeCourses(coursesData);
  }

  // 删除页面资源目录（非外部链接页面）
  if (deletedPage && deletedPage.type !== PageType.EXTERNAL) {
    const config = getConfig();
    const pageAssetsDir = path.join(config.assetsDir, courseId, pageId);
    if (fs.existsSync(pageAssetsDir)) {
      fs.rmSync(pageAssetsDir, { recursive: true, force: true });
    }
  }

  return true;
}

// ========== 文件保存操作 ==========

/**
 * 保存单个 HTML 文件作为本地页面
 * @param courseId - 课程 ID
 * @param fileContent - 文件内容 Buffer
 * @param filename - 原始文件名
 * @returns {Page} 创建的页面对象
 */
export function saveHtmlFile(courseId: string, fileContent: Buffer, filename: string): Page {
  const pages = getPagesByCourse(courseId);
  const pageId = generateId();
  const now = nowIso();

  const name = filename.includes('.') ? filename.split('.').slice(0, -1).join('.') : filename;
  const folderName = pageId;

  const config = getConfig();
  const destFolder = path.join(config.assetsDir, courseId, folderName);
  if (!fs.existsSync(destFolder)) {
    fs.mkdirSync(destFolder, { recursive: true });
  }

  const indexPath = path.join(destFolder, 'index.html');
  fs.writeFileSync(indexPath, fileContent);

  const page = new Page({
    id: pageId,
    course_id: courseId,
    type: PageType.LOCAL,
    name,
    order: pages.length,
    files: ['index.html'],
    created_at: now,
    updated_at: now,
  });

  pages.push(page);
  writePages(courseId, pages.map((p) => p.toJSON()));

  const coursesData = readCourses();
  if (courseId in coursesData) {
    coursesData[courseId].page_ids.push(pageId);
    coursesData[courseId].updated_at = now;
    writeCourses(coursesData);
  }

  return page;
}

/**
 * 保存单个图片文件作为页面
 * @param courseId - 课程 ID
 * @param fileContent - 文件内容 Buffer
 * @param filename - 原始文件名
 * @param displayMode - 图片显示模式，默认为 fit
 * @returns {Page} 创建的页面对象
 */
export function saveImageFile(
  courseId: string,
  fileContent: Buffer,
  filename: string,
  displayMode: string = 'fit'
): Page {
  const pages = getPagesByCourse(courseId);
  const pageId = generateId();
  const now = nowIso();

  const name = filename.includes('.') ? filename.split('.').slice(0, -1).join('.') : filename;
  const folderName = pageId;

  const config = getConfig();
  const destFolder = path.join(config.assetsDir, courseId, folderName);
  if (!fs.existsSync(destFolder)) {
    fs.mkdirSync(destFolder, { recursive: true });
  }

  const imagePath = path.join(destFolder, filename);
  fs.writeFileSync(imagePath, fileContent);

  let displayModeEnum: ImageDisplayMode;
  try {
    displayModeEnum = displayMode as ImageDisplayMode;
    if (!Object.values(ImageDisplayMode).includes(displayModeEnum)) {
      displayModeEnum = ImageDisplayMode.FIT;
    }
  } catch {
    displayModeEnum = ImageDisplayMode.FIT;
  }

  const page = new Page({
    id: pageId,
    course_id: courseId,
    type: PageType.IMAGE,
    name,
    order: pages.length,
    files: [filename],
    display_mode: displayModeEnum,
    created_at: now,
    updated_at: now,
  });

  pages.push(page);
  writePages(courseId, pages.map((p) => p.toJSON()));

  const coursesData = readCourses();
  if (courseId in coursesData) {
    coursesData[courseId].page_ids.push(pageId);
    coursesData[courseId].updated_at = now;
    writeCourses(coursesData);
  }

  return page;
}

/**
 * 保存单个 PDF 文件作为页面
 * @param courseId - 课程 ID
 * @param fileContent - 文件内容 Buffer
 * @param filename - 原始文件名
 * @returns {Page} 创建的页面对象
 */
export function savePdfFile(courseId: string, fileContent: Buffer, filename: string): Page {
  const pages = getPagesByCourse(courseId);
  const pageId = generateId();
  const now = nowIso();

  const name = filename.includes('.') ? filename.split('.').slice(0, -1).join('.') : filename;
  const folderName = pageId;

  const config = getConfig();
  const destFolder = path.join(config.assetsDir, courseId, folderName);
  if (!fs.existsSync(destFolder)) {
    fs.mkdirSync(destFolder, { recursive: true });
  }

  const pdfPath = path.join(destFolder, filename);
  fs.writeFileSync(pdfPath, fileContent);

  const page = new Page({
    id: pageId,
    course_id: courseId,
    type: PageType.PDF,
    name,
    order: pages.length,
    files: [filename],
    created_at: now,
    updated_at: now,
  });

  pages.push(page);
  writePages(courseId, pages.map((p) => p.toJSON()));

  const coursesData = readCourses();
  if (courseId in coursesData) {
    coursesData[courseId].page_ids.push(pageId);
    coursesData[courseId].updated_at = now;
    writeCourses(coursesData);
  }

  return page;
}

/**
 * 保存单个视频文件作为页面
 * @param courseId - 课程 ID
 * @param fileContent - 文件内容 Buffer
 * @param filename - 原始文件名
 * @returns {Page} 创建的页面对象
 */
export function saveVideoFile(courseId: string, fileContent: Buffer, filename: string): Page {
  const pages = getPagesByCourse(courseId);
  const pageId = generateId();
  const now = nowIso();

  const name = filename.includes('.') ? filename.split('.').slice(0, -1).join('.') : filename;
  const folderName = pageId;

  const config = getConfig();
  const destFolder = path.join(config.assetsDir, courseId, folderName);
  if (!fs.existsSync(destFolder)) {
    fs.mkdirSync(destFolder, { recursive: true });
  }

  const videoPath = path.join(destFolder, filename);
  fs.writeFileSync(videoPath, fileContent);

  const page = new Page({
    id: pageId,
    course_id: courseId,
    type: PageType.VIDEO,
    name,
    order: pages.length,
    files: [filename],
    created_at: now,
    updated_at: now,
  });

  pages.push(page);
  writePages(courseId, pages.map((p) => p.toJSON()));

  const coursesData = readCourses();
  if (courseId in coursesData) {
    coursesData[courseId].page_ids.push(pageId);
    coursesData[courseId].updated_at = now;
    writeCourses(coursesData);
  }

  return page;
}

/**
 * 保存标题页面
 * @param courseId - 课程 ID
 * @param titleData - 标题数据
 * @param titleData.text - 标题文字内容
 * @param titleData.fontSize - 标题字体大小（默认88）
 * @param titleData.color - 标题颜色（默认白色 #ffffff）
 * @param titleData.bgColor - 标题背景颜色（默认与播放页工具栏一致）
 * @returns {Page} 创建的页面对象
 */
export function saveTitlePage(
  courseId: string,
  titleData: {
    text: string;
    fontSize?: number;
    color?: string;
    bgColor?: string;
  }
): Page {
  const pages = getPagesByCourse(courseId);
  const pageId = generateId();
  const now = nowIso();

  const page = new Page({
    id: pageId,
    course_id: courseId,
    type: PageType.TITLE,
    name: titleData.text.slice(0, 20),
    order: pages.length,
    title_text: titleData.text.slice(0, 20),
    title_font_size: titleData.fontSize ?? 88,
    title_color: titleData.color ?? '#ffffff',
    title_bg_color: titleData.bgColor ?? '#1f1f1f',
    created_at: now,
    updated_at: now,
  });

  pages.push(page);
  writePages(courseId, pages.map((p) => p.toJSON()));

  const coursesData = readCourses();
  if (courseId in coursesData) {
    coursesData[courseId].page_ids.push(pageId);
    coursesData[courseId].updated_at = now;
    writeCourses(coursesData);
  }

  return page;
}

// ========== ZIP 处理 ==========

/**
 * 解压 ZIP 文件并创建本地页面
 * @param courseId - 课程 ID
 * @param zipFilePath - ZIP 文件路径
 * @returns {Page[]} 提取创建的页面对象数组
 */
export function extractZipFile(courseId: string, zipFilePath: string): Page[] {
  const extractedPages: Page[] = [];

  if (!fs.existsSync(zipFilePath)) {
    console.error('ZIP file does not exist:', zipFilePath);
    return extractedPages;
  }

  let zip: AdmZip;
  try {
    zip = new AdmZip(zipFilePath);
  } catch (e: any) {
    console.error('Failed to open ZIP file:', e.message);
    return extractedPages;
  }

  const zipEntries = zip.getEntries();
  console.log('ZIP entries count:', zipEntries.length);

  let allFiles = zipEntries
    .filter((entry) => !entry.isDirectory)
    .map((entry) => entry.entryName)
    .filter((name) => !name.includes('__MACOSX') && !name.startsWith('._'));

  console.log('Filtered files:', allFiles);

  if (allFiles.length === 0) {
    console.error('ZIP file is empty or contains no valid files');
    return extractedPages;
  }

  const hasFolders = allFiles.some((f) => f.includes('/'));
  const config = getConfig();

  if (hasFolders) {
    const topLevelFolders = new Set<string>();
    for (const filePath of allFiles) {
      if (filePath.includes('/')) {
        const topLevel = filePath.split('/')[0];
        topLevelFolders.add(topLevel);
      }
    }

    console.log('Top level folders:', Array.from(topLevelFolders));

    for (const folderName of Array.from(topLevelFolders).sort()) {
      const folderFiles = allFiles.filter((f) => f.startsWith(folderName + '/'));
      if (folderFiles.length === 0) continue;

      const hasIndex = folderFiles.some(
        (f) => f.endsWith('/index.html') || f === folderName + '/index.html'
      );

      console.log(`Folder ${folderName}: hasIndex=${hasIndex}, files=${folderFiles.length}`);

      // 先收集主要文件列表
      const mainFiles: string[] = [];
      for (const filePath of folderFiles) {
        const fileName = filePath.split('/').pop() || '';
        if (fileName && fileName !== '.' && fileName !== '..') {
          const ext = fileName.includes('.') ? fileName.split('.').pop()?.toLowerCase() : '';
          if (ext && ['html', 'htm', 'css', 'js'].includes(ext)) {
            if (!mainFiles.includes(fileName)) {
              mainFiles.push(fileName);
            }
          }
        }
      }

      if (hasIndex) {
        // 先创建页面获取 pageId
        const page = addLocalPage(courseId, folderName, mainFiles);
        extractedPages.push(page);
        console.log('Created page for folder:', folderName, 'pageId:', page.id);

        // 解压到 assets/{courseId}/{pageId}/ 目录
        const destFolder = path.join(config.assetsDir, courseId, page.id);
        if (!fs.existsSync(destFolder)) {
          fs.mkdirSync(destFolder, { recursive: true });
        }

        for (const filePath of folderFiles) {
          const entry = zipEntries.find((e) => e.entryName === filePath);
          if (entry) {
            try {
              const relativePath = filePath.slice(folderName.length + 1); // Remove "folderName/" prefix
              const targetPath = path.join(destFolder, relativePath);
              const targetDir = path.dirname(targetPath);
              if (!fs.existsSync(targetDir)) {
                fs.mkdirSync(targetDir, { recursive: true });
              }
              fs.writeFileSync(targetPath, entry.getData());
              console.log('Extracted:', filePath, '->', targetPath);
            } catch (e: any) {
              console.error('Failed to extract file:', filePath, e.message);
            }
          }
        }
      }
    }
  } else {
    const zipFileName = path.basename(zipFilePath);
    const folderName = zipFileName.endsWith('.zip')
      ? zipFileName.slice(0, -4)
      : zipFileName;

    const hasIndex = allFiles.some(
      (f) => f === 'index.html' || f.endsWith('index.html')
    );

    console.log(`Flat ZIP: folderName=${folderName}, hasIndex=${hasIndex}`);

    if (hasIndex) {
      // 先收集主要文件列表
      const mainFiles: string[] = [];
      for (const filePath of allFiles) {
        const fileName = filePath;
        if (fileName && fileName !== '.' && fileName !== '..') {
          const ext = fileName.includes('.') ? fileName.split('.').pop()?.toLowerCase() : '';
          if (ext && ['html', 'htm', 'css', 'js'].includes(ext)) {
            if (!mainFiles.includes(fileName)) {
              mainFiles.push(fileName);
            }
          }
        }
      }

      // 先创建页面获取 pageId
      const page = addLocalPage(courseId, folderName, mainFiles);
      extractedPages.push(page);
      console.log('Created page for flat ZIP:', folderName, 'pageId:', page.id);

      // 解压到 assets/{courseId}/{pageId}/ 目录
      const destFolder = path.join(config.assetsDir, courseId, page.id);
      if (!fs.existsSync(destFolder)) {
        fs.mkdirSync(destFolder, { recursive: true });
      }

      for (const filePath of allFiles) {
        const entry = zipEntries.find((e) => e.entryName === filePath);
        if (entry) {
          try {
            const targetPath = path.join(destFolder, filePath);
            fs.writeFileSync(targetPath, entry.getData());
            console.log('Extracted:', filePath, '->', targetPath);
          } catch (e: any) {
            console.error('Failed to extract file:', filePath, e.message);
          }
        }
      }
    }
  }

  console.log('Total extracted pages:', extractedPages.length);
  return extractedPages;
}

// ========== 导入导出功能 ==========

/**
 * 导出课程为 ZIP 文件
 * @param courseId - 课程 ID
 * @param exportFilePath - 导出的 ZIP 文件路径
 * @returns {boolean} 导出成功返回 true，课程不存在或导出失败返回 false
 */
export function exportCourse(courseId: string, exportFilePath: string): boolean {
  const courseDetail = getCourseDetail(courseId);
  if (!courseDetail) {
    return false;
  }

  try {
    const zip = new AdmZip();

    const metadata: Record<string, any> = {
      version: '1.0',
      exported_at: nowIso(),
      course: {
        name: courseDetail.name,
        description: courseDetail.description,
        created_at: courseDetail.created_at,
        updated_at: courseDetail.updated_at,
      },
      pages: [],
    };

    const config = getConfig();

    for (const page of courseDetail.pages) {
      const pageDict = page.toJSON();

      const pageMetadata: Record<string, any> = {
        id: pageDict.id,
        type: pageDict.type,
        name: pageDict.name,
        order: pageDict.order,
        created_at: pageDict.created_at,
        updated_at: pageDict.updated_at,
      };

      if (pageDict.type === PageType.EXTERNAL) {
        pageMetadata.url = pageDict.url;
        pageMetadata.external_url_mode = pageDict.external_url_mode;
      } else if (pageDict.type === PageType.TITLE) {
        pageMetadata.title_text = pageDict.title_text;
        pageMetadata.title_font_size = pageDict.title_font_size;
        pageMetadata.title_color = pageDict.title_color;
        pageMetadata.title_bg_color = pageDict.title_bg_color;
      } else if (
        [PageType.LOCAL, PageType.IMAGE, PageType.PDF, PageType.VIDEO].includes(pageDict.type)
      ) {
        pageMetadata.files = pageDict.files || [];
        if (pageDict.type === PageType.IMAGE) {
          pageMetadata.display_mode = pageDict.display_mode;
        }

        // 从 assets/{courseId}/{pageId}/ 目录读取资源文件
        const pageFolder = path.join(config.assetsDir, courseId, pageDict.id || '');
        if (fs.existsSync(pageFolder)) {
          const entries = fs.readdirSync(pageFolder, { withFileTypes: true, recursive: true });
          for (const entry of entries) {
            if (entry.isFile()) {
              const fullPath = path.join(entry.parentPath || pageFolder, entry.name);
              // 使用 pageId 作为 ZIP 中的目录名
              const relPath = path.relative(path.join(config.assetsDir, courseId), fullPath);
              const arcName = relPath.replace(/\\/g, '/');
              zip.addLocalFile(fullPath, path.dirname(arcName) === '.' ? '' : path.dirname(arcName));
            }
          }
        }
      }

      metadata.pages.push(pageMetadata);
    }

    zip.addFile('course.json', Buffer.from(JSON.stringify(metadata, null, 2), 'utf-8'));
    zip.writeZip(exportFilePath);

    return true;
  } catch (e: any) {
    console.error(`[ERROR] 导出失败: ${e.message}`);
    return false;
  }
}

/**
 * 从 ZIP 文件导入课程
 * @param zipFilePath - ZIP 文件路径
 * @returns {Course | null} 导入的课程对象，失败时返回 null
 * @throws {Error} 当文件格式错误或导入过程出错时抛出异常
 */
export function importCourse(zipFilePath: string): Course | null {
  if (!fs.existsSync(zipFilePath)) {
    throw new Error('文件不存在');
  }

  try {
    const zip = new AdmZip(zipFilePath);
    const entries = zip.getEntries();

    const courseJsonEntry = entries.find((e) => e.entryName === 'course.json');
    if (!courseJsonEntry) {
      throw new Error('无效的导出文件：缺少 course.json');
    }

    const exportData = JSON.parse(courseJsonEntry.getData().toString('utf-8'));

    if (!exportData.course || !exportData.pages) {
      throw new Error('导入数据格式错误');
    }

    const courseInfo = exportData.course;
    let newName = courseInfo.name;
    const existingCourses = getAllCourses();

    let counter = 1;
    const originalName = newName;
    while (existingCourses.some((c) => c.name === newName)) {
      newName = `${originalName}(${counter})`;
      counter++;
    }

    const course = createCourse(newName, courseInfo.description);
    if (!course) {
      throw new Error('创建课程失败');
    }

    const config = getConfig();

    for (const pageData of exportData.pages) {
      const pageType = pageData.type as PageType;

      if (pageType === PageType.EXTERNAL) {
        addExternalPage(course.id, pageData.url, pageData.external_url_mode || 'iframe');
        const pages = getPagesByCourse(course.id);
        if (pages.length > 0) {
          const lastPage = pages[pages.length - 1];
          updatePage(course.id, lastPage.id, { name: pageData.name });
        }
      } else if (pageType === PageType.TITLE) {
        // 导入标题页面
        const pageId = generateId();
        const now = nowIso();

        const page = new Page({
          id: pageId,
          course_id: course.id,
          type: PageType.TITLE,
          name: pageData.name,
          order: getPagesByCourse(course.id).length,
          title_text: pageData.title_text,
          title_font_size: pageData.title_font_size,
          title_color: pageData.title_color,
          title_bg_color: pageData.title_bg_color,
          created_at: now,
          updated_at: now,
        });

        const pages = getPagesByCourse(course.id);
        pages.push(page);
        writePages(course.id, pages.map((p) => p.toJSON()));

        const coursesData = readCourses();
        coursesData[course.id].page_ids.push(page.id);
        coursesData[course.id].updated_at = now;
        writeCourses(coursesData);
      } else if (
        [PageType.LOCAL, PageType.IMAGE, PageType.PDF, PageType.VIDEO].includes(pageType)
      ) {
        // 先生成 pageId 并创建页面
        const pageId = generateId();
        const now = nowIso();

        // 导入资源到 assets/{courseId}/{pageId}/ 目录
        const pageFolder = path.join(config.assetsDir, course.id, pageId);
        if (!fs.existsSync(pageFolder)) {
          fs.mkdirSync(pageFolder, { recursive: true });
        }

        // 从 ZIP 中查找属于该页面的文件
        // 导出的 ZIP 中使用原始 pageId 作为目录名
        const savedFiles: string[] = [];
        // 使用导出时保存的原始 pageId 来查找文件（兼容旧格式使用 folder_name）
        const originalPageId = pageData.id || pageData.folder_name;
        if (!originalPageId) {
          console.warn(`[WARN] 页面 ${pageData.name} 没有 id 或 folder_name，跳过导入资源`);
          continue;
        }
        
        const pageEntries = entries.filter((e) => {
          const filePathStr = e.entryName.replace(/\\/g, '/');
          // 查找以原始 pageId 或 folder_name 开头的文件
          return filePathStr !== 'course.json' && filePathStr.startsWith(`${originalPageId}/`);
        });

        for (const entry of pageEntries) {
          const filePathStr = entry.entryName.replace(/\\/g, '/');
          
          // 确定相对路径：移除原始 pageId 前缀
          let relPath = filePathStr.slice(`${originalPageId}/`.length);
          
          if (!relPath) continue;

          const targetPath = path.join(pageFolder, relPath);
          const targetDir = path.dirname(targetPath);
          if (!fs.existsSync(targetDir)) {
            fs.mkdirSync(targetDir, { recursive: true });
          }
          fs.writeFileSync(targetPath, entry.getData());

          if (pageType !== PageType.LOCAL) {
            const expectedMainFile = pageData.files?.[0];
            if (relPath === expectedMainFile) {
              savedFiles.push(relPath);
            }
          } else {
            savedFiles.push(relPath);
          }
        }

        const page = new Page({
          id: pageId,
          course_id: course.id,
          type: pageType,
          name: pageData.name,
          order: getPagesByCourse(course.id).length,
          files: pageType !== PageType.LOCAL ? savedFiles : Array.from(new Set(savedFiles)),
          display_mode: pageData.display_mode,
          created_at: now,
          updated_at: now,
        });

        const pages = getPagesByCourse(course.id);
        pages.push(page);
        writePages(course.id, pages.map((p) => p.toJSON()));

        const coursesData = readCourses();
        coursesData[course.id].page_ids.push(page.id);
        coursesData[course.id].updated_at = now;
        writeCourses(coursesData);
      }
    }

    return course;
  } catch (e: any) {
    console.error(`[ERROR] 导入失败: ${e.message}`);
    if (e.message.includes('无效的导出文件') || e.message.includes('导入数据格式错误')) {
      throw e;
    }
    throw new Error(`导入失败: ${e.message}`);
  }
}

/**
 * 获取本地页面的文件内容
 * @param courseId - 课程 ID
 * @param pageId - 页面 ID
 * @returns {Buffer | null} 文件内容 Buffer，页面不存在或非本地页面时返回 null
 */
export function getPageContent(courseId: string, pageId: string): Buffer | null {
  const page = getPage(courseId, pageId);
  if (!page || !page.files || page.files.length === 0) {
    return null;
  }

  const config = getConfig();
  const filePath = path.join(config.assetsDir, courseId, pageId, page.files[0]);
  if (!fs.existsSync(filePath)) {
    return null;
  }

  return fs.readFileSync(filePath);
}

/**
 * 获取页面文件的真实路径
 * 用于视频等大文件直接通过路径访问，避免 IPC 传输整个文件内容
 * @param courseId - 课程 ID
 * @param pageId - 页面 ID
 * @returns {string | null} 文件绝对路径，不存在时返回 null
 */
export function getPageFilePath(courseId: string, pageId: string): string | null {
  const page = getPage(courseId, pageId);
  if (!page || !page.files || page.files.length === 0) {
    return null;
  }

  const config = getConfig();

  // 对于 LOCAL 类型页面，优先查找 index.html，如果没有则查找任意 .html 文件
  let targetFile: string | null = null;
  if (page.type === PageType.LOCAL) {
    targetFile = page.files.find(f => f.toLowerCase() === 'index.html') ||
                 page.files.find(f => f.toLowerCase().endsWith('.html')) ||
                 page.files[0];
  } else {
    // 其他类型使用第一个文件
    targetFile = page.files[0];
  }

  if (!targetFile) {
    return null;
  }

  const filePath = path.join(config.assetsDir, courseId, pageId, targetFile);
  if (!fs.existsSync(filePath)) {
    return null;
  }

  return filePath;
}
