import * as signalR from '@microsoft/signalr'

let connection = null

export function getConnection() {
  if (!connection) {
    connection = new signalR.HubConnectionBuilder()
      .withUrl('/convertHub')
      .withAutomaticReconnect()
      .build()
  }
  return connection
}

export async function ensureConnected() {
  const conn = getConnection()
  if (conn.state === signalR.HubConnectionState.Disconnected) {
    await conn.start()
  }
  return conn
}
