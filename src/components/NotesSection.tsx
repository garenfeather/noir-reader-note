/**
 * 附注区域组件
 * 管理附注列表的显示、添加、编辑和删除
 */

import { Button, Input } from 'antd'
import { PlusOutlined, CloseOutlined } from '@ant-design/icons'
import { useState } from 'react'
import { Note } from '../types/segment'
import NoteItem from './NoteItem'

const { TextArea } = Input

interface Props {
  notes: Note[] | null
  onNotesChange: (notes: Note[]) => void
  allowEdit?: boolean
}

function NotesSection({ notes, onNotesChange, allowEdit = true }: Props) {
  const [isAdding, setIsAdding] = useState(false)
  const [newNoteText, setNewNoteText] = useState('')

  // 如果没有附注且不在添加状态，不显示此区域
  if (!notes?.length && !isAdding) {
    return null
  }

  const handleAddNote = () => {
    if (newNoteText.trim()) {
      const newNote: Note = {
        id: `note-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        text: newNoteText.trim(),
        timestamp: Date.now()
      }

      onNotesChange([...(notes || []), newNote])
      setNewNoteText('')
      setIsAdding(false)
    }
  }

  const handleUpdateNote = (noteId: string, newText: string) => {
    if (!notes) return

    const updatedNotes = notes.map(note =>
      note.id === noteId ? { ...note, text: newText } : note
    )
    onNotesChange(updatedNotes)
  }

  const handleDeleteNote = (noteId: string) => {
    if (!notes) return

    const filteredNotes = notes.filter(note => note.id !== noteId)
    onNotesChange(filteredNotes)
  }

  return (
    <div className="mb-4">
      <div className="flex items-center gap-2 mb-2">
        <h4 className="text-sm font-semibold text-gray-700">
          附注 {notes && notes.length > 0 && `(${notes.length})`}
        </h4>
        {!isAdding && allowEdit && (
          <Button
            type="text"
            size="small"
            icon={<PlusOutlined />}
            onClick={() => setIsAdding(true)}
          />
        )}
      </div>

      <div className="space-y-2">
        {/* 现有附注列表 */}
        {notes?.map((note, index) => (
          <NoteItem
            key={note.id}
            note={note}
            index={index}
            onUpdate={handleUpdateNote}
            onDelete={handleDeleteNote}
            allowEdit={allowEdit}
          />
        ))}

        {/* 添加新附注 */}
        {isAdding && (
          <div className="p-3 bg-gray-50 rounded border border-gray-200">
            <TextArea
              value={newNoteText}
              onChange={(e) => setNewNoteText(e.target.value)}
              autoSize={{ minRows: 2, maxRows: 5 }}
              placeholder="输入附注内容..."
              className="mb-2"
            />
            <div className="flex gap-2">
              <Button
                type="primary"
                size="small"
                icon={<PlusOutlined />}
                onClick={handleAddNote}
                disabled={!newNoteText.trim()}
              />
              <Button
                size="small"
                icon={<CloseOutlined />}
                onClick={() => {
                  setNewNoteText('')
                  setIsAdding(false)
                }}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default NotesSection
