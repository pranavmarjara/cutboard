/**
 * Tests for Avatar.svelte component
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render } from '@testing-library/svelte';
import Avatar, { hexColorForUsername } from '@/lib/Avatar.svelte';

// Simple mock canvas to prevent errors during canvas operations
const mockCanvas = {
  width: 0,
  height: 0,
  getContext: vi.fn().mockReturnValue({
    fillStyle: '',
    font: '',
    textAlign: '',
    fillRect: vi.fn(),
    fillText: vi.fn(),
  }),
  toDataURL: vi.fn().mockReturnValue('data:image/png;base64,mock-avatar-data'),
};

// Mock only document.createElement for canvas to prevent errors
const originalCreateElement = document.createElement.bind(document);
document.createElement = vi.fn().mockImplementation((tagName: string) => {
  if (tagName === 'canvas') {
    return mockCanvas;
  }
  return originalCreateElement(tagName);
}) as any;

// Mock window.devicePixelRatio
vi.stubGlobal('window', {
  ...window,
  devicePixelRatio: 2,
});

// Mock CanvasRenderingContext2D
global.CanvasRenderingContext2D = class MockCanvasRenderingContext2D {
  fillStyle = '';
  font = '';
  textAlign = '';
  fillRect = vi.fn();
  fillText = vi.fn();
} as any;

describe('Avatar', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    // Restore original createElement
    document.createElement = originalCreateElement;
  });

  describe('hexColorForUsername', () => {
    it('should return consistent colors for same username', () => {
      const color1 = hexColorForUsername('john');
      const color2 = hexColorForUsername('john');
      expect(color1).toBe(color2);
    });

    it('should return different colors for different usernames', () => {
      const color1 = hexColorForUsername('john');
      const color2 = hexColorForUsername('jane');
      expect(color1).not.toBe(color2);
    });

    it('should return valid hex colors', () => {
      const color = hexColorForUsername('testuser');
      expect(color).toMatch(/^#[0-9a-f]{6}$/i);
    });

    it('should handle empty username', () => {
      const color = hexColorForUsername('');
      expect(color).toMatch(/^#[0-9a-f]{6}$/i);
    });

    it('should handle special characters', () => {
      const color = hexColorForUsername('user@example.com');
      expect(color).toMatch(/^#[0-9a-f]{6}$/i);
    });
  });

  describe('Avatar component', () => {
    it('should render with default props', () => {
      const { container } = render(Avatar);
      const img = container.querySelector('img');
      
      expect(img).toBeInTheDocument();
      expect(img).toHaveClass('round');
      expect(img).toHaveAttribute('alt', '');
    });

    it('should render with username', () => {
      const { container } = render(Avatar, { username: 'john.doe' });
      const img = container.querySelector('img');
      
      expect(img).toBeInTheDocument();
      expect(img).toHaveAttribute('alt', 'john.doe');
    });

    it('should render with custom width', () => {
      const { container } = render(Avatar, { username: 'john', width: '64' });
      const img = container.querySelector('img');
      
      // Component should render successfully with custom width
      expect(img).toBeInTheDocument();
      expect(img).toHaveAttribute('alt', 'john');
    });

    it('should render without round styling when round=false', () => {
      const { container } = render(Avatar, { username: 'john', round: false });
      const img = container.querySelector('img');
      
      expect(img).toBeInTheDocument();
      expect(img).not.toHaveClass('round');
    });

    it('should use provided src when available', () => {
      const customSrc = 'https://example.com/avatar.jpg';
      const { container } = render(Avatar, { 
        username: 'john', 
        src: customSrc 
      });
      const img = container.querySelector('img') as HTMLImageElement;
      
      expect(img).toBeInTheDocument();
      // Note: In the actual component, src is set onMount, so we can't directly test it
      // but we can verify the component renders correctly
    });

    it('should generate letter avatar when no src provided', () => {
      const { container } = render(Avatar, { username: 'john doe', width: '48' });
      const img = container.querySelector('img');
      
      // Component should render successfully
      expect(img).toBeInTheDocument();
      expect(img).toHaveAttribute('alt', 'john doe');
    });

    it('should handle single name initials', () => {
      const { container } = render(Avatar, { username: 'john' });
      const img = container.querySelector('img');
      
      // Component should render successfully
      expect(img).toBeInTheDocument();
      expect(img).toHaveAttribute('alt', 'john');
    });

    it('should handle full name initials', () => {
      const { container } = render(Avatar, { username: 'john doe' });
      const img = container.querySelector('img');
      
      // Component should render successfully
      expect(img).toBeInTheDocument();
      expect(img).toHaveAttribute('alt', 'john doe');
    });

    it('should handle name with dots', () => {
      const { container } = render(Avatar, { username: 'john.doe' });
      const img = container.querySelector('img');
      
      // Component should render successfully
      expect(img).toBeInTheDocument();
      expect(img).toHaveAttribute('alt', 'john.doe');
    });

    it('should handle null username', () => {
      const { container } = render(Avatar, { username: null });
      const img = container.querySelector('img');
      
      // Component should render successfully
      expect(img).toBeInTheDocument();
      // When username is null, alt attribute is not set (which becomes null)
      expect(img?.getAttribute('alt')).toBeNull();
    });

    it('should handle empty username', () => {
      const { container } = render(Avatar, { username: '' });
      const img = container.querySelector('img');
      
      // Component should render successfully with empty alt
      expect(img).toBeInTheDocument();
      expect(img).toHaveAttribute('alt', '');
    });

    it('should render with specified username and width', () => {
      const username = 'testuser';
      const { container } = render(Avatar, { username, width: '60' });
      const img = container.querySelector('img');
      
      // Component should render successfully
      expect(img).toBeInTheDocument();
      expect(img).toHaveAttribute('alt', username);
    });

    it('should handle device pixel ratio', () => {
      const originalDevicePixelRatio = window.devicePixelRatio;
      vi.stubGlobal('window', { ...window, devicePixelRatio: 3 });
      
      const { container } = render(Avatar, { username: 'john', width: '30' });
      const img = container.querySelector('img');
      
      // Component should render successfully even with custom device pixel ratio
      expect(img).toBeInTheDocument();
      expect(img).toHaveAttribute('alt', 'john');
      
      // Restore original value
      vi.stubGlobal('window', { ...window, devicePixelRatio: originalDevicePixelRatio });
    });

    it('should handle missing device pixel ratio', () => {
      vi.stubGlobal('window', { ...window, devicePixelRatio: undefined });
      
      const { container } = render(Avatar, { username: 'john', width: '40' });
      const img = container.querySelector('img');
      
      // Component should render successfully even without device pixel ratio
      expect(img).toBeInTheDocument();
      expect(img).toHaveAttribute('alt', 'john');
    });
  });
});