/** Business switches read from env at call time. */

// Cash on delivery can be switched off (the customer app only offers UPI/Card).
export const allowCod = () => process.env.ALLOW_COD !== "false";
