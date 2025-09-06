import { WebSocketServer, WebSocket } from "ws";
import { createClient } from "redis";
import { randomUUID } from "crypto";

const redisSubscribedRooms = new Set<string>();


const publishClient = createClient({
    url: process.env.REDIS_URL || "redis://localhost:6379"
});
publishClient.connect();

const subscribeClient = createClient({
    url: process.env.REDIS_URL || "redis://localhost:6379"
});
subscribeClient.connect();

const wss = new WebSocketServer({ port: 8081 });
console.log("WebSocket server started on wss://localhost:8081");

const subscription: {
    [id: string]: {
        ws: WebSocket,
        channels: string[]
    }
} = {};

wss.on("connection", (ws:WebSocket) => {
    const id = randomUUID();
    subscription[id] = { ws, channels: [] };
    console.log(`Client connected: ${id}`);

    ws.on("message", async (data) => {
        const parsedMesage = JSON.parse(data.toString());
        const type = parsedMesage.type;

        if (type === "SUBSCRIBE") {
            const channel = parsedMesage.channel;
            if(!subscription[id]?.channels.includes(channel)) {
                subscription[id]?.channels.push(channel);
            }

            if(atLeaseOneUserConnected(channel)) {
                console.log(`Client ${id} subscribed to channel: ${channel}`);
                if(!redisSubscribedRooms.has(channel)) {
                    redisSubscribedRooms.add(channel);
                    await subscribeClient.subscribe(channel, (message) => {
                        const parsed = JSON.parse(message);
                        const {channelId, message: msg} = parsed;

                        Object.entries(subscription).forEach(([uid, {ws, channels}]) => {
                            if(channels.includes(channelId)) {
                                ws.send(JSON.stringify({
                                    type: "RECIEVER_MESSAGE",
                                    channel: channelId, 
                                    message: msg
                                }));
                            }
                        })
                    })
                }
            }
        }
        if (type === "UNSUBSCRIBE") {
            const channel = parsedMesage.channel;
            if (subscription[id]) {
                subscription[id].channels = subscription[id].channels.filter((c) => c !== channel);
            }

            if(noOneIsConnected(channel)) {
                console.log(`Client ${id} unsubscribed from channel: ${channel}`);
                await subscribeClient.unsubscribe(channel);
                redisSubscribedRooms.delete(channel);
            }
        }

        if (type === "SEND_MESSAGE") {
            const roomId = parsedMesage.channel;
            const message = parsedMesage.message;

            console.log(`Client ${id} sent message to channel ${roomId}: ${message}`);
            await publishClient.publish(roomId, JSON.stringify({
                type: "SEND_MESSAGE",
                channelId: roomId,
                message
            }));
        }
    })
})


function atLeaseOneUserConnected(roomid: string) {
    return Object.values(subscription).some(sub => sub.channels.includes(roomid))
}

function noOneIsConnected(roomId: string) {
   return !Object.values(subscription).some(sub => sub.channels.includes(roomId))
}