import { exec } from 'child_process';
import { NextResponse } from 'next/server';

export async function GET() {
  return new Promise((resolve) => {
    exec('python3 /Users/adowyer/Projects/CONSTRUIRFACIL/public/casas/create_gif.py', (error, stdout, stderr) => {
      if (error) {
        resolve(NextResponse.json({ error: error.message, stderr }, { status: 500 }));
      } else {
        resolve(NextResponse.json({ success: true, stdout }));
      }
    });
  });
}
