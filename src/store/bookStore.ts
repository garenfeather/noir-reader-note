import { create } from 'zustand'
import { Book, Rendition } from 'epubjs'

interface BookState {
  book: Book | null
  rendition: Rendition | null
  currentLocation: number  // 当前位置（整本书）
  totalLocations: number   // 总位置数（整本书）
  percentage: number       // 阅读百分比
  fileName: string
  metadataTitle: string
  setBook: (book: Book | null) => void
  setRendition: (rendition: Rendition | null) => void
  setCurrentLocation: (current: number) => void
  setTotalLocations: (total: number) => void
  setPercentage: (percentage: number) => void
  setFileName: (fileName: string) => void
  setMetadataTitle: (title: string) => void
}

export const useBookStore = create<BookState>((set) => ({
  book: null,
  rendition: null,
  currentLocation: 0,
  totalLocations: 0,
  percentage: 0,
  fileName: '',
  metadataTitle: '',
  setBook: (book) => set({ book }),
  setRendition: (rendition) => set({ rendition }),
  setCurrentLocation: (current) => set({ currentLocation: current }),
  setTotalLocations: (total) => set({ totalLocations: total }),
  setPercentage: (percentage) => set({ percentage }),
  setFileName: (fileName) => set({ fileName }),
  setMetadataTitle: (metadataTitle) => set({ metadataTitle }),
}))
