// Runs the tests inside the Windows dsh sandbox, which blocks piped child processes.
// preserveSymlinks skips Vite's `net use` call, and threads replace forked workers.
export default {
  resolve: { preserveSymlinks: true },
  test: { pool: 'threads' },
};
