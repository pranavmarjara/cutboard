/**
 * Mock gRPC client for testing
 * Provides strongly typed mocks of all gRPC communication methods
 */
import { vi } from 'vitest';
import { 
  createServerToClientCmd, 
  createWelcomeMessage, 
  createErrorMessage,
  createShowPageMessage,
  createMediaFile,
  createComment,
  createUserMessage,
  type ServerToClientCmd,
  type ServerToClientCmd_Welcome,
  type ServerToClientCmd_ShowPage,
  type ServerToClientCmd_CollabEvent,
  type ClientToServerCmd,
  type MediaFile,
  type Comment,
  type UserMessage,
  type PageItem
} from './protobuf-factories';

// Mock WebSocket connection
export const createMockWebSocket = () => {
  const mockWs = {
    send: vi.fn(),
    close: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    readyState: WebSocket.OPEN as number,
    onopen: null as ((event: Event) => void) | null,
    onclose: null as ((event: CloseEvent) => void) | null,
    onmessage: null as ((event: MessageEvent) => void) | null,
    onerror: null as ((event: Event) => void) | null,
    
    // Helper methods for testing
    simulateOpen: () => {
      if (mockWs.onopen) {
        mockWs.onopen(new Event('open'));
      }
    },
    
    simulateMessage: (data: ServerToClientCmd) => {
      if (mockWs.onmessage) {
        const mockEvent = {
          data: JSON.stringify(data),
          type: 'message',
        } as MessageEvent;
        mockWs.onmessage(mockEvent);
      }
    },
    
    simulateClose: (code: number = 1000, reason: string = 'Normal closure') => {
      mockWs.readyState = 3; // WebSocket.CLOSED
      if (mockWs.onclose) {
        const mockEvent = {
          code,
          reason,
          wasClean: code === 1000,
          type: 'close',
        } as CloseEvent;
        mockWs.onclose(mockEvent);
      }
    },
    
    simulateError: () => {
      if (mockWs.onerror) {
        mockWs.onerror(new Event('error'));
      }
    },
  };
  
  return mockWs;
};

// Mock gRPC client that handles protobuf serialization
export class MockGrpcClient {
  private mockWs: ReturnType<typeof createMockWebSocket>;
  private messageHandlers: Map<string, (message: ServerToClientCmd) => void> = new Map();
  
  constructor() {
    this.mockWs = createMockWebSocket();
  }
  
  // Connection methods
  connect = vi.fn().mockImplementation(() => {
    setTimeout(() => this.mockWs.simulateOpen(), 0);
    return Promise.resolve();
  });
  
  disconnect = vi.fn().mockImplementation(() => {
    this.mockWs.simulateClose();
  });
  
  // Message sending
  sendMessage = vi.fn().mockImplementation((message: ClientToServerCmd) => {
    // In real implementation, this would serialize and send via WebSocket
    return Promise.resolve();
  });
  
  // Message receiving setup
  onMessage = vi.fn().mockImplementation((handler: (message: ServerToClientCmd) => void) => {
    this.messageHandlers.set('default', handler);
  });
  
  // Helper methods for testing - simulate receiving messages from server
  simulateWelcome = (overrides: Partial<ServerToClientCmd_Welcome> = {}) => {
    const message = createServerToClientCmd({
      welcome: createWelcomeMessage(overrides),
    });
    this.mockWs.simulateMessage(message);
    // Also call the message handlers directly for testing
    const handler = this.messageHandlers.get('default');
    if (handler) {
      handler(message);
    }
  };
  
  simulateError = (errorMsg: string = 'Test error') => {
    const message = createServerToClientCmd({
      error: createErrorMessage({ msg: errorMsg }),
    });
    this.mockWs.simulateMessage(message);
    // Also call the message handlers directly for testing
    const handler = this.messageHandlers.get('default');
    if (handler) {
      handler(message);
    }
  };
  
  simulateShowPage = (pageItems: PageItem[] = [], pageId?: string, pageTitle?: string) => {
    const message = createServerToClientCmd({
      showPage: createShowPageMessage({ pageItems, pageId, pageTitle }),
    });
    this.mockWs.simulateMessage(message);
    // Also call the message handlers directly for testing
    const handler = this.messageHandlers.get('default');
    if (handler) {
      handler(message);
    }
  };
  
  simulateOpenMediaFile = (mediaFile: MediaFile) => {
    const message = createServerToClientCmd({
      openMediaFile: { mediaFile },
    });
    this.mockWs.simulateMessage(message);
    // Also call the message handlers directly for testing
    const handler = this.messageHandlers.get('default');
    if (handler) {
      handler(message);
    }
  };
  
  simulateAddComments = (comments: Comment[]) => {
    const message = createServerToClientCmd({
      addComments: { comments },
    });
    this.mockWs.simulateMessage(message);
    // Also call the message handlers directly for testing
    const handler = this.messageHandlers.get('default');
    if (handler) {
      handler(message);
    }
  };
  
  simulateShowMessages = (messages: UserMessage[]) => {
    const message = createServerToClientCmd({
      showMessages: { msgs: messages },
    });
    this.mockWs.simulateMessage(message);
    // Also call the message handlers directly for testing
    const handler = this.messageHandlers.get('default');
    if (handler) {
      handler(message);
    }
  };
  
  simulateCollabEvent = (event: Partial<ServerToClientCmd_CollabEvent>) => {
    const message = createServerToClientCmd({
      collabEvent: {
        fromUser: 'test-user',
        paused: false,
        loop: false,
        seekTimeSec: 0,
        drawing: undefined,
        subtitleId: undefined,
        ...event,
      },
    });
    this.mockWs.simulateMessage(message);
    // Also call the message handlers directly for testing
    const handler = this.messageHandlers.get('default');
    if (handler) {
      handler(message);
    }
  };
  
  // Get the underlying mock WebSocket for advanced testing
  getMockWebSocket = () => this.mockWs;
  
  // Reset all mocks
  reset = () => {
    vi.clearAllMocks();
    this.messageHandlers.clear();
    this.mockWs = createMockWebSocket();
  };
}

// Global mock instance
export const mockGrpcClient = new MockGrpcClient();

// Factory function to create fresh mock instances for individual tests
export const createMockGrpcClient = () => new MockGrpcClient();

// Mock the actual gRPC client module
export const mockGrpcModule = {
  createGrpcClient: vi.fn().mockReturnValue(mockGrpcClient),
  MockGrpcClient,
  mockGrpcClient,
};