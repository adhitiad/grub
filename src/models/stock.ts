// Model untuk jumlah stok saat ini
export interface StockInventory {
  id?: string; // ID unik (bisa berupa productId_warehouseId)
  productId: string;
  productName: string; // denormalisasi
  sku?: string; // denormalisasi
  warehouseId: string;
  warehouseName: string; // denormalisasi
  quantity: number;
  updatedAt: Date;
  userId: string; // Siapa yang melakukan perubahan
  createdAt: Date;

  status?: "pending" | "approved" | "rejected"; // Status persetujuan toko
  submittedBy: {
    // Siapa yang mengajukan
    id: string;
    name: string;
  };
  approvedBy?: {
    // Siapa yang menyetujui (opsional)
    id: string;
    name: string;
  };
  approvedAt?: Date; // Kapan disetujui (opsional)
}

// Model untuk riwayat pergerakan stok
export interface StockMovement {
  id?: string;
  productId: string;
  warehouseId: string;
  type: "initial" | "purchase" | "sale" | "transfer" | "adjustment";
  quantityChange: number; // Bisa positif (penambahan) atau negatif (pengurangan) angka hanya nilai positif
  notes?: string;
  relatedOrderId?: string; // ID order jika terkait penjualan
  userId: string; // Siapa yang melakukan perubahan
  createdAt: Date;
  updatedAt: Date;

  status?: "pending" | "approved" | "rejected"; // Status persetujuan toko
  submittedBy: {
    // Siapa yang mengajukan
    id: string;
    name: string;
  };
  approvedBy?: {
    // Siapa yang menyetujui (opsional)
    id: string;
    name: string;
  };
  approvedAt?: Date; // Kapan disetujui (opsional)
}
