# NestJS Backend - Parcel Management System

## Description

Backend API for the Courier and Parcel Management System built with NestJS, MongoDB, and Socket.IO.

## Features

- 🔐 JWT Authentication with role-based access control (Admin, Agent, Customer)
- 📦 Complete parcel management CRUD operations
- 🚚 Real-time tracking with Socket.IO
- 📍 Location updates for parcels
- 👥 User management with different roles
- 📊 Statistics and reporting endpoints
- 🔒 Guard-protected routes with role validation

## Tech Stack

- **NestJS** - Progressive Node.js framework
- **MongoDB** - NoSQL database
- **Mongoose** - MongoDB object modeling
- **JWT** - JSON Web Token authentication
- **Socket.IO** - Real-time bidirectional communication
- **Passport** - Authentication middleware
- **bcryptjs** - Password hashing
- **class-validator** - DTO validation

## Installation

```bash
# Install dependencies
pnpm install
```

## Configuration

Create a `.env` file in the root directory:

```env
PORT=5000
NODE_ENV=development

# MongoDB
MONGODB_URI=mongodb://localhost:27017/parcel-management

# JWT
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production
JWT_EXPIRES_IN=7d

# CORS
FRONTEND_URL=http://localhost:3000
```

## Running the Application

```bash
# Development mode
npm run start:dev

pnpm start:dev

# Production mode
pnpm build
pnpm start:prod
```

The API will be available at `http://localhost:5000/api`

## API Endpoints

### Authentication
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login user
- `GET /api/auth/me` - Get current user (protected)

### Users
- `GET /api/users` - Get all users (Admin only)
- `GET /api/users/agents` - Get all agents (Admin only)
- `GET /api/users/:id` - Get user by ID
- `PATCH /api/users/:id` - Update user
- `DELETE /api/users/:id` - Delete user (Admin only)

### Parcels
- `POST /api/parcels` - Create new parcel (Customer/Admin)
- `GET /api/parcels` - Get all parcels (filtered by role)
- `GET /api/parcels/statistics` - Get parcel statistics (Admin)
- `GET /api/parcels/track/:trackingNumber` - Track parcel by tracking number
- `GET /api/parcels/my-parcels` - Get current user's parcels (Customer)
- `GET /api/parcels/assigned` - Get assigned parcels (Agent)
- `GET /api/parcels/:id` - Get parcel by ID
- `PATCH /api/parcels/:id/status` - Update parcel status (Agent/Admin)
- `PATCH /api/parcels/:id/assign` - Assign agent to parcel (Admin)
- `PATCH /api/parcels/:id/location` - Update parcel location (Agent)
- `DELETE /api/parcels/:id` - Delete parcel (Admin)

## Socket.IO Events

### Client → Server
- `join-room` - Join a specific room for real-time updates
- `leave-room` - Leave a room

### Server → Client
- `parcel:created` - New parcel created
- `parcel:status-updated` - Parcel status changed
- `parcel:assigned` - Parcel assigned to agent
- `parcel:delivered` - Parcel delivered
- `parcel:location-updated` - Parcel location updated
- `notification` - General notification

## User Roles

1. **Admin** - Full access to all endpoints
   - Manage all users
   - Manage all parcels
   - Assign agents to parcels
   - View statistics

2. **Agent** - Delivery personnel
   - View assigned parcels
   - Update parcel status
   - Update parcel location

3. **Customer** - Parcel senders
   - Create new parcels
   - View own parcels
   - Track parcels

## Project Structure

```
src/
├── auth/               # Authentication module
│   ├── dto/           # Data transfer objects
│   ├── strategies/    # Passport strategies
│   ├── auth.controller.ts
│   ├── auth.service.ts
│   └── auth.module.ts
├── users/             # Users module
│   ├── schemas/       # Mongoose schemas
│   ├── users.controller.ts
│   ├── users.service.ts
│   └── users.module.ts
├── parcels/           # Parcels module
│   ├── dto/          # Data transfer objects
│   ├── schemas/      # Mongoose schemas
│   ├── parcels.controller.ts
│   ├── parcels.service.ts
│   └── parcels.module.ts
├── gateway/          # WebSocket gateway
│   ├── events.gateway.ts
│   └── events.module.ts
├── common/           # Shared resources
│   ├── decorators/   # Custom decorators
│   └── guards/       # Auth guards
├── app.module.ts     # Root module
└── main.ts          # Application entry point
```

## MongoDB Collections

### users
- name: string
- email: string (unique)
- password: string (hashed)
- role: enum (admin, agent, customer)
- phone?: string
- address?: string
- isActive: boolean
- timestamps

### parcels
- trackingNumber: string (unique, auto-generated)
- senderId: ObjectId (ref: User)
- agentId?: ObjectId (ref: User)
- recipientName: string
- recipientPhone: string
- recipientAddress: string
- pickupAddress: string
- weight: number
- description?: string
- status: enum (pending, picked_up, in_transit, out_for_delivery, delivered, failed, returned)
- statusHistory: Array<{ status, timestamp, location?, note? }>
- estimatedDelivery?: Date
- cost: number
- currentLocation?: { lat: number, lng: number }
- timestamps

## Testing

```bash
# Unit tests
pnpm test

# E2E tests
pnpm test:e2e

# Test coverage
pnpm test:cov
```

## License

MIT
# ParcelTrack-backend
