import {
  isNumerical,
  parseTime
} from './utils';


describe('isNumerical', () => {
  describe('when provided a string without digits', () => {
    it('should return `false`', () => {
      expect(isNumerical('f2f394431')).toBe(false);
    });
  });

  describe('when provided a string with only digits', () => {
    it('should return `true`', () => {
      expect(isNumerical('1613423')).toBe(true);
    });
  });
});


describe('parseTime', () => {
  describe('when provided a number', () => {
    it('should return the number as-is', () => {
      expect(parseTime(42)).toBe(42);
    });
  });

  describe('when provided a numerical string', () => {
    it('should return a number', () => {
      expect(parseTime('9000')).toBe(9000);
    });
  });

  describe('when provided a parse-able string', () => {
    it('should return a number', () => {
      expect(parseTime('5m')).toBe(300000);
    });
  });

  describe('when provided an invalid string', () => {
    it('should return `undefined`', () => {
      expect(parseTime('foo')).toBe(undefined);
    });
  });
});
