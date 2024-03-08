import * as mongoose from "mongoose";

const Category = new mongoose.Schema(
  {
    tokenIn: {
      type: String,
      required: false,
      default: null,
    },
    tokenOut: {
      type: String,
      required: false,
      default: null,
    },
    pairAddress: {
      type: String,
      required: true,
    },
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
    slippage: {
      type: Number,
      required: false,
    },
    type: {
      type: String,
      enum: ["Buy", "Buytax", "Undefined"],
      required: true,
    },
    status: {
      type: String,
      enum: ["process", "pending", "done"],
      required: false,
      default: "process",
    },
    chatId: {
      type: String,
      required: true,
    },
  },
  { timestamps: true, versionKey: false }
);
export default mongoose.model("orders", Category);
