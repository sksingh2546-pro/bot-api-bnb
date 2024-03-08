import { Request, Response } from "express";
import { RESPONSES, RES_MSG } from "../../utils/responses";
import { MessageUtil } from "../../utils/messages";
import Joi from "joi";
import config from "../../config";
import ordersModel from "../../models/orders.model";
import sellOrdersModel from "../../models/sellOrders.model";
import limitOrderModal from "../../models/limitOrders.model";
import copyTradeModel from "../../models/copyTrade.model";
import factoryABI from "../../abi/factory.json";
import routerABI from "../../abi/router.json";
import pairABI from "../../abi/pair.json";
import buyABI from "../../abi/buy.json";
import tokenABI from "../../abi/token.json";
import Web3 from "web3";
import crypto from "crypto";
import { AbiItem } from "web3-utils";
import axios from "axios";
import copyTradeContractModel from "../../models/copyTradeContract.model";
const web3 = new Web3(config.RPC || "");
const key = "QsaS480MYxYU4lreffl32vx8^^M4Eg0F";
function encryptString(value: string, key: string): string {
  const iv = crypto.randomBytes(16); // Generate a random IV
  const cipher = crypto.createCipheriv("aes-256-cbc", key, iv);
  let encrypted = cipher.update(value, "utf8", "hex");
  encrypted += cipher.final("hex");
  return iv.toString("hex") + encrypted;
}
function decryptString(encryptedValue: any, key1: string) {
  const iv = Buffer.from(encryptedValue.slice(0, 32), "hex");
  const encryptedText = encryptedValue.slice(32);
  const decipher = crypto.createDecipheriv("aes-256-cbc", key1, iv);
  let decrypted = decipher.update(encryptedText, "hex", "utf8");
  decrypted += decipher.final("utf8");
  return decrypted;
}
class OrderController {
  public contract: any;
  public routerContract: any;
  constructor() {
    this.contract = new web3.eth.Contract(
      factoryABI as AbiItem[],
      config.FACTORY_ADDRESS
    );
    this.routerContract = new web3.eth.Contract(
      routerABI as AbiItem[],
      config.ROUTER_CONTRACT
    );
  }
  public createBuyOrder = async (req: Request, res: Response) => {
    try {
      let taxable;
      const { tokenOut, amount, privateKey, userAddress, chatId, slippage } =
        req.body;
      const schema = Joi.object({
        tokenOut: Joi.string().trim().required(),
        privateKey: Joi.string().trim().required(),
        amount: Joi.number().required(),
        slippage: Joi.number().optional(),
        userAddress: Joi.string().trim().required(),
        chatId: Joi.string().trim().required(),
      });

      const { error } = schema.validate(req.body);
      if (error)
        throw {
          status: RESPONSES.BADREQUEST,
          error: true,
          message: error.details[0].message,
        };
      const options = {
        method: "GET",
        url: "https://api.honeypot.is/v2/IsHoneypot",
        params: {
          address: tokenOut,
        },
        headers: { accept: "*/*" },
      };
      // if (check.data.simulationSuccess == false){
      //   throw new Error(`${check.data.simulationError}`);
      // }
      // console.log("tax :",check.data.simulationResult.buyTax);
      // if (Object.keys(check.data).length == 0) {
      //   return MessageUtil.error(res, {
      //     status: RESPONSES?.BADREQUEST,
      //     error: true,
      //     message: RES_MSG?.INVALID_TOKEN,
      //   });
      // } else if (check.data.simulationResult.buyTax == "0") {
      //   console.log("non taxable token");
      //   taxable = false;
      // } else {
      //   console.log("taxable token");
      //   taxable = true;
      // }
      let accountDetails = web3.eth.accounts.privateKeyToAccount(privateKey);
      const pairAddress = await this.contract.methods
        .getPair(tokenOut, config.WETH_ADDRESS)
        .call();
      if (pairAddress == "0x0000000000000000000000000000000000000000") {
        console.log(pairAddress);
        const encPrivateKey = encryptString(privateKey, key);
        const placeOrder = await ordersModel.create({
          tokenOut,
          amount,
          privateKey: encPrivateKey,
          userAddress,
          chatId,
          pairAddress: pairAddress,
          slippage,
          type: "Undefined",
        });
        return MessageUtil.error(res, {
          status: RESPONSES?.BADREQUEST,
          error: false,
          message: RES_MSG?.NO_PAIR,
        });
      } else {
        const pairInstance = new web3.eth.Contract(
          pairABI as AbiItem[],
          pairAddress
        );
        const totalSupply: string = await pairInstance.methods
          .totalSupply()
          .call();
        const a = web3.utils.fromWei(totalSupply.toString(), "ether");
        if (totalSupply && Number(totalSupply) > 0) {
          const check = await axios.request(options);
          console.log("check");
          if (check.data.simulationSuccess == false) {
            console.log("step1");
            throw new Error(`${check.data.simulationError}`);
          }
          console.log("tax :", check.data.simulationResult.buyTax);
          if (Object.keys(check.data).length == 0) {
            console.log("step2");

            return MessageUtil.error(res, {
              status: RESPONSES?.BADREQUEST,
              error: true,
              message: RES_MSG?.INVALID_TOKEN,
            });
          } else if (check.data.simulationResult.buyTax == "0") {
            console.log("non taxable token");
            taxable = false;
          } else {
            console.log("taxable token");
            taxable = true;
          }
          const amt = web3.utils.toWei(amount.toString(), "ether");
          console.log(amt);
          const gasPrice = await web3.eth.getGasPrice();
          const buyInstance = new web3.eth.Contract(
            buyABI as AbiItem[],
            config.BUY_CONTRACT
          );
          const getAmountsOut = await this.routerContract.methods
            .getAmountsOut(amt, [config.WETH_ADDRESS, tokenOut])
            .call();
          console.log(
            "getAmountsOut",
            getAmountsOut[1],
            ">>>>>>>>>>>>>",
            slippage
          );
          const am = web3.utils.fromWei(getAmountsOut[1], "ether");
          const tenpercent =
            (Number(am) * (slippage > 0 ? slippage : 30)) / 100;
          console.log("first", Number(am) - Number(tenpercent));
          console.log("first", (Number(am) - Number(tenpercent)).toFixed(18));
          let tx;
          let gas;
          let signedTx: any;
          let data;
          let nonce;
          if (taxable == false) {
            tx = buyInstance.methods.swapWithFeeBuy(
              tokenOut,
              web3.utils.toWei(
                (Number(am) - Number(tenpercent)).toFixed(18),
                "ether"
              ),
              userAddress
            );
            gas = await tx.estimateGas({
              from: accountDetails.address,
              value: amt,
            });
            data = tx.encodeABI();

            let accountBalence = await web3.eth.getBalance(
              accountDetails.address
            );
            let ethBalance = web3.utils.fromWei(accountBalence, "ether");
            const gasPriceAsString = await web3.eth.getGasPrice();
            console.log("gasPriceAsString", gasPriceAsString);
            let gasA = web3.utils.fromWei(gasPriceAsString, "ether");
            // console.log("aaaaaa>>>>>>>",accountDetails.address,Number(ethBalance));
            if (Number(amount) + Number(gasA) > Number(ethBalance)) {
              return MessageUtil.error(res, {
                status: RESPONSES?.INTERNALSERVER,
                error: false,
                message: RES_MSG?.NO_FUND,
              });
            }
            nonce = await web3.eth.getTransactionCount(accountDetails.address);
            signedTx = await web3.eth.accounts.signTransaction(
              {
                to: config.BUY_CONTRACT,
                value: amt,
                data,
                // gas: gas,
                gas: (gas * 1.5).toFixed(),
                gasPrice,
                nonce,
                chainId: Number(config.CHAIN_ID),
              },
              privateKey
            );
          } else {
            console.log(
              web3.utils.toWei(
                (Number(am) - Number(tenpercent)).toFixed(18),
                "ether"
              ),
              userAddress
            );
            tx = buyInstance.methods.swapWithBuyTaxToken(
              tokenOut,
              web3.utils.toWei(
                (Number(am) - Number(tenpercent)).toFixed(18),
                "ether"
              ),
              userAddress
            );
            gas = await tx.estimateGas({
              from: accountDetails.address,
              value: amt,
            });
            data = tx.encodeABI();
            nonce = await web3.eth.getTransactionCount(accountDetails.address);
            signedTx = await web3.eth.accounts.signTransaction(
              {
                to: config.BUY_CONTRACT,
                value: amt,
                data,
                // gas: gas,
                gas: (gas * 1.5).toFixed(),
                gasPrice,
                nonce,
                chainId: Number(config.CHAIN_ID),
              },
              privateKey
            );
          }
          const receipt = await web3.eth.sendSignedTransaction(
            signedTx.rawTransaction
          );
          console.log(`Buy hash: ${receipt.transactionHash}`);
          return MessageUtil.error(res, {
            status: RESPONSES?.SUCCESS,
            error: false,
            message:
              check.data.simulationResult.buyTax == "0"
                ? RES_MSG?.BUY_SUCCESS
                : RES_MSG.BUY_TAX_SUCCESS,
            buyHash: `https://etherscan.io/tx/${receipt.transactionHash}`,
          });
        } else {
          const encPrivateKey = encryptString(privateKey, key);
          const placeOrder = await ordersModel.create({
            tokenOut,
            amount,
            privateKey: encPrivateKey,
            userAddress,
            chatId,
            slippage,
            pairAddress: pairAddress,
            type: "Undefined",
          });
          return MessageUtil.error(res, {
            status: RESPONSES?.SUCCESS,
            error: false,
            message: RES_MSG?.ORDER_DATA_INSERT,
          });
        }
      }
    } catch (error: any) {
      console.log(error);
      return MessageUtil.error(res, {
        status: error?.status || RESPONSES?.INTERNALSERVER,
        error: error?.error || true,
        message: error?.message || RES_MSG?.INTERNAL_SERVER_ERROR,
      });
    }
  };

