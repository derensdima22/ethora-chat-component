import { sha256 } from 'js-sha256';

import { Client } from '@xmpp/client';
import { createRoomPresence } from './createRoomPresence.xmpp';
import { setMeAsOwner } from './setMeAsOwner.xmpp';
import { roomConfig } from './roomConfig.xmpp';

export async function createRoom(
  title: string,
  description: string,
  client: Client
) {
  const randomNumber = Math.round(Math.random() * 100_000);
  const chatNameWithSalt = title + Date.now() + randomNumber;
  const roomHash = sha256(chatNameWithSalt);
  const roomId = `${roomHash}@conference.xmpp.ethoradev.com`;

  await createRoomPresence(roomId, client);
  await setMeAsOwner(roomId, client);
  await roomConfig(roomId, title, description, client);
  return roomId;
}