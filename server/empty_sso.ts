import {Request, Response, NextFunction} from "express";

export const sso = (req: Request, res: Response, next: NextFunction) => {
  req.user_name = 'You'
  return next()
}

export default sso
