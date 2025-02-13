const fetch = require("node-fetch");
const config = {
    defaultHTTPHeaders: {
        'Content-Type': 'application/json'
    }
};

async function connect({ host, defaultPath }) {
    this.connectionURI = `${host}${defaultPath}`;
    this.host = host;
}

async function addOne(doc) {
    const response = await fetch(`${this.connectionURI}`, {
        headers: config.defaultHTTPHeaders,
        method: 'POST',
        body: JSON.stringify(doc),
    });
    return response.ok;
}

async function findAll(collectionName) {
    const response = await fetch(`${this.connectionURI}`);
    const data = await response.json();
    return data;
}

async function findOne(_id) {
    const response = await fetch(`${this.connectionURI}/${_id}`);
    const data = await response.json();
    return data;
}

async function updateOne(_id, doc) {
    const response = await fetch(`${this.connectionURI}/${_id}`, {
        headers: config.defaultHTTPHeaders,
        method: "PATCH",
        body: JSON.stringify(Object.assign(doc, { lastModifiedAt: new Date().toISOString() }))
    });
    const data = await response.json();
    return data;
}

async function removeOne(_id) {
    const response = await fetch(`${this.connectionURI}/${_id}`, {
        method: "DELETE",
    });
    const data = await response.json();
    return data;
}

module.exports = {
    connect,
    addOne,
    removeOne,
    findAll,
    findOne,
    updateOne
};
