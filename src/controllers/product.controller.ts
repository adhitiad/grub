import { Request, Response } from "express";
import { Category } from "../models/category"; // Impor model Kategori
import { Product } from "../models/product";
import { db } from "../utils/firebase";

const productsCollection = db.collection("products");
const categoriesCollection = db.collection("categories");

// Membuat produk baru
export const createProduct = async (req: Request, res: Response) => {
  try {
    const {
      name,
      sku,
      stock,
      image,
      status,
      description,
      categoryId,
      purchasePrice,
      sellingPrice,
    } = req.body;
    const loggedInUser = req.user;
    if (!loggedInUser) {
      return res.status(401).send({ message: "Akses ditolak." });
    }

    // 1. Validasi Input
    if (!name || !stock || !categoryId || !sellingPrice) {
      return res
        .status(400)
        .send({ message: "Nama, SKU, Kategori, dan Harga Jual wajib diisi." });
    }

    // 2. Cek apakah kategori ada
    const categoryDoc = await categoriesCollection.doc(categoryId).get();
    if (!categoryDoc.exists) {
      return res.status(404).send({ message: "Kategori tidak ditemukan." });
    }
    const categoryData = categoryDoc.data() as Category;

    // 3. Susun data produk baru dengan data kategori
    const newProduct: Omit<Product, "id"> = {
      name,
      sku,
      stock: Number(stock),
      image,
      status,
      description,
      user: {
        id: loggedInUser.id,
        role: loggedInUser.role,
      },

      category: {
        id: categoryDoc.id,
        name: categoryData.name, // Ambil nama dari dokumen kategori
      },
      purchasePrice: Number(purchasePrice) || 0,
      sellingPrice: Number(sellingPrice),
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    // 4. Simpan produk baru
    const docRef = await productsCollection.add(newProduct);
    res.status(201).send({ id: docRef.id, ...newProduct });
  } catch (error) {
    res.status(500).send({ message: "Error server", error });
  }
};

// Mendapatkan semua produk
export const getAllProducts = async (_req: Request, res: Response) => {
  try {
    const snapshot = await productsCollection.orderBy("name").get();
    const products: Product[] = snapshot.docs.map(
      (doc) => ({ id: doc.id, ...doc.data() } as Product)
    );
    res.status(200).send(products);
  } catch (error) {
    res.status(500).send({ message: "Error server", error });
  }
};

// Search products
export const searchProducts = async (req: Request, res: Response) => {
  try {
    const {
      q,
      categoryId,
      status,
      minPrice,
      maxPrice,
      inStock,
      limit = 20,
      offset = 0,
    } = req.query;

    let query: FirebaseFirestore.Query = productsCollection;

    // Filter by category if specified
    if (categoryId && typeof categoryId === "string") {
      query = query.where("categoryId", "==", categoryId);
    }

    // Filter by status if specified
    if (status && typeof status === "string") {
      if (["active", "inactive"].includes(status)) {
        query = query.where("status", "==", status);
      }
    }

    // Filter by stock availability
    if (inStock === "true") {
      query = query.where("stock", ">", 0);
    } else if (inStock === "false") {
      query = query.where("stock", "==", 0);
    }

    // Apply pagination
    query = query.limit(parseInt(limit as string));
    if (parseInt(offset as string) > 0) {
      query = query.offset(parseInt(offset as string));
    }

    const snapshot = await query.get();
    let products: Product[] = snapshot.docs.map(
      (doc) => ({ id: doc.id, ...doc.data() } as Product)
    );

    // Client-side filtering for text search and price range
    if (q && typeof q === "string") {
      const searchTerm = q.toLowerCase();
      products = products.filter(
        (product: Product) =>
          product.name?.toLowerCase().includes(searchTerm) ||
          product.description?.toLowerCase().includes(searchTerm) ||
          product.sku?.toLowerCase().includes(searchTerm)
      );
    }

    // Filter by price range
    if (minPrice || maxPrice) {
      products = products.filter((product: Product) => {
        const price = product.sellingPrice || 0;
        const min = minPrice ? parseFloat(minPrice as string) : 0;
        const max = maxPrice ? parseFloat(maxPrice as string) : Infinity;
        return price >= min && price <= max;
      });
    }

    res.status(200).json({
      success: true,
      message: "Pencarian produk berhasil",
      data: products,
      pagination: {
        limit: parseInt(limit as string),
        offset: parseInt(offset as string),
        total: products.length,
      },
      filters: {
        searchTerm: q,
        categoryId,
        status,
        minPrice,
        maxPrice,
        inStock,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Search products error:", error);
    res.status(500).json({
      success: false,
      message: "Error server saat mencari produk",
      error: error instanceof Error ? error.message : "Unknown error",
      timestamp: new Date().toISOString(),
    });
  }
};

// Fungsi untuk mendapatkan produk berdasarkan kategori
export const getProductsByCategoryId = async (req: Request, res: Response) => {
  try {
    const { categoryId } = req.params;
    const snapshot = await productsCollection
      .where("category.id", "==", categoryId)
      .get();

    if (snapshot.empty) {
      return res.status(200).send([]); // Kirim array kosong jika tidak ada produk
    }

    const products: Product[] = snapshot.docs.map(
      (doc) => ({ id: doc.id, ...doc.data() } as Product)
    );
    res.status(200).send(products);
  } catch (error) {
    res.status(500).send({ message: "Error server", error });
  }
};

// Fungsi untuk memperbarui produk
export const updateProduct = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { name, stock, status, categoryId, purchasePrice, sellingPrice } =
      req.body;
    const loggedInUser = req.user;
    if (!loggedInUser) {
      return res.status(401).send({ message: "Akses ditolak." });
    }

    // 1. Validasi Input
    if (!name || !stock || !categoryId || !sellingPrice) {
      return res
        .status(400)
        .send({ message: "Nama, Stok, Kategori, dan Harga Jual wajib diisi." });
    }

    // 2. Cek apakah produk ada dan milik user yang login
    const productDoc = await productsCollection.doc(id).get();
    if (!productDoc.exists) {
      return res.status(404).send({ message: "Produk tidak ditemukan." });
    }
    const product = productDoc.data() as Product;
    if (product.user.id !== loggedInUser.id) {
      return res.status(403).send({ message: "Akses ditolak." });
    }

    // 3. Cek apakah kategori ada
    const categoryDoc = await categoriesCollection.doc(categoryId).get();
    if (!categoryDoc.exists) {
      return res.status(404).send({ message: "Kategori tidak ditemukan." });
    }
    const categoryData = categoryDoc.data() as Category;

    // 4. Perbarui produk
    const updateData: Partial<Product> = {
      name,
      stock: Number(stock),
      status,
      category: {
        id: categoryDoc.id,
        name: categoryData.name, // Ambil nama dari dokumen kategori
      },
      purchasePrice: Number(purchasePrice) || 0,
      sellingPrice: Number(sellingPrice),
      updatedAt: new Date(),
    };

    await productsCollection.doc(id).update(updateData);
    res.status(200).send({ message: "Produk berhasil diperbarui." });
  } catch (error) {
    res.status(500).send({ message: "Error server", error });
  }
};

// Fungsi untuk menghapus produk
export const deleteProduct = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const loggedInUser = req.user;
    if (!loggedInUser) {
      return res.status(401).send({ message: "Akses ditolak." });
    }

    // 1. Cek apakah produk ada dan milik user yang login
    const productDoc = await productsCollection.doc(id).get();
    if (!productDoc.exists) {
      return res.status(404).send({ message: "Produk tidak ditemukan." });
    }
    const product = productDoc.data() as Product;
    if (product.user.id !== loggedInUser.id) {
      return res.status(403).send({ message: "Akses ditolak." });
    }

    // 2. Hapus produk
    await productsCollection.doc(id).delete();
    res.status(200).send({ message: "Produk berhasil dihapus." });
  } catch (error) {
    res.status(500).send({ message: "Error server", error });
  }
};
