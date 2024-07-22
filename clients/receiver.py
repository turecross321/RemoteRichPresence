import websocket
import time
import rel
import json
import multiprocessing
from discordrp import Presence

config = json.load(open('config.json'))
processes = {}
queues = {}

CLIENT_TYPE_RECEIVER = 0   

def start_presence(name, client_id, queue):
    with Presence(client_id) as presence:
        print(f"[{name}] Connected to client {client_id}")

        while True:
            if not queue.empty():
                new_presence = queue.get()
                presence.set(new_presence)
                print(f"[{name}] Presence updated for client {client_id} with {new_presence}")

            time.sleep(15)

def add_presence(name, client_id):
    print("Adding new presence")

    queue = multiprocessing.Queue()
    process = multiprocessing.Process(target=start_presence, 
                                        args=(name, 
                                            client_id, 
                                            queue))
    processes[name] = process
    queues[name] = queue
    process.start()

    return queue

def update_presence(queue, new_presence):
    queue.put(new_presence)


def on_message(ws, message):
    parsed = json.loads(message)
    print(parsed)

    match parsed["command"]:
        case "stop":
            process = processes[parsed["name"]]
            process.terminate()

            processes.pop(parsed["name"])
            queues.pop(parsed["name"])
            
            print(f"[{parsed["name"]} Stopping presence")
        case "update":
            if parsed["name"] not in queues:
                print(f"Attempted to update non previously added presence \"{parsed["name"]}\". Adding...")
                add_presence(parsed["name"], parsed["client_id"])

            queue = queues[parsed["name"]]

            update_presence(queue, parsed["presence"])
    

    print(message)

def on_error(ws, error):
    print(error)

def on_close(ws, close_status_code, close_msg):
    print("### closed ###")

def on_open(ws: websocket.WebSocketApp):
    print("Opened connection")

if __name__ == "__main__":
    websocket.enableTrace(True)
    print("Connecting to", config["server"])
    ws = websocket.WebSocketApp(config["server"],
                              on_open=on_open,
                              on_message=on_message,
                              on_error=on_error,
                              on_close=on_close,
                              header={
                                  "client_type": str(CLIENT_TYPE_RECEIVER),
                                  "password": config["password"],
                              })

    ws.run_forever(dispatcher=rel, reconnect=5)  # Set dispatcher to automatic reconnection, 5 second reconnect delay if connection closed unexpectedly
    rel.signal(2, rel.abort)  # Keyboard Interrupt
    rel.dispatch()