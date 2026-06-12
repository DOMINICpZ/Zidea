import { create } from 'zustand'
import type { Course, CourseDetail, Page } from '@/types'
import * as api from '@/services/api'

interface CourseState {
  courses: Course[]
  currentCourse: CourseDetail | null
  loading: boolean
  error: string | null

  // Actions
  fetchCourses: () => Promise<void>
  fetchCourseDetail: (courseId: string) => Promise<void>
  createCourse: (data: { name: string; description?: string }) => Promise<Course>
  updateCourse: (courseId: string, data: { name?: string; description?: string; pageIds?: string[] }) => Promise<void>
  deleteCourse: (courseId: string) => Promise<void>
  setCurrentCourse: (course: CourseDetail | null) => void
}

export const useCourseStore = create<CourseState>((set) => ({
  courses: [],
  currentCourse: null,
  loading: false,
  error: null,

  fetchCourses: async () => {
    set({ loading: true, error: null })
    try {
      const courses = await api.getCourses()
      set({ courses, loading: false })
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : '获取课程列表失败',
        loading: false,
      })
    }
  },

  fetchCourseDetail: async (courseId: string) => {
    set({ loading: true, error: null })
    try {
      const course = await api.getCourseDetail(courseId)
      set({ currentCourse: course, loading: false })
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : '获取课程详情失败',
        loading: false,
      })
    }
  },

  createCourse: async (data) => {
    set({ loading: true, error: null })
    try {
      const course = await api.createCourse(data)
      set((state) => ({
        courses: [...state.courses, course],
        loading: false,
      }))
      return course
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : '创建课程失败',
        loading: false,
      })
      throw error
    }
  },

  updateCourse: async (courseId, data) => {
    set({ loading: true, error: null })
    try {
      await api.updateCourse(courseId, data)
      set((state) => {
        const updatedCourses = state.courses.map((c) =>
          c.id === courseId ? { ...c, ...data, updatedAt: new Date().toISOString() } : c
        )

        let updatedCurrentCourse = state.currentCourse
        if (state.currentCourse?.id === courseId) {
          // 如果更新了 pageIds，需要重新排序 pages 数组
          let newPages = state.currentCourse.pages
          if (data.pageIds) {
            const pageMap = new Map(newPages.map((p) => [p.id, p]))
            newPages = data.pageIds.map((id) => pageMap.get(id)).filter((p): p is Page => p !== undefined)
          }
          updatedCurrentCourse = {
            ...state.currentCourse,
            ...data,
            pages: newPages,
            updatedAt: new Date().toISOString()
          }
        }

        return {
          courses: updatedCourses,
          currentCourse: updatedCurrentCourse,
          loading: false,
        }
      })
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : '更新课程失败',
        loading: false,
      })
      throw error
    }
  },

  deleteCourse: async (courseId) => {
    set({ loading: true, error: null })
    try {
      await api.deleteCourse(courseId)
      set((state) => ({
        courses: state.courses.filter((c) => c.id !== courseId),
        currentCourse: state.currentCourse?.id === courseId ? null : state.currentCourse,
        loading: false,
      }))
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : '删除课程失败',
        loading: false,
      })
      throw error
    }
  },

  setCurrentCourse: (course) => {
    set({ currentCourse: course })
  },
}))
