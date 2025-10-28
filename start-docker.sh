#!/bin/bash

# Build and start the containers
docker-compose up --build -d

# Wait for the database to be ready
echo "Waiting for database to be ready..."
sleep 10

# Run database migrations
docker-compose exec backend npx prisma migrate deploy

echo "All services are up and running!"
echo "You can access the services at:"
echo "Frontend: http://localhost:3000"
echo "Backend API: http://localhost:3001"
echo "MailHog UI: http://localhost:8025"
echo "Database: localhost:5432"