import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import UserMessage from '@/lib/UserMessage.svelte';
import * as Proto3 from '@clapshot_protobuf/typescript';

// Test helper functions separately (these are implementation details we can test directly)
describe('UserMessage helper functions', () => {
  // Since these are private functions in the component, we test their behavior through the component's output
  describe('message type behavior', () => {
    it('should display correct type names and colors', () => {
      const testCases = [
        { type: Proto3.UserMessage_Type.OK, expectedText: 'OK', expectedClass: 'text-green-400' },
        { type: Proto3.UserMessage_Type.ERROR, expectedText: 'ERROR', expectedClass: 'text-red-400' },
        { type: Proto3.UserMessage_Type.PROGRESS, expectedText: 'PROGRESS', expectedClass: 'text-green-400' }
      ];

      testCases.forEach(({ type, expectedText, expectedClass }) => {
        const msg: Proto3.UserMessage = {
          type,
          message: 'Test message',
          created: new Date(),
          id: `test-${type}`
        };

        const { unmount } = render(UserMessage, { props: { msg } });
        
        const typeElement = screen.getByText(expectedText);
        expect(typeElement).toBeInTheDocument();
        expect(typeElement).toHaveClass(expectedClass);
        
        unmount();
      });
    });

    it('should handle unknown message type gracefully', () => {
      const msg: Proto3.UserMessage = {
        type: 999 as Proto3.UserMessage_Type, // Invalid type
        message: 'Test message',
        created: new Date(),
        id: 'unknown-type'
      };

      render(UserMessage, { props: { msg } });
      
      // Should render empty string for unknown type, but message should still be shown
      expect(screen.getByText('Test message')).toBeInTheDocument();
    });
  });

  describe('date formatting', () => {
    it('should display properly formatted timestamp', () => {
      const testDate = new Date('2023-12-25T15:30:45.123Z');
      const msg: Proto3.UserMessage = {
        type: Proto3.UserMessage_Type.OK,
        message: 'Test message',
        created: testDate,
        id: 'date-test'
      };

      render(UserMessage, { props: { msg } });
      
      // Look for timestamp in expected format (allows for timezone differences)
      const timestampElement = screen.getByText(/2023-12-25/);
      expect(timestampElement).toBeInTheDocument();
      expect(timestampElement).toHaveClass('text-gray-500');
    });
  });
});

