#!/usr/bin/env python3
"""
Simple test script to verify the backend API is working.
Run this after starting the backend services.
"""

import requests
import json
import time
from pathlib import Path

BASE_URL = "http://localhost:8000"

def test_api_health():
    """Test basic API health"""
    try:
        response = requests.get(f"{BASE_URL}/api/sessions")
        print("✅ API is responding")
        return True
    except requests.exceptions.ConnectionError:
        print("❌ Cannot connect to API. Is the backend running?")
        return False

def test_session_list():
    """Test session listing endpoint"""
    try:
        response = requests.get(f"{BASE_URL}/api/sessions")
        if response.status_code == 200:
            sessions = response.json()
            print(f"✅ Session list endpoint working ({len(sessions)} sessions)")
            return True
        else:
            print(f"❌ Session list failed: {response.status_code}")
            return False
    except Exception as e:
        print(f"❌ Session list error: {e}")
        return False

def test_upload_validation():
    """Test upload validation without actually uploading"""
    try:
        # Test with invalid file type
        files = {'file': ('test.txt', b'not a zip file', 'text/plain')}
        response = requests.post(f"{BASE_URL}/api/upload", files=files)
        if response.status_code == 400:
            print("✅ Upload validation working (rejected invalid file)")
            return True
        else:
            print(f"❌ Upload validation failed: {response.status_code}")
            return False
    except Exception as e:
        print(f"❌ Upload validation error: {e}")
        return False

def test_url_validation():
    """Test URL submission validation"""
    try:
        data = {
            'source_url': 'not-a-valid-url',
            'source_type': 'url'
        }
        response = requests.post(f"{BASE_URL}/api/submit_link", data=data)
        if response.status_code == 400:
            print("✅ URL validation working (rejected invalid URL)")
            return True
        else:
            print(f"❌ URL validation failed: {response.status_code}")
            return False
    except Exception as e:
        print(f"❌ URL validation error: {e}")
        return False

def test_media_endpoint():
    """Test media serving endpoint"""
    try:
        # Test with non-existent session
        response = requests.get(f"{BASE_URL}/api/media/nonexistent/test.jpg")
        if response.status_code == 404:
            print("✅ Media endpoint working (correctly returns 404 for non-existent files)")
            return True
        else:
            print(f"❌ Media endpoint failed: {response.status_code}")
            return False
    except Exception as e:
        print(f"❌ Media endpoint error: {e}")
        return False

def main():
    """Run all tests"""
    print("🧪 Testing Media ZIP Showcase Backend API")
    print("=" * 50)
    
    tests = [
        ("API Health", test_api_health),
        ("Session List", test_session_list),
        ("Upload Validation", test_upload_validation),
        ("URL Validation", test_url_validation),
        ("Media Endpoint", test_media_endpoint),
    ]
    
    passed = 0
    total = len(tests)
    
    for test_name, test_func in tests:
        print(f"\n🔍 Testing: {test_name}")
        if test_func():
            passed += 1
        time.sleep(0.5)  # Small delay between tests
    
    print("\n" + "=" * 50)
    print(f"📊 Results: {passed}/{total} tests passed")
    
    if passed == total:
        print("🎉 All tests passed! Backend is working correctly.")
        print("\nNext steps:")
        print("1. Start the frontend: cd frontend && npm run dev")
        print("2. Open http://localhost:5173 in your browser")
        print("3. Upload a ZIP file to test the full application")
    else:
        print("❌ Some tests failed. Check the backend logs and configuration.")
        print("\nTroubleshooting:")
        print("1. Ensure Redis is running: redis-cli ping")
        print("2. Check Celery worker: celery -A tasks.celery_app inspect active")
        print("3. Verify backend is running: curl http://localhost:8000/api/sessions")

if __name__ == "__main__":
    main() 