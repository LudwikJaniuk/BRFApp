const jwt = require('jsonwebtoken')
const encryptor = require('simple-encryptor')(process.env.URL_ENCRYPTION_KEY)
const got = require('got')

exports.authenticationToken = function (user) {
  var profile = {
    metryID: user.metryId,
    name: user.profile.name,
    email: user.email
  }

  var encryptedMessage = encryptor.encrypt(profile)
  var jwtOptions = { expiresIn: '1h' }
  return jwt.sign({msg: encryptedMessage}, process.env.BRFENERGI_SESSION_SECRET, jwtOptions)
}

exports.getNodebbUid = async function (user) {
  const brfToken = this.authenticationToken(user)
  let options = { method: 'GET', headers: {brfauth: brfToken}, json: true }
  const response = (await got(process.env.FORUM_URL + '/api/whoami', options))
  return response.body.uid
}

exports.postEnergyAction = async function (action, user) {
  const uid = await this.getNodebbUid(user)
  const payload = {
    _uid: uid,
    cid: 2, // "General discussion"
    title: 'Another energy action post',
    content: 'This is a new energy action post. In the future, this text will describe the action!'
  }
  const tok = jwt.sign(payload, 'test', {expiresIn: '5min'})
  console.log("Going to send this off")
  console.log(tok)

  // SHould probbly be in body...
  let options = {
    method: 'POST',
    json: true,
    body: { token: tok }
  }
  const url = process.env.FORUM_URL + '/api/v2/topics'
  console.log(url)
  const response = await got(url, options)

  console.log(response)
}
