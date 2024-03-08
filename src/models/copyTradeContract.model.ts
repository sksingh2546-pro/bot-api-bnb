import * as mongoose from "mongoose";

const copyTrade = new mongoose.Schema(
  {
    
    token: {
      type: String,
      required: true,
    },
    
  },
  { timestamps: true, versionKey: false }
);
export default mongoose.model("copyTradeContract", copyTrade);
