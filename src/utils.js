const promiseSleep = async (ms) => {
    return new Promise((resolve, reject) => {
        setTimeout(() => {
            resolve()
        }, ms)
    })
}

module.exports = {
    promiseSleep
}