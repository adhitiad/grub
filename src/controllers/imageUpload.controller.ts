// Product Image Management Controller
import { Request, Response } from "express";
import fs from "fs/promises";
import multer from "multer";
import path from "path";
import sharp from "sharp";
import { v4 as uuidv4 } from "uuid";
import { config } from "../config/env";
import { db } from "../config/firebase";
import {
  createErrorResponse,
  createSuccessResponse,
  enhancedLogger,
} from "../utils/enhancedLogger";

const productsCollection = db.collection("products");
const productImagesCollection = db.collection("product_images");

interface ImageUploadOptions {
  maxFiles: number;
  maxFileSize: number;
  allowedMimeTypes: string[];
  imageQuality: number;
  thumbnailSizes: Array<{ width: number; height: number; suffix: string }>;
}

interface ProcessedImage {
  originalName: string;
  filename: string;
  path: string;
  size: number;
  mimeType: string;
  dimensions: {
    width: number;
    height: number;
  };
  thumbnails: Array<{
    filename: string;
    path: string;
    size: number;
    dimensions: {
      width: number;
      height: number;
    };
  }>;
}

interface ProductImage {
  id?: string;
  productId: string;
  filename: string;
  originalName: string;
  path: string;
  url: string;
  thumbnails: Array<{
    size: string;
    filename: string;
    path: string;
    url: string;
  }>;
  mimeType: string;
  fileSize: number;
  dimensions: {
    width: number;
    height: number;
  };
  isPrimary: boolean;
  uploadedBy: string;
  uploadedAt: Date;
  metadata?: {
    alt?: string;
    caption?: string;
    tags?: string[];
  };
}

const defaultImageOptions: ImageUploadOptions = {
  maxFiles: 5,
  maxFileSize: 10 * 1024 * 1024, // 10MB
  allowedMimeTypes: ["image/jpeg", "image/png", "image/webp"],
  imageQuality: 85,
  thumbnailSizes: [
    { width: 150, height: 150, suffix: "thumb" },
    { width: 300, height: 300, suffix: "small" },
    { width: 600, height: 600, suffix: "medium" },
    { width: 1200, height: 1200, suffix: "large" },
  ],
};

// Configure multer for file upload
const storage = multer.memoryStorage();

const fileFilter = (
  req: any,
  file: Express.Multer.File,
  cb: multer.FileFilterCallback
) => {
  if (defaultImageOptions.allowedMimeTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(
      new Error(
        `Invalid file type. Allowed types: ${defaultImageOptions.allowedMimeTypes.join(
          ", "
        )}`
      )
    );
  }
};

export const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: defaultImageOptions.maxFileSize,
    files: defaultImageOptions.maxFiles,
  },
});

// Upload product images
export const uploadProductImages = async (req: Request, res: Response) => {
  try {
    const context = enhancedLogger.extractRequestContext(req);
    const user = req.user!;
    const { productId } = req.params;
    const files = req.files as Express.Multer.File[];

    if (!files || files.length === 0) {
      return res
        .status(400)
        .json(
          createErrorResponse(
            "No files uploaded",
            new Error("At least one image file is required"),
            context,
            400
          )
        );
    }

    // Verify product exists
    const productDoc = await productsCollection.doc(productId).get();
    if (!productDoc.exists) {
      return res
        .status(404)
        .json(
          createErrorResponse(
            "Product not found",
            new Error(`Product with ID ${productId} not found`),
            context,
            404
          )
        );
    }

    // Process each uploaded file
    const processedImages: ProcessedImage[] = [];
    const uploadPromises = files.map(async (file) => {
      try {
        const processedImage = await processImageFile(file, productId);
        processedImages.push(processedImage);
        return processedImage;
      } catch (error) {
        enhancedLogger.error(
          "Failed to process image file",
          context,
          error as Error
        );
        throw error;
      }
    });

    await Promise.all(uploadPromises);

    // Save image records to database
    const imageRecords: ProductImage[] = [];
    for (const processedImage of processedImages) {
      const imageRecord: ProductImage = {
        productId,
        filename: processedImage.filename,
        originalName: processedImage.originalName,
        path: processedImage.path,
        url: generateImageUrl(processedImage.path),
        thumbnails: processedImage.thumbnails.map((thumb) => ({
          size: thumb.filename.includes("thumb")
            ? "thumbnail"
            : thumb.filename.includes("small")
            ? "small"
            : thumb.filename.includes("medium")
            ? "medium"
            : "large",
          filename: thumb.filename,
          path: thumb.path,
          url: generateImageUrl(thumb.path),
        })),
        mimeType: processedImage.mimeType,
        fileSize: processedImage.size,
        dimensions: processedImage.dimensions,
        isPrimary: imageRecords.length === 0, // First image is primary
        uploadedBy: user.id,
        uploadedAt: new Date(),
      };

      const docRef = await productImagesCollection.add(imageRecord);
      imageRecord.id = docRef.id;
      imageRecords.push(imageRecord);
    }

    // Update product with primary image URL if this is the first image
    const existingImagesQuery = await productImagesCollection
      .where("productId", "==", productId)
      .limit(1)
      .get();

    if (existingImagesQuery.empty && imageRecords.length > 0) {
      await productsCollection.doc(productId).update({
        imageUrl: imageRecords[0].url,
        updatedAt: new Date(),
      });
    }

    enhancedLogger.info("Product images uploaded successfully", context, {
      productId,
      imagesUploaded: imageRecords.length,
      userId: user.id,
    });

    res
      .status(201)
      .json(
        createSuccessResponse(
          "Images uploaded successfully",
          { images: imageRecords },
          context
        )
      );
  } catch (error) {
    const context = enhancedLogger.extractRequestContext(req);
    enhancedLogger.error(
      "Failed to upload product images",
      context,
      error as Error
    );
    res
      .status(500)
      .json(
        createErrorResponse(
          "Failed to upload product images",
          error as Error,
          context
        )
      );
  }
};

