import { Request, Response } from "express";
import { RESPONSES, RES_MSG } from "../utils/responses";
import { MessageUtil } from "../utils/messages";

class healthCheckController {
  healthCheck = async (req: Request, res: Response) => {
    return MessageUtil.success(res, {
      message: RES_MSG.SUCCESS,
      status: RESPONSES.SUCCESS,
      error: false,
    });
  };
}

export default new healthCheckController();
