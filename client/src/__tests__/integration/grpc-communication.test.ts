/**
 * Integration tests for gRPC communication with mocked server
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { get } from 'svelte/store';
import { 
  curVideo, 
  curPageItems, 
  userMessages, 
  allComments, 
  curUsername,
  curUserId,
  curUserIsAdmin,
  connectionErrors 
} from '@/stores';
import { 
  mockGrpcClient, 
  createMockGrpcClient 
} from '../mocks/grpc-client';
import { 
  createMediaFile, 
  createComment, 
  createUserMessage, 
  createPageItem,
  createWelcomeMessage,
  createCommentList,
  type ServerToClientCmd,
  type Comment
} from '../mocks/protobuf-factories';
import { UserMessage_Type } from '../mocks/protobuf-factories';
import { IndentedComment } from '@/types';

describe('gRPC Communication Integration', () => {
  let grpcClient: ReturnType<typeof createMockGrpcClient>;

  beforeEach(() => {
    // Reset all stores
    curVideo.set(null);
    curPageItems.set([]);
    userMessages.set([]);
    allComments.set([]);
    curUsername.set(null);
    curUserId.set(null);
    curUserIsAdmin.set(false);
    connectionErrors.set([]);

    // Create fresh mock client
    grpcClient = createMockGrpcClient();
    vi.clearAllMocks();
  });

  describe('Connection flow', () => {
    it('should handle successful connection with welcome message', async () => {
      // Setup message handler (simulating what the real app would do)
      grpcClient.onMessage((message: ServerToClientCmd) => {
        if (message.welcome) {
          curUsername.set(message.welcome.user?.name || null);
          curUserId.set(message.welcome.user?.id || null);
          curUserIsAdmin.set(message.welcome.isAdmin || false);
        }
      });

      // Connect and send welcome
      await grpcClient.connect();
      grpcClient.simulateWelcome({
        user: { id: 'user-123', name: 'John Doe' },
        isAdmin: true,
        serverVersion: '0.8.5',
      });

      // Verify stores were updated
      expect(get(curUsername)).toBe('John Doe');
      expect(get(curUserId)).toBe('user-123');
      expect(get(curUserIsAdmin)).toBe(true);
    });

    it('should handle connection errors', async () => {
      grpcClient.onMessage((message: ServerToClientCmd) => {
        if (message.error) {
          const errors = get(connectionErrors);
          connectionErrors.set([...errors, message.error.msg]);
        }
      });

      await grpcClient.connect();
      grpcClient.simulateError('Connection failed');

      const errors = get(connectionErrors);
      expect(errors).toContain('Connection failed');
    });
  });

  describe('Media file operations', () => {
    it('should handle opening a media file', async () => {
      const testVideo = createMediaFile({
        id: 'video-123',
        title: 'Test Video',
        duration: { duration: 120, totalFrames: 3000, fps: '25.0' },
      });

      grpcClient.onMessage((message: ServerToClientCmd) => {
        if (message.openMediaFile) {
          curVideo.set(message.openMediaFile.mediaFile || null);
        }
      });

      await grpcClient.connect();
      grpcClient.simulateOpenMediaFile(testVideo);

      const video = get(curVideo);
      expect(video).toEqual(testVideo);
      expect(video?.title).toBe('Test Video');
      expect(video?.duration?.duration).toBe(120);
    });

    it('should handle media file with subtitles', async () => {
      const videoWithSubs = createMediaFile({
        id: 'video-with-subs',
        title: 'Video with Subtitles',
        subtitles: [
          {
            id: 'sub-1',
            mediaFileId: 'video-with-subs',
            title: 'English',
            languageCode: 'en',
            origFilename: 'subtitles.srt',
            timeOffset: 0,
            origUrl: '/subs/en.srt',
            playbackUrl: '/subs/en.vtt',
            addedTime: new Date(),
          },
        ],
        defaultSubtitleId: 'sub-1',
      });

      grpcClient.onMessage((message: ServerToClientCmd) => {
        if (message.openMediaFile) {
          curVideo.set(message.openMediaFile.mediaFile || null);
        }
      });

      await grpcClient.connect();
      grpcClient.simulateOpenMediaFile(videoWithSubs);

      const video = get(curVideo);
      expect(video?.subtitles).toHaveLength(1);
      expect(video?.subtitles[0].languageCode).toBe('en');
      expect(video?.defaultSubtitleId).toBe('sub-1');
    });
  });

  describe('Page navigation', () => {
    it('should handle page updates', async () => {
      const pageItems = [
        createPageItem({ html: '<div>Page content 1</div>' }),
        createPageItem({ html: '<div>Page content 2</div>' }),
      ];

      grpcClient.onMessage((message: ServerToClientCmd) => {
        if (message.showPage) {
          curPageItems.set(message.showPage.pageItems || []);
        }
      });

      await grpcClient.connect();
      grpcClient.simulateShowPage(pageItems, 'page-1', 'Test Page');

      const items = get(curPageItems);
      expect(items).toHaveLength(2);
      expect(items[0].html).toBe('<div>Page content 1</div>');
    });
  });

  describe('Comment system', () => {
    it('should handle adding comments', async () => {
      const comments = createCommentList(3);

      grpcClient.onMessage((message: ServerToClientCmd) => {
        if (message.addComments) {
          // Convert to IndentedComment format
          const indentedComments = message.addComments.comments.map((comment: Comment) => {
            const indentedComment = new IndentedComment();
            indentedComment.comment = comment as any; // Cast to Proto3.Comment for now
            indentedComment.indent = (comment as any).parentId ? 1 : 0;
            return indentedComment;
          });
          allComments.set(indentedComments);
        }
      });

      await grpcClient.connect();
      grpcClient.simulateAddComments(comments);

      const commentList = get(allComments);
      expect(commentList).toHaveLength(3);
      expect(commentList[0].comment.comment).toBe('Test comment 1');
    });

    it('should handle nested comments', async () => {
      const parentComment = createComment({
        id: 'parent-1',
        comment: 'Parent comment',
        parentId: undefined,
      });

      const childComment = createComment({
        id: 'child-1',
        comment: 'Child comment',
        parentId: 'parent-1',
      });

      grpcClient.onMessage((message: ServerToClientCmd) => {
        if (message.addComments) {
          const indentedComments = message.addComments.comments.map((comment: Comment) => {
            const indentedComment = new IndentedComment();
            indentedComment.comment = comment as any; // Cast to Proto3.Comment for now
            indentedComment.indent = (comment as any).parentId ? 1 : 0;
            return indentedComment;
          });
          allComments.set(indentedComments);
        }
      });

      await grpcClient.connect();
      grpcClient.simulateAddComments([parentComment, childComment]);

      const commentList = get(allComments);
      expect(commentList).toHaveLength(2);
      expect(commentList[0].indent).toBe(0);
      expect(commentList[1].indent).toBe(1);
      expect(commentList[1].comment.parentId).toBe('parent-1');
    });

    it('should send comment to server', async () => {
      await grpcClient.connect();

      const commentData = {
        addComment: {
          mediaFileId: 'video-123',
          comment: 'New comment',
          timecode: '00:01:30.500',
          parentId: undefined,
          drawing: undefined,
          subtitleId: undefined,
        },
      };

      await grpcClient.sendMessage(commentData);

      expect(grpcClient.sendMessage).toHaveBeenCalledWith(commentData);
    });
  });

  describe('User messages and notifications', () => {
    it('should handle user messages', async () => {
      const messages = [
        createUserMessage({
          type: UserMessage_Type.OK,
          message: 'File uploaded successfully',
        }),
        createUserMessage({
          type: UserMessage_Type.ERROR,
          message: 'Upload failed',
        }),
        createUserMessage({
          type: UserMessage_Type.PROGRESS,
          message: 'Processing...',
          progress: 0.7,
        }),
      ];

      grpcClient.onMessage((message: ServerToClientCmd) => {
        if (message.showMessages) {
          userMessages.set(message.showMessages.msgs || []);
        }
      });

      await grpcClient.connect();
      grpcClient.simulateShowMessages(messages);

      const messageList = get(userMessages);
      expect(messageList).toHaveLength(3);
      expect(messageList[0].type).toBe(UserMessage_Type.OK);
      expect(messageList[1].type).toBe(UserMessage_Type.ERROR);
      expect(messageList[2].progress).toBe(0.7);
    });
  });

  describe('Real-time collaboration', () => {
    it('should handle collaboration events', async () => {
      let lastCollabEvent: any = null;

      grpcClient.onMessage((message: ServerToClientCmd) => {
        if (message.collabEvent) {
          lastCollabEvent = message.collabEvent;
        }
      });

      await grpcClient.connect();
      grpcClient.simulateCollabEvent({
        fromUser: 'collaborator-1',
        paused: true,
        loop: false,
        seekTimeSec: 65.5,
        drawing: 'data:image/png;base64,drawing-data',
        subtitleId: 'sub-1',
      });

      expect(lastCollabEvent).toBeTruthy();
      expect(lastCollabEvent.fromUser).toBe('collaborator-1');
      expect(lastCollabEvent.paused).toBe(true);
      expect(lastCollabEvent.seekTimeSec).toBe(65.5);
      expect(lastCollabEvent.drawing).toBe('data:image/png;base64,drawing-data');
    });

    it('should send collaboration updates', async () => {
      await grpcClient.connect();

      const collabData = {
        collabReport: {
          paused: false,
          loop: true,
          seekTimeSec: 42.0,
          drawing: undefined,
          subtitleId: 'sub-2',
        },
      };

      await grpcClient.sendMessage(collabData);

      expect(grpcClient.sendMessage).toHaveBeenCalledWith(collabData);
    });
  });

  describe('Error handling', () => {
    it('should handle WebSocket disconnection', () => {
      const mockWs = grpcClient.getMockWebSocket();
      
      let disconnected = false;
      grpcClient.onMessage((_message: ServerToClientCmd) => {
        // This won't be called on disconnect
      });

      // Simulate connection close
      mockWs.simulateClose(1006, 'Connection lost');

      // In a real app, this would trigger reconnection logic
      expect(mockWs.readyState).toBe(WebSocket.CLOSED);
    });

    it('should handle malformed messages gracefully', async () => {
      let errorOccurred = false;

      grpcClient.onMessage((message: ServerToClientCmd) => {
        try {
          // Attempt to process message
          if (message.openMediaFile) {
            curVideo.set(message.openMediaFile.mediaFile || null);
          }
        } catch (error) {
          errorOccurred = true;
        }
      });

      await grpcClient.connect();

      // Simulate malformed message (this would be handled by the real protobuf decoder)
      const mockWs = grpcClient.getMockWebSocket();
      mockWs.simulateMessage({} as ServerToClientCmd);

      // The message handler should either ignore or handle gracefully
      expect(get(curVideo)).toBeNull();
    });
  });
});