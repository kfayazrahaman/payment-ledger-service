import express from "express";
import cors from "cors";
import { ApolloServer } from "apollo-server-express";
import { connectDatabase, disconnectDatabase } from "./config/database.js";
import { typeDefs } from "./graphql/schema.js";
import { resolvers } from "./graphql/resolvers.js";

// Load environment variables from .env file
import dotenv from "dotenv";
dotenv.config();

const PORT = process.env.PORT || 6500;
const BACKEND_URL = process.env.BACKEND_URL || `http://localhost:${PORT}`;

/**
 * Start the server
 *
 * This function:
 * 1. Connects to MongoDB using Mongoose
 * 2. Creates Express server with CORS
 * 3. Sets up Apollo GraphQL server
 * 4. Starts HTTP server
 *
 * Error handling ensures graceful shutdown on failure
 */
async function startServer() {
  try {
    // Step 1: Connect to MongoDB
    // This replaces the previous SQLite initialization
    console.log("🔗 Connecting to MongoDB...");
    await connectDatabase();

    // Step 2: Create Express app
    const app = express();

    // Step 3: Configure middleware
    // CORS: Allow requests from frontend
    app.use(
      cors({
        origin: [
          "http://localhost:3000",
          "http://localhost:5173",
          "https://studio.apollographql.com",
        ],
        credentials: true,
      }),
    );

    // Parse JSON request bodies
    app.use(express.json());

    // Step 4: Health check endpoint (useful for monitoring)
    app.get("/health", (req, res) => {
      res.json({
        status: "ok",
        timestamp: new Date(),
        database: "MongoDB (Mongoose)",
        message: "Payment Ledger Service is running",
      });
    });

    // Step 5: Setup Apollo GraphQL Server
    // Apollo provides GraphQL endpoint at /graphql
    const apolloServer = new ApolloServer({
      typeDefs,
      resolvers,
      // Enable detailed error messages in development
      introspection: process.env.NODE_ENV !== "production",
    });

    // Start Apollo server
    await apolloServer.start();
    console.log("Apollo GraphQL server initialized");

    // Apply Apollo middleware to Express
    apolloServer.applyMiddleware({ app, path: "/graphql" });

    // Step 6: Start HTTP server
    const server = app.listen(PORT, () => {
      console.log("Payment Ledger Service Started");
      console.log(` Backend URL: ${BACKEND_URL}`);
      console.log(` GraphQL Endpoint: ${BACKEND_URL}/graphql`);
      console.log(`Health Check: ${BACKEND_URL}/health`);
    });

    // Step 7: Handle graceful shutdown
    // Listen for termination signals (SIGINT, SIGTERM)
    process.on("SIGINT", async () => {

      // Close Apollo server
      await apolloServer.stop();
      console.log("Apollo server closed");

      // Disconnect MongoDB
      await disconnectDatabase();
      console.log("MongoDB disconnected");

      // Close HTTP server
      server.close(() => {
        console.log("HTTP server closed");
        process.exit(0);
      });
    });
  } catch (error) {
   
    console.error("Failed to start server");
    console.error(error.message);
    // Exit process on startup failure
    process.exit(1);
  }
}

// Start the server
startServer();
