export default {
  test: {
    globals:     true,
    environment: 'node',
    setupFiles:  ['src/__tests__/setup.ts'],
    include:     ['src/__tests__/**/*.test.ts'],
  },
}
