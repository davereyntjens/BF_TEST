const { Node } = require('./node')
const {promiseSleep} = require("./utils");

const grapeUrl = 'http://127.0.0.1:30001' // service discovery

const ports = [11111, 11112, 11113] // test with 3 nodes
const names = ports.map(p => `node_${p}`)
const nodes = ports.map((p, i) => new Node(grapeUrl, names, ports, i))

async function main() {
    await Promise.all(nodes.map(n => n.start()))
    await promiseSleep(3000)

    // test the broadcast
    // const replies = await nodes[0].broadCast({ msg: 'hello' })
    // console.log(replies)

    // creating some client orders
    const example_case = 1
    if (example_case === 1) {
        await nodes[0].createClientOrder(5, 30)
        await nodes[1].createClientOrder(5, -30)
    } else if (example_case === 2) {
        await nodes[0].createClientOrder(5, 20)
        await nodes[1].createClientOrder(5, -30)
    } else if (example_case === 3) {
        await nodes[0].createClientOrder(5, 30)
        await nodes[1].createClientOrder(7, -30)
    }
    // await nodes[2].createClientOrder(4, 14)

}

main()