// Get product images
export const getProductImages = async (req: Request, res: Response) => {
  try {
    const context = enhancedLogger.extractRequestContext(req);
    const { productId } = req.params;
    const { includeThumbnails = "true" } = req.query;

    const imagesSnapshot = await productImagesCollection
      .where("productId", "==", productId)
      .orderBy("uploadedAt", "desc")
      .get();

    const images = imagesSnapshot.docs.map((doc) => {
      const data = doc.data();
      const image = {
        id: doc.id,
        ...data,
        uploadedAt: data.uploadedAt?.toDate?.() || data.uploadedAt,
      };

      // Optionally exclude thumbnails to reduce response size
      if (includeThumbnails === "false") {
        delete (image as any).thumbnails;
      }

      return image;
    });

    enhancedLogger.info("Product images retrieved", context, {
      productId,
      imagesCount: images.length,
    });

    res
      .status(200)
      .json(
        createSuccessResponse(
          "Product images retrieved successfully",
          { images },
          context
        )
      );
  } catch (error) {
    const context = enhancedLogger.extractRequestContext(req);
    enhancedLogger.error(
      "Failed to retrieve product images",
      context,
      error as Error
    );
    res
      .status(500)
      .json(
        createErrorResponse(
          "Failed to retrieve product images",
          error as Error,
          context
        )
      );
  }
};

// Update image metadata
export const updateImageMetadata = async (req: Request, res: Response) => {
  try {
    const context = enhancedLogger.extractRequestContext(req);
    const user = req.user!;
    const { imageId } = req.params;
    const { alt, caption, tags, isPrimary } = req.body;

    const imageDoc = await productImagesCollection.doc(imageId).get();
    if (!imageDoc.exists) {
      return res
        .status(404)
        .json(
          createErrorResponse(
            "Image not found",
            new Error(`Image with ID ${imageId} not found`),
            context,
            404
          )
        );
    }

    const updateData: any = {
      updatedAt: new Date(),
      updatedBy: user.id,
    };

    if (alt !== undefined) updateData["metadata.alt"] = alt;
    if (caption !== undefined) updateData["metadata.caption"] = caption;
    if (tags !== undefined) updateData["metadata.tags"] = tags;
    if (isPrimary !== undefined) {
      updateData.isPrimary = isPrimary;

      // If setting as primary, unset other primary images for this product
      if (isPrimary) {
        const imageData = imageDoc.data();
        const otherImagesQuery = await productImagesCollection
          .where("productId", "==", imageData?.productId)
          .where("isPrimary", "==", true)
          .get();

        const batch = db.batch();
        otherImagesQuery.docs.forEach((doc) => {
          if (doc.id !== imageId) {
            batch.update(doc.ref, { isPrimary: false });
          }
        });
        await batch.commit();

        // Update product's primary image URL
        await productsCollection.doc(imageData?.productId).update({
          imageUrl: imageData?.url,
          updatedAt: new Date(),
        });
      }
    }

    await productImagesCollection.doc(imageId).update(updateData);

    enhancedLogger.info("Image metadata updated", context, {
      imageId,
      updates: updateData,
      userId: user.id,
    });

    res
      .status(200)
      .json(
        createSuccessResponse(
          "Image metadata updated successfully",
          { imageId, updates: updateData },
          context
        )
      );
  } catch (error) {
    const context = enhancedLogger.extractRequestContext(req);
    enhancedLogger.error(
      "Failed to update image metadata",
      context,
      error as Error
    );
    res
      .status(500)
      .json(
        createErrorResponse(
          "Failed to update image metadata",
          error as Error,
          context
        )
      );
  }
};

