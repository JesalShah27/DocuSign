#!/bin/bash

# Install dependencies
npm install

# Run database migrations
npx prisma migrate deploy

# Build TypeScript files
npm run build

# Start the server
npm start