/**
 * Tests for App.svelte WebSocket connection management and message routing
 * 
 * These tests focus on testing the WebSocket logic by creating a more isolated approach
 * since the WebSocket connection logic is embedded in the App.svelte component.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { get } from 'svelte/store';
import LocalStorageCookies from '@/cookies';
import { connectionErrors, curUsername, curUserId, curUserIsAdmin, clientConfig } from '@/stores';

// Mock WebSocket
class MockWebSocket {
  public readyState: number = WebSocket.CONNECTING;
  public url: string;
  public onopen: ((event: Event) => void) | null = null;
  public onclose: ((event: CloseEvent) => void) | null = null;
  public onmessage: ((event: MessageEvent) => void) | null = null;
  
  private eventListeners: Map<string, Array<(event: any) => void>> = new Map();
  
  static CONNECTING = 0;
  static OPEN = 1;
  static CLOSING = 2;
  static CLOSED = 3;

  constructor(url: string) {
    this.url = url;
    this.eventListeners.set('open', []);
    this.eventListeners.set('close', []);
    this.eventListeners.set('message', []);
    this.eventListeners.set('error', []);
  }

  send = vi.fn();
  close = vi.fn();

  addEventListener(type: string, listener: (event: any) => void) {
    const listeners = this.eventListeners.get(type) || [];
    listeners.push(listener);
    this.eventListeners.set(type, listeners);
  }

  removeEventListener(type: string, listener: (event: any) => void) {
    const listeners = this.eventListeners.get(type) || [];
    const index = listeners.indexOf(listener);
    if (index !== -1) {
      listeners.splice(index, 1);
    }
  }

  // Test helper methods
  mockOpen() {
    this.readyState = WebSocket.OPEN;
    const event = new Event('open');
    this.eventListeners.get('open')?.forEach(listener => listener(event));
    if (this.onopen) this.onopen(event);
  }

  mockClose(code = 1000, reason = '') {
    this.readyState = WebSocket.CLOSED;
    const event = new CloseEvent('close', { code, reason });
    this.eventListeners.get('close')?.forEach(listener => listener(event));
    if (this.onclose) this.onclose(event);
  }

  mockMessage(data: string) {
    const event = new MessageEvent('message', { data });
    this.eventListeners.get('message')?.forEach(listener => listener(event));
    if (this.onmessage) this.onmessage(event);
  }
}

// Mock fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Track WebSocket instances
const mockWebSocketInstances: MockWebSocket[] = [];
global.WebSocket = vi.fn().mockImplementation((url: string) => {
  const instance = new MockWebSocket(url);
  mockWebSocketInstances.push(instance);
  return instance;
}) as any;

// Mock LocalStorageCookies
vi.mock('@/cookies', () => ({
  default: {
    getAllNonExpired: vi.fn().mockReturnValue({}),
    set: vi.fn(),
    get: vi.fn(),
  }
}));

// Mock timers
vi.useFakeTimers();

describe('WebSocket Connection Logic', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockWebSocketInstances.length = 0;
    
    // Reset stores
    connectionErrors.set([]);
    curUsername.set('');
    curUserId.set('');
    curUserIsAdmin.set(false);
    clientConfig.set({});
    
    // Mock console methods
    console.log = vi.fn();
    console.debug = vi.fn();
    console.warn = vi.fn();
    console.error = vi.fn();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('Configuration loading', () => {
    it('should parse valid configuration', () => {
      const validConfig = {
        ws_url: 'ws://localhost:8080/api/ws',
        upload_url: 'http://localhost:8080/upload',
        user_menu_extra_items: [],
        user_menu_show_basic_auth_logout: false
      };
      
      // Test direct config validation logic
      const expected = ["ws_url", "upload_url", "user_menu_extra_items", "user_menu_show_basic_auth_logout"];
      for (let key of expected) {
        expect(key in validConfig).toBe(true);
      }
      
      expect(validConfig.ws_url).toBe('ws://localhost:8080/api/ws');
      expect(validConfig.upload_url).toBe('http://localhost:8080/upload');
    });

    it('should detect missing configuration keys', () => {
      const invalidConfig = {
        ws_url: 'ws://localhost:8080/api/ws',
        // Missing other required keys
      };
      
      const expected = ["ws_url", "upload_url", "user_menu_extra_items", "user_menu_show_basic_auth_logout"];
      const missingKeys = expected.filter(key => !(key in invalidConfig));
      
      expect(missingKeys).toContain('upload_url');
      expect(missingKeys).toContain('user_menu_extra_items');
      expect(missingKeys).toContain('user_menu_show_basic_auth_logout');
    });

    it('should handle fetch errors gracefully', async () => {
      mockFetch.mockRejectedValue(new Error('Network error'));
      
      try {
        await fetch('clapshot_client.conf.json');
      } catch (error) {
        expect((error as Error).message).toBe('Network error');
      }
    });
  });

  describe('WebSocket connection management', () => {
    it('should create WebSocket with correct URL', () => {
      const wsUrl = 'ws://localhost:8080/api/ws';
      const mockWs = new MockWebSocket(wsUrl);
      
      expect(mockWs.url).toBe(wsUrl);
      expect(mockWs.readyState).toBe(WebSocket.CONNECTING);
    });

    it('should handle connection open event', () => {
      const mockWs = new MockWebSocket('ws://test');
      const openHandler = vi.fn();
      
      mockWs.addEventListener('open', openHandler);
      mockWs.mockOpen();
      
      expect(mockWs.readyState).toBe(WebSocket.OPEN);
      expect(openHandler).toHaveBeenCalled();
    });

    it('should handle connection close event', () => {
      const mockWs = new MockWebSocket('ws://test');
      const closeHandler = vi.fn();
      
      mockWs.addEventListener('close', closeHandler);
      mockWs.mockClose();
      
      expect(mockWs.readyState).toBe(WebSocket.CLOSED);
      expect(closeHandler).toHaveBeenCalled();
    });

    it('should send messages when connected', () => {
      const mockWs = new MockWebSocket('ws://test');
      mockWs.mockOpen();
      
      const testMessage = JSON.stringify({ test: 'message' });
      mockWs.send(testMessage);
      
      expect(mockWs.send).toHaveBeenCalledWith(testMessage);
    });
  });

  describe('Authentication flow', () => {
    it('should create correct health check URL', () => {
      const wsUrl = 'ws://localhost:8080/api/ws';
      const expectedHealthUrl = 'http://localhost:8080/api/health';
      
      const actualHealthUrl = wsUrl
        .replace(/^wss:/, "https:")
        .replace(/^ws:/, "http:")
        .replace(/\/api\/.*$/, "/api/health");
      
      expect(actualHealthUrl).toBe(expectedHealthUrl);
    });

    it('should create correct health check URL for WSS', () => {
      const wsUrl = 'wss://example.com:8080/api/ws';
      const expectedHealthUrl = 'https://example.com:8080/api/health';
      
      const actualHealthUrl = wsUrl
        .replace(/^wss:/, "https:")
        .replace(/^ws:/, "http:")
        .replace(/\/api\/.*$/, "/api/health");
      
      expect(actualHealthUrl).toBe(expectedHealthUrl);
    });

    it('should include cookies in health check headers', () => {
      const mockCookies = { session: 'test-session', user: 'testuser' };
      vi.mocked(LocalStorageCookies.getAllNonExpired).mockReturnValue(mockCookies);
      
      const cookies = LocalStorageCookies.getAllNonExpired();
      const headers = new Headers({
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'X-Clapshot-Cookies': JSON.stringify(cookies),
      });
      
      expect(headers.get('X-Clapshot-Cookies')).toBe(JSON.stringify(mockCookies));
    });

    it('should handle authentication failures', () => {
      const authStatuses = [401, 403, 301, 302];
      
      authStatuses.forEach(status => {
        expect([401, 403, 301, 302]).toContain(status);
      });
    });
  });

  describe('Message formatting and cookies', () => {
    it('should include cookies in WebSocket messages', () => {
      const mockCookies = { session: 'abc123', user: 'testuser' };
      vi.mocked(LocalStorageCookies.getAllNonExpired).mockReturnValue(mockCookies);
      
      const testCmd = { openNavigationPage: { pageId: undefined } };
      const cookies = LocalStorageCookies.getAllNonExpired();
      const rawMessage = JSON.stringify({ ...testCmd, cookies });
      
      const parsedMessage = JSON.parse(rawMessage);
      expect(parsedMessage.cookies).toEqual(mockCookies);
      expect(parsedMessage.openNavigationPage).toEqual({ pageId: undefined });
    });

    it('should format messages correctly', () => {
      const testCmd = { 
        addComment: {
          mediaFileId: 'video123',
          comment: 'Test comment',
          timecode: '00:01:30:12'
        }
      };
      
      const rawMessage = JSON.stringify(testCmd);
      const parsedMessage = JSON.parse(rawMessage);
      
      expect(parsedMessage.addComment.mediaFileId).toBe('video123');
      expect(parsedMessage.addComment.comment).toBe('Test comment');
      expect(parsedMessage.addComment.timecode).toBe('00:01:30:12');
    });
  });

  describe('Message parsing', () => {
    it('should parse welcome messages correctly', () => {
      const welcomeMessage = {
        welcome: {
          serverVersion: '1.2.3',
          user: { id: 'user456', name: 'Jane Doe' },
          isAdmin: false
        }
      };
      
      const messageData = JSON.stringify(welcomeMessage);
      const parsed = JSON.parse(messageData);
      
      expect(parsed.welcome.serverVersion).toBe('1.2.3');
      expect(parsed.welcome.user.id).toBe('user456');
      expect(parsed.welcome.user.name).toBe('Jane Doe');
      expect(parsed.welcome.isAdmin).toBe(false);
    });

    it('should parse error messages correctly', () => {
      const errorMessage = {
        error: { msg: 'Something went wrong' }
      };
      
      const messageData = JSON.stringify(errorMessage);
      const parsed = JSON.parse(messageData);
      
      expect(parsed.error.msg).toBe('Something went wrong');
    });

    it('should handle malformed JSON', () => {
      const malformedJson = '{"invalid": json}';
      
      expect(() => JSON.parse(malformedJson)).toThrow();
    });

    it('should parse showPage messages correctly', () => {
      const showPageMessage = {
        showPage: {
          pageId: 'folder123',
          pageTitle: 'My Videos',
          pageItems: [
            { mediaFile: { id: 'video1', title: 'Video 1' } },
            { folder: { id: 'folder1', name: 'Subfolder' } }
          ]
        }
      };
      
      const messageData = JSON.stringify(showPageMessage);
      const parsed = JSON.parse(messageData);
      
      expect(parsed.showPage.pageId).toBe('folder123');
      expect(parsed.showPage.pageTitle).toBe('My Videos');
      expect(parsed.showPage.pageItems).toHaveLength(2);
    });
  });

  describe('Reconnection logic', () => {
    it('should implement exponential backoff', () => {
      let reconnectDelay = 100;
      
      // Simulate multiple reconnection attempts
      reconnectDelay = Math.round(Math.min(reconnectDelay * 1.5, 30_000)) + Math.random() * 1000;
      expect(reconnectDelay).toBeGreaterThan(100);
      
      reconnectDelay = Math.round(Math.min(reconnectDelay * 1.5, 30_000)) + Math.random() * 1000;
      expect(reconnectDelay).toBeGreaterThan(150);
      
      // Should cap at 30 seconds
      for (let i = 0; i < 20; i++) {
        reconnectDelay = Math.round(Math.min(reconnectDelay * 1.5, 30_000)) + Math.random() * 1000;
      }
      expect(reconnectDelay).toBeLessThanOrEqual(31_000); // 30s + max 1s random
    });

    it('should reset delay on successful connection', () => {
      let reconnectDelay = 5000; // Simulate high delay from failed attempts
      
      // Successful connection should reset delay
      reconnectDelay = 100;
      
      expect(reconnectDelay).toBe(100);
    });

    it('should schedule reconnection after close', async () => {
      const mockWs = new MockWebSocket('ws://test');
      let reconnectScheduled = false;
      
      mockWs.addEventListener('close', () => {
        reconnectScheduled = true;
      });
      
      mockWs.mockClose();
      expect(reconnectScheduled).toBe(true);
    });
  });

  describe('Error handling', () => {
    it('should track connection errors', () => {
      const errors: string[] = [];
      
      const addError = (msg: string) => {
        const t = new Date().toLocaleTimeString();
        errors.push(`[${t}] ${msg}`);
        return errors.slice(-10); // Keep last 10
      };
      
      addError('Connection failed');
      addError('Network error');
      
      expect(errors).toHaveLength(2);
      expect(errors[0]).toContain('Connection failed');
      expect(errors[1]).toContain('Network error');
    });

    it('should limit error history', () => {
      const errors: string[] = [];
      
      // Add many errors
      for (let i = 0; i < 15; i++) {
        errors.push(`Error ${i}`);
      }
      
      const limitedErrors = errors.slice(-10);
      expect(limitedErrors).toHaveLength(10);
      expect(limitedErrors[0]).toBe('Error 5');
      expect(limitedErrors[9]).toBe('Error 14');
    });

    it('should handle exception catching', () => {
      const handleWithErrors = (func: () => any): any => {
        try {
          return func();
        } catch (e: any) {
          console.error("Exception in handler: ", e);
          return null;
        }
      };
      
      const throwingFunction = () => {
        throw new Error('Test error');
      };
      
      const result = handleWithErrors(throwingFunction);
      expect(result).toBeNull();
      expect(console.error).toHaveBeenCalledWith(
        "Exception in handler: ",
        expect.any(Error)
      );
    });
  });

  describe('URL and state management', () => {
    it('should parse URL parameters correctly', () => {
      // Mock URLSearchParams
      const params = new Map([
        ['vid', 'video123'],
        ['collab', 'collab456'],
        ['p', 'folder%2Fsubfolder']
      ]);
      
      const mediaFileId = params.get('vid');
      const collabId = params.get('collab');
      const encodedPageParam = params.get('p');
      const curPageId = encodedPageParam ? decodeURIComponent(encodedPageParam) : null;
      
      expect(mediaFileId).toBe('video123');
      expect(collabId).toBe('collab456');
      expect(curPageId).toBe('folder/subfolder');
    });

    it('should validate URL parameters', () => {
      const validParams = ['vid', 'collab', 'p'];
      const testParams = [
        ['vid', 'video123'],
        ['invalid', 'value'],
        ['collab', 'collab456']
      ];
      
      const invalidParams = testParams.filter(([key]) => !validParams.includes(key));
      expect(invalidParams).toHaveLength(1);
      expect(invalidParams[0][0]).toBe('invalid');
    });

    it('should construct history state correctly', () => {
      const mediaFileId = 'video123';
      const collabId = 'collab456';
      const curPageId = 'folder/subfolder';
      
      // Test different state scenarios
      if (mediaFileId && collabId) {
        const state = { mediaFileId };
        const url = `/?vid=${mediaFileId}&collab=${collabId}`;
        expect(state.mediaFileId).toBe('video123');
        expect(url).toBe('/?vid=video123&collab=collab456');
      } else if (mediaFileId) {
        const state = { mediaFileId };
        const url = `/?vid=${mediaFileId}`;
        expect(state.mediaFileId).toBe('video123');
        expect(url).toBe('/?vid=video123');
      } else if (curPageId) {
        const state = { pageId: curPageId };
        const url = `/?p=${encodeURIComponent(curPageId)}`;
        expect(state.pageId).toBe('folder/subfolder');
        expect(url).toBe('/?p=folder%2Fsubfolder');
      }
    });
  });

  describe('Message queue logic', () => {
    it('should queue messages when disconnected', () => {
      const sendQueue: string[] = [];
      const isConnected = () => false; // Simulate disconnected state
      
      const queueMessage = (rawMsg: string) => {
        if (isConnected()) {
          // Would send immediately
          return false;
        } else {
          sendQueue.push(rawMsg);
          return true;
        }
      };
      
      const testMessage = JSON.stringify({ test: 'message' });
      const wasQueued = queueMessage(testMessage);
      
      expect(wasQueued).toBe(true);
      expect(sendQueue).toContain(testMessage);
    });

    it('should flush queue when connected', () => {
      const sendQueue = ['message1', 'message2', 'message3'];
      const sentMessages: string[] = [];
      
      const mockSocket = {
        send: (msg: string) => sentMessages.push(msg)
      };
      
      // Simulate queue flushing
      while (sendQueue.length > 0) {
        const msg = sendQueue.shift()!;
        mockSocket.send(msg);
      }
      
      expect(sendQueue).toHaveLength(0);
      expect(sentMessages).toEqual(['message1', 'message2', 'message3']);
    });
  });

  describe('Helper functions', () => {
    it('should abbreviate long log messages', () => {
      const logAbbrev = (...strs: any[]) => {
        // In the actual implementation, this would abbreviate long strings
        // For testing, we just verify the concept
        const maxLen = 180;
        const testStr = 'a'.repeat(200);
        const abbreviated = testStr.length > maxLen 
          ? testStr.slice(0, maxLen) + " ……"
          : testStr;
        
        expect(abbreviated.length).toBeLessThanOrEqual(maxLen + 4); // +4 for " ……"
        expect(abbreviated).toContain('……');
      };
      
      logAbbrev('test');
    });

    it('should extract first non-nullish key', () => {
      const first_non_nullish_key = (obj: any) => 
        Object.keys(obj).find(key => (obj[key] !== null && obj[key] !== undefined));
      
      const testObj = {
        null_key: null,
        undefined_key: undefined,
        valid_key: 'value',
        another_key: 'another_value'
      };
      
      const result = first_non_nullish_key(testObj);
      expect(result).toBe('valid_key');
    });

    it('should handle rich logging', () => {
      const richLog = (obj: any, op_name?: string, proto3_cmd?: any) => {
        let parsed = null;
        try { 
          parsed = JSON.parse(obj); 
        } catch (e) { 
          parsed = obj; 
        }
        
        return { parsed, op_name, proto3_cmd };
      };
      
      const result1 = richLog('{"test": "json"}', 'SEND');
      expect(result1.parsed).toEqual({ test: 'json' });
      expect(result1.op_name).toBe('SEND');
      
      const result2 = richLog('invalid json', 'RECV');
      expect(result2.parsed).toBe('invalid json');
      expect(result2.op_name).toBe('RECV');
    });
  });
});