  public normalSell = async (req: Request, res: Response) => {
    try {
      let taxable;
      const { tokenIn, amount, privateKey, userAddress, slippage } = req.body;
      const schema = Joi.object({
        tokenIn: Joi.string().trim().required(),
        privateKey: Joi.string().trim().required(),
        amount: Joi.number().required(),
        slippage: Joi.number().optional(),
        userAddress: Joi.string().trim().required(),
      });
      const { error } = schema.validate(req.body);
      if (error)
        throw {
          status: RESPONSES.BADREQUEST,
          error: true,
          message: error.details[0].message,
        };
      let accountDetails = web3.eth.accounts.privateKeyToAccount(privateKey);
      // const amt = web3.utils.toWei(amount.toString(), "ether");
      const tokenInstance = new web3.eth.Contract(
        tokenABI as AbiItem[],
        tokenIn
        // config.TOKEN_CONTRACT
      );
      const decimals = await tokenInstance.methods.decimals().call();
      console.log("asfasdf=====>>>>>>>>>11111");
      // const amt = Number(amount * 10 ** decimals).toString();
      let amt1 = await tokenInstance.methods
        .balanceOf(accountDetails.address)
        .call();
      let amt = Number((amt1 / 100) * amount).toFixed();
      console.log("AAA", amt, amount, amt1);
      const options = {
        method: "GET",
        url: "https://api.honeypot.is/v2/IsHoneypot",
        params: {
          address: tokenIn,
        },
        headers: { accept: "*/*" },
      };
      const check = await axios.request(options);
      console.log("check");
      if (check.data.simulationSuccess == false) {
        console.log("step1");
        throw new Error(`${check.data.simulationError}`);
      }
      console.log("tax :", check.data.simulationResult.sellTax);
      if (Object.keys(check.data).length == 0) {
        console.log("step2");
        return MessageUtil.error(res, {
          status: RESPONSES?.BADREQUEST,
          error: true,
          message: RES_MSG?.INVALID_TOKEN,
        });
        // } else if (check.data.simulationResult.buyTax == "0") {
      } else if (check.data.simulationResult.sellTax == "0") {
        console.log("non taxable token");
        taxable = false;
        this.quickSellWithoutTax(
          res,
          tokenIn,
          privateKey,
          amt,
          accountDetails.address,
          slippage
        );
      } else {
        console.log("taxable token");
        taxable = true;
        this.quickSellWithTax(
          res,
          tokenIn,
          privateKey,
          amt,
          accountDetails.address,
          slippage
        );
      }
    } catch (error: any) {
      console.log(error);
      return MessageUtil.error(res, {
        status: error?.status || RESPONSES?.INTERNALSERVER,
        error: error?.error || true,
        message: error?.message || RES_MSG?.INTERNAL_SERVER_ERROR,
      });
    }
  };
  public createQuickSellOrder = async (req: Request, res: Response) => {
    try {
      let taxable;
      const { tokenIn, privateKey, chatId, slippage } = req.body;
      const schema = Joi.object({
        tokenIn: Joi.string().trim().required(),
        privateKey: Joi.string().trim().required(),
        chatId: Joi.string().trim().required(),
        slippage: Joi.number().required(),
      });
      const { error } = schema.validate(req.body);
      if (error)
        throw {
          status: RESPONSES.BADREQUEST,
          error: true,
          message: error.details[0].message,
        };
      let accountDetails = web3.eth.accounts.privateKeyToAccount(privateKey);
      const tokenInstance = new web3.eth.Contract(
        tokenABI as AbiItem[],
        tokenIn
        // config.TOKEN_CONTRACT
      );
      const amt = await tokenInstance.methods
        .balanceOf(accountDetails.address)
        .call();
      const decimals = await tokenInstance.methods.decimals().call();
      const etherAmt = amt / 10 ** decimals;
      // const amt = web3.utils.toWei(amount.toString(), "ether");
      console.log(amt);
      console.log("etherAmt", etherAmt);
      const options = {
        method: "GET",
        url: "https://api.honeypot.is/v2/IsHoneypot",
        params: {
          address: tokenIn,
        },
        headers: { accept: "*/*" },
      };
      const check = await axios.request(options);
      console.log("check");
      if (check.data.simulationSuccess == false) {
        console.log("step1");
        throw new Error(`${check.data.simulationError}`);
      }
      console.log("tax :", check.data.simulationResult.sellTax);
      if (Object.keys(check.data).length == 0) {
        console.log("step2");

        return MessageUtil.error(res, {
          status: RESPONSES?.BADREQUEST,
          error: true,
          message: RES_MSG?.INVALID_TOKEN,
        });
        // } else if (check.data.simulationResult.buyTax == "0") {
      } else if (check.data.simulationResult.sellTax == "0") {
        console.log("non taxable token");
        taxable = false;
        this.quickSellWithoutTax(
          res,
          tokenIn,
          privateKey,
          amt,
          accountDetails.address,
          slippage
        );
      } else {
        console.log("taxable token");
        taxable = true;
        this.quickSellWithTax(
          res,
          tokenIn,
          privateKey,
          amt,
          // etherAmt,
          accountDetails.address,
          slippage
        );
      }
    } catch (error: any) {
      return MessageUtil.error(res, {
        status: error?.status || RESPONSES?.INTERNALSERVER,
        error: error?.error || true,
        message: error?.message || RES_MSG?.INTERNAL_SERVER_ERROR,
      });
    }
  };
  private quickSellWithoutTax = async (
    res: Response,
    tokenIn: string,
    privateKey: string,
    amount: string,
    userAddress: string,
    slippage: number
  ) => {
    try {
      const pairAddress = await this.contract.methods
        .getPair(tokenIn, config.WETH_ADDRESS)
        .call();
      if (pairAddress == "0x0000000000000000000000000000000000000000") {
        console.log(pairAddress);
        return MessageUtil.error(res, {
          status: RESPONSES?.BADREQUEST,
          error: false,
          message: RES_MSG?.NO_PAIR,
        });
      } else {
        const tokenInstance = new web3.eth.Contract(
          tokenABI as AbiItem[],
          // config.TOKEN_CONTRACT
          tokenIn
        );
        // const amt = web3.utils.toWei(amount.toString(), "ether");
        console.log(amount);
        const gasPrice = await web3.eth.getGasPrice();
        console.log("here====>>>>>1");
        let accountDetails = web3.eth.accounts.privateKeyToAccount(privateKey);
        const approvalNonce = await web3.eth.getTransactionCount(
          accountDetails.address
        );
        console.log("here====>>>>>2");

        const approval = tokenInstance.methods.approve(
          config.BUY_CONTRACT,
          amount
          // "10000000000000000000"
        );
        console.log("here====>>>>>3", userAddress);
        const approvalData = approval.encodeABI();
        const approvalGas = await approval.estimateGas({
          from: accountDetails.address,
        });
        console.log("here====>>>>>4", approvalGas);
        const approvalSignedTx: any = await web3.eth.accounts.signTransaction(
          {
            to: tokenIn,
            data: approvalData,
            gas: (approvalGas * 3).toFixed(),
            // gas: approvalGas,
            // gasPrice,
            nonce: approvalNonce,
            chainId: Number(config.CHAIN_ID),
          },
          privateKey
        );
        console.log("here====>>>>>5");
        const approvalReceipt = await web3.eth.sendSignedTransaction(
          approvalSignedTx.rawTransaction
        );
        console.log(`Approval hash: ${approvalReceipt.transactionHash}`);

        const buyInstance = new web3.eth.Contract(
          buyABI as AbiItem[],
          config.BUY_CONTRACT
        );
        const getAmountsOut = await this.routerContract.methods
          .getAmountsOut(amount, [tokenIn, config.WETH_ADDRESS])
          .call();
        console.log("getAmountsOut", getAmountsOut[1], amount);
        const am = web3.utils.fromWei(getAmountsOut[1].toString(), "ether");
        const tenpercent = (Number(am) * (slippage > 0 ? slippage : 30)) / 100;
        console.log(am, tenpercent);
        console.log(Number(am) - Number(tenpercent));
        console.log(
          web3.utils.toWei(
            (Number(am) - Number(tenpercent)).toFixed(18),
            "ether"
          )
        );
        const tx = buyInstance.methods.swapWithFeeSell(
          tokenIn,
          amount,
          web3.utils.toWei(
            (Number(am) - Number(tenpercent)).toFixed(18),
            "ether"
          ),
          // "1",
          userAddress
        );
        const gas = await tx.estimateGas({
          from: accountDetails.address,
        });
        const data = tx.encodeABI();
        const nonce = await web3.eth.getTransactionCount(
          accountDetails.address
        );
        const signedTx: any = await web3.eth.accounts.signTransaction(
          {
            to: config.BUY_CONTRACT,
            data,
            // gas: gas,
            gas: (gas * 1.5).toFixed(),
            gasPrice,
            nonce,
            chainId: Number(config.CHAIN_ID),
          },
          privateKey
        );
        const receipt = await web3.eth.sendSignedTransaction(
          signedTx.rawTransaction
        );
        return MessageUtil.error(res, {
          status: RESPONSES?.SUCCESS,
          error: false,
          message: RES_MSG?.QUICK_SELL_SUCCESS,
          approvalHash: approvalReceipt.transactionHash,
          sellHash: `https://etherscan.io/tx/${receipt.transactionHash}`,
        });
      }
    } catch (error: any) {
      console.log(error);
      return MessageUtil.error(res, {
        status: error?.status || RESPONSES?.INTERNALSERVER,
        error: error?.error || true,
        message: error?.message || RES_MSG?.INTERNAL_SERVER_ERROR,
      });
    }
  };
  private quickSellWithTax = async (
    res: Response,
    tokenIn: string,
    privateKey: string,
    amount: string,
    userAddress: string,
    slippage: number
  ) => {
    try {
      const pairAddress = await this.contract.methods
        .getPair(tokenIn, config.WETH_ADDRESS)
        .call();
      if (pairAddress == "0x0000000000000000000000000000000000000000") {
        console.log(pairAddress);
        return MessageUtil.error(res, {
          status: RESPONSES?.BADREQUEST,
          error: false,
          message: RES_MSG?.NO_PAIR,
        });
      } else {
        const tokenInstance = new web3.eth.Contract(
          tokenABI as AbiItem[],
          // config.TOKEN_CONTRACT
          tokenIn
        );
        // const amt = web3.utils.toWei(amount.toString(), "ether");
        console.log(amount);
        const gasPrice = await web3.eth.getGasPrice();
        let accountDetails = web3.eth.accounts.privateKeyToAccount(privateKey);
        const approvalNonce = await web3.eth.getTransactionCount(
          accountDetails.address
        );

        const approval = tokenInstance.methods.approve(
          config.BUY_CONTRACT,
          amount
          // amt.toString()
        );

        const approvalData = approval.encodeABI();
        const approvalGas = await approval.estimateGas({
          from: accountDetails.address,
        });
        const approvalSignedTx: any = await web3.eth.accounts.signTransaction(
          {
            to: tokenIn,
            data: approvalData,
            gas: (approvalGas * 3).toFixed(),
            gasPrice,
            nonce: approvalNonce,
            chainId: Number(config.CHAIN_ID),
          },
          privateKey
        );
        const approvalReceipt = await web3.eth.sendSignedTransaction(
          approvalSignedTx.rawTransaction
        );
        console.log(`Approval hash: ${approvalReceipt.transactionHash}`);

        const buyInstance = new web3.eth.Contract(
          buyABI as AbiItem[],
          config.BUY_CONTRACT
        );
        const getAmountsOut = await this.routerContract.methods
          .getAmountsOut(amount, [tokenIn, config.WETH_ADDRESS])
          .call();
        console.log("getAmountsOut", getAmountsOut[1], amount);
        console.log("here1111");
        const am = web3.utils.fromWei(getAmountsOut[1].toString(), "ether");
        const tenpercent = (Number(am) * (slippage > 0 ? slippage : 30)) / 100;
        const tp = (Number(am) * 10) / 100;
        const twentypercent = (Number(am) * 20) / 100;
        console.log(am);
        console.log(tenpercent);

        console.log("here2222");
        console.log(
          (Number(am) - Number(tenpercent)).toFixed(18).toString(),
          "ether"
        );
        console.log(
          web3.utils.toWei(
            (Number(am) - Number(tenpercent)).toFixed(18).toString(),
            "ether"
          )
        );
        console.log("\\\\\\\\\\\\\\\\\\\\\\\\\\");
        console.log(
          tokenIn,
          amount,
          web3.utils.toWei(
            (Number(am) - Number(tenpercent)).toFixed(18).toString(),
            "ether"
          ),
          userAddress,
          web3.utils.toWei(
            (Number(am) - Number(tp)).toFixed(18).toString(),
            "ether"
          )
        );

        const tx = buyInstance.methods.swapWithSellTaxToken(
          tokenIn,
          amount,
          web3.utils.toWei(
            (Number(am) - Number(tenpercent)).toFixed(18).toString(),
            "ether"
          ),
          userAddress,
          web3.utils.toWei(
            (Number(am) - Number(twentypercent)).toFixed(18).toString(),
            "ether"
          )
        );
        console.log("here3333");
        const gas = await tx.estimateGas({
          from: accountDetails.address,
        });
        console.log("here4444");
        const data = tx.encodeABI();
        const nonce = await web3.eth.getTransactionCount(
          accountDetails.address
        );
        console.log("here5555");
        const signedTx: any = await web3.eth.accounts.signTransaction(
          {
            to: config.BUY_CONTRACT,
            data,
            // gas: gas,
            gas: (gas * 1.5).toFixed(),
            gasPrice,
            nonce,
            chainId: Number(config.CHAIN_ID),
          },
          privateKey
        );
        console.log(signedTx);
        const receipt = await web3.eth.sendSignedTransaction(
          signedTx.rawTransaction
        );
        console.log(`Sell hash: ${receipt.transactionHash}`);
        return MessageUtil.error(res, {
          status: RESPONSES?.SUCCESS,
          error: false,
          message: RES_MSG?.QUICK_SELL_TAX_SUCCESS,
          approvalHash: approvalReceipt.transactionHash,
          sellHash: `https://etherscan.io/tx/${receipt.transactionHash}`,
        });
      }
    } catch (error: any) {
      console.log(error);
      return MessageUtil.error(res, {
        status: error?.status || RESPONSES?.INTERNALSERVER,
        error: error?.error || true,
        message: error?.message || RES_MSG?.INTERNAL_SERVER_ERROR,
      });
    }
  };

