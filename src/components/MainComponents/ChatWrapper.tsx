import React, { FC, useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import ChatRoom from './ChatRoom';
import { setConfig } from '../../roomStore/chatSettingsSlice';
import { ChatWrapperBox } from '../styled/ChatWrapperBox';
import { Overlay, StyledModal } from '../styled/Modal';
import { Message } from '../Message';
import { IConfig, IRoom, MessageProps, User } from '../../types/types';
import { useXmppClient } from '../../context/xmppProvider';
import LoginForm from '../AuthForms/Login';
import { RootState } from '../../roomStore';
import Loader from '../styled/Loader';
import {
  setCurrentRoom,
  setIsLoading,
  setLastViewedTimestamp,
} from '../../roomStore/roomsSlice';
import { refresh } from '../../networking/apiClient';
import RoomList from './RoomList';

interface ChatWrapperProps {
  token?: string;
  room?: IRoom;
  loginData?: { email: string; password: string };
  MainComponentStyles?: React.CSSProperties; //change to particular types
  CustomMessageComponent?: React.ComponentType<MessageProps>;
  config?: IConfig;
  roomJID?: string;
}

const ChatWrapper: FC<ChatWrapperProps> = ({
  MainComponentStyles,
  CustomMessageComponent,
  room,
  config,
  roomJID,
}) => {
  const [isInited, setInited] = useState(false);
  const [showModal, setShowModal] = useState(false);

  const dispatch = useDispatch();

  const { user } = useSelector((state: RootState) => state.chatSettingStore);
  const rooms = useSelector((state: RootState) => state.rooms.rooms);
  const handleChangeChat = (chat: IRoom) => {
    dispatch(setCurrentRoom({ roomJID: chat.jid }));
    dispatch(setIsLoading({ chatJID: chat.jid, loading: true }));
  };

  const { client, initializeClient, setClient } = useXmppClient();

  useEffect(() => {
    dispatch(setConfig(config));
    dispatch(setIsLoading({ loading: true }));

    const initXmmpClient = async () => {
      try {
        if (!user.defaultWallet || user?.defaultWallet.walletAddress === '') {
          setShowModal(true);
          console.log('Error, no user');
        } else {
          if (!client) {
            setShowModal(false);

            console.log('No client, so initing one');
            await initializeClient(
              user.defaultWallet?.walletAddress,
              user.xmppPassword
            ).then((client) => {
              client
                .getRooms()
                .then(() => {
                  setClient(client);
                })
                .finally(() => setInited(true));
            });

            refresh();
          } else {
            setInited(true);
          }
        }
      } catch (error) {
        setShowModal(false);
        dispatch(setIsLoading({ loading: false }));
        console.log(error);
      }
    };

    initXmmpClient();
  }, [user]);

  // functionality to handle unreadmessages
  useEffect(() => {
    const updateLastReadTimeStamp = () => {
      if (client) {
        client.actionSetTimestampToPrivateStore(
          room?.jid || roomJID,
          new Date().getTime()
        );
      }
      dispatch(
        setLastViewedTimestamp({
          chatJID: room?.jid || roomJID,
          timestamp: new Date().getTime(),
        })
      );
    };

    const handleBeforeUnload = () => {
      updateLastReadTimeStamp();
    };

    window.addEventListener('blur', handleBeforeUnload);
    window.addEventListener('offline', handleBeforeUnload);

    return () => {
      window.removeEventListener('blur', handleBeforeUnload);
      window.removeEventListener('offline', handleBeforeUnload);
    };
  }, [client, room?.jid]);

  if (user.xmppPassword === '' && user.xmppUsername === '')
    return <LoginForm config={config} />;

  return (
    <>
      {showModal && (
        <Overlay>
          <StyledModal>Unsuccessfull login. Try again</StyledModal>
        </Overlay>
      )}
      {/* {isInited ?? !loading ? ( */}
      <>
        {isInited ? (
          <ChatWrapperBox
            style={{
              ...MainComponentStyles,
            }}
          >
            {!config?.disableRooms && rooms && (
              <RoomList
                chats={Object.values(rooms)}
                onRoomClick={handleChangeChat}
                activeJID={roomJID || ''}
              />
            )}
            <ChatRoom
              CustomMessageComponent={CustomMessageComponent || Message}
              MainComponentStyles={MainComponentStyles}
              chatJID={roomJID}
            />
          </ChatWrapperBox>
        ) : (
          <Loader color={config?.colors?.primary} />
        )}
      </>
    </>
  );
};

export { ChatWrapper };
