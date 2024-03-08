import cron from "node-cron";
import config from "../config";
import ordersModel from "../models/orders.model";
import factoryABI from "../abi/factory.json";

import Web3 from "web3";
import { AbiItem } from "web3-utils";
const web3 = new Web3(config.RPC || "");
class Cron {
  public contract: any;
  constructor() {
    this.contract = new web3.eth.Contract(
      factoryABI as AbiItem[],
      config.FACTORY_ADDRESS
    );
  }
  public schedule = async () => {
    cron.schedule("*/15 * * * * *", async () => {
      console.log("cron chal rhi h");
      const orders = await ordersModel.find({
        status: "process",
        pairAddress: { $in: "0x0000000000000000000000000000000000000000" },
      });
      if (!orders.length) return console.log("orders not found!!!");
      for (let i = 0; i < orders.length; i++) {
        const pairAddress = await this.contract.methods
          .getPair(orders[i].tokenOut, config.WETH_ADDRESS)
          .call();
        if (pairAddress == "0x0000000000000000000000000000000000000000") {
          console.log("pair still not found!!!", orders[i]._id);
        } else {
          console.log("paiar mil gaya", orders[i]._id);
          const update = await ordersModel.findByIdAndUpdate(orders[i]._id, {
            $set: {
              pairAddress: pairAddress,
            },
          });
        }
      }
    });
  };
}

export default new Cron();