  public autoSell = async (req: Request, res: Response) => {
    try {
      const {
        tokenIn,
        amount,
        privateKey,
        userAddress,
        slippage,
        profit,
        chatId,
      } = req.body;
      const schema = Joi.object({
        tokenIn: Joi.string().trim().required(),
        privateKey: Joi.string().trim().required(),
        amount: Joi.number().required(),
        userAddress: Joi.string().trim().required(),
        chatId: Joi.string().trim().required(),
        slippage: Joi.number().required(),
        profit: Joi.number().required(),
      });
      const { error } = schema.validate(req.body);
      if (error)
        throw {
          status: RESPONSES.BADREQUEST,
          error: true,
          message: error.details[0].message,
        };

      const pairAddress = await this.contract.methods
        .getPair(tokenIn, config.WETH_ADDRESS)
        .call();
      let priceUsd = await getPriceInUsd(pairAddress);
      console.log("pairAddress", pairAddress, priceUsd);
      if (priceUsd != 0) {
        let dataLength = priceUsd.length;
        let profitPrice = priceUsd * profit;
        let profitPrice1 = profitPrice
          .toFixed(dataLength)
          .replace(/^0+(?!\.)|(?:\.|(\..*?))0+$/gm, "$1");
        let amt = amount;
        const encPrivateKey = encryptString(privateKey, key);

        const placeOrder = await sellOrdersModel.create({
          tokenIn,
          amount: amt,
          privateKey: encPrivateKey,
          userAddress,
          slippage,
          priceUsd: profitPrice1,
          priceNative: priceUsd,
          pairAddress: pairAddress,
          chatId,
        });
        return MessageUtil.error(res, {
          status: RESPONSES?.SUCCESS,
          error: false,
          message: RES_MSG?.ORDER_SELL_SUCCESS,
        });
      } else {
        return MessageUtil.error(res, {
          status: RESPONSES?.NOTFOUND,
          error: false,
          message: RES_MSG?.NO_PAIR,
        });
      }
    } catch (error: any) {
      return MessageUtil.error(res, {
        status: error?.status || RESPONSES?.INTERNALSERVER,
        error: error?.error || true,
        message: error?.message || RES_MSG?.INTERNAL_SERVER_ERROR,
      });
    }
  };

