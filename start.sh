#!/bin/bash

# Media ZIP Showcase Startup Script
# This script starts all required services for the application

#set -e  # Removed to not exit on error

echo "🚀 Starting Media ZIP Showcase..."

# Check if we're in the right directory
if [ ! -f "backend/app.py" ] || [ ! -f "frontend/package.json" ]; then
    echo "❌ Please run this script from the project root directory"
    exit 1
fi

# Function to check if a command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Check prerequisites
echo "🔍 Checking prerequisites..."

if ! command_exists python3; then
    echo "❌ Python 3 is required but not installed"
    #exit 1
fi

if ! command_exists node; then
    echo "❌ Node.js is required but not installed"
    #exit 1
fi

if ! command_exists redis-cli; then
    echo "⚠️  Redis CLI not found. Please install Redis:"
    echo "   macOS: brew install redis"
    echo "   Ubuntu: sudo apt install redis-server"
    echo "   Or use Docker: docker run -d -p 6379:6379 redis:7.2-alpine"
    echo ""
    read -p "Continue anyway? (y/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        #exit 1
        echo "Continuing anyway as per user input."
    fi
fi

# Check if Redis is running
if command_exists redis-cli; then
    if ! redis-cli ping >/dev/null 2>&1; then
        echo "⚠️  Redis is not running. Starting Redis..."
        if command_exists docker; then
            echo "Starting Redis with Docker..."
            docker run -d --name redis-media-zip -p 6379:6379 redis:7.2-alpine
            sleep 2
        else
            echo "Please start Redis manually:"
            echo "  redis-server"
            echo "Or with Docker:"
            echo "  docker run -d --name redis-media-zip -p 6379:6379 redis:7.2-alpine"
            #exit 1
        fi
    else
        echo "✅ Redis is running"
    fi
fi

# Install backend dependencies


# Install frontend dependencies
cd backend
echo "📦 Installing frontend dependencies..."
cd ../frontend || echo "Could not cd into frontend"
npm install || echo "Failed to install frontend dependencies"

# Start services
echo "🚀 Starting services..."

# Start backend in background
cd backend || echo "Could not cd into backend"
echo "Starting FastAPI server..."
python -m uvicorn app:app --reload --host 0.0.0.0 --port 8000
BACKEND_PID=$!

# Start Celery worker in background
echo "Starting Celery worker..."
celery -A tasks:celery_app worker --loglevel=info &
WORKER_PID=$!

# Start Celery beat in background
echo "Starting Celery beat scheduler..."
celery -A tasks:celery_app beat --loglevel=info &
BEAT_PID=$!

# Wait a moment for backend to start
sleep 3

# Test backend health
echo "🧪 Testing backend health..."
sleep 2
if curl -s http://localhost:8000/api/sessions >/dev/null 2>&1; then
    echo "✅ Backend is healthy"
else
    echo "⚠️  Backend might still be starting up..."
fi

# Start frontend
echo "Starting frontend development server..."
cd ../frontend || echo "Could not cd into frontend"
npm run dev &
FRONTEND_PID=$!

# Save PIDs for cleanup
echo $BACKEND_PID > .backend.pid
echo $WORKER_PID > .worker.pid
echo $BEAT_PID > .beat.pid
echo $FRONTEND_PID > .frontend.pid

echo ""
echo "🎉 Media ZIP Showcase is running!"
echo ""
echo "📱 Frontend (React): http://localhost:5173"
echo "🔧 Backend API: http://localhost:8000"
echo "📊 API Documentation: http://localhost:8000/docs"
echo "🎬 Static Session Viewer: http://localhost:8000/session/{session_id}"
echo ""
echo "🔒 Security Features Active:"
echo "   ✅ Rate limiting (5 uploads/min, 10 links/min)"
echo "   ✅ CORS protection"
echo "   ✅ File validation & ZIP bomb protection"
echo "   ✅ Auto-cleanup (5h media, 24h metadata)"
echo ""
echo "Press Ctrl+C to stop all services"
echo ""

# Function to cleanup on exit
cleanup() {
    echo ""
    echo "🛑 Stopping services..."
    
    if [ -f ".backend.pid" ]; then
        kill $(cat .backend.pid) 2>/dev/null || true
        rm .backend.pid
    fi
    
    if [ -f ".worker.pid" ]; then
        kill $(cat .worker.pid) 2>/dev/null || true
        rm .worker.pid
    fi
    
    if [ -f ".beat.pid" ]; then
        kill $(cat .beat.pid) 2>/dev/null || true
        rm .beat.pid
    fi
    
    if [ -f ".frontend.pid" ]; then
        kill $(cat .frontend.pid) 2>/dev/null || true
        rm .frontend.pid
    fi
    
    echo "✅ All services stopped"
    exit 0
}

# Set up signal handlers
trap cleanup SIGINT SIGTERM

# Wait for user to stop
wait