/**
 * Factory functions for creating strongly-typed protobuf messages for testing
 */

// Define basic types for when protobuf isn't available
export interface MediaFile {
  id: string;
  title?: string;
  userId: string;
  mediaType: string;
  duration?: MediaFileDuration;
  addedTime?: Date;
  previewData?: MediaFilePreviewData;
  processingMetadata?: MediaFileProcessingMetadata;
  subtitles: Subtitle[];
  defaultSubtitleId?: string;
  playbackUrl?: string;
  origUrl?: string;
}

export interface MediaFileDuration {
  duration: number;
  totalFrames: number;
  fps: string;
}

export interface MediaFilePreviewData {
  thumbUrl?: string;
  thumbSheet?: ThumbSheet;
}

export interface ThumbSheet {
  url: string;
  rows: number;
  cols: number;
}

export interface MediaFileProcessingMetadata {
  recompressionDone?: Date;
  thumbsDone?: Date;
  origFilename: string;
  ffprobeMetadataAll?: string;
}

export interface Subtitle {
  id: string;
  mediaFileId: string;
  title: string;
  languageCode: string;
  origFilename: string;
  timeOffset: number;
  origUrl: string;
  playbackUrl: string;
  addedTime?: Date;
}

export interface Comment {
  id: string;
  mediaFileId: string;
  userId?: string;
  usernameIfnull: string;
  comment: string;
  timecode?: string;
  parentId?: string;
  drawing?: string;
  subtitleId?: string;
  subtitleFilenameIfnull?: string;
  created?: Date;
  edited?: Date;
}

export interface UserInfo {
  id: string;
  name?: string; // Make optional to match actual protobuf structure
}

export interface UserMessage {
  id?: string;
  userId?: string;
  created?: Date;
  seen: boolean;
  type: UserMessage_Type;
  refs: UserMessage_Refs;
  message: string;
  details?: string;
  progress?: number;
}

export interface UserMessage_Refs {
  mediaFileId?: string;
  commentId?: string;
  subtitleId?: string;
}

export enum UserMessage_Type {
  OK = 0,
  ERROR = 1,
  PROGRESS = 2,
  MEDIA_FILE_UPDATED = 3,
  MEDIA_FILE_ADDED = 4,
}

export interface PageItem {
  html?: string;
  folderListing?: PageItem_FolderListing;
}

export interface PageItem_FolderListing {
  items: PageItem_FolderListing_Item[];
  popupActions: string[];
  listingData: { [key: string]: string };
  allowReordering: boolean;
  allowUpload: boolean;
  mediaFileAddedAction?: string;
}

export interface PageItem_FolderListing_Folder {
  id: string;
  title: string;
  previewItems: PageItem_FolderListing_Item[];
}

export interface PageItem_FolderListing_Item {
  folder?: PageItem_FolderListing_Folder;
  mediaFile?: MediaFile;
  vis?: PageItem_FolderListing_Item_Visualization;
  openAction?: any;
  popupActions: string[];
}

export interface PageItem_FolderListing_Item_Visualization {
  baseColor?: Color;
  icon?: Icon;
}

export interface Color {
  r: number;
  g: number;
  b: number;
}

export interface Icon {
  faClass?: { classes: string; color?: Color };
  imgUrl?: string;
  size?: number;
}

export interface ScriptCall {
  code: string;
  lang: any; // Use any to avoid conflicts with actual Proto3 enums
  data?: string;
}

export interface ActionDef {
  uiProps?: {
    label?: string;
    icon?: Icon;
  };
  action?: ScriptCall;
}

// Client message types
export interface ServerToClientCmd {
  welcome?: ServerToClientCmd_Welcome;
  error?: ServerToClientCmd_Error;
  showPage?: ServerToClientCmd_ShowPage;
  defineActions?: any;
  showMessages?: ServerToClientCmd_ShowMessages;
  openMediaFile?: ServerToClientCmd_OpenMediaFile;
  addComments?: ServerToClientCmd_AddComments;
  delComment?: any;
  collabEvent?: ServerToClientCmd_CollabEvent;
  setCookies?: any;
}

export interface ServerToClientCmd_Welcome {
  user?: UserInfo;
  isAdmin: boolean;
  serverVersion: string;
}

export interface ServerToClientCmd_Error {
  msg: string;
}