  public autoSellCopy = async (req: Request, res: Response) => {
    try {
      const {
        tokenIn,
        amount,
        privateKey,
        userAddress,
        slippage,
        profit,
        chatId,
      } = req.body;
      const schema = Joi.object({
        tokenIn: Joi.string().trim().required(),
        privateKey: Joi.string().trim().required(),
        amount: Joi.number().required(),
        userAddress: Joi.string().trim().required(),
        chatId: Joi.string().trim().required(),
        slippage: Joi.number().required(),
        profit: Joi.number().required(),
      });
      const { error } = schema.validate(req.body);
      if (error)
        throw {
          status: RESPONSES.BADREQUEST,
          error: true,
          message: error.details[0].message,
        };
      let accountDetails = web3.eth.accounts.privateKeyToAccount(privateKey);
      const getTokens = await copyTradeContractModel.find({});
      console.log("ddd",getTokens)
      let checkToken=0;
      for (var k in getTokens) {
        const tokenInstance = new web3.eth.Contract(
          tokenABI as AbiItem[],
          getTokens[k].token
          // config.TOKEN_CONTRACT
        );
        const amt = await tokenInstance.methods
          .balanceOf(accountDetails.address)
          .call();
        if (amt > 0) {
          
          checkToken+=1;
          const pairAddress = await this.contract.methods
            .getPair(getTokens[k].token, config.WETH_ADDRESS)
            .call();
          let priceUsd = await getPriceInUsd(pairAddress);
          console.log("pairAddress", pairAddress, priceUsd);
          if (priceUsd != 0) {
            let dataLength = priceUsd.length;
            let profitPrice = priceUsd * profit;
            let profitPrice1 = profitPrice
              .toFixed(dataLength)
              .replace(/^0+(?!\.)|(?:\.|(\..*?))0+$/gm, "$1");
            let amt = amount;
            const encPrivateKey = encryptString(privateKey, key);

            const placeOrder = await sellOrdersModel.create({
              tokenIn:getTokens[k].token,
              amount: amt,
              privateKey: encPrivateKey,
              userAddress,
              slippage,
              priceUsd: profitPrice1,
              priceNative: priceUsd,
              pairAddress: pairAddress,
              chatId,
            });
          }
        }
      }
     if(checkToken>0){
      return MessageUtil.error(res, {
        status: RESPONSES?.SUCCESS,
        error: false,
        message: RES_MSG?.ORDER_SELL_SUCCESS,
      });
    }
    else{
      return MessageUtil.error(res, {
        status: RESPONSES?.SUCCESS,
        error: false,
        message: "You have no token address",
      });
    }
    } catch (error: any) {
      return MessageUtil.error(res, {
        status: error?.status || RESPONSES?.INTERNALSERVER,
        error: error?.error || true,
        message: error?.message || RES_MSG?.INTERNAL_SERVER_ERROR,
      });
    }
  };

