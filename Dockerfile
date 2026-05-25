FROM node:20-alpine

WORKDIR /app

COPY backend/package*.json ./backend/
RUN npm --prefix backend ci --omit=dev

COPY backend ./backend
COPY frontend ./frontend

WORKDIR /app/backend

EXPOSE 5001

CMD ["npm", "start"]
