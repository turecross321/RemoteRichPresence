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

function get_clients_of_type(clientType) {
    return clients.filter(item => item.client_type == clientType);
}

function send_to_receivers(object) {
    const content = JSON.stringify(object);

    for (let client of get_clients_of_type(ClientType.Receiver)) {
        console.log("Sending %s to receiver", content);
        client.socket.send(content);
    }
}

console.log("Starting server at %d", serverPort);
const wss = new WebSocketServer({ port: serverPort, verifyClient: (info, cb) => {
    const password = info.req.headers.password;
    const clientType = info.req.headers.client_type;
    const activityName = info.req.headers.activity_name;
    const discordClientId = info.req.headers.discord_client_id;

    console.log("Verifying client...");

    let error_message = "";
    let error_code = 0;
    let error = false;

    if (!password) {
        error_message = 'No `password` header';
        error_code = 400;
        error = true;
    }

    if (password != serverPassword) {
        error_message = 'Invalid password'
        error_code = 401;
        error = true;
    }

    if (!clientType) {
        error_message = 'No `client_type` header';
        error_code = 400;
        error = true;
    }

    if (clientType === ClientType.Sender) {
        if (!activityName) {
            error_message = 'No `activity_name` header';
            error_code = 400;
            error = true;
        }
    
        if (!discordClientId) {
            error_message = 'No `discord_client_id` header';
            error_code = 400;
            error = true;
        }
    }

    if (error === true) {
        console.log("Denying connection [%d]: %s", error_code, error_message);
        cb(false, error_code, error_message);
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
    const client = {"client_type": req.clientType, "socket": ws, "activity_name": req.activityName, "discord_client_id": req.discordClientId};
    clients.push(client);

    ws.on('error', console.error);

    ws.on('message', function message(data) {
        console.log("client type: %d", req.clientType);
        if (req.clientType == ClientType.Sender) {
            const newPresence = JSON.parse(data);
            console.log("[%s] Received %s", req.activityName, newPresence);
            const message = {"command": "update", "name": req.activityName, "client_id": req.discordClientId, "presence": newPresence};

            send_to_receivers(message);
        }
    });

    ws.on('close', function close(code, reason) {
        if (req.clientType == ClientType.Sender) {
            console.log("[%s] Disconnected", req.activityName);
            const message = {"command": "stop", "name": req.activityName};
            send_to_receivers(message);
        }
        else if (req.clientType == ClientType.Receiver) {
            console.log("Receiver disconnected");
        }

        clients = clients.filter(item => item !== client);
    });
});