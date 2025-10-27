/**
 * 译文区域组件
 * 显示和编辑译文内容
 */

import { Input, Button } from 'antd'
import { EditOutlined, CheckOutlined, CloseOutlined } from '@ant-design/icons'
import { useState, useEffect } from 'react'

const { TextArea } = Input

interface Props {
  translatedText: string | null
  onChange: (value: string) => void
  allowEdit?: boolean
}

function TranslationSection({ translatedText, onChange, allowEdit = true }: Props) {
  const [isEditing, setIsEditing] = useState(false)
  const [editText, setEditText] = useState(translatedText || '')

  // 同步外部译文变化
  useEffect(() => {
    setEditText(translatedText || '')
  }, [translatedText])

  // 如果没有译文，不显示此区域
  if (!translatedText) {
    return null
  }

  const handleSave = () => {
    onChange(editText)
    setIsEditing(false)
  }

  const handleCancel = () => {
    setEditText(translatedText)
    setIsEditing(false)
  }

  return (
    <div className="mb-4">
      <div className="flex items-center gap-2 mb-2">
        <h4 className="text-sm font-semibold text-gray-700">译文</h4>
        {allowEdit && !isEditing && (
          <Button
            type="text"
            size="small"
            icon={<EditOutlined />}
            onClick={() => setIsEditing(true)}
          />
        )}
      </div>
      {isEditing ? (
        <div>
          <TextArea
            value={editText}
            onChange={(e) => setEditText(e.target.value)}
            autoSize={{ minRows: 3, maxRows: 10 }}
            className="text-base mb-2"
            placeholder="译文内容"
          />
          <div className="flex gap-2">
            <Button
              type="primary"
              size="small"
              icon={<CheckOutlined />}
              onClick={handleSave}
            />
            <Button
              size="small"
              icon={<CloseOutlined />}
              onClick={handleCancel}
            />
          </div>
        </div>
      ) : (
        <div className="text-base text-gray-800 leading-relaxed whitespace-pre-wrap p-3 bg-gray-50 rounded border border-gray-200">
          {translatedText}
        </div>
      )}
    </div>
  )
}

export default TranslationSection
