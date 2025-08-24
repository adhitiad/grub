interface OrderItem {
  productId: string;
  productName: string;
  sku?: string;
  quantity: number;
  priceAtTimeOfOrder: number; // Harga saat order dibuat
}

export interface Order {
  id?: string;
  userId: string; // ID user yang memesan
  userName: string;
  items: OrderItem[];
  totalAmount: number;
  shippingAddress?: string; // Bisa juga objek alamat yang lebih kompleks
  status:
    | "pending_payment"
    | "processing"
    | "shipped"
    | "completed"
    | "cancelled"
    | "failed";

  // Detail Pembayaran
  paymentDetails?: {
    method: string; // misal: 'flip'
    flipBillId?: string;
    paymentUrl?: string;
  };

  createdAt: Date;
  updatedAt: Date;
}
