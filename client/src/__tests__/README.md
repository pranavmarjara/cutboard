# Clapshot Client Testing

This directory contains the test suite for the Clapshot Svelte client, built with Vitest and strongly typed against the generated protobuf definitions.

## Overview

The testing framework provides:
- **Strongly typed tests** using generated protobuf TypeScript definitions
- **Component testing** with Svelte Testing Library
- **Mock gRPC communication** for isolated testing
- **Store testing** with reactive state management
- **Integration tests** for complex workflows

## Test Structure

```
src/__tests__/
├── setup.ts                    # Global test configuration
├── mocks/
│   ├── grpc-client.ts          # Mock gRPC client with protobuf types
│   ├── websocket.ts            # WebSocket connection mocks
│   └── protobuf-factories.ts   # Strongly typed message factories
├── stores/
│   └── stores.test.ts          # Svelte store tests
├── lib/
│   ├── Avatar.test.ts          # Component unit tests
│   └── asset_browser/
│       └── VideoTile.test.ts   # Complex component tests
├── integration/
│   └── grpc-communication.test.ts  # End-to-end flow tests
└── README.md                   # This file
```

## Running Tests

```bash
# Run tests once
npm run test:run

# Run tests in watch mode
npm run test

# Run tests with UI
npm run test:ui

# Run tests with coverage report
npm run test:coverage

# Watch mode (development)
npm run test:watch
```

## Key Features

### Strongly Typed Protobuf Mocks

All tests use strongly typed protobuf messages generated from the `.proto` files:

```typescript
import { createMediaFile, createComment } from '../mocks/protobuf-factories';

const mediaFile = createMediaFile({
  id: 'test-video-1',
  title: 'Test Video',
  duration: { duration: 120, totalFrames: 3000, fps: '25.0' }
});
```

### Mock gRPC Client

The mock gRPC client simulates server communication:

```typescript
import { createMockGrpcClient } from '../mocks/grpc-client';

const grpcClient = createMockGrpcClient();
await grpcClient.connect();

// Simulate server messages
grpcClient.simulateWelcome({ 
  user: { id: 'user-123', name: 'John Doe' },
  isAdmin: true 
});

grpcClient.simulateOpenMediaFile(mediaFile);
```

### Component Testing

Svelte components are tested with realistic props and user interactions:

```typescript
import { render, screen } from '@testing-library/svelte';
import VideoTile from '@/lib/asset_browser/VideoTile.svelte';

const { container } = render(VideoTile, { 
  item: createMediaFile({ title: 'Test Video' })
});

expect(screen.getByText('Test Video')).toBeInTheDocument();
```

### Store Testing

Svelte stores are tested for reactivity and state management:

```typescript
import { get } from 'svelte/store';
import { curVideo, mediaFileId } from '@/stores';

mediaFileId.set('test-id');
curVideo.set(createMediaFile({ id: 'test-id' }));

expect(get(curVideo)?.id).toBe('test-id');
```

## Writing Tests

### 1. Component Tests

For Svelte components, test:
- **Rendering** with various props
- **User interactions** (clicks, form submissions)
- **Store integration** and reactivity
- **Event emission** to parent components

### 2. Store Tests

For Svelte stores, test:
- **Initial state** values
- **State updates** and mutations
- **Reactivity** with subscribers
- **Complex state logic**

### 3. Integration Tests

For complete workflows, test:
- **gRPC message flows**
- **Multi-component interactions**
- **Error handling** and edge cases
- **Real-time collaboration** features

## Mock Factories

### Media Files
```typescript
const video = createMediaFile({
  id: 'video-123',
  title: 'My Video',
  duration: { duration: 180, totalFrames: 4500, fps: '25.0' },
  previewData: {
    thumbUrl: '/thumb.webp',
    thumbSheet: { url: '/sheet.webp', rows: 10, cols: 10 }
  }
});
```

### Comments
```typescript
const comment = createComment({
  id: 'comment-123',
  mediaFileId: 'video-123',
  comment: 'Great video!',
  timecode: '00:01:30.500',
  userId: 'user-123'
});
```

### User Messages
```typescript
const message = createUserMessage({
  type: UserMessage_Type.PROGRESS,
  message: 'Processing video...',
  progress: 0.75
});
```

## Best Practices

### 1. Use Factory Functions
Always use protobuf factories for consistent, strongly-typed test data:

```typescript
// ✅ Good
const mediaFile = createMediaFile({ title: 'Test Video' });

// ❌ Avoid
const mediaFile = { id: 'test', title: 'Test Video' }; // Missing required fields
```

### 2. Test User Workflows
Focus on realistic user scenarios:

```typescript
it('should allow user to add and edit comments', async () => {
  // 1. Open video
  grpcClient.simulateOpenMediaFile(testVideo);
  
  // 2. Add comment
  await grpcClient.sendMessage({
    addComment: { mediaFileId: 'test', comment: 'Test comment' }
  });
  
  // 3. Verify comment appears
  expect(get(allComments)).toHaveLength(1);
});
```

### 3. Mock External Dependencies
Mock browser APIs and external services:

```typescript
// Mock ResizeObserver for components that use it
global.ResizeObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
}));
```

### 4. Clean Up Between Tests
Always reset state between tests:

```typescript
beforeEach(() => {
  // Reset stores
  curVideo.set(null);
  allComments.set([]);
  
  // Reset mocks
  vi.clearAllMocks();
});
```

## Coverage Goals

Target coverage thresholds (configured in `vitest.config.ts`):
- **Branches**: 70%
- **Functions**: 70%
- **Lines**: 70%
- **Statements**: 70%

Focus coverage on:
- **Critical user paths** (video playback, commenting)
- **State management** (stores, reactivity)
- **Error handling** (network failures, invalid data)
- **UI components** (rendering, interactions)

## Debugging Tests

### Visual Test UI
Use the Vitest UI for interactive debugging:
```bash
npm run test:ui
```

### Console Output
Enable detailed logging in test setup:
```typescript
// In setup.ts, remove console mocking for debugging
// global.console = { ...console, log: vi.fn() };
```

### Component Debugging
Use Testing Library's debug utilities:
```typescript
import { render, screen } from '@testing-library/svelte';

const { debug } = render(MyComponent);
debug(); // Prints current DOM state
```

## Contributing

When adding new features:

1. **Write tests first** (TDD approach)
2. **Update protobuf factories** if new message types are added
3. **Add integration tests** for complex features
4. **Maintain coverage** above threshold levels
5. **Document test scenarios** in component comments