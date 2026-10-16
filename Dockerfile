# Gunakan image Node.js versi 20
FROM node:20-slim

# Tentukan direktori kerja di dalam container
WORKDIR /app

# Salin file package.json dan package-lock.json
COPY package*.json ./

# Install dependencies
RUN npm install

# Salin semua file proyek lainnya
COPY . .

# Hugging Face Spaces menggunakan port 7860
EXPOSE 7860

# Perintah untuk menjalankan aplikasi
CMD [ "node", "server.js" ]
