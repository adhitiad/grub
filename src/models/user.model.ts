// src/api/auth/user.model.ts
export interface User {
  id?: string; // ID dari Firestore
  email: string;
  password: string; // Hash password, bukan password asli
  name: string;
  phoneNumber?: string;
  address?: string;
  image?: string;
  isActive: boolean;
  role: "customer" | "staff" | "kasir" | "sales" | "admin" | "owner";
  createdAt: Date;
}
