import xmpp, { Client, xml } from '@xmpp/client';
import { walletToUsername } from '../helpers/walletUsername';
import {
  handleComposing,
  onGetChatRooms,
  onGetLastMessageArchive,
  onMessageHistory,
  onPresenceInRoom,
  onRealtimeMessage,
} from './stanzaHandlers';
import { Element } from 'ltx';

import { sendMediaMessage } from './xmpp/sendMediaMessage.xmpp';
import { createTimeoutPromise } from './xmpp/createTimeoutPromise.xmpp';
import { setChatsPrivateStoreRequest } from './xmpp/setChatsPrivateStoreRequest.xmpp';
import { getChatsPrivateStoreRequest } from './xmpp/getChatsPrivateStoreRequest.xmpp';
import { actionSetTimestampToPrivateStore } from './xmpp/actionSetTimestampToPrivateStore.xmpp';
import { sendTypingRequest } from './xmpp/sendTypingRequest.xmpp';
import { getHistory } from './xmpp/getHistory.xmpp';
import { sendTextMessage } from './xmpp/sendTextMessage.xmpp';
import { deleteMessage } from './xmpp/deleteMessage.xmpp';
import { presenceInRoom } from './xmpp/presenceInRoom.xmpp';
import { getLastMessageArchive } from './xmpp/getLastMessageArchive.xmpp';

export class XmppClient {
  client!: Client;
  devServer: string | undefined;
  host: string;
  service: string;
  conference: string;
  username: string;
  onclose: () => void;
  onmessage: (data: any) => void;
  status: string;

  password = '';
  resource = '';

  //core functions
  // we pass walletAddress for XMPP user name and the XMPP password generated by DP/Ethora backend for this user

  checkOnline() {
    return this.client && this.client.status === 'online';
  }

  constructor(username: string, password: string) {
    const url = `wss://${this.devServer || 'xmpp.ethoradev.com:5443'}/ws`;
    // if (url.startsWith("wss")) {
    //   this.host = url.match(/wss:\/\/([^:/]+)/)[1];
    // } else {
    //   this.host = url.match(/ws:\/\/([^:/]+)/)[1];
    // }
    try {
      this.conference = `conference.${this.host}`;
      this.username = username;
      console.log('+-+-+-+-+-+-+-+-+ ', { username });
      this.service = url;

      this.client = xmpp.client({
        service: url,
        username: walletToUsername(username),
        password: password,
      });

      this.onclose = () => {
        console.log('Connection closed');
      };

      this.client.on('disconnect', () => {
        this?.onclose();
        this.client.stop();
      });
      this.client.on('error', () => console.log('xmpp client error'));

      // this.client.on("stanza", this.onStanza.bind(this));
      // this.client.on('stanza', (stanza) => {
      //     console.log('==print stanza==', stanza.toString())
      // })
      this.client.setMaxListeners(20);
      this.client
        .start()
        .then(() => console.log('started client'))
        .catch((error) => console.log(error, 'There were an error'));

      this.client.setMaxListeners(20);

      this.client.on('online', () => {
        this.status = 'online';
        console.log('Client is online');
      });

      this.client.on('stanza', (stanza) => {
        switch (stanza.name) {
          case 'message':
            onRealtimeMessage(stanza);
            onMessageHistory(stanza);
            onGetLastMessageArchive(stanza, this);
            handleComposing(stanza, this.username);
            break;
          case 'presence':
            onPresenceInRoom(stanza);
            break;
          case 'iq':
            onGetChatRooms(stanza, this);
            onRealtimeMessage(stanza);
            onPresenceInRoom(stanza);
            break;
          default:
            console.log('Unhandled stanza type:', stanza.name);
        }
      });

      this.client.on('offline', () => {
        console.log('offline');
      });

      this.client.on('error', (error) => {
        console.log('xmpp on error', error);
        console.log('xmpp error, terminating connection');
      });
    } catch (error) {
      console.error('An error occurred during initialization:', error);
    }
  }

  close() {
    if (this.client) {
      this.client
        .stop()
        .then(() => {
          console.log('Client connection closed');
          this.onclose();
        })
        .catch((error) => {
          console.error('Error closing the client:', error);
        });
    } else {
      console.log('No client to close');
    }
  }

