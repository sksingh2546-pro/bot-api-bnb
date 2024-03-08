export const RESPONSES = {
  SUCCESS: 200,
  CREATED: 201,
  ACCEPTED: 202,
  NOCONTENT: 204,
  BADREQUEST: 400,
  UN_AUTHORIZED: 401,
  INVALID_REQ: 422,
  FORBIDDEN: 403,
  NOTFOUND: 404,
  TIMEOUT: 408,
  TOOMANYREQ: 429,
  INTERNALSERVER: 500,
  BADGATEWAYS: 502,
  SERVICEUNAVILABLE: 503,
  GATEWAYTIMEOUT: 504,
};
export const RES_MSG = {
  NO_PAIR:
    "Pair not found, we have accepted your request, your transaction will be executed as soon as the pair is created for the given token.",
  BUY_SUCCESS: "Buy Success",
  BUY_TAX_SUCCESS: "Tax Token Buy Success",
  SELL_SUCCESS: "Sell Success",
  SELL_TAX_SUCCESS: "Tax Token Sell Success",
  QUICK_SELL_SUCCESS: "Quick Sell Success",
  QUICK_SELL_TAX_SUCCESS: "Tax Token Quick Sell Success",
  ORDER_DATA_INSERT:
    "TotalSupply not found in pair, Once supply will be added, we will execute the transaction",
  NO_DATA: "No data found",
  BADREQUEST: "Bad Request",
  INTERNAL_SERVER_ERROR: "Internal Server Error",
  SUCCESS: "Success",
  INVALID_TOKEN: "Can not determine if the token is taxable or not",
  NO_FUND: "You Have Insufficient Fund!",
  ORDER_SELL_SUCCESS: "Autosell order placed successfully",
  ORDER_LIMIT_SUCCESS: "Limit order placed successfully",

};
