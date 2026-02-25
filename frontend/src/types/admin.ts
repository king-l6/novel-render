export interface AdminUser {
  id: number
  username: string
  is_admin: boolean
  created_at: number
}

export interface AdminBook {
  id: number
  title: string
  file_name: string
  size: number
  created_at: number
  percent?: number
  progress_updated?: number
}
