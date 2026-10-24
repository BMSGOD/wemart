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

export type Product = {
  id: string
  title: string
  price: number /* Ghana cedis */
  category: Category
  campus: string /* Campus.id */
  description: string
  emoji: string /* placeholder image until real listings exist */
}

export const CATEGORIES: Category[] = [
  'Electronics',
  'Books',
  'Furniture',
  'Fashion',
  'Food',
  'Services',
]
