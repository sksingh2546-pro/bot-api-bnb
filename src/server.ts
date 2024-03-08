import express, { Application } from "express";
import dotenv from "dotenv";
import bodyParser from "body-parser";
import cors from "cors";
import router from "./router";
import dbConnect from "./helpers/db";
import cronScheduler from "./helpers/cronScheduler";
dotenv.config();

class ExpressServer {
  private app: Application;
  constructor() {
    this.app = express();
    this.app.use(cors());
    this.app.use(bodyParser.json());
    this.app.use(bodyParser.urlencoded({ extended: false }));
    dbConnect.dbConnection();
    cronScheduler.schedule();
    this.initializeRouter();
  }

  private initializeRouter() {
    router(this.app);
    return this;
  }

  public listen(port: number) {
    this.app.listen(port, () => {
      console.log(`Server is running on port ${port}`);
    });
  }
}

export default new ExpressServer();
