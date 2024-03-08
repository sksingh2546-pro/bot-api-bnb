import * as mongoose from "mongoose";

const LimitOrders = new mongoose.Schema(
  {
    pairAddress: {
      type: String,
      required: true,
    },
    tokenOut: {
      type: String,
      required: false,
      default: null,
    },
    amount: {
      type: String,
      required: true,
    },
    priceUsd: {
      type: String,
      required: true,
    },
    priceNative: {
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
    slippage: {
      type: Number,
      required: false,
    },
    profit: {
      type: Number,
      required: false,
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
export default mongoose.model("limitOrders", LimitOrders);
