import mongoose from "mongoose";
import config from "../config";

class DbClass {
  dbConnection = async () => {
    let options: any = {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      keepAlive: true,
    };
    try {
      if (config.MONGO_URL) {
        const connect = mongoose.connect(config.MONGO_URL, options);
        const db = mongoose.connection;
        db.on("error", console.error.bind(console, "connection error: "));
        db.once("open", function () {
          console.log("Connected successfully");
        });
        mongoose.set("strictQuery", false);
      }
    } catch (error) {
      console.log("====>>>>", error);
    }
  };
}
export default new DbClass();
