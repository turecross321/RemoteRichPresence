from websocket import create_connection
import json
import time

config = json.load(open('config.json'))

CLIENT_TYPE_SENDER = 1

ws = create_connection(config["server"], header={
                                  "client-type": str(CLIENT_TYPE_SENDER),
                                  "password": config["password"],
                                  "discord-client_id": "1258728548613619733",
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
