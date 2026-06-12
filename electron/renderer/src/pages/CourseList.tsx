import { useNavigate } from 'react-router-dom'
import { Card, Button, Space, Modal, Form, Input, message, Popconfirm } from 'antd'
import { CloseOutlined, ImportOutlined } from '@ant-design/icons'
import { useState } from 'react'
import { useCourseStore } from '@/store/courseStore'
import { useNaming } from '@/hooks/useNaming'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import * as api from '@/services/api'
import type { Course } from '@/types'
import dayjs from 'dayjs'

const CourseList = () => {
  const navigate = useNavigate()
  const naming = useNaming()
  useDocumentTitle(naming.collectionName + '列表')
  const { courses, createCourse, deleteCourse, updateCourse, fetchCourses } = useCourseStore()
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [renameModalOpen, setRenameModalOpen] = useState(false)
  const [selectedCourse, setSelectedCourse] = useState<Course | null>(null)
  const [form] = Form.useForm()
  const [renameForm] = Form.useForm()
  const [localSearch, setLocalSearch] = useState('')
  const [importing, setImporting] = useState(false)

  /**
   * 处理导入集合
   * 点击按钮后直接打开文件选择对话框，选择后自动导入
   */
  const handleImport = async () => {
    try {
      setImporting(true)
      const course = await api.importCourse()
      message.success(`导入成功：${course.name}`)
      await fetchCourses()
    } catch (error: any) {
      if (error.message === '未选择文件') {
        // 用户取消了选择，不显示错误
        return
      }
      console.error('导入错误:', error)
      message.error(`导入失败：${error.message || '未知错误'}`)
    } finally {
      setImporting(false)
    }
  }

  // 过滤和排序集合
  const filteredCourses = courses
    .filter((course) => {
      return localSearch ? course.name.toLowerCase().includes(localSearch.toLowerCase()) : true
    })
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())

  const handleCreateCourse = async () => {
    try {
      const values = await form.validateFields()
      const course = await createCourse(values)
      message.success(`${naming.collectionName}创建成功`)
      setIsModalOpen(false)
      form.resetFields()
      navigate(`/courses/${course.id}/edit`)
    } catch (error: any) {
      if (error.errorFields) {
        // 表单验证错误
        return
      }
      message.error(`创建${naming.collectionName}失败`)
    }
  }

  const handleDeleteCourse = async (courseId: string, _courseName: string) => {
    try {
      await deleteCourse(courseId)
      message.success(`${naming.collectionName}已删除`)
    } catch (error: any) {
      message.error(`删除${naming.collectionName}失败`)
    }
  }

  const handleRenameCourse = async () => {
    if (!selectedCourse) return
    try {
      const values = await renameForm.validateFields()
      await updateCourse(selectedCourse.id, { name: values.name, description: values.description })
      message.success(`${naming.collectionName}修改成功`)
      setRenameModalOpen(false)
      setSelectedCourse(null)
      renameForm.resetFields()
    } catch (error: any) {
      if (error.errorFields) return
      message.error(`修改${naming.collectionName}失败`)
    }
  }

  const openRenameModal = (course: Course) => {
    setSelectedCourse(course)
    renameForm.setFieldsValue({
      name: course.name,
      description: course.description || ''
    })
    setRenameModalOpen(true)
  }

  const handleExportCourse = async (courseId: string, courseName: string) => {
    try {
      await api.exportCourse(courseId, courseName)
      message.success(`导出成功`)
    } catch (error) {
      message.error(`导出${naming.collectionName}失败`)
    }
  }

  return (
    <div>
      <div
        style={{
          background: '#fff',
          padding: '16px 24px',
          marginBottom: '16px',
          borderRadius: '4px',
          display: 'flex',
          gap: '12px',
          alignItems: 'center',
        }}
      >
        <Button type="primary" onClick={() => setIsModalOpen(true)}>
          创建
        </Button>
        <Button
          icon={<ImportOutlined />}
          loading={importing}
          onClick={handleImport}
        >
          导入
        </Button>
        <Input.Search
          placeholder={`搜索${naming.collectionName}名称`}
          allowClear
          style={{ width: 300 }}
          value={localSearch}
          onChange={(e) => setLocalSearch(e.target.value)}
        />
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '24px' }}>
        {filteredCourses.map((course) => (
          <Card
            key={course.id}
            hoverable
            style={{
              width: '320px',
              flexShrink: 0,
              aspectRatio: '1 / 0.618',
              border: '1px solid #e8e8e8',
              borderRadius: '8px',
              boxShadow: '0 1px 2px 0 rgba(0, 0, 0, 0.03)',
              transition: 'all 0.3s ease',
              overflow: 'hidden',
              position: 'relative',
            }}
            bodyStyle={{
              padding: '0',
              height: '100%',
              display: 'flex',
              flexDirection: 'column',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.boxShadow = '0 4px 12px 0 rgba(0, 0, 0, 0.08)'
              e.currentTarget.style.borderColor = '#d9d9d9'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.boxShadow = '0 1px 2px 0 rgba(0, 0, 0, 0.03)'
              e.currentTarget.style.borderColor = '#e8e8e8'
            }}
          >
            {/* 右上角关闭按钮 */}
            <Popconfirm
              title="确认删除"
              description={`确定要删除${naming.collectionName} "${course.name}" 吗？此操作不可恢复！`}
              onConfirm={() => handleDeleteCourse(course.id, course.name)}
              okText="确认删除"
              cancelText="取消"
            >
              <Button
                type="text"
                icon={<CloseOutlined />}
                style={{
                  position: 'absolute',
                  top: '8px',
                  right: '8px',
                  color: 'rgba(255, 255, 255, 0.85)',
                  fontSize: '18px',
                  width: '32px',
                  height: '32px',
                  zIndex: 10,
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'rgba(255, 255, 255, 0.2)'
                  e.currentTarget.style.color = '#fff'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'transparent'
                  e.currentTarget.style.color = 'rgba(255, 255, 255, 0.85)'
                }}
              />
            </Popconfirm>

            {/* 蓝色渐变色块 - 固定高度 */}
            <div
              style={{
                height: '120px',
                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                padding: '20px',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              <div
                style={{
                  fontSize: '22px',
                  fontWeight: 'bold',
                  color: '#fff',
                  marginBottom: '8px',
                  cursor: 'pointer',
                  display: 'inline-block',
                }}
                onClick={() => openRenameModal(course)}
                title="点击编辑"
              >
                {course.name}
              </div>
              {course.description && (
                <div style={{ color: 'rgba(255, 255, 255, 0.85)', fontSize: '14px' }}>
                  {course.description.length > 35
                    ? course.description.substring(0, 35) + '...'
                    : course.description}
                </div>
              )}
            </div>

            {/* 内容区域 - 使用flex布局固定各部分空间 */}
            <div
              style={{
                padding: '12px 20px',
                flex: 1,
                display: 'flex',
                flexDirection: 'column',
                minHeight: 0,
              }}
            >
              {/* 信息区域 - 固定高度 */}
              <div style={{ marginBottom: '8px', flexShrink: 0 }}>
                <div style={{ color: '#8c8c8c', fontSize: '13px' }}>
                  {course.pageIds.length} {naming.pageName} · {dayjs(course.createdAt).format('YYYY-MM-DD')}
                </div>
              </div>

              {/* 按钮区域 - 固定在底部 */}
              <div style={{ marginTop: 'auto', flexShrink: 0, display: 'flex', justifyContent: 'flex-end' }}>
                <Space size="small">
                  <Button
                    type="primary"
                    onClick={() => {
                      api.destroyBrowserView()
                      navigate(`/player/${course.id}`)
                    }}
                    style={{
                      fontWeight: 500,
                      padding: '4px 12px',
                      height: '32px',
                    }}
                  >
                    播放
                  </Button>
                  <Button
                    onClick={() => navigate(`/courses/${course.id}/edit`)}
                    style={{
                      fontWeight: 500,
                      padding: '4px 12px',
                      height: '32px',
                    }}
                  >
                    编辑
                  </Button>
                  <Button
                    onClick={() => handleExportCourse(course.id, course.name)}
                    style={{
                      fontWeight: 500,
                      padding: '4px 12px',
                      height: '32px',
                    }}
                  >
                    导出
                  </Button>
                </Space>
              </div>
            </div>
          </Card>
        ))}
      </div>

      {/* 创建集合对话框 */}
      <Modal
        title={`创建新${naming.collectionName}`}
        open={isModalOpen}
        onOk={handleCreateCourse}
        onCancel={() => {
          setIsModalOpen(false)
          form.resetFields()
        }}
        okText="创建"
        cancelText="取消"
      >
        <Form form={form} layout="vertical">
          <Form.Item
            label={`${naming.collectionName}名称`}
            name="name"
            rules={[{ required: true, message: `请输入${naming.collectionName}名称` }]}
          >
            <Input placeholder={`请输入${naming.collectionName}名称`} />
          </Form.Item>
          <Form.Item
            label={`${naming.collectionName}描述`}
            name="description"
            rules={[
              { max: 100, message: '描述不能超过100字' }
            ]}
          >
            <Input.TextArea
              placeholder={`请输入${naming.collectionName}描述（可选，最多100字）`}
              rows={3}
              showCount
              maxLength={100}
            />
          </Form.Item>
        </Form>
      </Modal>

      {/* 重命名集合对话框 */}
      <Modal
        title={`编辑${naming.collectionName}`}
        open={renameModalOpen}
        onOk={handleRenameCourse}
        onCancel={() => {
          setRenameModalOpen(false)
          setSelectedCourse(null)
          renameForm.resetFields()
        }}
        okText="保存"
        cancelText="取消"
      >
        <Form form={renameForm} layout="vertical">
          <Form.Item
            label={`${naming.collectionName}名称`}
            name="name"
            rules={[{ required: true, message: `请输入${naming.collectionName}名称` }]}
          >
            <Input placeholder={`请输入${naming.collectionName}名称`} />
          </Form.Item>
          <Form.Item
            label={`${naming.collectionName}描述`}
            name="description"
            rules={[
              { max: 100, message: '描述不能超过100字' }
            ]}
          >
            <Input.TextArea
              placeholder={`请输入${naming.collectionName}描述（可选，最多100字）`}
              rows={3}
              showCount
              maxLength={100}
            />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}

export default CourseList
