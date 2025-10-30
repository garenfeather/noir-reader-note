/**
 * 翻译配置类型定义
 */

export interface TranslationIntensity {
  name: string
  promptFile: string
}

export interface TranslationSource {
  name: string
  model: string
  apiKeyEnv: string
}

export interface TranslationConfig {
  intensities: {
    [key: string]: TranslationIntensity
  }
  sources: {
    [key: string]: TranslationSource
  }
  default: {
    intensity: string
    source: string
  }
}

export interface TranslationSettings {
  intensity: string
  source: string
}
