import config from "config";
import sanitizer from "string-sanitizer";
import axios from "axios";
import {Request, Response, NextFunction} from "express";

const synologyURL = `https://${config.get('synology.hostname')}:${config.get('synology.port')}/webman/sso/SSOAccessToken.cgi?action=exchange&app_id=${config.get('synology.appId')}&access_token=`
process.env['NODE_TLS_REJECT_UNAUTHORIZED'] = '0';
export const sso  = (req:Request, res:Response, next:NextFunction) => {
  if (req.path === '/sso') {
    return res.json({ handler: 'SynologySSO',
      oauthserver_url: `https://${config.get('synology.hostname')}:${config.get('synology.port')}`,
      app_id: config.get('synology.appId'),
      redirect_uri: config.get('synology.redirect_uri'),
    })
  }
  const nonSecurePaths = ['/api/body/css', '/api/body/js', '/static'];
  if (nonSecurePaths.find(p => req.path.startsWith(p))) return next();
  if (req.path === '/') return next();

  if (req.cookies?.['x-syn-token-user'] && req.path !== '/api/user') {
    req.user_name = req.cookies?.['x-syn-token-user']
    return next()
  }
  const tok = req.query?.token ||
      req.body?.token || req.query?.token || req.headers["x-access-token"] || req.cookies?.['x-syn-access-token'];
  if (!tok) {
    return res.status(403).send("Not supported for unknown users or in Incognito Mode (no cookies)");
  }
  const token = sanitizer.sanitize(tok);
  try {
    axios
        .get(synologyURL + token)
        .then(res1 => {
          if (!res1.data.data) {
            console.log(res1.data)
            return res.status(401).send("Invalid Token")
          }
          req.user_id = res1.data.data.user_id;
          req.user_name = res1.data.data.user_name;
          res.cookie('x-syn-access-token', token, {
            maxAge: 5000000,
            secure: true,
            httpOnly: true,
            sameSite: 'lax'})
          res.cookie('x-syn-token-user', res1.data.data.user_name, {
            maxAge: 50000,
            secure: true,
            httpOnly: true,
            sameSite: 'lax'})
          return next()
        })
        .catch(error => {
          console.error(error);
          return res.status(401).send("Invalid Token")
        });
  } catch (err) {
    return res.status(401).send("Invalid Token");
  }
}

export default sso