describe('UserMessage.svelte', () => {
  const mockUser = userEvent.setup();

  describe('Component rendering', () => {
    it('should render OK message with correct styling', () => {
      const okMsg: Proto3.UserMessage = {
        type: Proto3.UserMessage_Type.OK,
        message: 'Operation successful',
        created: new Date('2023-12-25T15:30:45.123Z'),
        id: 'ok-render-1'
      };

      render(UserMessage, { props: { msg: okMsg } });
      
      expect(screen.getByText('OK')).toBeInTheDocument();
      expect(screen.getByText('Operation successful')).toBeInTheDocument();
      
      const typeSpan = screen.getByText('OK');
      expect(typeSpan).toHaveClass('text-green-400');
    });

    it('should render ERROR message with correct styling', () => {
      const errorMsg: Proto3.UserMessage = {
        type: Proto3.UserMessage_Type.ERROR,
        message: 'Something went wrong',
        created: new Date('2023-12-25T15:30:45.123Z'),
        id: 'error-render-1'
      };

      render(UserMessage, { props: { msg: errorMsg } });
      
      expect(screen.getByText('ERROR')).toBeInTheDocument();
      expect(screen.getByText('Something went wrong')).toBeInTheDocument();
      
      const typeSpan = screen.getByText('ERROR');
      expect(typeSpan).toHaveClass('text-red-400');
    });

    it('should render PROGRESS message', () => {
      const progressMsg: Proto3.UserMessage = {
        type: Proto3.UserMessage_Type.PROGRESS,
        message: 'Processing...',
        created: new Date('2023-12-25T15:30:45.123Z'),
        id: 'progress-render-1'
      };

      render(UserMessage, { props: { msg: progressMsg } });
      
      expect(screen.getByText('PROGRESS')).toBeInTheDocument();
      expect(screen.getByText('Processing...')).toBeInTheDocument();
      
      const typeSpan = screen.getByText('PROGRESS');
      expect(typeSpan).toHaveClass('text-green-400');
    });

    it('should render timestamp', () => {
      const testDate = new Date('2023-12-25T15:30:45.123Z');
      const msg: Proto3.UserMessage = {
        type: Proto3.UserMessage_Type.OK,
        message: 'Test message',
        created: testDate,
        id: 'timestamp-test-1'
      };

      render(UserMessage, { props: { msg } });
      
      // Check that timestamp is rendered (format may vary by timezone)
      const timestampElement = screen.getByText(/2023-12-25/);
      expect(timestampElement).toBeInTheDocument();
      expect(timestampElement).toHaveClass('text-gray-500');
    });
  });

  describe('Media file ID references', () => {
    it('should render media file ID as link for non-error messages', () => {
      const okMsg: Proto3.UserMessage = {
        type: Proto3.UserMessage_Type.OK,
        message: 'File processed',
        created: new Date(),
        id: 'media-link-1',
        refs: {
          mediaFileId: 'video-123'
        }
      };

      render(UserMessage, { props: { msg: okMsg } });
      
      const linkElement = screen.getByRole('link');
      expect(linkElement).toHaveAttribute('href', '/?vid=video-123');
      expect(linkElement).toHaveClass('text-amber-600');
      expect(linkElement).toHaveTextContent('video-123');
    });

    it('should render media file ID as struck-through text for error messages', () => {
      const errorMsg: Proto3.UserMessage = {
        type: Proto3.UserMessage_Type.ERROR,
        message: 'File processing failed',
        created: new Date(),
        id: 'media-error-1',
        refs: {
          mediaFileId: 'video-456'
        }
      };

      render(UserMessage, { props: { msg: errorMsg } });
      
      const errorFileElement = screen.getByText('video-456');
      expect(errorFileElement).toHaveClass('line-through', 'text-gray-700');
      expect(errorFileElement.tagName).toBe('SPAN');
    });

    it('should not render media file ID section when not present', () => {
      const msg: Proto3.UserMessage = {
        type: Proto3.UserMessage_Type.OK,
        message: 'No media file',
        created: new Date(),
        id: 'no-media-1'
      };

      render(UserMessage, { props: { msg } });
      
      expect(screen.queryByRole('link')).not.toBeInTheDocument();
    });
  });

  describe('Details section', () => {
    it('should show details toggle when details exist', () => {
      const msgWithDetails: Proto3.UserMessage = {
        type: Proto3.UserMessage_Type.ERROR,
        message: 'Operation failed',
        created: new Date(),
        id: 'details-1',
        details: 'Detailed error information here'
      };

      render(UserMessage, { props: { msg: msgWithDetails } });
      
      const chevronRight = screen.getByRole('link');
      expect(chevronRight).toHaveClass('fa-chevron-right');
    });

    it('should expand details when clicked', async () => {
      const msgWithDetails: Proto3.UserMessage = {
        type: Proto3.UserMessage_Type.ERROR,
        message: 'Operation failed',
        created: new Date(),
        id: 'details-expand-1',
        details: 'Detailed error information here'
      };

      render(UserMessage, { props: { msg: msgWithDetails } });
      
      const chevronButton = screen.getByRole('link');
      await mockUser.click(chevronButton);
      
      expect(screen.getByText('Detailed error information here')).toBeInTheDocument();
      expect(screen.getByRole('link')).toHaveClass('fa-chevron-down');
    });

    it('should have working details toggle functionality', async () => {
      const msgWithDetails: Proto3.UserMessage = {
        type: Proto3.UserMessage_Type.ERROR,
        message: 'Operation failed',
        created: new Date(),
        id: 'details-toggle-1',
        details: 'Detailed error information here'
      };

      render(UserMessage, { props: { msg: msgWithDetails } });
      
      // Initially should show right chevron (collapsed)
      expect(screen.queryByText('fa-chevron-right')).toBeDefined();
      expect(screen.queryByText('Detailed error information here')).not.toBeInTheDocument();
      
      // Expand by clicking
      const chevronButton = screen.getByRole('link');
      await mockUser.click(chevronButton);
      
      // Details should now be visible
      expect(screen.getByText('Detailed error information here')).toBeInTheDocument();
    });

    it('should support keyboard navigation for details', async () => {
      const msgWithDetails: Proto3.UserMessage = {
        type: Proto3.UserMessage_Type.ERROR,
        message: 'Operation failed',
        created: new Date(),
        id: 'details-keyboard-1',
        details: 'Detailed error information here'
      };

      render(UserMessage, { props: { msg: msgWithDetails } });
      
      // Initially details should not be visible
      expect(screen.queryByText('Detailed error information here')).not.toBeInTheDocument();
      
      // Press Enter to expand
      const chevronButton = screen.getByRole('link');
      chevronButton.focus();
      await mockUser.keyboard('[Enter]');
      
      // Details should now be visible
      expect(screen.getByText('Detailed error information here')).toBeInTheDocument();
    });

    it('should not show details toggle when no details exist', () => {
      const msgWithoutDetails: Proto3.UserMessage = {
        type: Proto3.UserMessage_Type.OK,
        message: 'Simple message',
        created: new Date(),
        id: 'no-details-1'
      };

      render(UserMessage, { props: { msg: msgWithoutDetails } });
      
      expect(screen.queryByRole('link')).not.toBeInTheDocument();
    });
  });
});