  joinBySendingPresence(chatJID: string) {
    let stanzaHdlrPointer: (stanza: Element) => void;

    const unsubscribe = () => {
      this.client.off('stanza', stanzaHdlrPointer);
    };

    const responsePromise = new Promise((resolve, _) => {
      stanzaHdlrPointer = (stanza: Element) => {
        if (
          stanza.is('presence') &&
          stanza.attrs['from']?.split('/') &&
          stanza.attrs['from']?.split('/')[0] === chatJID
        ) {
          unsubscribe();
          resolve(true);
        }
      };

      const message = xml(
        'presence',
        {
          id: 'joinByPresence',
          to: `${chatJID}/${this.client.jid.toString().split('@')[0]}`,
        },
        xml('x', 'http://jabber.org/protocol/muc')
      );

      try {
        this.client.send(message);
      } catch (error) {
        console.log('Error joining by presence', error);
      }
    });

    const timeoutPromise = createTimeoutPromise(3000, unsubscribe);

    return Promise.race([responsePromise, timeoutPromise]);
  }

  unsubscribe = (address: string) => {
    try {
      const message = xml(
        'iq',
        {
          from: this.client?.jid?.toString(),
          to: address,
          type: 'set',
          id: 'unsubscribe',
        },
        xml('unsubscribe', { xmlns: 'urn:xmpp:mucsub:0' })
      );

      this.client.send(message);
    } catch (error) {
      console.error('An error occurred while unsubscribing:', error);
    }
  };

  getRooms = () => {
    return new Promise((resolve, reject) => {
      try {
        const message = xml(
          'iq',
          {
            type: 'get',
            from: this.client.jid?.toString(),
            id: 'getUserRooms',
          },
          xml('query', { xmlns: 'ns:getrooms' })
        );

        this.client
          .send(message)
          .then(() => {
            console.log('getRooms successfully sent');
            resolve('Request to get rooms sent successfully');
          })
          .catch((error: any) => {
            console.error('Failed to send getRooms request:', error);
            reject(error);
          });
      } catch (error) {
        console.error('An error occurred while getting rooms:', error);
        reject(error);
      }
    });
  };

  //room functions
  leaveTheRoom = (roomJID: string) => {
    try {
      const presence = xml('presence', {
        from: this.client.jid?.toString(),
        to: roomJID + '/' + this.client.jid?.getLocal(),
        type: 'unavailable',
      });
      this.client.send(presence);
    } catch (error) {
      console.error('An error occurred while leaving the room:', error);
    }
  };

  presenceInRoomStanza = (roomJID: string) => {
    presenceInRoom(this.client, roomJID);
  };

  getHistoryStanza = async (chatJID: string, max: number, before?: number) => {
    await getHistory(this.client, chatJID, max, before);
  };

  getLastMessageArchiveStanza(roomJID: string) {
    getLastMessageArchive(this.client, roomJID);
  }

  //messages
  sendMessage = (
    roomJID: string,
    firstName: string,
    lastName: string,
    photo: string,
    walletAddress: string,
    userMessage: string,
    notDisplayedValue?: string
  ) => {
    sendTextMessage(
      this.client,
      roomJID,
      firstName,
      lastName,
      photo,
      walletAddress,
      userMessage,
      notDisplayedValue,
      this.devServer
    );
  };

  deleteMessageStanza(room: string, msgId: string) {
    deleteMessage(this.client, room, msgId);
  }

  sendTypingRequestStanza(chatId: string, fullName: string, start: boolean) {
    sendTypingRequest(this.client, chatId, fullName, start);
  }

  getChatsPrivateStoreRequestStanza = () =>
    getChatsPrivateStoreRequest(this.client);

  async setChatsPrivateStoreRequestStanza(jsonObj: string) {
    await setChatsPrivateStoreRequest(this.client, jsonObj);
  }

  async actionSetTimestampToPrivateStoreStanza(
    chatId: string,
    timestamp: number
  ) {
    await actionSetTimestampToPrivateStore(this.client, chatId, timestamp);
  }

  sendMediaMessageStanza(roomJID: string, data: any) {
    sendMediaMessage(this.client, roomJID, data);
  }
}

export default XmppClient;
