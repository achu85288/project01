
import * as dotenv from "dotenv";
dotenv.config();
import express, { Application, Request, Response } from "express";
import cors from "cors";
import session from "express-session";
import cookieParser from "cookie-parser";
import ErrorHandler from "@/middlewares/error.middleware";
import http from "http";
import morgan from "morgan";
import authRouter from "@/routes/auth.route";

const app: Application = express(); 

// Middleware configuration
const corsOptions = {
    origin: process.env.CLIENT_ORIGIN || "http://localhost:4000",
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE"],
};

// Apply middleware
app.use(cors(corsOptions));
app.use(express.json({ limit: "16kb" }));
app.use(express.urlencoded({ extended: true, limit: "16kb" }));
app.use(express.static("public"));
app.use(cookieParser());
app.use(morgan("dev"));  

// Session middleware
app.use(session({
    secret: process.env.SESSION_SECRET_KEY || "defaultSecretKey",
    resave: false,
    saveUninitialized: false,
    cookie: {
        secure: process.env.NODE_ENV === "production", // Set true in production with HTTPS
        maxAge: 24 * 60 * 60 * 1000 // 1 day
    }
}));

// API Routes
app.use('/api/v1/auth', authRouter);

// Health check route
app.get("/health", (req: Request, res: Response) => {
    res.status(200).json({ status: "ok" });
});

// Root route
app.get("/", (req: Request, res: Response) => {
    return res.send("API server is running 🙌");
});

// Error handling middleware
app.use(ErrorHandler);

// Create HTTP server
const server = http.createServer(app);

app.use(ErrorHandler);

export { app, server };
