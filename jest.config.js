module.exports = require('@darkobits/ts-unified/dist/config/jest')({
  coveragePathIgnorePatterns: [
    '<rootDir>/src/bin',
    '<rootDir>/src/lib/log'
  ],
  coverageThreshold: {
    global: {
      statements: 80,
      branches: 65,
      functions: 85,
      lines: 80
    }
  }
});
