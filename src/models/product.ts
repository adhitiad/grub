export interface Product {
  id?: string;
  name: string;
  sku?: string; // Stock Keeping Unit, kode unik produk
  description: string;
  stock: number; // Stok produk
  status: "active" | "inactive"; // Status produk
  image?: string; // URL gambar produk

  // --- INFORMASI RELASI DENGAN KATEGORI ---
  category: {
    id: string;
    name: string;
  };

  purchasePrice: number; // Harga beli
  sellingPrice: number; // Harga jual
  // --- AKHIR INFORMASI RELASI ---

  // --- INFORMASI RELASI DENGAN USER ---

  user: {
    id: string;
    role: string;
  };

  // --- AKHIR INFORMASI RELASI ---
  createdAt: Date;
  updatedAt: Date;
}
