# Search Functionality Documentation

## Overview
Comprehensive search functionality has been added to all major modules in the Grub distributor API. Each module now supports advanced search capabilities with filtering, pagination, and role-based access control.

## Search Endpoints

### 1. User Search
**Endpoint**: `GET /api/users/search`
**Access**: Admin, Owner only
**Parameters**:
- `q` (string): Search term for name, email, or phone number
- `role` (string): Filter by user role (customer, staff, kasir, sales, admin, owner)
- `isActive` (boolean): Filter by active status
- `limit` (number): Results per page (default: 10)
- `offset` (number): Pagination offset (default: 0)

**Example**:
```
GET /api/users/search?q=john&role=customer&isActive=true&limit=20
```

### 2. Product Search
**Endpoint**: `GET /api/products/search`
**Access**: All authenticated users
**Parameters**:
- `q` (string): Search term for name, description, or SKU
- `categoryId` (string): Filter by category ID
- `status` (string): Filter by status (active, inactive)
- `minPrice` (number): Minimum selling price
- `maxPrice` (number): Maximum selling price
- `inStock` (boolean): Filter by stock availability
- `limit` (number): Results per page (default: 20)
- `offset` (number): Pagination offset (default: 0)

**Example**:
```
GET /api/products/search?q=laptop&categoryId=electronics&minPrice=500&maxPrice=2000&inStock=true
```

### 3. Category Search
**Endpoint**: `GET /api/categories/search`
**Access**: All authenticated users
**Parameters**:
- `q` (string): Search term for name or description
- `userId` (string): Filter by creator user ID (admin feature)
- `limit` (number): Results per page (default: 10)
- `offset` (number): Pagination offset (default: 0)

**Example**:
```
GET /api/categories/search?q=electronics&limit=15
```

### 4. Store Search
**Endpoint**: `GET /api/stores/search`
**Access**: All authenticated users (role-based filtering applied)
**Parameters**:
- `q` (string): Search term for store name or address
- `status` (string): Filter by status (pending, approved, rejected) - Admin/Owner only
- `latitude` (number): Center latitude for location search
- `longitude` (number): Center longitude for location search
- `radius` (number): Search radius in kilometers
- `limit` (number): Results per page (default: 15)
- `offset` (number): Pagination offset (default: 0)

**Example**:
```
GET /api/stores/search?q=supermarket&latitude=-6.2088&longitude=106.8456&radius=5
```

### 5. Order Search
**Endpoint**: `GET /api/orders/search`
**Access**: All authenticated users (customers see only their orders)
**Parameters**:
- `q` (string): Search term for order ID, shipping address, or product names
- `status` (string): Filter by order status (pending_payment, paid, processing, shipped, delivered, cancelled)
- `userId` (string): Filter by user ID (staff/admin only)
- `dateFrom` (string): Start date filter (ISO format)
- `dateTo` (string): End date filter (ISO format)
- `minAmount` (number): Minimum order amount
- `maxAmount` (number): Maximum order amount
- `limit` (number): Results per page (default: 20)
- `offset` (number): Pagination offset (default: 0)

**Example**:
```
GET /api/orders/search?status=paid&dateFrom=2024-01-01&dateTo=2024-12-31&minAmount=100
```

### 6. Stock Inventory Search
**Endpoint**: `GET /api/stock/search`
**Access**: Admin, Owner, Staff, Sales
**Parameters**:
- `q` (string): Search term for product name, SKU, warehouse name, or product ID
- `productId` (string): Filter by specific product ID
- `warehouseId` (string): Filter by specific warehouse ID
- `minQuantity` (number): Minimum stock quantity
- `maxQuantity` (number): Maximum stock quantity
- `lowStock` (boolean): Filter for low stock items (≤10 units)
- `limit` (number): Results per page (default: 20)
- `offset` (number): Pagination offset (default: 0)

**Example**:
```
GET /api/stock/search?lowStock=true&warehouseId=warehouse1&limit=50
```

### 7. Stock Movements Search
**Endpoint**: `GET /api/stock/movements/search`
**Access**: Admin, Owner, Staff, Sales
**Parameters**:
- `q` (string): Search term for product name, notes, order ID, or warehouse name
- `productId` (string): Filter by specific product ID
- `warehouseId` (string): Filter by specific warehouse ID
- `type` (string): Filter by movement type (initial, purchase, sale, transfer, adjustment)
- `dateFrom` (string): Start date filter (ISO format)
- `dateTo` (string): End date filter (ISO format)
- `limit` (number): Results per page (default: 20)
- `offset` (number): Pagination offset (default: 0)

**Example**:
```
GET /api/stock/movements/search?type=sale&dateFrom=2024-01-01&productId=prod123
```

## Response Format

All search endpoints return a standardized response format:

```json
{
  "success": true,
  "message": "Pencarian berhasil",
  "data": [...],
  "pagination": {
    "limit": 20,
    "offset": 0,
    "total": 150
  },
  "filters": {
    "searchTerm": "laptop",
    "categoryId": "electronics",
    "status": "active"
  },
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

## Search Features

### 1. **Text Search**
- Case-insensitive partial matching
- Searches across multiple relevant fields
- Supports searching by ID, name, description, SKU, etc.

### 2. **Advanced Filtering**
- Multiple filter criteria can be combined
- Role-based filtering (automatic based on user permissions)
- Date range filtering with flexible date formats
- Numeric range filtering (price, quantity, amount)

### 3. **Location-Based Search** (Stores)
- Haversine formula for distance calculation
- Radius-based filtering in kilometers
- Latitude/longitude coordinate support

### 4. **Pagination**
- Configurable page size with reasonable defaults
- Offset-based pagination
- Total count included in response

### 5. **Role-Based Access Control**
- **Customers**: Can only search their own orders
- **Sales**: Can see approved stores only
- **Staff**: Can access product and inventory searches
- **Admin/Owner**: Full access to all search functions

## Implementation Details

### Database Optimization
- Firestore queries are optimized with proper indexing
- Client-side filtering for complex text searches (Firestore limitation)
- Efficient pagination with limit/offset

### Security
- All endpoints require authentication
- Role-based authorization enforced
- Input validation and sanitization
- Rate limiting applied

### Performance
- Reasonable default limits to prevent large data transfers
- Efficient query patterns
- Minimal data transfer with pagination

## Usage Examples

### Search for low-stock products in a specific category:
```bash
curl -H "Authorization: Bearer <token>" \
  "http://localhost:3000/api/products/search?categoryId=electronics&inStock=false"
```

### Find nearby approved stores:
```bash
curl -H "Authorization: Bearer <token>" \
  "http://localhost:3000/api/stores/search?latitude=-6.2088&longitude=106.8456&radius=10&status=approved"
```

### Search recent stock movements:
```bash
curl -H "Authorization: Bearer <token>" \
  "http://localhost:3000/api/stock/movements/search?dateFrom=2024-01-01&type=sale&limit=100"
```

## Error Handling

All search endpoints include comprehensive error handling:
- Input validation errors (400)
- Authentication errors (401)
- Authorization errors (403)
- Server errors (500)
- Detailed error messages and timestamps

## Future Enhancements

1. **Full-text search**: Integration with Elasticsearch or Algolia
2. **Autocomplete**: Real-time search suggestions
3. **Saved searches**: User-defined search presets
4. **Export functionality**: CSV/Excel export of search results
5. **Advanced analytics**: Search usage statistics and insights
