// This client will as the DHT for a service called `rpc_test`
// and then establishes a P2P connection it.
// It will then send { msg: 'hello' } to the RPC server

'use strict'

const { PeerRPCClient }  = require('grenache-nodejs-http')
const Link = require('grenache-nodejs-link')
const { promiseSleep } = require('../src/utils')

async function createClient(grapeUrl, serviceName, opt) {
    const link = new Link({
        grape: grapeUrl
    })
    link.start()

    const peer = new PeerRPCClient(link, {})
    peer.init()

    return {
        request: async (payload) => {
            return new Promise((resolve, reject) => {
                peer.request(serviceName, payload, opt, (err, data) => {
                    if (err) {
                        reject(err)
                    }else {
                        console.log(data) // { msg: 'world' }
                        resolve(data)
                    }
                })
            })
        }
    }
}

/*
async function main() {
    const opt = { timeout: 10000 }
    const client = await createClient( 'http://127.0.0.1:30001', 'rpc_test', opt)
    while(true) {
        await client.request({ msg: 'hello' })
        await promiseSleep(1000)
    }
}

main()
 */

module.exports = {
    createClient
}