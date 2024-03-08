import dotenv from "dotenv";
dotenv.config();
const config = {
  MONGO_URL: process.env.MONGO_URL,
  RPC: process.env.RPC,
  FACTORY_ADDRESS: process.env.FACTORY_ADDRESS,
  WETH_ADDRESS: process.env.WETH_ADDRESS,
  BUY_CONTRACT: process.env.BUY_CONTRACT,
  TOKEN_CONTRACT: process.env.TOKEN_CONTRACT,
  ROUTER_CONTRACT: process.env.ROUTER_CONTRACT,
  CHAIN_ID: process.env.CHAIN_ID,
};
export default config;
