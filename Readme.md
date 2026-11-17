# ==============================================================================
# PROMPTVERSE VPS SETUP GUIDE - MONGODB & NGINX FOR api4.clipgo.xyz
# ==============================================================================

## STEP 1: Connect to your VPS via SSH
```bash
ssh root@YOUR_VPS_IP
```

## STEP 2: MongoDB එකේ අලුත් Database එකක් සාදා ගැනීම
ඔබේ VPS එකේ දැනට වෙනත් site වල MongoDB databases ඇති නිසා, මේ සඳහා **`promptverse_db`** නමින් අලුත් database එකක් ස්වයංක්‍රීයවම හැදේ.

(MongoDB වල database එකක් create කිරීමට command run කරන්න අවශ්‍ය නැත — පළමු document එක insert කරද්දී ස්වයංක්‍රීයව create වේ).

### (Optional) MongoDB Authentication සක්‍රීය නම් පමණක්:
Mongo shell (`mongosh` හෝ `mongo`) එකට ගොස් user කෙනෙක් සාදන්න:
```javascript
mongosh
use promptverse_db

db.createUser({
  user: "promptverse_user",
  pwd: "YourStrongPassword123!",
  roles: [ { role: "readWrite", db: "promptverse_db" } ]
})
exit
```
එවිට `.env` එකේ URI එක මෙසේ දමන්න:
`MONGODB_URI=mongodb://promptverse_user:YourStrongPassword123!@127.0.0.1:27017/promptverse_db?authSource=promptverse_db`

Auth නැතිව internal 127.0.0.1 පමණක් නම්:
`MONGODB_URI=mongodb://127.0.0.1:27017/promptverse_db`

---

## STEP 3: Backend Setup & Run with PM2
```bash
cd /path/to/Backend
npm install

# .env එකේ MONGODB_URI සහ JWT_SECRET සකසන්න
nano .env

# Data 100+ Seed කර MongoDB එකට දැමීම:
node seed.js

# PM2 මඟින් 24/7 Run කිරීම:
pm2 start server.js --name "promptverse-api"
pm2 save
```

---

## STEP 4: Nginx Reverse Proxy for api4.clipgo.xyz
```bash
nano /etc/nginx/sites-available/api4.clipgo.xyz
```
Paste this configuration:
```nginx
server {
    server_name api4.clipgo.xyz;

    location / {
        proxy_pass http://127.0.0.1:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

Enable & Reload:
```bash
ln -s /etc/nginx/sites-available/api4.clipgo.xyz /etc/nginx/sites-enabled/
nginx -t
systemctl reload nginx

# Free SSL (HTTPS)
certbot --nginx -d api4.clipgo.xyz
```
