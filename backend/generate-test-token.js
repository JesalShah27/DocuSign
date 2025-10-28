#!/usr/bin/env node

import { config } from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import jwt from 'jsonwebtoken';
import { PrismaClient } from './src/generated/prisma/client.js';

// Load environment variables
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
config({ path: join(__dirname, '.env') });

const prisma = new PrismaClient();

console.log('🔑 Generating Test Authentication Token');
console.log('=====================================');

async function main() {
  try {
    // Find the user
    const user = await prisma.user.findUnique({
      where: { email: 'jesal@gmail.com' }
    });
    
    if (!user) {
      console.log('❌ User jesal@gmail.com not found');
      console.log('💡 Please register this user first');
      return;
    }
    
    console.log('✅ Found user:', {
      id: user.id,
      name: user.name,
      email: user.email
    });
    
    // Generate a JWT token
    const jwtSecret = process.env.JWT_SECRET || 'your-secret-key';
    
    const token = jwt.sign(
      {
        userId: user.id,
        email: user.email,
        name: user.name
      },
      jwtSecret,
      { 
        expiresIn: '24h',
        issuer: 'docusign-backend'
      }
    );
    
    console.log('\n🎟️ Generated Token:');
    console.log('===================');
    console.log(token);
    
    console.log('\n📋 To test in browser console:');
    console.log('===============================');
    console.log(`localStorage.setItem('token', '${token}');`);
    console.log('window.location.reload();');
    
    // Test the token by making an API call
    console.log('\n🧪 Testing token with documents API...');
    
    // Import and test with our auth middleware
    const { requireAuth } = await import('./src/middleware/auth.js');
    
    // Simulate a request object
    const mockReq = {
      headers: {
        authorization: `Bearer ${token}`
      }
    };
    
    const mockRes = {
      status: (code) => ({ 
        json: (data) => {
          console.log(`❌ Auth failed with status ${code}:`, data);
          return { status: code, data };
        }
      })
    };
    
    const mockNext = () => {
      console.log('✅ Token validation successful');
    };
    
    // Test token validation
    try {
      await requireAuth(mockReq, mockRes, mockNext);
    } catch (error) {
      console.log('❌ Token validation failed:', error.message);
    }
    
  } catch (error) {
    console.error('❌ Script failed:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch(console.error);