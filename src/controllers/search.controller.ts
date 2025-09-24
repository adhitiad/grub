// Enhanced Search & Filtering Controller
import { Request, Response } from "express";
import { db } from "../config/firebase";
import {
  createErrorResponse,
  createSuccessResponse,
  enhancedLogger,
} from "../utils/enhancedLogger";

const productsCollection = db.collection("products");
const categoriesCollection = db.collection("categories");
const storesCollection = db.collection("stores");
const searchHistoryCollection = db.collection("search_history");
const savedSearchesCollection = db.collection("saved_searches");

interface SearchFilters {
  query?: string;
  categoryIds?: string[];
  priceMin?: number;
  priceMax?: number;
  availability?: "in_stock" | "low_stock" | "out_of_stock" | "all";
  storeIds?: string[];
  tags?: string[];
  sortBy?:
    | "relevance"
    | "price_asc"
    | "price_desc"
    | "name_asc"
    | "name_desc"
    | "newest"
    | "popularity"
    | "rating";
  location?: {
    latitude: number;
    longitude: number;
    radius: number; // in kilometers
  };
}

interface SearchResult {
  products: Array<{
    id: string;
    name: string;
    description?: string;
    price: number;
    category: {
      id: string;
      name: string;
    };
    imageUrl?: string;
    isActive: boolean;
    stock: number;
    rating?: number;
    reviewCount?: number;
    store?: {
      id: string;
      name: string;
      location?: {
        latitude: number;
        longitude: number;
        address: string;
      };
      distance?: number;
    };
    relevanceScore?: number;
  }>;
  facets: {
    categories: Array<{
      id: string;
      name: string;
      count: number;
    }>;
    priceRanges: Array<{
      min: number;
      max: number;
      count: number;
      label: string;
    }>;
    availability: Array<{
      status: string;
      count: number;
      label: string;
    }>;
    stores: Array<{
      id: string;
      name: string;
      count: number;
    }>;
  };
  suggestions: string[];
  totalCount: number;
  searchTime: number;
}

interface SearchSuggestion {
  query: string;
  type: "product" | "category" | "brand";
  count: number;
  popularity: number;
}

// Advanced product search with full-text search and filtering
export const searchProducts = async (req: Request, res: Response) => {
  try {
    const startTime = Date.now();
    const context = enhancedLogger.extractRequestContext(req);
    const user = req.user;

    const {
      q: query,
      categories,
      priceMin,
      priceMax,
      availability = "all",
      stores,
      tags,
      sortBy = "relevance",
      page = 1,
      limit = 20,
      latitude,
      longitude,
      radius = 10,
    } = req.query;

    // Build search filters
    const filters: SearchFilters = {
      query: query as string,
      categoryIds: categories
        ? Array.isArray(categories)
          ? (categories as string[])
          : [categories as string]
        : undefined,
      priceMin: priceMin ? parseFloat(priceMin as string) : undefined,
      priceMax: priceMax ? parseFloat(priceMax as string) : undefined,
      availability: availability as any,
      storeIds: stores
        ? Array.isArray(stores)
          ? (stores as string[])
          : [stores as string]
        : undefined,
      tags: tags
        ? Array.isArray(tags)
          ? (tags as string[])
          : [tags as string]
        : undefined,
      sortBy: sortBy as any,
      location:
        latitude && longitude
          ? {
              latitude: parseFloat(latitude as string),
              longitude: parseFloat(longitude as string),
              radius: parseFloat(radius as string),
            }
          : undefined,
    };

    // Perform search
    const searchResult = await performProductSearch(
      filters,
      parseInt(page as string),
      parseInt(limit as string)
    );

    // Save search history if user is authenticated
    if (user && query) {
      await saveSearchHistory(
        user.id,
        query as string,
        filters,
        searchResult.totalCount
      );
    }

    // Generate search suggestions
    const suggestions = await generateSearchSuggestions(query as string);
    searchResult.suggestions = suggestions;

    const searchTime = Date.now() - startTime;
    searchResult.searchTime = searchTime;

    enhancedLogger.info("Product search performed", context, {
      query,
      filters,
      resultsCount: searchResult.products.length,
      totalCount: searchResult.totalCount,
      searchTime,
      userId: user?.id,
    });

    res
      .status(200)
      .json(
        createSuccessResponse(
          "Search completed successfully",
          searchResult,
          context
        )
      );
  } catch (error) {
    const context = enhancedLogger.extractRequestContext(req);
    enhancedLogger.error(
      "Failed to perform product search",
      context,
      error as Error
    );
    res
      .status(500)
      .json(
        createErrorResponse(
          "Failed to perform product search",
          error as Error,
          context
        )
      );
  }
};

