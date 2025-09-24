import { z } from "zod";

// User Schema
export const UserSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1, "Name is required"),
  email: z.string().email("Invalid email format"),
  password: z.string().min(6, "Password must be at least 6 characters"),
  role: z.enum(["customer", "staff", "cashier", "sales", "admin", "owner"]),
  isActive: z.boolean().default(true),
  createdAt: z.date().default(new Date()),
  updatedAt: z.date().default(new Date()),
});

export type User = z.infer<typeof UserSchema>;

// Store Schema
export const StoreSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1, "Store name is required"),
  address: z.string().min(1, "Address is required"),
  longitude: z.number().min(-180).max(180),
  latitude: z.number().min(-90).max(90),
  ownerId: z.string().min(1, "Owner ID is required"),
  status: z.enum(["pending", "approved", "rejected"]).default("pending"),
  createdAt: z.date().default(new Date()),
  updatedAt: z.date().default(new Date()),
});

export type Store = z.infer<typeof StoreSchema>;

// Product Schema
export const ProductSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1, "Product name is required"),
  category: z.object({
    id: z.string(),
    name: z.string(),
  }),
  price: z.number().min(0, "Price must be positive"),
  purchasePrice: z
    .number()
    .min(0, "Purchase price must be positive")
    .optional(),
  stock: z.number().min(0, "Stock must be positive"),
  description: z.string().optional(),
  imageUrl: z.string().optional(),
  isActive: z.boolean().default(true),
  createdAt: z.date().default(new Date()),
  updatedAt: z.date().default(new Date()),
});

export type Product = z.infer<typeof ProductSchema>;

// Order Schema
export const OrderSchema = z.object({
  id: z.string().optional(),
  userId: z.string().min(1, "User ID is required"),
  customerId: z.string().min(1, "Customer ID is required").optional(),
  items: z.array(
    z.object({
      productId: z.string().min(1, "Product ID is required"),
      productName: z.string(),
      quantity: z.number().min(1, "Quantity must be at least 1"),
      priceAtTimeOfOrder: z.number().min(0, "Price must be positive"),
    })
  ),
  totalAmount: z.number().min(0, "Total amount must be positive"),
  status: z
    .enum([
      "pending_payment",
      "processing",
      "shipped",
      "completed",
      "cancelled",
      "failed",
    ])
    .default("pending_payment"),
  paymentStatus: z
    .enum(["pending", "paid", "failed"])
    .default("pending")
    .optional(),
  paymentDetails: z
    .object({
      method: z.string(),
      flipBillId: z.string().optional(),
      paymentUrl: z.string().optional(),
    })
    .optional(),
  shippingAddress: z
    .object({
      street: z.string(),
      city: z.string(),
      postalCode: z.string(),
      phone: z.string(),
    })
    .optional(),
  notes: z.string().optional(),
  statusHistory: z
    .array(
      z.object({
        status: z.string(),
        timestamp: z.date(),
        updatedBy: z.string(),
        notes: z.string().optional(),
      })
    )
    .optional(),
  cancelledAt: z.date().optional(),
  cancelledBy: z.string().optional(),
  cancellationReason: z.string().optional(),
  createdAt: z.date().default(new Date()),
  updatedAt: z.date().default(new Date()),
});

export type Order = z.infer<typeof OrderSchema>;
