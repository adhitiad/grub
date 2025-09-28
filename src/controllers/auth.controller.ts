// src/api/auth/auth.controller.ts
import * as bcrypt from "bcryptjs";
import { Request, Response } from "express";
import * as jwt from "jsonwebtoken";
import { User } from "../models/user.model";
import { db } from "../utils/firebase";

const usersCollection = db.collection("users");

export const register = async (req: Request, res: Response) => {
  try {
    const { email, password, name, role } = req.body;

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

    const newUser: User = {
      email,
      password: hashedPassword,
      name,
      role,
      isActive: true,
      createdAt: new Date(),
    };

    const docRef = await usersCollection.add(newUser);

    // Jangan kirim balik password hash
    const { password: _, ...userWithoutPassword } = newUser;

    res.status(201).send({ id: docRef.id, ...userWithoutPassword });
  } catch (error: unknown) {
    console.error("Server error:", error);
    res
      .status(500)
      .send({ message: "Terjadi kesalahan di server" });
      .status(500)
      .send({ message: "Terjadi kesalahan di server", error: errorMessage });
  }
};

export const login = async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;

    const userSnapshot: any = await usersCollection
      .where("email", "==", email)
      .limit(1)
      .get();

    if (userSnapshot.isEmpty) {
      return res.status(401).send({ message: "Email atau password salah." });
    }

    const userData = userSnapshot.docs[0].data() as User;
    const userId = userSnapshot.docs[0].id;

    const isMatch = await bcrypt.compare(password, userData.password);

    if (!isMatch) {
      return res.status(401).send({ message: "Email atau password salah." });
    }

    // Buat Token JWT
    const token = jwt.sign(
      { id: userId, role: userData.role },
      process.env.JWT_SECRET as string,
      { expiresIn: "1d" } // Token berlaku 1 hari
    );

    res.status(200).send({
      token,
      user: {
        id: userId,
        name: userData.name,
        email: userData.email,
        role: userData.role,
      },
    });
  } catch (error: any) { 
    console.error("Login error:", error);
    res
      .status(500)
      .send({ message: "Terjadi kesalahan di server" , error: error.message });
  }
};
