import { describe, it, expect, beforeEach } from 'vitest';
import { rgbToCssColor, cssVariables, setCssVariables } from '@/lib/asset_browser/utils';

describe('asset_browser utils', () => {
  describe('rgbToCssColor', () => {
    it('should convert RGB values to CSS color string', () => {
      expect(rgbToCssColor(255, 0, 0)).toBe('rgb(255, 0, 0)');
      expect(rgbToCssColor(0, 255, 0)).toBe('rgb(0, 255, 0)');
      expect(rgbToCssColor(0, 0, 255)).toBe('rgb(0, 0, 255)');
      expect(rgbToCssColor(128, 128, 128)).toBe('rgb(128, 128, 128)');
    });

    it('should handle edge case RGB values', () => {
      expect(rgbToCssColor(0, 0, 0)).toBe('rgb(0, 0, 0)');
      expect(rgbToCssColor(255, 255, 255)).toBe('rgb(255, 255, 255)');
    });

    it('should handle decimal values by preserving them', () => {
      expect(rgbToCssColor(127.5, 64.2, 192.8)).toBe('rgb(127.5, 64.2, 192.8)');
    });

    it('should handle negative values', () => {
      expect(rgbToCssColor(-10, 50, 200)).toBe('rgb(-10, 50, 200)');
    });

    it('should handle values above 255', () => {
      expect(rgbToCssColor(300, 400, 500)).toBe('rgb(300, 400, 500)');
    });
  });

  describe('setCssVariables', () => {
    let testElement: HTMLDivElement;

    beforeEach(() => {
      testElement = document.createElement('div');
      document.body.appendChild(testElement);
    });

    it('should set CSS custom properties on element', () => {
      const variables = {
        basecolor: '#ff0000',
        size: '10px',
        opacity: '0.5'
      };

      setCssVariables(testElement, variables);

      expect(testElement.style.getPropertyValue('--basecolor')).toBe('#ff0000');
      expect(testElement.style.getPropertyValue('--size')).toBe('10px');
      expect(testElement.style.getPropertyValue('--opacity')).toBe('0.5');
    });

    it('should handle empty variables object', () => {
      setCssVariables(testElement, {});
      expect(testElement.style.length).toBe(0);
    });

    it('should handle numeric values', () => {
      setCssVariables(testElement, { width: 100, height: 200 });
      expect(testElement.style.getPropertyValue('--width')).toBe('100');
      expect(testElement.style.getPropertyValue('--height')).toBe('200');
    });

    it('should overwrite existing custom properties', () => {
      setCssVariables(testElement, { color: 'red' });
      expect(testElement.style.getPropertyValue('--color')).toBe('red');
      
      setCssVariables(testElement, { color: 'blue' });
      expect(testElement.style.getPropertyValue('--color')).toBe('blue');
    });

    it('should handle special characters in property names', () => {
      setCssVariables(testElement, { 'primary-color': '#333', 'font_size': '14px' });
      expect(testElement.style.getPropertyValue('--primary-color')).toBe('#333');
      expect(testElement.style.getPropertyValue('--font_size')).toBe('14px');
    });
  });

  describe('cssVariables', () => {
    let testElement: HTMLDivElement;

    beforeEach(() => {
      testElement = document.createElement('div');
      document.body.appendChild(testElement);
    });

    it('should return update function that can modify CSS variables', () => {
      const initialVars = { basecolor: '#ff0000' };
      const result = cssVariables(testElement, initialVars);

      expect(testElement.style.getPropertyValue('--basecolor')).toBe('#ff0000');
      expect(typeof result.update).toBe('function');

      // Test update function
      result.update({ basecolor: '#00ff00', size: '20px' });
      expect(testElement.style.getPropertyValue('--basecolor')).toBe('#00ff00');
      expect(testElement.style.getPropertyValue('--size')).toBe('20px');
    });

    it('should handle multiple updates', () => {
      const result = cssVariables(testElement, { basecolor: 'red' });
      
      result.update({ basecolor: 'green', opacity: '0.8' });
      result.update({ basecolor: 'blue', margin: '10px' });
      
      expect(testElement.style.getPropertyValue('--basecolor')).toBe('blue');
      expect(testElement.style.getPropertyValue('--opacity')).toBe('0.8');
      expect(testElement.style.getPropertyValue('--margin')).toBe('10px');
    });
  });
});