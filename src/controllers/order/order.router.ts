import express from "express";
import controller from "./order.controller";
export default express
  .Router()
  .post("/buyOrder", controller.createBuyOrder)
  .post("/sellOrder", controller.normalSell)
  .post("/quickSell", controller.createQuickSellOrder)
  .post("/autoSell", controller.autoSell)
  .get("/getAutoSell", controller.getAutoSell)
  .delete("/deleteAutoSellOrder",controller.deleteAutoSellOrder)
  .delete("/cancelCopyTrade",controller.cancelCopyTrade)
  .post("/limitOrders", controller.limitOrders)
  .get("/getLimitOrder", controller.getLimitOrder)
  .get("/getCopyTrade", controller.getCopyTrade)
  .post("/tokenInfo", controller.tokenInfo)
  .post("/copyTrade", controller.copyTrade)
  .post("/copyTradeBuy", controller.copyTradeBuy)
  .post("/tokenInfoCopy", controller.tokenInfoCopy)
  .post("/autoSellCopy", controller.autoSellCopy)
  .delete("/deleteLimitOrder",controller.deleteLimitOrder);



  