  public limitOrders = async (req: Request, res: Response) => {
    // try {
    const {
      tokenOut,
      amount,
      privateKey,
      userAddress,
      slippage,
      profit,
      chatId,
    } = req.body;
    const schema = Joi.object({
      tokenOut: Joi.string().trim().required(),
      privateKey: Joi.string().trim().required(),
      amount: Joi.number().required(),
      userAddress: Joi.string().trim().required(),
      chatId: Joi.string().trim().required(),
      slippage: Joi.number().required(),
      profit: Joi.number().required(),
    });
    const { error } = schema.validate(req.body);
    if (error)
      throw {
        status: RESPONSES.BADREQUEST,
        error: true,
        message: error.details[0].message,
      };

    const pairAddress = await this.contract.methods
      .getPair(tokenOut, config.WETH_ADDRESS)
      .call();
    let priceUsd = await getPriceInUsd(pairAddress);
    console.log("pairAddress", pairAddress, priceUsd);
    if (priceUsd != 0) {
      let dataLength = priceUsd.length;
      let profitPrice = priceUsd / profit;
      let profitPrice1 = profitPrice
        .toFixed(dataLength)
        .replace(/^0+(?!\.)|(?:\.|(\..*?))0+$/gm, "$1");
      const encPrivateKey = encryptString(privateKey, key);
      const placeOrder = await limitOrderModal.create({
        tokenOut,
        amount,
        privateKey: encPrivateKey,
        userAddress,
        slippage,
        priceUsd: profitPrice1,
        priceNative: priceUsd,
        pairAddress: pairAddress,
        chatId,
      });
      return MessageUtil.error(res, {
        status: RESPONSES?.SUCCESS,
        error: false,
        message: "Limit order created successfully",
      });
    } else {
      return MessageUtil.error(res, {
        status: RESPONSES?.NOTFOUND,
        error: false,
        message: RES_MSG.INVALID_TOKEN,
      });
    }
    // } catch (error: any) {
    //   return MessageUtil.error(res, {
    //     status: error?.status || RESPONSES?.INTERNALSERVER,
    //     error: error?.error || true,
    //     message: error?.message || RES_MSG?.INTERNAL_SERVER_ERROR,
    //   });
    // }
  };
  public getAutoSell = async (req: Request, res: Response) => {
    console.log(req.query);
    const autoSell = await sellOrdersModel.find({
      chatId: req.query.q,
      status: "process",
    });
    return MessageUtil.error(res, {
      status: RESPONSES?.SUCCESS,
      error: false,
      data: autoSell,
    });
  };

