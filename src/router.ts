import express, { Application } from "express";
import healthCheckController from "./controllers/healthCheck.controller";
import orderRouter from "./controllers/order/order.router";

export default function router(server: Application): void {
  server.use(
    "/healthCheck",
    express.Router().get("/", healthCheckController.healthCheck)
  );
  server.use("/api/v1/order",orderRouter );
}
