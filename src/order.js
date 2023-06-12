'use strict'

const crypto = require("crypto");
const id = crypto.randomBytes(16).toString("hex");


class Order {

    /**
     * A positive amount is a bid (buy)
     * and a negative amount is an ask (sell).
     */
    constructor(price, amount, node) {
        this.price = price
        this.amount = amount
        this.node = node
        this.locked = false // lock in the order for a 2 phase commit to execute the exchange, todo handle amount lock instead of complete order
        this.id = crypto.randomBytes(16).toString("hex")
    }

    toJSON() {
        return {
            type: 'order',
            price: this.price,
            amount: this.amount,
            amountLocked: this.amountLocked
        }
    }

}

module.exports = Order