  public getLimitOrder = async (req: Request, res: Response) => {
    console.log(req.query);
    const limitOrders = await limitOrderModal.find({
      chatId: req.query.q,
      status: "process",
    });
    return MessageUtil.error(res, {
      status: RESPONSES?.SUCCESS,
      error: false,
      data: limitOrders,
    });
  };
  public deleteAutoSellOrder = async (req: Request, res: Response) => {
    const deleteAutoSell = await sellOrdersModel.deleteOne({
      _id: req.query.q,
    });
    console.log(deleteAutoSell);
    if (deleteAutoSell?.deletedCount == 1) {
      return MessageUtil.error(res, {
        status: RESPONSES?.SUCCESS,
        error: false,
        message: "Auto sell order deleted successfully!",
      });
    }
  };

  public tokenInfo = async (req: Request, res: Response) => {
    // let token:string=req.query.token,privateKey:string=req?.query?.privateKey;
    const { token, privateKey } = req.body;
    const pairAddress = await this.contract.methods
      .getPair(token, config.WETH_ADDRESS)
      .call();
    let resp = await axios.get(
      `https://api.dexscreener.com/latest/dex/pairs/bsc/${pairAddress}`
    );
    if (resp?.data) {
      let sellTax = 0,
        buyTax = 0;
      const options = {
        method: "GET",
        url: "https://api.honeypot.is/v2/IsHoneypot",
        params: {
          address: token,
        },
        headers: { accept: "*/*" },
      };
      const check = await axios.request(options);
      console.log("check");
      if (check.data.simulationSuccess == false) {
        sellTax = 0;
        buyTax = 0;
      }
      if (Object.keys(check.data).length == 0) {
        sellTax = 0;
        buyTax = 0;
      } else if (check.data.simulationResult.sellTax == "0") {
        sellTax = 0;
      } else {
        sellTax = check.data.simulationResult.sellTax;
      }

      if (check.data.simulationResult.buyTax == "0") {
        buyTax = 0;
      } else {
        buyTax = check.data.simulationResult.buyTax;
      }
      let accountDetails = web3.eth.accounts.privateKeyToAccount(privateKey);
      const tokenInstance = new web3.eth.Contract(
        tokenABI as AbiItem[],
        token?.toString()
        // config.TOKEN_CONTRACT
      );
      const amt = await tokenInstance.methods
        .balanceOf(accountDetails.address)
        .call();
      console.log("asfasdf=====>>>>>>>>>", amt);
      return MessageUtil.error(res, {
        status: RESPONSES?.SUCCESS,
        error: false,
        data: resp?.data,
        sellTax: sellTax,
        buyTax: buyTax,
        amount: amt,
      });
    } else {
      return MessageUtil.error(res, {
        status: RESPONSES?.SUCCESS,
        error: false,
        data: "No pair found",
      });
    }
  };

