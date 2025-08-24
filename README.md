# Grub - Distributor API

A comprehensive Node.js/Express API for distributor management system with Firebase integration.

## Features

- 🔐 **Authentication & Authorization** - JWT-based auth with role-based access control
- 👥 **User Management** - Complete CRUD operations for users with different roles
- 🏪 **Store Management** - Store registration and approval system
- 📦 **Product Management** - Product catalog with categories and inventory
- 📋 **Order Management** - Order processing with payment integration
- 💳 **Payment Integration** - Flip payment gateway integration
- 📊 **Stock Management** - Inventory tracking and stock movements
- 🔒 **Security** - Rate limiting, input validation, and secure headers
- 📝 **Logging** - Comprehensive request/response logging
- 🧪 **Testing** - Unit and integration tests with Jest

## Tech Stack

- **Runtime**: Node.js with TypeScript
- **Framework**: Express.js
- **Database**: Firebase Firestore
- **Authentication**: JWT
- **Validation**: Zod
- **Testing**: Jest + Supertest
- **Payment**: Flip API
- **Security**: Helmet, CORS, Rate Limiting

## Getting Started

### Prerequisites

- Node.js (v18 or higher)
- npm or yarn
- Firebase project with Firestore enabled

### Installation

1. Clone the repository:

```bash
git clone <repository-url>
cd grub
```

2. Install dependencies:

```bash
npm install
```

3. Set up environment variables:

```bash
cp .env.example .env
```

4. Configure your `.env` file with your Firebase credentials and other settings:

```env
PORT=3000
NODE_ENV=development

# Firebase Configuration
FIREBASE_PROJECT_ID=your-project-id
FIREBASE_PRIVATE_KEY=your-private-key
FIREBASE_CLIENT_EMAIL=your-client-email

# JWT Configuration
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production
JWT_EXPIRES_IN=1d

# Flip Payment Configuration (optional)
FLIP_SECRET_KEY=your-flip-secret-key
FLIP_VALIDATION_TOKEN=your-flip-validation-token

# API Configuration
API_BASE_URL=http://localhost:3000
FRONTEND_URL=http://localhost:3000

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
```

5. Start the development server:

```bash
npm run dev
```

The API will be available at `http://localhost:3000`

## API Endpoints

### Authentication

- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - User login
- `GET /api/auth/me` - Get current user profile

### Users (Admin only)

- `GET /api/users` - Get all users
- `GET /api/users/search` - Search users with filters
- `GET /api/users/:id` - Get user by ID
- `POST /api/users` - Create new user
- `PUT /api/users/:id` - Update user
- `DELETE /api/users/:id` - Delete user

### Products

- `GET /api/products` - Get all products
- `GET /api/products/search` - Search products with filters
- `GET /api/products/:id` - Get product by ID
- `GET /api/products/category/:categoryId` - Get products by category
- `POST /api/products` - Create product (Admin/Owner)
- `PUT /api/products/:id` - Update product (Admin/Owner/Staff)
- `DELETE /api/products/:id` - Delete product (Admin/Owner)

### Categories

- `GET /api/categories` - Get all categories
- `GET /api/categories/search` - Search categories with filters
- `GET /api/categories/:id` - Get category by ID
- `POST /api/categories` - Create category (Admin/Owner/Staff)
- `PUT /api/categories/:id` - Update category (Admin/Owner)
- `DELETE /api/categories/:id` - Delete category (Admin/Owner)

### Stores

- `GET /api/stores` - Get all stores
- `GET /api/stores/search` - Search stores with location and filters
- `GET /api/stores/:id` - Get store by ID
- `POST /api/stores` - Create store (Admin/Owner/Sales)
- `PUT /api/stores/:id` - Update store
- `PATCH /api/stores/:id/status` - Update store status (Admin/Owner)
- `DELETE /api/stores/:id` - Delete store

### Orders

- `POST /api/orders` - Create new order
- `GET /api/orders/search` - Search orders with filters
- `GET /api/orders/:id` - Get order by ID

### Stock Management

- `GET /api/stock` - Get all stock inventory
- `GET /api/stock/search` - Search stock inventory with filters
- `GET /api/stock/product/:productId` - Get stock for specific product
- `POST /api/stock` - Adjust stock (Admin/Owner/Staff)
- `GET /api/stock/movements` - Get stock movements
- `GET /api/stock/movements/search` - Search stock movements with filters
- `GET /api/stock/movements/product/:productId` - Get movements for specific product

### Payments

- `POST /api/payments/flip-webhook` - Flip payment webhook

