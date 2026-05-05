/**
 * Quick script to take changelog screenshots using the preview browser's html2canvas.
 * Saves base64 PNG data extracted from the browser via eval.
 *
 * Usage: Run while dev server is on port 8080
 */
import { writeFileSync } from 'fs';

// The base64 data will be pasted here by the extraction process
// This is a helper - the actual capture happens via preview_eval + clipboard
console.log('This script is a placeholder. Screenshots are captured via the preview tool.');