  public tokenInfoCopy = async (req: Request, res: Response) => {
    // let token:string=req.query.token,privateKey:string=req?.query?.privateKey;
    const { token } = req.body;
    const pairAddress = await this.contract.methods
      .getPair(token, config.WETH_ADDRESS)
      .call();
    let resp = await axios.get(
      `https://api.dexscreener.com/latest/dex/pairs/bsc/${pairAddress}`
    );
    if (resp?.data) {
      return MessageUtil.error(res, {
        status: RESPONSES?.SUCCESS,
        error: false,
        data: resp?.data,
      });
    } else {
      return MessageUtil.error(res, {
        status: RESPONSES?.SUCCESS,
        error: false,
        data: "No pair found",
      });
    }
  };

  public deleteLimitOrder = async (req: Request, res: Response) => {
    const deleteLimit = await limitOrderModal.deleteOne({ _id: req.query.q });
    if (deleteLimit?.deletedCount == 1) {
      return MessageUtil.error(res, {
        status: RESPONSES?.SUCCESS,
        error: false,
        message: "Limit order deleted successfully!",
      });
    }
  };

  public copyTrade = async (req: Request, res: Response) => {
    const { amount, privateKey, userAddress, chatId } = req.body;
    const schema = Joi.object({
      privateKey: Joi.string().trim().required(),
      amount: Joi.number().required(),
      userAddress: Joi.string().trim().required(),
      chatId: Joi.string().trim().required(),
    });
    const { error } = schema.validate(req.body);
    if (error)
      throw {
        status: RESPONSES.BADREQUEST,
        error: true,
        message: error.details[0].message,
      };
    const encPrivateKey = encryptString(privateKey, key);

    const copyTrade = await copyTradeModel.findOne({ chatId: chatId });
    if (copyTrade) {
      await copyTradeModel.updateOne(
        {
          chatId: chatId,
        },
        {
          $set: {
            amount,
            privateKey: encPrivateKey,
            userAddress,
          },
        }
      );
      return MessageUtil.error(res, {
        status: RESPONSES?.SUCCESS,
        error: false,
        message: "Copy trade updated successfully",
      });
    } else {
      await copyTradeModel.create({
        amount,
        privateKey: encPrivateKey,
        chatId,
        userAddress,
      });
      return MessageUtil.error(res, {
        status: RESPONSES?.SUCCESS,
        error: false,
        message: "Copy trade created successfully",
      });
    }
  };

  public copyTradeBuy = async (req: Request, res: Response) => {
    try {
      let taxable: boolean;
      const { tokenOut } = req.body;
      const schema = Joi.object({
        tokenOut: Joi.string().trim().required(),
        chatId: Joi.string().trim().required(),
      });

      const { error } = schema.validate(req.body);
      if (error) {
      }

      const options = {
        method: "GET",
        url: "https://api.honeypot.is/v2/IsHoneypot",
        params: {
          address: tokenOut,
        },
        headers: { accept: "*/*" },
      };
      const copyTrade = await copyTradeModel.find({});

      const pairAddress = await this.contract.methods
        .getPair(tokenOut, config.WETH_ADDRESS)
        .call();
      if (pairAddress == "0x0000000000000000000000000000000000000000") {
      } else {
        const pairInstance = new web3.eth.Contract(
          pairABI as AbiItem[],
          pairAddress
        );
        const totalSupply: string = await pairInstance.methods
          .totalSupply()
          .call();
        const a = web3.utils.fromWei(totalSupply.toString(), "ether");
        if (totalSupply && Number(totalSupply) > 0) {
          const check = await axios.request(options);
          if (check.data.simulationSuccess == false) {
            console.log("step1");
            // continue;
          }
          let slippage = 10;

          console.log("tax :", check.data.simulationResult.buyTax);
          if (Object.keys(check.data).length == 0) {
            console.log("step2");
          } else if (check.data.simulationResult.buyTax == "0") {
            slippage = parseFloat(check.data.simulationResult.buyTax) + 1;
            taxable = false;
          } else {
            slippage = parseFloat(check.data.simulationResult.buyTax) + 3;
            taxable = true;
          }
          const swapTrade = copyTrade.map((value) => {
            console.log("userAddress", value.userAddress);
            this.copySwap(
              tokenOut,
              value.privateKey,
              value.amount,
              taxable,
              value.userAddress,
              slippage
            );
          });
          const trasactionHash = await Promise.all(swapTrade);
          let checkTokenAddress = await copyTradeContractModel.findOne({
            token: tokenOut,
          });
          if (!checkTokenAddress) {
            await copyTradeContractModel.create({ token: tokenOut });
          }
          console.log(trasactionHash, "trasaction");
        }
      }
    } catch (error: any) {
      console.log(error);
    }
    return MessageUtil.error(res, {
      status: RESPONSES?.SUCCESS,
      error: false,
      message: "DDDDD",
      buyHash: ``,
    });
  };

