module.exports = require('@darkobits/ts-unified/dist/config/jest')({
  coveragePathIgnorePatterns: [
    '<rootDir>/src/bin',
    '<rootDir>/src/lib/log'
  ],
  coverageThreshold: {
    global: {
      statements: 50,
      branches: 50,
      functions: 50,
      lines: 50
    }
  }
});
