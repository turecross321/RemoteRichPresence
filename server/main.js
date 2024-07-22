import { WebSocketServer } from 'ws';

const serverPassword = process.env.PRESENCE_SERVER_PASSWORD;
if (!serverPassword) {
    throw new Error("PRESENCE_SERVER_PASSWORD environment variable is not set!");
}

let serverPort = process.env.PRESENCE_SERVER_PORT
if (!serverPort) {
    console.log("PRESENCE_SERVER_PORT environment variable has not been specified. Using default port...");
    serverPort = 8080;
}

const ClientType = {
    Receiver: 0,
    Sender: 1,
};

let clients = [];

function getClientsOfType(clientType) {
    return clients.filter(item => item.clientType == clientType);
}

function sendToReceivers(object) {
    const content = JSON.stringify(object);

    for (let client of getClientsOfType(ClientType.Receiver)) {
        console.log("Sending %s to receiver", content);
        client.socket.send(content);
    }
}

console.log("Starting server at %d", serverPort);
const wss = new WebSocketServer({ port: serverPort, verifyClient: (info, cb) => {
    const password = info.req.headers.password;
    const clientType = info.req.headers['client-type'];
    const activityName = info.req.headers['activity-name'];
    const discordClientId = info.req.headers['discord-client-id'];

    console.log("Verifying client...");

    let errorMessage = "";
    let errorCode = 0;
    let error = false;

    if (!password) {
        errorMessage = 'No `password` header';
        errorCode = 400;
        error = true;
    }

    if (password != serverPassword) {
        errorMessage = 'Invalid password'
        errorCode = 401;
        error = true;
    }

    if (!clientType) {
        errorMessage = 'No `client-type` header';
        errorCode = 400;
        error = true;
    }

    if (clientType == ClientType.Sender) {
        if (!activityName) {
            errorMessage = 'No `activity-name` header';
            errorCode = 400;
            error = true;
        }
    
        if (!discordClientId) {
            errorMessage = 'No `discord-client-id` header';
            errorCode = 400;
            error = true;
        }
    }

    if (error === true) {
        console.log("Denying connection [%d]: %s", errorCode, errorMessage);
        cb(false, errorCode, errorMessage);
        return;
    }

    if (clientType == ClientType.Sender) {
        info.req.activityName = activityName;
        info.req.discordClientId = discordClientId;

        console.log("Sender [%s] (%s) connected", activityName, discordClientId);
    }
    else if (clientType == ClientType.Receiver) {
        console.log("Receiver connected");
    }

    info.req.clientType = clientType;
    cb(true)
} });

wss.on('connection', function connection(ws, req) {
    const client = {"clientType": req.clientType, "socket": ws, "activityName": req.activityName, "discordClientId": req.discordClientId};
    clients.push(client);

    ws.on('error', console.error);

    ws.on('message', function message(data) {
        console.log("client type: %d", req.clientType);
        if (req.clientType == ClientType.Sender) {
            const newPresence = JSON.parse(data);
            console.log("[%s] Received %s", req.activityName, newPresence);
            const message = {"command": "update", "name": req.activityName, "client_id": req.discordClientId, "presence": newPresence};

            sendToReceivers(message);
        }
    });

    ws.on('close', function close(code, reason) {
        if (req.clientType == ClientType.Sender) {
            console.log("[%s] Disconnected", req.activityName);
            const message = {"command": "stop", "name": req.activityName};
            sendToReceivers(message);
        }
        else if (req.clientType == ClientType.Receiver) {
            console.log("Receiver disconnected");
        }

        clients = clients.filter(item => item !== client);
    });
});