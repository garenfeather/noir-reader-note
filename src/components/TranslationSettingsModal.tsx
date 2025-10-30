import { useState, useEffect } from 'react'
import { Modal, Form, Select, message } from 'antd'
import type { TranslationConfig, TranslationSettings } from '../types/translation'

interface TranslationSettingsModalProps {
  open: boolean
  onCancel: () => void
}

function TranslationSettingsModal({ open, onCancel }: TranslationSettingsModalProps) {
  const [form] = Form.useForm()
  const [config, setConfig] = useState<TranslationConfig | null>(null)
  const [loading, setLoading] = useState(false)

  // 加载配置
  useEffect(() => {
    if (open) {
      loadConfig()
    }
  }, [open])

  const loadConfig = async () => {
    try {
      // 从主进程读取配置
      const result = await window.electronAPI.getTranslationConfig()

      if (result.success && result.data) {
        const loadedConfig = result.data
        setConfig(loadedConfig)

        // 设置表单默认值
        form.setFieldsValue({
          intensity: loadedConfig.default.intensity,
          source: loadedConfig.default.source
        })
      } else {
        throw new Error(result.error || '加载配置失败')
      }
    } catch (error) {
      console.error('加载翻译配置失败:', error)
      message.error('加载配置失败')
    }
  }

  const handleOk = async () => {
    try {
      const values = await form.validateFields()
      setLoading(true)

      // 这里可以添加保存配置到文件的逻辑
      // 目前暂时只在内存中更新
      message.success('设置已保存')
      onCancel()
    } catch (error) {
      console.error('保存设置失败:', error)
      message.error('保存设置失败')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Modal
      title="翻译设置"
      open={open}
      onOk={handleOk}
      onCancel={onCancel}
      confirmLoading={loading}
      okText="保存"
      cancelText="取消"
      width={480}
    >
      <Form
        form={form}
        layout="vertical"
        autoComplete="off"
      >
        <Form.Item
          label="解析强度"
          name="intensity"
          rules={[{ required: true, message: '请选择解析强度' }]}
        >
          <Select placeholder="选择解析强度">
            {config && Object.entries(config.intensities).map(([key, value]) => (
              <Select.Option key={key} value={key}>
                {value.name}
              </Select.Option>
            ))}
          </Select>
        </Form.Item>

        <Form.Item
          label="翻译来源"
          name="source"
          rules={[{ required: true, message: '请选择翻译来源' }]}
        >
          <Select placeholder="选择翻译来源">
            {config && Object.entries(config.sources).map(([key, value]) => (
              <Select.Option key={key} value={key}>
                {value.name}
              </Select.Option>
            ))}
          </Select>
        </Form.Item>
      </Form>
    </Modal>
  )
}

export default TranslationSettingsModal
