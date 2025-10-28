#!/bin/bash

# DocUsign Deployment Script
# This script helps deploy the DocUsign application

set -e

echo "🚀 DocUsign Deployment Script"
echo "=============================="

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js first."
    exit 1
fi

# Check Node.js version
NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 18 ]; then
    echo "❌ Node.js version 18 or higher is required. Current version: $(node -v)"
    exit 1
fi

echo "✅ Node.js version: $(node -v)"

# Check if npm is installed
if ! command -v npm &> /dev/null; then
    echo "❌ npm is not installed. Please install npm first."
    exit 1
fi

echo "✅ npm version: $(npm -v)"

# Function to deploy backend
deploy_backend() {
    echo ""
    echo "📦 Deploying Backend..."
    echo "======================="
    
    cd backend
    
    # Install production dependencies
    echo "Installing backend dependencies..."
    npm ci --only=production
    
    # Check if .env.production file exists
    if [ ! -f .env.production ]; then
        echo "⚠️  .env.production file not found. Creating from example..."
        if [ -f env.example ]; then
            cp env.example .env.production
            echo "📝 Please edit .env.production file with your production configuration."
            echo "   Required variables:"
            echo "   - DATABASE_URL"
            echo "   - JWT_SECRET"
            echo "   - SENDGRID_API_KEY"
            echo "   - FROM_EMAIL"
            echo "   - FROM_NAME"
            read -p "Press Enter to continue after editing .env.production file..."
        else
            echo "❌ env.example file not found. Please create .env.production file manually."
            exit 1
        fi
    fi
    
    # Copy production env to .env
    cp .env.production .env
    
    # Run database migrations
    echo "Running database migrations..."
    npx prisma migrate deploy
    
    # Generate Prisma client
    echo "Generating Prisma client..."
    npx prisma generate
    
    # Build the application
    echo "Building backend..."
    npm run build
    
    echo "✅ Backend deployment completed!"
    cd ..
}

# Function to deploy frontend
deploy_frontend() {
    echo ""
    echo "📦 Deploying Frontend..."
    echo "========================"
    
    cd frontend
    
    # Install production dependencies
    echo "Installing frontend dependencies..."
    npm ci --only=production
    
    # Set production environment
    export NODE_ENV=production
    
    # Build the application with production settings
    echo "Building frontend..."
    npm run build
    
    # Install and use serve for production hosting
    echo "Setting up production server..."
    npm install -g serve
    
    echo "✅ Frontend deployment completed!"
    cd ..
}

# Function to run tests
run_tests() {
    echo ""
    echo "🧪 Running Tests..."
    echo "==================="
    
    cd backend
    echo "Running backend tests..."
    npm test
    cd ..
    
    cd frontend
    echo "Running frontend tests..."
    npm test -- --watchAll=false
    cd ..
    
    echo "✅ All tests passed!"
}

# Function to start services
start_services() {
    echo ""
    echo "🚀 Starting Services..."
    echo "======================="
    
    # Start backend
    echo "Starting backend server..."
    cd backend
    npm start &
    BACKEND_PID=$!
    cd ..
    
    # Wait a moment for backend to start
    sleep 3
    
    # Start frontend (if needed)
    echo "Backend started with PID: $BACKEND_PID"
    echo "Frontend build is ready in frontend/build/"
    echo "Serve the frontend build with your preferred web server."
    
    echo ""
    echo "✅ Services started!"
    echo "Backend: http://localhost:4000"
    echo "Frontend: Serve from frontend/build/"
}

# Function to show help
show_help() {
    echo "Usage: $0 [OPTIONS]"
    echo ""
    echo "Options:"
    echo "  --backend-only    Deploy only the backend"
    echo "  --frontend-only   Deploy only the frontend"
    echo "  --test-only       Run tests only"
    echo "  --start-only      Start services only"
    echo "  --help           Show this help message"
    echo ""
    echo "Examples:"
    echo "  $0                # Full deployment"
    echo "  $0 --backend-only # Deploy backend only"
    echo "  $0 --test-only    # Run tests only"
}

# Main deployment logic
main() {
    case "${1:-}" in
        --backend-only)
            deploy_backend
            ;;
        --frontend-only)
            deploy_frontend
            ;;
        --test-only)
            run_tests
            ;;
        --start-only)
            start_services
            ;;
        --help)
            show_help
            ;;
        "")
            # Full deployment
            deploy_backend
            deploy_frontend
            run_tests
            start_services
            ;;
        *)
            echo "❌ Unknown option: $1"
            show_help
            exit 1
            ;;
    esac
}

# Run main function with all arguments
main "$@"

echo ""
echo "🎉 Deployment completed successfully!"
echo ""
echo "Next steps:"
echo "1. Configure your environment variables in backend/.env"
echo "2. Set up SSL certificates for HTTPS (optional)"
echo "3. Configure your web server to serve the frontend build"
echo "4. Set up monitoring and logging"
echo "5. Configure backup for your database"
echo ""
echo "For more information, see the README.md file."
