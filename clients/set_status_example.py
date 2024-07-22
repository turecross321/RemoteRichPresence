from websocket import create_connection
import json
import time

SERVER_PASSWORD = "password"
SERVER_URL = "ws://127.0.0.1:8080"

CLIENT_TYPE_SENDER = 1

ws = create_connection(SERVER_URL, header={
                                  "client-type": str(CLIENT_TYPE_SENDER),
                                  "password": SERVER_PASSWORD,
                                  "discord-client-id": "1258728548613619733",
                                  "activity-name": "test"
                              })

while True:
    message = {
            "state": "TEST PRESENCE"
        }

    serialized = json.dumps(message)

    print(serialized)
    ws.send(serialized)
    time.sleep(15)
