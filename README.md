## Golden Memories

### Setup
1. Create a `.env` file with:
```
NODE_ENV=production
PORT=3000
HOST=0.0.0.0
SESSION_SECRET=change-me
COOKIE_SECURE=false
DATABASE_URL=postgres://user:password@localhost:5432/golden_memories
AWS_ACCESS_KEY_ID=
AWS_SECRET_ACCESS_KEY=
AWS_REGION=
S3_BUCKET_NAME=
```

2. Install deps and run:
```
npm ci
npm run start
```

### Deploy (Hostinger VPS)
1. Install Node.js LTS, git, nginx, and PM2.
2. Clone repo and setup `.env`.
3. Start with PM2:
```
pm2 start ecosystem.config.js
pm2 save && pm2 startup
```
4. Nginx reverse proxy example:
```
server {
    listen 80;
    server_name YOUR_DOMAIN;
    location / {
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header X-Forwarded-Host $host;
        proxy_set_header Host $host;
        proxy_pass http://127.0.0.1:3000;
    }
}
```

