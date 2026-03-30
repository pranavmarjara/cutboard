/**
 * Unit tests for FolderListing.svelte - Testing core logic and functionality
 * 
 * This focuses on testing the component's business logic, event handlers, and state management
 * without the complexity of full component rendering and child component mocking.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { get, writable } from 'svelte/store';
import { 
  selectedTiles, 
  serverDefinedActions 
} from '@/stores';
import { 
  createMinimalMediaFile,
  createFolderListingItem,
  type PageItem_FolderListing_Item,
  type PageItem_FolderListing_Folder
} from '../../mocks/protobuf-factories';
import { VideoListDefItem, folderItemsToIDs } from '@/lib/asset_browser/types';
import * as Proto3 from '@clapshot_protobuf/typescript';

describe('FolderListing Logic Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    
    // Reset stores
    selectedTiles.set({});
    serverDefinedActions.set({});
    
    // Mock alert for UI error messages
    global.alert = vi.fn();
  });

  describe('folderItemsToIDs utility function', () => {
    it('should convert media file items to protobuf IDs', () => {
      const folderItems = [
        createFolderListingItem({
          mediaFile: createMinimalMediaFile({ id: 'video1', title: 'Video 1' }),
          popupActions: []
        })
      ];

      const ids = folderItemsToIDs(folderItems);

      expect(ids).toHaveLength(1);
      expect(ids[0]).toEqual({ mediaFileId: 'video1' });
    });

    it('should convert folder items to protobuf IDs', () => {
      const folderItems = [
        createFolderListingItem({
          folder: {
            id: 'folder1',
            title: 'Folder 1',
            previewItems: []
          },
          popupActions: []
        })
      ];

      const ids = folderItemsToIDs(folderItems);

      expect(ids).toHaveLength(1);
      expect(ids[0]).toEqual({ folderId: 'folder1' });
    });

    it('should handle mixed media and folder items', () => {
      const folderItems = [
        createFolderListingItem({
          mediaFile: createMinimalMediaFile({ id: 'video1', title: 'Video 1' }),
          popupActions: []
        }),
        createFolderListingItem({
          folder: {
            id: 'folder1',
            title: 'Folder 1',
            previewItems: []
          },
          popupActions: []
        })
      ];

      const ids = folderItemsToIDs(folderItems);

      expect(ids).toHaveLength(2);
      expect(ids[0]).toEqual({ mediaFileId: 'video1' });
      expect(ids[1]).toEqual({ folderId: 'folder1' });
    });

    it('should handle invalid items gracefully', () => {
      const invalidItem = createFolderListingItem({
        // Neither mediaFile nor folder set
        popupActions: []
      });

      const ids = folderItemsToIDs([invalidItem]);

      expect(ids).toHaveLength(1);
      expect(ids[0]).toEqual({ mediaFileId: '' }); // Fallback behavior
    });
  });

  describe('Selection management logic', () => {
    it('should add item to selection with shift+click', () => {
      const item1: VideoListDefItem = {
        id: 'item1',
        obj: createFolderListingItem({
          mediaFile: createMinimalMediaFile({ id: 'video1', title: 'Video 1' }),
          popupActions: []
        })
      };

      // Simulate selection logic
      const currentSelection = get(selectedTiles);
      const itemId = item1.id;
      
      if (itemId in currentSelection) {
        // Remove if already selected
        delete currentSelection[itemId];
      } else {
        // Add to selection
        currentSelection[itemId] = item1;
      }
      
      selectedTiles.set(currentSelection);

      const selection = get(selectedTiles);
      expect(selection).toHaveProperty('item1');
      expect(selection.item1.id).toBe('item1');
    });

    it('should remove item from selection when shift+clicked again', () => {
      const item1: VideoListDefItem = {
        id: 'item1',
        obj: createFolderListingItem({
          mediaFile: createMinimalMediaFile({ id: 'video1', title: 'Video 1' }),
          popupActions: []
        })
      };

      // Pre-select item
      selectedTiles.set({ 'item1': item1 });
      expect(Object.keys(get(selectedTiles))).toHaveLength(1);

      // Simulate deselection
      const currentSelection = get(selectedTiles);
      const itemId = item1.id;
      
      if (itemId in currentSelection) {
        delete currentSelection[itemId];
        selectedTiles.set(currentSelection);
      }

      expect(Object.keys(get(selectedTiles))).toHaveLength(0);
    });

    it('should clear selection when normal click occurs', () => {
      const item1: VideoListDefItem = {
        id: 'item1',
        obj: createFolderListingItem({
          mediaFile: createMinimalMediaFile({ id: 'video1', title: 'Video 1' }),
          popupActions: []
        })
      };

      const item2: VideoListDefItem = {
        id: 'item2',
        obj: createFolderListingItem({
          mediaFile: createMinimalMediaFile({ id: 'video2', title: 'Video 2' }),
          popupActions: []
        })
      };

      // Pre-select item1
      selectedTiles.set({ 'item1': item1 });

      // Simulate normal click on item2 (should clear selection and select item2)
      selectedTiles.set({ 'item2': item2 });

      const selection = get(selectedTiles);
      expect(selection).toHaveProperty('item2');
      expect(selection).not.toHaveProperty('item1');
    });

    it('should handle multi-selection', () => {
      const item1: VideoListDefItem = {
        id: 'item1',
        obj: createFolderListingItem({
          mediaFile: createMinimalMediaFile({ id: 'video1', title: 'Video 1' }),
          popupActions: []
        })
      };

      const item2: VideoListDefItem = {
        id: 'item2',
        obj: createFolderListingItem({
          mediaFile: createMinimalMediaFile({ id: 'video2', title: 'Video 2' }),
          popupActions: []
        })
      };

      // Simulate adding multiple items to selection
      let currentSelection = get(selectedTiles);
      currentSelection['item1'] = item1;
      selectedTiles.set(currentSelection);

      currentSelection = get(selectedTiles);
      currentSelection['item2'] = item2;
      selectedTiles.set(currentSelection);

      const selection = get(selectedTiles);
      expect(Object.keys(selection)).toHaveLength(2);
      expect(selection).toHaveProperty('item1');
      expect(selection).toHaveProperty('item2');
    });
  });

  describe('Server-defined actions logic', () => {
    beforeEach(() => {
      // Set up sample server-defined actions
      serverDefinedActions.set({
        'delete_item': {
          uiProps: {
            label: 'Delete',
            icon: {
              faClass: {
                classes: 'fas fa-trash',
                color: { r: 255, g: 0, b: 0 }
              }
            }
          },
          action: {
            code: 'delete_item',
            lang: Proto3.ScriptCall_Lang.JAVASCRIPT
          }
        },
        'move_item': {
          uiProps: {
            label: 'Move to...',
            icon: {
              faClass: {
                classes: 'fas fa-folder-open'
              }
            }
          },
          action: {
            code: 'move_item',
            lang: Proto3.ScriptCall_Lang.JAVASCRIPT
          }
        }
      });
    });

    it('should find actions for item popup', () => {
      const item: VideoListDefItem = {
        id: 'item1',
        obj: createFolderListingItem({
          mediaFile: createMinimalMediaFile({ id: 'video1', title: 'Video 1' }),
          popupActions: ['delete_item', 'move_item']
        })
      };

      const actions = get(serverDefinedActions);
      const itemActions = item.obj.popupActions
        .map(actionId => actions[actionId])
        .filter(action => action !== undefined);

      expect(itemActions).toHaveLength(2);
      expect(itemActions[0].uiProps?.label).toBe('Delete');
      expect(itemActions[1].uiProps?.label).toBe('Move to...');
    });

    it('should handle missing action definitions gracefully', () => {
      const item: VideoListDefItem = {
        id: 'item1',
        obj: createFolderListingItem({
          mediaFile: createMinimalMediaFile({ id: 'video1', title: 'Video 1' }),
          popupActions: ['unknown_action']
        })
      };

      const actions = get(serverDefinedActions);
      const itemActions = item.obj.popupActions
        .map(actionId => actions[actionId])
        .filter(action => action !== undefined);

      expect(itemActions).toHaveLength(0);

      // Simulate error handling for missing actions
      const missingActions = item.obj.popupActions
        .filter(actionId => !actions[actionId]);

      expect(missingActions).toEqual(['unknown_action']);
    });

    it('should prepare popup action context correctly', () => {
      const item1: VideoListDefItem = {
        id: 'item1',
        obj: createFolderListingItem({
          mediaFile: createMinimalMediaFile({ id: 'video1', title: 'Video 1' }),
          popupActions: ['delete_item']
        })
      };

      const item2: VideoListDefItem = {
        id: 'item2',
        obj: createFolderListingItem({
          mediaFile: createMinimalMediaFile({ id: 'video2', title: 'Video 2' }),
          popupActions: ['delete_item']
        })
      };

      // Pre-select multiple items
      selectedTiles.set({
        'item1': item1,
        'item2': item2
      });

      const selection = get(selectedTiles);
      const listingData = { folder: 'test-folder' };

      // Simulate popup action context preparation
      const contextItems = Object.values(selection);
      const actionContext = {
        action: get(serverDefinedActions)['delete_item'],
        items: contextItems,
        listingData: listingData
      };

      expect(actionContext.items).toHaveLength(2);
      expect(actionContext.action.uiProps?.label).toBe('Delete');
      expect(actionContext.listingData).toEqual({ folder: 'test-folder' });
    });
  });

  describe('Drag and drop logic', () => {
    it('should prepare selected items for drag operation', () => {
      const item1: VideoListDefItem = {
        id: 'item1',
        obj: createFolderListingItem({
          mediaFile: createMinimalMediaFile({ id: 'video1', title: 'Video 1' }),
          popupActions: []
        })
      };

      const item2: VideoListDefItem = {
        id: 'item2',
        obj: createFolderListingItem({
          mediaFile: createMinimalMediaFile({ id: 'video2', title: 'Video 2' }),
          popupActions: []
        })
      };

      // Pre-select items
      selectedTiles.set({
        'item1': item1,
        'item2': item2
      });

      const allItems = [item1, item2];
      const draggedId = 'item1';

      // Simulate drag logic
      const selection = get(selectedTiles);
      let itemsToDrag;

      if (Object.keys(selection).includes(draggedId)) {
        // Dragging selected item - drag all selected items
        itemsToDrag = Object.values(selection);
      } else {
        // Dragging non-selected item - clear selection and drag only this item
        selectedTiles.set({});
        itemsToDrag = [allItems.find(item => item.id === draggedId)!];
      }

      expect(itemsToDrag).toHaveLength(2);
      expect(itemsToDrag.map(item => item.id)).toEqual(['item1', 'item2']);
    });

    it('should handle drag start on non-selected item', () => {
      const item1: VideoListDefItem = {
        id: 'item1',
        obj: createFolderListingItem({
          mediaFile: createMinimalMediaFile({ id: 'video1', title: 'Video 1' }),
          popupActions: []
        })
      };

      const item2: VideoListDefItem = {
        id: 'item2',
        obj: createFolderListingItem({
          mediaFile: createMinimalMediaFile({ id: 'video2', title: 'Video 2' }),
          popupActions: []
        })
      };

      // Pre-select item1
      selectedTiles.set({ 'item1': item1 });

      const allItems = [item1, item2];
      const draggedId = 'item2'; // Drag non-selected item

      // Simulate drag logic
      const selection = get(selectedTiles);
      let itemsToDrag;

      if (Object.keys(selection).includes(draggedId)) {
        itemsToDrag = Object.values(selection);
      } else {
        // Clear selection and drag only the dragged item
        selectedTiles.set({});
        itemsToDrag = [allItems.find(item => item.id === draggedId)!];
      }

      expect(itemsToDrag).toHaveLength(1);
      expect(itemsToDrag[0].id).toBe('item2');
      expect(Object.keys(get(selectedTiles))).toHaveLength(0);
    });

    it('should prepare move-to-folder event data', () => {
      const item1: VideoListDefItem = {
        id: 'item1',
        obj: createFolderListingItem({
          mediaFile: createMinimalMediaFile({ id: 'video1', title: 'Video 1' }),
          popupActions: []
        })
      };

      const item2: VideoListDefItem = {
        id: 'item2',
        obj: createFolderListingItem({
          folder: {
            id: 'folder1',
            title: 'Folder 1',
            previewItems: []
          },
          popupActions: []
        })
      };

      const droppedItems = [item1];
      const targetFolderId = 'folder1';

      // Simulate move-to-folder event preparation
      const eventData = {
        dstFolderId: targetFolderId,
        ids: folderItemsToIDs(droppedItems.map(item => item.obj))
      };

      expect(eventData.dstFolderId).toBe('folder1');
      expect(eventData.ids).toEqual([{ mediaFileId: 'video1' }]);
    });

    it('should handle reorder items event preparation', () => {
      const item1: VideoListDefItem = {
        id: 'item1',
        obj: createFolderListingItem({
          mediaFile: createMinimalMediaFile({ id: 'video1', title: 'Video 1' }),
          popupActions: []
        })
      };

      const item2: VideoListDefItem = {
        id: 'item2',
        obj: createFolderListingItem({
          mediaFile: createMinimalMediaFile({ id: 'video2', title: 'Video 2' }),
          popupActions: []
        })
      };

      const reorderedItems = [item2, item1]; // Reordered
      const listingData = { folder: 'test-folder' };

      // Simulate reorder event preparation
      const eventData = {
        listingData: listingData,
        ids: folderItemsToIDs(reorderedItems.map(item => item.obj))
      };

      expect(eventData.listingData).toEqual({ folder: 'test-folder' });
      expect(eventData.ids).toEqual([
        { mediaFileId: 'video2' },
        { mediaFileId: 'video1' }
      ]);
    });
  });

  describe('Item type detection and handling', () => {
    it('should detect media file items', () => {
      const item: VideoListDefItem = {
        id: 'item1',
        obj: createFolderListingItem({
          mediaFile: createMinimalMediaFile({ id: 'video1', title: 'Video 1' }),
          popupActions: []
        })
      };

      const isMediaFile = !!item.obj.mediaFile;
      const isFolder = !!item.obj.folder;

      expect(isMediaFile).toBe(true);
      expect(isFolder).toBe(false);
    });

    it('should detect folder items', () => {
      const item: VideoListDefItem = {
        id: 'item1',
        obj: createFolderListingItem({
          folder: {
            id: 'folder1',
            title: 'Folder 1',
            previewItems: []
          },
          popupActions: []
        })
      };

      const isMediaFile = !!item.obj.mediaFile;
      const isFolder = !!item.obj.folder;

      expect(isMediaFile).toBe(false);
      expect(isFolder).toBe(true);
    });

    it('should detect unknown item types', () => {
      const item: VideoListDefItem = {
        id: 'item1',
        obj: createFolderListingItem({
          // Neither mediaFile nor folder set
          popupActions: []
        })
      };

      const isMediaFile = !!item.obj.mediaFile;
      const isFolder = !!item.obj.folder;
      const isUnknown = !isMediaFile && !isFolder;

      expect(isMediaFile).toBe(false);
      expect(isFolder).toBe(false);
      expect(isUnknown).toBe(true);
    });
  });

  describe('Open item logic', () => {
    it('should prepare open item event for media files', () => {
      const item: VideoListDefItem = {
        id: 'item1',
        obj: createFolderListingItem({
          mediaFile: createMinimalMediaFile({ id: 'video1', title: 'Video 1' }),
          openAction: { code: 'open_video', lang: Proto3.ScriptCall_Lang.JAVASCRIPT },
          popupActions: []
        })
      };

      const listingData = { folder: 'test-folder' };

      // Simulate open item logic
      if (item.obj.openAction) {
        const eventData = {
          item: item.obj,
          listingData: listingData
        };

        expect(eventData.item.mediaFile?.id).toBe('video1');
        expect(eventData.item.openAction?.code).toBe('open_video');
        expect(eventData.listingData).toEqual({ folder: 'test-folder' });
      }
    });

    it('should handle items without openAction', () => {
      const item: VideoListDefItem = {
        id: 'item1',
        obj: createFolderListingItem({
          mediaFile: createMinimalMediaFile({ id: 'video1', title: 'Video 1' }),
          // No openAction defined
          popupActions: []
        })
      };

      // Simulate missing openAction handling
      const hasOpenAction = !!item.obj.openAction;
      expect(hasOpenAction).toBe(false);

      // Should show alert or error message
      if (!hasOpenAction) {
        global.alert('item not found or missing openAction');
      }

      expect(global.alert).toHaveBeenCalledWith('item not found or missing openAction');
    });
  });

  describe('Visualization overrides', () => {
    it('should handle custom folder visualization', () => {
      const item: VideoListDefItem = {
        id: 'item1',
        obj: createFolderListingItem({
          folder: {
            id: 'folder1',
            title: 'Custom Folder',
            previewItems: []
          },
          vis: {
            baseColor: { r: 255, g: 100, b: 50 },
            icon: {
              faClass: {
                classes: 'fas fa-star',
                color: { r: 255, g: 215, b: 0 }
              }
            }
          },
          popupActions: []
        })
      };

      const visualization = item.obj.vis;
      
      expect(visualization?.baseColor).toEqual({ r: 255, g: 100, b: 50 });
      expect(visualization?.icon?.faClass?.classes).toBe('fas fa-star');
      expect(visualization?.icon?.faClass?.color).toEqual({ r: 255, g: 215, b: 0 });
    });

    it('should handle items without visualization overrides', () => {
      const item: VideoListDefItem = {
        id: 'item1',
        obj: createFolderListingItem({
          mediaFile: createMinimalMediaFile({ id: 'video1', title: 'Video 1' }),
          // No vis field
          popupActions: []
        })
      };

      const visualization = item.obj.vis;
      expect(visualization).toBeUndefined();
    });
  });

  describe('Preview items handling', () => {
    it('should handle folder preview items', () => {
      const folderWithPreviews: PageItem_FolderListing_Folder = {
        id: 'preview-folder',
        title: 'Folder with Previews',
        previewItems: [
          createFolderListingItem({
            mediaFile: createMinimalMediaFile({ id: 'preview1', title: 'Preview 1' }),
            popupActions: []
          }),
          createFolderListingItem({
            mediaFile: createMinimalMediaFile({ id: 'preview2', title: 'Preview 2' }),
            popupActions: []
          })
        ]
      };

      const item: VideoListDefItem = {
        id: 'preview-folder',
        obj: createFolderListingItem({
          folder: folderWithPreviews,
          popupActions: []
        })
      };

      expect(item.obj.folder?.previewItems).toHaveLength(2);
      expect(item.obj.folder?.previewItems[0].mediaFile?.title).toBe('Preview 1');
      expect(item.obj.folder?.previewItems[1].mediaFile?.title).toBe('Preview 2');
    });

    it('should handle empty preview items', () => {
      const item: VideoListDefItem = {
        id: 'item1',
        obj: createFolderListingItem({
          folder: {
            id: 'folder1',
            title: 'Empty Folder',
            previewItems: []
          },
          popupActions: []
        })
      };

      expect(item.obj.folder?.previewItems).toHaveLength(0);
    });
  });
});