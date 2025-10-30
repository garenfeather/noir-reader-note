/**
 * 附注项组件
 * 显示、编辑和删除单个附注
 */

import { Button, Input } from 'antd'
import { DeleteOutlined, EditOutlined, CloseOutlined, CheckOutlined } from '@ant-design/icons'
import { useState } from 'react'
import { Note } from '../types/segment'

const { TextArea } = Input

interface Props {
  note: Note
  index: number
  onUpdate: (noteId: string, newText: string) => void
  onDelete: (noteId: string) => void
  allowEdit?: boolean
}

function NoteItem({ note, index, onUpdate, onDelete, allowEdit = true }: Props) {
  const [isEditing, setIsEditing] = useState(false)
  const [editText, setEditText] = useState(note.text)

  const handleSave = () => {
    if (editText.trim()) {
      onUpdate(note.id, editText.trim())
      setIsEditing(false)
    }
  }

  const handleCancel = () => {
    setEditText(note.text)
    setIsEditing(false)
  }

  return (
    <div className="p-3 bg-gray-50 rounded border border-gray-200">
      <div className="flex items-start gap-2">
        {isEditing ? (
          <div className="flex-1">
            <TextArea
              value={editText}
              onChange={(e) => setEditText(e.target.value)}
              autoSize={{ minRows: 1, maxRows: 5 }}
              className="mb-2"
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
          <>
            <div className="flex-1 text-base text-gray-800 leading-relaxed whitespace-pre-wrap">{note.text}</div>
            {allowEdit && (
              <div className="flex gap-1">
                <Button
                  type="text"
                  size="small"
                  icon={<EditOutlined />}
                  onClick={() => setIsEditing(true)}
                />
                <Button
                  type="text"
                  size="small"
                  danger
                  icon={<DeleteOutlined />}
                  onClick={() => onDelete(note.id)}
                />
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}

export default NoteItem
