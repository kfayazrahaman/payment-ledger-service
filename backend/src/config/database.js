import mongoose from 'mongoose';
import dotenv from 'dotenv';

import dns from "node:dns";

// Load environment variables from .env file
dotenv.config();

/**
 * MongoDB Connection Configuration
 * This module handles the connection to MongoDB Atlas using Mongoose
 * 
 * Key Differences from SQLite:
 * - Uses MongoDB Atlas for cloud-hosted database
 * - Mongoose provides ORM-like functionality with schemas
 * - Supports automatic schema validation
 * - Handles connection pooling automatically
 */ 

dns.setServers(["8.8.8.8", "8.8.4.4"]);

console.log(dns.getServers());

// Get MongoDB connection string from environment variables
const MONGODB_URI = process.env.DB_CONNECTION_STRING;

if (!MONGODB_URI) {
  throw new Error('DB_CONNECTION_STRING environment variable is not defined');
}

/**
 * Connect to MongoDB using Mongoose
 * This function should be called once during app initialization
 * 
 * @returns {Promise<void>} - Resolves when connection is successful
 * @throws {Error} - If connection fails
 */
export async function connectDatabase() {
  try {
    // Configure Mongoose connection options
    const mongooseOptions = {
      // Automatically create indexes defined in schemas
      autoIndex: true,
      // Maximum time to wait for connection
      connectTimeoutMS: 10000,
      // Maximum time for Mongoose to connect to MongoDB
      serverSelectionTimeoutMS: 5000,
      // Automatically update schema if structure changes
      autoCreate: true,
      // Use the native MongoDB driver connection pooling
      retryWrites: true,
      w: 'majority',
    };

    // Establish connection to MongoDB
    await mongoose.connect(MONGODB_URI, mongooseOptions);

    console.log('MongoDB connected successfully');
    console.log(`Database: ${mongoose.connection.db.databaseName}`);

    // Handle connection events
    mongoose.connection.on('disconnected', () => {
      console.warn('MongoDB disconnected');
    });

    mongoose.connection.on('error', (err) => {
      console.error('MongoDB connection error:', err);
    });

  } catch (error) {
    console.error('Failed to connect to MongoDB:', error.message);
    // Re-throw the error so the application can handle it
    throw error;
  }
}

/**
 * Disconnect from MongoDB
 * This should be called during graceful shutdown
 * 
 * @returns {Promise<void>}
 */
export async function disconnectDatabase() {
  try {
    await mongoose.disconnect();
    console.log('MongoDB disconnected successfully');
  } catch (error) {
    console.error('Error disconnecting from MongoDB:', error);
    throw error;
  }
}

/**
 * Get the Mongoose connection instance
 * Useful for accessing connection metadata or events
 * 
 * @returns {mongoose.Connection} - The Mongoose connection object
 */
export function getConnection() {
  return mongoose.connection;
}

/**
 * Export mongoose for use in models
 * Models import mongoose to define schemas
 */
export default mongoose;
