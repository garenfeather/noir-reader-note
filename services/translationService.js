/**
 * 翻译服务模块
 * 封装翻译逻辑，供Electron主进程调用
 */

const fs = require('fs')
const path = require('path')
const axios = require('axios')
const { HttpsProxyAgent } = require('https-proxy-agent')

/**
 * 加载配置文件
 */
function loadConfig() {
  const configPath = path.join(__dirname, '..', 'translation-config.json')
  const configContent = fs.readFileSync(configPath, 'utf-8')
  return JSON.parse(configContent)
}

/**
 * 加载系统提示词
 */
function loadSystemPrompt(promptFile) {
  const promptPath = path.join(__dirname, '..', promptFile)
  let content = fs.readFileSync(promptPath, 'utf-8')

  // 提取 ## System Prompt 部分（去掉示例部分）
  if (content.includes('---')) {
    content = content.split('---')[0]
  }

  return content.trim()
}

/**
 * 从响应中提取JSON
 */
function extractJSON(text) {
  // 尝试提取markdown代码块中的JSON
  if (text.includes('```json')) {
    const start = text.indexOf('```json') + 7
    const end = text.indexOf('```', start)
    text = text.substring(start, end).trim()
  } else if (text.includes('```')) {
    const start = text.indexOf('```') + 3
    const end = text.indexOf('```', start)
    text = text.substring(start, end).trim()
  }

  try {
    return JSON.parse(text)
  } catch (error) {
    console.error('JSON解析失败:', error.message)
    console.error('原始文本:', text)
    return null
  }
}

/**
 * 翻译文本（使用axios，带重试和代理支持）
 * @param {string} text - 待翻译的文本
 * @param {string} intensity - 解析强度（默认：detailed）
 * @param {string} source - 翻译来源（默认：gemini）
 * @param {number} maxRetries - 最大重试次数（默认：3）
 * @returns {Promise<Object>} - 返回 { translation, notes, language }
 */
async function translate(text, intensity = 'detailed', source = 'gemini', maxRetries = 3) {
  let lastError = null

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      // 1. 加载配置
      const config = loadConfig()

      // 2. 获取intensity和source配置
      const intensityConfig = config.intensities[intensity]
      const sourceConfig = config.sources[source]

      if (!intensityConfig) {
        throw new Error(`未找到解析强度配置: ${intensity}`)
      }
      if (!sourceConfig) {
        throw new Error(`未找到翻译来源配置: ${source}`)
      }

      // 3. 获取API密钥
      const apiKey = process.env[sourceConfig.apiKeyEnv]
      if (!apiKey) {
        throw new Error(`未设置环境变量: ${sourceConfig.apiKeyEnv}`)
      }

      // 4. 加载系统提示词
      const systemPrompt = loadSystemPrompt(intensityConfig.promptFile)

      // 5. 构造完整的prompt
      const fullPrompt = `${systemPrompt}\n\n${text}`

      // 6. 配置axios
      const axiosConfig = {
        timeout: 60000 // 60秒超时
      }

      // 配置代理
      const proxyUrl = process.env.https_proxy || process.env.http_proxy
      if (proxyUrl) {
        const agent = new HttpsProxyAgent(proxyUrl)
        axiosConfig.httpsAgent = agent
        axiosConfig.proxy = false
      }

      // 7. 调用API
      if (attempt > 0) {
        console.log(`[翻译服务] 重试 ${attempt}/${maxRetries - 1}...`)
      }

      const url = `https://generativelanguage.googleapis.com/v1beta/models/${sourceConfig.model}:generateContent?key=${apiKey}`

      const response = await axios.post(url, {
        contents: [{
          parts: [{
            text: fullPrompt
          }]
        }]
      }, axiosConfig)

      // 8. 提取响应文本
      if (!response.data.candidates || !response.data.candidates[0]) {
        throw new Error('API响应格式错误：没有candidates')
      }

      const responseText = response.data.candidates[0].content.parts[0].text

      // 9. 解析JSON
      const jsonResult = extractJSON(responseText)

      if (!jsonResult) {
        throw new Error('无法解析API响应为JSON')
      }

      return jsonResult

    } catch (error) {
      lastError = error
      const errorMsg = error.response?.data?.error?.message || error.message
      console.error(`[翻译服务] 尝试 ${attempt + 1}/${maxRetries} 失败:`, errorMsg)

      // 如果还有重试机会，等待后重试
      if (attempt < maxRetries - 1) {
        const waitTime = (attempt + 1) * 2000 // 递增等待时间
        await new Promise(resolve => setTimeout(resolve, waitTime))
      }
    }
  }

  // 所有重试都失败
  console.error('[翻译服务] 翻译失败（已用尽所有重试）:', lastError?.message)
  throw lastError
}

/**
 * 获取当前翻译配置
 * @returns {Object} 配置对象
 */
function getConfig() {
  return loadConfig()
}

module.exports = {
  translate,
  getConfig
}