// Get search suggestions and autocomplete
export const getSearchSuggestions = async (req: Request, res: Response) => {
  try {
    const context = enhancedLogger.extractRequestContext(req);
    const { q: query, limit = 10 } = req.query;

    if (!query || (query as string).length < 2) {
      return res
        .status(400)
        .json(
          createErrorResponse(
            "Query too short",
            new Error("Query must be at least 2 characters long"),
            context,
            400
          )
        );
    }

    const suggestions = await generateSearchSuggestions(
      query as string,
      parseInt(limit as string)
    );

    enhancedLogger.info("Search suggestions generated", context, {
      query,
      suggestionsCount: suggestions.length,
    });

    res
      .status(200)
      .json(
        createSuccessResponse(
          "Search suggestions retrieved successfully",
          { suggestions },
          context
        )
      );
  } catch (error) {
    const context = enhancedLogger.extractRequestContext(req);
    enhancedLogger.error(
      "Failed to get search suggestions",
      context,
      error as Error
    );
    res
      .status(500)
      .json(
        createErrorResponse(
          "Failed to get search suggestions",
          error as Error,
          context
        )
      );
  }
};

// Save search for later
export const saveSearch = async (req: Request, res: Response) => {
  try {
    const context = enhancedLogger.extractRequestContext(req);
    const user = req.user!;
    const { name, filters, notifyOnNewResults = false } = req.body;

    if (!name || !filters) {
      return res
        .status(400)
        .json(
          createErrorResponse(
            "Missing required fields",
            new Error("Name and filters are required"),
            context,
            400
          )
        );
    }

    const savedSearch = {
      userId: user.id,
      name,
      filters,
      notifyOnNewResults,
      createdAt: new Date(),
      lastUsed: new Date(),
      useCount: 0,
    };

    const docRef = await savedSearchesCollection.add(savedSearch);

    enhancedLogger.info("Search saved", context, {
      searchId: docRef.id,
      name,
      userId: user.id,
    });

    res
      .status(201)
      .json(
        createSuccessResponse(
          "Search saved successfully",
          { id: docRef.id, ...savedSearch },
          context
        )
      );
  } catch (error) {
    const context = enhancedLogger.extractRequestContext(req);
    enhancedLogger.error("Failed to save search", context, error as Error);
    res
      .status(500)
      .json(
        createErrorResponse("Failed to save search", error as Error, context)
      );
  }
};

// Get user's saved searches
export const getSavedSearches = async (req: Request, res: Response) => {
  try {
    const context = enhancedLogger.extractRequestContext(req);
    const user = req.user!;

    const savedSearchesSnapshot = await savedSearchesCollection
      .where("userId", "==", user.id)
      .orderBy("lastUsed", "desc")
      .get();

    const savedSearches = savedSearchesSnapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
      createdAt: doc.data().createdAt?.toDate?.() || doc.data().createdAt,
      lastUsed: doc.data().lastUsed?.toDate?.() || doc.data().lastUsed,
    }));

    enhancedLogger.info("Saved searches retrieved", context, {
      count: savedSearches.length,
      userId: user.id,
    });

    res
      .status(200)
      .json(
        createSuccessResponse(
          "Saved searches retrieved successfully",
          { savedSearches },
          context
        )
      );
  } catch (error) {
    const context = enhancedLogger.extractRequestContext(req);
    enhancedLogger.error(
      "Failed to retrieve saved searches",
      context,
      error as Error
    );
    res
      .status(500)
      .json(
        createErrorResponse(
          "Failed to retrieve saved searches",
          error as Error,
          context
        )
      );
  }
};

