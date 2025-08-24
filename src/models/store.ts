// src/api/stores/store.model.ts

export interface Store {
  id?: string;
  name: string;
  address: string;
  contactPerson: string;
  phone: string;
  location: {
    latitude: number;
    longitude: number;
  };

  // --- FIELD BARU & MODIFIKASI ---
  status: "pending" | "approved" | "rejected"; // Status persetujuan toko
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
  // --- AKHIR PERUBAHAN ---

  createdAt: Date;
  updatedAt: Date;
}
