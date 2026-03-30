/**
 * Tests for Svelte stores
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { get } from 'svelte/store';
import {
  clientConfig,
  mediaFileId,
  curVideo,
  videoIsReady,
  curPageItems,
  curPageId,
  curUsername,
  curUserId,
  curUserIsAdmin,
  curUserPic,
  allComments,
  curSubtitle,
  subtitleEditingId,
  userMessages,
  latestProgressReports,
  connectionErrors,
  collabId,
  userMenuItems,
  selectedTiles,
  serverDefinedActions,
} from '@/stores';
import { 
  createMediaFile, 
  createComment, 
  createUserMessage, 
  createPageItem,
  createSubtitle,
  createCommentList 
} from '../mocks/protobuf-factories';
import { UserMessage_Type } from '../mocks/protobuf-factories';
import { IndentedComment } from '@/types';

describe('Stores', () => {
  beforeEach(() => {
    // Reset all stores to initial state
    clientConfig.set(null);
    mediaFileId.set(null);
    curVideo.set(null);
    videoIsReady.set(false);
    curPageItems.set([]);
    curPageId.set(null);
    curUsername.set(null);
    curUserId.set(null);
    curUserIsAdmin.set(false);
    curUserPic.set(null);
    allComments.set([]);
    curSubtitle.set(null);
    subtitleEditingId.set(null);
    userMessages.set([]);
    latestProgressReports.set([]);
    connectionErrors.set([]);
    collabId.set(null);
    userMenuItems.set([]);
    selectedTiles.set({});
    serverDefinedActions.set({});
  });

  describe('clientConfig', () => {
    it('should initialize as null', () => {
      expect(get(clientConfig)).toBeNull();
    });

    it('should update with configuration object', () => {
      const config = { apiUrl: 'http://test.com', theme: 'dark' };
      clientConfig.set(config);
      expect(get(clientConfig)).toEqual(config);
    });
  });

  describe('mediaFileId and curVideo', () => {
    it('should initialize as null', () => {
      expect(get(mediaFileId)).toBeNull();
      expect(get(curVideo)).toBeNull();
    });

    it('should update with media file data', () => {
      const testId = 'test-media-123';
      const testVideo = createMediaFile({ id: testId, title: 'Test Video' });
      
      mediaFileId.set(testId);
      curVideo.set(testVideo);
      
      expect(get(mediaFileId)).toBe(testId);
      expect(get(curVideo)).toEqual(testVideo);
    });

    it('should handle media file with subtitles', () => {
      const subtitle = createSubtitle({ id: 'subtitle-1', title: 'English' });
      const testVideo = createMediaFile({ 
        id: 'test-video-with-subs',
        subtitles: [subtitle],
        defaultSubtitleId: 'subtitle-1'
      });
      
      curVideo.set(testVideo);
      
      const video = get(curVideo);
      expect(video?.subtitles).toHaveLength(1);
      expect(video?.subtitles[0].title).toBe('English');
      expect(video?.defaultSubtitleId).toBe('subtitle-1');
    });
  });

  describe('videoIsReady', () => {
    it('should initialize as false', () => {
      expect(get(videoIsReady)).toBe(false);
    });

    it('should update ready state', () => {
      videoIsReady.set(true);
      expect(get(videoIsReady)).toBe(true);
      
      videoIsReady.set(false);
      expect(get(videoIsReady)).toBe(false);
    });
  });

  describe('curPageItems and curPageId', () => {
    it('should initialize as empty array and null', () => {
      expect(get(curPageItems)).toEqual([]);
      expect(get(curPageId)).toBeNull();
    });

    it('should update with page data', () => {
      const pageItems = [
        createPageItem({ html: '<div>Page 1</div>' }),
        createPageItem({ html: '<div>Page 2</div>' }),
      ];
      const pageId = 'test-page-123';
      
      curPageItems.set(pageItems);
      curPageId.set(pageId);
      
      expect(get(curPageItems)).toEqual(pageItems);
      expect(get(curPageId)).toBe(pageId);
    });
  });

  describe('user information stores', () => {
    it('should initialize user info as null/false', () => {
      expect(get(curUsername)).toBeNull();
      expect(get(curUserId)).toBeNull();
      expect(get(curUserIsAdmin)).toBe(false);
      expect(get(curUserPic)).toBeNull();
    });

    it('should update user information', () => {
      const username = 'testuser';
      const userId = 'user-123';
      const userPic = '/images/user-pic.jpg';
      
      curUsername.set(username);
      curUserId.set(userId);
      curUserIsAdmin.set(true);
      curUserPic.set(userPic);
      
      expect(get(curUsername)).toBe(username);
      expect(get(curUserId)).toBe(userId);
      expect(get(curUserIsAdmin)).toBe(true);
      expect(get(curUserPic)).toBe(userPic);
    });
  });

  describe('allComments', () => {
    it('should initialize as empty array', () => {
      expect(get(allComments)).toEqual([]);
    });

    it('should update with comment list', () => {
      const comments = createCommentList(3);
      // Convert to IndentedComment format
      const indentedComments = comments.map(comment => {
        const indentedComment = new IndentedComment();
        indentedComment.comment = comment as any; // Cast to Proto3.Comment for now
        indentedComment.indent = 0;
        return indentedComment;
      });
      
      allComments.set(indentedComments);
      
      const result = get(allComments);
      expect(result).toHaveLength(3);
      expect(result[0].comment.comment).toBe('Test comment 1');
    });

    it('should handle nested comments', () => {
      const parentComment = createComment({ 
        id: 'parent-1', 
        comment: 'Parent comment' 
      });
      const childComment = createComment({ 
        id: 'child-1', 
        parentId: 'parent-1',
        comment: 'Child comment' 
      });
      
      const indentedComments = [parentComment, childComment].map((comment, index) => {
        const indentedComment = new IndentedComment();
        indentedComment.comment = comment as any; // Cast to Proto3.Comment for now
        indentedComment.indent = comment.parentId ? 1 : 0;
        return indentedComment;
      });
      
      allComments.set(indentedComments);
      
      const result = get(allComments);
      expect(result).toHaveLength(2);
      expect(result[0].indent).toBe(0);
      expect(result[1].indent).toBe(1);
      expect(result[1].comment.parentId).toBe('parent-1');
    });
  });

  describe('subtitle stores', () => {
    it('should initialize subtitle stores as null', () => {
      expect(get(curSubtitle)).toBeNull();
      expect(get(subtitleEditingId)).toBeNull();
    });

    it('should update current subtitle', () => {
      const subtitle = createSubtitle({ 
        id: 'subtitle-1', 
        title: 'English Subtitles',
        languageCode: 'en'
      });
      
      curSubtitle.set(subtitle);
      
      expect(get(curSubtitle)).toEqual(subtitle);
    });

    it('should track subtitle editing state', () => {
      const editingId = 'subtitle-edit-123';
      
      subtitleEditingId.set(editingId);
      
      expect(get(subtitleEditingId)).toBe(editingId);
    });
  });

  describe('userMessages', () => {
    it('should initialize as empty array', () => {
      expect(get(userMessages)).toEqual([]);
    });

    it('should update with user messages', () => {
      const messages = [
        createUserMessage({ 
          type: UserMessage_Type.OK, 
          message: 'Success message' 
        }),
        createUserMessage({ 
          type: UserMessage_Type.ERROR, 
          message: 'Error message' 
        }),
        createUserMessage({ 
          type: UserMessage_Type.PROGRESS, 
          message: 'Progress message',
          progress: 0.5 
        }),
      ];
      
      userMessages.set(messages);
      
      const result = get(userMessages);
      expect(result).toHaveLength(3);
      expect(result[0].type).toBe(UserMessage_Type.OK);
      expect(result[1].type).toBe(UserMessage_Type.ERROR);
      expect(result[2].progress).toBe(0.5);
    });
  });

  describe('latestProgressReports', () => {
    it('should initialize as empty array', () => {
      expect(get(latestProgressReports)).toEqual([]);
    });

    it('should update with progress reports', () => {
      const reports = [
        { mediaFileId: 'media-1', progress: 0.25, msg: 'processing', received_ts: Date.now() },
        { mediaFileId: 'media-2', progress: 0.75, msg: 'transcoding', received_ts: Date.now() },
      ];
      
      latestProgressReports.set(reports);
      
      expect(get(latestProgressReports)).toEqual(reports);
    });
  });

  describe('connectionErrors', () => {
    it('should initialize as empty array', () => {
      expect(get(connectionErrors)).toEqual([]);
    });

    it('should accumulate connection errors', () => {
      const errors = ['Connection timeout', 'Server unavailable'];
      
      connectionErrors.set(errors);
      
      expect(get(connectionErrors)).toEqual(errors);
    });

    it('should handle adding new errors', () => {
      connectionErrors.set(['Error 1']);
      
      const currentErrors = get(connectionErrors);
      const newErrors = [...currentErrors, 'Error 2'];
      connectionErrors.set(newErrors);
      
      expect(get(connectionErrors)).toEqual(['Error 1', 'Error 2']);
    });
  });

  describe('collabId', () => {
    it('should initialize as null', () => {
      expect(get(collabId)).toBeNull();
    });

    it('should update with collaboration ID', () => {
      const testCollabId = 'collab-session-123';
      
      collabId.set(testCollabId);
      
      expect(get(collabId)).toBe(testCollabId);
    });
  });

  describe('selectedTiles', () => {
    it('should initialize as empty object', () => {
      expect(get(selectedTiles)).toEqual({});
    });

    it('should update with selected tiles', () => {
      const mediaFile1 = createMediaFile({ id: 'tile-1', title: 'Video 1' });
      const mediaFile2 = createMediaFile({ id: 'tile-2', title: 'Video 2' });
      const tiles = {
        'tile-1': { id: 'tile-1', obj: { mediaFile: mediaFile1, popupActions: [] } },
        'tile-2': { id: 'tile-2', obj: { mediaFile: mediaFile2, popupActions: [] } },
      };
      
      selectedTiles.set(tiles);
      
      expect(get(selectedTiles)).toEqual(tiles);
    });

    it('should handle tile selection and deselection', () => {
      const mediaFile1 = createMediaFile({ id: 'tile-1', title: 'Video 1' });
      const mediaFile2 = createMediaFile({ id: 'tile-2', title: 'Video 2' });
      const tile1 = { id: 'tile-1', obj: { mediaFile: mediaFile1, popupActions: [] } };
      const tile2 = { id: 'tile-2', obj: { mediaFile: mediaFile2, popupActions: [] } };
      
      // Select first tile
      selectedTiles.set({ 'tile-1': tile1 });
      expect(get(selectedTiles)).toEqual({ 'tile-1': tile1 });
      
      // Add second tile
      selectedTiles.set({ 'tile-1': tile1, 'tile-2': tile2 });
      expect(get(selectedTiles)).toEqual({ 'tile-1': tile1, 'tile-2': tile2 });
      
      // Remove first tile
      selectedTiles.set({ 'tile-2': tile2 });
      expect(get(selectedTiles)).toEqual({ 'tile-2': tile2 });
    });
  });

  describe('serverDefinedActions', () => {
    it('should initialize as empty object', () => {
      expect(get(serverDefinedActions)).toEqual({});
    });

    it('should update with server-defined actions', () => {
      const actions = {
        'rename': {
          uiProps: {
            label: 'Rename',
            icon: { faClass: { classes: 'fa fa-edit' } },
            keyShortcut: 'F2',
            naturalDesc: 'Rename the selected item',
          },
          action: {
            code: 'console.log("rename action")',
            lang: 0, // JAVASCRIPT
          },
        },
        'delete': {
          uiProps: {
            label: 'Delete',
            icon: { faClass: { classes: 'fa fa-trash' } },
            keyShortcut: 'Delete',
            naturalDesc: 'Delete the selected item',
          },
          action: {
            code: 'console.log("delete action")',
            lang: 0, // JAVASCRIPT
          },
        },
      };
      
      serverDefinedActions.set(actions);
      
      const result = get(serverDefinedActions);
      expect(result).toEqual(actions);
      expect(result['rename'].uiProps?.label).toBe('Rename');
      expect(result['delete'].uiProps?.keyShortcut).toBe('Delete');
    });
  });

  describe('store reactivity', () => {
    it('should trigger reactivity when stores update', () => {
      const subscriber = vi.fn();
      
      const unsubscribe = mediaFileId.subscribe(subscriber);
      
      expect(subscriber).toHaveBeenCalledWith(null); // initial value
      
      mediaFileId.set('test-id');
      expect(subscriber).toHaveBeenCalledWith('test-id');
      
      mediaFileId.set('another-id');
      expect(subscriber).toHaveBeenCalledWith('another-id');
      
      unsubscribe();
    });

    it('should handle multiple subscribers', () => {
      const subscriber1 = vi.fn();
      const subscriber2 = vi.fn();
      
      const unsubscribe1 = videoIsReady.subscribe(subscriber1);
      const unsubscribe2 = videoIsReady.subscribe(subscriber2);
      
      videoIsReady.set(true);
      
      expect(subscriber1).toHaveBeenCalledWith(true);
      expect(subscriber2).toHaveBeenCalledWith(true);
      
      unsubscribe1();
      unsubscribe2();
    });
  });
});