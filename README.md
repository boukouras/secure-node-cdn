# Secure Node.js & Express.js CDN Server
A simple secure CDN server built with Node.js & Express.js.

Supports file uploads, categorizations, public / private access and JWT authentication.

---
### Features

- Upload **single or multiple files** (`/upload` & `/upload/multi`)
- Categorization by file type:
    -  `css`, `js`, `images`, `videos`, `etc`
- **Public** & **Private** folders
- **JWT authentication** for private files
- CORS & security headers (Helmet + CSP for SVG)
- Automatic nested folder support
- MIME-based validation for safety
- Sample JWT token generated on server startup

---

## Tech Stack

- **Node.js**
- **Express.js**
- **Multer**
- **JWT**
- **Helmet**
- **CORS**
- **uuid**
 
---

## Getting Started

### 1. Clone the repo

```
git clone https://github.com/boukouras/secure-node-cdn
cd secure-node-cdn
```

### 2. Install dependecies

```
npm install
```

### 3. Make .env file

```
cp .env.example .env
```

### 4. Configure the environment variables

```
APP_PORT=3000
JWT_SECRET=your_secret_key
ALLOWED_CLIENTS=client1,client2
```

### 5. Start the Server

```
npm run start
```

---

## API Endpoints

### 1. Home

```
 GET /
 Response:
 {
    "server": true,
    "message": "Welcome to your secure CDN server",
    "uptime": 10.12,
    "port": 3000
 }
```

### 2. Upload Single File

```
POST /upload
Headers:
    Authorization: Bearer <JWT Token>
Body (form-data):
    file: <file>
    access: public | private (optional)
Response:
    {
        "status": true,
        "file": "uuid.jpg",
        "url": `/media/public/images/uuid.jpg`
    }
```

### 3. Upload Multiple Files
```
POST /upload/multi
Headers:
    Authorization: Bearer <JWT Token>
Body (form-data):
    files: [<file1>, <file2>, <file3>, ...]
    access: public | private (optional)
Response:
    {
        "status": true,
        "files": [
            {
                "filename": "uuid1.jpg",
                "url": `/media/public/images/uuid1.jpg`
            },
            {
                "filename": "uuid2.jpg",
                "url": `/media/public/images/uuid2.jpg`
            },
            {
                "filename": "uuid3.jpg",
                "url": `/media/public/images/uuid3.jpg`
            },
            ...
        ]
    }
```

### 4. Serve Media File
For the private file you should use to Headers Bearer the JWT that server generate, and the full filepath with the extention.
For example you want some image from the public, the path of this image is about/a14b14c2-fc80-4977-9e95-31e549f68e9b.jpg
```
GET http://localhost:3000/media?access=public&type=images&filepath=about/a14b14c2-fc80-4977-9e95-31e549f68e9b.jpg
```
