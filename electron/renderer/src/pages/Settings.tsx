import { useEffect } from 'react'
import { Button, Form, Switch, Select, Card, message, Input } from 'antd'
import { ArrowLeftOutlined, SaveOutlined } from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'

interface SettingsData {
  rememberPosition: boolean
  defaultSort: 'createdAt' | 'name'
  platformName: string
  collectionName: string
  pageName: string
}

const DEFAULT_SETTINGS: SettingsData = {
  rememberPosition: true,
  defaultSort: 'createdAt',
  platformName: '灵光宝盒',
  collectionName: '集合',
  pageName: '页面',
}

const Settings = () => {
  const navigate = useNavigate()
  const [form] = Form.useForm()

  useEffect(() => {
    // 从 localStorage 加载设置
    const savedSettings = localStorage.getItem('settings')
    if (savedSettings) {
      try {
        const settings = JSON.parse(savedSettings)
        // 合并默认设置和保存的设置，确保新增的字段有默认值
        const mergedSettings = { ...DEFAULT_SETTINGS, ...settings }
        form.setFieldsValue(mergedSettings)
      } catch (error) {
        console.error('Failed to parse settings:', error)
        form.setFieldsValue(DEFAULT_SETTINGS)
      }
    } else {
      form.setFieldsValue(DEFAULT_SETTINGS)
    }
  }, [form])

  const handleSave = () => {
    const values = form.getFieldsValue()
    // 保存到 localStorage
    localStorage.setItem('settings', JSON.stringify(values))
    message.success('设置已保存，请刷新页面生效')
  }

  const handleReset = () => {
    form.setFieldsValue(DEFAULT_SETTINGS)
    localStorage.removeItem('settings')
    message.success('已恢复默认设置，请刷新页面生效')
  }

  return (
    <div style={{ maxWidth: '800px', margin: '0 auto' }}>
      <div
        style={{
          background: '#fff',
          padding: '16px 24px',
          marginBottom: '16px',
          borderRadius: '4px',
        }}
      >
        <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/')}>
          返回
        </Button>
      </div>

      {/* 命名设置 */}
      <Card title="命名设置" style={{ marginBottom: '16px' }}>
        <Form form={form} layout="vertical">
          <Form.Item
            label="平台名称"
            name="platformName"
            tooltip="显示在页面标题和导航栏的平台名称"
            rules={[{ required: true, message: '请输入平台名称' }]}
          >
            <Input placeholder="例如：灵光宝盒" />
          </Form.Item>

          <Form.Item
            label="集合名称"
            name="collectionName"
            tooltip="替代'课程'的名称，用于称呼一组网页"
            rules={[{ required: true, message: '请输入集合名称' }]}
          >
            <Input placeholder="例如：集合" />
          </Form.Item>

          <Form.Item
            label="页面名称"
            name="pageName"
            tooltip="单个网页的称呼"
            rules={[{ required: true, message: '请输入页面名称' }]}
          >
            <Input placeholder="例如：页面" />
          </Form.Item>
        </Form>
      </Card>

      {/* 播放设置 */}
      <Card title="播放设置" style={{ marginBottom: '16px' }}>
        <Form form={form} layout="vertical">
          <Form.Item
            label="记忆播放位置"
            name="rememberPosition"
            valuePropName="checked"
          >
            <Switch />
          </Form.Item>
        </Form>
      </Card>

      {/* 显示设置 */}
      <Card title="显示设置" style={{ marginBottom: '16px' }}>
        <Form form={form} layout="vertical">
          <Form.Item
            label="默认排序方式"
            name="defaultSort"
          >
            <Select
              options={[
                { label: '创建时间', value: 'createdAt' },
                { label: '名称', value: 'name' },
              ]}
            />
          </Form.Item>
        </Form>
      </Card>

      <div style={{ textAlign: 'center', marginTop: '24px' }}>
        <Button type="primary" icon={<SaveOutlined />} onClick={handleSave} style={{ marginRight: 8 }}>
          保存设置
        </Button>
        <Button onClick={handleReset}>
          恢复默认
        </Button>
      </div>
    </div>
  )
}

export default Settings

