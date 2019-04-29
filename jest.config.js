module.exports = require('@darkobits/ts-unified/dist/config/jest')({
  coveragePathIgnorePatterns: [
    '<rootDir>/src/bin',
    '<rootDir>/src/lib/log'
  ],
  coverageThreshold: {
    global: {
      statements: 70,
      branches: 50,
      functions: 85,
      lines: 70
    }
  }
});
