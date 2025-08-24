import { NextFunction, Request, Response } from "express";
import { z, ZodError } from "zod";

// Generic validation middleware
export const validate = (schema: z.ZodSchema<any>) => {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      schema.parse({
        body: req.body,
        query: req.query,
        params: req.params,
      });
      next();
    } catch (error: any) {
      if (error instanceof ZodError) {
        const errorMessages = error.issues.map((issue) => ({
          field: issue.path.join("."),
          message: issue.message,
        }));

        return res.status(400).json({
          success: false,
          message: "Validation error",
          errors: errorMessages,
          timestamp: new Date().toISOString(),
        });
      }

      return res.status(500).json({
        success: false,
        message: "Internal server error during validation",
        timestamp: new Date().toISOString(),
      });
    }
  };
};

// Validation schemas for different endpoints
export const authValidation = {
  register: z.object({
    body: z.object({
      email: z.string().email("Invalid email format"),
      password: z.string().min(6, "Password must be at least 6 characters"),
      name: z.string().min(1, "Name is required"),
      role: z.enum(["customer", "staff", "kasir", "sales", "admin", "owner"]),
      phoneNumber: z.string().optional(),
      address: z.string().optional(),
      image: z.string().url().optional(),
    }),
  }),

  login: z.object({
    body: z.object({
      email: z.string().email("Invalid email format"),
      password: z.string().min(1, "Password is required"),
    }),
  }),
};

export const userValidation = {
  create: z.object({
    body: z.object({
      email: z.string().email("Invalid email format"),
      password: z.string().min(6, "Password must be at least 6 characters"),
      name: z.string().min(1, "Name is required"),
      role: z.enum(["customer", "staff", "kasir", "sales", "admin", "owner"]),
      phoneNumber: z.string().optional(),
      address: z.string().optional(),
      image: z.string().url().optional(),
    }),
  }),

  update: z.object({
    params: z.object({
      id: z.string().min(1, "User ID is required"),
    }),
    body: z.object({
      name: z.string().min(1).optional(),
      role: z
        .enum(["customer", "staff", "kasir", "sales", "admin", "owner"])
        .optional(),
      phoneNumber: z.string().optional(),
      address: z.string().optional(),
      image: z.string().url().optional(),
      isActive: z.boolean().optional(),
      password: z.string().min(6).optional(),
    }),
  }),

  getById: z.object({
    params: z.object({
      id: z.string().min(1, "User ID is required"),
    }),
  }),
};

export const productValidation = {
  create: z.object({
    body: z.object({
      name: z.string().min(1, "Product name is required"),
      sku: z.string().optional(),
      description: z.string().min(1, "Description is required"),
      stock: z.number().min(0, "Stock must be non-negative"),
      status: z.enum(["active", "inactive"]).default("active"),
      image: z.string().url().optional(),
      categoryId: z.string().min(1, "Category ID is required"),
      purchasePrice: z.number().min(0, "Purchase price must be non-negative"),
      sellingPrice: z.number().min(0, "Selling price must be non-negative"),
    }),
  }),

  update: z.object({
    params: z.object({
      id: z.string().min(1, "Product ID is required"),
    }),
    body: z.object({
      name: z.string().min(1).optional(),
      sku: z.string().optional(),
      description: z.string().min(1).optional(),
      stock: z.number().min(0).optional(),
      status: z.enum(["active", "inactive"]).optional(),
      image: z.string().url().optional(),
      categoryId: z.string().min(1).optional(),
      purchasePrice: z.number().min(0).optional(),
      sellingPrice: z.number().min(0).optional(),
    }),
  }),

  getById: z.object({
    params: z.object({
      id: z.string().min(1, "Product ID is required"),
    }),
  }),

  getByCategoryId: z.object({
    params: z.object({
      categoryId: z.string().min(1, "Category ID is required"),
    }),
  }),
};

export const categoryValidation = {
  create: z.object({
    body: z.object({
      name: z.string().min(1, "Category name is required"),
      description: z.string().optional(),
    }),
  }),

  update: z.object({
    params: z.object({
      id: z.string().min(1, "Category ID is required"),
    }),
    body: z.object({
      name: z.string().min(1).optional(),
      description: z.string().optional(),
    }),
  }),

  getById: z.object({
    params: z.object({
      id: z.string().min(1, "Category ID is required"),
    }),
  }),
};

export const storeValidation = {
  create: z.object({
    body: z.object({
      name: z.string().min(1, "Store name is required"),
      address: z.string().min(1, "Address is required"),
      longitude: z.number().min(-180).max(180, "Invalid longitude"),
      latitude: z.number().min(-90).max(90, "Invalid latitude"),
    }),
  }),

  update: z.object({
    params: z.object({
      id: z.string().min(1, "Store ID is required"),
    }),
    body: z.object({
      name: z.string().min(1).optional(),
      address: z.string().min(1).optional(),
      longitude: z.number().min(-180).max(180).optional(),
      latitude: z.number().min(-90).max(90).optional(),
    }),
  }),

  updateStatus: z.object({
    params: z.object({
      id: z.string().min(1, "Store ID is required"),
    }),
    body: z.object({
      status: z.enum(["pending", "approved", "rejected"]),
    }),
  }),

  getById: z.object({
    params: z.object({
      id: z.string().min(1, "Store ID is required"),
    }),
  }),
};

export const orderValidation = {
  create: z.object({
    body: z.object({
      items: z
        .array(
          z.object({
            productId: z.string().min(1, "Product ID is required"),
            quantity: z.number().min(1, "Quantity must be at least 1"),
          })
        )
        .min(1, "At least one item is required"),
      shippingAddress: z.string().optional(),
    }),
  }),

  getById: z.object({
    params: z.object({
      id: z.string().min(1, "Order ID is required"),
    }),
  }),
};

export const stockValidation = {
  adjust: z.object({
    body: z.object({
      productId: z.string().min(1, "Product ID is required"),
      warehouseId: z.string().min(1, "Warehouse ID is required"),
      type: z.enum(["initial", "purchase", "sale", "transfer", "adjustment"]),
      quantityChange: z.number(),
      notes: z.string().optional(),
      relatedOrderId: z.string().optional(),
    }),
  }),

  getByProduct: z.object({
    params: z.object({
      productId: z.string().min(1, "Product ID is required"),
    }),
  }),

  getMovementsByProduct: z.object({
    params: z.object({
      productId: z.string().min(1, "Product ID is required"),
    }),
  }),
};
