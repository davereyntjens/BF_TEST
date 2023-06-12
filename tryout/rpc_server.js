// This RPC server will announce itself as `rpc_test`
// in our Grape Bittorrent network
// When it receives requests, it will answer with 'world'

'use strict'

const { PeerRPCServer }  = require('grenache-nodejs-http')
const Link = require('grenache-nodejs-link')

function createServer(grapeUrl, port, serviceName, serviceHandler) {
    const link = new Link({
        grape: grapeUrl
    })
    link.start()

    const peer = new PeerRPCServer(link, {
        timeout: 300000
    })
    peer.init()
    const service = peer.transport('server')

    setInterval(function () {
        link.announce(serviceName, service.port, {})
    }, 1000)

    service.on('request', async (rid, key, payload, handler) => {
        console.log(`service ${serviceName} called with arg ${rid} ${key} ${JSON.stringify(payload, null, 2)}`)
        await serviceHandler(rid, key, payload, handler)
    })

    console.log(`service ${serviceName} listening on ${port}`)
    service.listen(port)
}

/*
const port = 1024 + Math.floor(Math.random() * 1000)
createServer('http://127.0.0.1:30001', port, 'rpc_test',
    (rid, key, payload, replyChannel) => {
    console.log(payload) //  { msg: 'hello' }
    replyChannel.reply(null, { msg: 'world' })
})
 */

module.exports = {
    createServer
}