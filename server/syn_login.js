const config = require('config')
const sanitizer = require('sanitize')()
const axios = require('axios')

const synologyURL = `https://${config.get('synology.hostname')}:${config.get('synology.port')}/webman/sso/SSOAccessToken.cgi?action=exchange&app_id=${config.get('synology.appId')}&access_token=`
process.env['NODE_TLS_REJECT_UNAUTHORIZED'] = '0';
const sso = (req, res, next) => {
  const nonSecurePaths = ['/api/body/css', '/api/body/js'];
  if (nonSecurePaths.find(p => req.path.startsWith(p))) return next();
  if (req.cookies?.['x-syn-token-user'] && req.path != '/api/user') {
    req.user_name = req.cookies?.['x-syn-token-user']
    return next()
  }
  const token = sanitizer.value( req.cookies?.['x-syn-access-token'] ||
    req.body?.token || req.query?.token || req.headers["x-access-token"], /\w+/);
  if (!token) {
    return res.status(403).send("Not supported for unknown users or in Incognito Mode (no cookies)");
  }
  try {
    axios
      .get(synologyURL + token)
      .then(res1 => {
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

module.exports = sso
