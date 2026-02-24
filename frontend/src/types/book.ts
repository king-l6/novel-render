export interface BookItem {
  id: number
  title: string
  file_name: string
  size: number
  created_at: number
  scroll_top?: number
  percent?: number
  page_index?: number
  progress_updated?: number
}

export interface BookDetail extends BookItem {
  content: string
  progress: { scroll_top: number; percent: number; page_index: number } | null
}
