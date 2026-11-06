// Clerk already augments `req.auth`, so only `user` is declared here.
declare global {
  namespace Express {
    interface Request {
      user?: any;
    }
  }
}

export {};
