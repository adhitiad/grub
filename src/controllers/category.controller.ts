import { Request, Response } from "express";
import { Category } from "../models/category";
import { db } from "../utils/firebase";

const categoriesCollection = db.collection("categories");

// Membuat kategori baru
export const createCategory = async (req: Request, res: Response) => {
  try {
    // Dapatkan data user yang login dari middleware 'protect'
    const loggedInUser = req.user;
    if (!loggedInUser) {
      return res.status(401).send({ message: "Akses ditolak." });
    }

    // Validasi input
    const { name, description } = req.body;
    if (!name) {
      return res.status(400).send({ message: "Nama kategori wajib diisi." });
    }
    const newCategory: Omit<Category, "id"> = {
      name,
      description,
      createdAt: new Date(),
      updatedAt: new Date(),
      userId: loggedInUser.id,
    };
    const docRef = await categoriesCollection.add(newCategory);
    res.status(201).send({ id: docRef.id, ...newCategory });
  } catch (error) {
    res.status(500).send({ message: "Error server", error });
  }
};

// Mendapatkan semua kategori
export const getAllCategories = async (_req: Request, res: Response) => {
  try {
    const snapshot = await categoriesCollection.orderBy("name").get();
    const categories: Category[] = snapshot.docs.map(
      (doc) => ({ id: doc.id, ...doc.data() } as Category)
    );
    res.status(200).send(categories);
  } catch (error) {
    res.status(500).send({ message: "Error server", error });
  }
};

// Search categories
export const searchCategories = async (req: Request, res: Response) => {
  try {
    const { q, userId, limit = 10, offset = 0 } = req.query;

    let query: FirebaseFirestore.Query = categoriesCollection;

    // Filter by userId if specified (for admin to see categories by specific user)
    if (userId && typeof userId === "string") {
      query = query.where("userId", "==", userId);
    }

    // Apply pagination
    query = query.limit(parseInt(limit as string));
    if (parseInt(offset as string) > 0) {
      query = query.offset(parseInt(offset as string));
    }

    const snapshot = await query.get();
    let categories: Category[] = snapshot.docs.map(
      (doc) => ({ id: doc.id, ...doc.data() } as Category)
    );

    // Client-side search for name and description
    if (q && typeof q === "string") {
      const searchTerm = q.toLowerCase();
      categories = categories.filter(
        (category: Category) =>
          category.name?.toLowerCase().includes(searchTerm) ||
          category.description?.toLowerCase().includes(searchTerm)
      );
    }

    res.status(200).json({
      success: true,
      message: "Pencarian kategori berhasil",
      data: categories,
      pagination: {
        limit: parseInt(limit as string),
        offset: parseInt(offset as string),
        total: categories.length,
      },
      filters: {
        searchTerm: q,
        userId,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Search categories error:", error);
    res.status(500).json({
      success: false,
      message: "Error server saat mencari kategori",
      error: error instanceof Error ? error.message : "Unknown error",
      timestamp: new Date().toISOString(),
    });
  }
};

// Fungsi untuk mendapatkan kategori berdasarkan ID
export const getCategoryById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const categoryDoc = await categoriesCollection.doc(id).get();
    if (!categoryDoc.exists) {
      return res.status(404).send({ message: "Kategori tidak ditemukan." });
    }
    res.status(200).send({ id: categoryDoc.id, ...categoryDoc.data() });
  } catch (error) {
    res.status(500).send({ message: "Error server", error });
  }
};

export const updateCategory = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { name, description } = req.body;
    const categoryRef = categoriesCollection.doc(id);
    const categoryDoc = await categoryRef.get();
    if (!categoryDoc.exists) {
      return res.status(404).send({ message: "Kategori tidak ditemukan." });
    }
    await categoryRef.update({ name, description, updatedAt: new Date() });
    res.status(200).send({ message: "Kategori berhasil diperbarui." });
  } catch (error) {
    res.status(500).send({ message: "Error server", error });
  }
};

export const deleteCategory = async (req: Request, res: Response) => {
  try {
    const loggedInUser = req.user;
    if (!loggedInUser) {
      return res.status(401).send({ message: "Akses ditolak." });
    }

    const { id } = req.params;
    const categoryDoc = await categoriesCollection.doc(id).get();
    if (!categoryDoc.exists) {
      return res.status(404).send({ message: "Kategori tidak ditemukan." });
    }
    const category = categoryDoc.data() as Category;
    if (category.userId !== loggedInUser.id) {
      return res.status(403).send({ message: "Akses ditolak." });
    }

    await categoriesCollection.doc(id).delete();
    res.status(200).send({ message: "Kategori berhasil dihapus." });
  } catch (error) {
    res.status(500).send({ message: "Error server", error });
  }
};

// (Anda bisa menambahkan getCategoryById, updateCategory, deleteCategory dengan pola yang sama)