// Get search history
export const getSearchHistory = async (req: Request, res: Response) => {
  try {
    const context = enhancedLogger.extractRequestContext(req);
    const user = req.user!;
    const { limit = 20 } = req.query;

    const historySnapshot = await searchHistoryCollection
      .where("userId", "==", user.id)
      .orderBy("searchedAt", "desc")
      .limit(parseInt(limit as string))
      .get();

    const history = historySnapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
      searchedAt: doc.data().searchedAt?.toDate?.() || doc.data().searchedAt,
    }));

    enhancedLogger.info("Search history retrieved", context, {
      count: history.length,
      userId: user.id,
    });

    res
      .status(200)
      .json(
        createSuccessResponse(
          "Search history retrieved successfully",
          { history },
          context
        )
      );
  } catch (error) {
    const context = enhancedLogger.extractRequestContext(req);
    enhancedLogger.error(
      "Failed to retrieve search history",
      context,
      error as Error
    );
    res
      .status(500)
      .json(
        createErrorResponse(
          "Failed to retrieve search history",
          error as Error,
          context
        )
      );
  }
};

// Helper function to perform product search
async function performProductSearch(
  filters: SearchFilters,
  page: number,
  limit: number
): Promise<SearchResult> {
  let query = productsCollection.where("isActive", "==", true);

  // Apply category filter
  if (filters.categoryIds && filters.categoryIds.length > 0) {
    query = query.where("categoryId", "in", filters.categoryIds);
  }

  // Apply price filters
  if (filters.priceMin !== undefined) {
    query = query.where("price", ">=", filters.priceMin);
  }
  if (filters.priceMax !== undefined) {
    query = query.where("price", "<=", filters.priceMax);
  }

  // Apply availability filter
  if (filters.availability && filters.availability !== "all") {
    switch (filters.availability) {
      case "in_stock":
        query = query.where("stock", ">", 10);
        break;
      case "low_stock":
        query = query.where("stock", ">", 0).where("stock", "<=", 10);
        break;
      case "out_of_stock":
        query = query.where("stock", "==", 0);
        break;
    }
  }

  // Execute query
  const snapshot = await query.get();
  let products = snapshot.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
  })) as any[];

  // Apply text search filter (simple implementation)
  if (filters.query) {
    const searchTerms = filters.query.toLowerCase().split(" ");
    products = products.filter((product) => {
      const searchText = `${product.name} ${
        product.description || ""
      }`.toLowerCase();
      return searchTerms.some((term) => searchText.includes(term));
    });
  }

  // Apply sorting
  products = applySorting(
    products,
    filters.sortBy || "relevance",
    filters.query
  );

  // Apply pagination
  const startIndex = (page - 1) * limit;
  const paginatedProducts = products.slice(startIndex, startIndex + limit);

  // Generate facets
  const facets = await generateSearchFacets(products, filters);

  return {
    products: paginatedProducts,
    facets,
    suggestions: [],
    totalCount: products.length,
    searchTime: 0,
  };
}

// Helper function to apply sorting
function applySorting(products: any[], sortBy: string, query?: string): any[] {
  switch (sortBy) {
    case "price_asc":
      return products.sort((a, b) => (a.price || 0) - (b.price || 0));
    case "price_desc":
      return products.sort((a, b) => (b.price || 0) - (a.price || 0));
    case "name_asc":
      return products.sort((a, b) =>
        (a.name || "").localeCompare(b.name || "")
      );
    case "name_desc":
      return products.sort((a, b) =>
        (b.name || "").localeCompare(a.name || "")
      );
    case "newest":
      return products.sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
    case "popularity":
      return products.sort((a, b) => (b.salesCount || 0) - (a.salesCount || 0));
    case "rating":
      return products.sort((a, b) => (b.rating || 0) - (a.rating || 0));
    case "relevance":
    default:
      if (query) {
        return products.sort(
          (a, b) =>
            calculateRelevanceScore(b, query) -
            calculateRelevanceScore(a, query)
        );
      }
      return products;
  }
}

