'use strict'

const { createServer } = require('../tryout/rpc_server')
const { createClient } = require('../tryout/rpc_client')
const { promiseSleep } = require('./utils')

const Order = require('./order.js')


class Node {

    constructor(grapeUrl, nodeNodeNames, nodePorts, nodeIndex) {
        this.grapeUrl = grapeUrl
        this.name = nodeNodeNames[nodeIndex]
        this.port = nodePorts[nodeIndex]
        this.otherNodeNames = nodeNodeNames.filter((name, index) => index !== nodeIndex)
        this.clientBuyOrders = []
        this.clientSellOrders = []
        this.possibleMatchedOrder = []
    }

    async start() {
        await createServer(this.grapeUrl, this.port, this.name, async (rid, key, payload, replyChannel) => {
            const reply = await this.messageReceived(payload)
            await replyChannel.reply(null, reply)
        })
        this.clients = []
        for (const name of this.otherNodeNames) {
            const opt = { timeout: 10000 }
            const client = await createClient(this.grapeUrl, name, opt)
            this.clients.push(client)
        }
    }

    async broadCast(message) {
        const replies = await Promise.all(this.clients.map(async c => {
            const reply = await c.request(message)
            console.log('reply from broadcast', reply)
            return reply? {
                ...reply,
                client: c
            }: null
        }))
        return replies.filter(r => r !== null)
    }

    async messageReceived(message) {
        if (message.type === 'order') {
            return this.tryMatching(message)
        } else if (message.type === 'initiate 2 phase commit') {
            // check the order is still open and the amount is still available
            // if yes, lock the order and send back a confirmation
            const uuid = message.id
            const order = this.clientBuyOrders.find(o => o.id === uuid) || this.clientSellOrders.find(o => o.id === uuid)
            if (order) {
                order.locked = true
            } else {
                return { msg: `ORDER IS NOT AVAILABLE ANYMORE: ${uuid}` }
            }
        } else if (message.type === 'commit') {
            // todo execute the exchange
            const uuid = message.id
        }
        return { msg: `ERROR_UNKNOWN_MESSAGE_TYPE: ${this.name} ${message.type}` }
    }

    /**
     * Only limit exchange orders are supported.
     * A node only contains the orders of its client.
     *
     * Each other client node will get the new order and will send back an answer,
     * the answer will indicate if there is a possible match or not.
     * These counter-offers will be replied, indicating suggested matching offers.
     *
     * Todo: If the other node is down no answer could be received.
     */
    async createClientOrder(price, amount) {
        if (price <= 0) {
            throw new Error('Order price is 0')
        }
        const order = new Order(price, amount)
        if (amount > 0) { // buy
            this.clientBuyOrders.push(order)
            this.clientBuyOrders.sort((a, b) => b.price - a.price) // sort the client buy orders by price descending
            // -> ASSUMPTION: the seller will be getting the highest bid here
        } else if (amount < 0) { // sell
            this.clientSellOrders.push(order)
            this.clientSellOrders.sort((a, b) => a.price - b.price) // sort the client sell orders by price ascending
            // -> ASSUMPTION: the buyer will be getting the lowest ask here
        } else {
            throw new Error('Order amount is 0')
        }
        const replies = await this.broadCast(order.toJSON()) // broadCast the new order to the other nodes
        this.possibleMatchedOrder.push(...replies)
        console.log('handle received possible matched offers, after receiving them from other nodes')
        this.possibleMatchedOrder.sort((a, b) => a.price - b.price) // sort by price descending
        const bestMatch = this.possibleMatchedOrder[0] // pick the best suggested matching offer
        let retry = !bestMatch
        if (bestMatch) {
            const acknowledge = await this.sendInitiateExchangeLockRequestToOtherNode(bestMatch)
            if (acknowledge) {
                const doCommit = await this.sendCommitExchangeToOtherNode(bestMatch)
                if (doCommit) {
                    // remove the new order as it is processed
                    this.removeOrder(order)
                    // broadcast a new order with the unfulfilled amount if need be
                    const unfulfilled = amount + bestMatch.amount
                    if (unfulfilled !== 0) {
                        await this.createClientOrder(price, unfulfilled)
                    }
                } else  {
                    retry = true
                }
            } else {
                retry = true
            }
        }
        if (retry) {
            this.removeOrder(order)
            setTimeout(async () => {
                // retry the broadcasting the order, to match it against the other nodes
                await this.createClientOrder(price, amount)
            }, 1000) // after one seconds for testing
        }
    }

    removeOrder(order) {
        if (order.amount > 0) {
            // remove the order from the client buy orders
            this.clientBuyOrders = this.clientBuyOrders.filter(obj => obj !== order)
        } else {
            this.clientSellOrders = this.clientSellOrders.filter(obj => obj !== order)
        }
    }

    // todo: take into account locked orders
    tryMatching(otherOrder) {
        let matchedOrder = null
        if (otherOrder.amount > 0) { // buy order matching the client sell order
            for (const clientSellOrder of this.clientSellOrders) {
                if (clientSellOrder.price <= otherOrder.price) {
                    matchedOrder = clientSellOrder
                    break
                }
            }
        } else if (otherOrder.amount < 0) { // sell order matching the client buy order
            for (const clientBuyOrder of this.clientBuyOrders) {
                if (clientBuyOrder.price >= otherOrder.price) {
                    matchedOrder = clientBuyOrder
                    break
                }
            }
        } else {
            console.log('ERROR Other order amount is 0')
        }
        if (matchedOrder) {
            const match = {
                type: 'possible match',
                price: matchedOrder.price,
                amount: matchedOrder.amount
            }
            console.log('matched order')
            console.log(match)
            return match
        }
        return null // no match
    }

    /**
     * Send the message to the other node that the match is accepted,
     * and the exchange can be done. Here the other node will have to apply some locking mechanism
     * until the commit message is received or some lock timeout happens.
     * The locking could be a locked amount of the order.
     */
    async sendInitiateExchangeLockRequestToOtherNode(bestMatch) {
        console.log('send commit exchange to other node')
        bestMatch.type = 'initiate 2 phase commit'
        return await bestMatch.client.request(bestMatch)
    }

    /**
     * Send the commit message to the other node that the exchange can be committed.
     */
    async sendCommitExchangeToOtherNode(bestMatch) {
        console.log('send commit exchange to other node')
        bestMatch.type = 'do commit'
        return await bestMatch.client.request(bestMatch)
    }

}

module.exports = { Node }