#!/bin/bash

# Install dependencies
npm install

# Build production files
npm run build

# Optional: Serve using a static file server
# npm install -g serve
# serve -s build