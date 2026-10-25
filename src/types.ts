export type Campus = {
  id: string
  name: string
}

export type Category =
  | 'Electronics'
  | 'Books'
  | 'Furniture'
  | 'Fashion'
  | 'Food'
  | 'Services'

export type Condition = 'new' | 'like-new' | 'used'

export type Availability = 'available' | 'reserved' | 'sold'

export type Product = {
  id: string
  title: string
  price: number /* Nigerian naira */
  category: Category
  campus: string /* Campus.id */
  condition: Condition
  availability: Availability
  featured?: boolean
  description: string
  emoji: string /* placeholder image until real listings use uploaded photos */
  /** Vendor shop display name (sample data; real shops come with accounts later) */
  vendor: string
  /** Verified vendor flag — shown as a green starburst badge on cards */
  verified?: boolean
}

export const CATEGORIES: Category[] = [
  'Electronics',
  'Books',
  'Furniture',
  'Fashion',
  'Food',
  'Services',
]
