// src/api/stores/store.controller.ts
import { Request, Response } from "express";
import { Store } from "../models/store";
import { User } from "../models/user.model"; // Impor model User
import { db } from "../utils/firebase";

const storesCollection = db.collection("stores");
const usersCollection = db.collection("users");

// 1. MODIFIKASI FUNGSI createStore
export const createStore = async (req: Request, res: Response) => {
  try {
    // Dapatkan data user yang login dari middleware 'protect'
    const loggedInUser = req.user;
    if (!loggedInUser) {
      return res.status(401).send({ message: "Akses ditolak." });
    }

    const { name, address, contactPerson, phone, latitude, longitude } =
      req.body;

    // Ambil detail nama user dari database
    const userDoc = await usersCollection.doc(loggedInUser.id).get();
    const userData = userDoc.data() as User;

    // Tentukan status awal berdasarkan role user
    let initialStatus: "pending" | "approved" = "pending";
    if (loggedInUser.role === "admin" || loggedInUser.role === "owner") {
      initialStatus = "approved";
    }

    const newStore: Omit<Store, "id"> = {
      name,
      address,
      contactPerson,
      phone,
      location: {
        latitude: parseFloat(latitude),
        longitude: parseFloat(longitude),
      },
      status: initialStatus, // Status dinamis
      submittedBy: {
        id: loggedInUser.id,
        name: userData.name || "N/A",
      },
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const docRef = await storesCollection.add(newStore);
    res.status(201).send({ id: docRef.id, ...newStore });
  } catch (error) {
    res.status(500).send({ message: "Terjadi kesalahan di server", error });
  }
};

// 2. MODIFIKASI FUNGSI getAllStores
export const getAllStores = async (req: Request, res: Response) => {
  try {
    const loggedInUser = req.user;
    const statusFilter = req.query.status as string; // Filter berdasarkan query, misal: /api/stores?status=pending

    // Bangun query ke Firestore
    let query: FirebaseFirestore.Query = storesCollection;

    if (loggedInUser?.role === "sales") {
      // Sales hanya bisa melihat toko yang sudah 'approved'
      query = query.where("status", "==", "approved");
    } else if (
      loggedInUser?.role === "admin" ||
      loggedInUser?.role === "owner"
    ) {
      // Admin/Owner bisa filter berdasarkan status
      if (
        statusFilter &&
        ["pending", "approved", "rejected"].includes(statusFilter)
      ) {
        query = query.where("status", "==", statusFilter);
      }
      // Jika tidak ada filter, mereka melihat semua.
    }

    const snapshot = await query.get();
    const stores: Store[] = snapshot.docs.map(
      (doc) => ({ id: doc.id, ...doc.data() } as Store)
    );
    res.status(200).send(stores);
  } catch (error) {
    res.status(500).send({ message: "Terjadi kesalahan di server", error });
  }
};

// Search stores
export const searchStores = async (req: Request, res: Response) => {
  try {
    const {
      q,
      status,
      latitude,
      longitude,
      radius,
      limit = 15,
      offset = 0,
    } = req.query;
    const loggedInUser = req.user;

    let query: FirebaseFirestore.Query = storesCollection;

    // Apply role-based filtering first
    if (loggedInUser?.role === "sales") {
      query = query.where("status", "==", "approved");
    } else if (
      loggedInUser?.role === "admin" ||
      loggedInUser?.role === "owner"
    ) {
      // Admin/Owner can filter by status
      if (status && typeof status === "string") {
        if (["pending", "approved", "rejected"].includes(status)) {
          query = query.where("status", "==", status);
        }
      }
    }

    // Apply pagination
    query = query.limit(parseInt(limit as string));
    if (parseInt(offset as string) > 0) {
      query = query.offset(parseInt(offset as string));
    }

    const snapshot = await query.get();
    let stores: Store[] = snapshot.docs.map(
      (doc) => ({ id: doc.id, ...doc.data() } as Store)
    );

    // Client-side search for name and address
    if (q && typeof q === "string") {
      const searchTerm = q.toLowerCase();
      stores = stores.filter(
        (store: Store) =>
          store.name?.toLowerCase().includes(searchTerm) ||
          store.address?.toLowerCase().includes(searchTerm)
      );
    }

    // Location-based filtering (simple distance calculation)
    if (latitude && longitude && radius) {
      const centerLat = parseFloat(latitude as string);
      const centerLng = parseFloat(longitude as string);
      const searchRadius = parseFloat(radius as string); // in kilometers

      stores = stores.filter((store: any) => {
        if (!store.latitude || !store.longitude) return false;

        const distance = calculateDistance(
          centerLat,
          centerLng,
          store.latitude,
          store.longitude
        );

        return distance <= searchRadius;
      });
    }

    res.status(200).json({
      success: true,
      message: "Pencarian toko berhasil",
      data: stores,
      pagination: {
        limit: parseInt(limit as string),
        offset: parseInt(offset as string),
        total: stores.length,
      },
      filters: {
        searchTerm: q,
        status,
        location:
          latitude && longitude
            ? {
                latitude: parseFloat(latitude as string),
                longitude: parseFloat(longitude as string),
                radius: radius ? parseFloat(radius as string) : undefined,
              }
            : undefined,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Search stores error:", error);
    res.status(500).json({
      success: false,
      message: "Error server saat mencari toko",
      error: error instanceof Error ? error.message : "Unknown error",
      timestamp: new Date().toISOString(),
    });
  }
};

// Helper function to calculate distance between two coordinates
function calculateDistance(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const R = 6371; // Earth's radius in kilometers
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// 3. TAMBAHKAN FUNGSI BARU untuk approval
export const updateStoreStatus = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { status } = req.body; // status harus 'approved' atau 'rejected'
    const loggedInUser = req.user!;

    if (!status || !["approved", "rejected"].includes(status)) {
      return res.status(400).send({
        message: "Status tidak valid. Gunakan 'approved' atau 'rejected'.",
      });
    }

    const storeRef = storesCollection.doc(id);
    const storeDoc = await storeRef.get();

    if (!storeDoc.exists) {
      return res.status(404).send({ message: "Toko tidak ditemukan." });
    }

    const userDoc = await usersCollection.doc(loggedInUser.id).get();
    const userData = userDoc.data() as User;

    // Data yang akan diupdate
    const updateData = {
      status,
      approvedBy: {
        id: loggedInUser.id,
        name: userData.name || "N/A",
      },
      approvedAt: new Date(),
      updatedAt: new Date(),
    };

    await storeRef.update(updateData);

    res.status(200).send({ message: `Toko berhasil di-${status}.` });
  } catch (error) {
    res.status(500).send({ message: "Terjadi kesalahan di server", error });
  }
};

// Fungsi getStoreById tidak perlu diubah
export const getStoreById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const storeDoc = await storesCollection.doc(id).get();
    if (!storeDoc.exists) {
      return res.status(404).send({ message: "Toko tidak ditemukan." });
    }
    res.status(200).send({ id: storeDoc.id, ...storeDoc.data() });
  } catch (error) {
    res.status(500).send({ message: "Terjadi kesalahan di server", error });
  }
};

// Fungsi updateStore tidak perlu diubah
export const updateStore = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const loggedInUser = req.user;
    if (!loggedInUser) {
      return res.status(401).send({ message: "Akses ditolak." });
    }
    if (loggedInUser.role !== "admin" && loggedInUser.role !== "owner") {
      return res.status(403).send({ message: "Akses ditolak." });
    }
    const { name, address, contactPerson, phone, latitude, longitude } =
      req.body;
    const storeRef = storesCollection.doc(id);
    const storeDoc = await storeRef.get();

    if (!storeDoc.exists) {
      return res.status(404).send({ message: "Toko tidak ditemukan." });
    }
    const updateData: Partial<Store> = {
      name,
      address,
      contactPerson,
      phone,
      location: {
        latitude: parseFloat(latitude),
        longitude: parseFloat(longitude),
      },
      updatedAt: new Date(),
    };
    await storeRef.update(updateData);
    res.status(200).send({ message: "Toko berhasil diperbarui." });
  } catch (error) {
    res.status(500).send({ message: "Terjadi kesalahan di server", error });
  }
};

// Fungsi deleteStore tidak perlu diubah
export const deleteStore = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const loggedInUser = req.user;
    if (!loggedInUser) {
      return res.status(401).send({ message: "Akses ditolak." });
    }
    if (loggedInUser.role !== "admin" && loggedInUser.role !== "owner") {
      return res.status(403).send({ message: "Akses ditolak." });
    }
    await storesCollection.doc(id).delete();
    res.status(200).send({ message: "Toko berhasil dihapus." });
  } catch (error) {
    res.status(500).send({ message: "Terjadi kesalahan di server", error });
  }
};
