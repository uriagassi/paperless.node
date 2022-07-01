import {Request, Response, NextFunction} from "express";

export const sso = (req: Request, res: Response, next: NextFunction) => {
  if (req.path === '/sso') {
    return res.json({ handler: 'EmptySSO' })
  }
  req.user_name = 'You'
  return next()
}

export default sso
