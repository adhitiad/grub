import bcrypt from "bcryptjs";
import { Request, Response } from "express";
import { User } from "../models/user.model";
import { db } from "../utils/firebase";

const usersCollection = db.collection("users");

// [UNTUK ADMIN] Membuat user baru
export const createUser = async (req: Request, res: Response) => {
  try {
    const { email, password, name, role, phoneNumber, address, image } =
      req.body;
    const loggedInUser = req.user;
    if (!loggedInUser) {
      return res.status(401).send({ message: "Akses ditolak." });
    }
    if (loggedInUser.role !== "admin") {
      return res.status(403).send({ message: "Akses ditolak." });
    }

    // Validasi input
    if (!email || !password || !name || !role) {
      return res.status(400).send({ message: "Semua field wajib diisi." });
    }

    // Cek apakah email sudah ada
    const userExists: any = await usersCollection
      .where("email", "==", email)
      .get();
    if (!userExists.isEmpty) {
      return res.status(400).send({ message: "Email sudah terdaftar." });
    }

    // Enkripsi password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const newUser: Omit<User, "id"> = {
      email,
      password: hashedPassword,
      name,
      role,
      phoneNumber,
      isActive: true,
      address,
      image,
      createdAt: new Date(),
    };

    const docRef = await usersCollection.add(newUser);

    // Jangan kirim balik password hash
    const { password: _, ...userWithoutPassword } = newUser;

    res.status(201).send({ id: docRef.id, ...userWithoutPassword });
  } catch (error) {
    res.status(500).send({ message: "Terjadi kesalahan di server", error });
  }
};

// [UNTUK ADMIN] Mendapatkan semua pengguna
export const getAllUsers = async (_req: Request, res: Response) => {
  try {
    const snapshot = await usersCollection.get();
    const users = snapshot.docs.map((doc) => {
      const { password, ...data } = doc.data(); // Jangan kirim password hash

      return { id: doc.id, ...data };
    });
    res.status(200).send(users);
  } catch (error) {
    res.status(500).send({ message: "Error server", error });
  }
};

// [UNTUK ADMIN] Search users
export const searchUsers = async (req: Request, res: Response) => {
  try {
    const { q, role, isActive, limit = 10, offset = 0 } = req.query;
    const loggedInUser = req.user;

    if (
      !loggedInUser ||
      (loggedInUser.role !== "admin" && loggedInUser.role !== "owner")
    ) {
      return res.status(403).json({
        success: false,
        message:
          "Akses ditolak. Hanya admin dan owner yang dapat mencari user.",
        timestamp: new Date().toISOString(),
      });
    }

    let query: FirebaseFirestore.Query = usersCollection;

    // Filter by role if specified
    if (role && typeof role === "string") {
      const validRoles = [
        "customer",
        "staff",
        "kasir",
        "sales",
        "admin",
        "owner",
      ];
      if (validRoles.includes(role)) {
        query = query.where("role", "==", role);
      }
    }

    // Filter by active status if specified
    if (isActive !== undefined) {
      const activeStatus = isActive === "true";
      query = query.where("isActive", "==", activeStatus);
    }

    // Apply pagination
    query = query.limit(parseInt(limit as string));
    if (parseInt(offset as string) > 0) {
      query = query.offset(parseInt(offset as string));
    }

    const snapshot = await query.get();
    let users = snapshot.docs.map((doc) => {
      const { password, ...data } = doc.data();
      return { id: doc.id, ...data };
    });

    // Client-side search for name and email (Firestore doesn't support full-text search)
    if (q && typeof q === "string") {
      const searchTerm = q.toLowerCase();
      users = users.filter(
        (user: any) =>
          user.name?.toLowerCase().includes(searchTerm) ||
          user.email?.toLowerCase().includes(searchTerm) ||
          user.phoneNumber?.includes(searchTerm)
      );
    }

    res.status(200).json({
      success: true,
      message: "Pencarian user berhasil",
      data: users,
      pagination: {
        limit: parseInt(limit as string),
        offset: parseInt(offset as string),
        total: users.length,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Search users error:", error);
    res.status(500).json({
      success: false,
      message: "Error server saat mencari user",
      error: error instanceof Error ? error.message : "Unknown error",
      timestamp: new Date().toISOString(),
    });
  }
};

// [UNTUK ADMIN] Mendapatkan user by ID
export const getUserById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const doc = await usersCollection.doc(id).get();
    if (!doc.exists) {
      return res.status(404).send({ message: "User tidak ditemukan." });
    }
    const { password, ...data } = doc.data()!;
    res.status(200).send({ id: doc.id, ...data });
  } catch (error) {
    res.status(500).send({ message: "Error server", error });
  }
};

// [UNTUK USER] Mendapatkan profil diri sendiri
export const getMe = async (req: Request, res: Response) => {
  try {
    // ID user didapat dari middleware 'protect' yang sudah memverifikasi token
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).send({ message: "Tidak terotentikasi." });
    }

    const doc = await usersCollection.doc(userId).get();
    if (!doc.exists) {
      return res.status(404).send({ message: "User tidak ditemukan." });
    }

    const { password, ...data } = doc.data()!;
    res.status(200).send({ id: doc.id, ...data });
  } catch (error) {
    res.status(500).send({ message: "Error server", error });
  }
};

// [UNTUK ADMIN] Memperbarui profil user
export const updateUser = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { name, role, phoneNumber, address, image, isActive, password } =
      req.body;
    const loggedInUser = req.user;

    if (!loggedInUser) {
      return res.status(401).json({
        success: false,
        message: "Akses ditolak.",
        timestamp: new Date().toISOString(),
      });
    }

    if (loggedInUser.role !== "admin") {
      return res.status(403).json({
        success: false,
        message: "Akses ditolak.",
        timestamp: new Date().toISOString(),
      });
    }

    // Check if user exists
    const userDoc = await usersCollection.doc(id).get();
    if (!userDoc.exists) {
      return res.status(404).json({
        success: false,
        message: "User tidak ditemukan.",
        timestamp: new Date().toISOString(),
      });
    }

    const updateData: any = {
      updatedAt: new Date(),
    };

    // Only update fields that are provided
    if (name !== undefined) updateData.name = name;
    if (role !== undefined) updateData.role = role;
    if (phoneNumber !== undefined) updateData.phoneNumber = phoneNumber;
    if (address !== undefined) updateData.address = address;
    if (image !== undefined) updateData.image = image;
    if (isActive !== undefined) updateData.isActive = isActive;

    // Hash password if provided
    if (password) {
      const salt = await bcrypt.genSalt(10);
      updateData.password = await bcrypt.hash(password, salt);
    }

    await usersCollection.doc(id).update(updateData);

    res.status(200).json({
      success: true,
      message: "User berhasil diperbarui.",
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Update user error:", error);
    res.status(500).json({
      success: false,
      message: "Error server",
      error: error instanceof Error ? error.message : "Unknown error",
      timestamp: new Date().toISOString(),
    });
  }
};

// [UNTUK ADMIN] Menghapus user
export const deleteUser = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const loggedInUser = req.user;
    if (!loggedInUser) {
      return res.status(401).send({ message: "Akses ditolak." });
    }
    if (loggedInUser.role !== "admin") {
      return res.status(403).send({ message: "Akses ditolak." });
    }
    await usersCollection.doc(id).delete();
    res.status(200).send({ message: "User berhasil dihapus." });
  } catch (error) {
    res.status(500).send({ message: "Error server", error });
  }
};
