export interface Category {
  id?: string;
  name: string;
  description: string;
  createdAt: Date;
  updatedAt: Date;
  parentId?: string; // ID dari kategori induk (opsional)
  userId?: string; // ID dari pengguna yang membuat kategori
}
