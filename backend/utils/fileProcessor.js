const fs = require('fs');
const path = require('path');
const pdfParse = require('pdf-parse');
const mammoth = require('mammoth');
const Tesseract = require('tesseract.js');

class FileProcessor {
  constructor() {
    this.supportedFormats = {
      '.pdf': this.processPDF,
      '.docx': this.processDOCX,
      '.doc': this.processDOCX,
      '.txt': this.processTXT,
      '.png': this.processImage,
      '.jpg': this.processImage,
      '.jpeg': this.processImage,
      '.gif': this.processImage,
      '.bmp': this.processImage
    };
  }

  async processFile(filePath, originalName) {
    try {
      const ext = path.extname(originalName).toLowerCase();
      const processor = this.supportedFormats[ext];
      
      if (!processor) {
        throw new Error(`Unsupported file format: ${ext}`);
      }

      const result = await processor(filePath);
      
      return {
        success: true,
        content: result,
        fileType: ext,
        fileName: originalName,
        wordCount: this.countWords(result)
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        fileName: originalName
      };
    }
  }

  async processPDF(filePath) {
    const dataBuffer = fs.readFileSync(filePath);
    const data = await pdfParse(dataBuffer);
    return data.text;
  }

  async processDOCX(filePath) {
    const result = await mammoth.extractRawText({ path: filePath });
    return result.value;
  }

  async processTXT(filePath) {
    return fs.readFileSync(filePath, 'utf8');
  }

  async processImage(filePath) {
    const result = await Tesseract.recognize(filePath, 'eng', {
      logger: m => console.log(m)
    });
    return result.data.text;
  }

  countWords(text) {
    return text.trim().split(/\s+/).length;
  }

  getFileSummary(content, maxLength = 500) {
    if (content.length <= maxLength) {
      return content;
    }
    return content.substring(0, maxLength) + '...';
  }

  getSupportedFormats() {
    return Object.keys(this.supportedFormats).map(ext => ext.substring(1));
  }
}

module.exports = FileProcessor; 