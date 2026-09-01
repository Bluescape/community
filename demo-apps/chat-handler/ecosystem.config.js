module.exports = {
  apps: [
    {
      name: 'bluescape-chat-handler',
      script: 'src/index.js',
      instances: 1,
      exec_mode: 'fork',
      env: {
        NODE_ENV: 'production',
      },
      // Logging
      out_file: './pm2-logs/out.log',
      error_file: './pm2-logs/error.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: false,
      
      // Restart configuration
      max_memory_restart: '500M',
      
      // Auto restart on file changes (disable in production)
      // watch: ['src'],
      // ignore_watch: ['node_modules', 'pm2-logs'],
      
      // Auto restart on crash
      autorestart: true,
      
      // Max restart attempts (0 = infinite)
      max_restarts: 15,
      
      // Time window for restart limits (in seconds)
      min_uptime: '10s',
      listen_timeout: 5000,
      kill_timeout: 5000,
    },
  ],

  deploy: {
    production: {
      user: 'node',
      host: 'your-server.com',
      ref: 'origin/main',
      repo: 'your-git-repo-url',
      path: '/var/www/bluescape-chat-handler',
      'post-deploy': 'npm install && pm2 reload ecosystem.config.js --env production',
    },
  },
};
