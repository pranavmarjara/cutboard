/**
 * WebSocket mocks for testing real-time communication
 */
import { vi } from 'vitest';

export interface MockWebSocketOptions {
  autoConnect?: boolean;
  url?: string;
  protocols?: string | string[];
}

export class MockWebSocket implements WebSocket {
  static CONNECTING = WebSocket.CONNECTING;
  static OPEN = WebSocket.OPEN;
  static CLOSING = WebSocket.CLOSING;
  static CLOSED = WebSocket.CLOSED;

  readonly CONNECTING = WebSocket.CONNECTING;
  readonly OPEN = WebSocket.OPEN;
  readonly CLOSING = WebSocket.CLOSING;
  readonly CLOSED = WebSocket.CLOSED;

  url: string = '';
  protocol: string = '';
  readyState: number = WebSocket.CONNECTING;
  bufferedAmount: number = 0;
  extensions: string = '';
  binaryType: BinaryType = 'blob';

  // Event handlers
  onopen: ((event: Event) => void) | null = null;
  onclose: ((event: CloseEvent) => void) | null = null;
  onmessage: ((event: MessageEvent) => void) | null = null;
  onerror: ((event: Event) => void) | null = null;

  // Mock-specific properties
  private eventListeners: Map<string, ((event: Event) => void)[]> = new Map();
  private sentMessages: any[] = [];

  constructor(url: string, protocols?: string | string[]) {
    this.url = url;
    
    // Simulate async connection
    setTimeout(() => {
      this.readyState = WebSocket.OPEN;
      this.dispatchEvent(new Event('open'));
    }, 0);
  }

  // WebSocket methods
  send = vi.fn().mockImplementation((data: string | ArrayBufferLike | Blob | ArrayBufferView) => {
    if (this.readyState !== WebSocket.OPEN) {
      throw new Error('WebSocket is not open');
    }
    
    this.sentMessages.push(data);
  });

  close = vi.fn().mockImplementation((code?: number, reason?: string) => {
    this.readyState = WebSocket.CLOSING;
    setTimeout(() => {
      this.readyState = WebSocket.CLOSED;
      const closeEvent = new CloseEvent('close', {
        code: code || 1000,
        reason: reason || '',
        wasClean: true,
      });
      this.dispatchEvent(closeEvent);
    }, 0);
  });

  addEventListener = vi.fn().mockImplementation((type: string, listener: (event: Event) => void) => {
    if (!this.eventListeners.has(type)) {
      this.eventListeners.set(type, []);
    }
    this.eventListeners.get(type)!.push(listener);
  });

  removeEventListener = vi.fn().mockImplementation((type: string, listener: (event: Event) => void) => {
    const listeners = this.eventListeners.get(type);
    if (listeners) {
      const index = listeners.indexOf(listener);
      if (index !== -1) {
        listeners.splice(index, 1);
      }
    }
  });

  dispatchEvent = vi.fn().mockImplementation((event: Event) => {
    // Call the direct event handler
    if (event.type === 'open' && this.onopen) {
      this.onopen(event);
    } else if (event.type === 'close' && this.onclose) {
      this.onclose(event as CloseEvent);
    } else if (event.type === 'message' && this.onmessage) {
      this.onmessage(event as MessageEvent);
    } else if (event.type === 'error' && this.onerror) {
      this.onerror(event);
    }

    // Call event listeners
    const listeners = this.eventListeners.get(event.type);
    if (listeners) {
      listeners.forEach(listener => listener(event));
    }

    return true;
  });

  // Mock-specific helper methods
  simulateMessage(data: any) {
    if (this.readyState !== WebSocket.OPEN) {
      console.warn('Attempting to simulate message on non-open WebSocket');
      return;
    }

    const messageEvent = new MessageEvent('message', {
      data: typeof data === 'string' ? data : JSON.stringify(data),
    });
    this.dispatchEvent(messageEvent);
  }

  simulateError() {
    const errorEvent = new Event('error');
    this.dispatchEvent(errorEvent);
  }

  simulateClose(code: number = 1000, reason: string = 'Normal closure') {
    this.readyState = WebSocket.CLOSING;
    setTimeout(() => {
      this.readyState = WebSocket.CLOSED;
      const closeEvent = new CloseEvent('close', {
        code,
        reason,
        wasClean: code === 1000,
      });
      this.dispatchEvent(closeEvent);
    }, 0);
  }

  // Test utilities
  getSentMessages() {
    return [...this.sentMessages];
  }

  getLastSentMessage() {
    return this.sentMessages[this.sentMessages.length - 1];
  }

  clearSentMessages() {
    this.sentMessages = [];
  }

  reset() {
    this.sentMessages = [];
    this.eventListeners.clear();
    this.readyState = WebSocket.CONNECTING;
    this.onopen = null;
    this.onclose = null;
    this.onmessage = null;
    this.onerror = null;
    vi.clearAllMocks();
  }
}

// Global WebSocket mock
let mockWebSocketInstance: MockWebSocket | null = null;

export const createMockWebSocket = (url: string, protocols?: string | string[]) => {
  mockWebSocketInstance = new MockWebSocket(url, protocols);
  return mockWebSocketInstance;
};

export const getMockWebSocketInstance = () => mockWebSocketInstance;

// Setup global WebSocket mock
export const setupWebSocketMock = () => {
  // @ts-ignore
  global.WebSocket = vi.fn().mockImplementation((url: string, protocols?: string | string[]) => {
    return createMockWebSocket(url, protocols);
  });
  
  // Mock WebSocket constants
  Object.assign(global.WebSocket, {
    CONNECTING: WebSocket.CONNECTING,
    OPEN: WebSocket.OPEN,
    CLOSING: WebSocket.CLOSING,
    CLOSED: WebSocket.CLOSED,
  });
};

// Cleanup WebSocket mock
export const cleanupWebSocketMock = () => {
  if (mockWebSocketInstance) {
    mockWebSocketInstance.reset();
    mockWebSocketInstance = null;
  }
  vi.restoreAllMocks();
};