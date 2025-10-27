/**
 * 译文区域组件
 * 显示和编辑译文内容
 */

import { Input } from 'antd'

const { TextArea } = Input

interface Props {
  translatedText: string | null
  onChange: (value: string) => void
}

function TranslationSection({ translatedText, onChange }: Props) {
  // 如果没有译文，不显示此区域
  if (!translatedText) {
    return null
  }

  return (
    <div className="mb-4">
      <h4 className="text-sm font-semibold text-gray-700 mb-2">译文</h4>
      <TextArea
        value={translatedText}
        onChange={(e) => onChange(e.target.value)}
        autoSize={{ minRows: 3, maxRows: 10 }}
        className="text-base"
        placeholder="译文内容"
      />
    </div>
  )
}

export default TranslationSection