export interface ServerToClientCmd_ShowPage {
  pageItems: PageItem[];
  pageId?: string;
  pageTitle?: string;
}

export interface ServerToClientCmd_ShowMessages {
  msgs: UserMessage[];
}

export interface ServerToClientCmd_OpenMediaFile {
  mediaFile?: MediaFile;
}

export interface ServerToClientCmd_AddComments {
  comments: Comment[];
}

export interface ServerToClientCmd_CollabEvent {
  fromUser: string;
  paused: boolean;
  loop: boolean;
  seekTimeSec: number;
  drawing?: string;
  subtitleId?: string;
}

export interface ClientToServerCmd {
  openNavigationPage?: any;
  openMediaFile?: any;
  delMediaFile?: any;
  renameMediaFile?: any;
  addComment?: ClientToServerCmd_AddComment;
  editComment?: any;
  delComment?: any;
  addSubtitle?: any;
  editSubtitleInfo?: any;
  delSubtitle?: any;
  listMyMessages?: any;
  joinCollab?: any;
  leaveCollab?: any;
  collabReport?: any;
  organizerCmd?: any;
  moveToFolder?: any;
  reorderItems?: any;
  logout?: any;
}

export interface ClientToServerCmd_AddComment {
  mediaFileId: string;
  comment: string;
  timecode?: string;
  parentId?: string;
  drawing?: string;
  subtitleId?: string;
}

// Common data factories
export const createMediaFile = (overrides: Partial<MediaFile> = {}): MediaFile => ({
  id: 'test-media-file-id',
  title: 'Test Video',
  userId: 'test-user-id',
  mediaType: 'video',
  duration: {
    duration: 120.5,
    totalFrames: 3000,
    fps: '25.0',
  },
  addedTime: new Date('2023-01-01T12:00:00Z'),
  previewData: {
    thumbUrl: '/thumb/test-thumb.webp',
    thumbSheet: {
      url: '/thumb/test-sheet.webp',
      rows: 10,
      cols: 10,
    },
  },
  processingMetadata: {
    recompressionDone: new Date('2023-01-01T12:05:00Z'),
    thumbsDone: new Date('2023-01-01T12:06:00Z'),
    origFilename: 'test-video.mp4',
    ffprobeMetadataAll: '{}',
  },
  subtitles: [],
  defaultSubtitleId: undefined,
  playbackUrl: '/video/test-video.mp4',
  origUrl: '/orig/test-video.mp4',
  ...overrides,
});

// Helper for creating minimal MediaFile for tests that just need basic structure
export const createMinimalMediaFile = (overrides: Partial<MediaFile> = {}): MediaFile => ({
  id: 'test-video-id',
  title: 'Test Video',
  userId: 'test-user-id',
  mediaType: 'video',
  duration: {
    duration: 300,
    totalFrames: 7500,
    fps: '25.0',
  },
  subtitles: [],
  playbackUrl: 'http://example.com/video.mp4',
  ...overrides,
});

export const createComment = (overrides: Partial<Comment> = {}): Comment => ({
  id: 'test-comment-id',
  mediaFileId: 'test-media-file-id',
  userId: 'test-user-id',
  usernameIfnull: 'TestUser',
  comment: 'This is a test comment',
  timecode: '00:01:30.500',
  parentId: undefined,
  drawing: undefined,
  subtitleId: undefined,
  subtitleFilenameIfnull: undefined,
  created: new Date('2023-01-01T12:10:00Z'),
  edited: undefined,
  ...overrides,
});

export const createSubtitle = (overrides: Partial<Subtitle> = {}): Subtitle => ({
  id: 'test-subtitle-id',
  mediaFileId: 'test-media-file-id',
  title: 'Test Subtitles',
  languageCode: 'en',
  origFilename: 'test-subtitles.srt',
  timeOffset: 0.0,
  origUrl: '/orig/test-subtitles.srt',
  playbackUrl: '/subtitles/test-subtitles.vtt',
  addedTime: new Date('2023-01-01T12:07:00Z'),
  ...overrides,
});

export const createUserInfo = (overrides: Partial<UserInfo> = {}): UserInfo => ({
  id: 'test-user-id',
  name: 'Test User',
  ...overrides,
});