### Device Management

- `GET /api/device/generate` - Generate secure device ID (Public)
- `POST /api/device/validate` - Validate device ID format (Public)
- `GET /api/device/info` - Get device information from headers (Public)
- `GET /api/device/rate-limit` - Get current rate limit status (Public)
- `POST /api/device/:deviceId/reset-rate-limit` - Reset device rate limit (Admin/Owner)

## Search Functionality

All major modules now support comprehensive search capabilities with advanced filtering, pagination, and role-based access control. For detailed documentation, see [SEARCH_FUNCTIONALITY.md](./SEARCH_FUNCTIONALITY.md).

### Key Search Features

- **Text Search**: Case-insensitive partial matching across relevant fields
- **Advanced Filtering**: Multiple criteria (status, date range, price range, location, etc.)
- **Location Search**: Distance-based search for stores with latitude/longitude
- **Pagination**: Configurable page size with offset-based pagination
- **Role-based Access**: Automatic filtering based on user permissions

## Device-Based Rate Limiting

The API implements advanced device-based rate limiting instead of traditional IP-based limiting for more accurate tracking and better user experience.

### Key Features

- **Device ID Tracking**: Uses unique device identifiers instead of IP addresses
- **Security Validation**: Validates device IDs to prevent spoofing attempts
- **Flexible Fallback**: Falls back to IP-based limiting for legacy clients
- **Admin Controls**: Device management and rate limit reset capabilities

### Client Implementation

Include a device ID in your API requests using one of these headers:

- `X-Device-ID` (recommended)
- `Device-ID`
- `X-Client-ID`

```bash
curl -H "X-Device-ID: your-device-id" \
     -H "Content-Type: application/json" \
     https://api.example.com/api/products
```

### Generate Device ID

```bash
curl https://api.example.com/api/device/generate
```

For comprehensive device-based rate limiting documentation, see [DEVICE_RATE_LIMITING.md](./DEVICE_RATE_LIMITING.md)

## User Roles

- **customer** - Can place orders and view products
- **staff** - Can manage products and categories
- **kasir** - Cashier role for point-of-sale operations
- **sales** - Can create stores and manage sales
- **admin** - Full system access except owner functions
- **owner** - Complete system access

## Testing

Run tests:

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:coverage

# Run tests for CI
npm run test:ci
```

## Development

### Project Structure

```
src/
├── config/          # Configuration files
├── controllers/     # Route controllers
├── middleware/      # Custom middleware
├── models/          # Data models and interfaces
├── routes/          # API routes
├── services/        # Business logic services
├── types/           # TypeScript type definitions
├── utils/           # Utility functions
└── validations/     # Input validation schemas
```

### Code Quality

The project includes:

- TypeScript for type safety
- ESLint for code linting
- Prettier for code formatting
- Jest for testing
- Comprehensive error handling
- Request/response logging
- Input validation with Zod

### Security Features

- JWT authentication
- Role-based authorization
- Rate limiting
- Input validation and sanitization
- Secure HTTP headers with Helmet
- CORS configuration
- Password hashing with bcrypt

## Deployment

1. Build the project:

```bash
npm run build
```

2. Start the production server:

```bash
npm start
```

## Environment Variables

| Variable                  | Description                   | Required                  |
| ------------------------- | ----------------------------- | ------------------------- |
| `PORT`                    | Server port                   | No (default: 3000)        |
| `NODE_ENV`                | Environment mode              | No (default: development) |
| `FIREBASE_PROJECT_ID`     | Firebase project ID           | Yes                       |
| `FIREBASE_PRIVATE_KEY`    | Firebase private key          | Yes                       |
| `FIREBASE_CLIENT_EMAIL`   | Firebase client email         | Yes                       |
| `JWT_SECRET`              | JWT signing secret            | Yes                       |
| `JWT_EXPIRES_IN`          | JWT expiration time           | No (default: 1d)          |
| `FLIP_SECRET_KEY`         | Flip payment secret key       | No                        |
| `FLIP_VALIDATION_TOKEN`   | Flip webhook validation token | No                        |
| `API_BASE_URL`            | API base URL                  | No                        |
| `FRONTEND_URL`            | Frontend URL for CORS         | No                        |
| `RATE_LIMIT_WINDOW_MS`    | Rate limit window in ms       | No                        |
| `RATE_LIMIT_MAX_REQUESTS` | Max requests per window       | No                        |

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests for new functionality
5. Ensure all tests pass
6. Submit a pull request

## License

This project is licensed under the ISC License.
