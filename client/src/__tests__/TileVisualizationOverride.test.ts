import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/svelte';
import TileVisualizationOverride from '@/lib/asset_browser/TileVisualizationOverride.svelte';
import * as Proto3 from '@clapshot_protobuf/typescript';

// Mock the rgbToCssColor utility
vi.mock('@/lib/asset_browser/utils', () => ({
  rgbToCssColor: vi.fn().mockImplementation((r: number, g: number, b: number) => {
    return `rgb(${r || 0}, ${g || 0}, ${b || 0})`;
  })
}));

describe('TileVisualizationOverride.svelte', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  describe('Basic rendering', () => {
    it('should render with minimal props', () => {
      const mockVis: Proto3.PageItem_FolderListing_Item_Visualization = {};
      
      render(TileVisualizationOverride, {
        props: { vis: mockVis }
      });

      const container = screen.getByRole('img');
      expect(container).toBeInTheDocument();
      expect(container).toHaveClass('w-full', 'h-full', 'overflow-clip', 'inline-block', 'relative', 'rounded-md');
    });

    it('should apply extra_styles correctly', () => {
      const mockVis: Proto3.PageItem_FolderListing_Item_Visualization = {};
      const extraStyles = 'border: 2px solid red; background-color: blue;';
      
      render(TileVisualizationOverride, {
        props: { vis: mockVis, extra_styles: extraStyles }
      });

      const container = screen.getByRole('img');
      expect(container).toHaveStyle('border: 2px solid red; background-color: blue;');
    });

    it('should have correct accessibility attributes', () => {
      const mockVis: Proto3.PageItem_FolderListing_Item_Visualization = {};
      
      render(TileVisualizationOverride, {
        props: { vis: mockVis }
      });

      const container = screen.getByRole('img');
      expect(container).toHaveAttribute('role', 'img');
    });

    it('should render with empty visualization object', () => {
      const mockVis: Proto3.PageItem_FolderListing_Item_Visualization = {};
      
      render(TileVisualizationOverride, {
        props: { vis: mockVis }
      });

      const container = screen.getByRole('img');
      expect(container).toBeInTheDocument();
      // Should not render any icons when vis is empty
      expect(container.querySelector('i')).not.toBeInTheDocument();
      expect(container.querySelector('img')).not.toBeInTheDocument();
    });
  });

  describe('FontAwesome icon display', () => {
    it('should render FontAwesome icon with classes', () => {
      const mockVis: Proto3.PageItem_FolderListing_Item_Visualization = {
        icon: {
          faClass: {
            classes: 'fas fa-star'
          }
        }
      };
      
      render(TileVisualizationOverride, {
        props: { vis: mockVis }
      });

      const icon = screen.getByRole('img').querySelector('i');
      expect(icon).toBeInTheDocument();
      expect(icon).toHaveClass('fas', 'fa-star');
    });

    it('should apply custom icon color from RGB values', () => {
      const mockVis: Proto3.PageItem_FolderListing_Item_Visualization = {
        icon: {
          faClass: {
            classes: 'fas fa-heart',
            color: { r: 255, g: 0, b: 0 }
          }
        }
      };
      
      render(TileVisualizationOverride, {
        props: { vis: mockVis }
      });

      const container = screen.getByRole('img');
      const icon = container.querySelector('i');
      expect(icon).toBeInTheDocument();
      expect(icon).toHaveStyle('color: rgb(255, 0, 0)');
    });

    it('should use default white color when no color specified', () => {
      const mockVis: Proto3.PageItem_FolderListing_Item_Visualization = {
        icon: {
          faClass: {
            classes: 'fas fa-folder'
          }
        }
      };
      
      render(TileVisualizationOverride, {
        props: { vis: mockVis }
      });

      const container = screen.getByRole('img');
      const icon = container.querySelector('i');
      expect(icon).toBeInTheDocument();
      expect(icon).toHaveStyle('color: #fff');
    });

    it('should apply custom icon size', () => {
      const mockVis: Proto3.PageItem_FolderListing_Item_Visualization = {
        icon: {
          faClass: {
            classes: 'fas fa-user'
          },
          size: 3.5
        }
      };
      
      render(TileVisualizationOverride, {
        props: { vis: mockVis }
      });

      const container = screen.getByRole('img');
      const icon = container.querySelector('i');
      expect(icon).toBeInTheDocument();
      // Browser converts em to px, so check that it contains the em value in style attribute
      expect(icon?.getAttribute('style')).toContain('font-size: 3.5em');
    });

    it('should use default size when size not specified', () => {
      const mockVis: Proto3.PageItem_FolderListing_Item_Visualization = {
        icon: {
          faClass: {
            classes: 'fas fa-star'
          }
        }
      };
      
      render(TileVisualizationOverride, {
        props: { vis: mockVis }
      });

      const container = screen.getByRole('img');
      const icon = container.querySelector('i');
      expect(icon).toBeInTheDocument();
      // Browser converts em to px, so check that it contains the em value in style attribute
      expect(icon?.getAttribute('style')).toContain('font-size: 2em');
    });

    it('should handle complex FontAwesome class strings', () => {
      const mockVis: Proto3.PageItem_FolderListing_Item_Visualization = {
        icon: {
          faClass: {
            classes: 'fas fa-solid fa-star fa-spin fa-2x'
          }
        }
      };
      
      render(TileVisualizationOverride, {
        props: { vis: mockVis }
      });

      const icon = screen.getByRole('img').querySelector('i');
      expect(icon).toBeInTheDocument();
      expect(icon).toHaveClass('fas', 'fa-solid', 'fa-star', 'fa-spin', 'fa-2x');
    });
  });

  describe('Image URL display', () => {
    it('should render image when imgUrl provided', () => {
      const mockVis: Proto3.PageItem_FolderListing_Item_Visualization = {
        icon: {
          imgUrl: 'https://example.com/icon.png'
        }
      };
      
      render(TileVisualizationOverride, {
        props: { vis: mockVis }
      });

      const img = screen.getByAltText('icon img');
      expect(img).toBeInTheDocument();
      expect(img).toHaveAttribute('src', 'https://example.com/icon.png');
    });

    it('should apply correct image styling', () => {
      const mockVis: Proto3.PageItem_FolderListing_Item_Visualization = {
        icon: {
          imgUrl: '/assets/custom-icon.svg'
        }
      };
      
      render(TileVisualizationOverride, {
        props: { vis: mockVis }
      });

      const img = screen.getByAltText('icon img');
      expect(img).toBeInTheDocument();
      expect(img).toHaveClass('w-1/2', 'h-1/2');
    });

    it('should include proper alt text', () => {
      const mockVis: Proto3.PageItem_FolderListing_Item_Visualization = {
        icon: {
          imgUrl: '/path/to/icon.jpg'
        }
      };
      
      render(TileVisualizationOverride, {
        props: { vis: mockVis }
      });

      const img = screen.getByAltText('icon img');
      expect(img).toBeInTheDocument();
      expect(img).toHaveAttribute('alt', 'icon img');
    });
  });

  describe('Conditional logic', () => {
    it('should prioritize FontAwesome over image when both exist', () => {
      const mockVis: Proto3.PageItem_FolderListing_Item_Visualization = {
        icon: {
          faClass: {
            classes: 'fas fa-star'
          },
          imgUrl: 'https://example.com/icon.png'
        }
      };
      
      render(TileVisualizationOverride, {
        props: { vis: mockVis }
      });

      const container = screen.getByRole('img');
      const faIcon = container.querySelector('i');
      const imgIcon = container.querySelector('img');
      
      expect(faIcon).toBeInTheDocument();
      expect(faIcon).toHaveClass('fas', 'fa-star');
      expect(imgIcon).not.toBeInTheDocument();
    });

    it('should render nothing when no icon data provided', () => {
      const mockVis: Proto3.PageItem_FolderListing_Item_Visualization = {};
      
      render(TileVisualizationOverride, {
        props: { vis: mockVis }
      });

      const container = screen.getByRole('img');
      const faIcon = container.querySelector('i');
      const imgIcon = container.querySelector('img');
      
      expect(faIcon).not.toBeInTheDocument();
      expect(imgIcon).not.toBeInTheDocument();
    });

    it('should handle incomplete icon objects', () => {
      const mockVis: Proto3.PageItem_FolderListing_Item_Visualization = {
        icon: {
          faClass: {
            // Missing classes field - but component will still render with empty classes
            color: { r: 100, g: 150, b: 200 }
          }
        }
      };
      
      render(TileVisualizationOverride, {
        props: { vis: mockVis }
      });

      const container = screen.getByRole('img');
      const faIcon = container.querySelector('i');
      const imgIcon = container.querySelector('img');
      
      // Component renders FA icon even with empty classes, as vis.icon?.faClass exists
      expect(faIcon).toBeInTheDocument();
      expect(imgIcon).not.toBeInTheDocument();
      expect(faIcon).toHaveStyle('color: rgb(100, 150, 200)');
    });
  });

  describe('Integration and edge cases', () => {
    it('should integrate properly with rgbToCssColor utility', async () => {
      const mockVis: Proto3.PageItem_FolderListing_Item_Visualization = {
        icon: {
          faClass: {
            classes: 'fas fa-gem',
            color: { r: 128, g: 64, b: 192 }
          }
        }
      };
      
      render(TileVisualizationOverride, {
        props: { vis: mockVis }
      });

      // Get the mocked function to verify it was called
      const utils = await import('@/lib/asset_browser/utils');
      const rgbToCssColor = vi.mocked(utils.rgbToCssColor);
      expect(rgbToCssColor).toHaveBeenCalledWith(128, 64, 192);
      
      const container = screen.getByRole('img');
      const icon = container.querySelector('i');
      expect(icon).toHaveStyle('color: rgb(128, 64, 192)');
    });

    it('should handle extreme RGB values gracefully', () => {
      const mockVis: Proto3.PageItem_FolderListing_Item_Visualization = {
        icon: {
          faClass: {
            classes: 'fas fa-warning',
            color: { r: 0, g: 255, b: 0 }
          }
        }
      };
      
      render(TileVisualizationOverride, {
        props: { vis: mockVis }
      });

      const container = screen.getByRole('img');
      const icon = container.querySelector('i');
      expect(icon).toBeInTheDocument();
      expect(icon).toHaveStyle('color: rgb(0, 255, 0)');
    });
  });
});