  private copySwap = async (
    tokenOut: string,
    encripted: string,
    amount: string,
    taxable: boolean,
    userAddress: string,
    slippage: number
  ) => {
    try {
      const decreptPrivateKey = decryptString(encripted, key);
      let accountDetails =
        web3.eth.accounts.privateKeyToAccount(decreptPrivateKey);
      const amt = web3.utils.toWei(amount.toString(), "ether");
      console.log(amt);
      const gasPrice = await web3.eth.getGasPrice();
      const buyInstance = new web3.eth.Contract(
        buyABI as AbiItem[],
        config.BUY_CONTRACT
      );
      const getAmountsOut = await this.routerContract.methods
        .getAmountsOut(amt, [config.WETH_ADDRESS, tokenOut])
        .call();

      const am = web3.utils.fromWei(getAmountsOut[1], "ether");
      const tenpercent = (Number(am) * (slippage > 0 ? slippage : 30)) / 100;
      let tx;
      let gas;
      let signedTx: any;
      let data;
      let nonce;
      if (taxable == false) {
        tx = buyInstance.methods.swapWithFeeBuy(
          tokenOut,
          web3.utils.toWei(
            (Number(am) - Number(tenpercent)).toFixed(18),
            "ether"
          ),
          userAddress
        );
        gas = await tx.estimateGas({
          from: accountDetails.address,
          value: amt,
        });
        data = tx.encodeABI();

        let accountBalence = await web3.eth.getBalance(accountDetails.address);
        let ethBalance = web3.utils.fromWei(accountBalence, "ether");
        const gasPriceAsString = await web3.eth.getGasPrice();
        let gasA = web3.utils.fromWei(gasPriceAsString, "ether");
        // console.log("aaaaaa>>>>>>>",accountDetails.address,Number(ethBalance));
        nonce = await web3.eth.getTransactionCount(accountDetails.address);
        signedTx = await web3.eth.accounts.signTransaction(
          {
            to: config.BUY_CONTRACT,
            value: amt,
            data,
            // gas: gas,
            gas: (gas * 1.5).toFixed(),
            gasPrice,
            nonce,
            chainId: Number(config.CHAIN_ID),
          },
          decreptPrivateKey
        );
      } else {
        console.log(
          web3.utils.toWei(
            (Number(am) - Number(tenpercent)).toFixed(18),
            "ether"
          ),
          userAddress
        );
        tx = buyInstance.methods.swapWithBuyTaxToken(
          tokenOut,
          web3.utils.toWei(
            (Number(am) - Number(tenpercent)).toFixed(18),
            "ether"
          ),
          userAddress
        );
        console.log("here===>>>>>>>2");
        gas = await tx.estimateGas({
          from: accountDetails.address,
          value: amt,
        });
        console.log("here===>>>>>>>3");
        data = tx.encodeABI();
        nonce = await web3.eth.getTransactionCount(accountDetails.address);
        signedTx = await web3.eth.accounts.signTransaction(
          {
            to: config.BUY_CONTRACT,
            value: amt,
            data,
            // gas: gas,
            gas: (gas * 1.5).toFixed(),
            gasPrice,
            nonce,
            chainId: Number(config.CHAIN_ID),
          },
          decreptPrivateKey
        );
      }
      console.log("here===>>>>>>>4");
      const receipt = await web3.eth.sendSignedTransaction(
        signedTx.rawTransaction
      );
      return receipt.transactionHash;
    } catch (eee) {}
  };

  public cancelCopyTrade = async (req: Request, res: Response) => {
    if (req.query.chatId) {
      const deleteCopyTrade = await copyTradeModel.deleteMany({
        chatId: req.query.chatId,
      });
      if (deleteCopyTrade.deletedCount > 0) {
        return MessageUtil.error(res, {
          status: RESPONSES?.SUCCESS,
          error: false,
          message: "Copy trade deleted successfully",
        });
      } else {
        return MessageUtil.error(res, {
          status: RESPONSES?.SUCCESS,
          error: false,
          message: "You have no order in copy trade!",
        });
      }
    }
  };

  public getCopyTrade = async (req: Request, res: Response) => {
    if (req.query.chatId) {
      let copyTrade = await copyTradeModel.find({ chatId: req.query.chatId });
      if (copyTrade.length > 0) {
        return MessageUtil.error(res, {
          status: RESPONSES?.SUCCESS,
          error: false,
          message: true,
        });
      } else {
        return MessageUtil.error(res, {
          status: RESPONSES?.SUCCESS,
          error: false,
          message: false,
        });
      }
    }
  };
}

async function getPriceInUsd(pairAddress: string) {
  let res = await axios.get(
    `https://api.dexscreener.com/latest/dex/pairs/bsc/${pairAddress}`
  );
  console.log("res");
  if (res?.data?.pairs?.length > 0) {
    return res?.data?.pairs[0]?.priceUsd;
  } else {
    return 0;
  }
}
export default new OrderController();
