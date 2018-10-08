import contracts from 'config/contracts';

const contract = contracts['TRXMessages.sol:TRXMessages'];

const utils = {
    tronWeb: false,
    contract: false,

    setTronWeb(tronWeb) {
        this.tronWeb = tronWeb;
        this.contract = tronWeb.contract(contract.abi, contract.address)
    },

    transformMessage(message) {
        return {
            tips: {
                amount: message.tips.toNumber(),
                count: message.tippers.toNumber()
            },
            owner: this.tronWeb.address.fromHex(message.creator),
            timestamp: message.time.toNumber(),
            message: message.message
        }
    },

    async fetchMessages(recent = {}, featured = []) {
        // Try to fetch messageID's of top 20 tipped messages (or until there are no more)
        for(let i = 0; i < 20; i++) {
            const message = await this.contract.topPosts(i).call();

            if(message.tips.toNumber() === 0)
                break; // End of tips array

            featured.push(
                message.id.toNumber()
            );
        }

        // Fetch Max(30) most recent messages
        const totalMessages = (await this.contract.current().call()).toNumber();
        const min = Math.max(0, totalMessages - 30);

        const messageIDs = [ ...new Set([
            ...new Array(totalMessages - min).fill().map((_, index) => min + index),
            ...featured
        ])];

        await Promise.all(messageIDs.map(messageID => (
            this.contract.messages(messageID).call()
        ))).then(messages => messages.forEach((message, index) => {
            const messageID = +messageIDs[index];

            recent[+messageID] = this.transformMessage(message);
        }));

        return {
            featured: featured.sort((a, b) => (
                recent[b].timestamp - recent[a].timestamp
            )),
            recent
        };
    },

    async fetchMessage(messageID, { recent = {}, featured = [] }) {
        const message = await this.contract.messages(messageID).call();
        const vulnerable = Object.keys(recent).filter(messageID => (
            !featured.includes(messageID)
        )).sort((a, b) => (
            recent[b].timestamp - recent[a].timestamp
        ));

        recent[+messageID] = this.transformMessage(message);

        if(vulnerable.length > 30) {
            const removed = vulnerable.splice(0, vulnerable.length - 30);

            removed.forEach(messageID => {
                delete recent[messageID];
            });
        }

        return {
            message: recent[messageID],
            recent,
            featured
        };
    }
};

export default utils;