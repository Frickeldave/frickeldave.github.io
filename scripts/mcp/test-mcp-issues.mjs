#!/usr/bin/env node

// Test script to verify MCP Server Issue functionality
// This script will test if we can access GitHub issues through the MCP server

import { spawn } from 'child_process';
import { createInterface } from 'readline';

// Start the MCP server
const server = spawn('node', ['./scripts/mcp/mcp-github-wrapper.mjs'], {
  cwd: '/home/dave/dev/private/frickeldave.github.io',
  stdio: ['pipe', 'pipe', 'pipe']
});

// Create readline interface for reading server output
const rl = createInterface({
  input: server.stdout,
  output: server.stdin
});

// Handle server output
server.stdout.on('data', (data) => {
  console.log(`[Server Output] ${data}`);
  
  // Try to parse as JSON
  try {
    const json = JSON.parse(data.toString());
    if (json.method === 'notifications/tools/list_changed') {
      console.log('Tools list updated - server is ready');
      // Send a request to list available tools
      const request = {
        jsonrpc: "2.0",
        id: 1,
        method: "tools/list"
      };
      server.stdin.write(JSON.stringify(request) + '\n');
    }
  } catch (e) {
    // Not JSON, just log it
    console.log(`Server: ${data}`);
  }
});

// Handle server errors
server.stderr.on('data', (data) => {
  console.error(`[Server Error] ${data}`);
});

// Handle server close
server.on('close', (code) => {
  console.log(`Server exited with code ${code}`);
});

// Handle server exit
server.on('exit', (code) => {
  console.log(`Server process exited with code ${code}`);
});

// Send initialize request after a short delay
setTimeout(() => {
  const initializeRequest = {
    jsonrpc: "2.0",
    id: 1,
    method: "initialize",
    params: {
      protocolVersion: "2024-06-11",
      capabilities: {},
      clientInfo: {
        name: "test-client",
        version: "1.0.0"
      }
    }
  };
  server.stdin.write(JSON.stringify(initializeRequest) + '\n');
}, 1000);

// Clean up on exit
process.on('exit', () => {
  server.kill();
});