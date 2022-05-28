const empty_sso = (req, res, next) => {
  req.user_name = 'You'
  return next()
}

module.exports = empty_sso
