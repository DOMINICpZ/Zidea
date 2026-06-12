import { HashRouter, Routes, Route, Navigate } from 'react-router-dom'
import { ConfigProvider, theme } from 'antd'
import MainLayout from '@/components/Layout/MainLayout'
import CourseList from '@/pages/CourseList'
import CourseEdit from '@/pages/CourseEdit'
import Player from '@/pages/Player'
import { useCourseStore } from '@/store/courseStore'
import { useEffect } from 'react'

function App() {
  const { fetchCourses } = useCourseStore()

  useEffect(() => {
    fetchCourses()
  }, [fetchCourses])

  return (
    <ConfigProvider
      theme={{
        token: {
          colorPrimary: '#1890ff',
          colorSuccess: '#52c41a',
          colorWarning: '#faad14',
          colorError: '#f5222d',
        },
        algorithm: theme.defaultAlgorithm,
      }}
    >
      <HashRouter>
        <Routes>
          <Route path="/" element={<MainLayout />}>
            <Route index element={<CourseList />} />
            <Route path="courses/:courseId/edit" element={<CourseEdit />} />
          </Route>
          <Route path="/player/:courseId" element={<Player />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </HashRouter>
    </ConfigProvider>
  )
}

export default App
