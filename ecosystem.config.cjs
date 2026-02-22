module.exports = {
  apps: [
    {
      name: "clantrader",
      script: "node_modules/.bin/tsx",
      args: "-r tsconfig-paths/register server.ts",
      cwd: "/root/projects/clantrader",
      env: {
        NODE_ENV: "production",
        PORT: 3000,
      },
      instances: 1,
      exec_mode: "fork",
      autorestart: true,
      max_restarts: 10,
      restart_delay: 5000,
      max_memory_restart: "1G",
      log_date_format: "YYYY-MM-DD HH:mm:ss",
      error_file: "/root/projects/clantrader/logs/pm2-error.log",
      out_file: "/root/projects/clantrader/logs/pm2-out.log",
      merge_logs: true,
    },
  ],
};
