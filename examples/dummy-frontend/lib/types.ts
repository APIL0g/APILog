export interface Product {
  id: string
  slug: string
  title: string
  description: string
  price: number
  originalPrice?: number
  discountPercent?: number
  currency: string
  images: string[]
  category: string
  tags: string[]
  rating: number
  reviews_count: number
  options: {
    size?: string[]
    color?: string[]
  }
  stock: number
  createdAt: string
  rocketDelivery?: boolean
  deliveryTime?: string
}

export interface Category {
  id: string
  name: string
  slug: string
  description: string
}

export interface CartItem {
  productId: string
  quantity: number
  selectedOptions: {
    size?: string
    color?: string
  }
}

export interface WishlistItem {
  productId: string
  addedAt: string
}

export interface CheckoutFormData {
  // Shipping info
  name: string
  phone: string
  email: string
  address: string
  addressDetail: string
  postalCode: string
  // Payment info (dummy)
  paymentMethod: string
  cardNumber?: string
  cardExpiry?: string
  cardCvc?: string
}
