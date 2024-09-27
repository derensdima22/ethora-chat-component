import React, { useEffect, useRef } from "react";
import {
  Message,
  UserName,
  MessageText,
  MessageTimestamp,
  MessagesScroll,
  MessagesList,
} from "../styled/StyledComponents";
import { IConfig, IMessage, IRoom, User } from "../../types/types";
import SystemMessage from "./SystemMessage";
import DateLabel from "../styled/DateLabel";
import Loader from "../styled/Loader";
import { blockScrollEvent } from "../../helpers/block_scroll";
import { useSelector } from "react-redux";
import { RootState } from "../../roomStore";
import Composing from "../styled/StyledInputComponents/Composing";
import { validateMessages } from "../../helpers/validator";
import NewMessageLabel from "../styled/NewMessageLabel";

interface MessageListProps<TMessage extends IMessage> {
  messages: TMessage[];
  CustomMessage?: React.ComponentType<{ message: TMessage; isUser: boolean }>;
  user: User;
  room: IRoom;
  loadMoreMessages: (
    chatJID: string,
    max: number,
    amount?: number
  ) => Promise<void>;
  config?: IConfig;
}

const MessageList = <TMessage extends IMessage>({
  messages,
  CustomMessage,
  user,
  loadMoreMessages,
  room,
  config,
}: MessageListProps<TMessage>) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const outerRef = useRef<HTMLDivElement>(null);
  const lastMessageRef = useRef<IMessage>(messages[messages.length - 1]);
  const isLoadingMore = useRef<boolean>(false);

  const timeoutRef = useRef<number>(0);
  const scrollParams = useRef<{ top: number; height: number } | null>(null);
  const { isLoading, composing, lastViewedTimestamp } = useSelector(
    (state: RootState) => state.rooms.rooms[room.jid]
  );

  const scrollToBottom = (): void => {
    const content = containerRef.current;
    if (content) {
      const height = content.clientHeight;
      const scroll_height = content.scrollHeight;

      if (scroll_height > height) {
        content.scrollTop = scroll_height - height;
      }
    }
  };

  const getScrollParams = (): { top: number; height: number } | null => {
    const content = containerRef.current;
    if (!content) {
      return null;
    }
    return {
      top: content.scrollTop,
      height: content.scrollHeight,
    };
  };

  const blockScroll = () => {
    const content = containerRef.current;
    if (content) {
      blockScrollEvent(content);
    }
  };

  const checkIfLoadMoreMessages = () => {
    const params = getScrollParams();
    if (!params) return;

    if (params.top < 150 && !isLoadingMore.current) {
      scrollParams.current = getScrollParams();
      const firstMessage = messages[0];
      if (firstMessage?.user?.id) {
        isLoadingMore.current = true;

        loadMoreMessages(
          messages[0].roomJID,
          30,
          Number(messages[0].id)
        ).finally(() => {
          isLoadingMore.current = false;
          lastMessageRef.current = messages[messages.length - 1];
        });
      }
    }
  };

  const onScroll = () => {
    window.clearTimeout(timeoutRef.current);
    timeoutRef.current = window.setTimeout(() => checkIfLoadMoreMessages(), 50);
  };

  useEffect(() => {
    scrollToBottom();
    blockScroll();

    const messagesOuter = outerRef.current;

    if (messagesOuter) {
      messagesOuter.addEventListener("scroll", onScroll, true);
    }

    return () => {
      messagesOuter &&
        messagesOuter.removeEventListener("scroll", onScroll, true);
    };
  }, []);

  useEffect(() => {
    if (messages.length < 30) {
      scrollToBottom();
    } else {
      lastMessageRef.current.id !== messages[messages.length - 1].id &&
        scrollToBottom();
    }
  }, [messages, composing]);

  useEffect(() => {
    if (messages && messages.length > 30) {
      if (scrollParams.current) {
        const _scrollParams = getScrollParams();

        if (_scrollParams && containerRef.current) {
          const scrollTop =
            scrollParams.current.top +
            (_scrollParams.height - scrollParams.current.height);
          containerRef.current.scrollTop = scrollTop;
        }

        scrollParams.current = null;
      }
    }
  }, [messages, composing]);

  if (!validateMessages(messages)) {
    console.log("Invalid 'messages' props provided to MessageList.");
    return null;
  }

  let lastDateLabel: string | null = null;

  return (
    <MessagesList ref={outerRef}>
      <MessagesScroll
        ref={containerRef}
        onScroll={onScroll}
        color={config?.colors?.primary}
      >
        {isLoading && <Loader color={config?.colors?.primary} />}
        {messages.map((message) => {
          const isUser = message.user.id === user.walletAddress;
          const messageDate = new Date(message.date);
          const currentDateLabel = messageDate.toDateString();

          const showDateLabel = currentDateLabel !== lastDateLabel;
          if (showDateLabel) {
            lastDateLabel = currentDateLabel;
          }

          if (message.isSystemMessage === "true") {
            return (
              <React.Fragment key={message.id}>
                {showDateLabel && (
                  <DateLabel date={messageDate} colors={config?.colors} />
                )}
                <SystemMessage messageText={message.body} />
              </React.Fragment>
            );
          }

          const MessageComponent = CustomMessage || Message;

          return (
            <React.Fragment key={message.id}>
              {showDateLabel && (
                <DateLabel date={messageDate} colors={config?.colors} />
              )}
              <MessageComponent message={message} isUser={isUser}>
                {!CustomMessage && (
                  <>
                    <MessageTimestamp>
                      {messageDate.toLocaleTimeString()}
                    </MessageTimestamp>
                    <UserName>{message.user.name}: </UserName>
                    <MessageText>{message.body}</MessageText>
                  </>
                )}
              </MessageComponent>
            </React.Fragment>
          );
        })}
        {composing && <Composing usersTyping={["User"]} />}
        {/* {lastViewedTimestamp && (
          <NewMessageLabel color={config?.colors?.primary} />
        )} */}
      </MessagesScroll>
    </MessagesList>
  );
};

export default MessageList;
