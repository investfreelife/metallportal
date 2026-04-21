export interface Profile {
  id: string
  full_name: string | null
  company_name: string | null
  phone: string | null
  role: 'buyer' | 'supplier'
  avatar_url: string | null
  push_token: string | null
  created_at: string
  updated_at: string
}

export interface Product {
  id: string
  name: string
  article: string | null
  unit: string | null
  category_id: string | null
  seo_description: string | null
  created_at: string
}

export interface Category {
  id: string
  name: string
  slug: string
  parent_id: string | null
  level: number
}