export const createUserMessage = (overrides: Partial<UserMessage> = {}): UserMessage => ({
  id: 'test-message-id',
  userId: 'test-user-id',
  created: new Date('2023-01-01T12:15:00Z'),
  seen: false,
  type: UserMessage_Type.OK,
  refs: {
    mediaFileId: undefined,
    commentId: undefined,
    subtitleId: undefined,
  },
  message: 'Test message',
  details: undefined,
  progress: undefined,
  ...overrides,
});

export const createPageItem = (overrides: Partial<PageItem> = {}): PageItem => ({
  html: '<div>Test HTML content</div>',
  folderListing: undefined,
  ...overrides,
});

export const createFolderListing = (overrides: Partial<PageItem_FolderListing> = {}): PageItem_FolderListing => ({
  items: [],
  popupActions: [],
  listingData: {},
  allowReordering: false,
  allowUpload: false,
  mediaFileAddedAction: undefined,
  ...overrides,
});

export const createFolderListingItem = (overrides: Partial<PageItem_FolderListing_Item> = {}): PageItem_FolderListing_Item => ({
  folder: undefined,
  mediaFile: undefined,
  vis: undefined,
  openAction: undefined,
  popupActions: [],
  ...overrides,
});

// Client message factories
export const createServerToClientCmd = (overrides: Partial<ServerToClientCmd> = {}): ServerToClientCmd => ({
  welcome: undefined,
  error: undefined,
  showPage: undefined,
  defineActions: undefined,
  showMessages: undefined,
  openMediaFile: undefined,
  addComments: undefined,
  delComment: undefined,
  collabEvent: undefined,
  setCookies: undefined,
  ...overrides,
});

export const createWelcomeMessage = (overrides: Partial<ServerToClientCmd_Welcome> = {}): ServerToClientCmd_Welcome => ({
  user: createUserInfo(),
  isAdmin: false,
  serverVersion: '0.8.5',
  ...overrides,
});

export const createErrorMessage = (overrides: Partial<ServerToClientCmd_Error> = {}): ServerToClientCmd_Error => ({
  msg: 'Test error message',
  ...overrides,
});

export const createShowPageMessage = (overrides: Partial<ServerToClientCmd_ShowPage> = {}): ServerToClientCmd_ShowPage => ({
  pageItems: [],
  pageId: 'test-page-id',
  pageTitle: 'Test Page',
  ...overrides,
});

export const createClientToServerCmd = (overrides: Partial<ClientToServerCmd> = {}): ClientToServerCmd => ({
  openNavigationPage: undefined,
  openMediaFile: undefined,
  delMediaFile: undefined,
  renameMediaFile: undefined,
  addComment: undefined,
  editComment: undefined,
  delComment: undefined,
  addSubtitle: undefined,
  editSubtitleInfo: undefined,
  delSubtitle: undefined,
  listMyMessages: undefined,
  joinCollab: undefined,
  leaveCollab: undefined,
  collabReport: undefined,
  organizerCmd: undefined,
  moveToFolder: undefined,
  reorderItems: undefined,
  logout: undefined,
  ...overrides,
});

export const createAddCommentCmd = (overrides: Partial<ClientToServerCmd_AddComment> = {}): ClientToServerCmd_AddComment => ({
  mediaFileId: 'test-media-file-id',
  comment: 'Test comment',
  timecode: '00:01:30.500',
  parentId: undefined,
  drawing: undefined,
  subtitleId: undefined,
  ...overrides,
});

// Helper functions for creating arrays of messages
export const createMediaFileList = (count: number = 3): MediaFile[] => {
  return Array.from({ length: count }, (_, i) => createMediaFile({
    id: `media-file-${i}`,
    title: `Test Video ${i + 1}`,
  }));
};

export const createCommentList = (count: number = 3): Comment[] => {
  return Array.from({ length: count }, (_, i) => createComment({
    id: `comment-${i}`,
    comment: `Test comment ${i + 1}`,
    timecode: `00:0${i}:${String(i * 10).padStart(2, '0')}.000`,
  }));
};

// Nested comment helpers (for reply threads)
export const createCommentThread = (parentComment: Comment, replyCount: number = 2): Comment[] => {
  const replies = Array.from({ length: replyCount }, (_, i) => createComment({
    id: `reply-${parentComment.id}-${i}`,
    parentId: parentComment.id,
    comment: `Reply ${i + 1} to: ${parentComment.comment}`,
  }));
  
  return [parentComment, ...replies];
};