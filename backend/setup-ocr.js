/**
 * OCR Setup Script
 * Run this to test if Tesseract is properly installed
 */

const { exec } = require('child_process');
const util = require('util');
const execPromise = util.promisify(exec);

async function checkTesseract() {
  console.log('🔍 Checking Tesseract OCR installation...\n');
  
  try {
    // Try to run tesseract command
    const { stdout } = await execPromise('tesseract --version');
    console.log('✅ Tesseract is installed!');
    console.log(stdout);
    return true;
  } catch (error) {
    console.log('❌ Tesseract not found in PATH');
    console.log('\n📝 Installation instructions:');
    console.log('Windows: Download from https://github.com/UB-Mannheim/tesseract/wiki');
    console.log('Mac: brew install tesseract');
    console.log('Linux: sudo apt-get install tesseract-ocr');
    return false;
  }
}

async function checkNodeModules() {
  console.log('\n🔍 Checking Node.js dependencies...\n');
  
  try {
    require('tesseract.js');
    console.log('✅ tesseract.js is installed');
  } catch (error) {
    console.log('❌ tesseract.js not found');
    console.log('Run: npm install tesseract.js sharp');
    return false;
  }
  
  try {
    require('sharp');
    console.log('✅ sharp is installed');
  } catch (error) {
    console.log('❌ sharp not found');
    console.log('Run: npm install sharp');
    return false;
  }
  
  return true;
}

async function main() {
  console.log('🚀 OCR Setup Check\n');
  console.log('='.repeat(50));
  
  const tesseractOk = await checkTesseract();
  const modulesOk = await checkNodeModules();
  
  console.log('\n' + '='.repeat(50));
  
  if (tesseractOk && modulesOk) {
    console.log('\n✅ Everything is ready! OCR should work.');
  } else {
    console.log('\n⚠️  Please install missing components above.');
  }
}

main();










