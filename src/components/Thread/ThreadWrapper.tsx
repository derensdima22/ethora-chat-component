import { FC } from 'react';
import { IMessage } from '../../types/types';
import { ChatContainer } from '../styled/StyledComponents';
import ThreadHeader from './ThreadHeader';
import { Message } from '../MessageBubble/Message';
import ChatRoom from '../MainComponents/ChatRoom';
import SendInput from '../styled/SendInput';

interface ThreadWrapperProps {
  activeMessage: IMessage;
}

const ThreadWrapper: FC<ThreadWrapperProps> = ({ activeMessage }) => {
  return (
    <ChatContainer style={{width: "50%", height: "100%", justifyContent: "space-between"}}>
      <div>
        <ThreadHeader chatJID={activeMessage.roomJID}/>
        <Message message={activeMessage} isUser />
      </div>
      <SendInput
        isLoading={false}
        sendMedia={() => console.log("sendMedia")}
        sendMessage={() => console.log("sendMessage")}
      />
    </ChatContainer>
  );
};

export default ThreadWrapper;