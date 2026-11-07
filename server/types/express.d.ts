// Clerk already augments `req.auth`, so only our own fields are declared here.
declare global {
  namespace Express {
    interface Request {
      user?: any;
      shop?: any;
      driver?: any;
    }
  }
}

export {};
