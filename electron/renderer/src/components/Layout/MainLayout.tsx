import { Outlet } from 'react-router-dom'
import { Layout as AntLayout } from 'antd'

const { Content } = AntLayout

const MainLayout = () => {
  return (
    <AntLayout style={{ minHeight: '100vh' }}>
      <Content style={{ padding: '24px 0', background: '#f0f2f5' }}>
        <div className="container">
          <Outlet />
        </div>
      </Content>
    </AntLayout>
  )
}

export default MainLayout
