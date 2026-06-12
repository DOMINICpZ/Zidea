import { useEffect } from 'react'
import { useNaming } from './useNaming'

export const useDocumentTitle = (_suffix?: string) => {
  const naming = useNaming()

  useEffect(() => {
    // 只显示平台名称，与设置保持一致
    document.title = naming.platformName
  }, [naming])
}
