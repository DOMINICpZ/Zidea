import { useMemo } from 'react'

interface NamingConfig {
  platformName: string
  collectionName: string
  pageName: string
}

const DEFAULT_CONFIG: NamingConfig = {
  platformName: '灵光宝盒',
  collectionName: '集合',
  pageName: '页面',
}

export const useNaming = () => {
  const config = useMemo(() => {
    return DEFAULT_CONFIG
  }, [])

  return config
}
