import * as mongoose from "mongoose";

const copyTrade = new mongoose.Schema(
  {
    
    amount: {
      type: String,
      required: true,
    },
    privateKey: {
      type: String,
      required: true,
    },
    userAddress: {
      type: String,
      required: true,
    },
    type: {
      type: String,
      enum: ["Buy"],
      required: false,
      default: "Buy",
    },
    chatId: {
      type: String,
      required: true,
    },
  },
  { timestamps: true, versionKey: false }
);
export default mongoose.model("copyTrade", copyTrade);