// Helper function to calculate relevance score
function calculateRelevanceScore(product: any, query: string): number {
  const searchTerms = query.toLowerCase().split(" ");
  const productName = (product.name || "").toLowerCase();
  const productDescription = (product.description || "").toLowerCase();

  let score = 0;

  searchTerms.forEach((term) => {
    // Exact match in name gets highest score
    if (productName.includes(term)) {
      score += productName === term ? 100 : 50;
    }

    // Match in description gets lower score
    if (productDescription.includes(term)) {
      score += 10;
    }

    // Boost score for popular products
    score += (product.salesCount || 0) * 0.1;
    score += (product.rating || 0) * 5;
  });

  return score;
}

// Helper function to generate search facets
async function generateSearchFacets(
  products: any[],
  filters: SearchFilters
): Promise<any> {
  // Generate category facets
  const categoryMap = new Map();
  products.forEach((product) => {
    if (product.categoryId) {
      const count = categoryMap.get(product.categoryId) || 0;
      categoryMap.set(product.categoryId, count + 1);
    }
  });

  // Get category names
  const categoryIds = Array.from(categoryMap.keys());
  const categoriesSnapshot = await categoriesCollection
    .where("__name__", "in", categoryIds)
    .get();
  const categories = categoriesSnapshot.docs.map((doc) => ({
    id: doc.id,
    name: doc.data().name,
    count: categoryMap.get(doc.id) || 0,
  }));

  // Generate price range facets
  const prices = products.map((p) => p.price || 0).sort((a, b) => a - b);
  const priceRanges = [
    { min: 0, max: 50000, label: "Under Rp 50,000" },
    { min: 50000, max: 100000, label: "Rp 50,000 - Rp 100,000" },
    { min: 100000, max: 250000, label: "Rp 100,000 - Rp 250,000" },
    { min: 250000, max: 500000, label: "Rp 250,000 - Rp 500,000" },
    { min: 500000, max: Infinity, label: "Over Rp 500,000" },
  ].map((range) => ({
    ...range,
    count: products.filter(
      (p) => (p.price || 0) >= range.min && (p.price || 0) < range.max
    ).length,
  }));

  // Generate availability facets
  const availability = [
    {
      status: "in_stock",
      label: "In Stock",
      count: products.filter((p) => (p.stock || 0) > 10).length,
    },
    {
      status: "low_stock",
      label: "Low Stock",
      count: products.filter((p) => (p.stock || 0) > 0 && (p.stock || 0) <= 10)
        .length,
    },
    {
      status: "out_of_stock",
      label: "Out of Stock",
      count: products.filter((p) => (p.stock || 0) === 0).length,
    },
  ];

  return {
    categories,
    priceRanges,
    availability,
    stores: [], // Would be populated with store data
  };
}

// Helper function to generate search suggestions
async function generateSearchSuggestions(
  query: string,
  limit: number = 10
): Promise<string[]> {
  if (!query || query.length < 2) {
    return [];
  }

  // Get popular search terms from history
  const historySnapshot = await searchHistoryCollection
    .where("query", ">=", query.toLowerCase())
    .where("query", "<", query.toLowerCase() + "\uf8ff")
    .orderBy("query")
    .orderBy("searchedAt", "desc")
    .limit(limit)
    .get();

  const suggestions = new Set<string>();

  historySnapshot.docs.forEach((doc) => {
    const data = doc.data();
    if (
      data.query &&
      data.query.toLowerCase().startsWith(query.toLowerCase())
    ) {
      suggestions.add(data.query);
    }
  });

  // Add product name suggestions
  const productsSnapshot = await productsCollection
    .where("isActive", "==", true)
    .limit(50)
    .get();

  productsSnapshot.docs.forEach((doc) => {
    const product = doc.data();
    if (
      product.name &&
      product.name.toLowerCase().includes(query.toLowerCase())
    ) {
      suggestions.add(product.name);
    }
  });

  return Array.from(suggestions).slice(0, limit);
}

// Helper function to save search history
async function saveSearchHistory(
  userId: string,
  query: string,
  filters: SearchFilters,
  resultCount: number
): Promise<void> {
  try {
    await searchHistoryCollection.add({
      userId,
      query: query.toLowerCase(),
      filters,
      resultCount,
      searchedAt: new Date(),
    });
  } catch (error) {
    enhancedLogger.error("Failed to save search history", {}, error as Error);
  }
}