// Delete product image
export const deleteProductImage = async (req: Request, res: Response) => {
  try {
    const context = enhancedLogger.extractRequestContext(req);
    const user = req.user!;
    const { imageId } = req.params;

    const imageDoc = await productImagesCollection.doc(imageId).get();
    if (!imageDoc.exists) {
      return res
        .status(404)
        .json(
          createErrorResponse(
            "Image not found",
            new Error(`Image with ID ${imageId} not found`),
            context,
            404
          )
        );
    }

    const imageData = imageDoc.data() as ProductImage;

    // Delete physical files
    try {
      await fs.unlink(imageData.path);

      // Delete thumbnails
      for (const thumbnail of imageData.thumbnails) {
        try {
          await fs.unlink(thumbnail.path);
        } catch (error) {
          enhancedLogger.warn(
            "Failed to delete thumbnail file",
            context,
            error as Error
          );
        }
      }
    } catch (error) {
      enhancedLogger.warn(
        "Failed to delete image file",
        context,
        error as Error
      );
    }

    // Delete database record
    await productImagesCollection.doc(imageId).delete();

    // If this was the primary image, set another image as primary
    if (imageData.isPrimary) {
      const otherImagesQuery = await productImagesCollection
        .where("productId", "==", imageData.productId)
        .limit(1)
        .get();

      if (!otherImagesQuery.empty) {
        const newPrimaryImage = otherImagesQuery.docs[0];
        await newPrimaryImage.ref.update({ isPrimary: true });

        // Update product's primary image URL
        const newPrimaryData = newPrimaryImage.data();
        await productsCollection.doc(imageData.productId).update({
          imageUrl: newPrimaryData.url,
          updatedAt: new Date(),
        });
      } else {
        // No more images, remove image URL from product
        await productsCollection.doc(imageData.productId).update({
          imageUrl: null,
          updatedAt: new Date(),
        });
      }
    }

    enhancedLogger.info("Product image deleted", context, {
      imageId,
      productId: imageData.productId,
      userId: user.id,
    });

    res
      .status(200)
      .json(
        createSuccessResponse(
          "Image deleted successfully",
          { imageId },
          context
        )
      );
  } catch (error) {
    const context = enhancedLogger.extractRequestContext(req);
    enhancedLogger.error(
      "Failed to delete product image",
      context,
      error as Error
    );
    res
      .status(500)
      .json(
        createErrorResponse(
          "Failed to delete product image",
          error as Error,
          context
        )
      );
  }
};

// Helper function to process image file
async function processImageFile(
  file: Express.Multer.File,
  productId: string
): Promise<ProcessedImage> {
  const fileId = uuidv4();
  const fileExtension = path.extname(file.originalname).toLowerCase() || ".jpg";
  const baseFilename = `${productId}_${fileId}`;

  // Create upload directory if it doesn't exist
  const uploadDir = path.join(process.cwd(), "uploads", "products", productId);
  await fs.mkdir(uploadDir, { recursive: true });

  // Process main image
  const mainFilename = `${baseFilename}${fileExtension}`;
  const mainPath = path.join(uploadDir, mainFilename);

  const imageBuffer = await sharp(file.buffer)
    .jpeg({ quality: defaultImageOptions.imageQuality })
    .toBuffer();

  await fs.writeFile(mainPath, imageBuffer);

  // Get image dimensions
  const metadata = await sharp(file.buffer).metadata();
  const dimensions = {
    width: metadata.width || 0,
    height: metadata.height || 0,
  };

  // Generate thumbnails
  const thumbnails = [];
  for (const thumbSize of defaultImageOptions.thumbnailSizes) {
    const thumbFilename = `${baseFilename}_${thumbSize.suffix}${fileExtension}`;
    const thumbPath = path.join(uploadDir, thumbFilename);

    const thumbBuffer = await sharp(file.buffer)
      .resize(thumbSize.width, thumbSize.height, {
        fit: "cover",
        position: "center",
      })
      .jpeg({ quality: defaultImageOptions.imageQuality })
      .toBuffer();

    await fs.writeFile(thumbPath, thumbBuffer);

    const thumbMetadata = await sharp(thumbBuffer).metadata();
    thumbnails.push({
      filename: thumbFilename,
      path: thumbPath,
      size: thumbBuffer.length,
      dimensions: {
        width: thumbMetadata.width || thumbSize.width,
        height: thumbMetadata.height || thumbSize.height,
      },
    });
  }

  return {
    originalName: file.originalname,
    filename: mainFilename,
    path: mainPath,
    size: imageBuffer.length,
    mimeType: file.mimetype,
    dimensions,
    thumbnails,
  };
}

// Helper function to generate image URL
function generateImageUrl(filePath: string): string {
  const relativePath = filePath.replace(process.cwd(), "").replace(/\\/g, "/");
  return `${config.server.baseUrl}${relativePath}`;
}
